/* HELPERS */

function _pd_iLd(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
}
function _pd_iSv(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

/* SCORE / BAND UTILITIES */

var PD_BAND_CFG = {
  composite: [
    { min: 81, label: 'Critical',  colour: '#B71C1C', fill: '#EF4444' },
    { min: 56, label: 'Severe',    colour: '#EF5350', fill: '#F87171' },
    { min: 31, label: 'Moderate',  colour: '#F59E0B', fill: '#FBBF24' },
    { min:  6, label: 'Mild',      colour: '#16A34A', fill: '#4ADE80' },
    { min:  0, label: 'Optimal',   colour: '#00695C', fill: '#2DD4BF' },
  ],
};

function _pdBand(composite) {
  for (var i = 0; i < PD_BAND_CFG.composite.length; i++) {
    if (composite >= PD_BAND_CFG.composite[i].min) return PD_BAND_CFG.composite[i];
  }
  return PD_BAND_CFG.composite[PD_BAND_CFG.composite.length - 1];
}

function _pdScoreColour(value, warnAt, alertAt) {
  if (value >= alertAt) return '#EF4444';
  if (value >= warnAt)  return '#F59E0B';
  return '#16A34A';
}

function _pdNormMode(mode) {
  var m = String(mode || '').toLowerCase().trim();
  if (m === 'video' || m === 'online' || m.indexOf('video') >= 0) return 'video';
  return 'in-person';
}

function _pdModeDisplay(mode) {
  return _pdNormMode(mode) === 'video' ? 'Video' : 'In-Person';
}

function _pdIsVideoMode(mode) {
  return _pdNormMode(mode) === 'video';
}

function _pdIsUpcomingAppt(a) {
  var status = String((a && a.status) || '').toLowerCase();
  var ACTIVE = ['booked', 'confirmed', 'pending', 'rescheduled'];
  if (ACTIVE.indexOf(status) === -1) return false;
  var apptMs = _parseApptDateTime(
    (a && (a.appt_date || a.appointment_date)) || '',
    (a && (a.appt_time || a.slot_time)) || ''
  );
  return apptMs ? apptMs > Date.now() : true;
}

async function _pdRegenerateMeetLink(appt) {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  if (!base || !appt || !appt.id) return null;
  try {
    var res = await fetch(base + '/generate-meet-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id:    String(appt.id),
        patient_name:  appt.patient_name || 'Patient',
        doctor_name:   appt.consultant_name || appt.clinician_name || 'Consultant',
        date:          appt.appointment_date || appt.appt_date,
        time:          appt.slot_time || appt.appt_time,
        patient_email: appt.patient_email || null,
        doctor_email:  appt.doctor_email || appt.clinician_email || null
      })
    });
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error(err.detail || 'generate failed');
    }
    var data = await res.json();
    if (data.meet_link) {
      appt.meet_link = data.meet_link;
      if (window._apptMgmtCache && appt.id) window._apptMgmtCache[appt.id].meet_link = data.meet_link;
    }
    return data.meet_link || null;
  } catch (e) {
    
    return null;
  }
}

/* DATA HELPERS */

async function _pdGetAppointments(patient) {
  if (!patient || !window.SUPABASE_URL || !window.SUPABASE_KEY) return [];

  var authId = patient.authId
    || (window.S && S.session && S.session.authId)
    || patient.email
    || null;

  if (!authId) return [];

  var url = window.SUPABASE_URL
    + '/rest/v1/appointments'
    + '?select=*'
    + '&patient_email=eq.' + encodeURIComponent(authId.trim().toLowerCase())
    + '&order=created_at.desc';

  try {
    var res = await fetch(url, {
      cache: 'no-store', 
      headers: {
        'apikey':        window.SUPABASE_KEY,
        'Authorization': 'Bearer ' + window.SUPABASE_KEY
      }
    });
    if (!res.ok) {
      var errText = await res.text();
      throw new Error('HTTP ' + res.status + ' — ' + errText);
    }
    var rows = await res.json();

    return rows.map(function(a) {
      return Object.assign({}, a, {
        consultant_name: a.clinician_name || 'Consultant',
        consultantSpec:  a.clinician_spec || ''
      });
    });
  } catch(e) {
    
    return [];
  }
}

function _pdGetHCPNote(patient) {
  if (typeof evhGetHCPNote === 'function') return evhGetHCPNote(patient);
  if (!patient) return null;
  var raw = _pd_iLd('evh_pat_note_' + (patient.id || ''), null);
  if (raw && typeof raw === 'object' && raw.note) return raw;
  var plain = _pd_iLd('hcp_note_' + (patient.id || ''), '');
  return plain ? { note: plain, consultant: 'Your Consultant', savedAt: '' } : null;
}

function _pdNoteFromAppointments(appts) {
  for (var i = 0; i < (appts || []).length; i++) {
    var a = appts[i];
    var n = (a.notes || '').trim();
    if (!n) continue;
    var when = a.updated_at || a.completed_at || a.booked_at || a.created_at;
    return {
      note:       n,
      consultant: a.clinician_name || 'Your Consultant',
      savedAt:    when ? new Date(when).toLocaleString('en-IN') : '',
    };
  }
  return null;
}

function _pdResolveHCPNote(appts, patient) {
  return _pdNoteFromAppointments(appts) || _pdGetHCPNote(patient);
}

/* VISIT HISTORY — reads all localStorage records for this authId */

function _pdLocalVisitHistory(authId) {
  try {
    var p = JSON.parse(localStorage.getItem('evr_patients_v7') || '[]');
    var norm = authId.trim().toLowerCase();
    return p
      .filter(function(pt) {
        return pt.authId && pt.authId.trim().toLowerCase() === norm && pt.composite != null && pt.timestamp;
      })
      .sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); })
      .map(function(pt) {
        var dt = new Date(pt.timestamp);
        return {
          dateStr:   dt.toISOString().substring(0, 16),
          date:      dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                     + ' ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
          composite: pt.composite
        };
      });
  } catch(e) { return []; }
}

/* VISIT HISTORY — fetches directly from assessments table using email_id */

function _pdFetchSupabaseVisitHistory(authId, callback) {
  if (!authId || !window.SUPABASE_URL || !window.SUPABASE_KEY) { callback([]); return; }

  var url = window.SUPABASE_URL
    + '/rest/v1/assessments'
    + '?email_id=eq.' + encodeURIComponent(authId.trim().toLowerCase())
    + '&select=login_date,login_time,scores'
    + '&order=login_date.asc,login_time.asc';

  fetch(url, {
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY
    }
  })
  .then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function(rows) {
    var visits = rows
      .filter(function(r) {
        return r.login_date && r.scores && r.scores.composite != null;
      })
      .map(function(r) {
        var dateTimeStr = r.login_date + 'T' + (r.login_time || '00:00:00');
        var dt = new Date(dateTimeStr);
        return {
          dateStr:   dateTimeStr.substring(0, 16),
          date:      dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                     + ' ' + (r.login_time ? r.login_time.substring(0, 5) : '00:00'),
          composite: r.scores.composite
        };
      });
    
    callback(visits);
  })
  .catch(function(err) {
    
    callback([]);
  });
}

/* VISIT HISTORY GRAPH — inline SVG line chart */

