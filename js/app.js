(function () {
  const scene = document.getElementById('scene');
  const $ = function (id) { return document.getElementById(id); };

  const ui = {
    landing: $('landing'), consent: $('consent'), micPermBtn: $('mic-perm-btn'),
    micStatus: $('mic-status'), startBtn: $('start-btn'), support: $('support-msg'),
    arUi: $('ar-ui'), hint: $('hint'), mainPanel: $('main-panel'),
    micBtn: $('mic-btn'), lang: $('lang'), searchForm: $('search-form'),
    searchInput: $('search-input'), transcript: $('transcript'), catalog: $('catalog'),
    rotLeft: $('rot-left'), rotRight: $('rot-right'), doorsBtn: $('doors-btn'), doneBtn: $('done-btn'),
    result: $('result'), resultInfo: $('result-info'), spaceInput: $('space-input'),
    fitMsg: $('fit-msg'), stats: $('stats'), backBtn: $('back-btn'), sendBtn: $('send-btn'),
    sendMsg: $('send-msg'), exitBtn: $('exit-btn')
  };

  let arSupported = false;
  let voiceAvailable = VoiceSearch.isSupported;
  let listening = false;
  let selectedItem = null;
  let placedItem = null;
  let lastMethod = null;
  let taskStart = null;
  let taskSeconds = null;

  const placer = function () { return scene.components['furniture-placer']; };
  const fpsMeter = function () { return scene.components['fps-meter']; };

  function hint(text) { ui.hint.textContent = text; }

  function fmtDims(item) {
    return Math.round(item.width * 100) + '×' + Math.round(item.depth * 100) + '×' +
           Math.round(item.height * 100) + ' см';
  }

  function fmtPrice(p) { return p.toLocaleString('ru-RU') + ' ₸'; }

  async function checkSupport() {
    try {
      arSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
      arSupported = false;
    }
    if (!arSupported) {
      ui.support.textContent = 'Этот браузер не поддерживает WebXR AR. Откройте страницу в Chrome ' +
        'на Android-телефоне с ARCore (на iPhone WebXR AR пока недоступен).';
      ui.support.hidden = false;
    }
    if (!voiceAvailable) {
      ui.micStatus.textContent = 'Голосовой поиск в этом браузере недоступен — будет поиск текстом и каталог.';
    }
    updateLandingButtons();
  }

  function updateLandingButtons() {
    ui.micPermBtn.disabled = !ui.consent.checked || !voiceAvailable;
    ui.startBtn.disabled = !ui.consent.checked || !arSupported;
  }

  ui.consent.addEventListener('change', updateLandingButtons);

  ui.micPermBtn.addEventListener('click', async function () {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(function (t) { t.stop(); });
      ui.micStatus.textContent = '✔ Микрофон разрешён.';
    } catch (e) {
      voiceAvailable = false;
      ui.micStatus.textContent = '✖ Микрофон не разрешён — будет поиск текстом и каталог.';
    }
    updateLandingButtons();
  });

  ui.startBtn.addEventListener('click', function () {
    if (!scene.hasLoaded) {
      scene.addEventListener('loaded', startAR, { once: true });
    } else {
      startAR();
    }
  });

  function startAR() {
    updateVoiceUi();
    showState('place');
    ui.arUi.hidden = false;
    const p = scene.enterAR();
    if (p && p.catch) {
      p.catch(function (err) {
        ui.arUi.hidden = true;
        ui.support.textContent = 'Не удалось запустить AR: ' + err.message;
        ui.support.hidden = false;
      });
    }
  }

  scene.addEventListener('enter-vr', function () {
    ui.landing.hidden = true;
    taskStart = performance.now();
    taskSeconds = null;
    renderCatalog(window.CATALOG);
    hint('Медленно поводите телефоном, чтобы найти пол.');
  });

  scene.addEventListener('exit-vr', function () {
    ui.arUi.hidden = true;
    ui.landing.hidden = false;
    listening = false;
  });

  function showState(name) {
    ui.mainPanel.hidden = name !== 'place';
    ui.result.hidden = name !== 'result';
  }

  function updateVoiceUi() {
    ui.micBtn.hidden = !voiceAvailable;
    ui.lang.hidden = !voiceAvailable;
  }

  function renderCatalog(items) {
    ui.catalog.innerHTML = '';
    if (!items.length) {
      ui.catalog.innerHTML = '<p class="empty">Ничего не найдено. Попробуйте другой запрос.</p>';
      return;
    }
    items.forEach(function (item) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'item' + (selectedItem && selectedItem.id === item.id ? ' selected' : '');
      b.innerHTML = '<strong>' + item.name + '</strong><span>' + fmtDims(item) + ' · ' + fmtPrice(item.price) + '</span>';
      b.addEventListener('click', function () {
        lastMethod = 'catalog';
        chooseItem(item);
        renderCatalog(items);
      });
      ui.catalog.appendChild(b);
    });
  }

  function chooseItem(item) {
    selectedItem = item;
    placer().setItem(item);
    hint('Выбрано: ' + item.name + '. Наведите прицел на пол и коснитесь экрана.');
  }

  function runSearch(text, method) {
    const f = VoiceSearch.parseQuery(text);
    if (!f.category && !f.color && !f.maxWidth) {
      hint('Не понял запрос. Назовите тип мебели: диван, шкаф, стол, стул, кровать.');
      return;
    }
    let items = VoiceSearch.search(f, window.CATALOG);
    let relaxed = false;
    if (!items.length && f.color) {
      items = VoiceSearch.search({ category: f.category, color: null, maxWidth: f.maxWidth }, window.CATALOG);
      relaxed = items.length > 0;
    }
    lastMethod = method;
    if (items.length) chooseItem(items[0]);
    renderCatalog(items);
    if (!items.length) hint('Ничего не найдено. Попробуйте другой размер или тип.');
    else if (relaxed) hint('Такого цвета нет, показываю другие цвета. ' + ui.hint.textContent);
  }

  function voiceErrorText(err) {
    switch (err) {
      case 'not-allowed':
      case 'service-not-allowed': return 'Микрофон запрещён. Ищите текстом или в каталоге.';
      case 'no-speech': return 'Не слышно речи. Попробуйте ещё раз или введите текстом.';
      case 'network': return 'Нет сети для распознавания речи. Ищите текстом или в каталоге.';
      case 'audio-capture': return 'Микрофон недоступен. Ищите текстом или в каталоге.';
      case 'unsupported': return 'Голосовой поиск не поддерживается. Ищите текстом или в каталоге.';
      default: return 'Не удалось распознать речь. Ищите текстом или в каталоге.';
    }
  }

  ui.micBtn.addEventListener('click', function () {
    if (listening) return;
    listening = true;
    ui.micBtn.classList.add('listening');
    ui.micBtn.textContent = '● Слушаю…';
    hint('Говорите, например: «белый шкаф до полутора метров».');

    VoiceSearch.listen({
      lang: ui.lang.value,
      onResult: function (text) {
        ui.transcript.textContent = 'Вы сказали: «' + text + '»';
        runSearch(text, 'voice');
      },
      onError: function (err) {
        hint(voiceErrorText(err));
        if (['not-allowed', 'service-not-allowed', 'unsupported', 'audio-capture'].includes(err)) {
          voiceAvailable = false;
          updateVoiceUi();
        }
      },
      onEnd: function () {
        listening = false;
        ui.micBtn.classList.remove('listening');
        ui.micBtn.textContent = '🎤 Голосом';
      }
    });
  });

  ui.searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const text = ui.searchInput.value.trim();
    if (!text) { renderCatalog(window.CATALOG); return; }
    ui.transcript.textContent = '';
    ui.searchInput.blur();
    runSearch(text, 'text');
  });

  ui.rotLeft.addEventListener('click', function () { placer().rotateBy(15); });
  ui.rotRight.addEventListener('click', function () { placer().rotateBy(-15); });

  ui.doorsBtn.addEventListener('click', function () {
    const open = placer().toggleDoors();
    if (open === null) return;
    ui.doorsBtn.textContent = open ? 'Закрыть дверцы' : 'Открыть дверцы';
  });

  scene.addEventListener('surface-found', function () {
    hint(selectedItem
      ? 'Пол найден. Коснитесь экрана, чтобы поставить: ' + selectedItem.name + '.'
      : 'Пол найден. Выберите товар голосом, поиском или в каталоге.');
  });

  scene.addEventListener('placer-message', function (e) { hint(e.detail.text); });

  scene.addEventListener('item-placed', function (e) {
    placedItem = e.detail.item;
    if (taskStart && taskSeconds === null) taskSeconds = (performance.now() - taskStart) / 1000;
    ui.rotLeft.disabled = false;
    ui.rotRight.disabled = false;
    ui.doneBtn.disabled = false;
    ui.doorsBtn.disabled = !placedItem.animated;
    ui.doorsBtn.textContent = 'Открыть дверцы';
    hint('Поставлено. Коснитесь пола ещё раз, чтобы передвинуть. Поворачивайте кнопками.');
  });

  scene.addEventListener('item-moved', function () { hint('Передвинуто.'); });

  ui.doneBtn.addEventListener('click', function () {
    if (!placedItem) { hint('Сначала поставьте товар.'); return; }
    const item = placedItem;
    ui.resultInfo.innerHTML =
      '<p><strong>' + item.name + '</strong></p>' +
      '<p>Размер (Ш×Г×В): ' + fmtDims(item) + '</p>' +
      '<p>Цена: ' + fmtPrice(item.price) + '</p>';
    ui.spaceInput.value = '';
    ui.fitMsg.textContent = '';
    ui.fitMsg.className = 'fit';
    ui.sendMsg.textContent = '';

    const methodNames = { voice: 'голос', text: 'текстовый поиск', catalog: 'каталог' };
    const fps = fpsMeter().summary();
    ui.stats.textContent =
      (taskSeconds !== null ? 'Время до размещения: ' + taskSeconds.toFixed(1) + ' с' : '') +
      (lastMethod ? ' · способ: ' + methodNames[lastMethod] : '') +
      (fps ? ' · FPS средн. ' + Math.round(fps.avg) + ', мин. ' + Math.round(fps.min) : '');

    showState('result');
    hint('Проверьте, поместится ли товар.');
  });

  ui.spaceInput.addEventListener('input', function () {
    const space = parseFloat(ui.spaceInput.value);
    if (!placedItem || !space) { ui.fitMsg.textContent = ''; return; }
    const diff = Math.round(space - placedItem.width * 100);
    if (diff >= 0) {
      ui.fitMsg.textContent = '✔ Помещается — останется ' + diff + ' см.';
      ui.fitMsg.className = 'fit ok';
    } else {
      ui.fitMsg.textContent = '✖ Не помещается — не хватает ' + Math.abs(diff) + ' см.';
      ui.fitMsg.className = 'fit bad';
    }
  });

  ui.sendBtn.addEventListener('click', function () {
    ui.sendMsg.textContent = 'Демо: заявка сформирована, но никуда не отправлена и не сохранена.';
  });

  ui.backBtn.addEventListener('click', function () {
    showState('place');
    hint('Коснитесь пола, чтобы передвинуть, или выберите другой товар.');
  });

  ui.exitBtn.addEventListener('click', function () { scene.exitVR(); });

  document.querySelectorAll('#ar-ui .panel').forEach(function (panel) {
    panel.addEventListener('beforexrselect', function (e) { e.preventDefault(); });
  });

  checkSupport();
})();