/* ==========================================================================
   Metro Builder — villes, palettes et dispositions de départ
   Coordonnées en unités de grille (x vers la droite, y vers le bas).
   ========================================================================== */
(function (global) {
  'use strict';

  var SAVE_PREFIX = 'metroBuilder.save.v1.';

  var PALETTES = {
    base: {
      name: 'Classique',
      colors: [
        { key: 'blue', name: 'Bleu', hex: '#21DAFF' },
        { key: 'green', name: 'Vert', hex: '#74EC8D' },
        { key: 'yellow', name: 'Jaune', hex: '#F8DE65' },
        { key: 'orange', name: 'Orange', hex: '#EBB016' },
        { key: 'redorange', name: 'Rouge-orangé', hex: '#FF5C1A' },
        { key: 'red', name: 'Rouge', hex: '#FE4B4B' }
      ]
    }
  };

  // stops : [clé, x, y, nom]
  // lines : { label, color (clé de palette), stops: [clés…], loop?, style? }
  var CITIES = [
    {
      id: 'vierge',
      name: 'Vierge',
      description: 'Une seule ligne en boucle pour démarrer. Tout le reste est à imaginer.',
      palette: 'base',
      stops: [
        ['n', 0, -4, 'Station 1'],
        ['ne', 3, -3, 'Station 2'],
        ['e', 4, 0, 'Station 3'],
        ['se', 3, 3, 'Station 4'],
        ['s', 0, 4, 'Station 5'],
        ['so', -3, 3, 'Station 6'],
        ['o', -4, 0, 'Station 7'],
        ['no', -3, -3, 'Station 8']
      ],
      lines: [
        { label: '1', color: 'blue', loop: true, style: 'curve', stops: ['n', 'ne', 'e', 'se', 's', 'so', 'o', 'no'] }
      ]
    },
    {
      id: 'paris',
      name: 'Paris',
      description: 'Les lignes 2 et 6 forment l’anneau autour du centre, traversé par les lignes 1, 4, 13 et 14.',
      palette: 'base',
      stops: [
        ['etoile', -6, 0, 'Étoile'],
        ['villiers', -4, -3, 'Villiers'],
        ['pigalle', -1, -4, 'Pigalle'],
        ['barbes', 2, -4, 'Barbès–Rochechouart'],
        ['stalingrad', 4, -3, 'Stalingrad'],
        ['belleville', 6, -1, 'Belleville'],
        ['nation', 6, 2, 'Nation'],
        ['trocadero', -5, 3, 'Trocadéro'],
        ['montparnasse', -2, 4, 'Montparnasse'],
        ['italie', 1, 5, 'Place d’Italie'],
        ['bercy', 4, 3, 'Bercy'],
        ['ladefense', -10, 0, 'La Défense'],
        ['champs', -3, 0, 'Champs-Élysées'],
        ['chatelet', 0, 0, 'Châtelet'],
        ['bastille', 3, 1, 'Bastille'],
        ['vincennes', 9, 2, 'Château de Vincennes'],
        ['clignancourt', 2, -7, 'Porte de Clignancourt'],
        ['garedunord', 2, -2, 'Gare du Nord'],
        ['stmichel', -1, 2, 'Saint-Michel'],
        ['montrouge', -2, 7, 'Montrouge'],
        ['stlazare', -3, -2, 'Saint-Lazare'],
        ['madeleine', -2, -1, 'Madeleine'],
        ['garedelyon', 3, 2, 'Gare de Lyon'],
        ['bibliotheque', 3, 6, 'Bibliothèque F. Mitterrand'],
        ['stdenis', -3, -7, 'Saint-Denis'],
        ['invalides', -4, 2, 'Invalides'],
        ['chatillon', -4, 7, 'Châtillon']
      ],
      lines: [
        { label: '1', color: 'yellow', stops: ['ladefense', 'etoile', 'champs', 'chatelet', 'bastille', 'nation', 'vincennes'] },
        { label: '2', color: 'blue', stops: ['etoile', 'villiers', 'pigalle', 'barbes', 'stalingrad', 'belleville', 'nation'] },
        { label: '4', color: 'orange', stops: ['clignancourt', 'barbes', 'garedunord', 'chatelet', 'stmichel', 'montparnasse', 'montrouge'] },
        { label: '6', color: 'green', stops: ['etoile', 'trocadero', 'montparnasse', 'italie', 'bercy', 'nation'] },
        { label: '13', color: 'redorange', stops: ['stdenis', 'stlazare', 'champs', 'invalides', 'montparnasse', 'chatillon'] },
        { label: '14', color: 'red', stops: ['stlazare', 'madeleine', 'chatelet', 'garedelyon', 'bercy', 'bibliotheque'] }
      ]
    },
    {
      id: 'londres',
      name: 'Londres',
      description: 'La Circle line boucle autour du centre ; Central, Victoria, Northern et Jubilee s’y raccordent.',
      palette: 'base',
      stops: [
        ['paddington', -7, -1, 'Paddington'],
        ['baker', -4, -3, 'Baker Street'],
        ['kingscross', 0, -3, 'King’s Cross St Pancras'],
        ['moorgate', 3, -3, 'Moorgate'],
        ['liverpool', 5, -2, 'Liverpool Street'],
        ['towerhill', 6, 1, 'Tower Hill'],
        ['monument', 3, 2, 'Monument'],
        ['embankment', 0, 3, 'Embankment'],
        ['westminster', -2, 3, 'Westminster'],
        ['victoria', -4, 3, 'Victoria'],
        ['southken', -6, 2, 'South Kensington'],
        ['nottinghill', -8, 1, 'Notting Hill Gate'],
        ['ealing', -12, 1, 'Ealing Broadway'],
        ['oxford', -2, -1, 'Oxford Circus'],
        ['tcr', 0, -1, 'Tottenham Court Road'],
        ['bank', 3, 0, 'Bank'],
        ['stratford', 9, -3, 'Stratford'],
        ['brixton', -3, 7, 'Brixton'],
        ['greenpark', -3, 1, 'Green Park'],
        ['highbury', 1, -6, 'Highbury & Islington'],
        ['walthamstow', 3, -9, 'Walthamstow Central'],
        ['camden', -2, -6, 'Camden Town'],
        ['londonbridge', 5, 4, 'London Bridge'],
        ['kennington', 2, 7, 'Kennington'],
        ['morden', 1, 10, 'Morden'],
        ['stanmore', -6, -8, 'Stanmore'],
        ['waterloo', 0, 5, 'Waterloo'],
        ['canary', 8, 5, 'Canary Wharf']
      ],
      lines: [
        { label: 'Ci', color: 'yellow', loop: true, stops: ['paddington', 'baker', 'kingscross', 'moorgate', 'liverpool', 'towerhill', 'monument', 'embankment', 'westminster', 'victoria', 'southken', 'nottinghill'] },
        { label: 'Ce', color: 'red', stops: ['ealing', 'nottinghill', 'oxford', 'tcr', 'bank', 'liverpool', 'stratford'] },
        { label: 'Vi', color: 'blue', stops: ['brixton', 'victoria', 'greenpark', 'oxford', 'kingscross', 'highbury', 'walthamstow'] },
        { label: 'No', color: 'green', stops: ['camden', 'kingscross', 'moorgate', 'bank', 'londonbridge', 'kennington', 'morden'] },
        { label: 'Ju', color: 'orange', stops: ['stanmore', 'baker', 'greenpark', 'westminster', 'waterloo', 'londonbridge', 'canary', 'stratford'] }
      ]
    },
    {
      id: 'new-york',
      name: 'New York',
      description: 'Manhattan du nord au sud, reliée au Queens et à Brooklyn par les lignes 7, L et N.',
      palette: 'base',
      stops: [
        ['s125w', -3, -9, '125 St'],
        ['s96', -3, -6, '96 St'],
        ['s72', -3, -3, '72 St'],
        ['times', -2, 0, 'Times Sq–42 St'],
        ['penn', -2, 2, 'Penn Station'],
        ['s14', -2, 5, '14 St'],
        ['chambers', -2, 9, 'Chambers St'],
        ['southferry', -1, 12, 'South Ferry'],
        ['s125e', 2, -9, '125 St East'],
        ['s86', 2, -5, '86 St'],
        ['lex59', 2, -2, 'Lexington Av'],
        ['gc', 2, 0, 'Grand Central–42 St'],
        ['union', 1, 5, 'Union Sq–14 St'],
        ['bkbridge', 0, 9, 'Brooklyn Bridge'],
        ['bowling', 0, 11, 'Bowling Green'],
        ['hudson', -5, 2, 'Hudson Yards'],
        ['qboro', 6, -2, 'Queensboro'],
        ['flushing', 10, -2, 'Flushing'],
        ['av8', -5, 5, '8 Av'],
        ['bedford', 5, 6, 'Bedford Av'],
        ['canarsie', 9, 8, 'Canarsie'],
        ['astoria', 6, -6, 'Astoria–Ditmars'],
        ['herald', 0, 2, 'Herald Sq'],
        ['canal', 2, 8, 'Canal St'],
        ['atlantic', 4, 11, 'Atlantic Av'],
        ['coney', 4, 15, 'Coney Island']
      ],
      lines: [
        { label: '1', color: 'red', stops: ['s125w', 's96', 's72', 'times', 'penn', 's14', 'chambers', 'southferry'] },
        { label: '4', color: 'green', stops: ['s125e', 's86', 'lex59', 'gc', 'union', 'bkbridge', 'bowling'] },
        { label: '7', color: 'redorange', stops: ['hudson', 'times', 'gc', 'qboro', 'flushing'] },
        { label: 'L', color: 'blue', stops: ['av8', 's14', 'union', 'bedford', 'canarsie'] },
        { label: 'N', color: 'yellow', stops: ['astoria', 'qboro', 'lex59', 'times', 'herald', 'union', 'canal', 'atlantic', 'coney'] }
      ]
    }
  ];

  var MIN_LINES = 6;

  function get(id) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    return null;
  }

  function palette(city) {
    return PALETTES[(city && city.palette) || 'base'] || PALETTES.base;
  }

  function colorHex(pal, key) {
    for (var i = 0; i < pal.colors.length; i++) if (pal.colors[i].key === key) return pal.colors[i].hex;
    return key;
  }

  // Construit l'état initial de l'éditeur à partir de la disposition de départ d'une ville
  function buildInitialState(id) {
    var city = get(id) || CITIES[0];
    var pal = palette(city);
    var n = 0;
    var keyToId = {};
    var stops = city.stops.map(function (s) {
      var sid = 's' + (++n);
      keyToId[s[0]] = sid;
      return { id: sid, x: s[1], y: s[2], name: s[3] };
    });
    var lines = [];
    var edges = [];
    city.lines.forEach(function (l) {
      var lid = 'l' + (++n);
      lines.push({ id: lid, label: l.label, color: colorHex(pal, l.color) });
      var seq = l.stops.map(function (k) { return keyToId[k]; });
      if (l.loop) seq = seq.concat([seq[0]]);
      for (var i = 0; i < seq.length - 1; i++) {
        edges.push({ id: 'e' + (++n), line: lid, a: seq[i], b: seq[i + 1], style: l.style || 'straight', bends: [], side: 1 });
      }
    });
    // Compléter la barre de lignes avec les couleurs restantes de la palette
    var usedColors = lines.map(function (l) { return l.color; });
    var usedLabels = lines.map(function (l) { return l.label; });
    var free = pal.colors.filter(function (c) { return usedColors.indexOf(c.hex) < 0; });
    var num = 1;
    while (lines.length < MIN_LINES) {
      while (usedLabels.indexOf(String(num)) >= 0) num++;
      var color = free.length ? free.shift().hex : pal.colors[lines.length % pal.colors.length].hex;
      lines.push({ id: 'l' + (++n), label: String(num), color: color });
      usedLabels.push(String(num));
    }
    return { version: 1, city: city.id, stops: stops, lines: lines, edges: edges, nextId: n + 1 };
  }

  function hasSave(id) {
    try { return !!localStorage.getItem(SAVE_PREFIX + id); } catch (e) { return false; }
  }

  function clearSave(id) {
    try { localStorage.removeItem(SAVE_PREFIX + id); } catch (e) { /* stockage indisponible */ }
  }

  global.MetroCities = {
    SAVE_PREFIX: SAVE_PREFIX,
    PALETTES: PALETTES,
    list: function () { return CITIES.slice(); },
    get: get,
    palette: palette,
    colorHex: colorHex,
    buildInitialState: buildInitialState,
    hasSave: hasSave,
    clearSave: clearSave
  };
})(typeof window !== 'undefined' ? window : globalThis);