function _pdVisitGraphHTML(visits) {
  var W = 320, H = 120, PAD_L = 36, PAD_R = 16, PAD_T = 22, PAD_B = 28;
  var plotW = W - PAD_L - PAD_R;
  var plotH = H - PAD_T - PAD_B;

  function yPx(v) { return PAD_T + plotH - (Math.min(Math.max(v, 0), 100) / 100) * plotH; }
  function xPx(i) { return visits.length === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (visits.length - 1)) * plotW; }

  var zones = [
    { lo: 0,  hi: 5,   col: 'rgba(45,212,191,0.08)'  },
    { lo: 5,  hi: 30,  col: 'rgba(74,222,128,0.08)'  },
    { lo: 30, hi: 55,  col: 'rgba(251,191,36,0.08)'  },
    { lo: 55, hi: 80,  col: 'rgba(248,113,113,0.08)' },
    { lo: 80, hi: 100, col: 'rgba(239,68,68,0.10)'   },
  ];
  var zoneSvg = zones.map(function(z) {
    var y1 = yPx(z.hi), y2 = yPx(z.lo);
    return '<rect x="' + PAD_L + '" y="' + y1 + '" width="' + plotW + '" height="' + (y2 - y1) + '" fill="' + z.col + '"/>';
  }).join('');

  var gridSvg = [0, 25, 50, 75, 100].map(function(v) {
    var y = yPx(v);
    return '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>'
      + '<text x="' + (PAD_L - 4) + '" y="' + (y + 3) + '" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.25)" font-family="DM Sans,sans-serif">' + v + '</text>';
  }).join('');

  var PD_BAND_CFG2 = [
    { min: 81, fill: '#EF4444' },
    { min: 56, fill: '#F87171' },
    { min: 31, fill: '#FBBF24' },
    { min:  6, fill: '#4ADE80' },
    { min:  0, fill: '#2DD4BF' },
  ];
  function band2(c) {
    for (var i = 0; i < PD_BAND_CFG2.length; i++) if (c >= PD_BAND_CFG2[i].min) return PD_BAND_CFG2[i];
    return PD_BAND_CFG2[PD_BAND_CFG2.length - 1];
  }

  var lineCol = band2(visits[visits.length - 1].composite).fill;

  var areaPath = 'M' + xPx(0) + ',' + yPx(visits[0].composite)
    + visits.slice(1).map(function(v, i) { return ' L' + xPx(i + 1) + ',' + yPx(v.composite); }).join('')
    + ' L' + xPx(visits.length - 1) + ',' + (PAD_T + plotH)
    + ' L' + xPx(0) + ',' + (PAD_T + plotH) + ' Z';

  var points = visits.map(function(v, i) { return xPx(i) + ',' + yPx(v.composite); }).join(' ');

  var dotsSvg = visits.map(function(v, i) {
    var cx = xPx(i), cy = yPx(v.composite);
    var b = band2(v.composite);
    var isLast  = i === visits.length - 1;
    var isFirst = i === 0;
    var shortDate = v.date.split(' ').slice(0, 2).join(' ');
    var showLabel = isFirst || isLast || visits.length <= 5;

    var dl = showLabel
      ? '<text x="' + cx + '" y="' + (H - PAD_B + 11) + '" text-anchor="middle" font-size="7.5" fill="rgba(255,255,255,0.4)" font-family="DM Sans,sans-serif">' + shortDate + '</text>'
      : '';
    var bubble = isLast
      ? '<rect x="' + (cx - 14) + '" y="' + (cy - 22) + '" width="28" height="14" rx="4" fill="' + b.fill + '" opacity="0.92"/>'
        + '<text x="' + cx + '" y="' + (cy - 12) + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + v.composite + '</text>'
      : '';
    var dot = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isLast ? 5 : 3.5) + '" fill="' + b.fill + '" stroke="#0F1E3C" stroke-width="' + (isLast ? 2 : 1.5) + '"/>';
    return dl + bubble + dot;
  }).join('');

  var delta    = visits[visits.length - 1].composite - visits[0].composite;
  var deltaCol = delta < 0 ? '#4ADE80' : delta > 0 ? '#F87171' : 'rgba(255,255,255,0.4)';
  var deltaText = Math.abs(delta) > 0
    ? (delta < 0 ? '▼ ' : '▲ ') + Math.abs(delta) + ' pts since first visit'
    : 'No change since first visit';

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible">'
    + '<defs><linearGradient id="pdVgGrad" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + lineCol + '" stop-opacity="0.25"/>'
    + '<stop offset="100%" stop-color="' + lineCol + '" stop-opacity="0.01"/>'
    + '</linearGradient></defs>'
    + zoneSvg + gridSvg
    + '<path d="' + areaPath + '" fill="url(#pdVgGrad)"/>'
    + '<polyline points="' + points + '" fill="none" stroke="' + lineCol + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + dotsSvg
    + '</svg>';

  return '<div style="margin-top:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px 8px;position:relative;z-index:1">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.6px">Score history · ' + visits.length + ' visit' + (visits.length > 1 ? 's' : '') + '</div>'
    + '<div style="font-size:10px;font-weight:700;color:' + deltaCol + '">' + deltaText + '</div>'
    + '</div>'
    + svg
    + '</div>';
}

/* ENTRY POINT */

function _pdCheckReturningPatientLocal() {
  var hasPriorAssessment = false;
  var matchedPatient = null;

  try {
    var stored = localStorage.getItem('evr_patients_v7');
    if (stored) {
      var patients = JSON.parse(stored);
      var authId = (S.session && S.session.authId) ? S.session.authId.trim().toLowerCase() : null;
      if (authId && patients && patients.length > 0) {
        var matches = patients.filter(function(p) {
          return (p.authId && p.authId.trim().toLowerCase() === authId) ||
                 (p.sessionId && S.session && p.sessionId === S.session.id);
        }).sort(function(a, b) {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        if (matches.length > 0) {
          hasPriorAssessment = true;
          matchedPatient = matches[0];
        }
      }
    }
  } catch(e) {
    
  }

  if (hasPriorAssessment) {
    showPatientDashboard(matchedPatient);
  } else {
    showConsent();
  }
}

/* MAIN RENDER */

async function showPatientDashboard(patient) {
  var screen = document.getElementById('patient-dashboard-screen');
  if (!screen) {  return; }

  if (!document.getElementById('apmt-mgmt-modal')) {
    var frag = cloneTemplate('tpl-amm-modal');
    if (frag) {
      document.body.appendChild(frag);
    }
  }
  _pdBindApptModalActions();

  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  screen.classList.add('active');
  screen.style.display = 'block';

  // MOVED: tpl-pd-loading
  screen.innerHTML = '';
  mountTemplate('tpl-pd-loading', screen);

  await _pdMountDashboard(screen, patient);
  window._pdCurrentPatient = patient;
  _pdActivateTab(0);
  _pdBindNoteSync();

  var authId = (patient && patient.authId)
    ? patient.authId
    : (window.S && S.session && S.session.authId ? S.session.authId : null);

  if (!authId) return;
  var slot = document.getElementById('pd-visit-graph-slot');
  if (!slot) return;

  _pdFetchSupabaseVisitHistory(authId, function(visits) {
    if (visits.length >= 2) slot.innerHTML = _pdVisitGraphHTML(visits);
  });
}

/* DASHBOARD MOUNT */

async function _pdMountDashboard(screen, patient) {
  screen.innerHTML = '';
  // MOVED: tpl-pd-shell + sub-templates
  var root = mountTemplate('tpl-pd-shell', screen);
  if (!root) return;

  var sc = patient.scores || {};
  var comp = sc.composite || 0;
  var band = _pdBand(comp);
  var appts = await _pdGetAppointments(patient);
  var note = _pdResolveHCPNote(appts, patient);
  var hcpNote = note ? note.note : '';
  var hcpBy = note ? (note.consultant + (note.savedAt ? ' · ' + note.savedAt : '')) : '';
  var nextAppt = appts.filter(function(a) { return a.status === 'confirmed' || a.status === 'pending'; })[0];
  var assessDate = patient.timestamp
    ? new Date(patient.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Unknown date';

  _pdMountWelcome(root, patient, comp, band, assessDate, nextAppt);
  _pdMountTabBar(root);
  var panelsHost = root.querySelector('[data-fill="panels"]');
  if (panelsHost) {
    _pdMountPanel0(panelsHost, patient, sc, comp, band, appts, assessDate);
    _pdMountPanel1(panelsHost, sc);
    _pdMountPanel2(panelsHost, patient);
    _pdMountPanel3(panelsHost, appts);
    _pdMountPanel4(panelsHost, patient);
    _pdMountPanel5(panelsHost, hcpNote, hcpBy);
  }
  var retakeHost = root.querySelector('[data-fill="retake"]');
  if (retakeHost) mountTemplate('tpl-pd-retake-cta', retakeHost);

  _pdBindShellActions(root);
}

function _pdBindShellActions(root) {
  var screen = document.getElementById('patient-dashboard-screen');
  if (!screen || screen.dataset.pdShellBound) return;
  screen.dataset.pdShellBound = '1';
  screen.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el || !screen.contains(el)) return;
    var action = el.getAttribute('data-action');
    if (action === 'pdRetakeAssessment') pdRetakeAssessment();
    else if (action === 'pdSignOut') pdSignOut();
    else if (action === 'pdBookAppointment') pdBookAppointment();
    else if (action === 'pdActivateTab') _pdActivateTab(parseInt(el.getAttribute('data-tab-index'), 10));
  });
}

