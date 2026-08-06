// Loads the web fonts WITHOUT blocking first paint.
//
// This used to be a plain <link rel="stylesheet"> in index.html. A stylesheet
// link is render-blocking, so whenever fonts.googleapis.com was slow or
// unreachable the whole admin app sat on a blank screen until the browser gave
// up on the request (~20s+ on a flaky connection). Injecting the link from a
// script makes it non-blocking: the UI paints immediately in the fallback font
// and swaps when the CSS arrives (the URL carries display=swap).
//
// It runs as a same-origin file rather than an inline `onload=` handler because
// the production CSP is helmet's default (script-src 'self'), which blocks
// inline handlers.
//
// Only the families the app can actually use are requested: the nine offered by
// Settings → Theme (FONT_OPTIONS in ThemeSection.js) plus JetBrains Mono for the
// restaurant clocks. The old request pulled 22 families with every weight and
// italic variant, most of which nothing referenced.
(function () {
  var families = [
    'Nunito:wght@300;400;500;600;700;800',
    'Inter:wght@300;400;500;600;700;800',
    'Roboto:wght@300;400;500;700',
    'Poppins:wght@300;400;500;600;700;800',
    'Quicksand:wght@300;400;500;600;700',
    'Rubik:wght@300;400;500;600;700;800',
    'Lato:wght@300;400;700;900',
    'Montserrat:wght@300;400;500;600;700;800',
    'Open+Sans:wght@300;400;500;600;700;800',
    'JetBrains+Mono:wght@400;800',
  ];

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family='
    + families.join('&family=')
    + '&display=swap';
  document.head.appendChild(link);
})();
