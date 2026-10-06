/* =========================================================
   M3a: CORE ENGINE
   - строит игровой DOM внутри #tb-app-root
   - загружает payload с /case-1-data через localStorage/postMessage
   - инициализирует состояние
   - рендерит брифинг
   ========================================================= */

(function () {
  var TB = window.TB_ENGINE = window.TB_ENGINE || {};

  if (TB.m3aLoaded) return;
  TB.m3aLoaded = true;

  var match = window.location.pathname.match(/\/(case-\d+)/);
  TB.caseId = match ? match[1] : 'case-1';
  TB.payloadKey = 'tbd_case_payload_' + TB.caseId;
  TB.errorsKey = 'tbd_case_errors_' + TB.caseId;

  TB.loaded = false;
  TB.booted = false;
  TB.shellBuilt = false;
  TB.staticListenersBound = false;
  TB.messageListenerBound = false;

  TB.payload = null;
  TB.data = null;
  TB.ev = null;
  TB.state = null;
  TB.timerInterval = null;

  /* =========================
     DOM HELPERS
     ========================= */

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, value) {
    var el = $(id);
    if (el) el.innerHTML = value == null ? '' : String(value);
  }

  function getVal(id) {
    var el = $(id);
    return el ? el.value : '';
  }

  function show(id, display) {
    var el = $(id);
    if (el) el.style.display = display || 'block';
  }

  function hide(id) {
    var el = $(id);
    if (el) el.style.display = 'none';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function forEachNode(list, fn) {
    Array.prototype.forEach.call(list || [], fn);
  }

  TB.$ = $;
  TB.setText = setText;
  TB.setHtml = setHtml;
  TB.getVal = getVal;
  TB.show = show;
  TB.hide = hide;
  TB.escapeHtml = escapeHtml;
  TB.forEachNode = forEachNode;

  /* =========================
     SHELL
     ========================= */

  TB.buildShell = function () {
    var root = $('tb-app-root');

    if (!root) {
      root = document.createElement('div');
      root.id = 'tb-app-root';
      document.body.appendChild(root);
    }

    if (TB.shellBuilt) return true;

    root.innerHTML = `
<section class="tb-game-wrapper" id="tb-game-root">

  <div class="tb-briefing-screen" id="briefing-screen" style="display:none;">
    <div class="tb-briefing-container">
      <a href="/cases" class="tb-briefing-back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 10H5M5 10L10 5M5 10L10 15" stroke="#333333" stroke-width="2" stroke-linecap="square"/></svg>
        К БИБЛИОТЕКЕ КЕЙСОВ
      </a>

      <div class="tb-briefing-header">
        <h1 class="tb-briefing-title" id="b-title">Загрузка кейса...</h1>
        <div class="tb-briefing-badges">
          <span class="tb-badge" id="b-industry">ИНДУСТРИЯ</span>
          <span class="tb-badge tb-badge-warning" id="b-difficulty">СЛОЖНОСТЬ</span>
        </div>
      </div>

      <div class="tb-briefing-grid">
        <div class="tb-briefing-col">
          <h3 class="tb-briefing-subtitle">КОНТЕКСТ ДЕЛА</h3>
          <p class="tb-briefing-text" id="b-context">...</p>

          <h3 class="tb-briefing-subtitle" style="margin-top:24px;">ЦЕЛИ РАССЛЕДОВАНИЯ</h3>
          <ul class="tb-briefing-list" id="b-objectives"></ul>
        </div>

        <div class="tb-briefing-col">
          <h3 class="tb-briefing-subtitle">ДОСТУПНЫЕ РЕСУРСЫ</h3>
          <div class="tb-resources-grid" id="b-resources"></div>

          <h3 class="tb-briefing-subtitle" style="margin-top:24px;">НАЧАЛЬНЫЕ СИГНАЛЫ</h3>
          <div class="tb-alerts-list" id="b-alerts"></div>
        </div>
      </div>

      <div class="tb-briefing-footer">
        <button class="tb-btn-primary" id="btn-start" type="button">НАЧАТЬ РАССЛЕДОВАНИЕ</button>
        <p class="tb-hint">
          Таймер запустится автоматически. Доступно ограниченное число официальных запросов.
          Запросы могут отклоняться, если у вас недостаточно основания.
        </p>
      </div>
    </div>
  </div>

  <div class="tb-workspace-screen" id="workspace-screen" style="display:none;">
    <header class="tb-top-bar">
      <button class="tb-mobile-menu-toggle" id="btn-mobile-menu" type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>

      <div class="tb-top-bar-title">
        <h2 id="w-title">КЕЙС</h2>
        <span class="tb-phase-badge" id="w-phase">СБОР ИНФОРМАЦИИ</span>
      </div>

      <div class="tb-top-bar-controls">
        <div class="tb-top-resource" id="w-request-budget">Запросов: 6</div>
        <div class="tb-timer" id="w-timer">00:00:00</div>

        <button class="tb-btn-secondary" id="btn-pause" type="button">ПАУЗА</button>
        <button class="tb-btn-danger" id="btn-finish" type="button">ЗАВЕРШИТЬ</button>
      </div>
    </header>

    <div class="tb-workspace-layout">
      <aside class="tb-sidebar" id="sidebar">
        <div class="tb-sidebar-group">
          <div class="tb-sidebar-group-title">МАТЕРИАЛЫ ДЕЛА</div>

          <button class="tb-nav-btn active" type="button" data-section="overview"><span>Обзор дела</span></button>
          <button class="tb-nav-btn" type="button" data-section="documents"><span>Документы</span><span class="tb-nav-counter" id="c-docs">0</span></button>
          <button class="tb-nav-btn" type="button" data-section="transactions"><span>Транзакции</span><span class="tb-nav-counter" id="c-trans">0</span></button>
          <button class="tb-nav-btn" type="button" data-section="graph"><span>Граф связей</span></button>
        </div>

        <div class="tb-sidebar-group">
          <div class="tb-sidebar-group-title">ВЗАИМОДЕЙСТВИЕ</div>
          <button class="tb-nav-btn" type="button" data-section="requests"><span>Запросы</span><span class="tb-nav-counter" id="c-req">0/6</span></button>
        </div>

        <div class="tb-sidebar-group">
          <div class="tb-sidebar-group-title">АНАЛИТИКА</div>

          <button class="tb-nav-btn" type="button" data-section="hypotheses"><span>Гипотезы</span><span class="tb-nav-counter" id="c-hyp">0</span></button>
          <button class="tb-nav-btn" type="button" data-section="evidence"><span>Доказательства</span><span class="tb-nav-counter" id="c-ev">0</span></button>
          <button class="tb-nav-btn" type="button" data-section="interviews"><span>Интервью</span><span class="tb-nav-counter" id="c-int">0/3</span></button>
        </div>

        <div class="tb-sidebar-group">
          <div class="tb-sidebar-group-title">РЕЗУЛЬТАТ</div>

          <button class="tb-nav-btn" type="button" data-section="controls"><span>Контроли</span></button>
          <button class="tb-nav-btn" type="button" data-section="report"><span>Финальный отчет</span></button>
        </div>

        <div class="tb-sidebar-progress">
          <div class="tb-progress-header">
            <span>ПРОГРЕСС</span>
            <span id="progress-text">0%</span>
          </div>
          <div class="tb-progress-track">
            <div class="tb-progress-fill" id="progress-bar" style="width:0%"></div>
          </div>
        </div>
      </aside>

      <main class="tb-main-content">
        <div class="tb-section active" id="sec-overview">
          <div class="tb-section-header">
            <h2>ПАНЕЛЬ УПРАВЛЕНИЯ РАССЛЕДОВАНИЕМ</h2>
            <p>Ключевые метрики, аномалии и направление проверки</p>
          </div>

          <div class="tb-metrics-grid" id="render-metrics"></div>

          <div class="tb-overview-split">
            <div class="tb-card">
              <h3>СУТЬ АНОМАЛИИ</h3>
              <p id="render-context-short" class="tb-text-muted"></p>
            </div>

            <div class="tb-card tb-card-warning">
              <h3>ТРЕБУЕТ ВНИМАНИЯ</h3>
              <ul class="tb-check-list" id="render-alerts-short"></ul>
            </div>
          </div>
        </div>

        <div class="tb-section" id="sec-documents">
          <div class="tb-section-header">
            <h2>ДОКУМЕНТАЛЬНАЯ БАЗА</h2>
            <p>Не все документы доступны изначально. Часть открывается через официальные запросы.</p>
          </div>

          <div class="tb-docs-toolbar">
            <input type="text" class="tb-input" id="doc-search" placeholder="Поиск по названию, типу, контрагенту, номеру...">
            <select class="tb-select" id="doc-filter">
              <option value="all">Все документы</option>
              <option value="available">Доступные</option>
              <option value="hidden">Скрытые / запрошенные</option>
            </select>
          </div>

          <div class="tb-docs-grid" id="render-docs"></div>
        </div>

        <div class="tb-section" id="sec-transactions">
          <div class="tb-section-header">
            <h2>ЖУРНАЛ ПЛАТЕЖЕЙ И РАСЧЕТОВ</h2>
            <p>Большой массив данных. Ищите повторяющиеся реквизиты, аномальные сроки, одинаковые контейнеры и платежи без приемки.</p>
          </div>

          <div class="tb-table-controls">
            <input type="text" class="tb-input" id="txn-search" placeholder="Поиск по получателю, счету, сумме, комментарию...">
            <select class="tb-select" id="txn-filter">
              <option value="all">Все операции</option>
              <option value="vendor">Prime Link Logistics</option>
              <option value="large">Суммы от 10 млн ₽</option>
              <option value="fast">Оплачено за 1–3 дня</option>
              <option value="no_grn">Без подтвержденной приемки</option>
            </select>
          </div>

          <div class="tb-table-wrapper" id="render-transactions"></div>
        </div>

        <div class="tb-section" id="sec-graph">
          <div class="tb-section-header">
            <h2>ГРАФ СВЯЗЕЙ</h2>
            <p>Схема формируется по мере сбора доказательств и ответов на запросы</p>
          </div>

          <div class="tb-graph-container" id="render-graph"></div>
        </div>

        <div class="tb-section" id="sec-requests">
          <div class="tb-section-header">
            <h2>ОФИЦИАЛЬНЫЕ ЗАПРОСЫ</h2>
            <p>Запросы открывают скрытые данные, но могут отклоняться. Каждый запрос тратит время и лимит обращений.</p>
          </div>

          <div class="tb-request-summary">
            <div class="tb-request-summary-item"><span>Использовано</span><strong id="req-used">0</strong></div>
            <div class="tb-request-summary-item"><span>Осталось</span><strong id="req-left">6</strong></div>
            <div class="tb-request-summary-item"><span>Одобрено</span><strong id="req-approved">0</strong></div>
            <div class="tb-request-summary-item"><span>Отклонено</span><strong id="req-rejected">0</strong></div>
          </div>

          <div class="tb-requests-board" id="render-requests"></div>

          <div class="tb-request-history">
            <h3>ЖУРНАЛ ЗАПРОСОВ</h3>
            <div id="request-log" class="tb-request-log"></div>
          </div>
        </div>

        <div class="tb-section" id="sec-interviews">
          <div class="tb-section-header">
            <h2>ИНТЕРВЬЮ</h2>
            <p>Доступно 3 интервью. Некоторые вопросы откроются только после получения ответов на запросы.</p>
          </div>

          <div class="tb-interviews-grid" id="render-interviews"></div>
        </div>

        <div class="tb-section" id="sec-hypotheses">
          <div class="tb-section-header">
            <h2>РАБОЧИЕ ГИПОТЕЗЫ</h2>
            <p>Выберите версию и соберите достаточный вес доказательств. Система будет искать альтернативные объяснения.</p>
          </div>

          <div class="tb-hypotheses-list" id="render-hypotheses"></div>
          <div class="tb-devils-advocate" id="render-devils-advocate"></div>
        </div>

        <div class="tb-section" id="sec-evidence">
          <div class="tb-section-header">
            <h2>ДОСКА ДОКАЗАТЕЛЬСТВ</h2>
            <p>Все собранные улики, их источник, надежность и вес</p>
          </div>

          <div class="tb-evidence-board" id="render-evidence"></div>
        </div>

        <div class="tb-section" id="sec-controls">
          <div class="tb-section-header">
            <h2>ПРОЕКТИРОВАНИЕ КОНТРОЛЕЙ</h2>
            <p>Выберите меры, которые предотвратят повторение схемы. Часть решений будет несоразмерной или опасной.</p>
          </div>

          <div class="tb-controls-list" id="render-controls"></div>
        </div>

        <div class="tb-section" id="sec-report">
          <div class="tb-section-header">
            <h2>ФИНАЛЬНЫЙ ОТЧЕТ</h2>
            <p>Сформулируйте вывод и подведите итоги расследования</p>
          </div>

          <div class="tb-report-box">
            <h3>ВЫВОД АУДИТОРА</h3>

            <label class="tb-radio-option">
              <input type="radio" name="conclusion" value="fraud">
              <span>Доказать схему фантомной логистики и эскалировать в службу безопасности / комплаенс</span>
            </label>

            <label class="tb-radio-option">
              <input type="radio" name="conclusion" value="error">
              <span>Оформить как ошибку учета, дублирование документов или сбой процесса</span>
            </label>

            <label class="tb-radio-option">
              <input type="radio" name="conclusion" value="insufficient">
              <span>Признать недостаточность доказательств и запросить дополнительные процедуры</span>
            </label>

            <button class="tb-btn-primary" id="btn-submit-report" type="button">ПОДВЕСТИ ИТОГИ</button>
          </div>
        </div>
      </main>
    </div>
  </div>

  <div class="tb-modal-overlay" id="modal-overlay">
    <div class="tb-modal" id="modal-box">
      <button class="tb-modal-close" id="modal-close" type="button">×</button>
      <div id="modal-content"></div>
    </div>
  </div>

  <div class="tb-toast" id="toast"></div>
</section>
`;

    TB.shellBuilt = true;
    return true;
  };

  /* =========================
     BASIC UI ACTIONS
     ========================= */

  TB.showToast = function (text) {
    var toast = $('toast');
    if (!toast) return;

    toast.textContent = text;
    toast.classList.add('show');

    clearTimeout(TB.toastTimer);
    TB.toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2400);
  };

  TB.openModal = function (content) {
    setHtml('modal-content', content);
    var overlay = $('modal-overlay');
    if (overlay) overlay.classList.add('open');
  };

  TB.closeModal = function () {
    var overlay = $('modal-overlay');
    if (overlay) overlay.classList.remove('open');
  };

  TB.switchSection = function (sectionId) {
    forEachNode(document.querySelectorAll('.tb-section'), function (section) {
      section.classList.remove('active');
    });

    var target = $('sec-' + sectionId);
    if (target) target.classList.add('active');
  };

  TB.activateNav = function (sectionId) {
    forEachNode(document.querySelectorAll('.tb-nav-btn'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-section') === sectionId);
    });
  };

  TB.toggleSidebar = function () {
    var sidebar = $('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  };

  TB.updateTimerDisplay = function () {
    if (!TB.state) return;

    var total = Math.max(0, TB.state.timeLeft);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;

    setText('w-timer',
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0')
    );
  };

  TB.startTimer = function () {
    if (!TB.state) return;

    TB.updateTimerDisplay();
    clearInterval(TB.timerInterval);

    TB.timerInterval = setInterval(function () {
      if (!TB.state || TB.state.isPaused) return;

      TB.state.timeLeft--;
      TB.updateTimerDisplay();

      if (TB.state.timeLeft <= 0) {
        clearInterval(TB.timerInterval);
        TB.openReportModal();
        TB.showToast('ВРЕМЯ ВЫШЛО');
      }
    }, 1000);
  };

  TB.togglePause = function () {
    if (!TB.state) return;

    TB.state.isPaused = !TB.state.isPaused;
    setText('btn-pause', TB.state.isPaused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА');
  };

  TB.openReportModal = function () {
    TB.switchSection('report');
    TB.activateNav('report');
    TB.showToast('ПЕРЕЙДИТЕ К ФИНАЛЬНОМУ ОТЧЕТУ');
  };

  TB.updateTopResources = function () {
    if (!TB.data || !TB.state) return;

    var max = TB.data.maxRequests || 6;
    var used = TB.state.requestsUsed || 0;
    var left = Math.max(0, max - used);

    setText('w-request-budget', 'Запросов: ' + left);
    setText('c-req', used + '/' + max);
  };

  TB.startGame = function () {
    if (!TB.data || !TB.state) {
      TB.showToast('ДАННЫЕ ЕЩЁ НЕ ЗАГРУЖЕНЫ');
      return;
    }

    hide('briefing-screen');
    show('workspace-screen', 'flex');

    setText('w-title', TB.data.title);
    TB.updateTopResources();
    TB.updateTimerDisplay();

    if (typeof TB.renderWorkspace === 'function') {
      TB.renderWorkspace();
    }

    if (typeof TB.updateProgress === 'function') {
      TB.updateProgress();
    }

    TB.startTimer();
  };

  /* =========================
     STATIC LISTENERS
     ========================= */

  TB.setupStaticListeners = function () {
    if (TB.staticListenersBound) return;
    TB.staticListenersBound = true;

    var btnStart = $('btn-start');
    if (btnStart) btnStart.addEventListener('click', TB.startGame);

    var btnMobile = $('btn-mobile-menu');
    if (btnMobile) btnMobile.addEventListener('click', TB.toggleSidebar);

    var btnPause = $('btn-pause');
    if (btnPause) btnPause.addEventListener('click', TB.togglePause);

    var btnFinish = $('btn-finish');
    if (btnFinish) btnFinish.addEventListener('click', TB.openReportModal);

    var btnSubmit = $('btn-submit-report');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', function () {
        if (typeof TB.submitFinalReport === 'function') {
          TB.submitFinalReport();
        } else {
          TB.showToast('ФИНАЛЬНЫЙ РАСЧЁТ БУДЕТ ДОСТУПЕН ПОСЛЕ M3D');
        }
      });
    }

    var modalClose = $('modal-close');
    if (modalClose) modalClose.addEventListener('click', TB.closeModal);

    var overlay = $('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) TB.closeModal();
      });
    }

    forEachNode(document.querySelectorAll('.tb-nav-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var section = btn.getAttribute('data-section');
        TB.switchSection(section);
        TB.activateNav(section);

        if (window.innerWidth <= 768) {
          var sidebar = $('sidebar');
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });

    var docSearch = $('doc-search');
    if (docSearch) {
      docSearch.addEventListener('input', function () {
        if (typeof TB.renderDocuments === 'function') TB.renderDocuments();
      });
    }

    var docFilter = $('doc-filter');
    if (docFilter) {
      docFilter.addEventListener('change', function () {
        if (typeof TB.renderDocuments === 'function') TB.renderDocuments();
      });
    }

    var txnSearch = $('txn-search');
    if (txnSearch) {
      txnSearch.addEventListener('input', function () {
        if (typeof TB.renderTransactions === 'function') TB.renderTransactions();
      });
    }

    var txnFilter = $('txn-filter');
    if (txnFilter) {
      txnFilter.addEventListener('change', function () {
        if (typeof TB.renderTransactions === 'function') TB.renderTransactions();
      });
    }
  };

  /* =========================
     ERROR STATES
     ========================= */

  TB.showLoadError = function (message) {
    var safe = escapeHtml(message);

    TB.openModal(
      '<h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:32px;margin:0 0 16px 0;color:#C62828;">ОШИБКА ЗАГРУЗКИ КЕЙСА</h2>' +
      '<div style="font-size:14px;line-height:1.6;color:#333;">' + safe + '</div>' +
      '<div style="margin-top:20px;"><button class="tb-btn-secondary" type="button" onclick="TB_ENGINE.closeModal()">ЗАКРЫТЬ</button></div>'
    );
  };

  TB.showValidationErrors = function (problems) {
    var list = Array.isArray(problems) ? problems : [String(problems || 'Неизвестная ошибка')];

    var html =
      '<h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:32px;margin:0 0 16px 0;color:#C62828;">ОШИБКИ ВАЛИДАЦИИ ДАННЫХ</h2>' +
      '<p style="font-size:14px;color:#555;margin:0 0 16px 0;">Страница <code>/case-1-data</code> собрала данные, но D9 нашёл проблемы. Исправьте блоки D0–D9 до запуска игры.</p>' +
      '<ul style="margin:0 0 0 18px;font-size:13px;color:#333;max-height:360px;overflow:auto;">' +
      list.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('') +
      '</ul>' +
      '<div style="margin-top:20px;"><button class="tb-btn-secondary" type="button" onclick="TB_ENGINE.closeModal()">ЗАКРЫТЬ</button></div>';

    TB.openModal(html);
  };

  /* =========================
     DATA LOADING
     ========================= */

  TB.readLocalStorage = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  TB.attachMessageListener = function () {
    if (TB.messageListenerBound) return;
    TB.messageListenerBound = true;

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.caseId && data.caseId !== TB.caseId) return;

      if (data.type === 'tbd-data-ready' && data.payload) {
        TB.onDataReady(data.payload);
      }

      if (data.type === 'tbd-data-error') {
        TB.showValidationErrors(data.problems || ['Ошибка без описания']);
      }
    });
  };

  TB.requestFromFrame = function () {
    var frame = $('tb-data-frame');
    if (!frame || !frame.contentWindow) return;

    try {
      frame.contentWindow.postMessage({
        type: 'tbd-data-request',
        caseId: TB.caseId
      }, '*');
    } catch (e) {}
  };

  TB.loadData = function () {
    if (TB.loaded) return;

    var raw = TB.readLocalStorage(TB.payloadKey);
    if (raw) {
      try {
        TB.onDataReady(JSON.parse(raw));
        return;
      } catch (e) {}
    }

    var errRaw = TB.readLocalStorage(TB.errorsKey);
    if (errRaw) {
      try {
        TB.showValidationErrors(JSON.parse(errRaw));
        return;
      } catch (e) {}
    }

    TB.attachMessageListener();

    var frame = $('tb-data-frame');
    if (frame) {
      frame.addEventListener('load', function () {
        TB.requestFromFrame();
      });
    }

    TB.requestFromFrame();
    setTimeout(TB.requestFromFrame, 300);
    setTimeout(TB.requestFromFrame, 1500);

    setTimeout(function () {
      if (!TB.loaded) {
        TB.showLoadError(
          'Не удалось загрузить данные кейса. Проверьте: ' +
          '1) страница /case-1-data опубликована; ' +
          '2) внизу /case-1-data горит зелёный статус D9; ' +
          '3) на /case-1 есть #tb-app-root и #tb-data-frame; ' +
          '4) localStorage содержит ключ tbd_case_payload_case-1.'
        );
      }
    }, 6000);
  };

  /* =========================
     GAME STATE
     ========================= */

  TB.initGameState = function () {
    var d = TB.data;

    TB.state = {
      timeLeft: (d.timeMinutes || 360) * 60,
      totalTime: (d.timeMinutes || 360) * 60,
      isPaused: false,

      evidence: {},
      hypotheses: [],
      selectedHypothesisId: null,
      refutedHypotheses: {},

      interviewsState: {},
      completedInterviews: 0,

      requests: {},
      requestsUsed: 0,
      requestsApproved: 0,
      requestsRejected: 0,
      requestLog: [],

      controlsSelected: {},
      progress: 0
    };

    Object.keys(d.interviews || {}).forEach(function (key) {
      TB.state.interviewsState[key] = {
        messages: [],
        currentNode: d.interviews[key].startNode,
        completed: false
      };
    });

    (d.requests || []).forEach(function (req) {
      TB.state.requests[req.id] = {
        status: 'idle',
        attempts: 0
      };
    });
  };

  /* =========================
     BRIEFING RENDER
     ========================= */

  TB.renderBriefing = function () {
    var d = TB.data;
    if (!d) return;

    setText('b-title', d.title);
    setText('b-industry', d.industry);
    setText('b-difficulty', d.difficulty);
    setText('b-context', d.context);

    setHtml('b-objectives', (d.objectives || []).map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join(''));

    setHtml('b-resources', (d.resources || []).map(function (r) {
      return '' +
        '<div class="tb-resource-box">' +
          '<div class="tb-resource-val">' + escapeHtml(r.val) + '</div>' +
          '<div class="tb-resource-lbl">' + escapeHtml(r.lbl) + '</div>' +
        '</div>';
    }).join(''));

    setHtml('b-alerts', (d.alerts || []).map(function (a) {
      return '' +
        '<div class="tb-alert-item">' +
          '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
            '<circle cx="10" cy="10" r="8" stroke="#FF9500" stroke-width="2"/>' +
            '<line x1="10" y1="6" x2="10" y2="11" stroke="#FF9500" stroke-width="2"/>' +
            '<circle cx="10" cy="14" r="1" fill="#FF9500"/>' +
          '</svg>' +
          '<span>' + escapeHtml(a) + '</span>' +
        '</div>';
    }).join(''));

    show('briefing-screen');
    hide('workspace-screen');
  };

  TB.onDataReady = function (payload) {
    if (TB.loaded) return;

    if (!payload || !payload.cases || !payload.cases[TB.caseId]) {
      TB.showLoadError('Payload загружен, но кейс ' + TB.caseId + ' в нём отсутствует.');
      return;
    }

    TB.loaded = true;
    TB.payload = payload;
    TB.data = payload.cases[TB.caseId];
    TB.ev = payload.ev || {};

    TB.initGameState();
    TB.renderBriefing();
    TB.updateTopResources();
  };

  /* =========================
     BOOT
     ========================= */

  TB.boot = function () {
    if (TB.booted) return;
    TB.booted = true;

    if (!TB.buildShell()) {
      return;
    }

    TB.setupStaticListeners();
    TB.loadData();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TB.boot);
  } else {
    TB.boot();
  }
})();

