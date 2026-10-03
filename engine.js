<script>
/* =================================================================
   СОСТОЯНИЕ ИГРЫ
   ================================================================= */
let gameState = {
  currentCaseId: null,
  caseData: null,
  timeLeft: 0,
  totalTime: 0,
  isPaused: false,
  timerInterval: null,

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

/* =================================================================
   ИНИЦИАЛИЗАЦИЯ
   ================================================================= */
function init() {
  const path = window.location.pathname;
  const match = path.match(/\/(case-\d+)/);

  if (!match || !CASES_DB[match[1]]) {
    const root = document.getElementById('tb-game-root');
    if (root) {
      root.innerHTML = `
        <div style="padding:80px 20px;text-align:center;">
          <h1 style="font-family:'Bebas Neue',sans-serif;font-size:48px;margin:0 0 16px 0;">КЕЙС НЕ НАЙДЕН</h1>
          <a href="/cases" style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:#000;background:#FFDD2D;padding:14px 24px;border:2px solid #000;border-radius:4px;text-decoration:none;">ВЕРНУТЬСЯ К БИБЛИОТЕКЕ</a>
        </div>
      `;
    }
    return;
  }

  gameState.currentCaseId = match[1];
  gameState.caseData = CASES_DB[match[1]];
  gameState.totalTime = gameState.caseData.timeMinutes * 60;
  gameState.timeLeft = gameState.totalTime;

  Object.keys(gameState.caseData.interviews || {}).forEach(function(key) {
    gameState.interviewsState[key] = {
      messages: [],
      currentNode: gameState.caseData.interviews[key].startNode,
      completed: false
    };
  });

  (gameState.caseData.requests || []).forEach(function(req) {
    gameState.requests[req.id] = {
      status: 'idle',
      attempts: 0
    };
  });

  renderBriefing();
  setupStaticListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* =================================================================
   БРИФИНГ
   ================================================================= */
function renderBriefing() {
  const d = gameState.caseData;

  setText('b-title', d.title);
  setText('b-industry', d.industry);
  setText('b-difficulty', d.difficulty);
  setText('b-context', d.context);

  setHtml('b-objectives', d.objectives.map(function(o) {
    return `<li>${o}</li>`;
  }).join(''));

  setHtml('b-resources', d.resources.map(function(r) {
    return `
      <div class="tb-resource-box">
        <div class="tb-resource-val">${r.val}</div>
        <div class="tb-resource-lbl">${r.lbl}</div>
      </div>
    `;
  }).join(''));

  setHtml('b-alerts', d.alerts.map(function(a) {
    return `
      <div class="tb-alert-item">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="#FF9500" stroke-width="2"/>
          <line x1="10" y1="6" x2="10" y2="11" stroke="#FF9500" stroke-width="2"/>
          <circle cx="10" cy="14" r="1" fill="#FF9500"/>
        </svg>
        <span>${a}</span>
      </div>
    `;
  }).join(''));
}

function startGame() {
  hide('briefing-screen');
  show('workspace-screen', 'flex');

  setText('w-title', gameState.caseData.title);
  updateTopResources();

  renderWorkspace();
  startTimer();
  updateProgress();
}

/* =================================================================
   РАБОЧАЯ ОБЛАСТЬ
   ================================================================= */
function renderWorkspace() {
  renderMetrics();
  renderDocuments();
  renderTransactions();
  renderRequests();
  renderInterviews();
  renderHypotheses();
  renderEvidence();
  renderControls();
  renderGraph();
  updateCounters();
}

function renderMetrics() {
  const d = gameState.caseData;
  setHtml('render-metrics', d.metrics.map(function(m) {
    return `
      <div class="tb-metric-card ${m.type || ''}">
        <h4>${m.title}</h4>
        <div class="tb-metric-val">${m.val}</div>
        <div class="tb-metric-lbl">${m.lbl}</div>
      </div>
    `;
  }).join(''));

  setText('render-context-short', d.context);

  setHtml('render-alerts-short', d.alerts.map(function(a) {
    return `<li>${a}</li>`;
  }).join(''));
}

/* =================================================================
   ДОКУМЕНТЫ
   ================================================================= */
function isRequestApproved(requestId) {
  return gameState.requests[requestId] && gameState.requests[requestId].status === 'approved';
}

function isDocAvailable(doc) {
  if (!doc.locked) return true;
  if (!doc.unlockedBy) return true;
  return isRequestApproved(doc.unlockedBy);
}

function getDocStatusLabel(doc) {
  if (!doc.locked) return { cls: 'available', text: 'ДОСТУПЕН' };
  if (isDocAvailable(doc)) return { cls: 'unlocked', text: 'РАЗБЛОКИРОВАН' };
  return { cls: 'hidden', text: 'СКРЫТ / НУЖЕН ЗАПРОС' };
}

function getRequestById(id) {
  return (gameState.caseData.requests || []).find(function(r) {
    return r.id === id;
  });
}

function renderDocuments() {
  const docs = gameState.caseData.documents || [];
  const search = (getVal('doc-search') || '').toLowerCase();
  const filter = getVal('doc-filter') || 'all';

  const filtered = docs.filter(function(doc) {
    const available = isDocAvailable(doc);
    const haystack = `${doc.type} ${doc.title} ${doc.meta}`.toLowerCase();

    if (search && haystack.indexOf(search) === -1) return false;
    if (filter === 'available' && !available) return false;
    if (filter === 'hidden' && available) return false;

    return true;
  });

  if (!filtered.length) {
    setHtml('render-docs', '<div class="tb-empty-state">ДОКУМЕНТЫ НЕ НАЙДЕНЫ</div>');
    return;
  }

  setHtml('render-docs', filtered.map(function(doc) {
    const available = isDocAvailable(doc);
    const status = getDocStatusLabel(doc);
    const req = doc.unlockedBy ? getRequestById(doc.unlockedBy) : null;

    return `
      <div class="tb-doc-card ${available ? '' : 'locked'}" data-doc="${doc.id}" data-available="${available ? '1' : '0'}">
        <div class="tb-doc-type">${doc.type}</div>
        <div class="tb-doc-name">${doc.title}</div>
        <div class="tb-doc-meta">${doc.meta}</div>
        <div class="tb-doc-status ${status.cls}">${status.text}</div>
        ${!available && req ? `<div class="tb-doc-small" style="margin-top:8px;color:#7B1FA2;">Требуется запрос: ${req.title}</div>` : ''}
      </div>
    `;
  }).join(''));
}

function openDocument(docId) {
  const doc = (gameState.caseData.documents || []).find(function(d) {
    return d.id === docId;
  });

  if (!doc) return;

  if (!isDocAvailable(doc)) {
    const req = doc.unlockedBy ? getRequestById(doc.unlockedBy) : null;
    showToast(req ? `НУЖЕН ЗАПРОС: ${req.title.toUpperCase()}` : 'ДОКУМЕНТ НЕДОСТУПЕН');
    return;
  }

  openModal(doc.html);
  updateDocumentFieldStates();
}

function updateDocumentFieldStates() {
  document.querySelectorAll('.tb-ev-field').forEach(function(btn) {
    const id = btn.getAttribute('data-ev');
    if (hasEvidence(id)) btn.classList.add('added');
    else btn.classList.remove('added');
  });
}

/* =================================================================
   ТРАНЗАКЦИИ
   ================================================================= */
function parseAmount(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function parseDays(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

function isDuplicateSuspiciousContainer(row) {
  if (!row.container || row.container === '—') return false;
  return (gameState.caseData.transactions || []).filter(function(t) {
    return t.grn === 'Нет' && t.container === row.container;
  }).length > 1;
}

function isDuplicateSuspiciousTracking(row) {
  if (!row.tracking || row.tracking === '—') return false;
  return (gameState.caseData.transactions || []).filter(function(t) {
    return t.grn === 'Нет' && t.tracking === row.tracking;
  }).length > 1;
}

function renderTransactions() {
  const rows = gameState.caseData.transactions || [];
  const search = (getVal('txn-search') || '').toLowerCase();
  const filter = getVal('txn-filter') || 'all';

  const filtered = rows.filter(function(row) {
    const haystack = `${row.date} ${row.payee} ${row.amount} ${row.invoice} ${row.container} ${row.tracking} ${row.terms} ${row.grn} ${row.note}`.toLowerCase();
    const amount = parseAmount(row.amount);
    const days = parseDays(row.terms);

    if (search && haystack.indexOf(search) === -1) return false;

    if (filter === 'vendor' && row.payee.indexOf('Транс-Север') === -1) return false;
    if (filter === 'large' && amount < 10000000) return false;
    if (filter === 'fast' && days > 3) return false;
    if (filter === 'no_grn' && row.grn !== 'Нет') return false;

    return true;
  });

  let html = `
    <table class="tb-data-table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Получатель</th>
          <th>Сумма</th>
          <th>Счёт</th>
          <th>Контейнер</th>
          <th>Трек</th>
          <th>Срок</th>
          <th>GRN</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (!filtered.length) {
    html += `<tr><td colspan="9" style="text-align:center;color:#888;padding:24px;">ОПЕРАЦИИ НЕ НАЙДЕНЫ</td></tr>`;
  }

  filtered.forEach(function(row) {
    html += `
      <tr>
        <td>${row.date}</td>
        <td><strong>${row.payee}</strong></td>
        <td>${row.amount}</td>
        <td>${row.invoice}</td>
        <td>${row.container}</td>
        <td>${row.tracking}</td>
        <td>${row.terms}</td>
        <td>${row.grn}</td>
        <td><button class="tb-btn-mini" data-txn="${row.id}">В улики</button></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  setHtml('render-transactions', html);
}

function addTransactionEvidence(txnId) {
  const row = (gameState.caseData.transactions || []).find(function(t) {
    return t.id === txnId;
  });

  if (!row) return;

  const id = 'txn_' + row.id;
  if (gameState.evidence[id]) {
    showToast('ЭТА ОПЕРАЦИЯ УЖЕ В УЛИКАХ');
    return;
  }

  const days = parseDays(row.terms);
  const dupContainer = isDuplicateSuspiciousContainer(row);
  const dupTracking = isDuplicateSuspiciousTracking(row);
  const suspicious = row.grn === 'Нет' && days <= 3;

  let reliability = 'low';
  let weight = 2;

  if (suspicious) {
    reliability = 'medium';
    weight = 5;
  }

  if (suspicious && (dupContainer || dupTracking)) {
    weight = 8;
  }

  gameState.evidence[id] = {
    id: id,
    title: `Платёж: ${row.payee}, счёт ${row.invoice}, ${row.amount}`,
    source: 'Журнал платежей',
    reliability: reliability,
    weight: weight,
    tags: ['transaction'],
    noise: false
  };

  showToast('ОПЕРАЦИЯ ДОБАВЛЕНА В УЛИКИ');
  renderEvidence();
  renderHypotheses();
  renderGraph();
  updateProgress();
}

/* =================================================================
   ЗАПРОСЫ
   ================================================================= */
function meetsRequestRequirements(req) {
  if (req.requires && req.requires.length) {
    for (let i = 0; i < req.requires.length; i++) {
      if (!hasEvidence(req.requires[i])) return false;
    }
  }

  if (req.requiresAny && req.requiresAny.length) {
    let any = false;
    for (let i = 0; i < req.requiresAny.length; i++) {
      if (hasEvidence(req.requiresAny[i])) {
        any = true;
        break;
      }
    }
    if (!any) return false;
  }

  return true;
}

function renderRequests() {
  const requests = gameState.caseData.requests || [];
  const max = gameState.caseData.maxRequests || 6;
  const left = Math.max(0, max - gameState.requestsUsed);

  setText('req-used', String(gameState.requestsUsed));
  setText('req-left', String(left));
  setText('req-approved', String(gameState.requestsApproved));
  setText('req-rejected', String(gameState.requestsRejected));
  setText('c-req', `${gameState.requestsUsed}/${max}`);

  setHtml('render-requests', requests.map(function(req) {
    const state = gameState.requests[req.id] || { status: 'idle' };
    const approved = state.status === 'approved';
    const rejected = state.status === 'rejected';
    const canSend = !approved && left > 0;
    const requirementsMet = meetsRequestRequirements(req);

    const reqItems = (req.requires || []).map(function(id) {
      const done = hasEvidence(id);
      const title = EV_LIBRARY[id] ? EV_LIBRARY[id].title : id;
      return `<li class="${done ? 'done' : ''}">${title}</li>`;
    }).join('');

    const unlockTitles = (req.unlocks || []).map(function(docId) {
      const doc = (gameState.caseData.documents || []).find(function(d) {
        return d.id === docId;
      });
      return doc ? doc.title : docId;
    }).join(' • ');

    let actionHtml = '';
    if (approved) {
      actionHtml = `<span class="tb-request-status approved">ОДОБРЕН</span>`;
    } else if (rejected) {
      actionHtml = `<button class="tb-btn-secondary" data-request-send="${req.id}" ${canSend ? '' : 'disabled'}>ПОВТОРИТЬ ЗАПРОС</button>`;
    } else {
      actionHtml = `<button class="tb-btn-secondary" data-request-send="${req.id}" ${canSend ? '' : 'disabled'}>ОТПРАВИТЬ ЗАПРОС</button>`;
    }

    return `
      <div class="tb-request-card ${approved ? 'approved' : rejected ? 'rejected' : requirementsMet ? '' : 'locked'}">
        <div class="tb-request-head">
          <div>
            <div class="tb-request-title">${req.title}</div>
            <div class="tb-request-target">${req.target}</div>
          </div>
          <div class="tb-request-status ${approved ? 'approved' : rejected ? 'rejected' : requirementsMet ? 'pending' : 'locked'}">
            ${approved ? 'ОДОБРЕН' : rejected ? 'ОТКЛОНЁН' : requirementsMet ? 'ГОТОВ К ОТПРАВКЕ' : 'НЕТ ОСНОВАНИЯ'}
          </div>
        </div>

        <div class="tb-request-desc">${req.desc}</div>

        <div class="tb-request-meta">
          <span>Время: ${req.timeCost} мин</span>
          <span>Открывает: ${unlockTitles || '—'}</span>
        </div>

        <div>
          <strong style="font-size:12px;color:#666;">Основание для запроса</strong>
          <ul class="tb-checklist">${reqItems || '<li>Не требуется</li>'}</ul>
        </div>

        <div class="tb-request-actions">
          ${actionHtml}
          ${approved ? (req.unlocks || []).map(function(docId) {
            const doc = (gameState.caseData.documents || []).find(function(d) {
              return d.id === docId;
            });
            return doc ? `<button class="tb-btn-mini" data-open-doc="${doc.id}">Открыть: ${doc.title}</button>` : '';
          }).join('') : ''}
        </div>
      </div>
    `;
  }).join(''));

  setHtml('request-log', gameState.requestLog.slice().reverse().map(function(entry) {
    return `
      <div class="tb-request-log-item ${entry.status}">
        <strong>${entry.time}</strong> · ${entry.text}
      </div>
    `;
  }).join('') || '<div class="tb-request-log-item">Журнал пуст.</div>');
}

function sendRequest(requestId) {
  const req = getRequestById(requestId);
  if (!req) return;

  const state = gameState.requests[requestId];
  if (!state || state.status === 'approved') return;

  const max = gameState.caseData.maxRequests || 6;

  if (!meetsRequestRequirements(req)) {
    state.status = 'rejected';
    state.attempts++;
    gameState.requestsRejected++;
    spendTime(10);
    addRequestLog('rejected', `Запрос отклонён: ${req.title}. ${req.reject}`);
    showToast('ЗАПРОС ОТКЛОНЁН');
    renderRequests();
    updateTopResources();
    return;
  }

  if (gameState.requestsUsed >= max) {
    showToast('ЛИМИТ ЗАПРОСОВ ИСЧЕРПАН');
    return;
  }

  state.status = 'approved';
  state.attempts++;
  gameState.requestsUsed++;
  gameState.requestsApproved++;
  spendTime(req.timeCost);
  addRequestLog('approved', `Запрос одобрен: ${req.title}. ${req.success}`);
  showToast('ЗАПРОС ОДОБРЕН');

  renderRequests();
  renderDocuments();
  renderGraph();
  updateCounters();
  updateTopResources();
  updateProgress();
}

function addRequestLog(status, text) {
  const now = new Date();
  const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  gameState.requestLog.push({
    status: status,
    time: time,
    text: text
  });
}

function spendTime(minutes) {
  gameState.timeLeft = Math.max(0, gameState.timeLeft - minutes * 60);
  updateTimerDisplay();

  if (gameState.timeLeft <= 0) {
    clearInterval(gameState.timerInterval);
    openReportModal();
    showToast('ВРЕМЯ ВЫШЛО');
  }
}

function updateTopResources() {
  const max = gameState.caseData.maxRequests || 6;
  const left = Math.max(0, max - gameState.requestsUsed);
  setText('w-request-budget', `Запросов: ${left}`);
}

/* =================================================================
   ИНТЕРВЬЮ
   ================================================================= */
function renderInterviews() {
  const interviews = gameState.caseData.interviews || {};
  const max = gameState.caseData.maxInterviews || 3;

  setHtml('render-interviews', Object.values(interviews).map(function(interview) {
    const state = gameState.interviewsState[interview.id];
    return `
      <div class="tb-interview-card ${state.completed ? 'completed' : ''}">
        <div class="tb-interview-top">
          <div class="tb-avatar">${interview.initials}</div>
          <div>
            <div class="tb-interview-name">${interview.name}</div>
            <div class="tb-interview-role">${interview.role}</div>
          </div>
        </div>
        <div class="tb-interview-desc">${interview.desc}</div>
        <button class="tb-btn-secondary" data-interview="${interview.id}">
          ${state.completed ? 'ОТКРЫТЬ ПРОТОКОЛ' : 'НАЧАТЬ ИНТЕРВЬЮ'}
        </button>
      </div>
    `;
  }).join(''));

  setText('c-int', `${gameState.completedInterviews}/${max}`);
}

function openInterview(interviewId) {
  const interview = gameState.caseData.interviews[interviewId];
  const state = gameState.interviewsState[interviewId];
  const max = gameState.caseData.maxInterviews || 3;

  if (!state.completed && gameState.completedInterviews >= max) {
    showToast(`ДОСТУПНО ТОЛЬКО ${max} ИНТЕРВЬЮ`);
    return;
  }

  if (!state.messages.length) {
    const startNode = interview.nodes[interview.startNode];
    state.messages.push({ type: 'npc', text: startNode.text });
    if (startNode.add) {
      startNode.add.forEach(function(id) {
        addEvidence(id, false);
      });
    }
  }

  renderInterviewModal(interviewId);
}

function renderInterviewModal(interviewId) {
  const interview = gameState.caseData.interviews[interviewId];
  const state = gameState.interviewsState[interviewId];
  const node = interview.nodes[state.currentNode];

  let choicesHtml = '';

  if (!state.completed && node && node.choices) {
    choicesHtml = `
      <div class="tb-choices">
        ${node.choices.map(function(choice, idx) {
          const locked = isChoiceLocked(choice);
          return `
            <button class="tb-choice-btn ${locked ? 'locked' : ''}" data-interview-choice="${interviewId}" data-choice-index="${idx}">
              ${choice.text}
            </button>
          `;
        }).join('')}
      </div>
    `;
  } else if (state.completed) {
    choicesHtml = `<div class="tb-msg success">Интервью завершено. Протокол сохранён.</div>`;
  }

  const content = `
    <div class="tb-interview-header">
      <div class="tb-avatar">${interview.initials}</div>
      <div>
        <div class="tb-interview-name">${interview.name}</div>
        <div class="tb-interview-role">${interview.role}</div>
      </div>
    </div>
    <div class="tb-chat" id="interview-chat">
      ${state.messages.map(function(msg) {
        return `<div class="tb-msg ${msg.type}">${msg.text}</div>`;
      }).join('')}
    </div>
    ${choicesHtml}
  `;

  openModal(content);
  scrollChatToBottom();
}

function isChoiceLocked(choice) {
  if (choice.requiresAny && choice.requiresAny.length) {
    return !choice.requiresAny.some(function(id) {
      return hasEvidence(id);
    });
  }

  if (choice.requires) {
    return !hasEvidence(choice.requires);
  }

  return false;
}

function handleInterviewChoice(interviewId, choiceIndex) {
  const interview = gameState.caseData.interviews[interviewId];
  const state = gameState.interviewsState[interviewId];
  const node = interview.nodes[state.currentNode];
  const choice = node.choices[choiceIndex];

  if (!choice) return;

  if (isChoiceLocked(choice)) {
    state.messages.push({
      type: 'system',
      text: choice.lockedText || 'Недостаточно данных для этого вопроса.'
    });
    renderInterviewModal(interviewId);
    return;
  }

  state.messages.push({ type: 'player', text: choice.text });

  if (choice.add) {
    choice.add.forEach(function(id) {
      const added = addEvidence(id, false);
      if (added) {
        state.messages.push({
          type: 'success',
          text: 'Доказательство добавлено: ' + (EV_LIBRARY[id] ? EV_LIBRARY[id].title : id)
        });
      }
    });
  }

  if (choice.next === 'END') {
    state.completed = true;
    gameState.completedInterviews++;
    state.messages.push({ type: 'system', text: 'Интервью завершено.' });
    renderInterviews();
    updateCounters();
    updateProgress();
    renderInterviewModal(interviewId);
    return;
  }

  state.currentNode = choice.next;
  const nextNode = interview.nodes[state.currentNode];

  if (nextNode) {
    state.messages.push({ type: 'npc', text: nextNode.text });
    if (nextNode.add) {
      nextNode.add.forEach(function(id) {
        const added = addEvidence(id, false);
        if (added) {
          state.messages.push({
            type: 'success',
            text: 'Доказательство добавлено: ' + (EV_LIBRARY[id] ? EV_LIBRARY[id].title : id)
          });
        }
      });
    }
  }

  renderInterviewModal(interviewId);
}

function scrollChatToBottom() {
  const chat = document.getElementById('interview-chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

/* =================================================================
   ГИПОТЕЗЫ
   ================================================================= */
function renderHypotheses() {
  const container = document.getElementById('render-hypotheses');
  if (!container || typeof SUGGESTED_HYPOTHESES === 'undefined') return;

  container.innerHTML = SUGGESTED_HYPOTHESES.map(function(hyp) {
    const selected = gameState.selectedHypothesisId === hyp.id;
    const confidence = getHypothesisConfidence(hyp);

    const requiredHtml = hyp.required.map(function(id) {
      const done = hasEvidence(id);
      return `<li class="${done ? 'done' : ''}">${EV_LIBRARY[id] ? EV_LIBRARY[id].title : id}</li>`;
    }).join('');

    const optionalHtml = hyp.optional.map(function(id) {
      const done = hasEvidence(id);
      return `<li class="${done ? 'done' : ''}">${EV_LIBRARY[id] ? EV_LIBRARY[id].title : id}</li>`;
    }).join('');

    return `
      <div class="tb-hyp-card ${selected ? 'selected' : ''}" data-hyp="${hyp.id}">
        <div class="tb-hyp-title">${hyp.title}</div>
        <div class="tb-hyp-desc">${hyp.desc}</div>

        <strong style="font-size:13px;color:#666;">Необходимые доказательства</strong>
        <ul class="tb-checklist">${requiredHtml}</ul>

        <strong style="font-size:13px;color:#666;display:block;margin-top:12px;">Дополнительные улики</strong>
        <ul class="tb-checklist">${optionalHtml}</ul>

        <div class="tb-confidence">
          <div class="tb-confidence-fill" style="width:${confidence}%"></div>
        </div>
        <div style="font-size:12px;color:#888;margin-top:6px;">Уверенность: ${confidence}%</div>
      </div>
    `;
  }).join('');

  renderDevilsAdvocate();
}

function selectHypothesis(hypId) {
  gameState.selectedHypothesisId = hypId;
  if (gameState.hypotheses.indexOf(hypId) === -1) {
    gameState.hypotheses.push(hypId);
  }
  renderHypotheses();
  updateCounters();
  updateProgress();
}

function getHypothesisConfidence(hyp) {
  if (!hyp) return 0;

  const requiredFound = hyp.required.filter(function(id) {
    return hasEvidence(id);
  }).length;

  const optionalFound = hyp.optional.filter(function(id) {
    return hasEvidence(id);
  }).length;

  const refuted = gameState.refutedHypotheses[hyp.id] ? 10 : 0;
  const requiredScore = (requiredFound / hyp.required.length) * 70;
  const optionalScore = Math.min(20, optionalFound * 3);

  return Math.min(100, Math.round(requiredScore + optionalScore + refuted));
}

function renderDevilsAdvocate() {
  const container = document.getElementById('render-devils-advocate');
  if (!container || typeof SUGGESTED_HYPOTHESES === 'undefined') return;

  const hyp = SUGGESTED_HYPOTHESES.find(function(h) {
    return h.id === gameState.selectedHypothesisId;
  });

  if (!hyp) {
    container.innerHTML = `
      <div class="tb-devils-advocate">
        <h3>АДВОКАТ ДЬЯВОЛА</h3>
        <p>Выберите гипотезу, чтобы система сформулировала сильнейшее альтернативное объяснение.</p>
      </div>
    `;
    return;
  }

  const refuted = !!gameState.refutedHypotheses[hyp.id];
  const refutationMet = meetsRefutation(hyp);

  container.innerHTML = `
    <div class="tb-devils-advocate">
      <h3>АДВОКАТ ДЬЯВОЛА</h3>
      <p>${hyp.devilsAdvocate}</p>
      ${refuted
        ? '<div class="tb-msg success">Альтернативная версия опровергнута. Уверенность повышена.</div>'
        : `<button class="tb-btn-secondary" onclick="tryRefuteHypothesis('${hyp.id}')">ПОПЫТАТЬСЯ ОПРОВЕРГНУТЬ</button>`
      }
      ${!refutationMet && !refuted
        ? '<p style="font-size:13px;color:#888;margin-top:10px;">Для опровержения нужны дополнительные доказательства из скрытых документов, запросов или интервью.</p>'
        : ''
      }
    </div>
  `;
}

function meetsRefutation(hyp) {
  if (hyp.refutationAll && hyp.refutationAll.length) {
    return hyp.refutationAll.every(function(id) {
      return hasEvidence(id);
    });
  }

  if (hyp.refutationAny && hyp.refutationAny.length) {
    return hyp.refutationAny.some(function(id) {
      return hasEvidence(id);
    });
  }

  return false;
}

function tryRefuteHypothesis(hypId) {
  const hyp = SUGGESTED_HYPOTHESES.find(function(h) {
    return h.id === hypId;
  });

  if (!hyp) return;

  if (!meetsRefutation(hyp)) {
    showToast('НЕДОСТАТОЧНО ДОКАЗАТЕЛЬСТВ ДЛЯ ОПРОВЕРЖЕНИЯ');
    return;
  }

  gameState.refutedHypotheses[hypId] = true;
  renderHypotheses();
  updateProgress();
  showToast('АЛЬТЕРНАТИВНАЯ ВЕРСИЯ ОПРОВЕРГНУТА');
}

/* =================================================================
   ДОКАЗАТЕЛЬСТВА
   ================================================================= */
function addEvidence(id, notify) {
  if (notify === undefined) notify = true;
  if (gameState.evidence[id]) return false;

  const data = EV_LIBRARY[id];
  if (!data) return false;

  gameState.evidence[id] = {
    id: id,
    title: data.title,
    source: data.source,
    reliability: data.reliability,
    weight: data.weight,
    tags: data.tags || [],
    noise: !!data.noise
  };

  if (notify) showToast('УЛИКА ДОБАВЛЕНА');

  renderEvidence();
  renderHypotheses();
  renderRequests();
  renderGraph();
  updateDocumentFieldStates();
  updateCounters();
  updateProgress();

  return true;
}

function removeEvidence(id) {
  delete gameState.evidence[id];
  renderEvidence();
  renderHypotheses();
  renderRequests();
  renderGraph();
  updateDocumentFieldStates();
  updateCounters();
  updateProgress();
  showToast('УЛИКА УДАЛЕНА');
}

function hasEvidence(id) {
  return !!gameState.evidence[id];
}

function renderEvidence() {
  const container = document.getElementById('render-evidence');
  if (!container) return;

  const items = Object.values(gameState.evidence);

  if (!items.length) {
    container.innerHTML = '<div class="tb-empty-state">ДОКАЗАТЕЛЬСТВ ПОКА НЕТ</div>';
    return;
  }

  container.innerHTML = items.map(function(ev) {
    return `
      <div class="tb-evidence-item ${ev.reliability}">
        <button class="tb-remove-btn" data-remove-ev="${ev.id}">УДАЛИТЬ</button>
        <div class="tb-evidence-title">${ev.title}</div>
        <div class="tb-evidence-meta">
          Источник: ${ev.source} • Надежность: ${getReliabilityLabel(ev.reliability)} • Вес: ${ev.weight}
        </div>
      </div>
    `;
  }).join('');
}

function getReliabilityLabel(r) {
  if (r === 'high') return 'высокая';
  if (r === 'medium') return 'средняя';
  return 'низкая';
}

/* =================================================================
   ГРАФ
   ================================================================= */
function renderGraph() {
  const container = document.getElementById('render-graph');
  if (!container) return;

  const procurement = hasEvidence('sod_violation_procurement') || hasEvidence('email_expedite') || hasEvidence('volkov_admits_relative');
  const carrier = hasEvidence('vendor_new') || hasEvidence('vendor_mass_address') || hasEvidence('compliance_vendor_shell') || hasEvidence('compliance_beneficial_relative');
  const docs = hasEvidence('invoice_container_reuse') || hasEvidence('bol_issue_date') || hasEvidence('vessel_schedule_mismatch') || hasEvidence('dispatch_log_no_booking');
  const tracking = hasEvidence('invoice_tracking_id') || hasEvidence('it_whois_recent') || hasEvidence('it_ip_overlap') || hasEvidence('it_site_template');
  const warehouse = hasEvidence('payment_before_grn') || hasEvidence('warehouse_grn_absent') || hasEvidence('warehouse_confirms_no_receipt') || hasEvidence('warehouse_courier_pattern');
  const customs = hasEvidence('customs_risk_flag') || hasEvidence('customs_no_inspection_record');
  const bank = hasEvidence('payments_rapid') || hasEvidence('bank_counterparty_new_account') || hasEvidence('bank_payment_trail_round_trip');

  container.innerHTML = `
    <svg class="tb-graph-svg" viewBox="0 0 900 380" fill="none">
      <circle cx="120" cy="190" r="46" class="graph-node ${procurement ? 'active' : ''}" />
      <text x="120" y="185" class="graph-label">Закупки</text>
      <text x="120" y="202" class="graph-label">Волков А.П.</text>

      <circle cx="310" cy="90" r="42" class="graph-node ${carrier ? 'active' : ''}" />
      <text x="310" y="95" class="graph-label">Перевозчик</text>

      <circle cx="310" cy="290" r="42" class="graph-node ${docs ? 'active' : ''}" />
      <text x="310" y="285" class="graph-label">Документы</text>
      <text x="310" y="302" class="graph-label">BOL / счета</text>

      <circle cx="500" cy="190" r="48" class="graph-node ${tracking ? 'danger' : ''}" />
      <text x="500" y="185" class="graph-label">Трекинг</text>
      <text x="500" y="202" class="graph-label">GPS / dispatch</text>

      <circle cx="680" cy="90" r="42" class="graph-node ${warehouse ? 'danger' : ''}" />
      <text x="680" y="95" class="graph-label">Склад</text>

      <circle cx="680" cy="290" r="42" class="graph-node ${customs ? 'active' : ''}" />
      <text x="680" y="295" class="graph-label">Таможня</text>

      <circle cx="840" cy="190" r="38" class="graph-node ${bank ? 'active' : ''}" />
      <text x="840" y="195" class="graph-label">Банк</text>

      <line x1="162" y1="170" x2="270" y2="108" class="graph-edge ${procurement && carrier ? 'active' : ''}" />
      <line x1="162" y1="210" x2="270" y2="272" class="graph-edge ${procurement && docs ? 'active' : ''}" />
      <line x1="348" y1="108" x2="458" y2="172" class="graph-edge ${carrier && tracking ? 'active' : ''}" />
      <line x1="348" y1="272" x2="458" y2="208" class="graph-edge ${docs && tracking ? 'active' : ''}" />
      <line x1="542" y1="172" x2="642" y2="108" class="graph-edge ${tracking && warehouse ? 'active' : ''}" />
      <line x1="542" y1="208" x2="642" y2="272" class="graph-edge ${tracking && customs ? 'active' : ''}" />
      <line x1="718" y1="108" x2="808" y2="172" class="graph-edge ${warehouse && bank ? 'active' : ''}" />
      <line x1="718" y1="272" x2="808" y2="208" class="graph-edge ${customs && bank ? 'active' : ''}" />
    </svg>

    <div class="tb-doc-note" style="margin-top:16px;">
      Граф собирается только из подтверждённых фактов. Пока часть узлов серая — схема не доказана.
    </div>
  `;
}

/* =================================================================
   КОНТРОЛИ
   ================================================================= */
function renderControls() {
  const container = document.getElementById('render-controls');
  if (!container) return;

  container.innerHTML = (gameState.caseData.controls || []).map(function(c) {
    return `
      <label class="tb-control-option">
        <input type="checkbox" data-control="${c.id}" ${gameState.controlsSelected[c.id] ? 'checked' : ''}>
        <div class="tb-control-text">
          <strong>${c.text}</strong>
          <span>${c.desc}</span>
        </div>
      </label>
    `;
  }).join('');
}

/* =================================================================
   МОДАЛЬНЫЕ ОКНА / ТОСТЫ
   ================================================================= */
function openModal(content) {
  setHtml('modal-content', content);
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = text;
  toast.classList.add('show');

  clearTimeout(window.__tbToastTimer);
  window.__tbToastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 2400);
}

/* =================================================================
   НАВИГАЦИЯ И СОБЫТИЯ
   ================================================================= */
function setupStaticListeners() {
  document.querySelectorAll('.tb-nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const section = this.getAttribute('data-section');
      switchSection(section);

      document.querySelectorAll('.tb-nav-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      this.classList.add('active');

      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  const docSearch = document.getElementById('doc-search');
  if (docSearch) docSearch.addEventListener('input', renderDocuments);

  const docFilter = document.getElementById('doc-filter');
  if (docFilter) docFilter.addEventListener('change', renderDocuments);

  const txnSearch = document.getElementById('txn-search');
  if (txnSearch) txnSearch.addEventListener('input', renderTransactions);

  const txnFilter = document.getElementById('txn-filter');
  if (txnFilter) txnFilter.addEventListener('change', renderTransactions);

  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }

  setupDelegation();
}

function setupDelegation() {
  document.addEventListener('click', function(e) {
    const docCard = e.target.closest('.tb-doc-card[data-doc]');
    if (docCard) {
      openDocument(docCard.getAttribute('data-doc'));
      return;
    }

    const openDocBtn = e.target.closest('[data-open-doc]');
    if (openDocBtn) {
      openDocument(openDocBtn.getAttribute('data-open-doc'));
      return;
    }

    const evField = e.target.closest('.tb-ev-field[data-ev]');
    if (evField) {
      const id = evField.getAttribute('data-ev');
      const added = addEvidence(id);
      if (!added) showToast('УЖЕ В ДОКАЗАТЕЛЬСТВАХ');
      return;
    }

    const txnBtn = e.target.closest('[data-txn]');
    if (txnBtn) {
      addTransactionEvidence(txnBtn.getAttribute('data-txn'));
      return;
    }

    const requestBtn = e.target.closest('[data-request-send]');
    if (requestBtn) {
      sendRequest(requestBtn.getAttribute('data-request-send'));
      return;
    }

    const interviewBtn = e.target.closest('[data-interview]');
    if (interviewBtn) {
      openInterview(interviewBtn.getAttribute('data-interview'));
      return;
    }

    const choiceBtn = e.target.closest('[data-interview-choice]');
    if (choiceBtn) {
      const interviewId = choiceBtn.getAttribute('data-interview-choice');
      const index = parseInt(choiceBtn.getAttribute('data-choice-index'), 10);
      handleInterviewChoice(interviewId, index);
      return;
    }

    const hypCard = e.target.closest('[data-hyp]');
    if (hypCard) {
      selectHypothesis(hypCard.getAttribute('data-hyp'));
      return;
    }

    const removeBtn = e.target.closest('[data-remove-ev]');
    if (removeBtn) {
      removeEvidence(removeBtn.getAttribute('data-remove-ev'));
      return;
    }
  });

  document.addEventListener('change', function(e) {
    const control = e.target.closest('[data-control]');
    if (control) {
      gameState.controlsSelected[control.getAttribute('data-control')] = control.checked;
      updateProgress();
    }
  });
}

function switchSection(sectionId) {
  document.querySelectorAll('.tb-section').forEach(function(s) {
    s.classList.remove('active');
  });

  const target = document.getElementById('sec-' + sectionId);
  if (target) target.classList.add('active');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* =================================================================
   ТАЙМЕР
   ================================================================= */
function startTimer() {
  updateTimerDisplay();

  gameState.timerInterval = setInterval(function() {
    if (!gameState.isPaused) {
      gameState.timeLeft--;
      updateTimerDisplay();

      if (gameState.timeLeft <= 0) {
        clearInterval(gameState.timerInterval);
        openReportModal();
        showToast('ВРЕМЯ ВЫШЛО');
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const h = Math.floor(gameState.timeLeft / 3600);
  const m = Math.floor((gameState.timeLeft % 3600) / 60);
  const s = gameState.timeLeft % 60;

  setText('w-timer', `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

function togglePause() {
  gameState.isPaused = !gameState.isPaused;
  const btn = document.getElementById('btn-pause');

  btn.innerHTML = gameState.isPaused
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3L13 8L5 13V3Z"/></svg> ПРОДОЛЖИТЬ'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg> ПАУЗА';
}

/* =================================================================
   ПРОГРЕСС И СЧЁТЧИКИ
   ================================================================= */
function updateCounters() {
  const docs = gameState.caseData.documents || [];
  const availableDocs = docs.filter(isDocAvailable).length;

  setText('c-docs', String(availableDocs));
  setText('c-trans', String((gameState.caseData.transactions || []).length));
  setText('c-hyp', String(gameState.hypotheses.length));
  setText('c-ev', String(Object.keys(gameState.evidence).length));
  setText('c-int', `${gameState.completedInterviews}/${gameState.caseData.maxInterviews || 3}`);
}

function updateProgress() {
  const evidenceCount = Object.values(gameState.evidence).filter(function(e) {
    return !e.noise;
  }).length;

  const noiseCount = Object.values(gameState.evidence).filter(function(e) {
    return e.noise;
  }).length;

  const hypCount = gameState.hypotheses.length;
  const intCount = gameState.completedInterviews;
  const reqCount = gameState.requestsApproved;
  const ctrlCount = Object.values(gameState.controlsSelected).filter(Boolean).length;

  const raw =
    evidenceCount * 2 +
    hypCount * 4 +
    intCount * 5 +
    reqCount * 6 +
    ctrlCount * 1 -
    Math.min(10, noiseCount * 2);

  gameState.progress = Math.max(0, Math.min(100, raw));

  setText('progress-text', gameState.progress + '%');
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = gameState.progress + '%';
}

/* =================================================================
   ОТЧЁТ
   ================================================================= */
function openReportModal() {
  switchSection('report');

  document.querySelectorAll('.tb-nav-btn').forEach(function(b) {
    b.classList.remove('active');
  });

  const rb = document.querySelector('[data-section="report"]');
  if (rb) rb.classList.add('active');

  showToast('ПЕРЕЙДИТЕ К ФИНАЛЬНОМУ ОТЧЕТУ');
}

function submitFinalReport() {
  const sel = document.querySelector('input[name="conclusion"]:checked');
  const conclusion = sel ? sel.value : null;

  if (!conclusion) {
    showToast('ВЫБЕРИТЕ ВЫВОД');
    return;
  }

  clearInterval(gameState.timerInterval);
  const result = calculateResult(conclusion);
  renderResultModal(result);
}

function calculateResult(conclusion) {
  const correctHyp = SUGGESTED_HYPOTHESES.find(function(h) {
    return h.correct;
  });

  const selectedHyp = SUGGESTED_HYPOTHESES.find(function(h) {
    return h.id === gameState.selectedHypothesisId;
  });

  const confidence = selectedHyp ? getHypothesisConfidence(selectedHyp) : 0;
  const noiseEvidence = Object.values(gameState.evidence).filter(function(e) {
    return e.noise;
  });

  let accuracy = 0;
  let ethics = 10;
  let comment = '';

  if (!selectedHyp) {
    accuracy = 5;
    ethics -= 3;
    comment = 'Гипотеза не выбрана. Аудитор должен явно зафиксировать рабочую версию и проверить её доказательствами.';
  } else if (conclusion === 'fraud') {
    if (selectedHyp.id === correctHyp.id && confidence >= 85 && noiseEvidence.length <= 2) {
      accuracy = 40;
      comment = 'Схема TBML через фантомную логистику раскрыта. Доказательственная база достаточна для эскалации в безопасность и комплаенс.';
    } else if (confidence >= 65) {
      accuracy = 25;
      ethics -= 5;
      comment = 'Направление верное, но часть ключевых доказательств не собрана. Преждевременная эскалация создаёт procedural risk.';
    } else {
      accuracy = 5;
      ethics -= 10;
      comment = 'Обвинение не подтверждено достаточной базой. Возможны ложный вывод и нарушение принципа professional skepticism without prejudice.';
    }
  } else if (conclusion === 'insufficient') {
    if (confidence >= 85) {
      accuracy = 15;
      comment = 'Вы были осторожны, но упустили достаточно доказанную схему. В реальности потери могли бы продолжаться.';
    } else {
      accuracy = 35;
      comment = 'Процедурно корректно: текущих доказательств недостаточно для окончательного вывода о мошенничестве.';
    }
  } else if (conclusion === 'error') {
    if (confidence >= 85) {
      accuracy = 5;
      comment = 'Ошибка учёта слабо объясняет фейковый трекинг, отсутствие dispatch log, транзитные платежи и конфликт интересов.';
    } else {
      accuracy = 20;
      comment = 'Частично верно, но не учтены признаки умышленного обхода контролей.';
    }
  }

  if (selectedHyp && selectedHyp.id !== correctHyp.id && conclusion === 'fraud') {
    accuracy = Math.min(accuracy, 10);
    ethics -= 5;
    comment += ' Выбранная гипотеза не соответствует совокупности доказательств.';
  }

  const evidenceScore = Math.min(25, Math.round(confidence / 4));

  const timePct = gameState.totalTime > 0 ? gameState.timeLeft / gameState.totalTime : 0;
  const timeliness = Math.max(0, Math.round(15 * timePct));

  const controls = gameState.caseData.controls || [];
  const goodControls = controls.filter(function(c) {
    return c.good && gameState.controlsSelected[c.id];
  });

  const badControls = controls.filter(function(c) {
    return !c.good && gameState.controlsSelected[c.id];
  });

  let prevention = Math.max(0, Math.min(15, goodControls.length * 2 - badControls.length * 4));

  ethics -= badControls.length * 2;
  ethics -= Math.min(4, noiseEvidence.length);
  ethics = Math.max(0, ethics);

  const total = Math.max(0, Math.min(100, accuracy + evidenceScore + timeliness + prevention + ethics));

  const missingRequired = correctHyp.required.filter(function(id) {
    return !hasEvidence(id);
  }).map(function(id) {
    return EV_LIBRARY[id] ? EV_LIBRARY[id].title : id;
  });

  return {
    total: total,
    accuracy: accuracy,
    evidenceScore: evidenceScore,
    timeliness: timeliness,
    prevention: prevention,
    ethics: ethics,
    comment: comment,
    goodControls: goodControls,
    badControls: badControls,
    confidence: confidence,
    conclusion: conclusion,
    selectedHyp: selectedHyp,
    correctHyp: correctHyp,
    missingRequired: missingRequired,
    noiseEvidence: noiseEvidence
  };
}

function renderResultModal(r) {
  const content = `
    <h2 style="font-family:'Bebas Neue',sans-serif;font-size:36px;margin:0 0 20px 0;">РЕЗУЛЬТАТ РАССЛЕДОВАНИЯ</h2>

    <div class="tb-result-grid">
      <div>
        <div class="tb-score-circle">
          <div class="tb-score-num">${r.total}</div>
          <div class="tb-score-lbl">ИТОГОВЫЙ БАЛЛ</div>
        </div>
      </div>

      <div>
        <div class="tb-breakdown">
          <div class="tb-breakdown-item"><span>Точность вывода</span><strong>${r.accuracy} / 40</strong></div>
          <div class="tb-breakdown-item"><span>Сила доказательств</span><strong>${r.evidenceScore} / 25</strong></div>
          <div class="tb-breakdown-item"><span>Своевременность</span><strong>${r.timeliness} / 15</strong></div>
          <div class="tb-breakdown-item"><span>Профилактика</span><strong>${r.prevention} / 15</strong></div>
          <div class="tb-breakdown-item"><span>Этичность</span><strong>${r.ethics} / 10</strong></div>
        </div>

        <div class="tb-result-comment">
          <strong>Комментарий системы:</strong><br>
          ${r.comment}
        </div>

        ${r.missingRequired.length ? `
          <div style="margin-top:16px;">
            <strong>Ключевые доказательства, которые стоило собрать:</strong>
            <ul style="margin:8px 0 0 18px;font-size:14px;color:#333;">
              ${r.missingRequired.slice(0, 7).map(function(item) {
                return `<li>${item}</li>`;
              }).join('')}
            </ul>
          </div>
        ` : ''}

        ${r.noiseEvidence.length ? `
          <div style="margin-top:12px;color:#C62828;">
            <strong>Шумовые выводы:</strong> ${r.noiseEvidence.length}. Часть собранных фактов не помогает раскрытию и может мешать профессиональному суждению.
          </div>
        ` : ''}

        <div class="tb-result-controls">
          <strong>Эффективные контроли:</strong>
          ${r.goodControls.length
            ? `<ul>${r.goodControls.map(function(c) { return `<li>${c.text}</li>`; }).join('')}</ul>`
            : '<p>Не выбрано ни одного сильного контроля.</p>'
          }

          ${r.badControls.length
            ? `
              <div style="margin-top:12px;color:#C62828;">
                <strong>Проблемные решения:</strong>
                <ul>${r.badControls.map(function(c) { return `<li>${c.text}</li>`; }).join('')}</ul>
              </div>
            `
            : ''
          }
        </div>

        <div style="margin-top:16px;font-size:14px;color:#666;">
          <strong>Выбранная гипотеза:</strong> ${r.selectedHyp ? r.selectedHyp.title : 'не выбрана'}<br>
          <strong>Правильная гипотеза:</strong> ${r.correctHyp.title}<br>
          <strong>Уверенность:</strong> ${r.confidence}%<br>
          <strong>Доказательств собрано:</strong> ${Object.keys(gameState.evidence).length}<br>
          <strong>Запросов одобрено:</strong> ${gameState.requestsApproved}<br>
          <strong>Интервью проведено:</strong> ${gameState.completedInterviews}
        </div>

        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
          <a href="/cases" class="tb-btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;">В БИБЛИОТЕКУ КЕЙСОВ</a>
          <button class="tb-btn-secondary" onclick="closeModal()">ОСТАТЬСЯ НА СТРАНИЦЕ</button>
        </div>
      </div>
    </div>
  `;

  openModal(content);
}

/* =================================================================
   ХЕЛПЕРЫ
   ================================================================= */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function show(id, display) {
  const el = document.getElementById(id);
  if (el) el.style.display = display || 'block';
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
</script>
