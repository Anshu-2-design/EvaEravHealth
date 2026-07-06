/* HCP Portal — Dashboard, Patient List & Detail
 * 3-tab bottom nav: Home · Assessments · Appointments
 */

// TRIAGE MAPS 

const TRIAGE_ICONS = {
  psychiatric_alert:         '🚨',
  gynecology_referral:       '👩‍⚕️',
  psychologist_referral:     '🧠',
  sexual_therapy_pathway:    '💙',
  sleep_recovery_program:    '😴',
  stress_management_program: '🌿',
  recommend_menopause_program:'🌸',
  gurugram_clinic:           '🏥',
  exercise_program:          '🏃',
  nutrition_guidance:        '🥗',
  sexual_wellbeing_program:  '💜',
  activate_psychosexual_module:'💙',
  relationship_counselling:  '🤝',
};

const TRIAGE_DESCRIPTIONS = {
  psychiatric_alert:           'Immediate mental health intervention — do not delay',
  psychologist_referral:       'Clinical psychology & evidence-based therapy (CBT/DBT)',
  gynecology_referral:         'Gynaecologist review — EvaEraHealth Clinic Gurugram',
  sexual_therapy_pathway:      'Integrated psychosexual therapy with qualified therapist',
  sexual_wellbeing_program:    'Sexual wellness education and personalised support',
  sleep_recovery_program:      'CBT-I and structured sleep hygiene programme',
  stress_management_program:   'Mindfulness, yoga and structured stress reduction',
  recommend_menopause_program: 'EvaEraHealth personalised menopause programme',
  exercise_program:            'Targeted movement prescription with physiotherapist',
  nutrition_guidance:          'Hormonal nutrition plan with certified nutritionist',
  relationship_counselling:    'Couples or individual relationship counselling',
  activate_psychosexual_module:'Psychosexual wellbeing module activation',
  gurugram_clinic:             'In-person consultation — Gurugram Flagship Centre',
};

// SCORE / BAND HELPERS 

function compositeBand(composite) {
  if (composite >= 81) return { label: 'Critical', colour: '#B71C1C', cssClass: 'critical', tagClass: 'tag-rose' };
  if (composite >= 56) return { label: 'Severe',   colour: '#EF5350', cssClass: 'severe',   tagClass: 'tag-rose' };
  if (composite >= 31) return { label: 'Moderate', colour: '#FF9800', cssClass: 'moderate', tagClass: 'tag-gold' };
  if (composite >= 6)  return { label: 'Mild',     colour: '#4CAF50', cssClass: 'mild',     tagClass: 'tag-teal' };
  return                      { label: 'Optimal',  colour: '#00695C', cssClass: 'optimal',  tagClass: 'tag-teal' };
}

function scoreColour(value, warnAt, alertAt) {
  if (value >= alertAt) return '#EF5350';
  if (value >= warnAt)  return '#FF9800';
  return '#4CAF50';
}

// NAME EXTRACTION FROM EMAIL 

function hcpDisplayName(consultant) {
  if (!consultant) return 'Doctor';
  if (consultant.name && consultant.name.trim()) {
    // Return first word (handles "Dr. Priya Sharma" → "Dr. Priya")
    const parts = consultant.name.trim().split(' ');
    // If starts with Dr/Dr., keep two words, else just first
    if (parts[0].toLowerCase().replace('.','') === 'dr') {
      return parts.slice(0, 2).join(' ');
    }
    return parts[0];
  }
  if (consultant.hcpEmail) {
    const local = consultant.hcpEmail.split('@')[0];
    // Strip prefixes like "dr.", "dr_", clean dots/underscores
    const cleaned = local.replace(/^dr[._]?/i, '').replace(/[._]/g, ' ');
    // Capitalise first word
    const first = cleaned.trim().split(' ')[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return 'Doctor';
}

// SUPABASE: FETCH APPOINTMENTS FOR THIS CLINICIAN

function hcpFetchAppointments(callback) {
  const consultant = S.hcpConsultant;
  if (!consultant || !SUPABASE_URL || !SUPABASE_KEY) {
    callback([]);
    return;
  }

  // Filter by clinician_id (primary) OR clinician_email (fallback for older records)
  const clinicianId    = encodeURIComponent(consultant.id    || '');
  const clinicianEmail = encodeURIComponent((consultant.hcpEmail || '').toLowerCase());

  const url = SUPABASE_URL + '/rest/v1/appointments'
    + '?or=(clinician_id.eq.' + clinicianId + ',clinician_email.eq.' + clinicianEmail + ')'
    + '&order=appt_date.desc,appt_time.asc'
    + '&select=*';

  fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
    },
  })
    .then(res => {
      if (!res.ok) return res.text().then(t => { throw new Error(t); });
      return res.json();
    })
    .then(rows => {
      
      callback(rows || []);
    })
    .catch(err => {
      
      callback([]);
    });
}

// SUPABASE: FETCH ASSESSMENTS (real patients only)

function _hcpComorbiditiesFromRow(row) {
  var fields = {
    Hypertension: row.comor_hypertension,
    Diabetes: row.comor_diabetes,
    Hypothyroidism: row.comor_hypothyroidism,
    Hyperthyroidism: row.comor_hyperthyroidism,
    Hyperlipidemia: row.comor_hyperlipidemia,
    Anaemia: row.comor_anaemia,
    PCOD: row.comor_pcod,
    Osteoporosis: row.comor_osteoporosis,
    'Heart Disease': row.comor_heart_disease,
    CKD: row.comor_ckd,
    'Autoimmune Disorder': row.comor_autoimmune_disorder,
    'Stroke (history)': row.comor_stroke_history,
    'Cancer (history)': row.comor_cancer_history,
  };
  var out = {};
  Object.keys(fields).forEach(function(k) {
    if (fields[k]) out[k] = fields[k];
  });
  return out;
}

function _hcpRedFlagsFromRow(row) {
  var flags = [];
  if (row.rf1_unusual_vaginal_bleeding === 'Yes') flags.push('Unusual vaginal bleeding');
  if (row.rf2_persistent_pelvic_pain === 'Yes' || row.rf2_persistent_pelvic_pain === 'Frequently') {
    flags.push('Persistent pelvic pain');
  }
  if (row.rf3_breast_changes === 'Yes') flags.push('Breast changes');
  return flags;
}

function _hcpPatientFromAssessmentRow(row) {
  var scores = row.scores || {};
  var ts = (row.login_date && row.login_time)
    ? row.login_date + 'T' + row.login_time
    : new Date().toISOString();
  return {
    id: row.session_id || ('sb_' + row.id),
    sbAssessmentId: row.id,
    name: row.full_name || row.email_id || 'Patient',
    age: row.age || '—',
    city: row.city || '—',
    stage: row.menstrual_status || '—',
    prakriti: row.prakriti || '—',
    vikriti: row.vikriti || '—',
    scores: scores,
    triage: row.triage || [],
    psychiatricAlert: (scores.PHQ9_item9 || 0) > 0,
    redFlags: _hcpRedFlagsFromRow(row),
    comorbidities: _hcpComorbiditiesFromRow(row),
    authId: row.email_id || null,
    email: row.email_id || null,
    sessionId: row.session_id || null,
    sbSessionId: row.session_id || null,
    timestamp: ts,
    composite: scores.composite || 0,
    answers: {
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
    },
  };
}

function hcpFetchAssessments(callback) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    callback([]);
    return;
  }

  var url = SUPABASE_URL + '/rest/v1/assessments'
    + '?select=id,session_id,email_id,full_name,age,city,menstrual_status,prakriti,vikriti,'
    + 'height_cm,weight_kg,scores,triage,login_date,login_time,'
    + 'rf1_unusual_vaginal_bleeding,rf2_persistent_pelvic_pain,rf3_breast_changes,'
    + 'comor_hypertension,comor_diabetes,comor_hypothyroidism,comor_hyperthyroidism,'
    + 'comor_hyperlipidemia,comor_anaemia,comor_pcod,comor_osteoporosis,'
    + 'comor_heart_disease,comor_ckd,comor_autoimmune_disorder,comor_stroke_history,comor_cancer_history'
    + '&full_name=not.is.null'
    + '&order=id.desc'
    + '&limit=500';

  fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
  })
    .then(function(res) {
      if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
      return res.json();
    })
    .then(function(rows) {
      var seen = {};
      var patients = [];
      (rows || []).forEach(function(row) {
        if (!row || row.session_id === 'demo') return;
        if (!row.scores || row.scores.composite == null) return;
        var key = (row.email_id || row.session_id || String(row.id)).toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        patients.push(_hcpPatientFromAssessmentRow(row));
      });
      
      callback(patients);
    })
    .catch(function(err) {
      
      callback([]);
    });
}

function hcpLoadAssessmentPatients(done) {
  S._hcpPatientsLoading = true;
  function finish(patients) {
    S.patients = patients || [];
    S._hcpPatientsLoading = false;
    if (S.selectedPatient) {
      var refreshed = S.patients.find(function(p) { return p.id === S.selectedPatient.id; });
      S.selectedPatient = refreshed || null;
    }
    if (done) done(S.patients);
  }

  if (typeof _whenReady === 'function') {
    _whenReady(function() { hcpFetchAssessments(finish); }, 'hcpLoadAssessmentPatients');
  } else {
    hcpFetchAssessments(finish);
  }
}

