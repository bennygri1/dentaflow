/**
 * DentaFlow Chat Widget  v2.0
 *
 * Usage — paste before </body> on any clinic website:
 *
 *   <script
 *     src="https://your-domain.com/widget.js"
 *     data-clinic-id="YOUR-CLINIC-UUID"
 *     data-api-url="https://your-domain.com"
 *     data-clinic-name="Smile Studio"
 *     data-color="#2563eb">
 *   </script>
 *
 * Attributes
 * ──────────
 *   data-clinic-id    required  UUID from your DentaFlow profile
 *   data-api-url      required  Base URL of your DentaFlow app (no trailing slash)
 *   data-clinic-name  optional  Shown in the chat header
 *   data-color        optional  Hex primary colour  (default: #2563eb)
 *
 * Events dispatched on window
 * ───────────────────────────
 *   df:open     — chat panel opened
 *   df:message  — user sent a message  (detail: { text })
 *   df:lead     — lead saved           (detail: { id })
 */
(function () {
  /* ── Config ─────────────────────────────────────────────────────────────────
   * Two ways to configure the widget:
   *
   * 1. Attributes on the <script> tag (recommended — works when parsed by browser):
   *      <script src="…/widget.js" data-clinic-id="…" data-api-url="…">
   *
   * 2. window.DentaFlowConfig object (use when script is injected dynamically,
   *    e.g. from WordPress, Webflow, Google Tag Manager):
   *      <script>
   *        window.DentaFlowConfig = {
   *          clinicId: '…', apiUrl: '…', clinicName: '…', color: '#2563eb'
   *        };
   *      </script>
   *      <script src="…/widget.js"></script>
   * ──────────────────────────────────────────────────────────────────────── */
  var scriptTag   = document.currentScript;
  var cfg         = window.DentaFlowConfig || {};

  var CLINIC_ID   = (scriptTag && scriptTag.getAttribute('data-clinic-id'))   || cfg.clinicId   || '';
  var API_BASE    = ((scriptTag && scriptTag.getAttribute('data-api-url'))     || cfg.apiUrl     || '').replace(/\/$/, '');
  var CLINIC_NAME = (scriptTag && scriptTag.getAttribute('data-clinic-name'))  || cfg.clinicName || '';
  var COLOR       = (scriptTag && scriptTag.getAttribute('data-color'))        || cfg.color      || '#2563eb';

  if (!CLINIC_ID || !API_BASE) {
    console.warn('[DentaFlow] Missing clinic-id or api-url. Set data-* attributes on the <script> tag or define window.DentaFlowConfig before loading widget.js.');
    return;
  }

  var CHAT_URL = API_BASE + '/api/chat';

  /* ── State ── */
  var history  = [];   // { role: 'user'|'assistant', content: string }[]
  var thinking = false;
  var leadSaved = false;

  /* ── Analytics ── */
  function emit(name, detail) {
    console.debug('[DentaFlow] ' + name, detail || '');
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  /* ── Colour ── */
  function darken(hex) {
    var n = parseInt(hex.replace('#', ''), 16);
    var r = Math.max(0, (n >> 16) - 25);
    var g = Math.max(0, ((n >> 8) & 0xff) - 25);
    var b = Math.max(0, (n & 0xff) - 25);
    return '#' + [r, g, b].map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }
  var COLOR_DARK = darken(COLOR);

  /* ── Styles ── */
  var style = document.createElement('style');
  style.textContent = [
    /* launcher */
    '#df-btn{position:fixed;bottom:24px;right:24px;z-index:2147483647;',
    'background:' + COLOR + ';color:#fff;border:none;border-radius:999px;',
    'padding:13px 20px;font-size:14px;font-family:system-ui,sans-serif;',
    'font-weight:600;cursor:pointer;',
    'box-shadow:0 4px 24px rgba(0,0,0,0.22);transition:background .15s,transform .15s}',
    '#df-btn:hover{background:' + COLOR_DARK + ';transform:translateY(-1px)}',

    /* panel */
    '#df-panel{display:none;position:fixed;bottom:80px;right:24px;z-index:2147483646;',
    'width:360px;height:520px;background:#fff;border-radius:16px;flex-direction:column;',
    'box-shadow:0 8px 48px rgba(0,0,0,0.18);font-family:system-ui,sans-serif;overflow:hidden}',
    '#df-panel.df-open{display:flex}',

    /* header */
    '#df-hd{background:' + COLOR + ';color:#fff;padding:14px 16px;font-size:14px;',
    'font-weight:600;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#df-hd-avatar{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);',
    'display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}',
    '#df-hd-info{flex:1;min-width:0}',
    '#df-hd-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#df-hd-status{font-size:11px;font-weight:400;opacity:.75;margin-top:1px}',
    '#df-x{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;',
    'line-height:1;opacity:.7;padding:4px;flex-shrink:0}#df-x:hover{opacity:1}',

    /* messages */
    '#df-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px}',
    '#df-msgs::-webkit-scrollbar{width:4px}',
    '#df-msgs::-webkit-scrollbar-track{background:transparent}',
    '#df-msgs::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px}',

    /* bubbles */
    '.df-row{display:flex;align-items:flex-end;gap:7px}',
    '.df-row.df-user{flex-direction:row-reverse}',
    '.df-avatar{width:26px;height:26px;border-radius:50%;',
    'display:flex;align-items:center;justify-content:center;font-size:13px;',
    'flex-shrink:0;background:#f3f4f6}',
    '.df-bubble{max-width:80%;padding:9px 12px;border-radius:14px;font-size:13px;',
    'line-height:1.45;word-wrap:break-word}',
    '.df-bot .df-bubble{background:#f3f4f6;color:#111;border-bottom-left-radius:4px}',
    '.df-user .df-bubble{background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px}',

    /* lead saved notice */
    '.df-notice{text-align:center;font-size:11px;color:#6b7280;',
    'padding:4px 10px;background:#f9fafb;border-radius:999px;',
    'border:1px solid #e5e7eb;align-self:center;margin:2px 0}',

    /* typing indicator */
    '#df-typing{display:none;padding:9px 12px;background:#f3f4f6;border-radius:14px;',
    'border-bottom-left-radius:4px;width:44px}',
    '#df-typing span{display:inline-block;width:6px;height:6px;border-radius:50%;',
    'background:#9ca3af;animation:df-bounce 1.2s infinite}',
    '#df-typing span:nth-child(2){animation-delay:.2s}',
    '#df-typing span:nth-child(3){animation-delay:.4s}',
    '@keyframes df-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}',

    /* input row */
    '#df-foot{padding:10px 12px;border-top:1px solid #f3f4f6;display:flex;gap:8px;flex-shrink:0}',
    '#df-input{flex:1;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:999px;',
    'font-size:13px;font-family:system-ui,sans-serif;color:#111;background:#f9fafb;',
    'outline:none;transition:border-color .15s}',
    '#df-input:focus{border-color:' + COLOR + ';background:#fff}',
    '#df-send{width:36px;height:36px;border-radius:50%;background:' + COLOR + ';',
    'border:none;color:#fff;cursor:pointer;display:flex;align-items:center;',
    'justify-content:center;flex-shrink:0;transition:background .15s;padding:0}',
    '#df-send:hover:not(:disabled){background:' + COLOR_DARK + '}',
    '#df-send:disabled{opacity:.5;cursor:not-allowed}',
  ].join('');
  document.head.appendChild(style);

  /* ── DOM ── */
  var clinicLabel = CLINIC_NAME || 'Dental Clinic';
  var html = [
    '<button id="df-btn" aria-label="Open chat">&#x1F4AC; Chat with us</button>',
    '<div id="df-panel" role="dialog" aria-modal="true" aria-label="Chat with ' + clinicLabel + '">',
    '  <div id="df-hd">',
    '    <div id="df-hd-avatar">&#x1F9BA;</div>',
    '    <div id="df-hd-info">',
    '      <div id="df-hd-name">' + clinicLabel + '</div>',
    '      <div id="df-hd-status">&#x1F7E2; Online &mdash; usually replies instantly</div>',
    '    </div>',
    '    <button id="df-x" aria-label="Close">&#x2715;</button>',
    '  </div>',
    '  <div id="df-msgs" role="log" aria-live="polite"></div>',
    '  <div id="df-foot">',
    '    <input id="df-input" type="text" placeholder="Type a message\u2026"',
    '           autocomplete="off" maxlength="500" aria-label="Chat message" />',
    '    <button id="df-send" aria-label="Send">',
    '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"',
    '           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">',
    '        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9"/>',
    '      </svg>',
    '    </button>',
    '  </div>',
    '</div>',
  ].join('');

  var wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  /* ── Element refs ── */
  var btn    = document.getElementById('df-btn');
  var panel  = document.getElementById('df-panel');
  var close  = document.getElementById('df-x');
  var msgs   = document.getElementById('df-msgs');
  var input  = document.getElementById('df-input');
  var send   = document.getElementById('df-send');

  /* ── Greeting (shown without an API call) ── */
  var GREETING = CLINIC_NAME
    ? 'Hi there! \uD83D\uDC4B I\'m the virtual assistant for ' + CLINIC_NAME + '. How can I help you today?'
    : 'Hi there! \uD83D\uDC4B I\'m here to help you book a dental appointment or answer any questions. How can I help?';

  /* ── Render helpers ── */
  function scrollToBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function appendBotMessage(text) {
    var row = document.createElement('div');
    row.className = 'df-row df-bot';
    row.innerHTML = [
      '<div class="df-avatar">&#x1F9BA;</div>',
      '<div class="df-bubble">' + escHtml(text) + '</div>',
    ].join('');
    msgs.appendChild(row);
    scrollToBottom();
  }

  function appendUserMessage(text) {
    var row = document.createElement('div');
    row.className = 'df-row df-user';
    row.innerHTML = '<div class="df-bubble">' + escHtml(text) + '</div>';
    msgs.appendChild(row);
    scrollToBottom();
  }

  function appendNotice(text) {
    var el = document.createElement('div');
    el.className = 'df-notice';
    el.textContent = text;
    msgs.appendChild(el);
    scrollToBottom();
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'df-row df-bot';
    row.id = 'df-typing-row';
    row.innerHTML = [
      '<div class="df-avatar">&#x1F9BA;</div>',
      '<div id="df-typing">',
      '<span></span><span></span><span></span>',
      '</div>',
    ].join('');
    msgs.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    var row = document.getElementById('df-typing-row');
    if (row) row.parentNode.removeChild(row);
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  function setInputEnabled(enabled) {
    input.disabled = !enabled;
    send.disabled  = !enabled;
  }

  /* ── Open / close ── */
  var opened = false;

  function openPanel() {
    panel.classList.add('df-open');
    input.focus();
    if (!opened) {
      opened = true;
      appendBotMessage(GREETING);
      history.push({ role: 'assistant', content: GREETING });
    }
    emit('df:open');
  }

  function closePanel() {
    panel.classList.remove('df-open');
  }

  btn.addEventListener('click', function () {
    panel.classList.contains('df-open') ? closePanel() : openPanel();
  });
  close.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePanel();
  });
  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== btn) closePanel();
  });

  /* ── Send message ── */
  function sendMessage() {
    var text = input.value.trim();
    if (!text || thinking) return;

    input.value = '';
    appendUserMessage(text);
    history.push({ role: 'user', content: text });
    emit('df:message', { text: text });

    thinking = true;
    setInputEnabled(false);
    showTyping();

    fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id:   CLINIC_ID,
        clinic_name: CLINIC_NAME,
        messages:    history,
      }),
    })
    .then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.error || 'Something went wrong.');
        return json;
      });
    })
    .then(function (json) {
      hideTyping();
      var reply = json.message || '';
      if (reply) {
        appendBotMessage(reply);
        history.push({ role: 'assistant', content: reply });
      }
      if (json.leadSaved && !leadSaved) {
        leadSaved = true;
        appendNotice('\u2714\uFE0F Your details have been saved — the team will be in touch soon.');
        emit('df:lead', { id: json.leadId });
      }
    })
    .catch(function (e) {
      hideTyping();
      appendBotMessage("Sorry, I couldn\u2019t send that. Please try again.");
      console.error('[DentaFlow]', e);
    })
    .finally(function () {
      thinking = false;
      setInputEnabled(true);
      input.focus();
    });
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
