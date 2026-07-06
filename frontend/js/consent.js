/* Consent, Session & Auth */
// OTP_BACKEND_URL — defined in js/config.js (must load before this file)

var CONSENT_ITEMS = [
  {id:'c1',title:'Health & Symptom Data',desc:'Collection and processing of your menopause symptom data, clinical scores, and health metrics.',required:true,badge:'Sensitive Data'},
  {id:'c2',title:'Wearable Device Data',desc:'Optional integration of wearable device metrics for enhanced clinical insights.',required:true,badge:'Sensitive Data'},
  {id:'c3',title:'Ayurvedic & Lifestyle Profile',desc:'Your Prakriti type, Vikriti, and lifestyle information for personalised recommendations.',required:true,badge:'Required'},
  {id:'c4',title:'AI Processing & Clinical Scoring',desc:'Automated scoring using MenQOL, PHQ-9, GAD-7, ISI, PSS-8, FSFI, and FSDSAR instruments.',required:true,badge:'Required'},
  {id:'c5',title:'Sharing with Healthcare Professionals',desc:'Sharing your anonymised or identified data with your consulting clinician.',required:true,badge:'Required'},
  {id:'c6',title:'Anonymised Research Contribution',desc:'Optional contribution to menopause research in India (de-identified data only).',required:false,badge:'Optional'},
  {id:'c8',title:'Your Right to Erasure (DPDP §11)',desc:'You may delete all your data at any time using the Delete My Data button, or email dpo@evaerahealth.in. Data deleted within 30 days.',required:false,badge:'Your Right'},
  {id:'c7',title:'Corporate Wellness Reporting',desc:'If enrolled via employer, aggregate anonymised reporting to HR.',required:false,badge:'Optional'},
];

function saveSession(){try{localStorage.setItem('evr_session_v7',JSON.stringify(S.session));}catch(e){}}
function loadSession(){try{var s=localStorage.getItem('evr_session_v7');if(s){S.session=JSON.parse(s);return true;}}catch(e){}return false;}

function savePatients(){
  try{localStorage.setItem('evr_patients_v7',JSON.stringify(S.patients));}catch(e){}
  try{
    var _p=S.patients.map(function(p){
      return{id:p.id,name:p.name,age:p.age,city:p.city,stage:p.stage,
        composite:p.composite||0,
        band:(p.composite<=5?'Optimal':p.composite<=30?'Mild':p.composite<=55?'Moderate':p.composite<=80?'Severe':'Critical'),
        scores:p.scores,triage:p.triage,
        redFlag:p.psychiatricAlert||((p.redFlags||[]).length>0),
        flags:p.flags,comorbidities:p.comorbidities,
        ts:new Date(p.timestamp).toLocaleString('en-IN'),
        submittedAt:new Date(p.timestamp).getTime(),
        authId:p.authId||null
      };
    });
    localStorage.setItem('evh_patients',JSON.stringify(_p));
    try{var _bc=new BroadcastChannel('evh_v7');_bc.postMessage({t:'new_assess',d:_p[0]});_bc.close();}catch(_e){}
  }catch(_e2){}
}

function loadPatients(){try{var p=localStorage.getItem('evr_patients_v7');if(p)S.patients=JSON.parse(p);}catch(e){}}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.getElementById(id).classList.add('active');
}

function authTab(mode){
  S.authMode=mode;
  var existing=document.getElementById('auth-err-banner');
  if(existing)existing.remove();
  document.querySelectorAll('.auth-tab').forEach(function(t,i){
    t.classList.toggle('active',(i===0&&mode==='login')||(i===1&&mode==='register'));
  });
  document.getElementById('auth-login').style.display=mode==='login'?'block':'none';
  document.getElementById('auth-register').style.display=mode==='register'?'block':'none';
  document.getElementById('auth-otp').style.display='none';
}