function _hcpPatientApptMatch(patient, row) {
  if (!patient || !row) return false;
  var email = (patient.email || patient.authId || '').trim().toLowerCase();
  var name = (patient.name || '').trim().toLowerCase();
  var rowEmail = (row.patient_email || '').trim().toLowerCase();
  var rowName = (row.patient_name || '').trim().toLowerCase();
  if (email && rowEmail && email === rowEmail) return true;
  if (name && rowName && name === rowName) return true;
  if (patient.id && row.patient_session_id && patient.id === row.patient_session_id) return true;
  return false;
}

function _hcpPickLatestAppt(rows) {
  if (!rows || !rows.length) return null;
  var confirmed = rows.filter(function(r) { return r.status === 'confirmed'; });
  var pool = confirmed.length ? confirmed : rows.slice();
  pool.sort(function(a, b) {
    var da = (a.appt_date || '') + ' ' + (a.appt_time || '');
    var db = (b.appt_date || '') + ' ' + (b.appt_time || '');
    return db.localeCompare(da);
  });
  return pool[0];
}

function _hcpFetchPatientAppointments(patient, callback) {
  hcpFetchAppointments(function(rows) {
    var matched = (rows || []).filter(function(r) { return _hcpPatientApptMatch(patient, r); });
    callback(matched);
  });
}

function _hcpMountTab4ApptSection(tab, patient) {
  var badgeHost = tab.querySelector('[data-fill="apptBadge"]');
  var btnHost = tab.querySelector('[data-fill="completeBtn"]');
  if (badgeHost) badgeHost.innerHTML = '';
  if (btnHost) btnHost.innerHTML = '';

  _hcpFetchPatientAppointments(patient, function(rows) {
    var latestAppt = _hcpPickLatestAppt(rows);
    if (!latestAppt || !badgeHost) return;

    var isComplete = latestAppt.status === 'completed';
    var badge = document.createElement('span');
    badge.className = 'hcp-appt-badge';
    badge.style.background = isComplete ? 'rgba(22,101,52,0.12)' : 'rgba(30,64,175,0.12)';
    badge.style.border = '1px solid ' + (isComplete ? '#166534' : '#1E40AF');
    badge.style.color = isComplete ? '#166534' : '#1E40AF';
    badge.textContent = '💳 Rs ' + (latestAppt.fee || 0) + ' · ' + latestAppt.status;
    badgeHost.appendChild(badge);

    if (_hcpApptIsActive(latestAppt.status) && btnHost) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hcp-complete-btn';
      btn.textContent = '✅ Mark Consultation Complete';
      btn.addEventListener('click', function() { hcpCompleteConsult(latestAppt); });
      btnHost.appendChild(btn);
    }
  });
}

function _hcpSaveNoteToAppointment(patient, noteText, callback) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _hcpSaveNoteToAppointment(patient, noteText, callback); }, 'hcpSaveNote');
      return;
    }
    if (callback) callback(false);
    return;
  }

  _hcpFetchPatientAppointments(patient, function(rows) {
    var appt = _hcpPickLatestAppt(rows);
    if (!appt || !appt.id) {
      
      if (callback) callback(false);
      return;
    }

    fetch(SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(appt.id), {
      method: 'PATCH',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        notes:      noteText || '',
        updated_at: new Date().toISOString(),
      }),
    })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
        
        if (callback) callback(true, appt);
      })
      .catch(function(err) {
        
        if (callback) callback(false);
      });
  });
}

// ─── DASHBOARD ENTRY POINT 

function showHCPDashboard() {
  showScreen('hcp-portal-screen');
  S.patients = [];
  S.selectedPatient = null;

  // Inject bottom-nav styles once
  _hcpInjectStyles();

  const container = document.getElementById('hcp-content');
  if (!container) return;

  // Force container to be truly full width — MOVED: .hcp-content--full (hcp-portal-templates.css)
  container.classList.add('hcp-content--full');

  // Build the shell — MOVED: tpl-hcp-shell
  container.innerHTML = '';
  mountTemplate('tpl-hcp-shell', container);
  container.querySelectorAll('[data-action="hcpSwitchTab"]').forEach(function(el) {
    el.addEventListener('click', function() { hcpSwitchTab(el.getAttribute('data-tab')); });
  });

  // Activate Home tab by default
  hcpSwitchTab('home');
}

// ─── SHELL & TAB NAVIGATION

function _hcpBuildShell() {
  // MOVED: tpl-hcp-shell (mounted in showHCPDashboard)
  return '';
}

/**
 * Switches the active bottom-nav tab and lazily renders content.
 * Rendered flag prevents re-fetching on every tab switch.
 */
function hcpSwitchTab(tab) {
  // Update tab strip buttons
  document.querySelectorAll('.hcp-tab-btn').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('hcpnav-' + tab);
  if (navEl) navEl.classList.add('active');

  // Show/hide panels
  document.querySelectorAll('.hcp-tab-panel').forEach(p => { p.style.display = 'none'; });
  const panel = document.getElementById('hcp-tab-' + tab);
  if (panel) panel.style.display = 'block';

  // Lazy render
  if (tab === 'home'         && !panel.dataset.rendered) { _hcpRenderHome(panel);         panel.dataset.rendered = '1'; }
  if (tab === 'assessments') {
    if (!panel.dataset.rendered) {
      panel.innerHTML = '';
      mountTemplate('tpl-hcp-assessments-layout', panel);
      panel.dataset.rendered = '1';
    }
    var listEl = document.getElementById('patient-list');
    if (listEl) listEl.innerHTML = '<div class="hcp-assess-loading">Loading patients…</div>';
    hcpLoadAssessmentPatients(function() { renderPatientList(); });
    return;
  }
  if (tab === 'appointments' && !panel.dataset.rendered) { _hcpRenderAppointments(panel); /* no cache — always refetch */ }
}

// TAB 1: HOME 

function _hcpRenderHome(panel) {
  const c       = S.hcpConsultant || {};
  const name    = hcpDisplayName(c);
  const spec    = c.spec || c.specialisation || 'Specialist';
  const qual    = c.qual || c.qualification  || '';
  const exp     = c.exp  || c.experience     || '';
  const fee     = c.fee  ? `Rs ${c.fee}` : '';
  const lang    = c.lang || c.languages      || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // MOVED: tpl-hcp-home-panel
  panel.innerHTML = '';
  var root = mountTemplate('tpl-hcp-home-panel', panel);
  if (!root) return;
  fillTemplate(root, {
    initials: _hcpInitials(c.name || name),
    greeting: greeting + ',',
    name: c.name || name,
    qual: qual,
    spec: spec,
    email: c.hcpEmail || ''
  });
  var qualEl = root.querySelector('[data-fill="qual"]');
  if (qualEl && !qual) qualEl.style.display = 'none';
  var meta = root.querySelector('[data-fill="metaPills"]');
  if (meta) {
    if (exp) meta.innerHTML += '<span class="hcp-meta-pill">🏅 ' + exp + '</span>';
    if (fee) meta.innerHTML += '<span class="hcp-meta-pill">💰 ' + fee + ' / consultation</span>';
    if (lang) meta.innerHTML += '<span class="hcp-meta-pill">🗣️ ' + lang + '</span>';
  }
  var info = root.querySelector('[data-fill="infoCard"]');
  if (info) {
    [
      ['Clinic', 'EvaEraHealth, Gurugram'],
      ['Helpline', '+91 80690 50000'],
      ['Email', 'clinic@evaerahealth.in']
    ].forEach(function(row) {
      var iFrag = cloneTemplate('tpl-hcp-info-row');
      if (!iFrag || !iFrag.firstElementChild) return;
      fillTemplate(iFrag.firstElementChild, { label: row[0], value: row[1] });
      info.appendChild(iFrag.firstElementChild);
    });
  }
  root.querySelectorAll('[data-action="hcpLogout"]').forEach(function(el) {
    el.addEventListener('click', hcpLogout);
  });
}

function _hcpApptIsActive(status) {
  var ACTIVE = ['confirmed', 'rescheduled', 'pending', 'booked'];
  return ACTIVE.indexOf((status || '').toLowerCase()) !== -1;
}

function _hcpNormMode(mode) {
  var m = String(mode || '').toLowerCase().trim();
  if (m === 'video' || m === 'online' || m.indexOf('video') >= 0) return 'video';
  return 'in-person';
}

function _hcpIsVideoMode(mode) {
  return _hcpNormMode(mode) === 'video';
}

function _hcpRegenerateMeetLink(appt, callback) {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  if (!base || !appt || !appt.id) { if (callback) callback(null); return; }
  fetch(base + '/generate-meet-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id:    String(appt.id),
      patient_name:  appt.patient_name || 'Patient',
      doctor_name:   appt.clinician_name || 'Consultant',
      date:          appt.appt_date,
      time:          appt.appt_time,
      patient_email: appt.patient_email || null,
      doctor_email:  appt.clinician_email || null,
      duration_min:  appt.duration_min || 30
    })
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.detail || 'generate failed'); });
    return res.json();
  })
  .then(function(data) {
    if (data.meet_link) appt.meet_link = data.meet_link;
    if (callback) callback(data.meet_link || null);
  })
  .catch(function(err) {
    
    if (callback) callback(null);
  });
}

