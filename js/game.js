/* ==========================================================================
   Metro Builder — éditeur et simulation
   ========================================================================== */
(function () {
  'use strict';

  // ---------- Constantes ----------
  var GRID = 40;               // taille d'une case (unités monde)
  var LINE_W = 8;              // épaisseur d'une ligne
  var LINE_GAP = 8.5;          // décalage entre lignes parallèles
  var STOP_R = 8;              // rayon d'un arrêt
  var MIN_ZOOM = 0.25, MAX_ZOOM = 3;
  var TRAIN_SPEED = 120;       // unités monde / seconde
  var DWELL = 0.8;             // arrêt en station (s)
  var CAPACITY = 6;            // voyageurs par train
  var MAX_LINES = 18;
  var DRAG_THRESHOLD = 5;      // px écran avant de considérer un glissé

  var $ = function (s) { return document.querySelector(s); };
  var canvas = $('#map');
  var ctx = canvas.getContext('2d');

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }

  // ---------- Ville et état ----------
  var params = new URLSearchParams(location.search);
  var cityId = params.get('city') || safeGet('metroBuilder.city') || 'vierge';
  if (!MetroCities.get(cityId)) cityId = 'vierge';
  var city = MetroCities.get(cityId);
  var palette = MetroCities.palette(city);
  safeSet('metroBuilder.city', cityId);
  var SAVE_KEY = MetroCities.SAVE_PREFIX + cityId;

  var state = loadState() || MetroCities.buildInitialState(cityId);
  var stopMap = new Map(), lineMap = new Map(), lineIndex = new Map();
  var validation = null;
  var version = 0;
  var geom = null;

  var view = { x: 0, y: 0, zoom: 1, w: 0, h: 0, dpr: 1 };
  var ui = {
    tool: 'cursor',
    activeLine: state.lines[0] && state.lines[0].id,
    selected: null,
    hover: null,
    mouse: null,
    showLabels: true,
    rulesOpen: window.innerWidth > 900,
    popover: null
  };
  var playing = false;
  var sim = null;
  var undoStack = [], redoStack = [];
  var drag = null;
  var pointers = new Map();
  var pinch = null;
  var saveTimer = null;

  function loadState() {
    var raw = safeGet(SAVE_KEY);
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.stops) || !Array.isArray(s.lines) || !Array.isArray(s.edges) || !s.lines.length) return null;
      s.edges.forEach(function (e) { e.bends = e.bends || []; e.style = e.style || 'straight'; e.side = e.side || 1; });
      s.nextId = s.nextId || 1000;
      return s;
    } catch (e) { return null; }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    safeSet(SAVE_KEY, JSON.stringify(state));
  }

  function uid(prefix) { return prefix + (state.nextId++); }

  function reindex() {
    stopMap = new Map(state.stops.map(function (s) { return [s.id, s]; }));
    lineMap = new Map(state.lines.map(function (l) { return [l.id, l]; }));
    lineIndex = new Map(state.lines.map(function (l, i) { return [l.id, i]; }));
    if (!lineMap.has(ui.activeLine)) ui.activeLine = state.lines[0].id;
    if (ui.selected && !stopMap.has(ui.selected)) ui.selected = null;
    geom = null;
    version++;
  }

  // Après chaque modification : revalider, sauvegarder, rafraîchir l'interface
  function commit() {
    reindex();
    validation = MetroRules.validate(state);
    renderLineBar();
    renderRules();
    updatePlayButton();
    updateUndoButtons();
    updateHint();
    save();
  }

  function checkpoint() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 120) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return;
    if (playing) pause('edit');
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(undoStack.pop());
    hidePopover();
    commit();
  }
  function redo() {
    if (!redoStack.length) return;
    if (playing) pause('edit');
    undoStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    hidePopover();
    commit();
  }

  // ---------- Outils géométriques ----------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function distToSeg(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  }
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function W(p) { return { x: p.x * GRID, y: p.y * GRID }; }
  function toWorld(sp) {
    return { x: (sp.x - view.w / 2) / view.zoom + view.x, y: (sp.y - view.h / 2) / view.zoom + view.y };
  }
  function toScreen(wp) {
    return { x: (wp.x - view.x) * view.zoom + view.w / 2, y: (wp.y - view.y) * view.zoom + view.h / 2 };
  }
  function snapGrid(wp) { return { x: Math.round(wp.x / GRID), y: Math.round(wp.y / GRID) }; }
  function snapHalf(wp) { return { x: Math.round(wp.x / GRID * 2) / 2, y: Math.round(wp.y / GRID * 2) / 2 }; }
  function stopAt(gx, gy, exceptId) {
    for (var i = 0; i < state.stops.length; i++) {
      var s = state.stops[i];
      if (s.x === gx && s.y === gy && s.id !== exceptId) return s;
    }
    return null;
  }

  // ---------- Géométrie des liaisons (droit / courbe / zigzag) ----------
  function controlPts(e) {
    return [W(stopMap.get(e.a))].concat(e.bends.map(W), [W(stopMap.get(e.b))]);
  }

  // Point de contrôle situé « avant » un arrêt sur la même ligne (pour des courbes continues)
  function neighborControl(stopId, edge) {
    for (var i = 0; i < state.edges.length; i++) {
      var o = state.edges[i];
      if (o === edge || o.line !== edge.line || (o.a !== stopId && o.b !== stopId)) continue;
      var pts = controlPts(o);
      return o.a === stopId ? pts[1] : pts[pts.length - 2];
    }
    return null;
  }

  function reflect(p, q) { return { x: 2 * p.x - q.x, y: 2 * p.y - q.y }; }

  // Catmull-Rom centripète
  function crPoint(p0, p1, p2, p3, t) {
    function tj(a, b) { return Math.pow(Math.max(dist(a, b), 1e-3), 0.5); }
    var t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    var tt = t1 + (t2 - t1) * t;
    function lerp(A, B, ta, tb) { var w = (tt - ta) / (tb - ta); return { x: A.x + (B.x - A.x) * w, y: A.y + (B.y - A.y) * w }; }
    var A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
    var B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
    return lerp(B1, B2, t1, t2);
  }

  function catmullRom(points, p0, p3, samples) {
    var n = points.length;
    var ext = [p0 || reflect(points[0], points[1])].concat(points, [p3 || reflect(points[n - 1], points[n - 2])]);
    var out = [points[0]];
    for (var i = 1; i < ext.length - 2; i++) {
      for (var k = 1; k <= samples; k++) out.push(crPoint(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], k / samples));
    }
    return out;
  }

  function arcPath(A, B, bulge) {
    var len = dist(A, B) || 1;
    var nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
    var C = { x: (A.x + B.x) / 2 + nx * bulge * 2, y: (A.y + B.y) / 2 + ny * bulge * 2 };
    var out = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24, u = 1 - t;
      out.push({ x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, y: u * u * A.y + 2 * u * t * C.y + t * t * B.y });
    }
    return out;
  }

  function curvePath(e, cps) {
    var pts = catmullRom(cps, neighborControl(e.a, e), neighborControl(e.b, e), 16);
    if (e.bends.length === 0) {
      var A = cps[0], B = cps[1], len = dist(A, B), dev = 0;
      pts.forEach(function (p) { dev = Math.max(dev, distToSeg(p, A, B)); });
      if (dev < len * 0.08) pts = arcPath(A, B, (e.side || 1) * 0.22 * len);
    }
    return pts;
  }

  function zigzagPath(pts) {
    var out = [pts[0]];
    var amp = 6.5, wave = 15, margin = 12;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var len = dist(a, b);
      if (len < margin * 2 + wave) { out.push(b); continue; }
      var dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
      var inner = len - margin * 2;
      var n = Math.max(2, Math.round(inner / wave));
      out.push({ x: a.x + dx * margin, y: a.y + dy * margin });
      for (var k = 0; k < n; k++) {
        var d = margin + inner * (k + 0.5) / n;
        var s = k % 2 ? -1 : 1;
        out.push({ x: a.x + dx * d - dy * amp * s, y: a.y + dy * d + dx * amp * s });
      }
      out.push({ x: b.x - dx * margin, y: b.y - dy * margin });
      out.push(b);
    }
    return out;
  }

  function offsetPolyline(pts, off) {
    if (!off) return pts;
    return pts.map(function (p, i) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      var dx = p1.x - p0.x, dy = p1.y - p0.y;
      var L = Math.hypot(dx, dy) || 1;
      return { x: p.x - dy / L * off, y: p.y + dx / L * off };
    });
  }

  function withLengths(pts) {
    var cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    return { pts: pts, cum: cum, len: cum[cum.length - 1] };
  }

  function buildPath(e, off) {
    var cps = controlPts(e);
    if (e.style === 'curve') return offsetPolyline(curvePath(e, cps), off);
    var base = offsetPolyline(cps, off);
    return e.style === 'zigzag' ? zigzagPath(base) : base;
  }

  function computeGeometry() {
    geom = new Map();
    var groups = new Map();
    state.edges.forEach(function (e) {
      if (!stopMap.has(e.a) || !stopMap.has(e.b)) return;
      var k = pairKey(e.a, e.b);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    groups.forEach(function (list) {
      list.sort(function (p, q) { return (lineIndex.get(p.line) || 0) - (lineIndex.get(q.line) || 0); });
      list.forEach(function (e, i) {
        var off = (i - (list.length - 1) / 2) * LINE_GAP;
        if (e.a > e.b) off = -off;
        geom.set(e.id, withLengths(buildPath(e, off)));
      });
    });
  }

  function getGeom() { if (!geom) computeGeometry(); return geom; }

  function pointAt(path, s) {
    var cum = path.cum, pts = path.pts;
    s = clamp(s, 0, path.len);
    var lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    var a = pts[lo], b = pts[hi] || a;
    var seg = (cum[hi] - cum[lo]) || 1;
    var t = (s - cum[lo]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  // ---------- Détection sous le pointeur ----------
  function hitStop(wp) {
    var best = null, bestD = Math.max(STOP_R + 5, 15 / view.zoom);
    state.stops.forEach(function (s) {
      var d = dist(wp, W(s));
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }
  function hitBend(wp) {
    var best = null, bestD = Math.max(8, 11 / view.zoom);
    state.edges.forEach(function (e) {
      e.bends.forEach(function (b, idx) {
        var d = dist(wp, W(b));
        if (d < bestD) { bestD = d; best = { edge: e, idx: idx }; }
      });
    });
    return best;
  }
  function hitEdge(wp) {
    var g = getGeom();
    var best = null, bestD = Math.max(LINE_W / 2 + 3, 10 / view.zoom);
    state.edges.forEach(function (e) {
      var path = g.get(e.id);
      if (!path) return;
      for (var i = 0; i < path.pts.length - 1; i++) {
        var d = distToSeg(wp, path.pts[i], path.pts[i + 1]);
        if (d < bestD) { bestD = d; best = e; }
      }
    });
    return best;
  }

  // ---------- Actions d'édition ----------
  function lineLabel(id) { var l = lineMap.get(id); return l ? l.label : '?'; }

  function nextStationName() {
    var max = 0;
    state.stops.forEach(function (s) {
      var m = /^Station (\d+)$/.exec(s.name);
      if (m) max = Math.max(max, +m[1]);
    });
    return 'Station ' + Math.max(max + 1, state.stops.length + 1);
  }

  function createStop(g) {
    var s = { id: uid('s'), x: g.x, y: g.y, name: nextStationName() };
    state.stops.push(s);
    stopMap.set(s.id, s);
    return s;
  }

  function lineDegree(lineId, stopId) {
    var n = 0;
    state.edges.forEach(function (e) { if (e.line === lineId && (e.a === stopId || e.b === stopId)) n++; });
    return n;
  }

  // Relie deux arrêts avec la ligne active
  function linkStops(aId, bId) {
    var lineId = ui.activeLine;
    if (aId === bId) return false;
    var exists = state.edges.some(function (e) {
      return e.line === lineId && pairKey(e.a, e.b) === pairKey(aId, bId);
    });
    if (exists) {
      toast('Ces arrêts sont déjà reliés par la ligne ' + lineLabel(lineId) + '.');
      return false;
    }
    var full = [aId, bId].filter(function (id) { return lineDegree(lineId, id) >= 2; });
    if (full.length) {
      toast('La ligne ' + lineLabel(lineId) + ' passe déjà par « ' + stopMap.get(full[0]).name +
        ' » dans les deux sens : une ligne ne peut pas se ramifier. Utilisez une autre ligne pour une correspondance.', true);
      return false;
    }
    state.edges.push({ id: uid('e'), line: lineId, a: aId, b: bId, style: 'straight', bends: [], side: 1 });
    return true;
  }

  // Supprime un arrêt ; si une ligne le traversait, on referme la ligne entre ses voisins
  function deleteStop(id) {
    var byLine = new Map();
    state.edges.forEach(function (e) {
      if (e.a !== id && e.b !== id) return;
      if (!byLine.has(e.line)) byLine.set(e.line, []);
      byLine.get(e.line).push(e);
    });
    state.edges = state.edges.filter(function (e) { return e.a !== id && e.b !== id; });
    byLine.forEach(function (list, lineId) {
      if (list.length !== 2) return;
      var n1 = list[0].a === id ? list[0].b : list[0].a;
      var n2 = list[1].a === id ? list[1].b : list[1].a;
      if (n1 === n2) return;
      var dup = state.edges.some(function (e) { return e.line === lineId && pairKey(e.a, e.b) === pairKey(n1, n2); });
      if (!dup) {
        state.edges.push({ id: uid('e'), line: lineId, a: n1, b: n2,
          style: list[0].style === list[1].style ? list[0].style : 'straight', bends: [], side: 1 });
      }
    });
    state.stops = state.stops.filter(function (s) { return s.id !== id; });
    if (ui.selected === id) ui.selected = null;
  }

  function insertBend(edge, wp) {
    var g = snapHalf(wp);
    if (state.stops.some(function (s) { return s.x === g.x && s.y === g.y; })) {
      toast('Un point de pli ne peut pas être posé sur un arrêt : cliquez un peu plus loin.');
      return;
    }
    if (edge.bends.some(function (b) { return b.x === g.x && b.y === g.y; })) return;
    var cps = controlPts(edge);
    var best = 0, bestD = Infinity;
    for (var i = 0; i < cps.length - 1; i++) {
      var d = distToSeg(wp, cps[i], cps[i + 1]);
      if (d < bestD) { bestD = d; best = i; }
    }
    checkpoint();
    edge.bends.splice(best, 0, g);
    commit();
  }

  function setEdgeStyle(edge, style) {
    checkpoint();
    if (style === 'curve' && edge.style === 'curve') edge.side = -(edge.side || 1);
    edge.style = style;
    commit();
  }

  function eraseAt(wp, d) {
    function begin() { if (!d.did) { checkpoint(); d.did = true; } }
    var s = hitStop(wp);
    if (s) { begin(); deleteStop(s.id); reindex(); return; }
    var b = hitBend(wp);
    if (b) { begin(); b.edge.bends.splice(b.idx, 1); geom = null; return; }
    var e = hitEdge(wp);
    if (e) { begin(); state.edges = state.edges.filter(function (x) { return x !== e; }); reindex(); }
  }

  function clickStop(id) {
    if (ui.selected === id) {
      ui.selected = null;
    } else if (ui.selected && stopMap.has(ui.selected)) {
      checkpoint();
      if (linkStops(ui.selected, id)) commit(); else undoStack.pop();
      ui.selected = id;
    } else {
      ui.selected = id;
    }
    updateHint();
  }

  function clickEmpty(wp) {
    var g = snapGrid(wp);
    if (stopAt(g.x, g.y)) return;
    checkpoint();
    var s = createStop(g);
    if (ui.selected && stopMap.has(ui.selected)) {
      ui.selected = linkStops(ui.selected, s.id) ? s.id : null;
    }
    commit();
  }

  function renameStop(s) {
    var name = prompt('Nom de l’arrêt :', s.name);
    if (name === null) return;
    name = name.trim();
    if (!name || name === s.name) return;
    checkpoint();
    s.name = name.slice(0, 40);
    commit();
  }

  function addLine() {
    if (state.lines.length >= MAX_LINES) { toast('Nombre maximum de lignes atteint.'); return; }
    if (playing) pause('edit');
    var labels = state.lines.map(function (l) { return l.label; });
    var n = 1;
    while (labels.indexOf(String(n)) >= 0) n++;
    checkpoint();
    var used = state.lines.map(function (l) { return l.color.toLowerCase(); });
    var free = palette.colors.filter(function (c) { return used.indexOf(c.hex.toLowerCase()) < 0; })[0];
    var color = (free || palette.colors[state.lines.length % palette.colors.length]).hex;
    var line = { id: uid('l'), label: String(n), color: color };
    state.lines.push(line);
    ui.activeLine = line.id;
    commit();
    colorPickerNew = line.id;
    openColorPicker(line.id);
    var list = $('#line-list');
    list.scrollTop = list.scrollHeight;
  }

  function resetMap() {
    if (!confirm('Réinitialiser la carte « ' + city.name + ' » ? Vos modifications seront perdues (Ctrl+Z pour annuler).')) return;
    if (playing) pause('edit');
    checkpoint();
    state = MetroCities.buildInitialState(cityId);
    ui.selected = null;
    ui.activeLine = state.lines[0].id;
    sim = null;
    commit();
    fitView();
  }

  // ---------- Lecture / pause ----------
  function play() {
    if (playing) return;
    if (!validation.ok) { showBlocked(); return; }
    hidePopover();
    ui.selected = null;
    if (!sim || sim.version !== version) sim = buildSim();
    playing = true;
    document.body.classList.add('playing');
    updatePlayButton();
    updateHint();
    updateCursor();
  }

  function pause(reason) {
    if (!playing) return;
    playing = false;
    document.body.classList.remove('playing');
    updatePlayButton();
    updateHint();
    updateCursor();
    if (reason === 'edit') toast('Simulation en pause : vous pouvez modifier le réseau.');
    else if (reason === 'auto') toast('Simulation mise en pause automatiquement.');
  }

  function togglePlay() { if (playing) pause('user'); else play(); }

  function showBlocked() {
    var err = validation.firstError;
    toast('Lecture impossible — ' + (err ? err.message : 'règles non respectées.'), true);
    ui.rulesOpen = true;
    renderRules();
    var panel = $('#rules-panel');
    panel.classList.remove('shake');
    void panel.offsetWidth;
    panel.classList.add('shake');
  }

  // ---------- Simulation ----------
  function orderLine(edges, loop) {
    var adj = new Map();
    edges.forEach(function (e) {
      [[e.a, e.b], [e.b, e.a]].forEach(function (p) {
        if (!adj.has(p[0])) adj.set(p[0], []);
        adj.get(p[0]).push({ e: e, other: p[1] });
      });
    });
    var start = edges[0].a;
    if (!loop) adj.forEach(function (list, k) { if (list.length === 1) start = k; });
    var used = new Set(), seq = [], stops = [start], cur = start;
    for (;;) {
      var next = adj.get(cur).filter(function (x) { return !used.has(x.e.id); })[0];
      if (!next) break;
      used.add(next.e.id);
      seq.push({ edge: next.e, forward: next.e.a === cur });
      cur = next.other;
      stops.push(cur);
    }
    return { seq: seq, stops: stops };
  }

  function buildSim() {
    var g = getGeom();
    var routes = [];
    state.lines.forEach(function (line) {
      var edges = state.edges.filter(function (e) { return e.line === line.id; });
      if (!edges.length) return;
      var info = validation.lines.get(line.id);
      var loop = !!(info && info.loop);
      var order = orderLine(edges, loop);
      var pts = [], ends = [0];
      order.seq.forEach(function (step) {
        var p = g.get(step.edge.id).pts.slice();
        if (!step.forward) p.reverse();
        pts = pts.concat(p);
        ends.push(pts.length - 1);
      });
      var path = withLengths(pts);
      var marks = ends.map(function (idx) { return path.cum[idx]; });
      var L = path.len;
      var ring = [], R;
      if (loop) {
        R = L;
        for (var i = 0; i < marks.length - 1; i++) ring.push({ u: marks[i], stop: order.stops[i] });
      } else {
        R = 2 * L;
        marks.forEach(function (m, i) { ring.push({ u: m, stop: order.stops[i] }); });
        for (var j = marks.length - 2; j >= 1; j--) ring.push({ u: 2 * L - marks[j], stop: order.stops[j] });
      }
      var count = clamp(Math.round(R / (loop ? 420 : 900)), 1, loop ? 5 : 3);
      var trains = [];
      for (var t = 0; t < count; t++) trains.push({ u: (t * R / count) % R, dwell: 0, load: 0 });
      routes.push({ line: line, path: path, loop: loop, L: L, R: R, ring: ring, trains: trains });
    });
    var waiting = new Map();
    state.stops.forEach(function (s) { waiting.set(s.id, Math.floor(Math.random() * 3)); });
    return { version: version, routes: routes, waiting: waiting, delivered: 0, time: 0 };
  }

  function arrive(train, stopId) {
    var lines = validation.stopLines.get(stopId) || 1;
    if (train.load > 0) {
      var share = lines > 1 ? 0.6 : 0.35;
      var off = Math.min(train.load, Math.round(train.load * share + Math.random() * 1.2));
      train.load -= off;
      sim.delivered += off;
    }
    var w = sim.waiting.get(stopId) || 0;
    var board = Math.min(CAPACITY - train.load, w);
    train.load += board;
    sim.waiting.set(stopId, w - board);
  }

  function tickSim(dt) {
    sim.time += dt;
    sim.waiting.forEach(function (w, id) {
      if (w < 12 && Math.random() < dt * 0.3) sim.waiting.set(id, w + 1);
    });
    sim.routes.forEach(function (r) {
      r.trains.forEach(function (t) {
        if (t.dwell > 0) { t.dwell -= dt; return; }
        var ahead = Infinity, behind = Infinity, next = null;
        r.ring.forEach(function (m) {
          var d = (m.u - t.u + r.R) % r.R;
          if (d < 1e-6) d = r.R;
          if (d < ahead) { ahead = d; next = m; }
          var b = (t.u - m.u + r.R) % r.R;
          if (b < behind) behind = b;
        });
        var v = TRAIN_SPEED * clamp(Math.min(ahead / 70, (behind + 6) / 45), 0.18, 1);
        var step = v * dt;
        if (next && step >= ahead) {
          t.u = next.u;
          t.dwell = DWELL;
          arrive(t, next.stop);
        } else {
          t.u = (t.u + step) % r.R;
        }
      });
    });
  }

  function trainPose(r, t) {
    var forward = r.loop || t.u <= r.L;
    var s = forward ? t.u : 2 * r.L - t.u;
    var p = pointAt(r.path, s);
    if (!forward) p.angle += Math.PI;
    return p;
  }

  // ---------- Rendu ----------
  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  }

  function fitView() {
    if (!state.stops.length) { view.x = 0; view.y = 0; view.zoom = 1; return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.stops.forEach(function (s) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    });
    var padL = 120, padR = ui.rulesOpen && view.w > 900 ? 350 : 40, padT = 100, padB = 130;
    var bw = (maxX - minX) * GRID + GRID * 2, bh = (maxY - minY) * GRID + GRID * 2;
    var availW = Math.max(200, view.w - padL - padR), availH = Math.max(200, view.h - padT - padB);
    view.zoom = clamp(Math.min(availW / bw, availH / bh), 0.35, 1.6);
    view.x = (minX + maxX) / 2 * GRID - (padL - padR) / 2 / view.zoom;
    view.y = (minY + maxY) / 2 * GRID - (padT - padB) / 2 / view.zoom;
  }

  function strokePath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function drawGrid() {
    var z = view.zoom;
    var x0 = view.x - view.w / 2 / z, x1 = view.x + view.w / 2 / z;
    var y0 = view.y - view.h / 2 / z, y1 = view.y + view.h / 2 / z;
    var step = GRID * z < 14 ? 5 : 1;
    ctx.lineWidth = 1 / z;
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#dedee5' : '#ececf1';
      ctx.beginPath();
      for (var i = Math.floor(x0 / GRID); i <= Math.ceil(x1 / GRID); i++) {
        if (i % step) continue;
        if ((i % 5 === 0) !== !!pass) continue;
        ctx.moveTo(i * GRID, y0); ctx.lineTo(i * GRID, y1);
      }
      for (var j = Math.floor(y0 / GRID); j <= Math.ceil(y1 / GRID); j++) {
        if (j % step) continue;
        if ((j % 5 === 0) !== !!pass) continue;
        ctx.moveTo(x0, j * GRID); ctx.lineTo(x1, j * GRID);
      }
      ctx.stroke();
    }
  }

  function editing() { return !playing; }

  function drawEdges() {
    var g = getGeom();
    var hoverEdge = ui.hover && ui.hover.type === 'edge' ? ui.hover.edge : null;
    var popEdge = ui.popover ? ui.popover.edge : null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    [hoverEdge, popEdge].forEach(function (e, i) {
      if (!e || !g.get(e.id) || !editing()) return;
      if (i === 0 && ui.tool !== 'eraser' && ui.tool !== 'point') return;
      ctx.strokeStyle = ui.tool === 'eraser' ? 'rgba(254,75,75,0.35)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = LINE_W + 10;
      strokePath(g.get(e.id).pts);
    });
    var sorted = state.edges.slice().sort(function (a, b) {
      return (lineIndex.get(a.line) || 0) - (lineIndex.get(b.line) || 0);
    });
    sorted.forEach(function (e) {
      var path = g.get(e.id);
      var line = lineMap.get(e.line);
      if (!path || !line) return;
      ctx.strokeStyle = line.color;
      ctx.lineWidth = LINE_W;
      strokePath(path.pts);
    });
  }

  function drawBends() {
    if (!editing() || ui.tool === 'move') return;
    state.edges.forEach(function (e) {
      var line = lineMap.get(e.line);
      e.bends.forEach(function (b, idx) {
        var p = W(b);
        var hot = ui.hover && ui.hover.type === 'bend' && ui.hover.edge === e && ui.hover.idx === idx;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hot ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = hot && ui.tool === 'eraser' ? '#ffe3e3' : '#fff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = hot && ui.tool === 'eraser' ? '#FE4B4B' : (line ? line.color : '#1d1d1f');
        ctx.stroke();
      });
    });
  }

  function drawGhost() {
    if (!editing() || ui.tool !== 'cursor' || !ui.mouse || drag) return;
    var wp = toWorld(ui.mouse);
    var hovered = ui.hover && ui.hover.type === 'stop' ? ui.hover.stop : null;
    var g = snapGrid(wp);
    var target = hovered ? W(hovered) : W(g);
    var line = lineMap.get(ui.activeLine);
    if (ui.selected && stopMap.has(ui.selected) && (!hovered || hovered.id !== ui.selected)) {
      var from = W(stopMap.get(ui.selected));
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = line ? line.color : '#999';
      ctx.lineWidth = LINE_W * 0.75;
      ctx.lineCap = 'round';
      strokePath([from, target]);
      ctx.restore();
    }
    if (!hovered && !stopAt(g.x, g.y)) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, STOP_R - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(29,29,31,0.25)';
      ctx.stroke();
    }
  }

  function drawStops(now) {
    var counts = validation ? validation.stopLines : new Map();
    state.stops.forEach(function (s) {
      var p = W(s);
      var n = counts.get(s.id) || 0;
      var hot = editing() && ui.hover && ui.hover.type === 'stop' && ui.hover.stop === s;
      var r = n > 1 ? STOP_R + 2.5 : STOP_R;
      if (hot && ui.tool !== 'move') r += 1.5;

      if (ui.selected === s.id && editing()) {
        var line = lineMap.get(ui.activeLine);
        var pulse = 0.5 + 0.5 * Math.sin(now / 220);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 6 + pulse * 2, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = line ? line.color : '#1d1d1f';
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      var erase = hot && ui.tool === 'eraser';
      ctx.fillStyle = erase ? '#ffe3e3' : (s.color || '#fff');
      ctx.fill();
      ctx.lineWidth = n > 1 ? 3.5 : 3;
      if (n === 0) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#FE4B4B';
      } else {
        ctx.strokeStyle = erase ? '#FE4B4B' : '#1d1d1f';
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawWaiting() {
    if (!sim || sim.version !== version) return;
    ctx.fillStyle = 'rgba(29,29,31,0.7)';
    state.stops.forEach(function (s) {
      var w = sim.waiting.get(s.id) || 0;
      if (!w) return;
      var p = W(s);
      var shown = Math.min(w, 8);
      for (var i = 0; i < shown; i++) {
        var col = i % 4, row = Math.floor(i / 4);
        ctx.beginPath();
        ctx.arc(p.x + STOP_R + 8 + col * 6, p.y + STOP_R + 2 + row * 6, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTrains() {
    if (!sim || sim.version !== version) return;
    sim.routes.forEach(function (r) {
      r.trains.forEach(function (t) {
        var p = trainPose(r, t);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        roundRect(-14, -7, 28, 14, 5);
        ctx.fillStyle = r.line.color;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        for (var i = 0; i < t.load; i++) {
          var col = i % 3, row = Math.floor(i / 3);
          ctx.beginPath();
          ctx.arc(-7 + col * 7, -2.5 + row * 5, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    });
  }

  function drawLabels() {
    if (!ui.showLabels || view.zoom < 0.55) return;
    ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var placed = [];
    var fits = function (r) {
      for (var i = 0; i < placed.length; i++) {
        var q = placed[i];
        if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) return false;
      }
      return true;
    };
    state.stops.forEach(function (s) {
      var sp = toScreen(W(s));
      if (sp.x < -100 || sp.y < -20 || sp.x > view.w + 20 || sp.y > view.h + 20) return;
      var w = ctx.measureText(s.name).width + 4, h = 14;
      var dx = (STOP_R + 6) * view.zoom + 4, dy = (STOP_R + 4) * view.zoom + 4;
      var spots = [[sp.x + dx, sp.y - dy], [sp.x - dx - w, sp.y - dy], [sp.x + dx, sp.y + dy], [sp.x - dx - w, sp.y + dy]];
      var spot = null;
      for (var i = 0; i < spots.length && !spot; i++) {
        var r = { x: spots[i][0] - 2, y: spots[i][1] - h / 2, w: w, h: h };
        if (fits(r)) { spot = spots[i]; placed.push(r); }
      }
      if (!spot) return;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(251,251,253,0.95)';
      ctx.strokeText(s.name, spot[0], spot[1]);
      ctx.fillStyle = '#3a3a3c';
      ctx.fillText(s.name, spot[0], spot[1]);
    });
  }

  function draw(now) {
    var d = view.dpr, z = view.zoom;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#fbfbfd';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(d * z, 0, 0, d * z, d * (view.w / 2 - view.x * z), d * (view.h / 2 - view.y * z));
    drawGrid();
    drawEdges();
    drawBends();
    drawGhost();
    drawStops(now);
    drawWaiting();
    drawTrains();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    drawLabels();
  }

  var lastFrame = performance.now();
  var lastHud = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (playing && sim) {
      tickSim(dt);
      if (now - lastHud > 300) { lastHud = now; updateHint(); }
    }
    draw(now);
    requestAnimationFrame(frame);
  }

  // ---------- Interface ----------
  function textOn(hex) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substr(0, 2), 16) / 255, g = parseInt(c.substr(2, 2), 16) / 255, b = parseInt(c.substr(4, 2), 16) / 255;
    var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.55 ? '#1d1d1f' : '#fff';
  }

  function renderLineBar() {
    var list = $('#line-list');
    var scroll = list.scrollTop;
    list.innerHTML = '';
    state.lines.forEach(function (l, i) {
      var info = validation.lines.get(l.id) || {};
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'line-chip' + (l.id === ui.activeLine ? ' active' : '') + (info.used ? '' : ' unused');
      b.style.setProperty('--c', l.color);
      b.style.color = textOn(l.color);
      b.textContent = l.label;
      if (info.loop) {
        var badge = document.createElement('i');
        badge.className = 'loop-badge';
        badge.textContent = '↻';
        b.appendChild(badge);
      }
      b.title = 'Ligne ' + l.label + (info.used ? ' · ' + info.stops + ' arrêts' + (info.loop ? ' · boucle' : '') : ' · vide') +
        (i < 9 ? ' (touche ' + (i + 1) + ')' : '') +
        (l.id === ui.activeLine ? ' · cliquez pour changer la couleur' : '');
      b.setAttribute('aria-pressed', l.id === ui.activeLine ? 'true' : 'false');
      b.dataset.line = l.id;
      b.addEventListener('click', function () {
        if (l.id === ui.activeLine) {
          if (colorPickerLine === l.id) closeColorPicker();
          else openColorPicker(l.id);
          return;
        }
        ui.activeLine = l.id;
        closeColorPicker();
        renderLineBar();
        updateHint();
      });
      b.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        ui.activeLine = l.id;
        renderLineBar();
        updateHint();
        openColorPicker(l.id);
      });
      list.appendChild(b);
    });
    list.scrollTop = scroll;
  }

  // ---------- Sélecteur de couleur des lignes ----------
  var colorPickerLine = null;
  var colorPickerNew = null;

  function lineById(id) {
    return state.lines.filter(function (l) { return l.id === id; })[0] || null;
  }

  function openColorPicker(lineId) {
    var line = lineById(lineId);
    if (!line) return;
    colorPickerLine = lineId;
    var panel = $('#color-picker');
    var current = line.color.toLowerCase();
    var taken = state.lines.filter(function (l) { return l.id !== lineId; })
      .map(function (l) { return l.color.toLowerCase(); });
    var families = palette.families || [{ key: '', name: 'Couleurs' }];
    var html = '<div class="cp-head"><span class="cp-chip" style="--c:' + esc(line.color) + ';color:' + textOn(line.color) + '">' +
      esc(line.label) + '</span><div><strong>' + (colorPickerNew === lineId ? 'Nouvelle ligne : choisissez sa couleur' : 'Couleur de la ligne ' + esc(line.label)) + '</strong>' +
      '<span class="cp-current"></span></div></div>';
    families.forEach(function (f) {
      var colors = palette.colors.filter(function (c) { return (c.family || '') === f.key; });
      if (!colors.length) return;
      html += '<div class="cp-family"><h4>' + esc(f.name) + '</h4><div class="cp-row">';
      colors.forEach(function (c) {
        var hex = c.hex.toLowerCase();
        html += '<button type="button" class="cp-swatch' + (hex === current ? ' selected' : '') +
          (taken.indexOf(hex) >= 0 ? ' taken' : '') + '" data-hex="' + c.hex + '" style="--c:' + c.hex +
          ';color:' + textOn(c.hex) + '" title="' + esc(c.name) + (taken.indexOf(hex) >= 0 ? ' (déjà utilisée)' : '') +
          '" aria-label="' + esc(c.name) + '" aria-pressed="' + (hex === current) + '">' + CHECK + '</button>';
      });
      html += '</div></div>';
    });
    var selStop = ui.selected && stopMap.get(ui.selected);
    if (selStop) html += stopColorSection(selStop);
    panel.innerHTML = html;
    var named = palette.colors.filter(function (c) { return c.hex.toLowerCase() === current; })[0];
    panel.querySelector('.cp-current').textContent = named ? named.name : line.color.toUpperCase();
    var chip = document.querySelector('.line-chip[data-line="' + lineId + '"]');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (chip) {
      var r = chip.getBoundingClientRect();
      var h = panel.offsetHeight;
      var top = Math.max(12, Math.min(window.innerHeight - h - 12, r.top + r.height / 2 - 40));
      panel.style.top = top + 'px';
    }
  }

  function closeColorPicker() {
    if (!colorPickerLine) return;
    colorPickerLine = null;
    colorPickerNew = null;
    var panel = $('#color-picker');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function setLineColor(lineId, hex) {
    var line = lineById(lineId);
    if (!line || line.color.toLowerCase() === hex.toLowerCase()) return;
    if (playing) pause('edit');
    checkpoint();
    line.color = hex;
    commit();
    openColorPicker(lineId);
  }

  // ---------- Couleur d'un arrêt : réglée uniquement depuis la barre des couleurs ----------
  function stopColorSection(s) {
    var current = s.color ? s.color.toLowerCase() : '';
    var families = palette.families || [{ key: '', name: 'Couleurs' }];
    var html = '<div class="cp-family cp-stop-sec" data-stop="' + esc(s.id) + '"><h4>Couleur de l’arrêt « ' + esc(s.name) + ' »</h4>';
    families.forEach(function (f) {
      var colors = palette.colors.filter(function (c) { return (c.family || '') === f.key; });
      if (!colors.length) return;
      html += '<div class="cp-row">';
      colors.forEach(function (c) {
        var hex = c.hex.toLowerCase();
        html += '<button type="button" class="cp-swatch' + (hex === current ? ' selected' : '') +
          '" data-hex="' + c.hex + '" style="--c:' + c.hex + ';color:' + textOn(c.hex) +
          '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" aria-pressed="' + (hex === current) + '">' +
          CHECK + '</button>';
      });
      html += '</div>';
    });
    html += '<button type="button" class="cp-clear"' + (s.color ? '' : ' disabled') + '>' +
      CROSS + '<span>Retirer la couleur de l’arrêt</span></button></div>';
    return html;
  }

  // Cliquer la couleur déjà choisie (ou « Retirer ») enlève la couleur de l'arrêt
  function setStopColor(stopId, hex) {
    var s = stopMap.get(stopId);
    if (!s) return;
    var same = !!s.color && !!hex && s.color.toLowerCase() === hex.toLowerCase();
    var next = same ? null : (hex || null);
    if ((s.color || null) === next) return;
    checkpoint();
    if (next) s.color = next; else delete s.color;
    commit();
    if (colorPickerLine) openColorPicker(colorPickerLine);
  }

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderRules() {
    var panel = $('#rules-panel');
    panel.classList.toggle('collapsed', !ui.rulesOpen);
    $('#rules-btn').classList.toggle('active', ui.rulesOpen);
    var failed = validation.results.filter(function (r) { return !r.ok; }).length;
    var status = $('#rules-status');
    status.className = 'rules-status ' + (failed ? 'ko' : 'ok');
    status.textContent = failed ? (failed + (failed > 1 ? ' règles à corriger' : ' règle à corriger')) : 'Prêt pour la lecture';
    $('#rules-list').innerHTML = validation.results.map(function (r) {
      return '<li class="rule ' + (r.ok ? 'ok' : 'ko') + '"><span class="rule-icon">' + (r.ok ? CHECK : CROSS) + '</span>' +
        '<div><div class="rule-title">' + esc(r.title) + '</div>' +
        (r.ok ? '' : '<div class="rule-msg">' + esc(r.message) + '</div>') + '</div></li>';
    }).join('');
    var st = validation.stats;
    $('#rules-stats').textContent = st.stops + ' arrêts · ' + st.lines + (st.lines > 1 ? ' lignes' : ' ligne') + ' · ' +
      st.interchanges + (st.interchanges > 1 ? ' correspondances' : ' correspondance') + ' · ' +
      st.loops + (st.loops > 1 ? ' boucles' : ' boucle');
  }

  function updatePlayButton() {
    var btn = $('#play-btn');
    btn.classList.toggle('playing', playing);
    btn.classList.toggle('blocked', !playing && !validation.ok);
    btn.setAttribute('aria-disabled', !playing && !validation.ok ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
    btn.title = playing ? 'Pause (Espace)' :
      (validation.ok ? 'Lecture (Espace)' : 'Lecture bloquée : ' + (validation.firstError ? validation.firstError.message : ''));
  }

  function updateUndoButtons() {
    $('#undo-btn').disabled = !undoStack.length;
    $('#redo-btn').disabled = !redoStack.length;
  }

  var HINTS = {
    cursor: '<strong>Curseur</strong> · Cliquez une intersection pour poser un arrêt · Cliquez deux arrêts pour les relier · Glissez un arrêt pour le déplacer · Double-clic pour le renommer',
    point: '<strong>Point</strong> · Cliquez une liaison pour ajouter un point de pli ou choisir son style (droit, courbe, zigzag) · Glissez un point pour le déplacer',
    move: '<strong>Déplacement</strong> · Glissez pour vous déplacer · Molette ou pincement pour zoomer',
    eraser: '<strong>Gomme</strong> · Cliquez ou glissez sur un arrêt, une liaison ou un point pour l’effacer'
  };

  function updateHint() {
    var el = $('#hint');
    if (playing && sim) {
      var trains = sim.routes.reduce(function (n, r) { return n + r.trains.length; }, 0);
      el.innerHTML = '<span class="live-dot"></span><strong>Simulation en cours</strong> · ' + trains +
        (trains > 1 ? ' trains' : ' train') + ' · ' + sim.delivered + ' voyageurs transportés · Modifier remet en pause';
      return;
    }
    if (ui.tool === 'cursor' && ui.selected && stopMap.has(ui.selected)) {
      el.innerHTML = 'Relier depuis <strong>« ' + esc(stopMap.get(ui.selected).name) + ' »</strong> avec la ligne <strong>' +
        esc(lineLabel(ui.activeLine)) + '</strong> · Cliquez un autre arrêt ou une intersection · Échap pour annuler';
      return;
    }
    el.innerHTML = HINTS[ui.tool];
  }

  var toastTimer = null;
  function toast(msg, warn) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('warn', !!warn);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, warn ? 4200 : 2600);
  }

  function setTool(tool) {
    ui.tool = tool;
    if (tool !== 'cursor') ui.selected = null;
    hidePopover();
    document.querySelectorAll('.tool-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    updateHint();
    updateCursor();
  }

  var ERASER_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="rgba(254,75,75,0.15)" stroke="#FE4B4B" stroke-width="2"/></svg>') + '") 12 12, crosshair';

  function updateCursor() {
    var c = 'default';
    var h = ui.hover;
    if (drag && (drag.type === 'pan' || drag.moved && (drag.type === 'empty' || drag.type === 'edgeclick' || drag.type === 'playpress'))) c = 'grabbing';
    else if (drag && (drag.type === 'stop' || drag.type === 'bend')) c = 'grabbing';
    else if (ui.tool === 'move') c = 'grab';
    else if (ui.tool === 'eraser') c = ERASER_CURSOR;
    else if (ui.tool === 'cursor') c = h && (h.type === 'stop' || h.type === 'bend') ? 'pointer' : 'crosshair';
    else if (ui.tool === 'point') c = h && (h.type === 'edge' || h.type === 'bend') ? 'pointer' : 'default';
    canvas.style.cursor = c;
  }

  function updateHover(sp) {
    if (!sp) { ui.hover = null; updateCursor(); return; }
    var wp = toWorld(sp);
    var h = null;
    if (ui.tool !== 'move') {
      var s = hitStop(wp);
      if (s) h = { type: 'stop', stop: s };
      else if (!playing) {
        var b = hitBend(wp);
        if (b) h = { type: 'bend', edge: b.edge, idx: b.idx };
        else if (ui.tool === 'point' || ui.tool === 'eraser') {
          var e = hitEdge(wp);
          if (e) h = { type: 'edge', edge: e };
        }
      }
    }
    ui.hover = h;
    updateCursor();
  }

  // ---------- Popover (style de liaison) ----------
  function showPopover(edge, sp, wp) {
    ui.popover = { edge: edge, wp: wp };
    var pop = $('#seg-popover');
    pop.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('current', b.dataset.action === edge.style);
    });
    var x = clamp(sp.x, 150, view.w - 150);
    var y = Math.max(sp.y, 110);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    pop.classList.add('open');
  }
  function hidePopover() {
    ui.popover = null;
    $('#seg-popover').classList.remove('open');
  }

  $('#seg-popover').addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
  $('#color-picker').addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
  $('#color-picker').addEventListener('click', function (ev) {
    var sec = ev.target.closest('.cp-stop-sec');
    if (sec) {
      if (ev.target.closest('.cp-clear')) { setStopColor(sec.dataset.stop, null); return; }
      var ssw = ev.target.closest('.cp-swatch');
      if (ssw) setStopColor(sec.dataset.stop, ssw.dataset.hex);
      return;
    }
    var sw = ev.target.closest('.cp-swatch');
    if (sw && colorPickerLine) setLineColor(colorPickerLine, sw.dataset.hex);
  });
  document.addEventListener('pointerdown', function (ev) {
    if (colorPickerLine && !ev.target.closest('#color-picker, .line-chip')) closeColorPicker();
  });
  $('#seg-popover').addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn || !ui.popover) return;
    var edge = ui.popover.edge, wp = ui.popover.wp;
    hidePopover();
    if (state.edges.indexOf(edge) < 0) return;
    if (btn.dataset.action === 'bend') insertBend(edge, wp);
    else setEdgeStyle(edge, btn.dataset.action);
  });

  // ---------- Pointeur : souris, stylet, tactile ----------
  function screenPt(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function panBy(dx, dy) {
    view.x -= dx / view.zoom;
    view.y -= dy / view.zoom;
  }

  function zoomAt(sp, factor) {
    var before = toWorld(sp);
    view.zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    var after = toWorld(sp);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
  }

  function pinchInfo() {
    var p = Array.from(pointers.values());
    return { d: Math.max(1, dist(p[0], p[1])), mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } };
  }

  canvas.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse' && ev.button > 2) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    var sp = screenPt(ev);
    pointers.set(ev.pointerId, sp);
    ui.mouse = sp;
    hidePopover();

    if (pointers.size === 2) {
      if (drag && drag.moved && (drag.type === 'stop' || drag.type === 'bend' || drag.type === 'erase')) commit();
      drag = null;
      var pi = pinchInfo();
      pinch = { d0: pi.d, zoom0: view.zoom, world: toWorld(pi.mid) };
      return;
    }
    if (pointers.size > 2) return;

    var wp = toWorld(sp);
    if (ev.button === 1 || ev.button === 2 || ui.tool === 'move') {
      drag = { type: 'pan', start: sp, last: sp, moved: true };
      updateCursor();
      return;
    }
    if (playing) {
      drag = { type: 'playpress', start: sp, last: sp, moved: false };
      return;
    }

    if (ui.tool === 'cursor') {
      var s = hitStop(wp);
      if (s) { drag = { type: 'stop', id: s.id, start: sp, last: sp, moved: false }; return; }
      var b = hitBend(wp);
      if (b) { drag = { type: 'bend', edge: b.edge, idx: b.idx, start: sp, last: sp, moved: false }; return; }
      drag = { type: 'empty', start: sp, last: sp, moved: false };
    } else if (ui.tool === 'point') {
      var b2 = hitBend(wp);
      if (b2) { drag = { type: 'bend', edge: b2.edge, idx: b2.idx, start: sp, last: sp, moved: false }; return; }
      var e = hitEdge(wp);
      if (e) { drag = { type: 'edgeclick', edge: e, start: sp, last: sp, moved: false }; return; }
      drag = { type: 'empty', start: sp, last: sp, moved: false, noCreate: true };
    } else if (ui.tool === 'eraser') {
      drag = { type: 'erase', start: sp, last: sp, did: false, moved: false };
      eraseAt(wp, drag);
    }
  });

  canvas.addEventListener('pointermove', function (ev) {
    var sp = screenPt(ev);
    ui.mouse = sp;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, sp);

    if (pinch && pointers.size >= 2) {
      var pi = pinchInfo();
      view.zoom = clamp(pinch.zoom0 * pi.d / pinch.d0, MIN_ZOOM, MAX_ZOOM);
      view.x = pinch.world.x - (pi.mid.x - view.w / 2) / view.zoom;
      view.y = pinch.world.y - (pi.mid.y - view.h / 2) / view.zoom;
      return;
    }
    if (!drag) { updateHover(sp); return; }

    var far = dist(sp, drag.start) > DRAG_THRESHOLD;
    switch (drag.type) {
      case 'pan':
        panBy(sp.x - drag.last.x, sp.y - drag.last.y);
        break;
      case 'empty':
      case 'edgeclick':
      case 'playpress':
        if (far || drag.moved) {
          drag.moved = true;
          panBy(sp.x - drag.last.x, sp.y - drag.last.y);
          updateCursor();
        }
        break;
      case 'stop':
        if (far && !drag.moved) { drag.moved = true; checkpoint(); updateCursor(); }
        if (drag.moved) {
          var g = snapGrid(toWorld(sp));
          var s = stopMap.get(drag.id);
          if (s && (g.x !== s.x || g.y !== s.y) && !stopAt(g.x, g.y, s.id)) {
            s.x = g.x; s.y = g.y;
            geom = null;
          }
        }
        break;
      case 'bend':
        if (far && !drag.moved) { drag.moved = true; checkpoint(); updateCursor(); }
        if (drag.moved) {
          var h = snapHalf(toWorld(sp));
          var cur = drag.edge.bends[drag.idx];
          if (cur && (h.x !== cur.x || h.y !== cur.y) && !stopAt(h.x, h.y)) {
            drag.edge.bends[drag.idx] = h;
            geom = null;
          }
        }
        break;
      case 'erase':
        eraseAt(toWorld(sp), drag);
        break;
    }
    drag.last = sp;
  });

  function endPointer(ev, cancelled) {
    pointers.delete(ev.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      return;
    }
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!cancelled) {
      switch (d.type) {
        case 'stop':
          if (d.moved) commit(); else clickStop(d.id);
          break;
        case 'bend':
          if (d.moved) commit();
          break;
        case 'empty':
          if (!d.moved) {
            if (d.noCreate) { /* outil Point : clic dans le vide */ }
            else clickEmpty(toWorld(d.start));
          }
          break;
        case 'edgeclick':
          if (!d.moved) showPopover(d.edge, d.start, toWorld(d.start));
          break;
        case 'playpress':
          if (!d.moved) pause('edit');
          break;
        case 'erase':
          if (d.did) commit();
          break;
      }
    } else if (d.did || d.moved && (d.type === 'stop' || d.type === 'bend')) {
      commit();
    }
    updateHover(ui.mouse);
  }

  canvas.addEventListener('pointerup', function (ev) { endPointer(ev, false); });
  canvas.addEventListener('pointercancel', function (ev) { endPointer(ev, true); });
  canvas.addEventListener('pointerleave', function () { if (!drag) { ui.mouse = null; ui.hover = null; } });
  canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    hidePopover();
    var k = ev.ctrlKey ? 0.01 : 0.0015;
    zoomAt(screenPt(ev), Math.exp(-ev.deltaY * k));
  }, { passive: false });

  canvas.addEventListener('dblclick', function (ev) {
    if (ui.tool !== 'cursor' || playing) return;
    var s = hitStop(toWorld(screenPt(ev)));
    if (s) { ui.selected = null; renameStop(s); }
  });

  // ---------- Boutons ----------
  document.querySelectorAll('.tool-btn').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool); });
  });
  $('#play-btn').addEventListener('click', togglePlay);
  $('#add-line').addEventListener('click', addLine);
  $('#undo-btn').addEventListener('click', undo);
  $('#redo-btn').addEventListener('click', redo);
  $('#fit-btn').addEventListener('click', fitView);
  $('#reset-btn').addEventListener('click', resetMap);
  $('#labels-btn').addEventListener('click', function () {
    ui.showLabels = !ui.showLabels;
    this.classList.toggle('active', ui.showLabels);
  });
  function toggleRules() { ui.rulesOpen = !ui.rulesOpen; renderRules(); }
  $('#rules-btn').addEventListener('click', toggleRules);
  $('#rules-head').addEventListener('click', toggleRules);
  $('#home-btn').addEventListener('click', function () { pause(); saveNow(); });

  // ---------- Clavier ----------
  window.addEventListener('keydown', function (ev) {
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    var k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); redo(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === ' ') { ev.preventDefault(); togglePlay(); return; }
    if (k === 'escape') { ui.selected = null; hidePopover(); closeColorPicker(); updateHint(); return; }
    if (k === 'v' || k === 'c') setTool('cursor');
    else if (k === 'p') setTool('point');
    else if (k === 'm' || k === 'h') setTool('move');
    else if (k === 'e' || k === 'g') setTool('eraser');
    else if ((k === 'delete' || k === 'backspace') && ui.selected && !playing) {
      checkpoint();
      deleteStop(ui.selected);
      commit();
    } else if (/^[1-9]$/.test(k) && state.lines[+k - 1]) {
      ui.activeLine = state.lines[+k - 1].id;
      renderLineBar();
      updateHint();
    } else if (k === '+' || k === '=') zoomAt({ x: view.w / 2, y: view.h / 2 }, 1.2);
    else if (k === '-') zoomAt({ x: view.w / 2, y: view.h / 2 }, 1 / 1.2);
  });

  // ---------- Pause automatique quand on quitte la page ----------
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pause('auto'); saveNow(); }
  });
  window.addEventListener('blur', function () { pause('auto'); });
  window.addEventListener('pagehide', function () { pause(); saveNow(); });
  window.addEventListener('beforeunload', function () { pause(); saveNow(); });
  window.addEventListener('resize', function () { resize(); });

  // ---------- Export / import (code texte ou lien) ----------
  var sheet = $('#share-sheet');
  var importMsg = $('#import-msg');
  var exportSeq = 0;

  function showTab(tab) {
    document.querySelectorAll('.sheet-tab').forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.sheet-panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
    $('#sheet-title').textContent = tab === 'export' ? 'Partager le réseau' : 'Importer un réseau';
  }
  function openSheet(tab) {
    showTab(tab);
    sheet.hidden = false;
    if (tab === 'export') {
      prepareExport();
    } else {
      importMsg.textContent = '';
      $('#import-input').focus();
    }
  }
  function closeSheet() { sheet.hidden = true; }

  function prepareExport() {
    var seq = ++exportSeq;
    $('#export-link').value = 'Génération du lien…';
    $('#export-code').value = '';
    MetroShare.encode(state, cityId).then(function (code) {
      if (seq !== exportSeq) return;
      $('#export-link').value = location.origin + location.pathname + '#m=' + code;
      $('#export-code').value = code;
    }).catch(function () { toast('Export impossible.', true); });
  }

  function copyText(text, msg) {
    if (!text) return;
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(msg); }
      catch (e) { toast('Copie impossible : sélectionnez le texte à la main.', true); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(msg); }, fallback);
    } else {
      fallback();
    }
  }

  // Applique un réseau importé. Si c'est une autre ville, on l'enregistre puis on ouvre cette ville.
  function applyImport(result) {
    if (result.cityId !== cityId) {
      safeSet(MetroCities.SAVE_PREFIX + result.cityId, JSON.stringify(result.state));
      location.href = 'game.html?city=' + encodeURIComponent(result.cityId);
      return;
    }
    if (playing) pause('edit');
    checkpoint();
    state = result.state;
    ui.selected = null;
    ui.activeLine = state.lines[0] && state.lines[0].id;
    sim = null;
    hidePopover();
    commit();
    fitView();
    toast('Réseau importé ✓');
  }

  $('#export-btn').addEventListener('click', function () { openSheet('export'); });
  $('#import-btn').addEventListener('click', function () { openSheet('import'); });
  $('#sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (ev) { if (ev.target === sheet) closeSheet(); });
  document.querySelectorAll('.sheet-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      showTab(b.dataset.tab);
      if (b.dataset.tab === 'export') prepareExport();
    });
  });
  ['#export-link', '#export-code'].forEach(function (sel) {
    $(sel).addEventListener('focus', function (ev) { ev.target.select(); });
  });
  $('#copy-link').addEventListener('click', function () { copyText($('#export-link').value, 'Lien copié !'); });
  $('#copy-code').addEventListener('click', function () { copyText($('#export-code').value, 'Code copié !'); });
  $('#import-go').addEventListener('click', function () {
    importMsg.className = 'sheet-msg';
    importMsg.textContent = 'Lecture du réseau…';
    MetroShare.decode($('#import-input').value, MetroCities).then(function (result) {
      if (result.cityId === cityId && state.stops.length &&
          !confirm('Remplacer le réseau actuel par celui importé ? (Ctrl+Z pour annuler)')) {
        importMsg.textContent = '';
        return;
      }
      closeSheet();
      applyImport(result);
    }).catch(function (err) {
      importMsg.className = 'sheet-msg';
      importMsg.textContent = err && err.message ? err.message : 'Import impossible.';
    });
  });
  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  // ---------- Démarrage ----------
  $('#city-name').textContent = city.name;
  document.title = city.name + ' — Metro Builder';
  resize();
  commit();
  fitView();
  requestAnimationFrame(frame);

  // Lien reçu (#m=…) : on l'ouvre directement, puis on retire le fragment pour ne pas réimporter au rechargement
  (function openSharedLink() {
    var m = /[#&]m=([^&]+)/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    MetroShare.decode(decodeURIComponent(m[1]), MetroCities).then(applyImport).catch(function (err) {
      toast('Lien invalide : ' + (err && err.message ? err.message : 'import impossible.'), true);
    });
  })();

  // Accès pour le débogage depuis la console
  window.MetroGame = {
    get state() { return state; },
    get validation() { return validation; },
    get playing() { return playing; },
    get sim() { return sim; },
    toScreen: function (gx, gy) { return toScreen({ x: gx * GRID, y: gy * GRID }); },
    play: play,
    pause: pause
  };
})();
