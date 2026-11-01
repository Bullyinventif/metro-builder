/* Metro Builder — French / English language switcher */
(function (global) {
  'use strict';

  var KEY = 'metroBuilder.language';
  var dictionaries = {
    en: {
      'Metro Builder': 'Metro Builder',
      'Dessinez le réseau de métro de vos rêves.': 'Draw the metro network of your dreams.',
      'Jouer': 'Play',
      'Crédits': 'Credits',
      'Retour à Bubble Game': 'Back to Bubble Game',
      'Mode créatif · Projet personnel et non commercial': 'Creative mode · Personal non-commercial project',
      'Choisissez une ville': 'Choose a city',
      'Choisir une ville — Metro Builder': 'Choose a city — Metro Builder',
      'Chaque ville donne une palette et une disposition de départ.': 'Each city provides a palette and a starting layout.',
      'Retour au menu': 'Back to menu',
      'Reprendre': 'Resume',
      'Recommencer à zéro': 'Start over',
      'ligne': 'line',
      'lignes': 'lines',
      'arrêt': 'stop',
      'arrêts': 'stops',
      'Effacer la partie sauvegardée pour « {name} » ?': 'Delete the saved game for “{name}”?',
      'Crédits — Metro Builder': 'Credits — Metro Builder',
      'Merci à tous ceux qui ont rendu ce jeu possible.': 'Thanks to everyone who made this game possible.',
      'Création': 'Creation',
      'Idée, cahier des charges et esquisses :': 'Idea, specifications and sketches:',
      'Metro Builder est un projet personnel et': 'Metro Builder is a personal',
      'non commercial': 'non-commercial',
      'destiné à être partagé avec des proches. Il n’est ni vendu ni commercialisé.': 'project intended to be shared with friends and family. It is not sold or marketed.',
      'Inspiration': 'Inspiration',
      'Art et ressources': 'Art and resources',
      'Œuvres sous copyright utilisées': 'Copyrighted works used',
      'Aucune pour l’instant. Si un art, une musique ou une police d’une autre personne est ajouté, il sera crédité ici (titre, auteur, licence, lien).': 'None for now. If another person’s art, music or font is added, it will be credited here (title, author, license, link).',
      'Technique': 'Technical',
      'HTML, CSS et JavaScript, sans aucune dépendance.': 'HTML, CSS and JavaScript, with no dependencies.',
      'Rendu de la carte avec l’élément': 'Map rendered with the',
      'Carte du réseau de métro': 'Metro network map',
      'Menu principal': 'Main menu',
      'Ville': 'City',
      'Mode créatif': 'Creative mode',
      'Lignes de métro': 'Metro lines',
      'Ajouter une ligne': 'Add a line',
      'Couleur de la ligne': 'Line color',
      'Annuler': 'Undo',
      'Rétablir': 'Redo',
      'Afficher les noms des arrêts': 'Show stop names',
      'Noms des arrêts': 'Stop names',
      'Recentrer la carte': 'Center map',
      'Exporter / partager ce réseau': 'Export / share this network',
      'Importer un réseau (code ou lien)': 'Import a network (code or link)',
      'Réinitialiser la carte': 'Reset map',
      'Règles du réseau': 'Network rules',
      'Fermer': 'Close',
      'Partager le réseau': 'Share network',
      'Exporter': 'Export',
      'Importer': 'Import',
      'Envoyez ce lien à vos proches : le réseau s’ouvre directement dans le jeu.': 'Send this link to your friends: the network opens directly in the game.',
      'Lien à partager': 'Share link',
      'Ou le code texte': 'Or the text code',
      'Copier': 'Copy',
      'Copier le code': 'Copy code',
      'Collez un lien ou un code reçu. Le réseau actuel de cette ville sera remplacé (Ctrl+Z pour annuler).': 'Paste a received link or code. This city’s current network will be replaced (Ctrl+Z to undo).',
      'Lien ou code': 'Link or code',
      'Importer': 'Import',
      'Outils': 'Tools',
      'Point': 'Point',
      'Droit': 'Straight',
      'Courbe': 'Curve',
      'Zigzag': 'Zigzag',
      'Lecture': 'Play',
      'Pause': 'Pause',
      'Règles': 'Rules',
      'Prêt pour la lecture': 'Ready to play',
      'Simulation en cours': 'Simulation in progress',
      'Lecture du réseau…': 'Reading network…',
      'Import impossible.': 'Import failed.',
      'Nom de l’arrêt :': 'Stop name:',
      'Nombre maximum de lignes atteint.': 'Maximum number of lines reached.',
      'Réinitialiser la carte « {name} » ? Vos modifications seront perdues (Ctrl+Z pour annuler).': 'Reset the “{name}” map? Your changes will be lost (Ctrl+Z to undo).',
      'règle à corriger': 'rule to fix',
      'règles à corriger': 'rules to fix',
      'Ligne': 'Line',
      'vide': 'empty',
      'boucle': 'loop',
      'déjà utilisée': 'already used',
      'Couleurs': 'Colors',
      'Nouvelle ligne : choisissez sa couleur': 'New line: choose its color',
      'Retirer la couleur de l’arrêt': 'Remove stop color',
      'Génération du lien…': 'Generating link…',
      'Export impossible.': 'Export failed.',
      'Réseau importé ✓': 'Network imported ✓',
      'Lien copié !': 'Link copied!',
      'Code copié !': 'Code copied!',
      'Copie impossible : sélectionnez le texte à la main.': 'Copy failed: select the text manually.',
      'Remplacer le réseau actuel par celui importé ? (Ctrl+Z pour annuler)': 'Replace the current network with the imported one? (Ctrl+Z to undo)'
      ,'Au moins 3 arrêts': 'At least 3 stops'
      ,'Aucun arrêt en double': 'No duplicate stops'
      ,'Tous les arrêts sont reliés': 'All stops are connected'
      ,'Un seul réseau connecté': 'One connected network'
      ,'Chaque ligne est continue': 'Every line is continuous'
      ,'Pas d’embranchement': 'No branches'
      ,'Au moins une boucle': 'At least one loop'
      ,'Correspondances des lignes ouvertes': 'Open lines have interchanges'
      ,'Aucune liaison ne traverse un arrêt': 'No connection crosses a stop'
    }
  };

  function locale() {
    return global.localStorage && localStorage.getItem(KEY) === 'en' ? 'en' : 'fr';
  }
  function format(value, vars) {
    return String(value).replace(/\{(\w+)\}/g, function (_, key) {
      return vars && vars[key] !== undefined ? vars[key] : _;
    });
  }
  function translate(source, vars) {
    var value = locale() === 'en' && dictionaries.en[source] ? dictionaries.en[source] : source;
    return format(value, vars);
  }
  function translateText(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      var source = node._metroSource || node.nodeValue.trim();
      node._metroSource = source;
      var translated = translate(source);
      if (node.nodeValue.trim() === source) node.nodeValue = node.nodeValue.replace(source, translated);
    }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(function (el) {
      ['title', 'aria-label', 'placeholder'].forEach(function (attr) {
        var source = el.getAttribute(attr);
        if (source) {
          el.setAttribute('data-metro-' + attr, el.getAttribute('data-metro-' + attr) || source);
          el.setAttribute(attr, translate(el.getAttribute('data-metro-' + attr)));
        }
      });
    });
  }
  function setLanguage(next) {
    try { localStorage.setItem(KEY, next === 'en' ? 'en' : 'fr'); } catch (e) {}
    location.reload();
  }
  function init() {
    var button = document.createElement('button');
    button.type = 'button';
    var gameHeader = document.querySelector('.top-left');
    var pageHeader = document.querySelector('.page-header');
    var homeButton = document.getElementById('home-btn');
    if (gameHeader && homeButton) {
      button.className = 'language-toggle language-toggle-game glass';
      gameHeader.insertBefore(button, homeButton.nextSibling);
    } else if (pageHeader) {
      button.className = 'language-toggle language-toggle-page glass';
      pageHeader.insertBefore(button, pageHeader.children[1]);
    } else {
      button.className = 'language-toggle language-toggle-home glass';
      document.body.appendChild(button);
    }
    button.textContent = locale() === 'en' ? 'FR' : 'EN';
    button.title = locale() === 'en' ? 'Passer en français' : 'Switch to English';
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', function () { setLanguage(locale() === 'en' ? 'fr' : 'en'); });
    translateText(document.body);
    document.documentElement.lang = locale();
    var title = document.title;
    if (locale() === 'en') document.title = translate(title);
  }

  global.MetroI18n = { locale: locale, t: translate, init: init, translateText: translateText };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
