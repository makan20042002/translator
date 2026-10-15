/* ==========================================================================
   MAKAN Translate — Color Themes Registry & Theme Switching Engine
   ========================================================================== */

(function () {
  'use strict';

  var THEMES = {
    'makan-lab': {
      name: 'Makan Lab',
      name_fa: 'ماکان لب',
      mode: 'dark',
      colors: {
        "Bg": "#040914",
        "Panel": "#071022",
        "Panel2": "#050b18",
        "Surface": "#0a1528",
        "Border": "rgba(255, 255, 255, 0.08)",
        "Text": "#F1F5F9",
        "Muted": "#8496B0",
        "Faint": "#506482",
        "TopBarText": "#F1F5F9",
        "Accent": "#08A8FF",
        "AccentDark": "#1366E2",
        "OnAccent": "#040914",
        "Hover": "#0d1e3a",
        "Selected": "#102448",
        "Success": "#10B981",
        "Danger": "#EF4444",
        "Warning": "#F59E0B",
        "SuccessBg": "rgba(16, 185, 129, 0.15)",
        "HeaderBg": "#071022",
        "Track": "#0e1e38",
        "Input": "#0a1528",
        "InputBorder": "rgba(28, 64, 118, 0.45)",
        "Popup": "#0a1528",
        "IconGrey": "#8496B0",
        "IconPurple": "#A78BFA",
        "IconTeal": "#08E7E5",
        "IconAmber": "#F59E0B",
        "ScrollThumb": "rgba(28, 64, 118, 0.45)",
        "ScrollThumbHover": "#08A8FF",
        "Disabled": "#506482"
      }
    },
    'platinum-blue': {
      name: 'Platinum Blue',
      name_fa: 'پلاتینیوم آبی',
      mode: 'light',
      colors: {
        "Bg": "#EAF4FF",
        "Panel": "#F4F9FF",
        "Panel2": "#DCEBFA",
        "Surface": "#FFFFFF",
        "Border": "#B7CEE6",
        "Text": "#12263F",
        "Muted": "#4D6680",
        "Faint": "#7890A8",
        "TopBarText": "#FFFFFF",
        "Accent": "#1467D8",
        "AccentDark": "#0C4FAE",
        "OnAccent": "#FFFFFF",
        "Hover": "#E2EFFC",
        "Selected": "#C8DFFF",
        "Success": "#197347",
        "Danger": "#B4233E",
        "Warning": "#9A5700",
        "SuccessBg": "#E1F3EA",
        "HeaderBg": "#F4F9FF",
        "Track": "#DCEBFA",
        "Input": "#FFFFFF",
        "InputBorder": "#AFC8E2",
        "Popup": "#FFFFFF",
        "IconGrey": "#536B84",
        "IconPurple": "#7047B8",
        "IconTeal": "#08798A",
        "IconAmber": "#9A5700",
        "ScrollThumb": "#AFC8E2",
        "ScrollThumbHover": "#1467D8",
        "Disabled": "#8B9DB0"
      }
    },
    'dracula': {
      name: 'Dracula',
      name_fa: 'دراکولا',
      mode: 'dark',
      colors: {
        "Bg": "#1E1F29",
        "Panel": "#282A36",
        "Panel2": "#343746",
        "Surface": "#3C3F51",
        "Border": "#5A5F78",
        "Text": "#F8F8F2",
        "Muted": "#C9C9C2",
        "Faint": "#8B8D9A",
        "TopBarText": "#1E1F29",
        "Accent": "#BD93F9",
        "AccentDark": "#8B5CC7",
        "OnAccent": "#171820",
        "Hover": "#44475A",
        "Selected": "#50536A",
        "Success": "#50FA7B",
        "Danger": "#FF6E78",
        "Warning": "#F1FA8C",
        "SuccessBg": "#243C2B",
        "HeaderBg": "#282A36",
        "Track": "#343746",
        "Input": "#21222C",
        "InputBorder": "#5A5F78",
        "Popup": "#343746",
        "IconGrey": "#C9C9C2",
        "IconPurple": "#FF79C6",
        "IconTeal": "#8BE9FD",
        "IconAmber": "#FFB86C",
        "ScrollThumb": "#5A5F78",
        "ScrollThumbHover": "#BD93F9",
        "Disabled": "#6B6E82"
      }
    },
    'champagne-minimal': {
      name: 'Champagne Minimal',
      name_fa: 'شامپاین مینیمال',
      mode: 'light',
      colors: {
        "Bg": "#F6F0E7",
        "Panel": "#FBF7F1",
        "Panel2": "#EDE2D2",
        "Surface": "#FFFFFF",
        "Border": "#D7C2A4",
        "Text": "#2D241A",
        "Muted": "#6F5E49",
        "Faint": "#9C8870",
        "TopBarText": "#FFFFFF",
        "Accent": "#9B682D",
        "AccentDark": "#754817",
        "OnAccent": "#FFFFFF",
        "Hover": "#F1E7D8",
        "Selected": "#E6D3B7",
        "Success": "#287546",
        "Danger": "#B52D3E",
        "Warning": "#965400",
        "SuccessBg": "#E5F1E8",
        "HeaderBg": "#FBF7F1",
        "Track": "#EDE2D2",
        "Input": "#FFFFFF",
        "InputBorder": "#CFB999",
        "Popup": "#FFFFFF",
        "IconGrey": "#6F5E49",
        "IconPurple": "#724AA2",
        "IconTeal": "#1F7480",
        "IconAmber": "#9B682D",
        "ScrollThumb": "#CFB999",
        "ScrollThumbHover": "#9B682D",
        "Disabled": "#A2927D"
      }
    },
    'rose-titanium': {
      name: 'Rose Titanium',
      name_fa: 'رز تیتانیوم',
      mode: 'dark',
      colors: {
        "Bg": "#120B10",
        "Panel": "#20111B",
        "Panel2": "#301825",
        "Surface": "#3C1E30",
        "Border": "#6A3B56",
        "Text": "#FFF3F9",
        "Muted": "#D9B4C8",
        "Faint": "#93677E",
        "TopBarText": "#260C18",
        "Accent": "#E187B1",
        "AccentDark": "#9D3F6E",
        "OnAccent": "#260C18",
        "Hover": "#48243A",
        "Selected": "#5B2C48",
        "Success": "#63D59A",
        "Danger": "#FF6680",
        "Warning": "#F2C565",
        "SuccessBg": "#17291F",
        "HeaderBg": "#20111B",
        "Track": "#301825",
        "Input": "#180D14",
        "InputBorder": "#6A3B56",
        "Popup": "#301825",
        "IconGrey": "#D9B4C8",
        "IconPurple": "#C69AFF",
        "IconTeal": "#66D2D6",
        "IconAmber": "#F2C565",
        "ScrollThumb": "#6A3B56",
        "ScrollThumbHover": "#E187B1",
        "Disabled": "#79596A"
      }
    },
    'royal-amethyst': {
      name: 'Royal Amethyst',
      name_fa: 'رویال آمیتیست',
      mode: 'dark',
      colors: {
        "Bg": "#0C081A",
        "Panel": "#150D2C",
        "Panel2": "#211343",
        "Surface": "#2A1854",
        "Border": "#54338B",
        "Text": "#F8F2FF",
        "Muted": "#C7B5E5",
        "Faint": "#856AAA",
        "TopBarText": "#180A2A",
        "Accent": "#A873F0",
        "AccentDark": "#6C2CC1",
        "OnAccent": "#180A2A",
        "Hover": "#321E61",
        "Selected": "#432777",
        "Success": "#55DDA6",
        "Danger": "#FF668C",
        "Warning": "#F4C96B",
        "SuccessBg": "#142A24",
        "HeaderBg": "#150D2C",
        "Track": "#211343",
        "Input": "#100921",
        "InputBorder": "#54338B",
        "Popup": "#211343",
        "IconGrey": "#C7B5E5",
        "IconPurple": "#C794FF",
        "IconTeal": "#63D8EA",
        "IconAmber": "#F4C96B",
        "ScrollThumb": "#54338B",
        "ScrollThumbHover": "#A873F0",
        "Disabled": "#6E5C86"
      }
    },
    'obsidian-gold': {
      name: 'Obsidian Gold',
      name_fa: 'ابسیدین گلد',
      mode: 'dark',
      colors: {
        "Bg": "#0A0907",
        "Panel": "#11100D",
        "Panel2": "#181611",
        "Surface": "#201D16",
        "Border": "#4A3B22",
        "Text": "#FFF8E7",
        "Muted": "#D8C7A0",
        "Faint": "#8F7B54",
        "TopBarText": "#120E05",
        "Accent": "#E0B75A",
        "AccentDark": "#A97822",
        "OnAccent": "#120E05",
        "Hover": "#28231A",
        "Selected": "#3A2F1C",
        "Success": "#64D68A",
        "Danger": "#FF6B6B",
        "Warning": "#F4C66A",
        "SuccessBg": "#13251A",
        "HeaderBg": "#11100D",
        "Track": "#181611",
        "Input": "#0D0C09",
        "InputBorder": "#4A3B22",
        "Popup": "#181611",
        "IconGrey": "#D8C7A0",
        "IconPurple": "#C69CFF",
        "IconTeal": "#63D6C5",
        "IconAmber": "#E0B75A",
        "ScrollThumb": "#4A3B22",
        "ScrollThumbHover": "#E0B75A",
        "Disabled": "#6E634E"
      }
    }
  };

  // Convert PascalCase token name (e.g. ScrollThumbHover) to CSS var (--scroll-thumb-hover)
  function tokenToVar(token) {
    return '--' + token.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  function getSavedThemeId() {
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function') {
      var id = window.store.get('theme', 'makan-lab');
      return (id && THEMES[id]) ? id : 'makan-lab';
    }
    try {
      var raw = localStorage.getItem('mkt_theme');
      var parsed = raw ? JSON.parse(raw) : 'makan-lab';
      return (parsed && THEMES[parsed]) ? parsed : 'makan-lab';
    } catch (e) {
      return 'makan-lab';
    }
  }

  function applyTheme(id) {
    var themeId = (id && THEMES[id]) ? id : 'makan-lab';
    var theme = THEMES[themeId];
    var root = document.documentElement;

    root.dataset.theme = themeId;
    root.setAttribute('data-theme', themeId);
    root.style.colorScheme = theme.mode === 'light' ? 'light' : 'dark';

    // Apply the 30 tokens directly to CSS custom properties on :root
    for (var token in theme.colors) {
      if (Object.prototype.hasOwnProperty.call(theme.colors, token)) {
        var cssVar = tokenToVar(token);
        root.style.setProperty(cssVar, theme.colors[token]);
      }
    }

    // Update <meta name="theme-color"> to the Bg token
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme.colors.Bg);
    } else {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      metaTheme.setAttribute('content', theme.colors.Bg);
      if (document.head) document.head.appendChild(metaTheme);
    }

    // Persist choice in store
    if (typeof window !== 'undefined' && window.store && typeof window.store.set === 'function') {
      window.store.set('theme', themeId);
    } else {
      try {
        localStorage.setItem('mkt_theme', JSON.stringify(themeId));
      } catch (e) {}
    }

    updateThemePickerUI(themeId);

    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeId, mode: theme.mode } }));
    } catch (e) {}

    return theme;
  }

  function updateThemePickerUI(activeId) {
    var cards = document.querySelectorAll('.theme-card');
    cards.forEach(function (card) {
      var cardId = card.getAttribute('data-theme-id');
      var isSelected = cardId === activeId;
      card.classList.toggle('active', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      card.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
  }

  function initThemePicker() {
    var grid = document.getElementById('themePickerGrid');
    if (!grid) return;

    var currentTheme = getSavedThemeId();

    // Render cards if empty
    if (!grid.children || grid.children.length === 0) {
      var html = '';
      for (var id in THEMES) {
        if (Object.prototype.hasOwnProperty.call(THEMES, id)) {
          var t = THEMES[id];
          var isSel = id === currentTheme;
          html += '<button type="button" class="theme-card' + (isSel ? ' active' : '') + '" ' +
            'role="radio" aria-checked="' + (isSel ? 'true' : 'false') + '" ' +
            'data-theme-id="' + id + '" tabindex="' + (isSel ? '0' : '-1') + '" ' +
            'aria-label="' + t.name + ' (' + (t.mode === 'light' ? 'Light' : 'Dark') + ')">' +
            '<div class="theme-swatch" aria-hidden="true">' +
              '<span class="theme-dot" style="background:' + t.colors.Bg + '" title="Bg: ' + t.colors.Bg + '"></span>' +
              '<span class="theme-dot" style="background:' + t.colors.Surface + '" title="Surface: ' + t.colors.Surface + '"></span>' +
              '<span class="theme-dot" style="background:' + t.colors.Accent + '" title="Accent: ' + t.colors.Accent + '"></span>' +
            '</div>' +
            '<div class="theme-info">' +
              '<div class="theme-name" data-theme-name="' + id + '">' + t.name + '</div>' +
              '<div class="theme-badge">' + (t.mode === 'light' ? 'Light' : 'Dark') + '</div>' +
            '</div>' +
            '<span class="theme-check" aria-hidden="true">✓</span>' +
          '</button>';
        }
      }
      grid.innerHTML = html;
    }

    // Attach click and keyboard listeners
    var cards = Array.from(grid.querySelectorAll('.theme-card'));
    cards.forEach(function (card, idx) {
      card.onclick = function () {
        var tid = card.getAttribute('data-theme-id');
        applyTheme(tid);
        card.focus();
      };

      card.onkeydown = function (e) {
        var targetIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          targetIndex = (idx + 1) % cards.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          targetIndex = (idx - 1 + cards.length) % cards.length;
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          var tid = card.getAttribute('data-theme-id');
          applyTheme(tid);
          return;
        }

        if (targetIndex >= 0) {
          var targetCard = cards[targetIndex];
          var tid = targetCard.getAttribute('data-theme-id');
          applyTheme(tid);
          targetCard.focus();
        }
      };
    });

    updateThemePickerUI(currentTheme);
    updateThemePickerLabels();
  }

  function updateThemePickerLabels() {
    var isFa = false;
    if (typeof window !== 'undefined' && window.store && typeof window.store.get === 'function') {
      isFa = window.store.get('lang') === 'fa';
    } else {
      isFa = (document.documentElement.lang === 'fa' || document.documentElement.dir === 'rtl');
    }

    var nameEls = document.querySelectorAll('[data-theme-name]');
    nameEls.forEach(function (el) {
      var id = el.getAttribute('data-theme-name');
      var theme = THEMES[id];
      if (theme) {
        el.textContent = isFa ? theme.name_fa : theme.name;
      }
    });

    var badgeEls = document.querySelectorAll('.theme-badge');
    badgeEls.forEach(function (badge) {
      var card = badge.closest('.theme-card');
      if (card) {
        var id = card.getAttribute('data-theme-id');
        var theme = THEMES[id];
        if (theme) {
          if (isFa) {
            badge.textContent = theme.mode === 'light' ? 'روشن' : 'تیره';
          } else {
            badge.textContent = theme.mode === 'light' ? 'Light' : 'Dark';
          }
        }
      }
    });
  }

  // Expose on window
  window.THEMES = THEMES;
  window.applyTheme = applyTheme;
  window.initThemePicker = initThemePicker;
  window.updateThemePickerLabels = updateThemePickerLabels;

  // Apply saved theme immediately BEFORE first paint
  var initialId = getSavedThemeId();
  applyTheme(initialId);

  // Initialize UI once DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initThemePicker();
    });
  } else {
    initThemePicker();
  }

  // Listen for language changes to update theme names in Persian / English
  window.addEventListener('i18nchange', function () {
    updateThemePickerLabels();
  });
})();