function _pdMountWelcome(root, patient, comp, band, assessDate, nextAppt) {
  var host = root.querySelector('[data-fill="welcome"]');
  if (!host) return;
  var frag = cloneTemplate('tpl-pd-welcome');
  if (!frag || !frag.firstElementChild) return;
  var welcome = frag.firstElementChild;
  fillTemplate(welcome, {
    name: 'Welcome back, ' + (patient.name || 'Patient'),
    sub: 'Last assessed: ' + assessDate + ' · ' + (patient.stage || '') + ' · Prakriti: ' + (patient.prakriti || '—')
  });
  var scoreEl = welcome.querySelector('[data-fill="score"]');
  if (scoreEl) { scoreEl.textContent = String(comp); scoreEl.style.color = band.fill; }
  var bandEl = welcome.querySelector('[data-fill="band"]');
  if (bandEl) { bandEl.textContent = band.label; bandEl.style.color = band.fill; }
  var barEl = welcome.querySelector('[data-fill="barFill"]');
  if (barEl) { barEl.style.width = Math.min(comp, 100) + '%'; barEl.style.background = band.fill; }
  fillTemplate(welcome, {
    meta1: 'Out of 100 · Assessed ' + assessDate,
    meta2: ((patient.triage || []).length) + ' care actions triggered'
  });
  var pillsHost = welcome.querySelector('[data-list="pills"]');
  if (pillsHost) {
    if (patient.stage) _pdAppendPill(pillsHost, '🌸 ' + patient.stage);
    if (patient.city) _pdAppendPill(pillsHost, '📍 ' + patient.city);
    if (nextAppt) _pdAppendPill(pillsHost, '🩺 1 upcoming appt');
  }
  host.appendChild(welcome);
}

function _pdAppendPill(host, text) {
  var f = cloneTemplate('tpl-pd-pill');
  if (!f || !f.firstElementChild) return;
  fillTemplate(f.firstElementChild, { text: text });
  host.appendChild(f.firstElementChild);
}

function _pdMountTabBar(root) {
  var host = root.querySelector('[data-fill="tabs"]');
  if (!host) return;
  var tabs = ['Overview', 'Scores', 'Care Plan', 'Appointments', 'Wearable', 'HCP Notes'];
  var frag = cloneTemplate('tpl-pd-tabs-row');
  if (!frag || !frag.firstElementChild) return;
  var row = frag.firstElementChild;
  var tabsHost = listHost(row, 'tabs');
  if (!tabsHost) return;
  for (var i = 0; i < tabs.length; i++) {
    var tFrag = cloneTemplate('tpl-pd-tab');
    if (!tFrag || !tFrag.firstElementChild) continue;
    var tab = tFrag.firstElementChild;
    tab.setAttribute('data-tab-index', String(i));
    if (i === 0) tab.classList.add('active');
    fillTemplate(tab, { label: tabs[i] });
    tabsHost.appendChild(tab);
  }
  host.appendChild(row);
}

function _pdMountPanelShell(host, index, fillFn) {
  var frag = cloneTemplate('tpl-pd-panel');
  if (!frag || !frag.firstElementChild) return;
  var panel = frag.firstElementChild;
  if (index === 0) panel.style.display = 'block';
  var bodyHost = panel.querySelector('[data-fill="body"]');
  if (bodyHost && fillFn) fillFn(bodyHost);
  host.appendChild(panel);
}

function _pdRefreshPanelBody(index, fillFn) {
  var panel = document.querySelectorAll('.pd-panel')[index];
  if (!panel) return;
  var body = panel.querySelector('[data-fill="body"]');
  if (!body) return;
  body.innerHTML = '';
  fillFn(body);
}

// MOVED: tpl-pd-card-hdr
function _pdCardHdr(title, meta, badge) {
  var frag = cloneTemplate('tpl-pd-card-hdr');
  if (!frag || !frag.firstElementChild) return document.createElement('div');
  var el = frag.firstElementChild;
  fillTemplate(el, { title: title || '', meta: meta || '', badge: badge || '' });
  var metaEl = el.querySelector('[data-fill="meta"]');
  if (metaEl && !meta) metaEl.remove();
  var badgeEl = el.querySelector('[data-fill="badge"]');
  if (badgeEl && !badge) badgeEl.remove();
  return el;
}

function _pdFillPanel0(body, patient, sc, comp, band, appts, assessDate) {
    var card = document.createElement('div');
    card.className = 'pd-card';
    card.appendChild(_pdCardHdr('Domain scores', 'Assessed ' + assessDate, ''));
    var cardBody = document.createElement('div');
    cardBody.className = 'pd-card-body';
    var grid = document.createElement('div');
    grid.className = 'pd-domain-grid';
    var domains = [
      { key: 'MENQOL_vasomotor', label: 'Vasomotor', max: 20 },
      { key: 'MENQOL_physical', label: 'Physical', max: 20 },
      { key: 'MENQOL_psychosocial', label: 'Psychosocial', max: 20 },
      { key: 'MENQOL_sexual', label: 'Sexual / Intimate', max: 20 }
    ];
    domains.forEach(function(dm) {
      var val = sc[dm.key] || 0;
      var pct = Math.round((val / dm.max) * 100);
      var col = _pdScoreColour(val, 7, 14);
      var bLabel = val >= 14 ? 'High' : val >= 7 ? 'Moderate' : 'Low';
      var dFrag = cloneTemplate('tpl-pd-domain-card');
      if (!dFrag || !dFrag.firstElementChild) return;
      var el = dFrag.firstElementChild;
      fillTemplate(el, { label: dm.label, val: String(val), max: '/' + dm.max, band: bLabel });
      var valEl = el.querySelector('.pd-dm-val');
      if (valEl) valEl.style.color = col;
      var bandEl = el.querySelector('.pd-dm-band');
      if (bandEl) bandEl.style.color = col;
      var fill = el.querySelector('.pd-mini-fill');
      if (fill) { fill.style.width = pct + '%'; fill.style.background = col; }
      grid.appendChild(el);
    });
    cardBody.appendChild(grid);
    card.appendChild(cardBody);
    body.appendChild(card);

    var topTriage = (patient.triage || []).slice(0, 3);
    if (topTriage.length) {
      var tCard = document.createElement('div');
      tCard.className = 'pd-card pd-card--spaced';
      tCard.appendChild(_pdCardHdr('Top care actions', '', (patient.triage || []).length + ' triggered'));
      var tBody = document.createElement('div');
      tBody.className = 'pd-card-body';
      topTriage.forEach(function(t) { tBody.appendChild(_pdTriageItemEl(t)); });
      tCard.appendChild(tBody);
      body.appendChild(tCard);
    }

    var nextAppt = appts.filter(function(a) { return a.status === 'confirmed' || a.status === 'pending'; })[0];
    if (nextAppt) {
      var aCard = document.createElement('div');
      aCard.className = 'pd-card pd-card--spaced';
      aCard.appendChild(_pdCardHdr('Next appointment', '', ''));
      var aBody = document.createElement('div');
      aBody.className = 'pd-card-body pd-card-body--tight';
      aBody.appendChild(_pdApptItemEl(nextAppt));
      aCard.appendChild(aBody);
      body.appendChild(aCard);
    }
}

function _pdMountPanel0(host, patient, sc, comp, band, appts, assessDate) {
  _pdMountPanelShell(host, 0, function(body) {
    _pdFillPanel0(body, patient, sc, comp, band, appts, assessDate);
  });
}