/* PICK BEST NAME ROW  */
function _pickBestNameRow(rows, enteredName) {
  if (!rows || rows.length === 0) return null;

  var entered      = (enteredName || '').trim().toLowerCase();
  var enteredFirst = entered.split(/\s+/)[0];

  /* Priority 1: exact full-name match */
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].full_name && rows[i].full_name.trim().toLowerCase() === entered) {
      return rows[i];
    }
  }

  /* Priority 2: first-name match */
  for (var j = 0; j < rows.length; j++) {
    if (rows[j].full_name) {
      var sf = rows[j].full_name.trim().toLowerCase().split(/\s+/)[0];
      if (sf === enteredFirst) return rows[j];
    }
  }

  /* Priority 3: prefix match (min 3 chars) */
  if (enteredFirst.length >= 3) {
    for (var k = 0; k < rows.length; k++) {
      if (rows[k].full_name) {
        var sf2 = rows[k].full_name.trim().toLowerCase().split(/\s+/)[0];
        if (sf2.startsWith(enteredFirst) || enteredFirst.startsWith(sf2)) return rows[k];
      }
    }
  }

  /* Priority 4: fallback — most recent non-null row */
  for (var l = 0; l < rows.length; l++) {
    if (rows[l].full_name) return rows[l];
  }

  return null;
}