function _hcpMountMeetJoin(host, appt) {
  if (!host) return;
  host.innerHTML = '';
  host.style.display = 'none';
  if (!_hcpIsVideoMode(appt.mode) || !_hcpApptIsActive(appt.status)) return;

  function appendJoinLink(link) {
    host.innerHTML = '';
    host.style.display = 'block';
    var a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'hcp-appt-card__join';
    a.textContent = '📹 Join Google Meet';
    host.appendChild(a);
  }

  if (appt.meet_link) {
    appendJoinLink(appt.meet_link);
    return;
  }

  host.style.display = 'block';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hcp-appt-card__join-generate';
  btn.textContent = '📹 Get Meet Link';
  btn.addEventListener('click', function() {
    btn.disabled = true;
    btn.textContent = 'Generating link…';
    _hcpRegenerateMeetLink(appt, function(link) {
      if (link) appendJoinLink(link);
      else {
        btn.disabled = false;
        btn.textContent = '📹 Get Meet Link (retry)';
        intToast('warn', 'Could not get Meet link', 'Check backend Google Calendar setup', 'HCP');
      }
    });
  });
  host.appendChild(btn);
}

function _hcpInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

// ─── TAB 2: ASSESSMENTS (layout mounted in hcpSwitchTab; data from Supabase)

function _hcpRenderAssessments(panel) {
  panel.innerHTML = '';
  mountTemplate('tpl-hcp-assessments-layout', panel);
  hcpLoadAssessmentPatients(function() { renderPatientList(); });
}

// ─── TAB 3: APPOINTMENTS

function _hcpRenderAppointments(panel) {
  // MOVED: tpl-hcp-appt-panel
  panel.innerHTML = '';
  mountTemplate('tpl-hcp-appt-panel', panel);

  // Fetch from Supabase
  hcpFetchAppointments(function(rows) {
    var listEl = document.getElementById('hcp-appt-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    _hcpMountApptList(listEl, rows);
  });
}

function _hcpMountApptList(host, rows) {
  if (!rows || rows.length === 0) {
    // MOVED: tpl-hcp-appt-empty
    mountTemplate('tpl-hcp-appt-empty', host);
    return;
  }
  var upcoming  = rows.filter(function(r) { return _hcpApptIsActive(r.status); });
  var completed = rows.filter(function(r) { return r.status === 'completed'; });
  var others    = rows.filter(function(r) { return !_hcpApptIsActive(r.status) && r.status !== 'completed'; });
  function addGroup(label, items, spaced) {
    if (!items.length) return;
    var lFrag = cloneTemplate('tpl-hcp-appt-group-label');
    if (lFrag && lFrag.firstElementChild) {
      var lbl = lFrag.firstElementChild;
      if (spaced) lbl.classList.add('hcp-appt-group-label--spaced');
      fillTemplate(lbl, { label: label });
      host.appendChild(lbl);
    }
    items.forEach(function(r) {
      var card = _hcpApptCardEl(r);
      if (card) host.appendChild(card);
    });
  }
  addGroup('📆 Upcoming (' + upcoming.length + ')', upcoming, false);
  addGroup('✅ Completed (' + completed.length + ')', completed, true);
  addGroup('📁 Other (' + others.length + ')', others, true);
}

function _hcpApptCardEl(a) {
  var statusCfg = {
    confirmed:   { bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.35)',   dot: '#16A34A', label: 'Confirmed' },
    completed:   { bg: 'rgba(0,188,212,0.08)',    border: 'rgba(0,188,212,0.25)',   dot: '#00BCD4', label: 'Completed' },
    cancelled:   { bg: 'rgba(239,83,80,0.08)',    border: 'rgba(239,83,80,0.25)',   dot: '#EF5350', label: 'Cancelled' },
    no_show:     { bg: 'rgba(255,152,0,0.08)',    border: 'rgba(255,152,0,0.25)',   dot: '#FF9800', label: 'No Show'  },
    rescheduled: { bg: 'rgba(156,39,176,0.08)',   border: 'rgba(156,39,176,0.25)', dot: '#9C27B0', label: 'Rescheduled' },
  };
  var cfg = statusCfg[a.status] || statusCfg.confirmed;
  var dateObj = a.appt_date ? new Date(a.appt_date) : null;
  var frag = cloneTemplate('tpl-hcp-appt-card');
  if (!frag || !frag.firstElementChild) return null;
  var card = frag.firstElementChild;
  card.style.background = cfg.bg;
  card.style.border = '1px solid ' + cfg.border;
  fillTemplate(card, {
    weekday: dateObj ? dateObj.toLocaleString('en-IN', { weekday: 'short' }) : '',
    day: dateObj ? dateObj.getDate().toString().padStart(2, '0') : '—',
    month: dateObj ? dateObj.toLocaleString('en-IN', { month: 'short' }).toUpperCase() : '—',
    name: a.patient_name || '—',
    email: a.patient_email || ''
  });
  var dot = card.querySelector('.hcp-appt-card__dot');
  if (dot) dot.style.background = cfg.dot;
  var emailEl = card.querySelector('[data-fill="email"]');
  if (emailEl && !a.patient_email) emailEl.style.display = 'none';
  var tagsHost = card.querySelector('[data-list="tags"]');
  if (tagsHost) {
    ['🕐 ' + (a.appt_time || '—'), '📡 ' + (a.mode || 'Video'), '⏱ ' + (a.duration_min || 30) + ' min', '💰 Rs ' + (a.fee || 0)].forEach(function(t) {
      var span = document.createElement('span');
      span.className = 'hcp-appt-card__tag';
      span.textContent = t;
      tagsHost.appendChild(span);
    });
  }
  var statusHost = card.querySelector('[data-list="status"]');
  if (statusHost) {
    var st = document.createElement('span');
    st.className = 'hcp-appt-card__status';
    st.style.background = cfg.border;
    st.textContent = cfg.label;
    statusHost.appendChild(st);
    var pay = document.createElement('span');
    pay.className = 'hcp-appt-card__pay';
    pay.textContent = a.payment_status === 'paid' ? '✓ Paid' : '⏳ ' + (a.payment_status || 'Pending');
    statusHost.appendChild(pay);
  }
  var notesEl = card.querySelector('[data-fill="notes"]');
  if (notesEl) {
    if (a.notes) { notesEl.textContent = '📝 ' + a.notes; }
    else notesEl.style.display = 'none';
  }
  _hcpMountMeetJoin(card.querySelector('[data-fill="meet"]'), a);
  var actionsEl = card.querySelector('[data-fill="actions"]');
  if (actionsEl && _hcpApptIsActive(a.status)) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hcp-appt-card__complete';
    btn.textContent = '✅ Mark Complete';
    btn.addEventListener('click', function() { hcpMarkComplete(a.id, null, a); });
    actionsEl.appendChild(btn);
  } else if (actionsEl) {
    actionsEl.style.display = 'none';
  }
  return card;
}

function _hcpBuildApptList() { return ''; }
function _hcpApptCard() { return ''; }

// MARK APPOINTMENT COMPLETE (Supabase PATCH)

function hcpLogout() {
  S.hcpConsultant = null;
  S.hcpEmail = null;
  if (typeof intShowLauncher === 'function') { intShowLauncher(); return; }
  if (typeof showScreen === 'function') showScreen('hcp-auth-screen');
}

function hcpMarkComplete(appointmentId, onSuccess, apptRow) {
  if (!confirm('Mark this consultation as complete?')) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { hcpMarkComplete(appointmentId, onSuccess, apptRow); }, 'hcpMarkComplete');
      return;
    }
    alert('Supabase not ready');
    return;
  }

  fetch(SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(appointmentId), {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      status:       'completed',
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }),
  })
    .then(res => {
      if (!res.ok) return res.text().then(t => { throw new Error(t); });
      var emailPayload = typeof evhApptCompletedEmailPayload === 'function'
        ? evhApptCompletedEmailPayload(apptRow)
        : null;
      var emailPromise = (emailPayload && typeof evhSendAppointmentCompletedEmail === 'function')
        ? evhSendAppointmentCompletedEmail(emailPayload)
        : Promise.resolve(false);
      return emailPromise.then(function(emailed) {
        var sub = 'Appointment updated in Supabase';
        if (emailed) sub = 'Patient notified by email · ' + sub;
        intToast('success', 'Consultation marked complete', sub, 'HCP');
        const panel = document.getElementById('hcp-tab-appointments');
        if (panel) { delete panel.dataset.rendered; _hcpRenderAppointments(panel); }
        if (typeof onSuccess === 'function') onSuccess(emailed);
      });
    })
    .catch(err => {
      
      intToast('warn', 'Could not update appointment', err.message, 'HCP');
    });
}

// ─── OTP FLOW 

