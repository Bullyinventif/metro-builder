/* ==========================================================================
   Metro Builder — export / import d'un réseau (code texte ou lien)
   Format : préfixe de version + données encodées en base64url.
     « MBZ1. » = JSON compressé (deflate-raw), « MB1. » = JSON brut.
   Toutes les données importées sont vérifiées avant d'être utilisées.
   ========================================================================== */
(function (global) {
  'use strict';

  var PREFIX_ZIP = 'MBZ1.';
  var PREFIX_RAW = 'MB1.';
  var LIMITS = { stops: 400, lines: 18, edges: 1500, bends: 40, name: 60, label: 8, coord: 500 };
  var STYLES = ['straight', 'curve', 'zigzag'];
  var ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;

  // ---------- Base64url ----------
  function bytesToB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------- Compression (facultative, selon le navigateur) ----------
  function streamBytes(bytes, transform) {
    var src = new Blob([bytes]).stream().pipeThrough(transform);
    return new Response(src).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  // ---------- Conversion carte <-> format compact ----------
  // Format compact : { v, c, s:[[id,x,y,nom]], l:[[id,étiquette,couleur]], e:[[id,ligne,a,b,style,côté,plis]], n }
  function toCompact(state, cityId) {
    return {
      v: 1,
      c: cityId,
      s: state.stops.map(function (s) { return s.color ? [s.id, s.x, s.y, s.name, s.color] : [s.id, s.x, s.y, s.name]; }),
      l: state.lines.map(function (l) { return [l.id, l.label, l.color]; }),
      e: state.edges.map(function (e) {
        return [e.id, e.line, e.a, e.b, e.style || 'straight', e.side || 1,
          (e.bends || []).map(function (b) { return [b.x, b.y]; })];
      }),
      n: state.nextId || 1000
    };
  }

  function clean(str, max) {
    return String(str == null ? '' : str).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max).trim();
  }
  function num(v, max) {
    var n = Number(v);
    if (!isFinite(n) || Math.abs(n) > max) throw new Error('Coordonnée invalide');
    return Math.round(n * 2) / 2; // précision demi-case
  }
  function arr(v, max, what) {
    if (!Array.isArray(v) || v.length > max) throw new Error('Trop d’éléments ou format invalide (' + what + ')');
    return v;
  }

  // Vérifie et reconstruit un état de carte. Lève une erreur lisible si quelque chose cloche.
  function fromCompact(c, MetroCities) {
    if (!c || c.v !== 1) throw new Error('Version du format non reconnue');
    var city = MetroCities.get(c.c);
    if (!city) throw new Error('Ville inconnue : ' + clean(c.c, 30));

    var stops = arr(c.s, LIMITS.stops, 'arrêts').map(function (row) {
      if (!Array.isArray(row) || row.length < 4) throw new Error('Arrêt invalide');
      if (!ID_RE.test(String(row[0]))) throw new Error('Identifiant d’arrêt invalide');
      var stop = { id: String(row[0]), x: num(row[1], LIMITS.coord), y: num(row[2], LIMITS.coord),
        name: clean(row[3], LIMITS.name) || 'Station' };
      if (row[4] !== undefined) {
        if (!HEX_RE.test(String(row[4]))) throw new Error('Couleur d’arrêt invalide');
        stop.color = String(row[4]);
      }
      return stop;
    });
    var lines = arr(c.l, LIMITS.lines, 'lignes').map(function (row) {
      if (!Array.isArray(row) || row.length < 3) throw new Error('Ligne invalide');
      if (!ID_RE.test(String(row[0]))) throw new Error('Identifiant de ligne invalide');
      if (!HEX_RE.test(String(row[2]))) throw new Error('Couleur de ligne invalide');
      return { id: String(row[0]), label: clean(row[1], LIMITS.label) || '?', color: String(row[2]) };
    });
    if (!lines.length) throw new Error('Aucune ligne dans ce réseau');

    var stopIds = {}, lineIds = {};
    stops.forEach(function (s) {
      if (stopIds[s.id]) throw new Error('Arrêt en double');
      stopIds[s.id] = true;
    });
    lines.forEach(function (l) {
      if (lineIds[l.id]) throw new Error('Ligne en double');
      lineIds[l.id] = true;
    });

    var edges = arr(c.e || [], LIMITS.edges, 'liaisons').map(function (row) {
      if (!Array.isArray(row) || row.length < 6) throw new Error('Liaison invalide');
      var e = {
        id: String(row[0]), line: String(row[1]), a: String(row[2]), b: String(row[3]),
        style: STYLES.indexOf(row[4]) >= 0 ? row[4] : 'straight',
        side: Number(row[5]) < 0 ? -1 : 1,
        bends: []
      };
      if (!ID_RE.test(e.id)) throw new Error('Identifiant de liaison invalide');
      if (!lineIds[e.line]) throw new Error('Liaison sur une ligne inconnue');
      if (!stopIds[e.a] || !stopIds[e.b] || e.a === e.b) throw new Error('Liaison entre arrêts inconnus');
      e.bends = arr(row[6] || [], LIMITS.bends, 'plis').map(function (b) {
        if (!Array.isArray(b) || b.length < 2) throw new Error('Pli invalide');
        return { x: num(b[0], LIMITS.coord), y: num(b[1], LIMITS.coord) };
      });
      return e;
    });

    // Un identifiant libre pour les prochains ajouts (évite les collisions)
    var next = Math.max(1000, Number(c.n) || 0);
    [stops, lines, edges].forEach(function (list) {
      list.forEach(function (o) {
        var m = /(\d+)$/.exec(o.id);
        if (m) next = Math.max(next, +m[1] + 1);
      });
    });

    return { cityId: city.id, state: { version: 1, city: city.id, stops: stops, lines: lines, edges: edges, nextId: next } };
  }

  // ---------- Encodage / décodage ----------
  function encode(state, cityId) {
    var json = JSON.stringify(toCompact(state, cityId));
    var raw = new TextEncoder().encode(json);
    if (typeof CompressionStream === 'undefined') {
      return Promise.resolve(PREFIX_RAW + bytesToB64url(raw));
    }
    return streamBytes(raw, new CompressionStream('deflate-raw'))
      .then(function (zipped) { return PREFIX_ZIP + bytesToB64url(zipped); })
      .catch(function () { return PREFIX_RAW + bytesToB64url(raw); });
  }

  // Accepte un code brut, un lien complet, ou un fragment « #m=… »
  function extractCode(input) {
    var text = String(input || '').trim();
    var m = /[#?&]m=([^&\s]+)/.exec(text);
    if (m) text = decodeURIComponent(m[1]);
    text = text.replace(/\s+/g, '');
    if (text.indexOf(PREFIX_ZIP) !== 0 && text.indexOf(PREFIX_RAW) !== 0) {
      throw new Error('Ce texte ne ressemble pas à un réseau Metro Builder.');
    }
    return text;
  }

  function decode(input, MetroCities) {
    var code;
    try { code = extractCode(input); } catch (err) { return Promise.reject(err); }
    var zipped = code.indexOf(PREFIX_ZIP) === 0;
    var body = code.slice(zipped ? PREFIX_ZIP.length : PREFIX_RAW.length);
    var bytes;
    try { bytes = b64urlToBytes(body); } catch (e) { return Promise.reject(new Error('Code illisible (caractères invalides).')); }

    var pending = zipped
      ? (typeof DecompressionStream === 'undefined'
          ? Promise.reject(new Error('Ce navigateur ne peut pas lire ce code compressé.'))
          : streamBytes(bytes, new DecompressionStream('deflate-raw')))
      : Promise.resolve(bytes);

    return pending.then(function (raw) {
      var compact;
      try { compact = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { throw new Error('Code illisible (données corrompues).'); }
      return fromCompact(compact, MetroCities);
    });
  }

  global.MetroShare = { encode: encode, decode: decode, extractCode: extractCode };
})(typeof window !== 'undefined' ? window : globalThis);