/* =========================================================
   M3b1: DOCUMENTS / EVIDENCE / OVERVIEW / BASIC STATE
   ========================================================= */

(function () {
  var TB = window.TB_ENGINE;

  if (!TB) return;
  if (TB.m3b1Loaded) return;

  TB.m3b1Loaded = true;

  TB.renderers = TB.renderers || {};

  /* =========================
     HELPERS
     ========================= */

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    if (TB.setText) return TB.setText(id, value);
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, value) {
    if (TB.setHtml) return TB.setHtml(id, value);
    var el = $(id);
    if (el) el.innerHTML = value == null ? '' : String(value);
  }

  function escapeHtml(value) {
    if (TB.escapeHtml) return TB.escapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function forEachNode(list, fn) {
    Array.prototype.forEach.call(list || [], fn);
  }

  /* =========================
     EVIDENCE CORE
     ========================= */

  function hasEvidence(id) {
    return !!(TB.state && TB.state.evidence && TB.state.evidence[id]);
  }

  function addEvidence(id, notify) {
    if (notify === undefined) notify = true;
    if (!TB.ev || !TB.ev[id]) return false;
    if (!TB.state) return false;
    if (TB.state.evidence[id]) return false;

    var data = TB.ev[id];

    TB.state.evidence[id] = {
      id: id,
      title: data.title,
      source: data.source,
      reliability: data.reliability,
      weight: data.weight,
      tags: data.tags || [],
      noise: !!data.noise
    };

    if (notify) TB.showToast('УЛИКА ДОБАВЛЕНА');

    refreshAfterEvidenceChange();
    return true;
  }

  function removeEvidence(id) {
    if (!TB.state || !TB.state.evidence[id]) return false;
    delete TB.state.evidence[id];
    TB.showToast('УЛИКА УДАЛЕНА');
    refreshAfterEvidenceChange();
    return true;
  }

  TB.hasEvidence = hasEvidence;
  TB.addEvidence = addEvidence;
  TB.removeEvidence = removeEvidence;

  /* =========================
     REQUEST / DOC AVAILABILITY
     ========================= */

  function getRequestById(id) {
    if (!TB.data || !TB.data.requests) return null;
    for (var i = 0; i < TB.data.requests.length; i++) {
      if (TB.data.requests[i].id === id) return TB.data.requests[i];
    }
    return null;
  }

  function isRequestApproved(requestId) {
    return !!(
      TB.state &&
      TB.state.requests &&
      TB.state.requests[requestId] &&
      TB.state.requests[requestId].status === 'approved'
    );
  }

  function isDocAvailable(doc) {
    if (!doc) return false;
    if (!doc.locked) return true;
    if (!doc.unlockedBy) return true;
    return isRequestApproved(doc.unlockedBy);
  }

  function getDocStatusLabel(doc) {
    if (!doc.locked) {
      return { cls: 'available', text: 'ДОСТУПЕН' };
    }

    if (isDocAvailable(doc)) {
      return { cls: 'unlocked', text: 'РАЗБЛОКИРОВАН' };
    }

    return { cls: 'hidden', text: 'СКРЫТ / НУЖЕН ЗАПРОС' };
  }

  TB.getRequestById = getRequestById;
  TB.isRequestApproved = isRequestApproved;
  TB.isDocAvailable = isDocAvailable;
  TB.getDocStatusLabel = getDocStatusLabel;

  /* =========================
     DOCUMENT FIELD STATES
     ========================= */

  function updateDocumentFieldStates() {
    forEachNode(document.querySelectorAll('.tb-ev-field'), function (btn) {
      var id = btn.getAttribute('data-ev');
      if (!id) return;

      if (hasEvidence(id)) {
        btn.classList.add('added');
      } else {
        btn.classList.remove('added');
      }
    });
  }

  TB.updateDocumentFieldStates = updateDocumentFieldStates;

  /* =========================
     RENDER OVERVIEW
     ========================= */

  function renderOverview() {
    if (!TB.data) return;

    var metrics = TB.data.metrics || [];

    setHtml('render-metrics', metrics.map(function (m) {
      return '' +
        '<div class="tb-metric-card ' + escapeHtml(m.type || '') + '">' +
          '<h4>' + escapeHtml(m.title) + '</h4>' +
          '<div class="tb-metric-val">' + escapeHtml(m.val) + '</div>' +
          '<div class="tb-metric-lbl">' + escapeHtml(m.lbl) + '</div>' +
        '</div>';
    }).join(''));

    setText('render-context-short', TB.data.context || '');

    setHtml('render-alerts-short', (TB.data.alerts || []).map(function (a) {
      return '<li>' + escapeHtml(a) + '</li>';
    }).join(''));
  }

  TB.renderers.overview = renderOverview;
  TB.renderOverview = renderOverview;

  /* =========================
     RENDER DOCUMENTS
     ========================= */

  function renderDocuments() {
    if (!TB.data || !TB.data.documents) return;

    var docs = TB.data.documents;
    var search = (($('doc-search') && $('doc-search').value) || '').toLowerCase();
    var filter = ($('doc-filter') && $('doc-filter').value) || 'all';

    var filtered = docs.filter(function (doc) {
      var available = isDocAvailable(doc);
      var haystack = [doc.type, doc.title, doc.meta].join(' ').toLowerCase();

      if (search && haystack.indexOf(search) === -1) return false;
      if (filter === 'available' && !available) return false;
      if (filter === 'hidden' && available) return false;

      return true;
    });

    if (!filtered.length) {
      setHtml('render-docs', '<div class="tb-empty-state">ДОКУМЕНТЫ НЕ НАЙДЕНЫ</div>');
      return;
    }

    setHtml('render-docs', filtered.map(function (doc) {
      var available = isDocAvailable(doc);
      var status = getDocStatusLabel(doc);
      var req = doc.unlockedBy ? getRequestById(doc.unlockedBy) : null;

      return '' +
        '<div class="tb-doc-card ' + (available ? '' : 'locked') + '" data-doc="' + escapeHtml(doc.id) + '" data-available="' + (available ? '1' : '0') + '">' +
          '<div class="tb-doc-type">' + escapeHtml(doc.type) + '</div>' +
          '<div class="tb-doc-name">' + escapeHtml(doc.title) + '</div>' +
          '<div class="tb-doc-meta">' + escapeHtml(doc.meta) + '</div>' +
          '<div class="tb-doc-status ' + status.cls + '">' + escapeHtml(status.text) + '</div>' +
          (!available && req ? '<div class="tb-doc-small">Требуется запрос: ' + escapeHtml(req.title) + '</div>' : '') +
        '</div>';
    }).join(''));
  }

  TB.renderers.documents = renderDocuments;
  TB.renderDocuments = renderDocuments;

  /* =========================
     OPEN DOCUMENT
     ========================= */

  function openDocument(docId) {
    if (!TB.data || !TB.data.documents) return;

    var doc = null;

    for (var i = 0; i < TB.data.documents.length; i++) {
      if (TB.data.documents[i].id === docId) {
        doc = TB.data.documents[i];
        break;
      }
    }

    if (!doc) return;

    if (!isDocAvailable(doc)) {
      var req = doc.unlockedBy ? getRequestById(doc.unlockedBy) : null;
      TB.showToast(req ? 'НУЖЕН ЗАПРОС: ' + req.title.toUpperCase() : 'ДОКУМЕНТ НЕДОСТУПЕН');
      return;
    }

    TB.openModal(doc.html);
    updateDocumentFieldStates();
  }

  TB.openDocument = openDocument;

  /* =========================
     RENDER EVIDENCE
     ========================= */

  function getReliabilityLabel(r) {
    if (r === 'high') return 'высокая';
    if (r === 'medium') return 'средняя';
    return 'низкая';
  }

  function renderEvidence() {
    var container = $('render-evidence');
    if (!container || !TB.state) return;

    var items = Object.keys(TB.state.evidence).map(function (id) {
      return TB.state.evidence[id];
    });

    if (!items.length) {
      container.innerHTML = '<div class="tb-empty-state">ДОКАЗАТЕЛЬСТВ ПОКА НЕТ</div>';
      return;
    }

    container.innerHTML = items.map(function (ev) {
      return '' +
        '<div class="tb-evidence-item ' + escapeHtml(ev.reliability) + '">' +
          '<button class="tb-remove-btn" type="button" data-remove-ev="' + escapeHtml(ev.id) + '">УДАЛИТЬ</button>' +
          '<div class="tb-evidence-title">' + escapeHtml(ev.title) + '</div>' +
          '<div class="tb-evidence-meta">' +
            'Источник: ' + escapeHtml(ev.source) +
            ' • Надёжность: ' + escapeHtml(getReliabilityLabel(ev.reliability)) +
          '</div>' +
        '</div>';
    }).join('');
  }

  TB.renderers.evidence = renderEvidence;
  TB.renderEvidence = renderEvidence;

  /* =========================
     COUNTERS / PROGRESS
     ========================= */

  function updateCounters() {
    if (!TB.data || !TB.state) return;

    var docs = TB.data.documents || [];
    var availableDocs = docs.filter(isDocAvailable).length;

    setText('c-docs', String(availableDocs));
    setText('c-trans', String((TB.data.transactions || []).length));
    setText('c-ev', String(Object.keys(TB.state.evidence).length));
    setText('c-hyp', String(TB.state.hypotheses ? TB.state.hypotheses.length : 0));
    setText('c-int', (TB.state.completedInterviews || 0) + '/' + (TB.data.maxInterviews || 3));

    if (TB.updateTopResources) TB.updateTopResources();
  }

  TB.updateCounters = updateCounters;

  function updateProgress() {
    if (!TB.state) return;

    var evidenceItems = Object.keys(TB.state.evidence).map(function (id) {
      return TB.state.evidence[id];
    });

    var signalEvidence = evidenceItems.filter(function (e) {
      return !e.noise;
    }).length;

    var noiseEvidence = evidenceItems.filter(function (e) {
      return e.noise;
    }).length;

    var hypCount = TB.state.hypotheses ? TB.state.hypotheses.length : 0;
    var intCount = TB.state.completedInterviews || 0;
    var reqCount = TB.state.requestsApproved || 0;
    var ctrlCount = TB.state.controlsSelected ? Object.keys(TB.state.controlsSelected).filter(function (k) {
      return TB.state.controlsSelected[k];
    }).length : 0;

    var raw =
      signalEvidence * 2 +
      hypCount * 4 +
      intCount * 5 +
      reqCount * 6 +
      ctrlCount * 1 -
      Math.min(10, noiseEvidence * 2);

    TB.state.progress = Math.max(0, Math.min(100, raw));

    setText('progress-text', TB.state.progress + '%');

    var bar = $('progress-bar');
    if (bar) bar.style.width = TB.state.progress + '%';
  }

  TB.updateProgress = updateProgress;

  function refreshAfterEvidenceChange() {
    if (TB.renderers.documents) TB.renderers.documents();
    if (TB.renderers.evidence) TB.renderers.evidence();
    if (TB.renderers.requests) TB.renderers.requests();
    if (TB.renderers.hypotheses) TB.renderers.hypotheses();
    if (TB.renderers.graph) TB.renderers.graph();
    if (TB.updateDocumentFieldStates) TB.updateDocumentFieldStates();
    if (TB.updateCounters) TB.updateCounters();
    if (TB.updateProgress) TB.updateProgress();
  }

  TB.refreshAfterEvidenceChange = refreshAfterEvidenceChange;

  /* =========================
     RENDER WORKSPACE
     ========================= */

  if (!TB.renderWorkspace) {
    TB.renderWorkspace = function () {
      var keys = Object.keys(TB.renderers);

      keys.forEach(function (key) {
        if (typeof TB.renderers[key] === 'function') {
          TB.renderers[key]();
        }
      });

      if (TB.updateCounters) TB.updateCounters();
      if (TB.updateProgress) TB.updateProgress();
    };
  }

  /* =========================
     EVENT DELEGATION
     ========================= */

  function setupDelegation() {
    if (TB.delegationBound) return;
    TB.delegationBound = true;

    document.addEventListener('click', function (event) {
      var docCard = event.target.closest('.tb-doc-card[data-doc]');
      if (docCard) {
        openDocument(docCard.getAttribute('data-doc'));
        return;
      }

      var openDocBtn = event.target.closest('[data-open-doc]');
      if (openDocBtn) {
        openDocument(openDocBtn.getAttribute('data-open-doc'));
        return;
      }

      var evField = event.target.closest('.tb-ev-field[data-ev]');
      if (evField) {
        var id = evField.getAttribute('data-ev');
        var added = addEvidence(id);
        if (!added) TB.showToast('УЖЕ В ДОКАЗАТЕЛЬСТВАХ');
        return;
      }

      var removeBtn = event.target.closest('[data-remove-ev]');
      if (removeBtn) {
        removeEvidence(removeBtn.getAttribute('data-remove-ev'));
        return;
      }
    });

    document.addEventListener('change', function (event) {
      var control = event.target.closest('[data-control]');
      if (control && TB.state) {
        TB.state.controlsSelected = TB.state.controlsSelected || {};
        TB.state.controlsSelected[control.getAttribute('data-control')] = control.checked;
        if (TB.updateProgress) TB.updateProgress();
      }
    });
  }

  TB.setupDelegation = setupDelegation;
  setupDelegation();

})();

