// Source: MDN SpeechRecognition — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const CATEGORY_WORDS = {
    wardrobe: ['шкаф', 'гардероб', 'wardrobe', 'closet'],
    sofa: ['диван', 'софа', 'sofa', 'couch'],
    chair: ['стул', 'кресл', 'chair'],
    table: ['стол', 'table', 'desk'],
    bed: ['кроват', 'bed']
  };

  const COLOR_WORDS = {
    white: ['бел', 'white'],
    grey: ['сер', 'grey', 'gray'],
    black: ['черн', 'black'],
    brown: ['коричн', 'дерев', 'brown', 'wood'],
    beige: ['беж', 'beige']
  };

  const WORD_NUMBERS = [
    ['два с половиной', 2.5], ['two and a half', 2.5],
    ['полтора', 1.5], ['полутора', 1.5], ['one and a half', 1.5],
    ['двух', 2], ['два', 2], ['two', 2],
    ['трех', 3], ['три', 3], ['three', 3],
    ['одного', 1], ['один', 1], ['one', 1]
  ];

  function normalize(text) {
    return text.toLowerCase().replace(/ё/g, 'е').replace(/(\d),(\d)/g, '$1.$2');
  }

  function hasWord(text, word) {
    return new RegExp('(^|[^a-zа-я])' + word + '($|[^a-zа-я])').test(text);
  }

  function findKey(text, dict) {
    for (const key in dict) {
      if (dict[key].some(function (w) { return text.includes(w); })) return key;
    }
    return null;
  }

  function parseSize(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(см|сантиметр|cm|centimet|мм|mm|м|метр|meter|metre|m)?/);
    let value = null;
    let unit = null;

    if (m) {
      value = parseFloat(m[1]);
      unit = m[2] || null;
    } else if (/метр|meter|metre/.test(text)) {
      for (const pair of WORD_NUMBERS) {
        if (hasWord(text, pair[0])) { value = pair[1]; unit = 'м'; break; }
      }
    }
    if (value === null) return null;

    if (unit && /^(см|сантиметр|cm|centimet)/.test(unit)) return value / 100;
    if (unit && /^(мм|mm)$/.test(unit)) return value / 1000;
    if (!unit && value > 10) return value / 100;
    return value;
  }

  function parseQuery(text) {
    const t = normalize(text || '');
    return {
      text: t,
      category: findKey(t, CATEGORY_WORDS),
      color: findKey(t, COLOR_WORDS),
      maxWidth: parseSize(t)
    };
  }

  function search(filters, catalog) {
    const items = catalog.filter(function (i) {
      return (!filters.category || i.category === filters.category) &&
             (!filters.color || i.color === filters.color) &&
             (!filters.maxWidth || i.width <= filters.maxWidth + 1e-6);
    });
    if (filters.maxWidth) items.sort(function (a, b) { return b.width - a.width; });
    return items;
  }

  function listen(opts) {
    if (!SR) {
      if (opts.onError) opts.onError('unsupported');
      if (opts.onEnd) opts.onEnd(false);
      return null;
    }
    const rec = new SR();
    rec.lang = opts.lang || 'ru-RU';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 3;

    let gotResult = false;
    rec.onresult = function (e) {
      gotResult = true;
      const alts = Array.from(e.results[0]).map(function (a) { return a.transcript; });
      let best = alts[0];
      for (const a of alts) {
        if (parseQuery(a).category) { best = a; break; }
      }
      opts.onResult(best);
    };
    rec.onerror = function (e) { if (opts.onError) opts.onError(e.error); };
    rec.onend = function () { if (opts.onEnd) opts.onEnd(gotResult); };

    try {
      rec.start();
    } catch (err) {
      if (opts.onError) opts.onError('start-failed');
      if (opts.onEnd) opts.onEnd(false);
    }
    return rec;
  }

  window.VoiceSearch = {
    isSupported: !!SR,
    listen: listen,
    parseQuery: parseQuery,
    search: search
  };
})();