/* FETCH STORED NAME FROM SUPABASE  */
function _fetchStoredName(emailNormalised, enteredName) {

  /* ── Step 1: Direct email lookup in patient_demographics  */
  return fetch(
    SUPABASE_URL + '/rest/v1/patient_demographics' +
    '?email_id=eq.' + encodeURIComponent(emailNormalised) +
    '&full_name=not.is.null' +
    '&select=session_id,full_name' +
    '&order=id.desc&limit=10',
    { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  )
  .then(function(res) { return res.json(); })
  .then(function(demoRows) {

    var best = _pickBestNameRow(demoRows, enteredName);
    if (best) {
      
      return { storedName: best.full_name, sbSessionId: best.session_id };
    }

    /* ── Step 2: Fallback — sessions table lookup */
    

    return fetch(
      SUPABASE_URL + '/rest/v1/sessions' +
      '?email_id=eq.' + encodeURIComponent(emailNormalised) +
      '&is_guest=eq.false' +
      '&select=session_id' +
      '&order=id.desc',
      { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    )
    .then(function(res2) { return res2.json(); })
    .then(function(sessionRows) {

      if (!sessionRows || sessionRows.length === 0) {
        
        return null; /* email not registered at all */
      }

      var allSessionIds = sessionRows.map(function(r) { return r.session_id; });
      
      var inFilter = 'in.(' + allSessionIds.join(',') + ')';

      /* Step 2a: patient_demographics by session_id */
      return fetch(
        SUPABASE_URL + '/rest/v1/patient_demographics' +
        '?session_id=' + inFilter +
        '&full_name=not.is.null' +
        '&select=session_id,full_name' +
        '&order=id.desc&limit=10',
        { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
      )
      .then(function(res3) { return res3.json(); })
      .then(function(legacyDemoRows) {

        var bestLegacy = _pickBestNameRow(legacyDemoRows, enteredName);
        if (bestLegacy) {
          
          return { storedName: bestLegacy.full_name, sbSessionId: bestLegacy.session_id };
        }

        /* Step 2b: assessments table */
        
        return fetch(
          SUPABASE_URL + '/rest/v1/assessments' +
          '?session_id=' + inFilter +
          '&full_name=not.is.null' +
          '&select=session_id,full_name' +
          '&order=id.desc&limit=10',
          { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
        )
        .then(function(res4) { return res4.json(); })
        .then(function(assessRows) {

          var bestAssess = _pickBestNameRow(assessRows, enteredName);
          if (bestAssess) {
            
            return { storedName: bestAssess.full_name, sbSessionId: bestAssess.session_id };
          }

          /* Email exists in sessions but no name found anywhere */
          
          return { storedName: '__NEVER_COMPLETED__', sbSessionId: sessionRows[0].session_id };
        });
      });
    });
  });
}

/* SEND OTP */
function sendOTP(mode) {
  var identifier;

  if (mode === 'login') {
    identifier = (document.getElementById('login-id').value || '').trim();

    if (!identifier) { alert('Please enter your mobile number or email.'); return; }

    var btn = document.querySelector('#auth-login .btn-auth');
    if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }

    var emailNormalised = identifier.trim().toLowerCase();

    /* Email-only check — no name verification */
    _fetchStoredName(emailNormalised, '')
    .then(function(result) {
      if (result === null) {
        if (btn) { btn.textContent = 'Send OTP →'; btn.disabled = false; }
        _showAuthError(
          'Email ID <strong>' + _escHtml(identifier) + '</strong> is not registered.<br>'
          + '<span class="auth-err-banner__sub">Please check the email or switch to Register.</span>'
        );
        return;
      }

      if (result.storedName === '__NEVER_COMPLETED__') {
        if (btn) { btn.textContent = 'Send OTP →'; btn.disabled = false; }
        _showAuthError(
          'Your registration is incomplete — no assessment found.<br>'
          + '<span class="auth-err-banner__sub">Please use the '
          + '<strong data-action="authTabRegister">Register</strong> tab to complete your first assessment.</span>'
        );
        return;
      }

      /* Email exists and registration is complete — send OTP */
      
      _doSendOTP(identifier, mode, btn);
    })
    .catch(function(err) {
      
      if (btn) { btn.textContent = 'Send OTP →'; btn.disabled = false; }
      _doSendOTP(identifier, mode, btn);
    });

  } else {
    /* Register mode — unchanged */
    var name        = document.getElementById('reg-name').value.trim();
    var mobileEmail = document.getElementById('reg-mobile').value.trim();
    if (!name)        { alert('Please enter your full name'); return; }
    if (!mobileEmail) { alert('Please enter your mobile number or email'); return; }
    if (mobileEmail.indexOf('@') !== -1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mobileEmail)) {
      alert('Please enter a valid email address'); return;
    }
    identifier   = mobileEmail;
    S.regName    = name;
    S.regMobile  = mobileEmail;
    var btn2 = document.querySelector('#auth-register .btn-auth');
    _doSendOTP(identifier, mode, btn2);
  }
}

/*  OTP API helpers */
function _otpErrMsg(detail) {
  if (!detail) return 'Request failed. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(function(item) {
      return item && item.msg ? item.msg : String(item);
    }).join(' ');
  }
  return String(detail);
}

function _otpFetchJson(res) {
  return res.json().then(function(data) {
    if (!res.ok) throw new Error(_otpErrMsg(data.detail));
    return data;
  });
}

/*  ACTUALLY SEND OTP */
function _doSendOTP(identifier, mode, btn) {
  S.authId = identifier;
  var origText = btn ? btn.textContent : 'Send OTP →';
  if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }

  fetch(OTP_BACKEND_URL + '/health').catch(function() {}).finally(function() {
    if (btn) btn.textContent = 'Sending…';
    fetch(OTP_BACKEND_URL + '/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier, portal: 'patient' })
    })
    .then(_otpFetchJson)
    .then(function(data) {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
      if (data.success) {
        document.getElementById('auth-login').style.display    = 'none';
        document.getElementById('auth-register').style.display = 'none';
        var otpSection = document.getElementById('auth-otp');
        otpSection.style.display = 'block';
        var hint = document.getElementById('auth-otp-hint');
        if (hint) hint.textContent = 'OTP sent to ' + identifier;
        document.querySelectorAll('#auth-screen .otp-digit')[0].focus();
        startResendCooldown('patient');
      } else {
        alert(_otpErrMsg(data.detail) || 'Failed to send OTP. Please try again.');
      }
    })
    .catch(function(err) {
      if (btn) { btn.textContent = origText; btn.disabled = false; }
      
      alert(err.message || 'Could not reach the OTP service. Please try again in 30 seconds.');
    });
  });
}