/* =========================================================
   M3b2: TRANSACTIONS / OFFICIAL REQUESTS
   ========================================================= */

(function () {
  var TB = window.TB_ENGINE;

  if (!TB) return;
  if (TB.m3b2Loaded) return;

  TB.m3b2Loaded = true;

  TB.renderers = TB.renderers || {};

  /* =========================
     LOCAL HELPERS
     ========================= */

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    if (TB.setText) return TB.setText(id, value);
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, value) {
    if (TB.setHtml) return TB.setHtml(id, value);
    var el = $(id);
    if (el) el.innerHTML = value == null ? '' : String(value);
  }

  function escapeHtml(value) {
    if (TB.escapeHtml) return TB.escapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  function parseAmount(value) {
    var digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  function parseDays(value) {
    var match = String(value || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  function formatElapsed(seconds) {
    var total = Math.max(0, seconds || 0);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;

    return String(h).padStart(2, '0') + ':' +
           String(m).padStart(2, '0') + ':' +
           String(s).padStart(2, '0');
  }

  function getElapsedTime() {
    if (!TB.state) return 0;
    return Math.max(0, (TB.state.totalTime || 0) - (TB.state.timeLeft || 0));
  }

  /* =========================
     TIME SPENDING
     ========================= */

  TB.spendTime = function (minutes) {
    if (!TB.state) return;

    TB.state.timeLeft = Math.max(0, TB.state.timeLeft - (minutes || 0) * 60);

    if (TB.updateTimerDisplay) TB.updateTimerDisplay();

    if (TB.state.timeLeft <= 0) {
      clearInterval(TB.timerInterval);
      if (TB.openReportModal) TB.openReportModal();
      TB.showToast('ВРЕМЯ ВЫШЛО');
    }
  };

  /* =========================
     REQUEST LOG
     ========================= */

  function addRequestLog(status, text) {
    if (!TB.state) return;

    TB.state.requestLog = TB.state.requestLog || [];

    TB.state.requestLog.push({
      status: status,
      time: formatElapsed(getElapsedTime()),
      text: text
    });
  }

  TB.addRequestLog = addRequestLog;

  /* =========================
     TRANSACTION RENDERING
     ========================= */

  function isDuplicateSuspiciousContainer(row) {
    if (!row || !row.container || row.container === '—') return false;

    var count = 0;

    (TB.data.transactions || []).forEach(function (t) {
      if (t.grn === 'Нет' && t.container === row.container) {
        count++;
      }
    });

    return count > 1;
  }

  function isDuplicateSuspiciousTracking(row) {
    if (!row || !row.tracking || row.tracking === '—') return false;

    var count = 0;

    (TB.data.transactions || []).forEach(function (t) {
      if (t.grn === 'Нет' && t.tracking === row.tracking) {
        count++;
      }
    });

    return count > 1;
  }

  function renderTransactions() {
    if (!TB.data || !TB.data.transactions) return;

    var rows = TB.data.transactions;
    var searchEl = $('txn-search');
    var filterEl = $('txn-filter');

    var search = ((searchEl && searchEl.value) || '').toLowerCase();
    var filter = (filterEl && filterEl.value) || 'all';

    var filtered = rows.filter(function (row) {
      var haystack = [
        row.date,
        row.payee,
        row.amount,
        row.invoice,
        row.container,
        row.tracking,
        row.terms,
        row.grn,
        row.note
      ].join(' ').toLowerCase();

      var amount = parseAmount(row.amount);
      var days = parseDays(row.terms);

      if (search && haystack.indexOf(search) === -1) return false;

      if (filter === 'vendor' && String(row.payee).indexOf('Prime Link') === -1) return false;
      if (filter === 'large' && amount < 10000000) return false;
      if (filter === 'fast' && days > 3) return false;
      if (filter === 'no_grn' && row.grn !== 'Нет') return false;

      return true;
    });

    var html = '' +
      '<table class="tb-data-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Дата</th>' +
            '<th>Получатель</th>' +
            '<th>Сумма</th>' +
            '<th>Инвойс</th>' +
            '<th>Контейнер</th>' +
            '<th>Трек</th>' +
            '<th>Срок</th>' +
            '<th>GRN</th>' +
            '<th>Действие</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>';

    if (!filtered.length) {
      html += '<tr><td colspan="9" style="text-align:center;color:#888;padding:24px;">ОПЕРАЦИИ НЕ НАЙДЕНЫ</td></tr>';
    }

    filtered.forEach(function (row) {
      html += '' +
        '<tr>' +
          '<td>' + escapeHtml(row.date) + '</td>' +
          '<td><strong>' + escapeHtml(row.payee) + '</strong></td>' +
          '<td>' + escapeHtml(row.amount) + '</td>' +
          '<td>' + escapeHtml(row.invoice) + '</td>' +
          '<td>' + escapeHtml(row.container) + '</td>' +
          '<td>' + escapeHtml(row.tracking) + '</td>' +
          '<td>' + escapeHtml(row.terms) + '</td>' +
          '<td>' + escapeHtml(row.grn) + '</td>' +
          '<td><button class="tb-btn-mini" type="button" data-txn="' + escapeHtml(row.id) + '">В улики</button></td>' +
        '</tr>';
    });

    html += '</tbody></table>';

    setHtml('render-transactions', html);
  }

  TB.renderers.transactions = renderTransactions;
  TB.renderTransactions = renderTransactions;

  /* =========================
     ADD TRANSACTION AS EVIDENCE
     ========================= */

  function addTransactionEvidence(txnId) {
    if (!TB.data || !TB.data.transactions || !TB.state) return;

    var row = null;

    for (var i = 0; i < TB.data.transactions.length; i++) {
      if (TB.data.transactions[i].id === txnId) {
        row = TB.data.transactions[i];
        break;
      }
    }

    if (!row) return;

    var id = 'txn_' + row.id;

    if (TB.state.evidence[id]) {
      TB.showToast('ЭТА ОПЕРАЦИЯ УЖЕ В УЛИКАХ');
      return;
    }

    var days = parseDays(row.terms);
    var dupContainer = isDuplicateSuspiciousContainer(row);
    var dupTracking = isDuplicateSuspiciousTracking(row);
    var suspicious = row.grn === 'Нет' && days <= 3;

    var reliability = 'low';
    var weight = 2;

    if (suspicious) {
      reliability = 'medium';
      weight = 5;
    }

    if (suspicious && (dupContainer || dupTracking)) {
      weight = 8;
    }

    TB.state.evidence[id] = {
      id: id,
      title: 'Платёж: ' + row.payee + ', инвойс ' + row.invoice + ', ' + row.amount,
      source: 'Журнал платежей',
      reliability: reliability,
      weight: weight,
      tags: ['transaction'],
      noise: false
    };

    TB.showToast('ОПЕРАЦИЯ ДОБАВЛЕНА В УЛИКИ');

    if (TB.refreshAfterEvidenceChange) TB.refreshAfterEvidenceChange();
  }

  TB.addTransactionEvidence = addTransactionEvidence;

  /* =========================
     REQUEST REQUIREMENTS
     ========================= */

  function meetsRequestRequirements(req) {
    if (!req) return false;
    if (!TB.hasEvidence) return false;

    if (req.requires && req.requires.length) {
      for (var i = 0; i < req.requires.length; i++) {
        if (!TB.hasEvidence(req.requires[i])) return false;
      }
    }

    if (req.requiresAny && req.requiresAny.length) {
      var any = false;

      for (var j = 0; j < req.requiresAny.length; j++) {
        if (TB.hasEvidence(req.requiresAny[j])) {
          any = true;
          break;
        }
      }

      if (!any) return false;
    }

    return true;
  }

  TB.meetsRequestRequirements = meetsRequestRequirements;

  /* =========================
     RENDER REQUESTS
     ========================= */

  function getDocTitleById(docId) {
    if (!TB.data || !TB.data.documents) return docId;

    for (var i = 0; i < TB.data.documents.length; i++) {
      if (TB.data.documents[i].id === docId) {
        return TB.data.documents[i].title;
      }
    }

    return docId;
  }

  function renderRequests() {
    if (!TB.data || !TB.data.requests || !TB.state) return;

    var requests = TB.data.requests;
    var max = TB.data.maxRequests || 6;
    var used = TB.state.requestsUsed || 0;
    var left = Math.max(0, max - used);

    setText('req-used', String(used));
    setText('req-left', String(left));
    setText('req-approved', String(TB.state.requestsApproved || 0));
    setText('req-rejected', String(TB.state.requestsRejected || 0));

    if (TB.updateTopResources) TB.updateTopResources();

    var boardHtml = requests.map(function (req) {
      var state = TB.state.requests[req.id] || { status: 'idle', attempts: 0 };
      var approved = state.status === 'approved';
      var rejected = state.status === 'rejected';
      var canSend = !approved && left > 0;
      var requirementsMet = meetsRequestRequirements(req);

      var requiresHtml = (req.requires || []).map(function (evId) {
        var done = TB.hasEvidence && TB.hasEvidence(evId);
        var title = TB.ev && TB.ev[evId] ? TB.ev[evId].title : evId;
        return '<li class="' + (done ? 'done' : '') + '">' + escapeHtml(title) + '</li>';
      }).join('');

      var requiresAnyHtml = '';

      if (req.requiresAny && req.requiresAny.length) {
        var anyDone = false;

        req.requiresAny.forEach(function (evId) {
          if (TB.hasEvidence && TB.hasEvidence(evId)) anyDone = true;
        });

        requiresAnyHtml =
          '<div style="margin-top:10px;">' +
            '<strong style="font-size:12px;color:#666;">Достаточное основание (любое из)</strong>' +
            '<ul class="tb-checklist">' +
              req.requiresAny.map(function (evId) {
                var done = TB.hasEvidence && TB.hasEvidence(evId);
                var title = TB.ev && TB.ev[evId] ? TB.ev[evId].title : evId;
                return '<li class="' + (done ? 'done' : '') + '">' + escapeHtml(title) + '</li>';
              }).join('') +
            '</ul>' +
          '</div>';
      }

      var unlockTitles = (req.unlocks || []).map(function (docId) {
        return getDocTitleById(docId);
      }).join(' • ');

      var actionHtml = '';

      if (approved) {
        actionHtml = '<span class="tb-request-status approved">ОДОБРЕН</span>';
      } else if (rejected) {
        actionHtml =
          '<button class="tb-btn-secondary" type="button" data-request-send="' + escapeHtml(req.id) + '"' +
          (canSend ? '' : ' disabled') +
          '>ПОВТОРИТЬ ЗАПРОС</button>';
      } else {
        actionHtml =
          '<button class="tb-btn-secondary" type="button" data-request-send="' + escapeHtml(req.id) + '"' +
          (canSend ? '' : ' disabled') +
          '>ОТПРАВИТЬ ЗАПРОС</button>';
      }

      var unlockedDocsHtml = '';

      if (approved && req.unlocks && req.unlocks.length) {
        unlockedDocsHtml = req.unlocks.map(function (docId) {
          return '<button class="tb-btn-mini" type="button" data-open-doc="' + escapeHtml(docId) + '">Открыть: ' + escapeHtml(getDocTitleById(docId)) + '</button>';
        }).join('');
      }

      var cardClass = approved
        ? 'approved'
        : rejected
          ? 'rejected'
          : requirementsMet
            ? ''
            : 'locked';

      var statusClass = approved
        ? 'approved'
        : rejected
          ? 'rejected'
          : requirementsMet
            ? 'pending'
            : 'locked';

      var statusText = approved
        ? 'ОДОБРЕН'
        : rejected
          ? 'ОТКЛОНЁН'
          : requirementsMet
            ? 'ГОТОВ К ОТПРАВКЕ'
            : 'НЕТ ОСНОВАНИЯ';

      return '' +
        '<div class="tb-request-card ' + cardClass + '">' +
          '<div class="tb-request-head">' +
            '<div>' +
              '<div class="tb-request-title">' + escapeHtml(req.title) + '</div>' +
              '<div class="tb-request-target">' + escapeHtml(req.target) + '</div>' +
            '</div>' +
            '<div class="tb-request-status ' + statusClass + '">' + escapeHtml(statusText) + '</div>' +
          '</div>' +

          '<div class="tb-request-desc">' + escapeHtml(req.desc) + '</div>' +

          '<div class="tb-request-meta">' +
            '<span>Время: ' + escapeHtml(req.timeCost) + ' мин</span>' +
            '<span>Открывает: ' + escapeHtml(unlockTitles || '—') + '</span>' +
          '</div>' +

          '<div>' +
            '<strong style="font-size:12px;color:#666;">Обязательное основание</strong>' +
            '<ul class="tb-checklist">' +
              (requiresHtml || '<li>Не требуется</li>') +
            '</ul>' +
            requiresAnyHtml +
          '</div>' +

          (req.hint ? '<div class="tb-doc-small" style="color:#666;">' + escapeHtml(req.hint) + '</div>' : '') +

          '<div class="tb-request-actions">' +
            actionHtml +
            unlockedDocsHtml +
          '</div>' +
        '</div>';
    }).join('');

    setHtml('render-requests', boardHtml);

    var log = TB.state.requestLog || [];

    var logHtml = log.slice().reverse().map(function (entry) {
      return '' +
        '<div class="tb-request-log-item ' + escapeHtml(entry.status) + '">' +
          '<strong>' + escapeHtml(entry.time) + '</strong> · ' + escapeHtml(entry.text) +
        '</div>';
    }).join('');

    setHtml('request-log', logHtml || '<div class="tb-request-log-item">Журнал пуст.</div>');
  }

  TB.renderers.requests = renderRequests;
  TB.renderRequests = renderRequests;

  /* =========================
     SEND REQUEST
     ========================= */

  function sendRequest(requestId) {
    if (!TB.data || !TB.data.requests || !TB.state) return;

    var req = null;

    for (var i = 0; i < TB.data.requests.length; i++) {
      if (TB.data.requests[i].id === requestId) {
        req = TB.data.requests[i];
        break;
      }
    }

    if (!req) return;

    var state = TB.state.requests[requestId];

    if (!state) {
      state = { status: 'idle', attempts: 0 };
      TB.state.requests[requestId] = state;
    }

    if (state.status === 'approved') {
      TB.showToast('ЗАПРОС УЖЕ ОДОБРЕН');
      return;
    }

    var max = TB.data.maxRequests || 6;
    var used = TB.state.requestsUsed || 0;

    if (!meetsRequestRequirements(req)) {
      state.status = 'rejected';
      state.attempts = (state.attempts || 0) + 1;

      TB.state.requestsRejected = (TB.state.requestsRejected || 0) + 1;

      TB.spendTime(10);

      addRequestLog('rejected', 'Запрос отклонён: ' + req.title + '. ' + req.reject);

      TB.showToast('ЗАПРОС ОТКЛОНЁН');

      renderRequests();
      if (TB.updateTopResources) TB.updateTopResources();
      if (TB.updateCounters) TB.updateCounters();
      if (TB.updateProgress) TB.updateProgress();

      return;
    }

    if (used >= max) {
      TB.showToast('ЛИМИТ ЗАПРОСОВ ИСЧЕРПАН');
      return;
    }

    state.status = 'approved';
    state.attempts = (state.attempts || 0) + 1;

    TB.state.requestsUsed = (TB.state.requestsUsed || 0) + 1;
    TB.state.requestsApproved = (TB.state.requestsApproved || 0) + 1;

    TB.spendTime(req.timeCost || 0);

    addRequestLog('approved', 'Запрос одобрен: ' + req.title + '. ' + req.success);

    TB.showToast('ЗАПРОС ОДОБРЕН');

    renderRequests();

    if (TB.renderers.documents) TB.renderers.documents();
    if (TB.updateDocumentFieldStates) TB.updateDocumentFieldStates();
    if (TB.updateCounters) TB.updateCounters();
    if (TB.updateTopResources) TB.updateTopResources();
    if (TB.updateProgress) TB.updateProgress();
  }

  TB.sendRequest = sendRequest;

  /* =========================
     DELEGATION FOR M3b2
     ========================= */

  document.addEventListener('click', function (event) {
    var txnBtn = event.target.closest('[data-txn]');
    if (txnBtn) {
      addTransactionEvidence(txnBtn.getAttribute('data-txn'));
      return;
    }

    var requestBtn = event.target.closest('[data-request-send]');
    if (requestBtn) {
      sendRequest(requestBtn.getAttribute('data-request-send'));
      return;
    }
  });

  /* =========================
     ENSURE WORKSPACE RERENDER INCLUDES NEW PARTS
     ========================= */

  if (TB.renderWorkspace) {
    var oldRenderWorkspace = TB.renderWorkspace;

    TB.renderWorkspace = function () {
      oldRenderWorkspace();

      if (TB.renderers.transactions) TB.renderers.transactions();
      if (TB.renderers.requests) TB.renderers.requests();

      if (TB.updateCounters) TB.updateCounters();
      if (TB.updateProgress) TB.updateProgress();
    };
  }

})();

/* =========================================================
   M3c1: INTERVIEWS
   ========================================================= */

(function () {
  var TB = window.TB_ENGINE;

  if (!TB) return;
  if (TB.m3c1Loaded) return;

  TB.m3c1Loaded = true;

  TB.renderers = TB.renderers || {};

  /* =========================
     LOCAL HELPERS
     ========================= */

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    if (TB.setText) return TB.setText(id, value);
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, value) {
    if (TB.setHtml) return TB.setHtml(id, value);
    var el = $(id);
    if (el) el.innerHTML = value == null ? '' : String(value);
  }

  function escapeHtml(value) {
    if (TB.escapeHtml) return TB.escapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch];
    });
  }

  var currentInterviewId = null;

  function getMaxInterviews() {
    return TB.data && TB.data.maxInterviews ? TB.data.maxInterviews : 3;
  }

  function isModalOpen() {
    var overlay = $('modal-overlay');
    return !!(overlay && overlay.classList.contains('open'));
  }

  function scrollChatToBottom() {
    var chat = $('interview-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  /* =========================
     CHOICE LOCKING
     ========================= */

  function isChoiceLocked(choice) {
    if (!choice) return false;
    if (!TB.hasEvidence) return false;

    if (choice.requiresAny && choice.requiresAny.length) {
      var any = false;

      for (var i = 0; i < choice.requiresAny.length; i++) {
        if (TB.hasEvidence(choice.requiresAny[i])) {
          any = true;
          break;
        }
      }

      return !any;
    }

    if (choice.requires) {
      return !TB.hasEvidence(choice.requires);
    }

    return false;
  }

  TB.isInterviewChoiceLocked = isChoiceLocked;

  /* =========================
     RENDER INTERVIEW CARDS
     ========================= */

  function renderInterviews() {
    if (!TB.data || !TB.data.interviews || !TB.state) return;

    var max = getMaxInterviews();
    var ids = Object.keys(TB.data.interviews);

    if (!ids.length) {
      setHtml('render-interviews', '<div class="tb-empty-state">ИНТЕРВЬЮ НЕ НАСТРОЕНЫ</div>');
      return;
    }

    var html = ids.map(function (id) {
      var iv = TB.data.interviews[id];
      var st = TB.state.interviewsState[id];

      if (!st) return '';

      var completedClass = st.completed ? 'completed' : '';
      var buttonText = st.completed ? 'ОТКРЫТЬ ПРОТОКОЛ' : 'НАЧАТЬ ИНТЕРВЬЮ';

      return '' +
        '<div class="tb-interview-card ' + completedClass + '">' +
          '<div class="tb-interview-top">' +
            '<div class="tb-avatar">' + escapeHtml(iv.initials || '??') + '</div>' +
            '<div>' +
              '<div class="tb-interview-name">' + escapeHtml(iv.name) + '</div>' +
              '<div class="tb-interview-role">' + escapeHtml(iv.role) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tb-interview-desc">' + escapeHtml(iv.desc) + '</div>' +
          '<button class="tb-btn-secondary" type="button" data-interview="' + escapeHtml(id) + '">' +
            escapeHtml(buttonText) +
          '</button>' +
        '</div>';
    }).join('');

    setHtml('render-interviews', html);
    setText('c-int', (TB.state.completedInterviews || 0) + '/' + max);
  }

  TB.renderers.interviews = renderInterviews;
  TB.renderInterviews = renderInterviews;

  /* =========================
     EVIDENCE FROM INTERVIEW NODES
     ========================= */

  function addInterviewEvidence(ids) {
    if (!ids || !ids.length || !TB.addEvidence) return;

    ids.forEach(function (id) {
      TB.addEvidence(id, false);
    });
  }

  /* =========================
     OPEN INTERVIEW
     ========================= */

  function openInterview(id) {
    if (!TB.data || !TB.data.interviews || !TB.state) return;

    var iv = TB.data.interviews[id];
    var st = TB.state.interviewsState[id];

    if (!iv || !st) return;

    if (!st.completed && (TB.state.completedInterviews || 0) >= getMaxInterviews()) {
      TB.showToast('ДОСТУПНО ТОЛЬКО ' + getMaxInterviews() + ' ИНТЕРВЬЮ');
      return;
    }

    if (!st.messages || !st.messages.length) {
      st.messages = [];

      var startNode = iv.nodes[iv.startNode];

      if (startNode) {
        st.messages.push({
          type: 'npc',
          text: startNode.text
        });

        addInterviewEvidence(startNode.add);
      }
    }

    currentInterviewId = id;
    renderInterviewModal(id);
  }

  TB.openInterview = openInterview;

  /* =========================
     RENDER INTERVIEW MODAL
     ========================= */

  function renderInterviewModal(id) {
    if (!TB.data || !TB.data.interviews || !TB.state) return;

    var iv = TB.data.interviews[id];
    var st = TB.state.interviewsState[id];

    if (!iv || !st) return;

    var node = iv.nodes[st.currentNode];

    var choicesHtml = '';

    if (!st.completed && node && node.choices && node.choices.length) {
      choicesHtml =
        '<div class="tb-choices">' +
          node.choices.map(function (choice, index) {
            var locked = isChoiceLocked(choice);
            var lockedClass = locked ? 'locked' : '';

            return '' +
              '<button class="tb-choice-btn ' + lockedClass + '" type="button" ' +
                'data-interview-choice="' + escapeHtml(id) + '" ' +
                'data-choice-index="' + index + '">' +
                escapeHtml(choice.text) +
              '</button>';
          }).join('') +
        '</div>';
    } else if (st.completed) {
      choicesHtml = '<div class="tb-msg success">Интервью завершено. Протокол сохранён.</div>';
    }

    var messagesHtml = (st.messages || []).map(function (msg) {
      return '<div class="tb-msg ' + escapeHtml(msg.type) + '">' + escapeHtml(msg.text) + '</div>';
    }).join('');

    var content = '' +
      '<div class="tb-interview-header">' +
        '<div class="tb-avatar">' + escapeHtml(iv.initials || '??') + '</div>' +
        '<div>' +
          '<div class="tb-interview-name">' + escapeHtml(iv.name) + '</div>' +
          '<div class="tb-interview-role">' + escapeHtml(iv.role) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tb-chat" id="interview-chat">' +
        messagesHtml +
      '</div>' +
      choicesHtml;

    TB.openModal(content);

    setTimeout(scrollChatToBottom, 0);
  }

  TB.renderInterviewModal = renderInterviewModal;

  /* =========================
     HANDLE CHOICE
     ========================= */

  function handleInterviewChoice(id, choiceIndex) {
    if (!TB.data || !TB.data.interviews || !TB.state) return;

    var iv = TB.data.interviews[id];
    var st = TB.state.interviewsState[id];

    if (!iv || !st) return;

    var node = iv.nodes[st.currentNode];

    if (!node || !node.choices || !node.choices[choiceIndex]) return;

    var choice = node.choices[choiceIndex];

    if (isChoiceLocked(choice)) {
      st.messages.push({
        type: 'system',
        text: choice.lockedText || 'Недостаточно данных для этого вопроса.'
      });

      renderInterviewModal(id);
      return;
    }

    st.messages.push({
      type: 'player',
      text: choice.text
    });

    if (choice.add) {
      addInterviewEvidence(choice.add);
    }

    if (choice.next === 'END') {
      st.completed = true;
      TB.state.completedInterviews = (TB.state.completedInterviews || 0) + 1;

      st.messages.push({
        type: 'system',
        text: 'Интервью завершено.'
      });

      renderInterviews();

      if (TB.updateCounters) TB.updateCounters();
      if (TB.updateProgress) TB.updateProgress();

      renderInterviewModal(id);
      return;
    }

    st.currentNode = choice.next;

    var nextNode = iv.nodes[st.currentNode];

    if (nextNode) {
      st.messages.push({
        type: 'npc',
        text: nextNode.text
      });

      addInterviewEvidence(nextNode.add);
    }

    renderInterviewModal(id);
  }

  TB.handleInterviewChoice = handleInterviewChoice;

  /* =========================
     DELEGATION
     ========================= */

  document.addEventListener('click', function (event) {
    var interviewBtn = event.target.closest('[data-interview]');
    if (interviewBtn) {
      openInterview(interviewBtn.getAttribute('data-interview'));
      return;
    }

    var choiceBtn = event.target.closest('[data-interview-choice]');
    if (choiceBtn) {
      var id = choiceBtn.getAttribute('data-interview-choice');
      var index = parseInt(choiceBtn.getAttribute('data-choice-index'), 10);

      handleInterviewChoice(id, index);
      return;
    }
  });

  /* =========================
     REFRESH AFTER EVIDENCE CHANGE
     ========================= */

  if (TB.refreshAfterEvidenceChange) {
    var oldRefreshAfterEvidenceChange = TB.refreshAfterEvidenceChange;

    TB.refreshAfterEvidenceChange = function () {
      oldRefreshAfterEvidenceChange();

      renderInterviews();

      if (currentInterviewId && isModalOpen()) {
        renderInterviewModal(currentInterviewId);
      }
    };
  } else {
    TB.refreshAfterEvidenceChange = function () {
      renderInterviews();

      if (currentInterviewId && isModalOpen()) {
        renderInterviewModal(currentInterviewId);
      }
    };
  }

  /* =========================
     ENSURE RENDER WORKSPACE INCLUDES INTERVIEWS
     ========================= */

  if (TB.renderWorkspace) {
    var oldRenderWorkspace = TB.renderWorkspace;

    TB.renderWorkspace = function () {
      oldRenderWorkspace();
      renderInterviews();
    };
  }

})();
