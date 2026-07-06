function _bindSendReportActions(root) {
  if (!root) return;
  root.querySelectorAll('[data-action]').forEach(function(el) {
    var act = el.getAttribute('data-action');
    if (act === 'srClose') el.addEventListener('click', function() {
      var o = document.getElementById('send-report-overlay');
      if (o) o.remove();
    });
    if (act === 'srSwitchTab') el.addEventListener('click', function() {
      srSwitchTab(el.getAttribute('data-tab'));
    });
    if (act === 'srSendEmail') el.addEventListener('click', srSendEmail);
    if (act === 'srSendWhatsApp') el.addEventListener('click', srSendWhatsApp);
  });
}

function intSendReport() {
  var prefillEmail = (S.authId && S.authId.indexOf('@') >= 0) ? S.authId : '';
  // MOVED: HTML/CSS → template#tpl-send-report-overlay (index.html) + css/send-report.css
  document.body.appendChild(cloneTemplate('tpl-send-report-overlay'));
  var overlay = document.getElementById('send-report-overlay');
  if (overlay) _bindSendReportActions(overlay);
  var inp = document.getElementById('sr-email-input');
  if (inp) {
    if (prefillEmail) inp.value = prefillEmail;
    setTimeout(function() { if (!inp.value) inp.focus(); }, 350);
  }
}

function srSwitchTab(tab) {
  document.getElementById('sr-tab-email').classList.toggle('active', tab === 'email');
  document.getElementById('sr-tab-wa').classList.toggle('active', tab === 'whatsapp');
  var pe = document.getElementById('sr-panel-email');
  var pw = document.getElementById('sr-panel-wa');
  if (pe) pe.classList.toggle('is-hidden', tab !== 'email');
  if (pw) pw.classList.toggle('is-hidden', tab !== 'whatsapp');
}

function srSendEmail() {
  var email = (document.getElementById('sr-email-input').value || '').trim();
  if (!email || !email.includes('@')) {
    srShowStatus('error', '⚠️ Please enter a valid email address.');
    return;
  }

  var btn = document.getElementById('sr-send-btn');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  var sc   = S.scores || {};
  var name = (S.answers && S.answers.name) || 'there';
  var comp = sc.composite || 0;
  var band = sc.composite_band || (comp <= 5 ? 'Optimal' : comp <= 30 ? 'Mild' : comp <= 55 ? 'Moderate' : comp <= 80 ? 'Severe' : 'Critical');

  var aiEl = document.getElementById('ai-message-text');
  var aiMsg = aiEl ? aiEl.textContent.replace(/^"|"$/g, '').trim() : '';

  var scores = {
    MENQOL_vasomotor:    sc.MENQOL_vasomotor,
    MENQOL_physical:     sc.MENQOL_physical,
    MENQOL_psychosocial: sc.MENQOL_psychosocial,
    MENQOL_sexual:       sc.MENQOL_sexual,
    ISI:                 sc.ISI,
  };
  if (S.flags && S.flags.mentalHealthCompleted) {
    scores.PHQ9 = sc.PHQ9;
    scores.GAD7 = sc.GAD7;
    scores.PSS8 = sc.PSS8;
  }

  fetch(OTP_BACKEND_URL + '/send-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:      email,
      name:       name,
      composite:  comp,
      band:       band,
      scores:     scores,
      triage:     S.triage || [],
      ai_message: aiMsg,
    })
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.detail); });
    return res.json();
  })
  .then(function() {
    btn.textContent = '✅ Report Sent!';
    btn.classList.add('sr-btn-send--success');
    srShowStatus('success',
      '✅ Your wellness report has been sent to <strong>' + email + '</strong>.<br>' +
      '<span class="sr-status-note">Check your inbox (and spam folder) in the next few minutes.</span>'
    );
    setTimeout(function() {
      var overlay = document.getElementById('send-report-overlay');
      if (overlay) overlay.remove();
    }, 4000);
  })
  .catch(function(err) {
    btn.textContent = '📧 Send Report to Email';
    btn.disabled = false;
    btn.classList.remove('sr-btn-send--success');
    srShowStatus('error', '❌ ' + (err.message || 'Failed to send. Please try again.'));
  });
}

function srSendWhatsApp() {
  var sc   = S.scores || {};
  var name = (S.answers && S.answers.name) || 'there';
  var comp = sc.composite || 0;
  var band = sc.composite_band || (comp <= 5 ? 'Optimal' : comp <= 30 ? 'Mild' : comp <= 55 ? 'Moderate' : comp <= 80 ? 'Severe' : 'Critical');

  var topActions = (S.triage || [])
    .slice(0, 3)
    .map(function(t) { return '• ' + t.action.replace(/_/g, ' '); })
    .join('\n');

  var msg = [
    '🌸 *EvaEraHealth Wellness Report*',
    '',
    'Hello ' + name + '!',
    '',
    '📊 *Your Assessment Results*',
    'Overall Score: *' + comp + '/100 (' + band + ')*',
    '',
    '🎯 *Top Recommendations*',
    topActions || '• Continue your wellness practices',
    '',
    '📅 *Book a consultation with our specialists*',
    '📞 +91 80690 50000',
    '🌐 app.evaerahealth.com',
    '',
    '_EvaEraHealth Clinic, Gurugram · AI-assisted report, not a medical diagnosis_',
  ].join('\n');

  var waInput = document.getElementById('sr-wa-input');
  var mobile  = waInput ? waInput.value.replace(/[^0-9]/g, '') : '';
  var waUrl   = mobile
    ? 'https://wa.me/' + (mobile.startsWith('91') ? mobile : '91' + mobile) + '?text=' + encodeURIComponent(msg)
    : 'https://wa.me/?text=' + encodeURIComponent(msg);

  window.open(waUrl, '_blank');
}

function srShowStatus(type, html) {
  var el = document.getElementById('sr-email-status');
  if (!el) return;
  el.className = 'sr-email-status is-visible sr-email-status--' + type;
  el.innerHTML = html;
}
