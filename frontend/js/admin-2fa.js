// EvaEraHealth — Admin 2FA 

function _adminApi() {
  var base = window.ADMIN_API_URL || window.API_BASE_URL || window.OTP_BACKEND_URL || '';
  return String(base).replace(/\/$/, '');
}

// State 
var _admEmail         = "";
var _admResendTimer   = null;
var _admResendSeconds = 0;

// Resend Timer — shows countdown directly on the button
function admStartResendTimer() {
  var btn = document.getElementById('adm-resend-btn');
  if (!btn) return;

  // Clear any existing timer
  if (_admResendTimer) clearInterval(_admResendTimer);

  _admResendSeconds = 30;

  // Disable button and show countdown immediately
  btn.disabled      = true;
  btn.style.opacity = '0.5';
  btn.style.cursor  = 'not-allowed';
  btn.style.color   = 'rgba(255,255,255,0.4)';
  btn.textContent   = '↺ Resend OTP in 30s';

  _admResendTimer = setInterval(function () {
    _admResendSeconds--;

    if (btn) {
      if (_admResendSeconds > 0) {
        // Update button text with countdown
        btn.textContent = '↺ Resend OTP in ' + _admResendSeconds + 's';
      } else {
        // Cooldown done — enable button
        clearInterval(_admResendTimer);
        _admResendTimer   = null;
        _admResendSeconds = 0;
        btn.disabled      = false;
        btn.style.opacity = '1';
        btn.style.cursor  = 'pointer';
        btn.style.color   = 'rgba(255,255,255,0.6)';
        btn.textContent   = '↺ Resend OTP';
      }
    }
  }, 1000);
}

// Step 1 — Verify email + password → send OTP to email
function admVPass() {
  var em    = document.getElementById('adm-em').value.trim();
  var pw    = document.getElementById('adm-pw').value;
  var errEl = document.getElementById('adm-e1');
  var btn   = document.querySelector('#adm-s1 button');

  if (!em || !pw) {
    errEl.textContent   = "⚠ Please enter your email and password.";
    errEl.style.display = 'block';
    return;
  }

  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }
  errEl.style.display = 'none';

  var adminApi = _adminApi();
  if (!adminApi) {
    if (btn) { btn.textContent = 'Continue →'; btn.disabled = false; }
    errEl.textContent   = '⚠ API URL not configured. Check js/config.js and reload.';
    errEl.style.display = 'block';
    return;
  }

  fetch(adminApi + "/admin/login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: em, password: pw })
  })
  .then(function (res) {
    return res.json().then(function (data) {
      return { ok: res.ok, status: res.status, data: data };
    });
  })
  .then(function (result) {
    if (btn) { btn.textContent = 'Continue →'; btn.disabled = false; }

    if (!result.ok) {
      var msg = (result.data && result.data.detail)
        ? result.data.detail
        : "Invalid credentials. Please try again.";
      errEl.textContent   = "⚠ " + msg;
      errEl.style.display = 'block';
      return;
    }

    // ✅ Step 1 passed
    _admEmail = em;

    document.getElementById('adm-e1').style.display = 'none';
    document.getElementById('adm-s1').style.display = 'none';
    document.getElementById('adm-s2').style.display = 'block';

    var si2 = document.getElementById('adm-si2');
    if (si2) si2.style.background = '#C0305A';

    var sl = document.getElementById('adm-step-lbl');
    if (sl) sl.textContent = 'Step 2 of 2';

    var hint = document.getElementById('adm-otp-hint');
    if (hint) {
      var masked = em.replace(/(.{2}).+(@.+)/, '$1…$2');
      hint.textContent   = '6-digit OTP sent to ' + masked;
      hint.style.display = 'block';
    }

    var first = document.getElementById('ao0');
    if (first) first.focus();

    // Start 30s countdown on button
    admStartResendTimer();

    intToast('success', 'OTP sent!', 'Check ' + em, 'Admin');
  })
  .catch(function (err) {
    if (btn) { btn.textContent = 'Continue →'; btn.disabled = false; }
    errEl.textContent   = "⚠ Network error. Is the server running?";
    errEl.style.display = 'block';
    
  });
}

