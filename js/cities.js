/* ==========================================================================
   Metro Builder — villes, palettes et dispositions de départ
   Coordonnées en unités de grille (x vers la droite, y vers le bas).
   ========================================================================== */
(function (global) {
  'use strict';

  var SAVE_PREFIX = 'metroBuilder.save.v1.';

  // Palette étendue : les 6 premières couleurs sont la palette d'origine (couleurs par défaut des lignes).
  // Les autres sont regroupées par famille pour le sélecteur de couleur de l'éditeur.
  var FAMILIES = [
    { key: 'bleus', name: 'Bleus' },
    { key: 'verts', name: 'Verts' },
    { key: 'jaunes', name: 'Jaunes et oranges' },
    { key: 'rouges', name: 'Rouges' },
    { key: 'roses', name: 'Roses' },
    { key: 'violets', name: 'Violets' },
    { key: 'marrons', name: 'Marrons' },
    { key: 'gris', name: 'Gris' }
  ];

  var PALETTES = {
    base: {
      name: 'Classique',
      families: FAMILIES,
      colors: [
        { key: 'blue', name: 'Bleu', hex: '#21DAFF', family: 'bleus' },
        { key: 'green', name: 'Vert', hex: '#74EC8D', family: 'verts' },
        { key: 'yellow', name: 'Jaune', hex: '#F8DE65', family: 'jaunes' },
        { key: 'orange', name: 'Orange', hex: '#EBB016', family: 'jaunes' },
        { key: 'redorange', name: 'Rouge-orangé', hex: '#FF5C1A', family: 'rouges' },
        { key: 'red', name: 'Rouge', hex: '#FE4B4B', family: 'rouges' },
        { key: 'sky', name: 'Bleu ciel', hex: '#7CC8FF', family: 'bleus' },
        { key: 'royal', name: 'Bleu roi', hex: '#3D7BFF', family: 'bleus' },
        { key: 'navy', name: 'Bleu marine', hex: '#2F4A9E', family: 'bleus' },
        { key: 'teal', name: 'Turquoise', hex: '#2EC4B6', family: 'bleus' },
        { key: 'mint', name: 'Menthe', hex: '#A6F0C6', family: 'verts' },
        { key: 'lime', name: 'Vert citron', hex: '#B5E44C', family: 'verts' },
        { key: 'emerald', name: 'Émeraude', hex: '#22B573', family: 'verts' },
        { key: 'forest', name: 'Vert sapin', hex: '#2E7D4F', family: 'verts' },
        { key: 'olive', name: 'Olive', hex: '#9AA84A', family: 'verts' },
        { key: 'lemon', name: 'Citron', hex: '#FFF07A', family: 'jaunes' },
        { key: 'apricot', name: 'Abricot', hex: '#FFB26B', family: 'jaunes' },
        { key: 'sand', name: 'Sable', hex: '#E9CF9E', family: 'jaunes' },
        { key: 'coral', name: 'Corail', hex: '#FF7A6B', family: 'rouges' },
        { key: 'cherry', name: 'Cerise', hex: '#E0245E', family: 'rouges' },
        { key: 'burgundy', name: 'Bordeaux', hex: '#9E2A3F', family: 'rouges' },
        { key: 'blush', name: 'Rose pastel', hex: '#FFB3CF', family: 'roses' },
        { key: 'pink', name: 'Rose bonbon', hex: '#FF6FAE', family: 'roses' },
        { key: 'fuchsia', name: 'Fuchsia', hex: '#E04BC8', family: 'roses' },
        { key: 'lavender', name: 'Lavande', hex: '#B9A6FF', family: 'violets' },
        { key: 'purple', name: 'Violet', hex: '#8E5CF0', family: 'violets' },
        { key: 'plum', name: 'Prune', hex: '#6B3FA0', family: 'violets' },
        { key: 'caramel', name: 'Caramel', hex: '#C98A4B', family: 'marrons' },
        { key: 'brown', name: 'Marron', hex: '#8B5E3C', family: 'marrons' },
        { key: 'chocolate', name: 'Chocolat', hex: '#5E4030', family: 'marrons' },
        { key: 'silver', name: 'Gris clair', hex: '#C3C8CF', family: 'gris' },
        { key: 'grey', name: 'Gris', hex: '#8E949C', family: 'gris' },
        { key: 'graphite', name: 'Anthracite', hex: '#4A4F57', family: 'gris' }
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
    },
    {
      id: 'tokyo',
      name: 'Tokyo',
      description: 'La boucle Yamanote encercle le centre, traversée par les lignes Ginza, Marunouchi, Hibiya et Tōzai.',
      palette: 'base',
      stops: [
        ['tokyo', 4, 0, 'Tōkyō'],
        ['akihabara', 4, -3, 'Akihabara'],
        ['ueno', 3, -6, 'Ueno'],
        ['ikebukuro', -4, -6, 'Ikebukuro'],
        ['shinjuku', -6, -1, 'Shinjuku'],
        ['shibuya', -5, 4, 'Shibuya'],
        ['shinagawa', 1, 6, 'Shinagawa'],
        ['hamamatsucho', 3, 3, 'Hamamatsuchō'],
        ['omotesando', -3, 3, 'Omotesandō'],
        ['ginza', 2, 1, 'Ginza'],
        ['nihombashi', 3, -1, 'Nihombashi'],
        ['asakusa', 5, -7, 'Asakusa'],
        ['korakuen', 0, -4, 'Kōrakuen'],
        ['otemachi', 2, -1, 'Ōtemachi'],
        ['kasumigaseki', 0, 3, 'Kasumigaseki'],
        ['yotsuya', -3, 0, 'Yotsuya'],
        ['ebisu', -3, 6, 'Ebisu'],
        ['roppongi', -1, 4, 'Roppongi'],
        ['hibiya', 1, 1, 'Hibiya'],
        ['kitasenju', 6, -9, 'Kita-Senju'],
        ['takadanobaba', -6, -4, 'Takadanobaba'],
        ['iidabashi', -1, -3, 'Iidabashi'],
        ['kiba', 6, 1, 'Kiba']
      ],
      lines: [
        { label: 'JY', color: 'lime', loop: true, stops: ['tokyo', 'akihabara', 'ueno', 'ikebukuro', 'shinjuku', 'shibuya', 'shinagawa', 'hamamatsucho'] },
        { label: 'G', color: 'orange', stops: ['shibuya', 'omotesando', 'ginza', 'nihombashi', 'ueno', 'asakusa'] },
        { label: 'M', color: 'red', stops: ['ikebukuro', 'korakuen', 'otemachi', 'tokyo', 'ginza', 'kasumigaseki', 'yotsuya', 'shinjuku'] },
        { label: 'H', color: 'grey', stops: ['ebisu', 'roppongi', 'kasumigaseki', 'hibiya', 'akihabara', 'kitasenju'] },
        { label: 'T', color: 'sky', stops: ['takadanobaba', 'iidabashi', 'otemachi', 'nihombashi', 'kiba'] }
      ]
    },
    {
      id: 'berlin',
      name: 'Berlin',
      description: 'Le Ringbahn fait le tour de la ville ; les lignes U2, U6, U7 et U8 le traversent.',
      palette: 'base',
      stops: [
        ['westkreuz', -7, 0, 'Westkreuz'],
        ['westend', -5, -4, 'Westend'],
        ['wedding', -2, -6, 'Wedding'],
        ['gesundbrunnen', 0, -6, 'Gesundbrunnen'],
        ['schoenhauser', 3, -5, 'Schönhauser Allee'],
        ['ostkreuz', 7, 0, 'Ostkreuz'],
        ['neukoelln', 3, 5, 'Neukölln'],
        ['tempelhof', 0, 5, 'Tempelhof'],
        ['suedkreuz', -1, 6, 'Südkreuz'],
        ['innsbrucker', -5, 4, 'Innsbrucker Platz'],
        ['theodorheuss', -9, -2, 'Theodor-Heuss-Platz'],
        ['zoo', -3, 0, 'Zoologischer Garten'],
        ['potsdamer', -1, 1, 'Potsdamer Platz'],
        ['alex', 2, -1, 'Alexanderplatz'],
        ['pankow', 3, -8, 'Pankow'],
        ['tegel', -2, -10, 'Alt-Tegel'],
        ['friedrich', 0, -1, 'Friedrichstraße'],
        ['mehringdamm', 0, 3, 'Mehringdamm'],
        ['mariendorf', 0, 8, 'Alt-Mariendorf'],
        ['wittenau', 1, -10, 'Wittenau'],
        ['kotti', 2, 2, 'Kottbusser Tor'],
        ['hermannplatz', 3, 3, 'Hermannplatz'],
        ['hermannstr', 4, 7, 'Hermannstraße'],
        ['spandau', -11, -4, 'Rathaus Spandau'],
        ['bismarck', -5, -1, 'Bismarckstraße'],
        ['rudow', 6, 9, 'Rudow']
      ],
      lines: [
        { label: 'S41', color: 'caramel', loop: true, style: 'curve', stops: ['westkreuz', 'westend', 'wedding', 'gesundbrunnen', 'schoenhauser', 'ostkreuz', 'neukoelln', 'tempelhof', 'suedkreuz', 'innsbrucker'] },
        { label: 'U2', color: 'red', stops: ['theodorheuss', 'zoo', 'potsdamer', 'alex', 'schoenhauser', 'pankow'] },
        { label: 'U6', color: 'purple', stops: ['tegel', 'wedding', 'friedrich', 'mehringdamm', 'tempelhof', 'mariendorf'] },
        { label: 'U7', color: 'sky', stops: ['spandau', 'bismarck', 'mehringdamm', 'hermannplatz', 'neukoelln', 'rudow'] },
        { label: 'U8', color: 'royal', stops: ['wittenau', 'gesundbrunnen', 'alex', 'kotti', 'hermannplatz', 'hermannstr'] }
      ]
    },
    {
      id: 'madrid',
      name: 'Madrid',
      description: 'La Circular (ligne 6) entoure le centre, Sol réunit les lignes 1, 2 et 3.',
      palette: 'base',
      stops: [
        ['moncloa', -5, -2, 'Moncloa'],
        ['cuatro', -1, -5, 'Cuatro Caminos'],
        ['nuevos', 3, -4, 'Nuevos Ministerios'],
        ['america', 6, -1, 'Avenida de América'],
        ['becerra', 6, 2, 'Manuel Becerra'],
        ['pacifico', 3, 6, 'Pacífico'],
        ['legazpi', -1, 7, 'Legazpi'],
        ['pio', -6, 3, 'Príncipe Pío'],
        ['castilla', 1, -9, 'Plaza de Castilla'],
        ['bilbao', 0, -2, 'Bilbao'],
        ['sol', 0, 1, 'Sol'],
        ['atocha', 2, 4, 'Atocha'],
        ['valdecarros', 5, 10, 'Valdecarros'],
        ['opera', -2, 1, 'Ópera'],
        ['goya', 4, 0, 'Goya'],
        ['rosas', 9, 3, 'Las Rosas'],
        ['espana', -3, -1, 'Plaza de España'],
        ['callao', -1, 0, 'Callao'],
        ['villaverde', -2, 11, 'Villaverde Alto'],
        ['fuencarral', 3, -9, 'Fuencarral'],
        ['puertasur', -9, 7, 'Puerta del Sur']
      ],
      lines: [
        { label: '6', color: 'grey', loop: true, stops: ['moncloa', 'cuatro', 'nuevos', 'america', 'becerra', 'pacifico', 'legazpi', 'pio'] },
        { label: '1', color: 'sky', stops: ['castilla', 'cuatro', 'bilbao', 'sol', 'atocha', 'pacifico', 'valdecarros'] },
        { label: '2', color: 'red', stops: ['cuatro', 'opera', 'sol', 'goya', 'becerra', 'rosas'] },
        { label: '3', color: 'yellow', stops: ['moncloa', 'espana', 'callao', 'sol', 'legazpi', 'villaverde'] },
        { label: '10', color: 'navy', stops: ['fuencarral', 'nuevos', 'espana', 'pio', 'puertasur'] }
      ]
    },
    {
      id: 'moscou',
      name: 'Moscou',
      description: 'La célèbre ligne circulaire Koltsevaïa relie toutes les radiales qui se croisent au centre.',
      palette: 'base',
      stops: [
        ['belorusskaya', -3, -4, 'Biélorousskaïa'],
        ['prospektmira', 1, -5, 'Prospekt Mira'],
        ['komsomolskaya', 4, -3, 'Komsomolskaïa'],
        ['kurskaya', 5, 1, 'Kourskaïa'],
        ['taganskaya', 3, 4, 'Taganskaïa'],
        ['paveletskaya', 0, 5, 'Paveletskaïa'],
        ['oktyabrskaya', -3, 4, 'Oktiabrskaïa'],
        ['parkkultury', -5, 1, 'Park Koultoury'],
        ['kiyevskaya', -5, -2, 'Kievskaïa'],
        ['sokolniki', 4, -8, 'Sokolniki'],
        ['lubyanka', 1, -1, 'Loubianka'],
        ['okhotny', 0, 0, 'Okhotny Riad'],
        ['yugozapadnaya', -8, 5, 'Iougo-Zapadnaïa'],
        ['rechnoy', -5, -9, 'Retchnoï Vokzal'],
        ['teatralnaya', 0, 1, 'Teatralnaïa'],
        ['krasnogvardeyskaya', 3, 10, 'Krasnogvardeïskaïa'],
        ['medvedkovo', 2, -10, 'Medvedkovo'],
        ['kitaygorod', 2, 0, 'Kitaï-Gorod'],
        ['novoyasenevskaya', -4, 10, 'Novoiassenevskaïa'],
        ['planernaya', -9, -6, 'Planernaïa'],
        ['barrikadnaya', -4, -4, 'Barrikadnaïa'],
        ['kotelniki', 7, 8, 'Kotelniki'],
        ['arbatskaya', -2, -1, 'Arbatskaïa'],
        ['revolyutsii', 1, -2, 'Plochtchad Revolioutsii'],
        ['shchyolkovskaya', 9, -3, 'Chtchiolkovskaïa']
      ],
      lines: [
        { label: '5', color: 'brown', loop: true, style: 'curve', stops: ['belorusskaya', 'prospektmira', 'komsomolskaya', 'kurskaya', 'taganskaya', 'paveletskaya', 'oktyabrskaya', 'parkkultury', 'kiyevskaya'] },
        { label: '1', color: 'red', stops: ['sokolniki', 'komsomolskaya', 'lubyanka', 'okhotny', 'parkkultury', 'yugozapadnaya'] },
        { label: '2', color: 'emerald', stops: ['rechnoy', 'belorusskaya', 'teatralnaya', 'paveletskaya', 'krasnogvardeyskaya'] },
        { label: '3', color: 'navy', stops: ['kiyevskaya', 'arbatskaya', 'revolyutsii', 'kurskaya', 'shchyolkovskaya'] },
        { label: '6', color: 'orange', stops: ['medvedkovo', 'prospektmira', 'kitaygorod', 'oktyabrskaya', 'novoyasenevskaya'] },
        { label: '7', color: 'purple', stops: ['planernaya', 'barrikadnaya', 'kitaygorod', 'taganskaya', 'kotelniki'] }
      ]
    },
    {
      id: 'montreal',
      name: 'Montréal',
      description: 'Pas de ligne circulaire : la boucle se forme entre les lignes orange et verte, de Lionel-Groulx à Berri-UQAM.',
      palette: 'base',
      stops: [
        ['cotevertu', -8, -5, 'Côte-Vertu'],
        ['snowdon', -6, 0, 'Snowdon'],
        ['lionelgroulx', -3, 4, 'Lionel-Groulx'],
        ['bonaventure', 0, 3, 'Bonaventure'],
        ['berri', 3, 1, 'Berri-UQAM'],
        ['jeantalon', 1, -4, 'Jean-Talon'],
        ['montmorency', -2, -9, 'Montmorency'],
        ['angrignon', -6, 7, 'Angrignon'],
        ['atwater', -2, 2, 'Atwater'],
        ['mcgill', 0, 1, 'McGill'],
        ['pieix', 7, -1, 'Pie-IX'],
        ['beaugrand', 10, -2, 'Honoré-Beaugrand'],
        ['udem', -4, -2, 'Université-de-Montréal'],
        ['parc', -1, -4, 'Parc'],
        ['stmichel', 4, -5, 'Saint-Michel'],
        ['jeandrapeau', 5, 3, 'Jean-Drapeau'],
        ['longueuil', 7, 5, 'Longueuil']
      ],
      lines: [
        { label: '2', color: 'orange', stops: ['cotevertu', 'snowdon', 'lionelgroulx', 'bonaventure', 'berri', 'jeantalon', 'montmorency'] },
        { label: '1', color: 'emerald', stops: ['angrignon', 'lionelgroulx', 'atwater', 'mcgill', 'berri', 'pieix', 'beaugrand'] },
        { label: '5', color: 'royal', stops: ['snowdon', 'udem', 'parc', 'jeantalon', 'stmichel'] },
        { label: '4', color: 'yellow', stops: ['berri', 'jeandrapeau', 'longueuil'] }
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
    FAMILIES: FAMILIES,
    list: function () { return CITIES.slice(); },
    get: get,
    palette: palette,
    colorHex: colorHex,
    buildInitialState: buildInitialState,
    hasSave: hasSave,
    clearSave: clearSave
  };
})(typeof window !== 'undefined' ? window : globalThis);
