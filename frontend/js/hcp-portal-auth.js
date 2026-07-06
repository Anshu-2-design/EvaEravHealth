/* PART 1 — HCP AUTH SCREEN
   HCP login screen with Email + Password login.*/

function hcpRenderLoginScreen() {
  var card = document.querySelector('.hcp-auth-card');
  if (!card) return;
  // MOVED: tpl-hcp-auth-card
  card.innerHTML = '';
  var root = mountTemplate('tpl-hcp-auth-card', card);
  if (!root) return;
  var back = root.querySelector('[data-action="intShowLauncher"]');
  if (back) back.addEventListener('click', function(e) { e.preventDefault(); intShowLauncher(); });
  var toggle = root.querySelector('[data-action="hcpTogglePassVis"]');
  if (toggle) toggle.addEventListener('click', hcpTogglePassVis);
  var loginBtn = root.querySelector('[data-action="hcpDoLogin"]');
  if (loginBtn) loginBtn.addEventListener('click', hcpDoLogin);
  var passInp = document.getElementById('hcp-pass-input');
  if (passInp) passInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') hcpDoLogin(); });
  var emailInp = document.getElementById('hcp-email-input');
  if (emailInp) emailInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { var p = document.getElementById('hcp-pass-input'); if (p) p.focus(); } });
}

function hcpTogglePassVis() {
  var inp = document.getElementById('hcp-pass-input');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* PART 2 — LOGIN LOGIC
   Queries Supabase hcp_clinicians table: email + password match + active=true */

function hcpDoLogin() {
  var email = (document.getElementById('hcp-email-input') || {}).value || '';
  var pass  = (document.getElementById('hcp-pass-input')  || {}).value || '';
  email = email.trim().toLowerCase();
  pass  = pass.trim();

  var errEl = document.getElementById('hcp-login-err');
  var btn   = document.getElementById('hcp-login-btn');

  /* Basic validation */
  if (!email) { _hcpShowErr('Please enter your email address.'); return; }
  if (!pass)  { _hcpShowErr('Please enter your password.'); return; }

  /* Loading state */
  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  if (errEl) errEl.style.display = 'none';

  /* Check Supabase is ready */
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    _whenReady(function() { _hcpQuerySupabase(email, pass, btn); }, 'hcpDoLogin');
    return;
  }

  _hcpQuerySupabase(email, pass, btn);
}

function _hcpQuerySupabase(email, pass, btn) {
  /* Query hcp_clinicians where hcp_email matches */
  var url = SUPABASE_URL + '/rest/v1/hcp_clinicians'
    + '?hcp_email=eq.' + encodeURIComponent(email)
    + '&select=id,name,qualification,specialisation,hcp_email,hcp_pass,active,fee,experience,languages';

  fetch(url, {
    method: 'GET',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json'
    }
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('Server error: ' + t); });
    return res.json();
  })
  .then(function(rows) {
    if (btn) { btn.textContent = 'Sign In →'; btn.disabled = false; }

    /* No matching email */
    if (!rows || rows.length === 0) {
      _hcpShowErr('⚠ Invalid email or password.');
      return;
    }

    var clinician = rows[0];

    /* Check password match */
    if (clinician.hcp_pass !== pass) {
      _hcpShowErr('⚠ Invalid email or password.');
      return;
    }

    /* Check if active */
    if (!clinician.active) {
      _hcpShowErr('🚫 Your access has been deactivated. Please contact your administrator.');
      return;
    }

    /* ✅ All checks passed — log in */
    _hcpOnLoginSuccess(clinician);
  })
  .catch(function(err) {
    if (btn) { btn.textContent = 'Sign In →'; btn.disabled = false; }
    
    _hcpShowErr('⚠ Could not connect. Please check your connection and try again.');
  });
}

function _hcpOnLoginSuccess(clinician) {
  /* Update last_login timestamp in Supabase */
  _hcpUpdateLastLogin(clinician.id);

  /* Store in session state */
  S.hcpConsultant = {
    id:        clinician.id,
    name:      clinician.name,
    qual:      clinician.qualification,
    spec:      clinician.specialisation,
    hcpEmail:  clinician.hcp_email,
    fee:       clinician.fee,
    exp:       clinician.experience,
    lang:      clinician.languages
  };
  S.hcpEmail = clinician.hcp_email;

  /* Log activity */
  iLogA('ok', 'HCP login: ' + clinician.name, clinician.hcp_email, 'HCP');

  /* Open dashboard */
  showHCPDashboard();
}

function _hcpUpdateLastLogin(clinicianId) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !clinicianId) return;

  fetch(SUPABASE_URL + '/rest/v1/hcp_clinicians?id=eq.' + encodeURIComponent(clinicianId), {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify({ last_login: new Date().toISOString() })
  }).catch(function(e) {  });
}

function _hcpShowErr(msg) {
  var errEl = document.getElementById('hcp-login-err');
  if (!errEl) { alert(msg); return; }
  errEl.textContent = msg;
  errEl.style.display = 'block';
  var btn = document.getElementById('hcp-login-btn');
  if (btn) { btn.textContent = 'Sign In →'; btn.disabled = false; }
}