function hcpSendOTP() {
  const identifier = document.getElementById('hcp-login-id').value.trim();
  if (!identifier) { alert('Please enter your provider email or ID.'); return; }

  S.authId = identifier;

  const btn = document.querySelector('#hcp-auth-screen .btn-hcp');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  fetch(`${OTP_BACKEND_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, portal: 'hcp' }),
  })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) {
          var msg = (typeof _otpErrMsg === 'function')
            ? _otpErrMsg(data.detail)
            : (data.detail || 'Failed to send OTP. Please try again.');
          throw new Error(msg);
        }
        return data;
      });
    })
    .then(data => {
      if (btn) { btn.textContent = 'Send OTP'; btn.disabled = false; }
      if (data.success) {
        const section = document.getElementById('hcp-otp-section');
        section.style.display = 'block';
        const hint = document.getElementById('hcp-otp-hint');
        if (hint) hint.textContent = `OTP sent to ${identifier}`;
        setTimeout(() => document.querySelector('.hcp-otp-digit')?.focus(), 150);
        startResendCooldown('hcp');
      } else {
        alert((typeof _otpErrMsg === 'function' ? _otpErrMsg(data.detail) : data.detail)
          || 'Failed to send OTP. Please try again.');
      }
    })
    .catch(err => {
      if (btn) { btn.textContent = 'Send OTP'; btn.disabled = false; }
      
      alert(err.message || 'Could not reach the OTP service. Please check your connection.');
    });
}

function hcpOtpNext(el) {
  if (el.value.length !== 1) return;
  const digits = Array.from(document.querySelectorAll('.hcp-otp-digit'));
  const index  = digits.indexOf(el);
  if (index < digits.length - 1) {
    digits[index + 1].focus();
  } else {
    document.getElementById('btn-hcp-verify').click();
  }
}

function hcpVerifyOTP() {
  const digits = Array.from(document.querySelectorAll('.hcp-otp-digit'))
    .map(d => d.value)
    .join('');

  if (digits.length < 4) { alert('Please enter all 4 OTP digits.'); return; }

  const loginId = document.getElementById('hcp-login-id').value.trim();
  const btn     = document.getElementById('btn-hcp-verify');
  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }

  fetch(`${OTP_BACKEND_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: loginId, otp: digits }),
  })
    .then(res => {
      if (!res.ok) return res.json().then(e => {
        throw new Error((typeof _otpErrMsg === 'function' ? _otpErrMsg(e.detail) : e.detail));
      });
      return res.json();
    })
    .then(data => {
      if (btn) { btn.textContent = 'Verify & Enter Portal'; btn.disabled = false; }
      if (data.success) {
        const consultants = iLd(IK.cn, []);
        S.hcpConsultant   = consultants.find(c => c.hcpEmail === loginId) || null;
        showHCPDashboard();
      }
    })
    .catch(err => {
      if (btn) { btn.textContent = 'Verify & Enter Portal'; btn.disabled = false; }
      alert(err.message || 'Invalid OTP. Please check and try again.');
      const inputs = document.querySelectorAll('.hcp-otp-digit');
      inputs.forEach(d => { d.value = ''; });
      inputs[0]?.focus();
    });
}

// ─── PATIENT LIST

function renderPatientList() {
  const total  = S.patients.length;
  const severe = S.patients.filter(p => (p.scores?.composite || 0) >= 56).length;
  const alerts = S.patients.filter(p => p.psychiatricAlert || p.redFlags?.length).length;
  const el = document.getElementById('patient-list');
  if (!el) return;
  el.innerHTML = '';
  // MOVED: tpl-hcp-patient-list-hdr
  var hdrFrag = cloneTemplate('tpl-hcp-patient-list-hdr');
  if (hdrFrag && hdrFrag.firstElementChild) {
    var hdr = hdrFrag.firstElementChild;
    fillTemplate(hdr, { total: String(total), severe: String(severe), alerts: String(alerts) });
    var search = hdr.querySelector('[data-action="hcpFilterPatients"]');
    if (search) search.addEventListener('input', function() { filterPatients(this.value); });
    el.appendChild(hdr);
  }
  const visible = S._severityFilter
    ? S.patients.filter(p => {
        const comp = (p.scores?.composite || p.composite || 0);
        if (S._severityFilter === 'critical') return comp >= 81;
        if (S._severityFilter === 'severe') return comp >= 56;
        if (S._severityFilter === 'alerts') return p.psychiatricAlert || p.redFlags?.length > 0;
        return true;
      })
    : S.patients;
  visible.forEach(function(p) {
    var row = _hcpPatientRowEl(p);
    if (row) el.appendChild(row);
  });
  if (!total) mountTemplate('tpl-hcp-patient-empty', el);
}

function _hcpPatientRowEl(patient) {
  // MOVED: tpl-hcp-patient-row
  var frag = cloneTemplate('tpl-hcp-patient-row');
  if (!frag || !frag.firstElementChild) return null;
  var row = frag.firstElementChild;
  var comp = patient.scores?.composite || patient.composite || 0;
  var band = compositeBand(comp);
  var initials = (patient.name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  var hasAlert = patient.psychiatricAlert || patient.redFlags?.length > 0;
  var flagCls = patient.psychiatricAlert ? 'red' : hasAlert ? 'orange' : 'green';
  if (S.selectedPatient?.id === patient.id) row.classList.add('active');
  var flagEl = row.querySelector('[data-fill="flagClass"]');
  if (flagEl) flagEl.className = 'pi-flag ' + flagCls;
  fillTemplate(row, {
    initials: initials,
    name: patient.name || '',
    scoreClass: 'pi-score ' + band.cssClass,
    meta1: (patient.age || '') + 'y · ' + (patient.city || ''),
    meta2: patient.stage || ''
  });
  var scoreEl = row.querySelector('[data-fill="scoreClass"]');
  if (scoreEl) scoreEl.textContent = String(comp);
  var badges = row.querySelector('[data-fill="badges"]');
  if (badges) {
    if (patient.psychiatricAlert) {
      var cFrag = cloneTemplate('tpl-hcp-badge');
      if (cFrag && cFrag.firstElementChild) {
        cFrag.firstElementChild.className = 'hcp-pi-badge hcp-pi-badge--crisis';
        cFrag.firstElementChild.textContent = '🚨 Crisis';
        badges.appendChild(cFrag.firstElementChild);
      }
    }
    if (patient.redFlags?.length) {
      var fFrag = cloneTemplate('tpl-hcp-badge');
      if (fFrag && fFrag.firstElementChild) {
        fFrag.firstElementChild.className = 'hcp-pi-badge hcp-pi-badge--flag';
        fFrag.firstElementChild.textContent = '⚠ Red Flag';
        badges.appendChild(fFrag.firstElementChild);
      }
    }
    var bFrag = cloneTemplate('tpl-hcp-badge');
    if (bFrag && bFrag.firstElementChild) {
      bFrag.firstElementChild.style.color = band.colour;
      bFrag.firstElementChild.textContent = band.label;
      badges.appendChild(bFrag.firstElementChild);
    }
  }
  row.dataset.patientId = patient.id;
  row.addEventListener('click', function() { selectPatient(patient.id); });
  return row;
}

function buildPatientListHeader(total, severe, alerts) {
  return '';
}

function buildPatientListItems() {
  return '';
}

function buildPatientRow(patient) {
  return '';
}

function filterPatients(query) {
  document.querySelectorAll('.patient-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(query.toLowerCase()) ? '' : 'none';
  });
}

function selectPatient(id) {
  S.selectedPatient = S.patients.find(p => p.id === id);
  if (!S.selectedPatient) return;
  renderPatientList();
  renderPatientDetail(S.selectedPatient);
}

// ─── PATIENT DETAIL (all tab builders unchanged) 

function renderPatientDetail(patient, openTab) {
  const scores    = patient.scores || {};
  const composite = scores.composite || 0;
  const band      = compositeBand(composite);

  const el = document.getElementById('patient-detail') || document.getElementById('hcp-content');
  if (!el) return;
  // MOVED: tpl-hcp-pd-shell + sub-templates
  el.innerHTML = '';
  var shell = mountTemplate('tpl-hcp-pd-shell', el);
  if (!shell) return;

  _hcpMountPdHeader(shell, patient, composite, band);
  _hcpMountPdAlerts(shell, patient);
  _hcpMountPdTabBar(shell);
  var panelsHost = listHost(shell, 'tabPanels');
  if (panelsHost) {
    _hcpMountTab0(panelsHost, patient, scores, composite, band);
    _hcpMountTab1(panelsHost, patient);
    _hcpMountTab2(panelsHost, scores);
    _hcpMountTab3(panelsHost, patient);
    _hcpMountTab4(panelsHost, patient);
    _hcpMountTab5(panelsHost, patient);
  }
  _hcpBindPdTabs(shell);

  if (typeof openTab !== 'undefined' && openTab >= 0) {
    setTimeout(function() { switchPDTab(openTab); }, 50);
  } else {
    setTimeout(function() { switchPDTab(0); }, 50);
  }
}