/* AUTH ERROR BANNER */
function _escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _showAuthError(msg) {
  var existing = document.getElementById('auth-err-banner');
  if (existing) existing.remove();
  var loginDiv = document.getElementById('auth-login');
  if (!loginDiv) return;
  var frag = cloneTemplate('tpl-auth-err-banner');
  if (!frag || !frag.firstElementChild) return;
  var div = frag.firstElementChild;
  var msgEl = div.querySelector('[data-fill="msg"]');
  if (msgEl) msgEl.innerHTML = '⚠️ ' + msg;
  div.querySelectorAll('[data-action="authTabRegister"]').forEach(function(el) {
    el.addEventListener('click', function() { authTab('register'); });
  });
  loginDiv.appendChild(div);
  setTimeout(function() { if (div.parentNode) div.remove(); }, 8000);
}

function otpNext(el) {
  if (el.value.length === 1) {
    var n = el.nextElementSibling;
    if (n && n.classList.contains('otp-digit')) n.focus();
  }
}

/* VERIFY OTP */
function verifyOTP() {
  var digits = Array.from(document.querySelectorAll('#auth-screen .otp-digit'))
    .map(function(i) { return i.value; }).join('');
  if (digits.length < 4) { alert('Please enter all OTP digits.'); return; }

  var btn = document.querySelector('#auth-otp .btn-auth');
  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }

  fetch(OTP_BACKEND_URL + '/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: S.authId, otp: digits })
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(_otpErrMsg(e.detail)); });
    return res.json();
  })
  .then(function(data) {
    if (btn) { btn.textContent = 'Verify & Continue →'; btn.disabled = false; }
    if (data.success) {
      S.session = {
        id:     'user_' + Date.now(),
        ts:     new Date().toISOString(),
        authId: S.authId,
        name:   S.regName   || null,
        mobile: S.regMobile || null
      };
      delete S.regName;
      delete S.regMobile;
      saveSession();
      saveSessionToSupabase();

      if (S.authMode === 'login') {
        _routeReturningPatient(S.authId);
      } else {
        showConsent();
      }
    }
  })
  .catch(function(err) {
    if (btn) { btn.textContent = 'Verify & Continue →'; btn.disabled = false; }
    alert(err.message || 'Invalid OTP. Please try again.');
    document.querySelectorAll('#auth-screen .otp-digit').forEach(function(d) { d.value = ''; });
    document.querySelectorAll('#auth-screen .otp-digit')[0].focus();
  });
}

