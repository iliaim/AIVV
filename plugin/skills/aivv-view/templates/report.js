(function () {
  'use strict';
  // Search (debounced 250ms — sits ~150ms below the Doherty Threshold of 400ms
  // per Doherty & Thadani, IBM Systems Journal 1982 — <https://lawsofux.com/doherty-threshold/>.
  // 250ms is comfortably inside Doherty's responsive band while not so aggressive
  // that it triggers per-keystroke filter passes during typical typing speeds.)
  var searchT;
  var search = document.getElementById('search');
  var cards = document.querySelectorAll('.card');
  var liveRegion = document.getElementById('a11y-live');
  var countChip = liveRegion;
  var queuedFindingIds = {};
  var queuePending = false;

  function applyFilters() {
    var q = (search ? search.value : '').toLowerCase();
    var hideResolvedEl = document.getElementById('hide-resolved');
    var hideResolved = hideResolvedEl ? hideResolvedEl.checked : false;
    var decisionsOnlyEl = document.getElementById('decisions-only');
    var decisionsOnly = decisionsOnlyEl ? decisionsOnlyEl.checked : false;
    var main = document.querySelector('main');
    var visibleSev = main ? (main.dataset.severityVisible || '') : '';
    var n = 0;
    cards.forEach(function (c) {
      var text = (c.textContent || '').toLowerCase();
      var sev = c.getAttribute('data-severity') || '';
      var hasDecision = c.getAttribute('data-has-decision') === 'true' || !!c.querySelector('.decision-capture');
      var state = c.getAttribute('data-resolution') || '';
      var resolved = state === 'addressed_unverified' || state === 'verified_resolved';
      var ok = text.indexOf(q) !== -1;
      if (hideResolved && resolved) ok = false;
      if (decisionsOnly && !hasDecision) ok = false;
      if (visibleSev && visibleSev !== 'all' && visibleSev.indexOf(sev) === -1) ok = false;
      c.hidden = !ok;
      if (ok) n++;
    });
    if (liveRegion) liveRegion.textContent = n + ' findings shown';
  }

  function openHashTarget() {
    if (!window.location.hash) return;
    var target = document.getElementById(window.location.hash.slice(1));
    if (!target || !target.classList || !target.classList.contains('card')) return;
    target.open = true;
    var summary = target.querySelector('summary');
    target.scrollIntoView({ block: 'start' });
    if (summary && typeof summary.focus === 'function') {
      summary.setAttribute('tabindex', '-1');
      summary.focus();
    }
  }

  if (search) search.addEventListener('input', function () {
    clearTimeout(searchT);
    searchT = setTimeout(applyFilters, 250);
  });
  document.querySelectorAll('.chip-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var main = document.querySelector('main');
      if (!main) return;
      // Toggle severity filter via main[data-severity-visible] attribute
      var cur = (main.dataset.severityVisible || '').split(' ').filter(Boolean);
      // Reset 'all' sentinel on first toggle
      if (cur.length === 1 && cur[0] === 'all') cur = [];
      var s = b.getAttribute('data-severity');
      var idx = cur.indexOf(s);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(s);
      main.dataset.severityVisible = cur.length === 0 ? 'all' : cur.join(' ');
      // Update aria-pressed on every chip-toggle to reflect post-toggle visibility
      // ('all' means every severity is visible; otherwise each chip's severity is
      // pressed iff it appears in `cur`).
      var allVisible = cur.length === 0;
      document.querySelectorAll('.chip-toggle').forEach(function (chip) {
        var sev = chip.getAttribute('data-severity');
        chip.setAttribute('aria-pressed', String(allVisible || cur.indexOf(sev) >= 0));
      });
      applyFilters();
    });
  });
  ['hide-resolved', 'decisions-only'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
  window.addEventListener('hashchange', openHashTarget);
  openHashTarget();

  function selectedDecision(card) {
    var checked = card.querySelector('.decision-capture input[type="radio"]:checked');
    if (!checked) return null;
    var notes = card.querySelector('.decision-capture textarea');
    return {
      finding_id: card.getAttribute('data-finding-id') || '',
      finding_fingerprint: card.getAttribute('data-fingerprint') || null,
      decision: checked.value,
      notes: notes && notes.value ? notes.value : null
    };
  }

  function actionConfig() {
    var main = document.querySelector('main');
    if (!main) return null;
    var endpoint = main.getAttribute('data-action-endpoint') || '';
    var token = main.getAttribute('data-action-token') || '';
    return endpoint && token ? { endpoint: endpoint, token: token } : null;
  }

  function selectedFixDecisions() {
    var selected = [];
    cards.forEach(function (card) {
      var decision = selectedDecision(card);
      if (decision && decision.finding_id && decision.decision === 'fix' && !queuedFindingIds[decision.finding_id]) selected.push(decision);
    });
    return selected;
  }

  function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function quotedArgument(value) {
    // The handoff is deliberately copy/pasteable in a POSIX shell. Double
    // quotes still permit `$`, backticks, and command substitution; use the
    // canonical single-quote splice for literal shell arguments instead.
    return "'" + String(value).replace(/'/g, "'\"'\"'") + "'";
  }

  function renderBatchAction() {
    var config = actionConfig();
    var bar = document.getElementById('batch-action-bar');
    var count = document.getElementById('batch-selection-count');
    var button = document.getElementById('queue-remediation');
    if (!config || !bar || !count || !button) return;
    var selected = selectedFixDecisions();
    bar.hidden = false;
    count.textContent = selected.length + ' finding' + (selected.length === 1 ? '' : 's') + ' selected';
    button.disabled = queuePending || selected.length === 0;
  }

  function queueRemediation(decisions) {
    var config = actionConfig();
    if (!config || !decisions.length || queuePending) return;
    var ids = decisions.map(function (decision) { return decision.finding_id; });
    if (!window.confirm('Queue remediation for ' + ids.join(', ') + '? The agent will re-check every selected finding before making any edit.')) return;
    var copyButton = document.getElementById('copy-decisions');
    var button = document.getElementById('queue-remediation');
    queuePending = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Queueing…';
      button.setAttribute('aria-busy', 'true');
    }
    document.querySelectorAll('.fix-only-btn').forEach(function (quickButton) { quickButton.disabled = true; });
    document.querySelectorAll('.decision-capture input, .decision-capture textarea').forEach(function (control) { control.disabled = true; });
    if (liveRegion) liveRegion.textContent = 'Queueing remediation batch…';
    var payload = {
      kind: 'aivv.remediation-request.v1',
      request_id: requestId(),
      review_id: copyButton ? copyButton.getAttribute('data-review-id') : '',
      finding_ids: ids,
      decisions: decisions.map(function (decision) { return { finding_id: decision.finding_id, notes: decision.notes || null }; })
    };
    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIVV-Action-Token': config.token },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    }).then(function (response) {
      return response.json().then(function (body) { return { response: response, body: body }; });
    }).then(function (result) {
      if (!result.response.ok) throw new Error((result.body.error && result.body.error.message) || 'The remediation request was rejected.');
      ids.forEach(function (id) {
        queuedFindingIds[id] = true;
        cards.forEach(function (card) {
          if (card.getAttribute('data-finding-id') !== id) return;
          var quickButton = card.querySelector('.fix-only-btn');
          if (quickButton) quickButton.disabled = true;
        });
      });
      if (button) {
        button.disabled = true;
        button.textContent = 'Batch queued';
        button.removeAttribute('aria-busy');
      }
      document.querySelectorAll('.decision-capture input, .decision-capture textarea').forEach(function (control) { control.disabled = false; });
      // `view-html.sh` compacts JS without a parser; preserve CLI argument spaces
      // with escapes so the copied handoff stays exact in the inline report.
      var handoff = '/aivv-fix\x20--action-request=' + result.body.request_id + '\x20--target=' + quotedArgument(result.body.target_project);
      var handoffWrap = document.getElementById('action-handoff');
      var handoffCommand = document.getElementById('action-handoff-command');
      if (handoffWrap && handoffCommand) {
        handoffCommand.textContent = handoff;
        handoffWrap.hidden = false;
      }
      if (liveRegion) liveRegion.textContent = 'Remediation batch queued for ' + ids.length + ' finding' + (ids.length === 1 ? '' : 's') + '.';
      renderBatchAction();
    }).catch(function (error) {
      queuePending = false;
      if (button) {
        button.textContent = 'Review and remediate selected';
        button.removeAttribute('aria-busy');
      }
      document.querySelectorAll('.fix-only-btn').forEach(function (quickButton) { quickButton.disabled = false; });
      document.querySelectorAll('.decision-capture input, .decision-capture textarea').forEach(function (control) { control.disabled = false; });
      renderBatchAction();
      if (liveRegion) liveRegion.textContent = 'Could not queue remediation: ' + error.message + ' Use the manual fallback above: save the copied decisions JSON at its shown target state path, then run /aivv-fix --resolve.';
    });
  }

  function decisionsPayload() {
    var copyButton = document.getElementById('copy-decisions');
    var reviewId = copyButton ? copyButton.getAttribute('data-review-id') : '';
    var decisions = [];
    cards.forEach(function (card) {
      var decision = selectedDecision(card);
      if (decision && decision.finding_id) decisions.push(decision);
    });
    return {
      schema_version: 1,
      review_id: reviewId,
      updated_at: new Date().toISOString(),
      decisions: decisions
    };
  }

  function renderDecisionPreview() {
    var preview = document.getElementById('decisions-preview');
    if (!preview) return;
    preview.textContent = JSON.stringify(decisionsPayload(), null, 2);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
    return Promise.resolve();
  }

  document.querySelectorAll('.decision-capture input, .decision-capture textarea').forEach(function (el) {
    el.addEventListener('change', function () { renderDecisionPreview(); renderBatchAction(); });
    el.addEventListener('input', function () { renderDecisionPreview(); renderBatchAction(); });
  });
  var copyDecisions = document.getElementById('copy-decisions');
  if (copyDecisions) {
    copyDecisions.addEventListener('click', function () {
      var payload = JSON.stringify(decisionsPayload(), null, 2);
      copyText(payload).then(function () {
        if (liveRegion) liveRegion.textContent = 'Decisions JSON copied';
      });
      renderDecisionPreview();
    });
  }
  var copyActionHandoff = document.getElementById('copy-action-handoff');
  if (copyActionHandoff) {
    copyActionHandoff.addEventListener('click', function () {
      var handoffCommand = document.getElementById('action-handoff-command');
      if (!handoffCommand || !handoffCommand.textContent) return;
      copyText(handoffCommand.textContent).then(function () {
        if (liveRegion) liveRegion.textContent = 'Action Inbox handoff copied';
      });
    });
  }
  var queueButton = document.getElementById('queue-remediation');
  if (queueButton) queueButton.addEventListener('click', function () { queueRemediation(selectedFixDecisions()); });
  document.querySelectorAll('.fix-only-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      var card = button.closest('.card');
      if (!card) return;
      var fixOption = card.querySelector('.decision-capture input[value="fix"]');
      if (fixOption) fixOption.checked = true;
      var decision = selectedDecision(card);
      if (decision) queueRemediation([decision]);
      renderDecisionPreview();
      renderBatchAction();
    });
  });
  renderDecisionPreview();
  renderBatchAction();

  // Print prep — open all <details> on beforeprint; restore on afterprint.
  // Required path per spec §4.6: CSS-only force does NOT bypass the UA shadow DOM
  // that controls <details> disclosure. The JS listener is mandatory, not a fallback.
  var priorOpen = null;
  window.addEventListener('beforeprint', function () {
    priorOpen = [];
    document.querySelectorAll('details').forEach(function (d) {
      priorOpen.push(d.open);
      d.open = true;
    });
  });
  window.addEventListener('afterprint', function () {
    if (!priorOpen) return;
    var i = 0;
    document.querySelectorAll('details').forEach(function (d) { d.open = priorOpen[i++]; });
    priorOpen = null;
  });
})();
