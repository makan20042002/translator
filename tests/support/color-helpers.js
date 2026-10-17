'use strict';

const COLOR_HELPERS_SOURCE = `(() => {
  if (window.__tc) return;

  function parse(cssColor) {
    if (!cssColor || typeof cssColor !== 'string') {
      throw new Error('Invalid color value: ' + String(cssColor));
    }
    const val = cssColor.trim();
    if (val === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (!parse._canvas) {
      parse._canvas = document.createElement('canvas');
      parse._canvas.width = 1;
      parse._canvas.height = 1;
      parse._ctx = parse._canvas.getContext('2d', { willReadFrequently: true });
    }
    const ctx = parse._ctx;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = val;

    if (ctx.fillStyle === 'rgba(0, 0, 0, 0)' && val !== 'rgba(0, 0, 0, 0)' && val !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = '#ffffff';
      ctx.fillStyle = val;
      if (ctx.fillStyle === '#ffffff' && val !== '#ffffff' && val !== '#fff' && val !== 'rgb(255, 255, 255)' && val !== 'rgb(255,255,255)') {
        throw new Error('Cannot parse color value: ' + val);
      }
    }

    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = Math.round((data[3] / 255) * 1000) / 1000;
    return { r, g, b, a };
  }

  function blend(fg, bg) {
    const a = fg.a;
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
      a: 1
    };
  }

  function sRGBtoLin(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    return 0.2126 * sRGBtoLin(rgb.r) + 0.7152 * sRGBtoLin(rgb.g) + 0.0722 * sRGBtoLin(rgb.b);
  }

  function ratio(rgb1, rgb2) {
    const l1 = luminance(rgb1);
    const l2 = luminance(rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function gradientStops(backgroundImage) {
    if (!backgroundImage || backgroundImage === 'none' || !backgroundImage.includes('gradient')) {
      return [];
    }
    const regex = /(?:color\([^)]+\)|rgba?\([^)]+\)|hsla?\([^)]+\)|oklab\([^)]+\)|#(?:[0-9a-fA-F]{3,4}){1,2}\b)/gi;
    const matches = backgroundImage.match(regex);
    if (!matches) return [];
    return matches.map(m => parse(m));
  }

  function effectiveBg(el) {
    const path = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      path.unshift(cur);
      cur = cur.parentElement;
    }
    let bodyBgStr = window.getComputedStyle(document.body).backgroundColor;
    let bg = (bodyBgStr && bodyBgStr !== 'rgba(0, 0, 0, 0)' && bodyBgStr !== 'transparent')
      ? parse(bodyBgStr)
      : { r: 255, g: 255, b: 255, a: 1 };
    if (bg.a < 1) bg = blend(bg, { r: 255, g: 255, b: 255, a: 1 });

    let allStops = [];
    for (const node of path) {
      const cs = window.getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
        const stops = gradientStops(cs.backgroundImage);
        if (stops.length > 0) {
          allStops = stops;
        }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        bg = blend(c, bg);
      }
    }
    return Object.assign({ bg, gradientStops: allStops }, bg);
  }

  window.__tc = {
    parse,
    blend,
    luminance,
    ratio,
    effectiveBg,
    gradientStops
  };
})();`;

module.exports = { COLOR_HELPERS_SOURCE };