/* ROUTING: returning patient */
function _routeReturningPatient(authId) {
  if (!authId) { showConsent(); return; }
  var normalised = authId.trim().toLowerCase();
  var loginName  = (S.loginName || '').trim();

  /*  Step 1: Fetch all demographics rows for this email directly  */
  fetch(
    SUPABASE_URL + '/rest/v1/patient_demographics' +
    '?email_id=eq.' + encodeURIComponent(normalised) +
    '&full_name=not.is.null' +
    '&select=session_id,full_name' +
    '&order=id.desc&limit=10',
    { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
  )
  .then(function(res) { return res.json(); })
  .then(function(demoRows) {

    var bestDemo       = _pickBestNameRow(demoRows, loginName);
    var nameFromDemo   = bestDemo ? bestDemo.full_name  : null;
    var demoSessionId  = bestDemo ? bestDemo.session_id : null;

    /* ── Step 2: Also fetch all session_ids for this email (legacy + scores) */
    return fetch(
      SUPABASE_URL + '/rest/v1/sessions' +
      '?email_id=eq.' + encodeURIComponent(normalised) +
      '&is_guest=eq.false&select=session_id&order=id.desc',
      { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    )
    .then(function(r) { return r.json(); })
    .then(function(sessionRows) {

      var allSessionIds = (sessionRows || []).map(function(r) { return r.session_id; });
      var latestSbId    = allSessionIds.length > 0 ? allSessionIds[0] : null;

      /* Best session_id: prefer the demographics-matched one */
      var bestSessionId = demoSessionId || latestSbId;

      if (allSessionIds.length === 0 && !bestSessionId) {
        showConsent(); return;
      }

      /* Add demographics session_id to list if not already present */
      if (demoSessionId && allSessionIds.indexOf(demoSessionId) === -1) {
        allSessionIds.unshift(demoSessionId);
      }

      var inFilter = allSessionIds.length > 0
        ? 'in.(' + allSessionIds.join(',') + ')'
        : null;

      /* Step 3: Fetch assessments for scores/triage */
      var assessUrl = inFilter
        ? SUPABASE_URL + '/rest/v1/assessments?session_id=' + inFilter +
          '&full_name=not.is.null&select=session_id,full_name,scores,triage&order=id.desc&limit=10'
        : null;

      var assessPromise = assessUrl
        ? fetch(assessUrl, { method: 'GET', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } })
            .then(function(r2) { return r2.json(); })
        : Promise.resolve([]);

      return assessPromise.then(function(assessRows) {

        var bestAssessRow  = _pickBestNameRow(
          (assessRows || []).map(function(a) { return { session_id: a.session_id, full_name: a.full_name }; }),
          loginName
        );
        var nameFromAssess = bestAssessRow ? bestAssessRow.full_name : null;
        var scoresFromDb   = (assessRows && assessRows.length > 0) ? assessRows[0].scores : null;
        var triageFromDb   = (assessRows && assessRows.length > 0) ? assessRows[0].triage : null;

        /* Canonical name: demographics (direct email) > assessments > authId */
        var canonicalName = nameFromDemo || nameFromAssess || normalised;
        

        /* Step 4: Match local localStorage record  */
        var matchedPatient = null;
        try {
          var stored = localStorage.getItem('evr_patients_v7');
          if (stored) {
            var patients = JSON.parse(stored);

            /* Priority 1: match by any known session_id */
            var bySession = patients.filter(function(p) {
              return allSessionIds.indexOf(p.sbSessionId) !== -1;
            }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

            if (bySession.length > 0) {
              matchedPatient = bySession[0];
              
            } else {
              /* Priority 2: authId (email) match only */
              var byEmail = patients.filter(function(p) {
                return p.authId && p.authId.trim().toLowerCase() === normalised;
              }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

              if (byEmail.length > 0) {
                matchedPatient = byEmail[0];
                
              }
            }
          }
        } catch(e) {  }

        if (matchedPatient && matchedPatient.answers) {
          if (canonicalName) matchedPatient.name = canonicalName;
          matchedPatient.authId      = authId;
          matchedPatient.sbSessionId = bestSessionId;

          if (scoresFromDb && scoresFromDb.composite != null) {
            matchedPatient.scores           = scoresFromDb;
            matchedPatient.triage           = triageFromDb  || matchedPatient.triage || [];
            matchedPatient.composite        = scoresFromDb.composite;
            matchedPatient.psychiatricAlert = (scoresFromDb.PHQ9_item9 || 0) > 0;
            
          } else {
            
            if (typeof computeScores === 'function' && typeof runRuleEngine === 'function') {
              var _prevAnswers = S.answers;
              var _prevFlags   = S.flags;
              S.answers = matchedPatient.answers || {};
              S.flags   = matchedPatient.flags   || {
                psychosexualCompleted: false, sexuallyActive: false,
                mentalHealthCompleted: false, sleepModerate: false, sleepSevere: false,
                gyneRedFlag: false, menqolPsychTriggered: false, menqolSexualTriggered: false
              };
              try {
                var freshScores = computeScores();
                var freshTriage = runRuleEngine(freshScores);
                matchedPatient.scores           = freshScores;
                matchedPatient.triage           = freshTriage;
                matchedPatient.composite        = freshScores.composite;
                matchedPatient.psychiatricAlert = freshScores.PHQ9_item9 > 0;
              } catch(scoreErr) {
                
                matchedPatient.composite = (matchedPatient.scores && matchedPatient.scores.composite) || 0;
              }
              S.answers = _prevAnswers;
              S.flags   = _prevFlags;
            } else {
              matchedPatient.composite = (matchedPatient.scores && matchedPatient.scores.composite) || 0;
            }
          }

          
          S.currentPatient = matchedPatient;
          showPatientDashboard(matchedPatient);
          return;
        }

        /* ── Step 5: No local record — build shell from Supabase data ─────── */
        var shell = {
          id:            'sb_' + Date.now(),
          name:          canonicalName || 'Patient',
          authId:        authId,
          sbSessionId:   bestSessionId,
          scores:        scoresFromDb  || { composite: 0 },
          triage:        triageFromDb  || [],
          composite:     (scoresFromDb && scoresFromDb.composite) || 0,
          timestamp:     new Date().toISOString(),
          _fromSupabase: true
        };
        
         S.currentPatient = shell;
        showPatientDashboard(shell);
      });
    });
  })
  .catch(function(err) {
    
    showConsent();
  });
}

/*  RESEND COOLDOWN */
var _resendTimers = { patient: null, hcp: null };

function startResendCooldown(portal) {
  var btnId = portal === 'hcp' ? 'hcp-resend-btn' : 'patient-resend-btn';
  var btn   = document.getElementById(btnId);
  if (!btn) return;
  var secs = 30;
  btn.disabled    = true;
  btn.textContent = '↺ Resend OTP (' + secs + 's)';
  clearInterval(_resendTimers[portal]);
  _resendTimers[portal] = setInterval(function() {
    secs--;
    if (secs > 0) {
      btn.textContent = '↺ Resend OTP (' + secs + 's)';
    } else {
      clearInterval(_resendTimers[portal]);
      btn.textContent = '↺ Resend OTP';
      btn.disabled    = false;
    }
  }, 1000);
}

/*  RESEND OTP */
function resendOTP(portal) {
  var identifier = S.authId || '';
  if (!identifier) {
    var hcpInput = document.getElementById('hcp-login-id');
    if (hcpInput) identifier = hcpInput.value.trim();
  }
  if (!identifier) { alert('Please enter your email or mobile first.'); return; }

  var btnId = portal === 'hcp' ? 'hcp-resend-btn' : 'patient-resend-btn';
  var btn   = document.getElementById(btnId);
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  fetch(OTP_BACKEND_URL + '/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier, portal: portal })
  })
  .then(_otpFetchJson)
  .then(function(data) {
    if (data.success) {
      var cls = portal === 'hcp' ? '.hcp-otp-digit' : '#auth-screen .otp-digit';
      document.querySelectorAll(cls).forEach(function(d) { d.value = ''; });
      document.querySelectorAll(cls)[0].focus();
      var hint = document.getElementById(portal === 'hcp' ? 'hcp-otp-hint' : 'auth-otp-hint');
      if (hint) hint.textContent = 'New OTP sent to ' + identifier;
      startResendCooldown(portal);
    } else {
      if (btn) { btn.textContent = '↺ Resend OTP'; btn.disabled = false; }
      alert(_otpErrMsg(data.detail) || 'Failed to resend OTP. Please try again.');
    }
  })
  .catch(function(err) {
    if (btn) { btn.textContent = '↺ Resend OTP'; btn.disabled = false; }
    alert(err.message || 'Could not reach OTP service. Please try again.');
  });
}

/* GUEST & CONSENT */
function startGuest() {
  S.session = { id: 'guest_' + Date.now(), ts: new Date().toISOString() };
  saveSessionToSupabase();
  showConsent();
}

function showConsent() { showScreen('consent-screen'); renderConsent(); }

function renderConsent() {
  var container = document.getElementById('consent-items-container');
  if (!container) return;
  container.innerHTML = '';
  // MOVED: tpl-consent-item per row
  CONSENT_ITEMS.forEach(function(item) {
    var frag = cloneTemplate('tpl-consent-item');
    if (!frag || !frag.firstElementChild) return;
    var row = frag.firstElementChild;
    var badgeClass = item.badge === 'Sensitive Data' ? 'sensitive' : item.badge === 'Required' ? 'required' : 'optional';
    fillTemplate(row, { title: item.title, desc: item.desc });
    var badge = row.querySelector('[data-fill="badge"]');
    if (badge) { badge.textContent = item.badge; badge.classList.add('ci-badge', badgeClass); }
    var cb = row.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.id = 'ci_' + item.id;
      if (item.required) cb.required = true;
      if (S.consentData[item.id]) cb.checked = true;
      cb.addEventListener('change', function() { consentChange(item.id, cb.checked); });
    }
    container.appendChild(row);
  });
  checkConsentBtn();
}

function consentChange(id, val) { S.consentData[id] = val; checkConsentBtn(); }

function checkConsentBtn() {
  var allRequired = CONSENT_ITEMS.filter(function(i) { return i.required; }).every(function(i) { return S.consentData[i.id]; });
  document.getElementById('btn-consent-proceed').disabled = !allRequired;
}

function quickAcceptConsent() {
  CONSENT_ITEMS.forEach(function(i) { S.consentData[i.id] = true; });
  proceedAfterConsent();
}

function proceedAfterConsent() {
  S.consentGiven     = true;
  S.consentTimestamp = new Date().toISOString();
  saveConsentToSupabase();
  startForm();
}

function startForm() {
  S.currentStep          = 0;
  S.answers              = {};
  S.scores               = {};
  S.triage               = [];
  S.redFlagsTriggered    = [];
  S.psychiatricAlert     = false;
  S.psychiatricHardStop  = false;
  S.currentPatient       = null;
  S.flags = {
    menqolPsychTriggered: false, menqolSexualTriggered: false,
    sleepModerate: false, sleepSevere: false, gyneRedFlag: false,
    mentalHealthCompleted: false, psychosexualCompleted: false, sleepDeepDive: false
  };
  rebuildSteps();
  showScreen('form-screen');
  _bindNavigationHtml();
  renderStepDots();
  renderStep(0);
}

/* LEGACY SHIM */
function checkReturningPatient() {
  _routeReturningPatient(S.session && S.session.authId ? S.session.authId : null);
}

function _bindConsentHtml(){
  document.querySelectorAll('[data-action="intShowLauncher"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',function(e){e.preventDefault();intShowLauncher();});}
  });
  document.querySelectorAll('[data-action="authTab"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',function(){authTab(el.getAttribute('data-tab'));});}
  });
  document.querySelectorAll('[data-action="sendOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',function(){sendOTP(el.getAttribute('data-mode'));});}
  });
  document.querySelectorAll('[data-action="verifyOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',verifyOTP);}
  });
  document.querySelectorAll('[data-action="resendOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',function(){resendOTP(el.getAttribute('data-portal'));});}
  });
  document.querySelectorAll('[data-action="startGuest"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',startGuest);}
  });
  document.querySelectorAll('[data-action="proceedAfterConsent"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',proceedAfterConsent);}
  });
  document.querySelectorAll('[data-action="quickAcceptConsent"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',quickAcceptConsent);}
  });
  document.querySelectorAll('[data-action="otpNext"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('input',function(){otpNext(el);});}
  });
}

document.addEventListener('DOMContentLoaded',_bindConsentHtml);