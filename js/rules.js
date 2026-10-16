/* ==========================================================================
   Metro Builder — règles du réseau
   La lecture (simulation) n'est possible que si toutes les règles sont respectées.
   Règles inspirées des grands réseaux réels (Paris, Londres, New York, Tokyo…) :
     1. Au moins 3 arrêts.
     2. Aucun arrêt en double (deux arrêts sur la même intersection).
     3. Tous les arrêts sont reliés : aucun arrêt isolé.
     4. Un seul réseau : on peut aller de n'importe quel arrêt à n'importe quel autre
        en changeant de ligne aux correspondances (parcours de graphe).
     5. Chaque ligne est d'un seul tenant (pas deux morceaux de la même ligne).
     6. Pas d'embranchement : une ligne est un trajet simple ou une boucle
        (au plus 2 liaisons d'une même ligne par arrêt).
     7. Au moins une boucle dans le réseau : une ligne fermée sur elle-même, ou un
        cycle formé par plusieurs lignes via leurs correspondances.
     8. Chaque ligne non bouclée a au moins une correspondance avec une autre ligne,
        pour que ses voyageurs puissent rejoindre les boucles du réseau.
     9. Aucune liaison ne traverse un arrêt sans le desservir (plan lisible).
   ========================================================================== */
(function (global) {
  'use strict';

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function q(name) { return '« ' + name + ' »'; }
  function listNames(names, max) {
    max = max || 2;
    var shown = names.slice(0, max).map(q).join(', ');
    return names.length > max ? shown + '…' : shown;
  }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  function components(nodes, neighbors) {
    var seen = new Set();
    var groups = [];
    nodes.forEach(function (start) {
      if (seen.has(start)) return;
      var group = [start];
      var stack = [start];
      seen.add(start);
      while (stack.length) {
        var cur = stack.pop();
        neighbors(cur).forEach(function (m) {
          if (!seen.has(m)) { seen.add(m); group.push(m); stack.push(m); }
        });
      }
      groups.push(group);
    });
    return groups;
  }

  function distToSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
  }

  // Analyse du graphe : arrêts = sommets, liaisons = arêtes (étiquetées par ligne)
  function analyze(state) {
    var stops = new Map(state.stops.map(function (s) { return [s.id, s]; }));
    var adj = new Map(state.stops.map(function (s) { return [s.id, new Set()]; }));
    var stopLines = new Map(state.stops.map(function (s) { return [s.id, new Set()]; }));
    var pairs = new Set();
    var lines = new Map();

    state.lines.forEach(function (l) {
      lines.set(l.id, { line: l, edges: [], nodes: new Set(), deg: new Map(), adj: new Map(),
        used: false, loop: false, components: 0, branchAt: null });
    });

    state.edges.forEach(function (e) {
      if (!stops.has(e.a) || !stops.has(e.b) || e.a === e.b || !lines.has(e.line)) return;
      adj.get(e.a).add(e.b);
      adj.get(e.b).add(e.a);
      pairs.add(pairKey(e.a, e.b));
      stopLines.get(e.a).add(e.line);
      stopLines.get(e.b).add(e.line);
      var L = lines.get(e.line);
      L.edges.push(e);
      [[e.a, e.b], [e.b, e.a]].forEach(function (p) {
        L.nodes.add(p[0]);
        L.deg.set(p[0], (L.deg.get(p[0]) || 0) + 1);
        if (!L.adj.has(p[0])) L.adj.set(p[0], new Set());
        L.adj.get(p[0]).add(p[1]);
      });
    });

    lines.forEach(function (L) {
      L.used = L.edges.length > 0;
      if (!L.used) return;
      L.components = components(Array.from(L.nodes), function (n) { return Array.from(L.adj.get(n)); }).length;
      L.deg.forEach(function (d, n) { if (d > 2 && !L.branchAt) L.branchAt = n; });
      var allTwo = true;
      L.deg.forEach(function (d) { if (d !== 2) allTwo = false; });
      L.loop = L.components === 1 && L.nodes.size >= 3 && allTwo;
    });

    var served = state.stops.filter(function (s) { return adj.get(s.id).size > 0; }).map(function (s) { return s.id; });
    var groups = components(served, function (n) { return Array.from(adj.get(n)); });
    // Nombre cyclomatique : nombre de boucles indépendantes du réseau
    var cycles = pairs.size - served.length + groups.length;

    return { stops: stops, adj: adj, stopLines: stopLines, lines: lines, served: served, groups: groups, cycles: cycles };
  }

  function validate(state) {
    var A = analyze(state);
    var results = [];
    var usedLines = [];
    A.lines.forEach(function (L) { if (L.used) usedLines.push(L); });
    function name(id) { var s = A.stops.get(id); return s ? s.name : '?'; }
    function add(id, title, ok, message) { results.push({ id: id, title: title, ok: ok, message: ok ? '' : message }); }

    // 1. Au moins 3 arrêts
    add('min-stops', 'Au moins 3 arrêts', state.stops.length >= 3,
      'Placez au moins 3 arrêts (actuellement ' + state.stops.length + ').');

    // 2. Pas d'arrêt en double
    var seenPos = {};
    var dup = null;
    state.stops.forEach(function (s) {
      var k = s.x + ',' + s.y;
      if (seenPos[k] && !dup) dup = [seenPos[k], s];
      seenPos[k] = s;
    });
    add('no-duplicate', 'Aucun arrêt en double', !dup,
      dup ? q(dup[0].name) + ' et ' + q(dup[1].name) + ' occupent la même intersection.' : '');

    // 3. Tous les arrêts reliés
    var isolated = state.stops.filter(function (s) { return A.adj.get(s.id).size === 0; }).map(function (s) { return s.name; });
    add('all-served', 'Tous les arrêts sont reliés', isolated.length === 0,
      isolated.length === 1
        ? q(isolated[0]) + ' n’est relié à aucune ligne. Reliez-le ou effacez-le.'
        : plural(isolated.length, 'arrêt', 'arrêts') + ' ne sont reliés à aucune ligne (' + listNames(isolated) + ').');

    // 4. Réseau connexe (parcours de graphe)
    add('connected', 'Un seul réseau connecté', A.groups.length <= 1,
      'Le réseau est coupé en ' + A.groups.length + ' morceaux : reliez-les par une ligne ou une correspondance pour que tout soit accessible.');

    // 5. Lignes d'un seul tenant
    var broken = usedLines.filter(function (L) { return L.components > 1; });
    add('line-continuous', 'Chaque ligne est continue', broken.length === 0,
      broken.length ? 'La ligne ' + broken[0].line.label + ' est coupée en ' + broken[0].components +
        ' morceaux : une ligne doit être d’un seul tenant.' : '');

    // 6. Pas d'embranchement
    var branched = usedLines.filter(function (L) { return L.branchAt; });
    add('no-branch', 'Pas d’embranchement', branched.length === 0,
      branched.length ? 'La ligne ' + branched[0].line.label + ' se divise à ' + q(name(branched[0].branchAt)) +
        ' : une ligne doit être un trajet simple ou une boucle.' : '');

    // 7. Au moins une boucle
    add('loop', 'Au moins une boucle', A.cycles > 0,
      'Fermez une ligne sur elle-même, ou formez une boucle avec plusieurs lignes qui se croisent en correspondance.');

    // 8. Correspondances des lignes non bouclées
    var lonely = usedLines.filter(function (L) {
      if (L.loop) return false;
      var hasTransfer = false;
      L.nodes.forEach(function (n) { if (A.stopLines.get(n).size > 1) hasTransfer = true; });
      return !hasTransfer;
    });
    add('interchange', 'Correspondances des lignes ouvertes', lonely.length === 0,
      lonely.length ? 'La ligne ' + lonely[0].line.label + ' n’est pas bouclée et n’a aucune correspondance : ' +
        'faites-la croiser une autre ligne sur un arrêt commun.' : '');

    // 9. Aucune liaison ne traverse un arrêt
    var crossing = null;
    for (var i = 0; i < state.edges.length && !crossing; i++) {
      var e = state.edges[i];
      var a = A.stops.get(e.a), b = A.stops.get(e.b);
      if (!a || !b) continue;
      var pts = [a].concat(e.bends || [], [b]);
      for (var j = 0; j < state.stops.length && !crossing; j++) {
        var s = state.stops[j];
        if (s.id === e.a || s.id === e.b) continue;
        for (var k = 0; k < pts.length - 1; k++) {
          if (distToSegment(s, pts[k], pts[k + 1]) < 0.2) { crossing = { e: e, s: s, a: a, b: b }; break; }
        }
      }
    }
    add('no-overpass', 'Aucune liaison ne traverse un arrêt', !crossing,
      crossing ? 'La liaison ' + q(crossing.a.name) + ' – ' + q(crossing.b.name) + ' passe sur ' + q(crossing.s.name) +
        ' sans le desservir : faites-la passer par cet arrêt ou contournez-le avec un point de pli.' : '');

    var lineInfo = new Map();
    A.lines.forEach(function (L, id) {
      lineInfo.set(id, { used: L.used, loop: L.loop, stops: L.nodes.size, edges: L.edges.length });
    });
    var stopLines = new Map();
    A.stopLines.forEach(function (set, id) { stopLines.set(id, set.size); });
    var interchanges = 0;
    stopLines.forEach(function (n) { if (n > 1) interchanges++; });

    var failed = results.filter(function (r) { return !r.ok; });
    return {
      ok: failed.length === 0,
      results: results,
      firstError: failed[0] || null,
      lines: lineInfo,
      stopLines: stopLines,
      stats: {
        stops: state.stops.length,
        lines: usedLines.length,
        interchanges: interchanges,
        loops: Math.max(0, A.cycles)
      }
    };
  }

  global.MetroRules = { validate: validate, analyze: analyze };
})(typeof window !== 'undefined' ? window : globalThis);