// Step 2 — Verify 6-digit OTP
function admVTOTP() {
  var v = [0, 1, 2, 3, 4, 5]
    .map(function (i) { return document.getElementById('ao' + i).value; })
    .join('');

  var errEl = document.getElementById('adm-e2');
  var btn   = document.querySelector('#adm-s2 button');

  if (v.length < 6 || !/^\d{6}$/.test(v)) {
    errEl.textContent   = "⚠ Please enter all 6 digits.";
    errEl.style.display = 'block';
    return;
  }

  if (!_admEmail) {
    errEl.textContent   = "⚠ Session expired. Please go back and log in again.";
    errEl.style.display = 'block';
    return;
  }

  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }
  errEl.style.display = 'none';

  var adminApi = _adminApi();
  if (!adminApi) {
    if (btn) { btn.textContent = 'Verify & Enter Portal →'; btn.disabled = false; }
    errEl.textContent   = '⚠ API URL not configured. Check js/config.js and reload.';
    errEl.style.display = 'block';
    return;
  }

  fetch(adminApi + "/admin/verify-otp", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: _admEmail, otp: v })
  })
  .then(function (res) {
    return res.json().then(function (data) {
      return { ok: res.ok, status: res.status, data: data };
    });
  })
  .then(function (result) {
    if (btn) { btn.textContent = 'Verify & Enter Portal →'; btn.disabled = false; }

    if (!result.ok) {
      var msg = (result.data && result.data.detail)
        ? result.data.detail
        : "Invalid OTP. Please try again.";
      errEl.textContent   = "⚠ " + msg;
      errEl.style.display = 'block';

      [0, 1, 2, 3, 4, 5].forEach(function (i) {
        document.getElementById('ao' + i).value = '';
      });
      var first = document.getElementById('ao0');
      if (first) first.focus();
      return;
    }

    // ✅ Authenticated — clear everything
    _admEmail = '';
    if (_admResendTimer) {
      clearInterval(_admResendTimer);
      _admResendTimer   = null;
      _admResendSeconds = 0;
    }

    showScreen('adm-portal-screen');
    iLogA('ok', 'Admin logged in', 'Super Admin authenticated via email OTP', 'System');
    intToast('success', 'Welcome, Super Admin', 'Admin portal access granted', 'Admin');
    intRAdm();
  })
  .catch(function (err) {
    if (btn) { btn.textContent = 'Verify & Enter Portal →'; btn.disabled = false; }
    errEl.textContent   = "⚠ Network error. Is the server running?";
    errEl.style.display = 'block';
    
  });
}

// Resend OTP — countdown shown on button, no toast popup
function admResendOTP() {
  if (!_admEmail) {
    intToast('warn', 'Session expired', 'Please go back and log in again.', 'Admin');
    return;
  }

  // If still in cooldown, update button text and return silently
  if (_admResendSeconds > 0) {
    var btn = document.getElementById('adm-resend-btn');
    if (btn) btn.textContent = '↺ Resend OTP in ' + _admResendSeconds + 's';
    return;
  }

  var adminApi = _adminApi();
  if (!adminApi) {
    intToast('warn', 'API not configured', 'Check js/config.js and reload.', 'Admin');
    return;
  }

  fetch(adminApi + "/admin/resend-otp", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email: _admEmail })
  })
  .then(function (res) {
    return res.json().then(function (data) {
      return { ok: res.ok, status: res.status, data: data };
    });
  })
  .then(function (result) {
    if (!result.ok) {
      // Show error on button itself instead of toast
      var btn = document.getElementById('adm-resend-btn');
      var msg = (result.data && result.data.detail)
        ? result.data.detail
        : "Please wait before resending.";
      if (btn) {
        btn.textContent = '⚠ ' + msg;
        setTimeout(function () {
          btn.textContent = '↺ Resend OTP';
        }, 3000);
      }
      return;
    }

    // Clear OTP inputs
    [0, 1, 2, 3, 4, 5].forEach(function (i) {
      document.getElementById('ao' + i).value = '';
    });
    document.getElementById('ao0').focus();

    // Update hint to confirm new OTP sent
    var hint = document.getElementById('adm-otp-hint');
    if (hint) {
      var masked = _admEmail.replace(/(.{2}).+(@.+)/, '$1…$2');
      hint.textContent = '✓ New OTP sent to ' + masked;
    }

    // Restart 30s countdown on button
    admStartResendTimer();
  })
  .catch(function (err) {
    var btn = document.getElementById('adm-resend-btn');
    if (btn) {
      btn.textContent = '⚠ Network error. Try again.';
      setTimeout(function () {
        btn.textContent = '↺ Resend OTP';
      }, 3000);
    }
    
  });
}

function _bindAdmin2faHtml(){
  document.querySelectorAll('[data-action="admVPass"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',admVPass);}
  });
  document.querySelectorAll('[data-action="admVTOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',admVTOTP);}
  });
  document.querySelectorAll('[data-action="admResendOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',admResendOTP);}
  });
  document.querySelectorAll('[data-action="admBackToStep1"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',admBackToStep1);}
  });
  document.querySelectorAll('[data-action="intOTPnx"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('input',function(){intOTPnx(el,el.getAttribute('data-otp-row'));});}
  });
}

document.addEventListener('DOMContentLoaded',_bindAdmin2faHtml);