function _hcpMountPdHeader(shell, patient, composite, band) {
  var host = shell.querySelector('[data-fill="header"]');
  if (!host) return;
  var frag = cloneTemplate('tpl-hcp-pd-header');
  if (!frag || !frag.firstElementChild) return;
  var hdr = frag.firstElementChild;
  fillTemplate(hdr, {
    name: patient.name,
    crisisIcon: patient.psychiatricAlert ? ' 🚨' : '',
    meta: patient.age + ' yrs · ' + patient.city + ' · ' + patient.stage + '\nPrakriti: ' + patient.prakriti
      + (patient.vikriti ? ' · Vikriti: ' + patient.vikriti.replace(/_/g, ' ') : ''),
    assessDate: new Date(patient.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  });
  var metaEl = hdr.querySelector('[data-fill="meta"]');
  if (metaEl) metaEl.innerHTML = metaEl.textContent.replace('\n', '<br>');
  var tagEl = hdr.querySelector('[data-fill="tagClass"]');
  if (tagEl) {
    tagEl.className = 'tag ' + band.tagClass;
    tagEl.textContent = composite + '/100 — ' + band.label;
  }
  host.appendChild(hdr);
}

function _hcpMountPdAlerts(shell, patient) {
  var host = listHost(shell, 'alerts');
  if (!host) return;
  if (patient.psychiatricAlert) mountTemplate('tpl-hcp-pd-alert-psych', host);
  if (patient.redFlags?.length) {
    var fFrag = cloneTemplate('tpl-hcp-pd-alert-flags');
    if (fFrag && fFrag.firstElementChild) {
      fillTemplate(fFrag.firstElementChild, { flagsText: patient.redFlags.join(' · ') });
      host.appendChild(fFrag.firstElementChild);
    }
  }
}

function _hcpMountPdTabBar(shell) {
  var host = shell.querySelector('[data-fill="tabBar"]');
  if (!host) return;
  var labels = ['Overview', 'Clinical Summary', 'Scores', 'Triage', 'Care Plan', 'Data'];
  var barFrag = cloneTemplate('tpl-hcp-pd-tab-bar');
  if (!barFrag || !barFrag.firstElementChild) return;
  var bar = barFrag.firstElementChild;
  var tabsHost = listHost(bar, 'tabs');
  if (!tabsHost) return;
  labels.forEach(function(label, i) {
    var tFrag = cloneTemplate('tpl-hcp-pd-tab');
    if (!tFrag || !tFrag.firstElementChild) return;
    var tab = tFrag.firstElementChild;
    tab.setAttribute('data-tab-index', String(i));
    if (i === 0) tab.classList.add('active');
    fillTemplate(tab, { label: label });
    tabsHost.appendChild(tab);
  });
  host.appendChild(bar);
}

function _hcpBindPdTabs(shell) {
  shell.querySelectorAll('[data-action="hcpSwitchPDTab"]').forEach(function(el) {
    el.addEventListener('click', function() {
      switchPDTab(parseInt(el.getAttribute('data-tab-index'), 10), el);
    });
  });
  shell.querySelectorAll('[data-action="hcpSaveNote"]').forEach(function(el) {
    el.addEventListener('click', saveHCPNote);
  });
  shell.querySelectorAll('[data-action="hcpDownloadReport"]').forEach(function(el) {
    el.addEventListener('click', downloadHCPReport);
  });
  shell.querySelectorAll('[data-action="hcpDownloadJSON"]').forEach(function(el) {
    el.addEventListener('click', downloadHCPJSON);
  });
  shell.querySelectorAll('[data-action="hcpBookOnBehalf"]').forEach(function(el) {
    el.addEventListener('click', hcpBookOnBehalf);
  });
}

function _hcpScoreRowEl(label, value, isAbnormal, note) {
  if (value == null || value === '' || value === '—' || value === 'Prefer not to say') return null;
  var frag = cloneTemplate('tpl-hcp-pd-score-row');
  if (!frag || !frag.firstElementChild) return null;
  var row = frag.firstElementChild;
  fillTemplate(row, { label: label });
  var valEl = row.querySelector('[data-fill="value"]');
  if (valEl) {
    valEl.style.color = isAbnormal ? '#EF9A9A' : 'rgba(255,255,255,0.85)';
    valEl.textContent = String(value);
    if (note) {
      var noteSpan = document.createElement('span');
      noteSpan.className = 'hcp-score-note';
      noteSpan.textContent = note;
      valEl.appendChild(noteSpan);
    }
  }
  return row;
}

function _hcpMountTab0(host, patient, scores, composite, band) {
  var frag = cloneTemplate('tpl-hcp-pd-tab-0');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;

  var compHost = tab.querySelector('[data-fill="composite"]');
  if (compHost) {
    var cFrag = cloneTemplate('tpl-hcp-pd-composite');
    if (cFrag && cFrag.firstElementChild) {
      var comp = cFrag.firstElementChild;
      var scoreEl = comp.querySelector('[data-fill="score"]');
      if (scoreEl) {
        scoreEl.style.color = band.colour;
        scoreEl.innerHTML = composite + '<span>/100</span>';
      }
      fillTemplate(comp, { band: band.label + ' Symptom Burden' });
      var barFill = comp.querySelector('[data-fill="barFill"]');
      if (barFill) { barFill.style.width = composite + '%'; barFill.style.background = band.colour; }
      compHost.appendChild(comp);
    }
  }

  var metricsHost = listHost(tab, 'metrics');
  if (metricsHost) {
    var domains = [
      { key: 'MENQOL_vasomotor', label: '🌡 Vasomotor', max: 20 },
      { key: 'MENQOL_physical', label: '💪 Physical', max: 20 },
      { key: 'MENQOL_psychosocial', label: '🧠 Emotional', max: 20 },
      { key: 'MENQOL_sexual', label: '💙 Intimate', max: 20 }
    ];
    domains.forEach(function(d) {
      var val = scores[d.key] || 0;
      var col = scoreColour(val, 7, 14);
      var pct = Math.round((val / d.max) * 100);
      var mFrag = cloneTemplate('tpl-hcp-pd-metric-card');
      if (!mFrag || !mFrag.firstElementChild) return;
      var card = mFrag.firstElementChild;
      fillTemplate(card, { label: d.label, value: String(val), sub: '/' + d.max });
      var valEl = card.querySelector('[data-fill="value"]');
      if (valEl) valEl.style.color = col;
      var fill = card.querySelector('[data-fill="barFill"]');
      if (fill) { fill.style.width = pct + '%'; fill.style.background = col; }
      metricsHost.appendChild(card);
    });
    var isiVal = scores.ISI || 0;
    var isiCol = scoreColour(isiVal, 8, 15);
    _hcpAppendMetric(metricsHost, '😴 Sleep (ISI)', isiVal, '/28 · ' + (scores.ISI_band || '—'), isiCol, Math.round((isiVal / 28) * 100));
    if (scores.PHQ9 != null) {
      var phqVal = scores.PHQ9 || 0;
      _hcpAppendMetric(metricsHost, '🧠 PHQ-9', phqVal, '/27 · ' + (scores.PHQ9_band || ''), scoreColour(phqVal, 5, 10), Math.round((phqVal / 27) * 100));
    }
    if (scores.FSFI != null) {
      var fsfiCol = scores.FSFI <= 10 ? '#EF5350' : scores.FSFI <= 26.55 ? '#FF9800' : '#4CAF50';
      _hcpAppendMetric(metricsHost, '💙 FSFI', scores.FSFI, '/36', fsfiCol, Math.round((scores.FSFI / 36) * 100));
    }
  }

  var profileHost = listHost(tab, 'profileRows');
  if (profileHost) {
    var pa = patient.answers || {};
    var bmi = (pa.height_cm && pa.weight_kg) ? (pa.weight_kg / Math.pow(pa.height_cm / 100, 2)).toFixed(1) : null;
    var profileRows = [
      ['Name', patient.name], ['Age', patient.age ? patient.age + ' yrs' : null],
      ['City', patient.city], ['Stage', patient.stage], ['Prakriti', patient.prakriti],
      ['Vikriti', patient.vikriti],
      ['Assessed', new Date(patient.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })]
    ];
    profileRows.forEach(function(r) {
      var row = _hcpScoreRowEl(r[0], r[1]);
      if (row) profileHost.appendChild(row);
    });
    if (bmi) {
      var bmiN = parseFloat(bmi);
      var row = _hcpScoreRowEl('BMI', bmi + ' kg/m²', bmiN < 18.5 || bmiN > 27.5,
        bmiN > 30 ? 'Obese' : bmiN > 27.5 ? 'Overweight' : bmiN < 18.5 ? 'Underweight' : '');
      if (row) profileHost.appendChild(row);
    }
  }

  if (patient.comorbidities && Object.keys(patient.comorbidities).length) {
    var comorbSection = tab.querySelector('.hcp-comorb-section');
    var comorbHost = listHost(tab, 'comorbRows');
    if (comorbSection) comorbSection.classList.remove('is-hidden');
    if (comorbHost) {
      Object.entries(patient.comorbidities).forEach(function(entry) {
        var col = entry[1] === 'Uncontrolled' ? '#EF9A9A' : entry[1] === 'Not Sure' ? '#90CAF9' : '#A5D6A7';
        var row = _hcpScoreRowEl(entry[0], entry[1]);
        if (row) {
          var v = row.querySelector('[data-fill="value"]');
          if (v) v.style.color = col;
          comorbHost.appendChild(row);
        }
      });
    }
  }

  host.appendChild(tab);
}

function _hcpAppendMetric(host, label, val, sub, col, pct) {
  var mFrag = cloneTemplate('tpl-hcp-pd-metric-card');
  if (!mFrag || !mFrag.firstElementChild) return;
  var card = mFrag.firstElementChild;
  fillTemplate(card, { label: label, value: String(val), sub: sub });
  var valEl = card.querySelector('[data-fill="value"]');
  if (valEl) valEl.style.color = col;
  var fill = card.querySelector('[data-fill="barFill"]');
  if (fill) { fill.style.width = pct + '%'; fill.style.background = col; }
  host.appendChild(card);
}