function _pdMountPanel1(host, sc) {
  _pdMountPanelShell(host, 1, function(body) {
    var card = document.createElement('div');
    card.className = 'pd-card';
    card.appendChild(_pdCardHdr('All clinical scores', '', ''));
    var cardBody = document.createElement('div');
    cardBody.className = 'pd-card-body';
    var table = document.createElement('table');
    table.className = 'pd-scores-table';
    // MOVED: tpl-pd-scores-thead
    var theadFrag = cloneTemplate('tpl-pd-scores-thead');
    if (theadFrag && theadFrag.firstElementChild) table.appendChild(theadFrag.firstElementChild);
    var tbody = document.createElement('tbody');
    var rows = [
      { l: 'MenQOL Vasomotor', v: sc.MENQOL_vasomotor || 0, m: 20, b: sc.MENQOL_vasomotor >= 14 ? 'High' : sc.MENQOL_vasomotor >= 7 ? 'Moderate' : 'Low' },
      { l: 'MenQOL Physical', v: sc.MENQOL_physical || 0, m: 20, b: sc.MENQOL_physical >= 14 ? 'High' : sc.MENQOL_physical >= 7 ? 'Moderate' : 'Low' },
      { l: 'MenQOL Psychosocial', v: sc.MENQOL_psychosocial || 0, m: 20, b: sc.MENQOL_psychosocial >= 14 ? 'High' : sc.MENQOL_psychosocial >= 7 ? 'Moderate' : 'Low' },
      { l: 'MenQOL Sexual', v: sc.MENQOL_sexual || 0, m: 20, b: sc.MENQOL_sexual >= 14 ? 'High' : sc.MENQOL_sexual >= 7 ? 'Moderate' : 'Low' },
      { l: 'ISI Sleep', v: sc.ISI || 0, m: 28, b: sc.ISI_band || '' }
    ];
    if (sc.PHQ9 != null) rows.push({ l: 'PHQ-9 Depression', v: sc.PHQ9 || 0, m: 27, b: sc.PHQ9_band || '' });
    if (sc.GAD7 != null) rows.push({ l: 'GAD-7 Anxiety', v: sc.GAD7 || 0, m: 21, b: sc.GAD7_band || '' });
    if (sc.PSS8 != null) rows.push({ l: 'PSS-8 Stress', v: sc.PSS8 || 0, m: 32, b: sc.PSS8_band || '' });
    if (sc.FSFI != null) rows.push({ l: 'FSFI Sexual Function', v: sc.FSFI || 0, m: 36, b: sc.FSFI_band || '' });
    if (sc.FSDSR != null) rows.push({ l: 'FSDSR Sexual Distress', v: sc.FSDSR || 0, m: 52, b: sc.FSDSR_band || '' });
    rows.forEach(function(r) {
      var pct = Math.round(Math.min(r.v / r.m, 1) * 100);
      var col = _pdScoreColour(r.v, r.m * 0.4, r.m * 0.7);
      var rFrag = cloneTemplate('tpl-pd-score-row');
      if (!rFrag || !rFrag.firstElementChild) return;
      var tr = rFrag.firstElementChild;
      fillTemplate(tr, { label: r.l, band: r.b });
      var scoreCell = tr.querySelector('[data-fill="score"]');
      if (scoreCell) {
        // MOVED: tpl-pd-scores-score
        var sFrag = cloneTemplate('tpl-pd-scores-score');
        if (sFrag && sFrag.firstElementChild) {
          var sEl = sFrag.firstElementChild;
          fillTemplate(sEl, { val: String(r.v), max: '/' + r.m });
          var valSpan = sEl.querySelector('.pd-scores-val');
          if (valSpan) valSpan.style.color = col;
          scoreCell.appendChild(sEl);
        }
      }
      var barCell = tr.querySelector('[data-fill="bar"]');
      if (barCell) {
        // MOVED: tpl-pd-scores-bar
        var bFrag = cloneTemplate('tpl-pd-scores-bar');
        if (bFrag && bFrag.firstElementChild) {
          var bEl = bFrag.firstElementChild;
          var fill = bEl.querySelector('.pd-mini-fill');
          if (fill) { fill.style.width = pct + '%'; fill.style.background = col; }
          barCell.appendChild(bEl);
        }
      }
      var bandCell = tr.querySelector('[data-fill="band"]');
      if (bandCell) bandCell.style.color = col;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    cardBody.appendChild(table);
    card.appendChild(cardBody);
    body.appendChild(card);
  });
}

function _pdMountPanel2(host, patient) {
  _pdMountPanelShell(host, 2, function(body) {
    var triage = patient.triage || [];
    var cardsWrap = document.createElement('div');
    cardsWrap.className = 'pd-care-cards';
    if (triage.length) {
      var sevMap = {
        severe: { bg: '#FEE2E2', border: '#F87171', dot: '#EF4444', label: 'Urgent', tcol: '#B91C1C' },
        moderate: { bg: '#FEF3C7', border: '#FCD34D', dot: '#F59E0B', label: 'Recommended', tcol: '#92400E' },
        mild: { bg: '#D1FAE5', border: '#6EE7B7', dot: '#16A34A', label: 'Advisory', tcol: '#065F46' }
      };
      triage.forEach(function(t) {
        var c = sevMap[t.sev] || sevMap.mild;
        var desc = PD_TRIAGE_DESCRIPTIONS[t.action] || '';
        var cFrag = cloneTemplate('tpl-pd-care-card');
        if (!cFrag || !cFrag.firstElementChild) return;
        var card = cFrag.firstElementChild;
        card.style.background = c.bg;
        card.style.border = '1px solid ' + c.border;
        var dot = card.querySelector('.pd-care-card__dot');
        if (dot) dot.style.background = c.dot;
        fillTemplate(card, { title: t.action.replace(/_/g, ' '), badge: c.label });
        var badge = card.querySelector('.pd-care-card__badge');
        if (badge) { badge.style.background = c.border; badge.style.color = c.tcol; }
        var descEl = card.querySelector('.pd-care-card__desc');
        if (descEl) { descEl.textContent = desc; if (!desc) descEl.style.display = 'none'; }
        cardsWrap.appendChild(card);
      });
    } else {
      var empty = document.createElement('div');
      empty.className = 'pd-empty';
      empty.textContent = 'No care actions — wellness baseline.';
      cardsWrap.appendChild(empty);
    }
    body.appendChild(cardsWrap);
    var contact = document.createElement('div');
    contact.className = 'pd-care-contact-grid';
    // MOVED: tpl-pd-care-contacts
    var cFrag = cloneTemplate('tpl-pd-care-contacts');
    if (cFrag) {
      while (cFrag.firstChild) contact.appendChild(cFrag.firstChild);
    }
    body.appendChild(contact);
  });
}

function _pdFillPanel3(body, appts) {
    var card = document.createElement('div');
    card.className = 'pd-card';
    card.appendChild(_pdCardHdr('Appointment history', '', ''));
    var cardBody = document.createElement('div');
    cardBody.className = 'pd-card-body pd-card-body--tight';
    if (appts && appts.length) {
      appts.forEach(function(a) { cardBody.appendChild(_pdApptItemEl(a)); });
    } else {
      var emptyFrag = cloneTemplate('tpl-pd-empty');
      if (emptyFrag && emptyFrag.firstElementChild) {
        fillTemplate(emptyFrag.firstElementChild, { text: 'No appointments yet. Book a consultation to get started.' });
        cardBody.appendChild(emptyFrag.firstElementChild);
      }
    }
    card.appendChild(cardBody);
    body.appendChild(card);
    mountTemplate('tpl-pd-book-btn', body);
}

function _pdMountPanel3(host, appts) {
  _pdMountPanelShell(host, 3, function(body) {
    _pdFillPanel3(body, appts);
  });
}

function _pdMountPanel4(host, patient) {
  _pdMountPanelShell(host, 4, function(body) {
    var wd = patient.wearable_data || {};
    var device = patient.wearable || '';
    var hasData = device && device !== 'None / No wearable' && Object.keys(wd).length > 0;
    var card = document.createElement('div');
    card.className = 'pd-card';
    if (!hasData) {
      card.appendChild(_pdCardHdr('Wearable data', '', ''));
      var emptyFrag = cloneTemplate('tpl-pd-wear-empty');
      if (emptyFrag && emptyFrag.firstElementChild) card.appendChild(emptyFrag.firstElementChild);
      body.appendChild(card);
      return;
    }
    card.appendChild(_pdCardHdr('Wearable — ' + device, 'Last 30 days', ''));
    var cardBody = document.createElement('div');
    cardBody.className = 'pd-card-body pd-card-body--tight';
    Object.keys(PD_WEAR_NORMS).forEach(function(key) {
      var norm = PD_WEAR_NORMS[key];
      var val = wd[key];
      if (val == null) return;
      var flag = _pdWearFlag(key, val);
      var badgeText = flag === 'alert' ? '⚠ Alert' : flag === 'warn' ? '⚠ Monitor' : '✓ OK';
      var badgeBg = flag === 'alert' ? '#FEE2E2' : flag === 'warn' ? '#FEF3C7' : '#D1FAE5';
      var badgeCol = flag === 'alert' ? '#B91C1C' : flag === 'warn' ? '#92400E' : '#065F46';
      var wFrag = cloneTemplate('tpl-pd-wear-row');
      if (!wFrag || !wFrag.firstElementChild) return;
      var row = wFrag.firstElementChild;
      fillTemplate(row, { label: norm.label, val: val + ' ' + norm.unit, badge: badgeText });
      var badge = row.querySelector('.pd-wear-row__badge');
      if (badge) { badge.style.background = badgeBg; badge.style.color = badgeCol; }
      cardBody.appendChild(row);
    });
    var corrs = wd.correlations || [];
    if (corrs.length) {
      var corr = document.createElement('div');
      corr.className = 'pd-wear-corr';
      // MOVED: tpl-pd-wear-corr-title
      var corrTitle = cloneTemplate('tpl-pd-wear-corr-title');
      if (corrTitle && corrTitle.firstElementChild) corr.appendChild(corrTitle.firstElementChild);
      corrs.forEach(function(c) {
        var item = document.createElement('div');
        item.className = 'pd-wear-corr__item';
        item.textContent = '• ' + c;
        corr.appendChild(item);
      });
      cardBody.appendChild(corr);
    }
    card.appendChild(cardBody);
    body.appendChild(card);
  });
}

function _pdMountPanel5(host, note, by) {
  _pdMountPanelShell(host, 5, function(body) {
    _pdMountPanel5Content(body, note, by);
  });
}

function _pdMountPanel5Content(body, note, by) {
    var card = document.createElement('div');
    card.className = 'pd-card';
    card.appendChild(_pdCardHdr('Clinical notes from your HCP', '', ''));
    var cardBody = document.createElement('div');
    cardBody.className = 'pd-card-body';
    if (note) {
      var nFrag = cloneTemplate('tpl-pd-hcp-note');
      if (nFrag && nFrag.firstElementChild) {
        fillTemplate(nFrag.firstElementChild, { by: by, note: note });
        cardBody.appendChild(nFrag.firstElementChild);
      }
    } else {
      var emptyFrag = cloneTemplate('tpl-pd-empty');
      if (emptyFrag && emptyFrag.firstElementChild) {
        fillTemplate(emptyFrag.firstElementChild, { text: 'No clinical notes available yet. Notes from your HCP will appear here after your consultation.' });
        cardBody.appendChild(emptyFrag.firstElementChild);
      }
    }
    card.appendChild(cardBody);
    body.appendChild(card);
}

function _pdTriageItemEl(t) {
  var sevMap = {
    severe: { dot: '#EF4444', label: 'Urgent', labBg: '#FEE2E2', labCol: '#B91C1C' },
    moderate: { dot: '#F59E0B', label: 'Recommended', labBg: '#FEF3C7', labCol: '#92400E' },
    mild: { dot: '#16A34A', label: 'Advisory', labBg: '#D1FAE5', labCol: '#065F46' }
  };
  var c = sevMap[t.sev] || sevMap.mild;
  var frag = cloneTemplate('tpl-pd-triage-item');
  if (!frag || !frag.firstElementChild) return document.createElement('div');
  var el = frag.firstElementChild;
  var dot = el.querySelector('.pd-triage-dot');
  if (dot) dot.style.background = c.dot;
  fillTemplate(el, { action: t.action.replace(/_/g, ' '), desc: PD_TRIAGE_DESCRIPTIONS[t.action] || '', badge: c.label });
  var badge = el.querySelector('.pd-triage-badge');
  if (badge) { badge.style.background = c.labBg; badge.style.color = c.labCol; }
  return el;
}

function _pdApptItemEl(a) {
  var dt  = a.appt_date
    ? new Date(a.appt_date + 'T00:00:00')
    : (a.date ? new Date(a.date) : null);
  var day = dt ? dt.getDate().toString().padStart(2, '0') : '—';
  var mon = dt ? dt.toLocaleString('en-IN', { month: 'short' }).toUpperCase() : '—';

  var badgeMap = {
    booked:      { bg: '#D1FAE5', col: '#065F46' },
    confirmed:   { bg: '#D1FAE5', col: '#065F46' },
    rescheduled: { bg: '#FEF9C3', col: '#854D0E' },
    pending:     { bg: '#FEF3C7', col: '#92400E' },
    completed:   { bg: '#E0E7FF', col: '#3730A3' },
    cancelled:   { bg: '#FEE2E2', col: '#B91C1C' },
  };
  var statusKey = (a.status || '').toLowerCase();
  var badge = badgeMap[statusKey] || { bg: '#F1F5F9', col: '#64748B' };
  var timeLabel = a.appt_time || '—';

  var safeId = a.id || ('appt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
  if (!window._apptMgmtCache) window._apptMgmtCache = {};
  window._apptMgmtCache[safeId] = {
    id: a.id,
    status: a.status,
    created_at: a.created_at || a.booked_at || new Date().toISOString(),
    slot_id: a.slot_id || null,
    consultant_id: a.clinician_id || null,
    consultant_name: a.clinician_name || a.consultant_name || 'Consultant',
    patient_email: a.patient_email || null,
    patient_name: a.patient_name || null,
    appointment_date: a.appt_date || null,
    slot_time: a.appt_time || null,
    mode: _pdModeDisplay(a.mode),
    fee: a.fee || 0,
    meet_link: a.meet_link || null,
    doctor_email: a.clinician_email || null,
  };

  var frag = cloneTemplate('tpl-pd-appt-item');
  if (!frag || !frag.firstElementChild) return document.createElement('div');
  var el = frag.firstElementChild;
  fillTemplate(el, {
    day: day,
    mon: mon,
    name: (a.clinician_name || a.consultant_name || 'Consultant')
      + (a.consultantSpec || a.clinician_spec ? ' · ' + (a.consultantSpec || a.clinician_spec) : ''),
    meta: timeLabel + ' · ' + _pdModeDisplay(a.mode) + ' · ₹' + (a.fee || 0),
    status: a.status || '—'
  });
  var metaEl = el.querySelector('[data-fill="meta"]');
  if (metaEl && _pdIsVideoMode(a.mode) && _pdIsUpcomingAppt(a) && a.meet_link) {
    metaEl.appendChild(document.createTextNode(' · '));
    var meetA = document.createElement('a');
    meetA.href = a.meet_link;
    meetA.target = '_blank';
    meetA.rel = 'noopener noreferrer';
    meetA.textContent = 'Join Google Meet';
    metaEl.appendChild(meetA);
  }
  var statusEl = el.querySelector('.pd-appt-item__status');
  if (statusEl) { statusEl.style.background = badge.bg; statusEl.style.color = badge.col; }
  var actionsHost = el.querySelector('[data-fill="actions"]');
  if (actionsHost && typeof renderApptActionButtons === 'function') {
    var btns = renderApptActionButtons(window._apptMgmtCache[safeId]);
    if (btns) actionsHost.appendChild(btns);
  }
  return el;
}

function _pdRefreshHCPNotesPanel(patient) {
  if (!patient) return;
  _pdGetAppointments(patient).then(function(appts) {
    var note = _pdResolveHCPNote(appts, patient);
    _pdRefreshPanelBody(5, function(body) {
      _pdMountPanel5Content(
        body,
        note ? note.note : '',
        note ? (note.consultant + (note.savedAt ? ' · ' + note.savedAt : '')) : ''
      );
    });
  });
}

function _pdBindNoteSync() {
  if (window._pdNoteSyncBound) return;
  window._pdNoteSyncBound = true;
  function refreshNotesIfVisible() {
    if (!window._pdCurrentPatient) return;
    var screen = document.getElementById('patient-dashboard-screen');
    if (!screen || !screen.classList.contains('active')) return;
    var activeTab = document.querySelector('.pd-tab.active');
    if (!activeTab || parseInt(activeTab.getAttribute('data-tab-index'), 10) !== 5) return;
    _pdRefreshHCPNotesPanel(window._pdCurrentPatient);
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var bc = new BroadcastChannel('evh_hcp_note');
      bc.onmessage = refreshNotesIfVisible;
    }
  } catch (e) {}
  window.addEventListener('storage', function(ev) {
    if (!ev.key) return;
    if (ev.key.indexOf('evh_pat_note_') === 0 || ev.key.indexOf('hcp_note_') === 0) {
      refreshNotesIfVisible();
    }
  });
}

function _pdActivateTab(index) {
  var tabs   = document.querySelectorAll('.pd-tab');
  var panels = document.querySelectorAll('.pd-panel');
  for (var i = 0; i < tabs.length; i++)   tabs[i].classList.toggle('active', i === index);
  for (var i = 0; i < panels.length; i++) panels[i].style.display = i === index ? 'block' : 'none';
  if (index === 5 && window._pdCurrentPatient) {
    _pdRefreshHCPNotesPanel(window._pdCurrentPatient);
  }
}

var PD_TRIAGE_DESCRIPTIONS = {
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

var PD_WEAR_NORMS = {
  avg_rhr:                { label: 'Resting HR',   unit: 'bpm',    warnHi: 80,   alertHi: 90   },
  avg_hrv:                { label: 'HRV',           unit: 'ms',     warnLo: 30,   alertLo: 20   },
  avg_spo2:               { label: 'SpO₂',          unit: '%',      warnLo: 95,   alertLo: 90   },
  avg_sleep:              { label: 'Avg sleep',     unit: 'hrs',    warnLo: 6.5,  alertLo: 5    },
  night_sweats_per_night: { label: 'Night sweats',  unit: '/night', warnHi: 2,    alertHi: 4    },
  avg_steps:              { label: 'Steps',         unit: '/day',   warnLo: 5000, alertLo: 3000 },
  avg_stress:             { label: 'Stress score',  unit: '/100',   warnHi: 50,   alertHi: 70   },
};

function _pdWearFlag(key, val) {
  var n = PD_WEAR_NORMS[key]; if (!n) return false;
  if (n.alertHi && val >= n.alertHi) return 'alert';
  if (n.warnHi  && val >= n.warnHi)  return 'warn';
  if (n.alertLo && val <= n.alertLo) return 'alert';
  if (n.warnLo  && val <= n.warnLo)  return 'warn';
  return false;
}

/* ACTIONS */

function pdRetakeAssessment() {
  if (window.S) {
    S.answers   = {};
    S.scores    = {};
    S.triage    = [];
    S.stepIndex = 0;
  }
  if (typeof showConsent === 'function') { showConsent(); return; }
  if (typeof showScreen  === 'function') showScreen('consent-screen');
}

function pdSignOut() {
  if (window.S) { S.authId = null; S.session = null; S.loginName = null; }
  if (typeof intShowLauncher === 'function') { intShowLauncher(); return; }
  if (typeof showScreen === 'function') showScreen('auth-screen');
}

function pdBookAppointment() {
  if (typeof intShowBooking === 'function') { intShowBooking(); return; }
  if (typeof showScreen === 'function') showScreen('int-bk-screen');
}

/* STYLES */

function _pdStyles() {
  // MOVED verbatim to css/patient-dashboard.css
  return '';
}

window.showPatientDashboard         = showPatientDashboard;
window.pdRetakeAssessment           = pdRetakeAssessment;
window.pdSignOut                    = pdSignOut;
window.pdBookAppointment            = pdBookAppointment;
window._pdActivateTab               = _pdActivateTab;
window._pdLocalVisitHistory         = _pdLocalVisitHistory;
window._pdFetchSupabaseVisitHistory = _pdFetchSupabaseVisitHistory;
window._pdVisitGraphHTML            = _pdVisitGraphHTML;

// APPOINTMENT MANAGEMENT

// ── Inject modal markup once on load 
(function injectApptMgmtModal() {
  if (document.getElementById('apmt-mgmt-modal')) {
    _pdBindApptModalActions();
    return;
  }
  var frag = cloneTemplate('tpl-amm-modal');
  if (frag) document.body.appendChild(frag);
  _pdBindApptModalActions();
})();

// ── State
let _amAppt    = null;
let _amAction  = null;
let _amNewSlot = null;
let _amNewMode = null;

/**
 * Parses appointment date + time string into a JS timestamp (ms).
 * Handles formats: "3:00 PM", "15:00", "15:00:00"
 * @param {string} apptDate  "YYYY-MM-DD"
 * @param {string} apptTime  "3:00 PM" | "15:00" | "15:00:00"
 * @returns {number|null} ms timestamp or null on failure
 */
function _parseApptDateTime(apptDate, apptTime) {
  if (!apptDate || !apptTime) return null;
  try {
    var timeStr = String(apptTime).trim();
    var h, m;

    if (/AM|PM/i.test(timeStr)) {
      // Format: "3:00 PM" or "11:30 AM"
      var parts = timeStr.replace(/\s+/g, ' ').split(' ');
      var hhmm  = parts[0].split(':');
      h = parseInt(hhmm[0], 10);
      m = parseInt(hhmm[1] || '0', 10);
      var ampm = parts[1].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
    } else {
      // Format: "15:00" or "15:00:00"
      var hhmm2 = timeStr.split(':');
      h = parseInt(hhmm2[0], 10);
      m = parseInt(hhmm2[1] || '0', 10);
    }

    // Build local Date at that h:m on apptDate
    var d = new Date(apptDate + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d.getTime();
  } catch(e) {
    
    return null;
  }
}

/**
 * Returns true if current time is MORE THAN 2 hours before the appointment.
 * (i.e. patient is still within the allowed change window)
 * @param {string} apptDate  "YYYY-MM-DD"
 * @param {string} apptTime  "3:00 PM" | "15:00" | "15:00:00"
 * @returns {boolean}
 */
function isWithinCancelWindow(apptDate, apptTime) {
  var apptMs = _parseApptDateTime(apptDate, apptTime);
  if (!apptMs) return false;
  var msUntilAppt = apptMs - Date.now();
  return msUntilAppt > (2 * 60 * 60 * 1000);   // more than 2 hrs away
}

/**
 * Returns human-readable time remaining in the cancel window.
 * e.g. "1h 45m left to change"
 * @param {string} apptDate
 * @param {string} apptTime
 * @returns {string}
 */
function cancelWindowRemaining(apptDate, apptTime) {
  var apptMs      = _parseApptDateTime(apptDate, apptTime);
  if (!apptMs) return '';
  var msUntilAppt = apptMs - Date.now();
  var twoHrsMs    = 2 * 60 * 60 * 1000;
  var msRemaining = msUntilAppt - twoHrsMs;    // time left before window closes

  if (msRemaining <= 0) return 'Window closed';

  var totalMins = Math.floor(msRemaining / 60000);
  var h = Math.floor(totalMins / 60);
  var m = totalMins % 60;

  if (h > 0) return h + 'h ' + m + 'm left to change';
  return m + 'm left to change';
}

// ── Open modal 
async function openApptMgmt(appt, action) {
  _amAppt    = appt;
  _amAction  = action;
  _amNewSlot = null;
  _amNewMode = null;

  const modal = document.getElementById('apmt-mgmt-modal');
  modal.style.display = 'flex';

  // Use appointment date+time (not created_at) for the 2-hour window check
  const apptDate = appt.appointment_date;
  const apptTime = appt.slot_time;
  const open     = isWithinCancelWindow(apptDate, apptTime);

  const strip = document.getElementById('amm-window-strip');
  strip.style.display = 'block';

  if (open) {
    strip.style.display = 'none';
  } else {
    strip.textContent        = '🔒 Change window closed — appointments can only be changed more than 2 hours before the appointment time.';
    strip.style.background   = '#FEF2F2';
    strip.style.borderColor  = '#FECACA';
    strip.style.color        = '#991B1B';
  }

  if (!open) {
    _renderLockedState();
    return;
  }

  if (action === 'cancel')     _renderCancelView();
  if (action === 'reschedule') await _renderRescheduleView();
  if (action === 'mode')       _renderModeView();
}

function closeApptModal() {
  var modal = document.getElementById('apmt-mgmt-modal');
  if (modal) modal.style.display = 'none';
  _amAppt = _amAction = _amNewSlot = _amNewMode = null;
}

function _pdBindApptModalActions() {
  var modal = document.getElementById('apmt-mgmt-modal');
  if (!modal || modal.dataset.pdBound) return;
  modal.dataset.pdBound = '1';
  modal.querySelectorAll('[data-action="closeApptModal"]').forEach(function(el) {
    el.addEventListener('click', closeApptModal);
  });
}

// ── Locked state 
function _ammSetFooter(buttons) {
  var foot = document.getElementById('amm-footer');
  if (!foot) return;
  foot.innerHTML = '';
  var frag = cloneTemplate('tpl-amm-footer-btns');
  if (!frag || !frag.firstElementChild) return;
  var host = frag.firstElementChild;
  buttons.forEach(function(spec) {
    var bFrag = cloneTemplate('tpl-amm-btn');
    if (!bFrag || !bFrag.firstElementChild) return;
    var btn = bFrag.firstElementChild;
    fillTemplate(btn, { label: spec.label });
    if (spec.cls) btn.className = 'amm-btn ' + spec.cls;
    if (spec.id) btn.id = spec.id;
    if (spec.disabled) btn.disabled = true;
    if (spec.onclick) btn.addEventListener('click', spec.onclick);
    host.appendChild(btn);
  });
  foot.appendChild(host);
}

function _renderLockedState() {
  document.getElementById('amm-title').textContent    = 'Cannot Modify Appointment';
  document.getElementById('amm-subtitle').textContent = 'The 2-hour change window has passed.';
  // MOVED: tpl-amm-locked-body
  var body = document.getElementById('amm-body');
  body.innerHTML = '';
  mountTemplate('tpl-amm-locked-body', body);
  _ammSetFooter([{ label: 'Close', cls: 'amm-btn--primary', onclick: closeApptModal }]);
}

function _renderCancelView() {
  const a = _amAppt;
  document.getElementById('amm-title').textContent    = 'Cancel Appointment';
  document.getElementById('amm-subtitle').textContent =
    `${a.consultant_name || 'Consultant'} · ${_fmtDate(a.appointment_date)} · ${_fmtTime(a.slot_time)}`;
  var body = document.getElementById('amm-body');
  body.innerHTML = '';
  // MOVED: tpl-amm-cancel-body
  mountTemplate('tpl-amm-cancel-body', body);
  _ammSetFooter([
    { label: 'Keep Appointment', cls: 'amm-btn--outline', onclick: closeApptModal },
    { label: 'Yes, Cancel →', cls: 'amm-btn--danger', onclick: execCancelAppointment }
  ]);
}

// ── Reschedule view 
async function _renderRescheduleView() {
  const a = _amAppt;
  document.getElementById('amm-title').textContent    = 'Reschedule Appointment';
  document.getElementById('amm-subtitle').textContent =
    `Currently: ${_fmtDate(a.appointment_date)} · ${_fmtTime(a.slot_time)}`;

  document.getElementById('amm-body').innerHTML = '';
  // MOVED: tpl-amm-reschedule-body
  mountTemplate('tpl-amm-reschedule-body', document.getElementById('amm-body'));
  fillTemplate(document.getElementById('amm-body'), { intro: 'Select a new slot with ' + (a.consultant_name || 'the same consultant') + ':' });
  var introEl = document.querySelector('.amm-reschedule-intro');
  if (introEl) {
    introEl.textContent = '';
    introEl.appendChild(document.createTextNode('Select a new slot with '));
    var strong = document.createElement('strong');
    strong.textContent = a.consultant_name || 'the same consultant';
    introEl.appendChild(strong);
    introEl.appendChild(document.createTextNode(':'));
  }
  _ammSetFooter([
    { label: 'Cancel', cls: 'amm-btn--outline', onclick: closeApptModal },
    { label: 'Confirm New Slot →', cls: 'amm-btn--primary', id: 'amm-reschedule-confirm', disabled: true, onclick: execRescheduleAppointment }
  ]);

  const { data: slots, error } = await fetchAvailableSlotsForConsultant(a.consultant_id);
  document.getElementById('amm-slot-loader').style.display = 'none';

  var grid = document.getElementById('amm-slot-grid');
  if (error || !slots || slots.length === 0) {
    if (grid) {
      grid.classList.add('is-visible');
      grid.innerHTML = '';
      // MOVED: tpl-amm-slot-empty
      mountTemplate('tpl-amm-slot-empty', grid);
    }
    return;
  }

  const byDate = {};
  slots.forEach(s => {
    (byDate[s.slot_date] = byDate[s.slot_date] || []).push(s);
  });

  if (!grid) return;
  grid.innerHTML = '';
  grid.classList.add('is-visible');
  // MOVED: tpl-amm-slot-day + tpl-amm-slot-btn
  Object.keys(byDate).forEach(date => {
    var dayFrag = cloneTemplate('tpl-amm-slot-day');
    if (!dayFrag) return;
    var dayWrap = dayFrag.querySelector('.amm-slot-day-wrap');
    if (!dayWrap) return;
    var labelEl = dayWrap.querySelector('.amm-slot-day');
    var slotsHost = dayWrap.querySelector('[data-list="slots"]');
    if (labelEl) labelEl.textContent = _fmtDate(date);
    byDate[date].forEach(function(s) {
      var bFrag = cloneTemplate('tpl-amm-slot-btn');
      if (!bFrag || !bFrag.firstElementChild) return;
      var btn = bFrag.firstElementChild;
      fillTemplate(btn, { time: _fmtTime(s.slot_time || s.slot_time_raw) });
      btn.dataset.slotId = s.id;
      btn.addEventListener('click', function() {
        selectRescheduleSlot(btn, s.id, s.slot_date, s.slot_time, s.slot_time_raw);
      });
      if (slotsHost) slotsHost.appendChild(btn);
    });
    grid.appendChild(dayWrap);
  });
}

function selectRescheduleSlot(btn, slotId, slotDate, slotTime, slotTimeRaw) {
  document.querySelectorAll('#amm-slot-grid .amm-slot-btn').forEach(function(b) {
    b.classList.remove('slot-sel');
  });
  btn.classList.add('slot-sel');
  _amNewSlot = { id: slotId, date: slotDate, time: slotTime, timeRaw: slotTimeRaw };
  const cfm = document.getElementById('amm-reschedule-confirm');
  if (cfm) { cfm.disabled = false; cfm.classList.add('is-enabled'); }
}

function _renderModeView() {
  const a = _amAppt;
  const curMode = _pdNormMode(a.mode);
  const other = curMode === 'video' ? 'in-person' : 'video';
  document.getElementById('amm-title').textContent = 'Change Consultation Mode';
  document.getElementById('amm-subtitle').textContent = 'Currently: ' + _modeLabel(curMode);
  var body = document.getElementById('amm-body');
  body.innerHTML = '';
  mountTemplate('tpl-amm-mode-body', body);
  var tilesHost = listHost(body, 'tiles');
  [{ mode: curMode, icon: curMode === 'video' ? '📹' : '🏥', current: true },
   { mode: other, icon: other === 'video' ? '📹' : '🏥', current: false }].forEach(function(spec) {
    var tFrag = cloneTemplate('tpl-amm-mode-tile');
    if (!tFrag || !tFrag.firstElementChild || !tilesHost) return;
    var tile = tFrag.firstElementChild;
    tile.classList.add(spec.current ? 'amm-mode-tile--current' : 'amm-mode-tile--other');
    fillTemplate(tile, { icon: spec.icon, label: _modeLabel(spec.mode), hint: spec.current ? '✓ Current' : '→ Switch to this' });
    tilesHost.appendChild(tile);
  });
  _amNewMode = other;
  _ammSetFooter([
    { label: 'Keep Current Mode', cls: 'amm-btn--ghost', onclick: closeApptModal },
    { label: 'Switch to ' + _modeLabel(other) + ' →', cls: 'amm-btn--primary', onclick: execChangeModeAppointment }
  ]);
}

function _ammMountStatus(bodyEl, opts) {
  bodyEl.innerHTML = '';
  var frag = cloneTemplate('tpl-amm-status-body');
  if (!frag || !frag.firstElementChild) return;
  var root = frag.firstElementChild;
  if (opts.cls) root.classList.add(opts.cls);
  fillTemplate(root, { icon: opts.icon || '', title: opts.title || '', msg: opts.msg || '' });
  bodyEl.appendChild(root);
}

// ── Execute actions 

function _pdApptEmailFields(appt) {
  var patient = window._pdCurrentPatient || {};
  return {
    patient_email: (appt && appt.patient_email)
      || (window.S && S.session && S.session.authId ? S.session.authId.trim().toLowerCase() : ''),
    patient_name:  (appt && appt.patient_name) || patient.name || 'Patient',
    doctor_name:   (appt && appt.consultant_name) || 'Consultant',
    date:          appt ? appt.appointment_date : '',
    time:          appt ? appt.slot_time : '',
    mode:          appt ? appt.mode : '',
    booking_id:    appt && appt.id ? String(appt.id) : ''
  };
}

function _pdSendApptUpdateEmail(payload) {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  if (!base || !payload.patient_email) return Promise.resolve(false);
  return fetch(base + '/send-appointment-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.detail || 'send failed'); });
    return true;
  })
  .catch(function(err) {
    
    return false;
  });
}

var _PD_WINDOW_CLOSED_MSG = 'Cancel, reschedule, and mode changes are only allowed more than 2 hours before your appointment. Contact clinic@evaerahealth.in for urgent help.';

async function execCancelAppointment() {
  if (!_amAppt) return;
  _setModalLoading('Cancelling appointment…');

  const { error } = await cancelAppointment(_amAppt.id, _amAppt.slot_id);
  if (error) { _setModalError('Could not cancel. Please try again.'); return; }

  var emailed = await _pdSendApptUpdateEmail(Object.assign({ update_type: 'cancelled' }, _pdApptEmailFields(_amAppt)));

  _setModalSuccess(
    '✅ Appointment Cancelled',
    'Your appointment has been cancelled.' + (emailed ? ' A confirmation email has been sent to you.' : '') + ' A full refund will be processed within 5–7 business days.',
    '🌸'
  );
  await _refreshPatientDashboardAppointments();
}

async function execRescheduleAppointment() {
  if (!_amAppt || !_amNewSlot) return;
  _setModalLoading('Rescheduling appointment…');

  // Pass display time ("3:00 PM") — appointments.appt_time is TEXT storing display format
  const { error } = await rescheduleAppointment(
    _amAppt.id,
    _amAppt.slot_id,       // may be null — rescheduleAppointment handles lookup
    _amNewSlot.id,
    _amNewSlot.date,
    _amNewSlot.time        // display format "3:00 PM" matches appt_time column
  );

  if (error) {
    _setModalError('Could not reschedule. The slot may have just been taken. Please try another.');
    return;
  }

  var meetLink = null;
  var oldDate = _amAppt.appointment_date;
  var oldTime = _amAppt.slot_time;
  if (_pdIsVideoMode(_amAppt.mode)) {
    _amAppt.appointment_date = _amNewSlot.date;
    _amAppt.slot_time = _amNewSlot.time;
    meetLink = await _pdRegenerateMeetLink(_amAppt);
  }

  var emailed = await _pdSendApptUpdateEmail(Object.assign({
    update_type: 'rescheduled',
    old_date: oldDate,
    old_time: oldTime,
    new_date: _amNewSlot.date,
    new_time: _amNewSlot.time,
    date: _amNewSlot.date,
    time: _amNewSlot.time,
    meet_link: meetLink || undefined
  }, _pdApptEmailFields(_amAppt)));

  _setModalSuccess(
    '✅ Appointment Rescheduled',
    'Your appointment has been moved to ' + _fmtDate(_amNewSlot.date) + ' at ' + _fmtTime(_amNewSlot.time) + '.' + (emailed ? ' A confirmation email has been sent to you.' : ''),
    '📅'
  );
  await _refreshPatientDashboardAppointments();
}

async function execChangeModeAppointment() {
  if (!_amAppt || !_amNewMode) return;
  _setModalLoading('Updating consultation mode…');

  const displayMode = _pdModeDisplay(_amNewMode);
  const { error } = await changeModeAppointment(_amAppt.id, displayMode);
  if (error) { _setModalError('Could not update mode. Please try again.'); return; }

  _amAppt.mode = displayMode;
  if (window._apptMgmtCache && _amAppt.id) window._apptMgmtCache[_amAppt.id] = _amAppt;

  var meetLink = null;
  if (_pdIsVideoMode(displayMode)) {
    meetLink = await _pdRegenerateMeetLink(_amAppt);
    if (meetLink) _amAppt.meet_link = meetLink;
  }

  var emailed = await _pdSendApptUpdateEmail(Object.assign({
    update_type: 'mode_changed',
    new_mode: displayMode,
    meet_link: meetLink || undefined
  }, _pdApptEmailFields(_amAppt)));

  _setModalSuccess(
    '✅ Mode Updated',
    'Your consultation has been switched to ' + _modeLabel(_amNewMode) + '.' + (emailed ? ' A confirmation email has been sent to you.' : ''),
    _amNewMode === 'video' ? '📹' : '🏥'
  );
  await _refreshPatientDashboardAppointments();
}

// ── Modal state helpers 
function _setModalLoading(msg) {
  _ammMountStatus(document.getElementById('amm-body'), { cls: 'amm-status--loading', icon: '⏳', msg: msg });
  document.getElementById('amm-footer').innerHTML = '';
}

function _setModalError(msg) {
  _ammMountStatus(document.getElementById('amm-body'), { cls: 'amm-status--error', icon: '❌', title: 'Error', msg: msg });
  _ammSetFooter([{ label: 'Close', cls: 'amm-btn--primary', onclick: closeApptModal }]);
}

function _setModalSuccess(title, msg, icon) {
  document.getElementById('amm-window-strip').style.display = 'none';
  _ammMountStatus(document.getElementById('amm-body'), { icon: icon, title: title, msg: msg });
  _ammSetFooter([{ label: 'Done', cls: 'amm-btn--primary', onclick: closeApptModal }]);
}

async function _refreshPatientDashboardAppointments() {
  try {
    var activeIndex = 3;
    document.querySelectorAll('.pd-tab').forEach(function(t, i) {
      if (t.classList.contains('active')) activeIndex = i;
    });

    var patient = window._pdCurrentPatient;
    if (!patient) {  return; }

    var appts = await _pdGetAppointments(patient);

    _pdRefreshPanelBody(3, function(body) { _pdFillPanel3(body, appts); });

    var sc = patient.scores || {};
    var comp = sc.composite || 0;
    var band = _pdBand(comp);
    var assessDate = patient.timestamp
      ? new Date(patient.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Unknown date';

    _pdRefreshPanelBody(0, function(body) {
      _pdFillPanel0(body, patient, sc, comp, band, appts, assessDate);
    });

    _pdActivateTab(activeIndex);
  } catch (e) {
    
  }
}

// ── Action buttons on each appointment card 
/**
 * Returns action buttons element for appointment management.
 * @param {Object} appt
 * @returns {HTMLElement|null}
 */
function renderApptActionButtons(appt) {
  var ACTIVE = ['booked', 'confirmed', 'pending', 'rescheduled'];
  if (ACTIVE.indexOf((appt.status || '').toLowerCase()) === -1) return null;

  var apptDate = appt.appointment_date;
  var apptTime = appt.slot_time;
  var inWindow = isWithinCancelWindow(apptDate, apptTime);

  var safeId = appt.id || ('cache_' + Date.now());
  if (!window._apptMgmtCache) window._apptMgmtCache = {};
  window._apptMgmtCache[safeId] = appt;

  // MOVED: tpl-pd-appt-actions
  var frag = cloneTemplate('tpl-pd-appt-actions');
  if (!frag || !frag.firstElementChild) return null;
  var el = frag.firstElementChild;
  var hintOpen = el.querySelector('[data-fill="windowOpen"]');
  var hintClosed = el.querySelector('[data-fill="windowClosed"]');

  if (hintOpen) hintOpen.classList.add('is-hidden');
  if (inWindow) {
    if (hintClosed) hintClosed.classList.add('is-hidden');
  } else {
    if (hintClosed) {
      hintClosed.classList.remove('is-hidden');
      hintClosed.textContent = '🔒 Window closed';
    }
  }

  el.querySelectorAll('.pd-appt-btn').forEach(function(btn) {
    if (!inWindow) btn.classList.add('is-disabled');
    btn.addEventListener('click', function() {
      if (!inWindow) {
        if (typeof intToast === 'function') {
          intToast('warn', 'Change window closed', _PD_WINDOW_CLOSED_MSG, 'Appointments');
        }
        return;
      }
      _openApptFromCache(safeId, btn.getAttribute('data-mgmt-action'));
    });
  });
  return el;
}

// Bridge: reads from cache, called by inline onclick
function _openApptFromCache(safeId, action) {
  var appt = window._apptMgmtCache && window._apptMgmtCache[safeId];
  if (!appt) {  return; }
  if (typeof openApptMgmt === 'function') openApptMgmt(appt, action);
}
window._openApptFromCache = _openApptFromCache;

// ── Formatters 
function _fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[+m - 1]} ${y}`;
}

function _fmtTime(timeStr) {
  if (!timeStr) return '—';
  // Already display-ready ("3:00 PM") — return as-is
  if (/AM|PM/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':');
  const hh   = +h;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hr   = hh % 12 || 12;
  return `${hr}:${m} ${ampm}`;
}

function _modeLabel(mode) {
  return _pdNormMode(mode) === 'video' ? 'Video Call' : 'In-Person';
}

// ── Close on backdrop click or ✕ button
document.addEventListener('click', function(e) {
  if (e.target.closest('[data-action="closeApptModal"]')) {
    closeApptModal();
    return;
  }
  const modal = document.getElementById('apmt-mgmt-modal');
  if (modal && e.target === modal) closeApptModal();
});