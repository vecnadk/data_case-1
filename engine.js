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