function _hcpMountTab1(host, patient) {
  var frag = cloneTemplate('tpl-hcp-pd-tab-1');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;
  var hasContent = false;
  if (patient.redFlags?.length) {
    var rfHost = tab.querySelector('[data-fill="redFlags"]');
    if (rfHost) {
      var rfFrag = cloneTemplate('tpl-hcp-pd-red-flags');
      if (rfFrag && rfFrag.firstElementChild) {
        var box = rfFrag.firstElementChild;
        var items = listHost(box, 'items');
        if (items) {
          patient.redFlags.forEach(function(rf) {
            var iFrag = cloneTemplate('tpl-hcp-pd-red-flag-item');
            if (iFrag && iFrag.firstElementChild) {
              fillTemplate(iFrag.firstElementChild, { text: '⚠ ' + rf });
              items.appendChild(iFrag.firstElementChild);
            }
          });
        }
        rfHost.appendChild(box);
        hasContent = true;
      }
    }
  }
  var savedNote = (typeof evhGetHCPNote === 'function' ? evhGetHCPNote(patient) : null);
  var savedNoteText = savedNote ? savedNote.note : iLd('hcp_note_' + (patient.id || ''), '');
  if (savedNoteText) {
    var noteHost = tab.querySelector('[data-fill="clinicalNote"]');
    if (noteHost) {
      var nFrag = cloneTemplate('tpl-hcp-pd-clinical-note');
      if (nFrag && nFrag.firstElementChild) {
        fillTemplate(nFrag.firstElementChild, { note: savedNoteText });
        noteHost.appendChild(nFrag.firstElementChild);
        hasContent = true;
      }
    }
  }
  if (!hasContent) {
    var pad = tab.querySelector('.hcp-tab1-pad');
    if (pad) {
      var empty = document.createElement('div');
      empty.className = 'hcp-tab1-empty';
      empty.textContent = 'No red flags or saved clinical notes for this patient.';
      pad.appendChild(empty);
    }
  }
  host.appendChild(tab);
}

function _hcpMountTab2(host, scores) {
  var frag = cloneTemplate('tpl-hcp-pd-tab-2');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;
  var tbody = listHost(tab, 'rows');
  if (!tbody) { host.appendChild(tab); return; }
  var rows = [
    { label: 'MenQOL Vasomotor', value: scores.MENQOL_vasomotor || 0, max: 20, band: scores.MENQOL_vasomotor >= 14 ? 'High' : scores.MENQOL_vasomotor >= 7 ? 'Moderate' : 'Low' },
    { label: 'MenQOL Physical', value: scores.MENQOL_physical || 0, max: 20, band: scores.MENQOL_physical >= 14 ? 'High' : scores.MENQOL_physical >= 7 ? 'Moderate' : 'Low' },
    { label: 'MenQOL Psychosocial', value: scores.MENQOL_psychosocial || 0, max: 20, band: scores.MENQOL_psychosocial >= 14 ? 'High' : scores.MENQOL_psychosocial >= 7 ? 'Moderate' : 'Low' },
    { label: 'MenQOL Sexual', value: scores.MENQOL_sexual || 0, max: 20, band: scores.MENQOL_sexual >= 14 ? 'High' : scores.MENQOL_sexual >= 7 ? 'Moderate' : 'Low' },
    { label: 'ISI Sleep', value: scores.ISI || 0, max: 28, band: scores.ISI_band || '' }
  ];
  if (scores.PHQ9 != null) rows.push({ label: 'PHQ-9 Depression', value: scores.PHQ9 || 0, max: 27, band: scores.PHQ9_band || '' }, { label: 'GAD-7 Anxiety', value: scores.GAD7 || 0, max: 21, band: scores.GAD7_band || '' }, { label: 'PSS-8 Stress', value: scores.PSS8 || 0, max: 32, band: scores.PSS8_band || '' });
  if (scores.FSFI != null) rows.push({ label: 'FSFI Sexual Function', value: scores.FSFI || 0, max: 36, band: scores.FSFI_band || '' }, { label: 'FSDSR Sexual Distress', value: scores.FSDSR || 0, max: 52, band: scores.FSDSR_band || '' });
  rows.push({ label: 'Comorbidity Modifier', value: '+' + (scores.comorbidityMod || 0), max: null, band: 'Additive' });
  rows.forEach(function(r) {
    var rFrag = cloneTemplate('tpl-hcp-pd-scores-row');
    if (!rFrag || !rFrag.firstElementChild) return;
    var tr = rFrag.firstElementChild;
    fillTemplate(tr, { label: r.label, band: r.band });
    var numVal = parseFloat(r.value) || 0;
    var colour = r.max ? (numVal / r.max > 0.7 ? '#EF9A9A' : numVal / r.max > 0.4 ? '#FFCC80' : '#A5D6A7') : 'rgba(255,255,255,0.38)';
    var pct = r.max ? Math.round(Math.min(numVal / r.max, 1) * 100) : 0;
    var scoreCell = tr.querySelector('[data-fill="score"]');
    if (scoreCell) {
      scoreCell.innerHTML = r.max
        ? '<span style="color:' + colour + ';font-weight:800;font-size:15px">' + r.value + '</span><span style="color:rgba(255,255,255,0.2);font-size:11px"> /' + r.max + '</span>'
        : '<span style="color:' + colour + ';font-weight:800;font-size:15px">' + r.value + '</span>';
    }
    var barCell = tr.querySelector('[data-fill="bar"]');
    if (barCell) {
      if (r.max) {
        var bFrag = cloneTemplate('tpl-hcp-pd-score-bar');
        if (bFrag && bFrag.firstElementChild) {
          var fill = bFrag.firstElementChild.querySelector('[data-fill="fill"]');
          if (fill) { fill.style.width = pct + '%'; fill.style.background = colour; }
          barCell.appendChild(bFrag.firstElementChild);
        }
      } else {
        barCell.textContent = '—';
      }
    }
    var bandCell = tr.querySelector('[data-fill="band"]');
    if (bandCell) bandCell.style.color = colour;
    tbody.appendChild(tr);
  });
  host.appendChild(tab);
}

function _hcpMountTab3(host, patient) {
  var triage = patient.triage || [];
  var frag = cloneTemplate('tpl-hcp-pd-tab-3');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;
  fillTemplate(tab, { countLabel: triage.length + ' Actions Triggered' });
  var listHost = tab.querySelector('[data-list="items"]');
  if (listHost) {
    if (triage.length) {
      triage.forEach(function(t) {
        var tFrag = cloneTemplate('tpl-hcp-pd-triage-item');
        if (!tFrag || !tFrag.firstElementChild) return;
        var item = tFrag.firstElementChild;
        var sevClass = t.sev === 'severe' ? 'sev' : t.sev === 'moderate' ? 'mod' : 'norm';
        var sevLabel = t.sev === 'severe' ? 'Urgent' : t.sev === 'moderate' ? 'Recommended' : 'Advisory';
        item.classList.add(sevClass);
        fillTemplate(item, {
          icon: TRIAGE_ICONS[t.action] || '✦',
          action: t.action.replace(/_/g, ' '),
          rules: t.rules.slice(0, 4).join(', '),
          sev: sevLabel
        });
        listHost.appendChild(item);
      });
    } else {
      var empty = document.createElement('div');
      empty.className = 'hcp-triage-empty';
      empty.textContent = 'No triage actions — wellness baseline';
      listHost.appendChild(empty);
    }
  }
  host.appendChild(tab);
}

function _hcpMountTab4(host, patient) {
  var triage = patient.triage || [];
  var frag = cloneTemplate('tpl-hcp-pd-tab-4');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;
  var cardsHost = tab.querySelector('[data-list="cards"]');
  if (cardsHost) {
    if (triage.length) {
      triage.forEach(function(t) {
        var colours = t.sev === 'severe'
          ? { bg: 'rgba(183,28,28,0.14)', border: 'rgba(183,28,28,0.35)', text: '#EF9A9A' }
          : t.sev === 'moderate'
          ? { bg: 'rgba(255,152,0,0.10)', border: 'rgba(255,152,0,0.30)', text: '#FFCC80' }
          : { bg: 'rgba(76,175,80,0.08)', border: 'rgba(76,175,80,0.20)', text: '#A5D6A7' };
        var cFrag = cloneTemplate('tpl-hcp-pd-care-card');
        if (!cFrag || !cFrag.firstElementChild) return;
        var card = cFrag.firstElementChild;
        card.style.background = colours.bg;
        card.style.border = '1px solid ' + colours.border;
        fillTemplate(card, {
          title: t.action.replace(/_/g, ' '),
          desc: TRIAGE_DESCRIPTIONS[t.action] || '',
          sev: t.sev
        });
        var sevEl = card.querySelector('[data-fill="sev"]');
        if (sevEl) { sevEl.style.background = colours.border; sevEl.style.color = colours.text; }
        cardsHost.appendChild(card);
      });
    } else {
      var empty = document.createElement('div');
      empty.className = 'hcp-triage-empty';
      empty.textContent = 'No care actions — wellness maintenance recommended';
      cardsHost.appendChild(empty);
    }
  }
  var savedNote = (typeof evhGetHCPNote === 'function' ? evhGetHCPNote(patient) : null);
  var noteArea = tab.querySelector('#hcp-note-area');
  if (noteArea) noteArea.value = savedNote ? savedNote.note : '';
  host.appendChild(tab);
  _hcpMountTab4ApptSection(tab, patient);
  _hcpLoadNoteIntoCarePlan(patient, noteArea);
}

function _hcpLoadNoteIntoCarePlan(patient, noteArea) {
  _hcpFetchPatientAppointments(patient, function(rows) {
    var fromAppt = '';
    (rows || []).some(function(r) {
      var n = (r.notes || '').trim();
      if (n) { fromAppt = n; return true; }
      return false;
    });
    if (fromAppt && noteArea) noteArea.value = fromAppt;
  });
}

function _hcpMountTab5(host, patient) {
  var rawData = { name: patient.name, age: patient.age, stage: patient.stage, prakriti: patient.prakriti, scores: patient.scores, triage: patient.triage, redFlags: patient.redFlags, comorbidities: patient.comorbidities };
  var frag = cloneTemplate('tpl-hcp-pd-tab-5');
  if (!frag || !frag.firstElementChild) return;
  var tab = frag.firstElementChild;
  var jsonEl = tab.querySelector('[data-fill="json"]');
  if (jsonEl) jsonEl.textContent = JSON.stringify(rawData, null, 2);
  host.appendChild(tab);
}

