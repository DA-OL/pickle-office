/* ─────────────────────────────────────────────
   비서실 · 다올 & 똑똑이
   정적 페이지 + data/status.json + (선택) Firebase RTDB
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── 상수 ────────────────────────────────── */

  const ROOMS = {
    meeting: {
      name: '회의실',
      en: 'Meeting Room',
      desc: '약속과 일정을 모아 두는 방이에요. 행사가 열리거나 답을 기다릴 일이 있으면 똑똑이가 여기서 살펴요.',
      line: '약속과 일정을 살펴보고 있어요.'
    },
    work: {
      name: '작업실',
      en: 'Work Desk',
      desc: '똑똑이가 하루의 대부분을 보내는 책상이에요. 감시와 전달, 모니터링이 여기서 돌아가요.',
      line: '책상에 앉아 일하고 있어요.'
    },
    archive: {
      name: '자료실',
      en: 'Archive',
      desc: '원고와 기록을 모아 두는 방이에요. 지난 일을 다시 꺼내 볼 때 찾아가요.',
      line: '기록을 정리하고 있어요.'
    },
    lounge: {
      name: '휴게실',
      en: 'Lounge',
      desc: '잠깐 쉬어 가는 소파 자리예요. 급한 일이 없으면 똑똑이가 여기서 기다려요.',
      line: '여기서 쉬면서 기다리고 있어요.'
    }
  };

  const ROOM_POS = {
    meeting: { x: 25, y: 38 },
    work: { x: 75, y: 38 },
    archive: { x: 25, y: 88 },
    lounge: { x: 75, y: 88 }
  };

  const STATE = {
    running: { text: '진행 중', cls: 'is-running' },
    waiting: { text: '대기', cls: 'is-waiting' },
    done: { text: '완료', cls: 'is-done' },
    idle: { text: '쉬는 중', cls: 'is-idle' }
  };

  const TALK_LINES = [
    '부르셨어요?',
    '여기 있어요!',
    '네, 듣고 있어요.',
    '필요한 거 있으면 말해 주세요.'
  ];

  const LS_MSG = 'pickle-office:messages:v1';
  const LS_DB = 'pickle-office:firebase:v1';
  const LS_THEME = 'pickle-office:theme:v1';

  /* ── 요소 ────────────────────────────────── */

  const $ = (sel) => document.querySelector(sel);
  const el = {
    clockTime: $('#clock-time'),
    clockDate: $('#clock-date'),
    themeBtn: $('#btn-theme'),
    settingsBtn: $('#btn-settings'),
    office: $('#office'),
    officePill: $('#office-pill'),
    bubble: $('#bubble'),
    bubbleText: $('#bubble-text'),
    bubbleTail: $('.bubble-tail'),
    rooms: $('#rooms'),
    character: $('#character'),
    roomDetail: $('#room-detail'),
    statusUpdated: $('#status-updated'),
    summaryRow: $('#summary-row'),
    taskList: $('#task-list'),
    refreshBtn: $('#btn-refresh'),
    chat: $('#chat'),
    composer: $('#composer'),
    memoInput: $('#memo-input'),
    memoMode: $('#memo-mode'),
    dialog: $('#settings-dialog'),
    dbUrl: $('#db-url'),
    dbStatus: $('#db-status'),
    dbSave: $('#btn-db-save'),
    dbDisconnect: $('#btn-db-disconnect'),
    dbClearLocal: $('#btn-clear-local'),
    closeSettings: $('#btn-close-settings')
  };

  /* ── 상태 ────────────────────────────────── */

  let status = null;
  let currentRoom = 'work';
  let selectedRoom = null;
  let lastInteract = 0;
  let sayTimer = null;
  let messages = [];
  let dbUrl = '';
  let pollTimer = null;
  let syncing = false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 유틸 ────────────────────────────────── */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function relTime(iso) {
    const t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return min + '분 전';
    const hour = Math.round(min / 60);
    if (hour < 24) return hour + '시간 전';
    return Math.round(hour / 24) + '일 전';
  }

  function absTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      hour12: false, timeZone: 'Asia/Seoul'
    }).formatToParts(d);
    const get = (type) => (p.find((x) => x.type === type) || {}).value || '';
    return `${get('month')}월 ${get('day')}일 ${get('hour')}:${get('minute')}`;
  }

  function hhmm(ts) {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const p = new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'
    }).formatToParts(d);
    const get = (type) => (p.find((x) => x.type === type) || {}).value || '';
    return `${get('hour')}:${get('minute')}`;
  }

  function bump() { lastInteract = Date.now(); }

  /* ── 테마 ────────────────────────────────── */

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(LS_THEME); } catch (e) { /* ignore */ }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1B1813' : '#FBF3E4');
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(LS_THEME, next); } catch (e) { /* ignore */ }
  }

  /* ── 시계 ────────────────────────────────── */

  const WEEKDAY = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' };

  function tickClock() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      month: 'numeric', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'
    }).formatToParts(now);
    const get = (type) => (parts.find((x) => x.type === type) || {}).value || '';
    el.clockTime.textContent = `${get('hour')}:${get('minute')}`;
    el.clockDate.textContent = `${get('month')}월 ${get('day')}일 (${WEEKDAY[get('weekday')] || get('weekday')})`;
  }

  /* ── 말풍선 · 캐릭터 이동 ────────────────── */

  function say(text) {
    if (!text) return;
    if (el.bubbleText.textContent === text) return;
    el.bubble.classList.add('is-swapping');
    window.clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => {
      el.bubbleText.textContent = text;
      el.bubbleText.title = text;
      el.bubble.classList.remove('is-swapping');
    }, 150);
  }

  function tasksIn(room) {
    return (status && Array.isArray(status.tasks) ? status.tasks : [])
      .filter((t) => (t.room || 'work') === room);
  }

  function sayForRoom(room) {
    const list = tasksIn(room);
    const running = list.find((t) => t.state === 'running');
    const waiting = list.find((t) => t.state === 'waiting');
    const pick = running || waiting || list[0];
    if (pick && pick.note) say(pick.note);
    else if (pick) say(pick.label);
    else say((ROOMS[room] || {}).line || '여기 있어요.');
  }

  function updateTail() {
    const pos = ROOM_POS[currentRoom];
    if (!pos || !el.bubbleTail) return;
    const roomsRect = el.rooms.getBoundingClientRect();
    const bubbleRect = el.bubble.getBoundingClientRect();
    if (!roomsRect.width || !bubbleRect.width) return;
    const target = roomsRect.left + roomsRect.width * (pos.x / 100) - bubbleRect.left;
    const left = Math.max(15, Math.min(bubbleRect.width - 15, target));
    el.bubble.style.setProperty('--tail-x', left + 'px');
  }

  function moveTo(room) {
    if (!ROOM_POS[room]) return;
    const changed = room !== currentRoom;
    currentRoom = room;
    const pos = ROOM_POS[room];
    el.character.style.left = pos.x + '%';
    el.character.style.top = pos.y + '%';
    if (changed) {
      el.character.classList.add('walking');
      window.setTimeout(() => el.character.classList.remove('walking'), reduceMotion ? 20 : 980);
    }
    flagRooms();
    updateTail();
  }

  function flagRooms() {
    el.rooms.querySelectorAll('.room').forEach((btn) => {
      const here = btn.dataset.room === currentRoom;
      btn.classList.toggle('is-here', here);
      const tag = btn.querySelector('.here-tag');
      if (tag) tag.hidden = !here;
      if (here) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  /* ── 방 상세 ─────────────────────────────── */

  function renderRoomDetail(key) {
    const room = ROOMS[key];
    if (!room) return;
    const list = tasksIn(key);
    const rows = list.map((t) => {
      const st = STATE[t.state] || STATE.idle;
      return `<div class="rd-task">
        <span class="dot ${st.cls}"></span>
        <span class="name">${esc(t.label)}</span>
        <span class="when">${esc(t.schedule || '')}</span>
      </div>`;
    }).join('');

    el.roomDetail.innerHTML = `
      <div class="rd-head">
        <h3>${esc(room.name)}</h3>
        <span class="rd-en">${esc(room.en)}</span>
        <button class="rd-close" type="button" data-close="1" aria-label="상세 닫기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <p class="rd-desc">${esc(room.desc)}</p>
      ${rows ? `<div class="rd-tasks">${rows}</div>` : '<p class="rd-empty">지금은 이 방에 걸린 일이 없어요.</p>'}
    `;
    el.roomDetail.hidden = false;
  }

  function renderCharacterDetail() {
    const mood = (status && status.assistant && status.assistant.mood) || '대기';
    const line = (status && status.assistant && status.assistant.line) || '여기 있어요.';
    const running = (status && Array.isArray(status.tasks) ? status.tasks : [])
      .filter((t) => t.state === 'running');

    el.roomDetail.innerHTML = `
      <div class="rd-head">
        <h3>똑똑이</h3>
        <span class="rd-en">${esc(mood)}</span>
        <button class="rd-close" type="button" data-close="1" aria-label="상세 닫기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <p class="rd-desc">${esc(line)} ${esc((ROOMS[currentRoom] || {}).name || '')}에 있어요.</p>
      ${running.length
        ? `<div class="rd-tasks">${running.map((t) => `
            <div class="rd-task">
              <span class="dot is-running"></span>
              <span class="name">${esc(t.label)}</span>
              <span class="when">${esc(t.schedule || '')}</span>
            </div>`).join('')}</div>`
        : '<p class="rd-empty">지금은 돌고 있는 일이 없어요. 메모를 남겨 주세요.</p>'}
    `;
    el.roomDetail.hidden = false;
  }

  function openRoom(key) {
    selectedRoom = key;
    bump();
    moveTo(key);
    sayForRoom(key);
    renderRoomDetail(key);
  }

  /* ── 현황판 ──────────────────────────────── */

  function skeleton() {
    el.taskList.innerHTML = '<li class="skeleton"></li><li class="skeleton"></li><li class="skeleton"></li>';
    el.summaryRow.innerHTML = '';
  }

  function renderStatus() {
    const tasks = (status && Array.isArray(status.tasks)) ? status.tasks : [];
    const counts = { running: 0, waiting: 0, done: 0, idle: 0 };
    tasks.forEach((t) => { if (counts[t.state] != null) counts[t.state] += 1; });

    if (status && status.updatedAt) {
      el.statusUpdated.textContent = `${relTime(status.updatedAt)} 업데이트 · ${absTime(status.updatedAt)} 기준`;
    } else {
      el.statusUpdated.textContent = '방금 불러옴';
    }

    el.summaryRow.innerHTML = [
      ['running', '진행 중', counts.running],
      ['waiting', '대기', counts.waiting],
      ['done', '완료', counts.done]
    ].map(([cls, label, n]) => `
      <span class="sum-chip"><i class="dot ${STATE[cls].cls}"></i>${label} <b>${n}</b></span>
    `).join('');

    if (!tasks.length) {
      el.taskList.innerHTML = '<li class="status-error">아직 등록된 작업이 없어요.<br>data/status.json에 작업을 적어 주세요.</li>';
      return;
    }

    el.taskList.innerHTML = tasks.map((t) => {
      const st = STATE[t.state] || STATE.idle;
      const meta = [];
      if (t.schedule) meta.push(esc(t.schedule));
      if (t.lastRun) meta.push('최근 ' + esc(t.lastRun));
      return `<li class="task">
        <span class="task-dot ${st.cls}"></span>
        <div class="task-main">
          <div class="task-name" title="${esc(t.label)}">${esc(t.label)}</div>
          <div class="task-meta">${meta.join('<span class="sep">·</span>')}</div>
        </div>
        <span class="task-state ${st.cls}">${st.text}</span>
      </li>`;
    }).join('');
  }

  function renderStatusError() {
    el.statusUpdated.textContent = '현황을 불러오지 못했어요';
    el.summaryRow.innerHTML = '';
    el.taskList.innerHTML = `<li class="status-error">
      data/status.json을 읽을 수 없어요.<br>잠시 뒤 다시 시도해 주세요.
      <br><button type="button" data-retry="1">다시 불러오기</button>
    </li>`;
  }

  function renderRooms() {
    const tasks = (status && Array.isArray(status.tasks)) ? status.tasks : [];
    Object.keys(ROOMS).forEach((key) => {
      const list = tasks.filter((t) => (t.room || 'work') === key);
      const active = list.filter((t) => t.state === 'running' || t.state === 'waiting');
      const running = list.filter((t) => t.state === 'running').length;
      const waiting = list.filter((t) => t.state === 'waiting').length;

      const badge = el.rooms.querySelector(`[data-badge="${key}"]`);
      if (badge) {
        badge.hidden = active.length === 0;
        badge.textContent = String(active.length);
      }

      const holder = el.rooms.querySelector(`[data-room-state="${key}"]`);
      if (holder) {
        let text = '한가함';
        let cls = 'is-idle';
        if (running) { text = `진행 ${running}`; cls = 'is-running'; }
        else if (waiting) { text = `대기 ${waiting}`; cls = 'is-waiting'; }
        else if (list.length) { text = '정리됨'; cls = 'is-done'; }
        const dot = holder.querySelector('.dot');
        const label = holder.querySelector('span');
        if (dot) dot.className = 'dot ' + cls;
        if (label) label.textContent = text;
      }
    });
  }

  function renderAssistantPill() {
    const mood = (status && status.assistant && status.assistant.mood) || '대기';
    const running = (status && Array.isArray(status.tasks) ? status.tasks : [])
      .filter((t) => t.state === 'running').length;
    el.officePill.textContent = `똑똑이 · ${mood}`;
    el.officePill.classList.toggle('is-idle', running === 0);
  }

  async function loadStatus(silent) {
    if (!silent) skeleton();
    el.refreshBtn.classList.add('is-busy');
    try {
      const res = await fetch('data/status.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      status = await res.json();
      renderStatus();
      renderRooms();
      renderAssistantPill();
      const running = (status.tasks || []).find((t) => t.state === 'running');
      if (!silent) {
        if (running && !selectedRoom) moveTo(running.room || 'work');
        sayForRoom(currentRoom);
      }
      if (selectedRoom) renderRoomDetail(selectedRoom);
    } catch (err) {
      if (!silent) renderStatusError();
      el.statusUpdated.textContent = '현황을 불러오지 못했어요';
    } finally {
      window.setTimeout(() => el.refreshBtn.classList.remove('is-busy'), 350);
    }
  }

  /* ── 메모 보드 ────────────────────────────── */

  function dbEndpoint() {
    return dbUrl.replace(/\/+$/, '') + '/office/messages.json';
  }

  function normalizeDb(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s.replace(/\/+$/, '');
  }

  function validDb(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      return /\.firebaseio\.com$/.test(u.hostname) || /\.firebasedatabase\.app$/.test(u.hostname);
    } catch (e) {
      return false;
    }
  }

  function setMemoMode(mode, detail) {
    el.memoMode.classList.remove('is-local', 'is-db', 'is-err');
    if (mode === 'db') {
      el.memoMode.textContent = 'Firebase 연결됨';
      el.memoMode.classList.add('is-db');
      el.memoMode.title = '폰과 PC가 같은 보드를 봐요';
    } else if (mode === 'err') {
      el.memoMode.textContent = '연결 안 됨';
      el.memoMode.classList.add('is-err');
      el.memoMode.title = detail || 'Firebase 주소와 규칙을 확인해 주세요';
    } else {
      el.memoMode.textContent = '이 기기에만 저장';
      el.memoMode.classList.add('is-local');
      el.memoMode.title = '브라우저 localStorage에 저장돼요';
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_MSG);
      const parsed = raw ? JSON.parse(raw) : [];
      messages = Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.text === 'string') : [];
    } catch (e) {
      messages = [];
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(LS_MSG, JSON.stringify(messages.slice(-200)));
    } catch (e) { /* 저장 공간이 가득 찼을 때 조용히 넘어감 */ }
  }

  function greetingText() {
    return dbUrl
      ? '여기에 적은 메모가 폰과 PC에 함께 보여요.'
      : '무엇이든 적어 두세요. 이 기기에 저장해 둘게요.';
  }

  function messageEl(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'msg is-me';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = msg.text;

    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = hhmm(msg.ts || Date.now());

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    return wrap;
  }

  function renderChat() {
    el.chat.innerHTML = '';

    // 똑똑이 인사말 (저장되지 않는 고정 말풍선)
    const hello = document.createElement('div');
    hello.className = 'msg';
    hello.innerHTML = `<span class="msg-avatar" aria-hidden="true">
        <svg viewBox="0 0 40 40"><path d="M29 12H15.5C11.9 12 9 14.9 9 18.5V23c0 3.6 2.9 6.5 6.5 6.5H29"
          fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/></svg>
      </span>`;
    const helloBubble = document.createElement('div');
    helloBubble.className = 'msg-bubble';
    helloBubble.textContent = greetingText();
    hello.appendChild(helloBubble);
    el.chat.appendChild(hello);

    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty';
      empty.innerHTML = '<b>아직 적어 둔 메모가 없어요.</b><span>똑똑이에게 남길 말을 한 줄 적어 보세요.</span>';
      el.chat.appendChild(empty);
      return;
    }

    messages.forEach((m) => el.chat.appendChild(messageEl(m)));
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  async function remoteLoad() {
    const res = await fetch(dbEndpoint() + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data).map((key) => {
      const v = data[key] || {};
      return { id: key, text: String(v.text || ''), ts: Number(v.ts) || 0 };
    }).filter((m) => m.text).sort((a, b) => a.ts - b.ts);
  }

  async function remoteSend(msg) {
    const res = await fetch(dbEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg.text, ts: msg.ts })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  async function syncRemote() {
    if (!dbUrl || syncing) return;
    syncing = true;
    try {
      const remote = await remoteLoad();
      const same = remote.length === messages.length &&
        remote.every((m, i) => messages[i] && messages[i].id === m.id && messages[i].text === m.text);
      if (!same) {
        messages = remote;
        renderChat();
      }
      setMemoMode('db');
    } catch (err) {
      setMemoMode('err');
    } finally {
      syncing = false;
    }
  }

  function startPolling() {
    stopPolling();
    if (!dbUrl) return;
    pollTimer = window.setInterval(() => {
      if (!document.hidden) syncRemote();
    }, 4000);
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function addMessage(text) {
    const msg = { id: uid(), text: text, ts: Date.now() };
    messages.push(msg);
    if (messages.length > 200) messages = messages.slice(-200);

    if (dbUrl) {
      renderChat();
      try {
        await remoteSend(msg);
        window.setTimeout(syncRemote, 350);
      } catch (err) {
        setMemoMode('err', '저장에 실패했어요. 주소와 DB 규칙을 확인해 주세요.');
      }
    } else {
      saveLocal();
      renderChat();
    }
  }

  function autosize() {
    el.memoInput.style.height = 'auto';
    el.memoInput.style.height = Math.min(el.memoInput.scrollHeight, 118) + 'px';
  }

  /* ── 설정 ────────────────────────────────── */

  function openSettings() {
    el.dbUrl.value = dbUrl;
    el.dbStatus.textContent = dbUrl
      ? '현재: Firebase에 연결됨 · 저장 위치 /office/messages'
      : '현재: 이 브라우저에만 저장';
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
    window.setTimeout(() => el.dbUrl.focus(), 60);
  }

  function closeSettings() {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
  }

  async function saveDb() {
    const next = normalizeDb(el.dbUrl.value);
    if (!next) {
      el.dbStatus.textContent = '주소가 비어 있어요. 이 기기에만 저장합니다.';
      return;
    }
    if (!validDb(next)) {
      el.dbStatus.textContent = 'Firebase Realtime Database 주소가 아니에요. 예: https://내프로젝트-default-rtdb.firebaseio.com';
      return;
    }
    dbUrl = next;
    try { localStorage.setItem(LS_DB, dbUrl); } catch (e) { /* ignore */ }
    el.dbStatus.textContent = '연결을 확인하는 중…';
    try {
      await remoteLoad();
      setMemoMode('db');
      el.dbStatus.textContent = '연결됐어요 · 저장 위치 /office/messages';
      await syncRemote();
      startPolling();
      closeSettings();
    } catch (err) {
      setMemoMode('err');
      el.dbStatus.textContent = '주소는 저장했지만 읽지 못했어요. DB 규칙(읽기/쓰기 허용)을 확인해 주세요.';
      renderChat();
    }
  }

  function disconnectDb() {
    dbUrl = '';
    try { localStorage.removeItem(LS_DB); } catch (e) { /* ignore */ }
    stopPolling();
    setMemoMode('local');
    loadLocal();
    renderChat();
    el.dbStatus.textContent = '연결을 끊었어요. 이제 이 브라우저에만 저장합니다.';
    el.dbUrl.value = '';
  }

  function clearLocal() {
    if (!window.confirm('이 기기에 저장된 메모를 모두 지울까요? 되돌릴 수 없어요.')) return;
    try { localStorage.removeItem(LS_MSG); } catch (e) { /* ignore */ }
    if (!dbUrl) {
      messages = [];
      renderChat();
      el.dbStatus.textContent = '이 기기의 메모를 지웠어요.';
    } else {
      el.dbStatus.textContent = 'Firebase에 저장된 메모는 여기서 지울 수 없어요. 콘솔에서 정리해 주세요.';
    }
  }

  /* ── 이벤트 ──────────────────────────────── */

  function bind() {
    el.themeBtn.addEventListener('click', toggleTheme);
    el.settingsBtn.addEventListener('click', openSettings);
    el.memoMode.addEventListener('click', openSettings);
    el.closeSettings.addEventListener('click', closeSettings);

    el.dialog.addEventListener('click', (e) => {
      if (e.target === el.dialog) closeSettings();
    });

    el.dbSave.addEventListener('click', saveDb);
    el.dbDisconnect.addEventListener('click', disconnectDb);
    el.dbClearLocal.addEventListener('click', clearLocal);

    el.dbUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveDb(); }
    });

    el.rooms.addEventListener('click', (e) => {
      const room = e.target.closest('.room');
      if (room) openRoom(room.dataset.room);
    });

    el.character.addEventListener('click', () => {
      bump();
      selectedRoom = null;
      el.character.classList.remove('hop');
      void el.character.offsetWidth;
      el.character.classList.add('hop');
      window.setTimeout(() => el.character.classList.remove('hop'), 600);
      say(TALK_LINES[Math.floor(Math.random() * TALK_LINES.length)]);
      renderCharacterDetail();
    });

    el.character.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.character.click();
      }
    });

    el.roomDetail.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        el.roomDetail.hidden = true;
        selectedRoom = null;
      }
    });

    el.refreshBtn.addEventListener('click', () => loadStatus(false));

    el.taskList.addEventListener('click', (e) => {
      if (e.target.closest('[data-retry]')) loadStatus(false);
    });

    el.composer.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el.memoInput.value.trim();
      if (!text) return;
      el.memoInput.value = '';
      autosize();
      addMessage(text);
    });

    el.memoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        el.composer.requestSubmit
          ? el.composer.requestSubmit()
          : el.composer.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    el.memoInput.addEventListener('input', autosize);

    window.addEventListener('resize', updateTail);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadStatus(true);
        if (dbUrl) syncRemote();
      }
    });
  }

  /* ── 똑똑이 배회 ─────────────────────────── */

  function pickWanderRoom() {
    const list = (status && Array.isArray(status.tasks) ? status.tasks : []);
    const runningRooms = list.filter((t) => t.state === 'running').map((t) => t.room || 'work');
    const others = Object.keys(ROOMS).filter((r) => r !== currentRoom);
    const pool = runningRooms.filter((r) => r !== currentRoom && ROOMS[r]);
    if (pool.length && Math.random() < 0.62) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return others[Math.floor(Math.random() * others.length)];
  }

  function startWander() {
    if (reduceMotion) return;
    window.setInterval(() => {
      if (document.hidden) return;
      if (selectedRoom) return;
      if (Date.now() - lastInteract < 14000) return;
      const next = pickWanderRoom();
      if (!next || next === currentRoom) return;
      moveTo(next);
      sayForRoom(next);
    }, 15000);
  }

  /* ── 시작 ────────────────────────────────── */

  function init() {
    initTheme();
    tickClock();
    window.setInterval(tickClock, 20000);

    try { dbUrl = localStorage.getItem(LS_DB) || ''; } catch (e) { dbUrl = ''; }
    if (dbUrl && !validDb(dbUrl)) dbUrl = '';

    loadLocal();
    setMemoMode(dbUrl ? 'db' : 'local');
    renderChat();
    autosize();

    bind();
    moveTo('work');
    say('안녕하세요, 다올님. 똑똑이예요.');
    loadStatus(false);
    startWander();

    if (dbUrl) {
      syncRemote();
      startPolling();
    }

    window.setInterval(() => {
      if (!document.hidden) loadStatus(true);
    }, 90000);

    window.setInterval(() => {
      if (status && status.updatedAt) renderStatus();
    }, 45000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