/* PART 3 — ADMIN: SAVE CONSULTANT TO SUPABASE
   Patches admACon() so when admin adds a consultant,
   the credentials are saved to Supabase hcp_clinicians table.*/

(function() {
  var _orig = window.admACon;

  window.admACon = function() {
    var editId = (document.getElementById('anc-eid') || {}).value || '';
    _orig.call(this);

    var list = iLd(IK.cn, []);
    if (editId) {
      var edited = list.find(function(c) { return c.id === editId; });
      if (edited) _hcpPatchToSupabase(edited);
      return;
    }

    var newest = list[list.length - 1];
    if (!newest || !newest.hcpEmail) return;

    _hcpSaveToSupabase(newest);
  };
})();

function _hcpSaveToSupabase(consultant) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    /* Supabase not ready yet — queue it */
    _whenReady(function() { _hcpSaveToSupabase(consultant); }, 'hcpSaveToSupabase');
    return;
  }

  var row = {
    id:             consultant.id,
    name:           consultant.name           || '',
    qualification:  consultant.qual           || '',
    specialisation: consultant.spec           || '',
    hcp_email:      consultant.hcpEmail.toLowerCase().trim(),
    hcp_pass:       consultant.hcpPass        || '',
    fee:            consultant.fee            || 1500,
    experience:     consultant.exp            || '',
    languages:      consultant.lang           || 'Hindi, English',
    default_dur:    consultant.defaultDur     || 30,
    active:         true,
    added_at:       new Date().toISOString()
  };

  

  fetch(SUPABASE_URL + '/rest/v1/hcp_clinicians', {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify(row)
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    
    intToast('success', 'HCP credentials saved to database', row.hcp_email, 'Admin');
  })
  .catch(function(err) {
    
    intToast('warn', 'Credentials saved locally only', 'Supabase save failed — check console', 'Admin');
  });
}

function _hcpPatchToSupabase(consultant) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    _whenReady(function() { _hcpPatchToSupabase(consultant); }, 'hcpPatchToSupabase');
    return;
  }
  if (!consultant || !consultant.id) return;

  var row = {
    name:           consultant.name           || '',
    qualification:  consultant.qual           || '',
    specialisation: consultant.spec           || '',
    fee:            consultant.fee            || 1500,
    experience:     consultant.exp            || '',
    languages:      consultant.lang           || 'Hindi, English',
    default_dur:    consultant.defaultDur     || 30,
    updated_at:     new Date().toISOString(),
  };

  

  fetch(SUPABASE_URL + '/rest/v1/hcp_clinicians?id=eq.' + encodeURIComponent(consultant.id), {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(row),
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    
    intToast('success', 'Consultant synced to database', consultant.name, 'Admin');
  })
  .catch(function(err) {
    
    intToast('warn', 'Saved locally only', 'Supabase update failed — check console', 'Admin');
  });
}

/* PART 4 — ADMIN: TOGGLE ACTIVE STATUS IN SUPABASE
   When admin activates/deactivates a consultant, sync to Supabase.*/

(function() {
  var _orig = window.admTogCon;

  window.admTogCon = function(cid) {
    /* Run original (toggles in localStorage) */
    _orig.call(this, cid);

    /* Sync the new active state to Supabase */
    var list      = iLd(IK.cn, []);
    var consultant = list.find(function(c) { return c.id === cid; });
    if (!consultant || !consultant.hcpEmail) return;

    _hcpUpdateActiveState(consultant.hcpEmail, consultant.active);
  };
})();

function _hcpUpdateActiveState(hcpEmail, activeState) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !hcpEmail) return;

  fetch(SUPABASE_URL + '/rest/v1/hcp_clinicians?hcp_email=eq.' + encodeURIComponent(hcpEmail.toLowerCase()), {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify({
      active:     activeState,
      updated_at: new Date().toISOString()
    })
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    
  })
  .catch(function(err) {
    
  });
}

/* PART 5 — INIT
   Replace the HCP auth screen UI when that screen is shown.*/

(function() {
  var _orig = window.showScreen;
  if (typeof _orig === 'function') {
    window.showScreen = function(screenId) {
      _orig(screenId);
      if (screenId === 'hcp-auth-screen') {
        /* Small delay so the screen is visible before patching */
        setTimeout(hcpRenderLoginScreen, 50);
      }
    };
  }

  /* Also patch intEnter so clicking HCP from launcher renders the new UI */
  var _origIntEnter = window.intEnter;
  if (typeof _origIntEnter === 'function') {
    window.intEnter = function(p) {
      _origIntEnter(p);
      if (p === 'hcp') {
        setTimeout(hcpRenderLoginScreen, 80);
      }
    };
  }

  /* Render on page load if hcp-auth-screen is already active */
  window.addEventListener('load', function() {
    var screen = document.getElementById('hcp-auth-screen');
    if (screen && screen.classList.contains('active')) {
      setTimeout(hcpRenderLoginScreen, 100);
    }
  });
})();