function buildDetailHeader() { return ''; }
function buildAlertBanners() { return ''; }
function buildTabBar() { return ''; }
function buildTab0_Overview() { return ''; }
function buildWearableSection() { return ''; }
function buildTab1_ClinicalSummary() { return ''; }
function buildTab2_ScoresTable() { return ''; }
function buildTab3_Triage() { return ''; }
function buildTab4_CarePlan() { return ''; }
function buildTab5_RawData() { return ''; }

// ACTIONS

function saveHCPNote() {
  const patient = S.selectedPatient; if (!patient) return;
  const textarea = document.getElementById('hcp-note-area'); if (!textarea) return;
  const consultant = S.hcpConsultant?.name || 'Your Consultant';
  const text = textarea.value;

  if (typeof evhSaveHCPNote === 'function') {
    evhSaveHCPNote(patient, text, consultant);
  }

  _hcpSaveNoteToAppointment(patient, text, function(ok) {
    iLogA('ok', 'Clinical note saved for ' + patient.name, ok ? 'Synced to Supabase' : 'Local only', 'HCP');
    if (ok) {
      intToast('success', 'Note saved', 'Synced to patient appointment — visible on patient dashboard', 'HCP');
    } else {
      intToast('warn', 'Note saved locally', 'No matching appointment in Supabase to attach the note', 'HCP');
    }
    setTimeout(function() { renderPatientDetail(patient, 3); }, 700);
  });
}

function hcpCompleteConsult(appt) {
  var appointmentId = appt && appt.id ? appt.id : appt;
  var apptRow = appt && typeof appt === 'object' ? appt : null;
  hcpMarkComplete(appointmentId, function() {
    iLogA('ok', 'Consultation completed', S.selectedPatient ? S.selectedPatient.name : '', 'HCP');
    if (S.selectedPatient) {
      setTimeout(function() { renderPatientDetail(S.selectedPatient, 3); }, 400);
    }
  }, apptRow);
}

function hcpBookOnBehalf() {
  const patient = S.selectedPatient; if (!patient) { alert('No patient selected'); return; }
  const patients = iLd(IK.pt, []);
  if (!patients.find(p => p.id === patient.id)) { patients.unshift(patient); iSv(IK.pt, patients); }
  intShowBooking();
  intToast('info', `Booking on behalf of ${patient.name}`, 'Select consultant, slot and payment', 'HCP');
}

function switchPDTab(index, el) {
  document.querySelectorAll('.pd-tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  else {
    var tab = document.querySelector('.pd-tab[data-tab-index="' + index + '"]');
    if (tab) tab.classList.add('active');
  }
  document.querySelectorAll('.pd-tab-content').forEach(function(t) { t.style.display = 'none'; });
  var panel = document.getElementById('tab' + index);
  if (panel) panel.style.display = 'block';
}

function buildScoreRow(label, value, isAbnormal, note) {
  return _hcpScoreRowEl(label, value, isAbnormal, note) ? _hcpScoreRowEl(label, value, isAbnormal, note).outerHTML : '';
}

// DOWNLOADS

function downloadHCPReport() {
  const patient = S.selectedPatient; if (!patient) return;
  const sc = patient.scores || {};
  const lines = ['EvaEraHealth Clinical Report', `Generated: ${new Date().toLocaleString()}`, '', `Patient: ${patient.name} | Age: ${patient.age} | ${patient.stage} | Prakriti: ${patient.prakriti || '-'}`, '', `COMPOSITE: ${sc.composite || 0}/100 [${sc.composite_band || '-'}]`, `MenQOL: VM=${sc.MENQOL_vasomotor || 0} Ph=${sc.MENQOL_physical || 0} PS=${sc.MENQOL_psychosocial || 0} Sx=${sc.MENQOL_sexual || 0}`, `PHQ9=${sc.PHQ9 || 0}(${sc.PHQ9_band}) GAD7=${sc.GAD7 || 0}(${sc.GAD7_band}) PSS8=${sc.PSS8 || 0}(${sc.PSS8_band})`, `ISI=${sc.ISI || 0}(${sc.ISI_band})`, '', 'TRIAGE:', ...(patient.triage || []).map(t => `  • ${t.action} [${t.sev}]`), '', `Red Flags: ${patient.redFlags?.length ? patient.redFlags.join(', ') : 'None'}`, '', 'EvaEraHealth Clinic, Gurugram | +91 80690 50000 | clinic@evaerahealth.in'].join('\n');
  const blob = new Blob([lines], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `EvaEraHealth_${patient.name.replace(/\s/g, '_')}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

function downloadHCPJSON() {
  const patient = S.selectedPatient; if (!patient) return;
  const raw = { name: patient.name, age: patient.age, stage: patient.stage, prakriti: patient.prakriti, scores: patient.scores, triage: patient.triage, redFlags: patient.redFlags, comorbidities: patient.comorbidities };
  const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `EvaEraHealth_${patient.name.replace(/\s/g, '_')}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

// SHARED HELPERS 

// STYLES 

function _hcpInjectStyles() {
  if (document.getElementById('hcp-dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'hcp-dashboard-styles';
  style.textContent = `

    /* HCP DASHBOARD — TOP NAV LAYOUT */

    
    /* ── Full-bleed overrides ── */
    #hcp-portal-screen {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    #hcp-portal-screen .hcp-header {
      width: 100%;
      box-sizing: border-box;
    }
    .hcp-content {
      width: 100% !important;
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    }

    /* ── Tab Strip ── */
    .hcp-tab-strip {
      position: sticky;
      top: 0;
      z-index: 190;
      display: flex;
      width: 100%;
      box-sizing: border-box;
      background: #111827;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      padding: 0;
      margin: 0;
    }
    .hcp-tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 11px 8px;
      cursor: pointer;
      border-bottom: 2.5px solid transparent;
      transition: all 0.15s;
      opacity: 0.5;
    }
    .hcp-tab-btn.active {
      opacity: 1;
      border-bottom-color: #C0305A;
    }
    .hcp-tab-icon { font-size: 16px; }
    .hcp-tab-txt {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .hcp-tab-btn.active .hcp-tab-txt { color: #F9A8C9; }

    /* Tab Panels */
    .hcp-tab-panel {
      height: calc(100vh - 46px);
      overflow-y: auto;
      width: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* HOME TAB */

    .hcp-home-wrap {
      padding: 14px 14px 32px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      margin: 0;
    }

    /* Welcome card — full-width hero */
    .hcp-welcome-card {
      background: linear-gradient(135deg, #1A0A2E 0%, #16213E 50%, #0D1B2A 100%);
      border: 1px solid rgba(192,48,90,0.3);
      border-radius: 20px;
      padding: 22px 20px 18px;
      position: relative;
      overflow: hidden;
    }
    .hcp-welcome-card::before {
      content: '🌸';
      position: absolute;
      right: -10px; bottom: -10px;
      font-size: 80px;
      opacity: 0.06;
      pointer-events: none;
    }
    .hcp-welcome-glow {
      position: absolute;
      top: -30px; right: -30px;
      width: 140px; height: 140px;
      background: radial-gradient(circle, rgba(192,48,90,0.4), transparent 70%);
      pointer-events: none;
    }
    .hcp-welcome-inner {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
      position: relative; z-index: 1;
    }
    .hcp-welcome-avatar {
      width: 58px; height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #C0305A, #9C1B43);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 900; color: #fff;
      flex-shrink: 0;
      border: 2.5px solid rgba(192,48,90,0.5);
      box-shadow: 0 4px 20px rgba(192,48,90,0.3);
    }
    .hcp-welcome-greeting {
      font-size: 11px; color: rgba(255,255,255,0.38);
      font-weight: 600; margin-bottom: 2px;
    }
    .hcp-welcome-name {
      font-size: 22px; font-weight: 800; color: #fff;
      font-family: 'Cormorant Garamond', serif;
      line-height: 1.15;
    }
    .hcp-welcome-qual { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
    .hcp-welcome-spec {
      font-size: 12px; color: #F9A8C9; font-weight: 700; margin-top: 3px;
    }
    .hcp-welcome-meta {
      display: flex; flex-wrap: wrap; gap: 6px;
      position: relative; z-index: 1; margin-bottom: 10px;
    }
    .hcp-meta-pill {
      font-size: 10px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.13);
      border-radius: 20px;
      padding: 4px 10px;
      color: rgba(255,255,255,0.55);
      font-weight: 600;
    }
    .hcp-welcome-email {
      font-size: 10px; color: rgba(255,255,255,0.22);
      position: relative; z-index: 1;
    }

    /* Stats row */
    .hcp-stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .hcp-stat-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 14px 8px 12px;
      text-align: center;
      transition: transform 0.15s;
    }
    .hcp-stat-card:active { transform: scale(0.97); }
    .hcp-stat-card.hcp-stat-warn   { border-color: rgba(255,152,0,0.3);  background: rgba(255,152,0,0.04); }
    .hcp-stat-card.hcp-stat-danger { border-color: rgba(239,83,80,0.3);  background: rgba(239,83,80,0.04); }
    .hcp-stat-card.hcp-stat-ok     { border-color: rgba(76,175,80,0.3);  background: rgba(76,175,80,0.04); }
    .hcp-stat-num { font-size: 28px; font-weight: 900; color: #fff; line-height: 1; }
    .hcp-stat-warn   .hcp-stat-num { color: #FFCC80; }
    .hcp-stat-danger .hcp-stat-num { color: #EF9A9A; }
    .hcp-stat-ok     .hcp-stat-num { color: #A5D6A7; }
    .hcp-stat-label {
      font-size: 9px; font-weight: 700;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase; letter-spacing: 0.4px;
      margin-top: 4px;
    }

    /* Section title */
    .hcp-section-title {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px;
      color: rgba(255,255,255,0.28);
      padding-left: 2px;
    }

    /* Quick actions */
    .hcp-quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .hcp-quick-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 16px;
      padding: 18px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      font-weight: 700;
      transition: all 0.15s;
      letter-spacing: 0.2px;
    }
    .hcp-quick-btn:hover, .hcp-quick-btn:active {
      background: rgba(192,48,90,0.12);
      border-color: rgba(192,48,90,0.35);
      color: #F9A8C9;
    }

    /* Info card */
    .hcp-info-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      overflow: hidden;
    }
    .hcp-info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .hcp-info-row:last-child { border-bottom: none; }
    .hcp-info-label { font-size: 11px; color: rgba(255,255,255,0.3); font-weight: 600; }
    .hcp-info-val   { font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 600; }

    /* APPOINTMENTS TAB*/

    .hcp-appt-wrap { display: flex; flex-direction: column; }
    .hcp-appt-header {
      background: linear-gradient(135deg, #0D1B2A, #1B2B3A);
      padding: 18px 16px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .hcp-appt-title {
      font-size: 20px; font-weight: 800; color: #fff;
      font-family: 'Cormorant Garamond', serif; margin-bottom: 3px;
    }
    .hcp-appt-subtitle { font-size: 11px; color: rgba(255,255,255,0.32); }
    .hcp-appt-loading { text-align: center; padding: 60px 20px; }
    .hcp-appt-group-label {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: rgba(255,255,255,0.28);
      margin-bottom: 8px;
    }
  `;
  document.head.appendChild(style);
}

// ── Status badge (mirrors admin version, HCP-palette)
function hcpApptStatusBadge(status) {
  const map = {
    booked:      { label: '✓ Booked'      },
    rescheduled: { label: '📅 Rescheduled' },
    cancelled:   { label: '✕ Cancelled'   },
    completed:   { label: '✔ Completed'   },
    confirmed:   { label: '✓ Confirmed'   },
    pending:     { label: '⏳ Pending'     },
  };
  const s   = (status || 'booked').toLowerCase();
  const cfg = map[s] || map.booked;
  // MOVED: tpl-hcp-appt-status
  var frag = cloneTemplate('tpl-hcp-appt-status');
  if (!frag || !frag.firstElementChild) return '';
  var el = frag.firstElementChild;
  el.className = 'hcp-appt-status hcp-appt-status--' + s;
  fillTemplate(el, { label: cfg.label });
  return el.outerHTML;
}

function hcpApptStatusBadgeEl(status) {
  const map = {
    booked:      { label: '✓ Booked'      },
    rescheduled: { label: '📅 Rescheduled' },
    cancelled:   { label: '✕ Cancelled'   },
    completed:   { label: '✔ Completed'   },
    confirmed:   { label: '✓ Confirmed'   },
    pending:     { label: '⏳ Pending'     },
  };
  const s   = (status || 'booked').toLowerCase();
  const cfg = map[s] || map.booked;
  var frag = cloneTemplate('tpl-hcp-appt-status');
  if (!frag || !frag.firstElementChild) return document.createElement('span');
  var el = frag.firstElementChild;
  el.className = 'hcp-appt-status hcp-appt-status--' + s;
  fillTemplate(el, { label: cfg.label });
  return el;
}

// ── Inline update a single appointment row in HCP table
/**
 * If the HCP portal is showing a table/list of patient appointments,
 * this function finds the row by appointment id and patches it in-place,
 * avoiding a full re-render that might disrupt scroll position.
 * @param {Object} newRow  — the updated Supabase row
 */

function hcpPatchApptRow(newRow) {
  // Pattern: your HCP portal likely renders rows with id="hcp-appt-row-{appt.id}"
  // If it doesn't, add that id when building rows, then this will work automatically.
  const rowEl = document.getElementById(`hcp-appt-row-${newRow.id}`);
  if (!rowEl) {
    // Row not in DOM — trigger a full HCP refresh instead
    hcpRefreshAppointments();
    return;
  }

  // Flash yellow to signal the change
  rowEl.style.transition  = 'background .3s';
  rowEl.style.background  = '#FFFBEB';
  setTimeout(() => { rowEl.style.background = ''; }, 2000);

  // Patch status cell (assumes last <td> or a td with data-col="status")
  const statusCell = rowEl.querySelector('[data-col="status"]') || rowEl.lastElementChild;
  if (statusCell) {
    statusCell.innerHTML = '';
    statusCell.appendChild(hcpApptStatusBadgeEl(newRow.status));
  }

  // Patch mode cell if present
  const modeCell = rowEl.querySelector('[data-col="mode"]');
  if (modeCell) {
    modeCell.textContent = newRow.mode === 'video' ? '📹 Video' : '🏥 In-Person';
  }

  // Patch date/time cell if present (after reschedule)
  const dtCell = rowEl.querySelector('[data-col="datetime"]');
  if (dtCell && newRow.appointment_date) {
    const [y, m, d] = newRow.appointment_date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateLabel = `${d} ${months[+m-1]} ${y}`;
    const [hh, mm] = (newRow.slot_time || '00:00').split(':');
    const h = +hh; const ampm = h >= 12 ? 'PM' : 'AM';
    const timeLabel = `${h % 12 || 12}:${mm} ${ampm}`;
    dtCell.textContent = `${dateLabel} · ${timeLabel}`;
  }
}

// ── Full HCP appointments refresh
/**
 * Call your existing HCP appointments render function here.
 * Replace `hcpRenderPatientQueue` with whatever your hcp-portal.js uses.
 */
async function hcpRefreshAppointments() {
  // Common function names in your codebase — use whichever exists:
  if (typeof hcpRenderPatientQueue === 'function')    hcpRenderPatientQueue();
  else if (typeof hcpLoadAppointments === 'function') hcpLoadAppointments();
  else if (typeof renderHcpDashboard === 'function')  renderHcpDashboard();
  // If none match, add your HCP render function name here.
}

// ── Supabase Realtime subscription for HCP
/**
 * Subscribe to appointments changes filtered to this HCP's consultant_id.
 * Call after HCP login, passing their consultant_id.
 * @param {string} consultantId
 */

function hcpSubscribeApptRealtime(consultantId) {
  const SB = getSupabaseClient();

  // Use a unique channel per consultant to avoid duplicate subscriptions
  SB.channel(`hcp-appt-${consultantId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'appointments',
        filter: `consultant_id=eq.${consultantId}`,
      },
      (payload) => {
        const { eventType, new: newRow } = payload;

        if (eventType === 'UPDATE' && newRow) {
          hcpPatchApptRow(newRow);

          // Toast notification for the HCP
          let msg = '';
          if (newRow.status === 'cancelled')
            msg = `🔔 ${newRow.patient_name || 'A patient'} cancelled their appointment`;
          else if (newRow.status === 'rescheduled')
            msg = `🔔 ${newRow.patient_name || 'A patient'} rescheduled to ${newRow.appointment_date}`;
          else if (newRow.mode)
            msg = `🔔 ${newRow.patient_name || 'A patient'} changed mode to ${newRow.mode === 'video' ? 'Video Call' : 'In-Person'}`;

          if (msg && typeof intToast === 'function') intToast(msg, 'info');
        }
      }
    )
    .subscribe();
}

// ── renderHcpApptRow helper
/**
 * Helper to generate a <tr> with proper data-col attributes so hcpPatchApptRow
 * can find and update cells without a full re-render.
 *
 * Use this (or adapt it) when building the HCP appointments table.
 * @param {Object} appt
 * @returns {string}
 */

function renderHcpApptRow(appt) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var ymd = (appt.appointment_date || '').split('-');
  var dateLabel = (ymd[0] && ymd[1] && ymd[2]) ? ymd[2] + ' ' + months[+ymd[1]-1] + ' ' + ymd[0] : '—';
  var hhmm = (appt.slot_time || '').split(':');
  var h = +hhmm[0];
  var timeLabel = (hhmm[0] !== undefined)
    ? (h % 12 || 12) + ':' + hhmm[1] + ' ' + (h >= 12 ? 'PM' : 'AM')
    : '—';
  // MOVED: tpl-hcp-appt-row
  return _tplOuterHTML('tpl-hcp-appt-row', function(tr) {
    tr.id = 'hcp-appt-row-' + appt.id;
    fillTemplate(tr, {
      patient: appt.patient_name || '—',
      datetime: dateLabel + ' · ' + timeLabel,
      mode: appt.mode === 'video' ? '📹 Video' : '🏥 In-Person'
    });
    var st = tr.querySelector('[data-fill="status"]');
    if (st) { st.innerHTML = ''; st.appendChild(hcpApptStatusBadgeEl(appt.status)); }
  });
}

function _bindHcpAuthHtml(){
  document.querySelectorAll('[data-action="hcpSendOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',hcpSendOTP);}
  });
  document.querySelectorAll('[data-action="hcpVerifyOTP"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',hcpVerifyOTP);}
  });
  document.querySelectorAll('[data-action="hcpOtpNext"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('input',function(){hcpOtpNext(el);});}
  });
}

document.addEventListener('DOMContentLoaded',_bindHcpAuthHtml);