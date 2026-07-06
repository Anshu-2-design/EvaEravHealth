var SUPABASE_URL = null;
var SUPABASE_KEY = null;

var _configLoaded  = false;
var _configLoading = false;
var _pendingQueue  = [];

/* CONFIG LOADER */
function _loadConfig() {
  if (_configLoaded || _configLoading) return;
  _configLoading = true;

  // Backend base URL — defined in js/config.js (loaded first)
  var backendBase = window.OTP_BACKEND_URL;

  

  fetch(backendBase + '/config', {
    method:  'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function(cfg) {
    if (!cfg.supabase_url || !cfg.supabase_key) {
      throw new Error('/config response missing supabase_url or supabase_key');
    }
    SUPABASE_URL   = cfg.supabase_url;
    SUPABASE_KEY   = cfg.supabase_key;
    _configLoaded  = true;
    _configLoading = false;
    

    if (_pendingQueue.length > 0) {
      
      _pendingQueue.forEach(function(item) {
        try { item.fn(); } catch(e) {
          
        }
      });
      _pendingQueue = [];
    }
  })
  .catch(function(err) {
    _configLoading = false;
    
    _sbShowBanner('error',
      '✗ Could not load app configuration.<br>' +
      '<span style="font-weight:400">Please check the backend is running and refresh.</span>'
    );
  });
}

/* READY GUARD */
function _whenReady(fn, label) {
  if (_configLoaded) {
    fn();
  } else {
    
    _pendingQueue.push({ fn: fn, label: label });
    _loadConfig();
  }
}

/* DIAGNOSTIC BANNER */
function _sbShowBanner(type, msg) {
  var existing = document.getElementById('sb-status-banner');
  if (existing) existing.remove();
  // MOVED: tpl-sb-status-banner + modals-overlays.css
  var frag = cloneTemplate('tpl-sb-status-banner');
  if (!frag || !frag.firstElementChild) return;
  var div = frag.firstElementChild;
  div.classList.add('sb-status-banner--' + (type || 'warn'));
  var fill = div.querySelector('[data-fill="msg"]');
  if (fill) fill.textContent = msg;
  else div.textContent = msg;
  document.body.appendChild(div);
  if (type === 'success') setTimeout(function() { div.remove(); }, 5000);
}

/* LOW-LEVEL REST INSERT */
function _sbInsert(table, record) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Promise.reject(new Error('Supabase credentials not loaded yet'));
  }

  return fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify(record)
  })
  .then(function(res) {
    if (!res.ok) {
      return res.text().then(function(body) {
        throw new Error('HTTP ' + res.status + ' — ' + body);
      });
    }
    return res;
  });
}

/* HELPERS */

/* Current date in IST as "YYYY-MM-DD" */
function _istDate() {
  var now    = new Date();
  var offset = 5.5 * 60 * 60 * 1000;
  var ist    = new Date(now.getTime() + offset);
  var yyyy   = ist.getUTCFullYear();
  var mm     = String(ist.getUTCMonth() + 1).padStart(2, '0');
  var dd     = String(ist.getUTCDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/* Current time in IST as "HH:MM:SS" */
function _istTime() {
  var now    = new Date();
  var offset = 5.5 * 60 * 60 * 1000;
  var ist    = new Date(now.getTime() + offset);
  var hh     = String(ist.getUTCHours()).padStart(2, '0');
  var min    = String(ist.getUTCMinutes()).padStart(2, '0');
  var ss     = String(ist.getUTCSeconds()).padStart(2, '0');
  return hh + ':' + min + ':' + ss;
}

/* BMI rounded to 1 dp, or null if inputs missing */
function _calcBmi(weight_kg, height_cm) {
  if (!weight_kg || !height_cm) return null;
  var h = height_cm / 100;
  return parseFloat((weight_kg / (h * h)).toFixed(1));
}

/* SAVE: SESSION */
function saveSessionToSupabase() {
  if (!S.session || !S.session.id) return;

  _whenReady(function() {
    var row = {
      session_id: S.session.id,
      email_id:   S.session.authId || null,
      is_guest:   S.session.id.indexOf('guest_') === 0,
      login_date: _istDate(),
      login_time: _istTime()
    };

    

    _sbInsert('sessions', row)
      .then(function()      {  })
      .catch(function(err)  {
        
        _sbShowBanner('error', 'Something went wrong while saving your session. Please refresh and try again.');
      });
  }, 'saveSessionToSupabase');
}

/* SAVE: CONSENT */
function saveConsentToSupabase() {
  if (!S.session || !S.session.id) return;

  _whenReady(function() {
    var cd = S.consentData || {};

    var row = {
      session_id:           S.session.id,
      login_date:           _istDate(),
      login_time:           _istTime(),
      c1_health_data:       cd['c1'] === true,
      c2_wearable_data:     cd['c2'] === true,
      c3_ayurvedic_profile: cd['c3'] === true,
      c4_ai_processing:     cd['c4'] === true,
      c5_share_hcp:         cd['c5'] === true,
      c6_research:          cd['c6'] === true,
      c7_corporate:         cd['c7'] === true
    };

    

    _sbInsert('consent_records', row)
      .then(function()     {  })
      .catch(function(err) {
        
        _sbShowBanner('error', 'Something went wrong while saving your consent. Please try again.');
      });
  }, 'saveConsentToSupabase');
}

/* SAVE: DEMOGRAPHICS */
function saveDemographicsToSupabase() {
  if (!S.session || !S.session.id) return;

  _whenReady(function() {
    var a = S.answers || {};

    function n(v)   { return (v !== undefined && v !== null && v !== '') ? v : null; }
    function num(v) {
      if (v == null || isNaN(v)) return null;
      return parseFloat(parseFloat(v).toFixed(1));
    }

    var row = {
      session_id:        S.session.id,
      email_id:          S.session.authId ? S.session.authId.trim().toLowerCase() : null,
      full_name:         n(a.name),
      age:               n(a.age),
      city:              n(a.city),
      height_cm:         num(a.height_cm),
      weight_kg:         num(a.weight_kg),
      bmi:               _calcBmi(a.weight_kg, a.height_cm),
      marital_status:    n(a.marital),
      occupation:        n(a.occupation),
      highest_education: n(a.education),
      login_date:        _istDate(),
      login_time:        _istTime()
    };

    

    _sbInsert('patient_demographics', row)
      .then(function()     {  })
      .catch(function(err) {
        
        _sbShowBanner('error', 'Something went wrong while saving your details. Please try again.');
      });
  }, 'saveDemographicsToSupabase');
}

/* BUILD ASSESSMENT ROW */
function buildSupabaseRow() {
  var a     = S.answers       || {};
  var comor = a.comorbidities || {};

  function n(v)   { return (v !== undefined && v !== null && v !== '') ? v : null; }
  function num(v) {
    if (v == null || isNaN(v)) return null;
    return parseFloat(parseFloat(v).toFixed(1));
  }

  return {
    session_id:        n(S.session ? S.session.id : null),
    login_date:        _istDate(),
    login_time:        _istTime(),
    email_id:          S.session.authId ? S.session.authId.trim().toLowerCase() : null,

    full_name:         n(a.name),
    age:               n(a.age),
    city:              n(a.city),
    country:           n(a.country),
    height_cm:         num(a.height_cm),
    weight_kg:         num(a.weight_kg),
    bmi:               _calcBmi(a.weight_kg, a.height_cm),
    menstrual_status:  n(a.stage),
    menstrual_pattern: n(a.menstrual_pattern),
    marital_status:    n(a.marital),
    occupation:        n(a.occupation),
    highest_education: n(a.education),
    ethnicity:         n(a.ethnicity),
    hrt_history:       n(a.hrt_history),
    parity:            n(a.parity),
    smoking_history:   n(a.smoking_history),
    alcohol_use:       n(a.alcohol_use),
    prakriti:          n(a.prakriti),
    vikriti:           n(a.vikriti),
    wearable_device:   n(a.wearable),

    rf1_unusual_vaginal_bleeding: n(a.rf1 !== undefined ? (a.rf1 ? 'Yes' : 'No') : null),
    rf2_persistent_pelvic_pain:   n(a.rf2 !== undefined ? (a.rf2 ? 'Yes' : 'No') : null),
    rf3_breast_changes:           n(a.rf3 !== undefined ? (a.rf3 ? 'Yes' : 'No') : null),

    mq_v1_hot_flushes:      n(a.mq_v1),
    mq_v2_night_sweats:     n(a.mq_v2),
    mq_v3_daytime_sweating: n(a.mq_v3),
    mq_v4_feeling_cold:     n(a.mq_v4),
    mq_v5_palpitations:     n(a.mq_v5),
    mq_v6_facial_flushing:  n(a.mq_v6),

    mq_p1_fatigue:            n(a.mq_p1),
    mq_p2_sleep_difficulty:   n(a.mq_p2),
    mq_p3_joint_muscle_pain:  n(a.mq_p3),
    mq_p4_skin_changes:       n(a.mq_p4),
    mq_p5_weight_gain:        n(a.mq_p5),
    mq_p6_headaches:          n(a.mq_p6),
    mq_p7_hair_loss:          n(a.mq_p7),
    mq_p8_appearance_concern: n(a.mq_p8),

    mq_ps1_anxiety:          n(a.mq_ps1),
    mq_ps2_loss_of_interest: n(a.mq_ps2),
    mq_ps3_depression:       n(a.mq_ps3),
    mq_ps4_irritability:     n(a.mq_ps4),
    mq_ps5_overwhelmed:      n(a.mq_ps5),
    mq_ps6_brain_fog:        n(a.mq_ps6),
    mq_ps7_low_motivation:   n(a.mq_ps7),

    mq_s1_reduced_desire:    n(a.mq_s1),
    mq_s2_vaginal_dryness:   n(a.mq_s2),
    mq_s3_avoiding_intimacy: n(a.mq_s3),

    isi_0_difficulty_falling_asleep: n(a.isi_0),
    isi_1_difficulty_staying_asleep: n(a.isi_1),
    isi_2_early_awakening:           n(a.isi_2),
    isi_3_sleep_satisfaction:        n(a.isi_3),
    isi_4_noticeable_to_others:      n(a.isi_4),
    isi_5_worried_about_sleep:       n(a.isi_5),
    isi_6_daytime_interference:      n(a.isi_6),

    comor_hypertension:        n(comor['Hypertension']),
    comor_diabetes:            n(comor['Diabetes']),
    comor_hypothyroidism:      n(comor['Hypothyroidism']),
    comor_hyperthyroidism:     n(comor['Hyperthyroidism']),
    comor_hyperlipidemia:      n(comor['Hyperlipidemia']),
    comor_anaemia:             n(comor['Anaemia']),
    comor_pcod:                n(comor['PCOD']),
    comor_osteoporosis:        n(comor['Osteoporosis']),
    comor_heart_disease:       n(comor['Heart Disease']),
    comor_ckd:                 n(comor['CKD']),
    comor_autoimmune_disorder: n(comor['Autoimmune Disorder']),
    comor_stroke_history:      n(comor['Stroke (history)']),
    comor_cancer_history:      n(comor['Cancer (history)']),

    scores: S.scores ? JSON.parse(JSON.stringify(S.scores)) : null,
    triage: S.triage ? JSON.parse(JSON.stringify(S.triage)) : null
  };
}

/* SAVE: FULL ASSESSMENT */
function saveToSupabase() {
  if (window.location.protocol === 'file:') {
    
    _sbShowBanner('error', '✗ Please use a local HTTP server, not file://');
    return;
  }

  _whenReady(function() {
    var row = buildSupabaseRow();
    

    _sbInsert('assessments', row)
      .then(function()     { })
      .catch(function(err) {
        _sbShowBanner('error', 'Something went wrong while saving your assessment. Please try again.');
      });
  }, 'saveToSupabase');
}

/* BOOT */
_loadConfig();

/**
 * Cancel an appointment.
 * Sets status → 'cancelled', records cancelled_at timestamp.
 * @param {string} appointmentId
 * @returns {Promise<{data, error}>}
 */

async function cancelAppointment(appointmentId, slotId) {
  try {
    const headers = {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    };
    const res = await fetch(
      window.SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(appointmentId),
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'cancelled' })
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      return { data: null, error: new Error('HTTP ' + res.status + ' — ' + txt) };
    }
    await _freeConsultantSlot(appointmentId, slotId);
    return { data: true, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

/**
 * Reschedule an appointment to a new slot.
 * - Marks the old slot as available again (is_booked = false).
 * - Marks the new slot as booked (is_booked = true).
 * - Updates the appointment row with new slot_id, appointment_date, slot_time.
 * @param {string} appointmentId
 * @param {string} oldSlotId
 * @param {string} newSlotId
 * @param {string} newDate        — 'YYYY-MM-DD'
 * @param {string} newTime        — 'HH:MM:SS'
 * @returns {Promise<{error}>}
 */

async function rescheduleAppointment(appointmentId, oldSlotId, newSlotId, newDate, newDisplayTime) {
  try {
    const headers = {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    };

    

    // STEP 1 — Free the old slot (find it by appointment ID since slot_id may be null)
    await _freeConsultantSlot(appointmentId, oldSlotId);

    // STEP 2 — Mark new slot as booked
    const slotRes = await fetch(
      window.SUPABASE_URL + '/rest/v1/consultant_slots?id=eq.' + encodeURIComponent(newSlotId),
      { method: 'PATCH', headers, body: JSON.stringify({ booked_appointment_id: appointmentId }) }
    );
    if (!slotRes.ok) {
      const txt = await slotRes.text();
      
      return { data: null, error: new Error('Slot update failed: ' + txt) };
    }
    

    // STEP 3 — Update the appointment row
    // appt_time stores display format "3:00 PM" — pass newDisplayTime directly
    const apptRes = await fetch(
      window.SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(appointmentId),
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          appt_date:      newDate,
          appt_time:      newDisplayTime,   // "3:00 PM" display format
          // slot_id:        newSlotId,
          status:         'rescheduled',
          updated_at:     new Date().toISOString()
        })
      }
    );
    if (!apptRes.ok) {
      const txt = await apptRes.text();
      
      return { data: null, error: new Error('Appointment update failed: ' + txt) };
    }
    

    return { data: true, error: null };
  } catch (e) {
    
    return { data: null, error: e };
  }
}

/**
 * Change consultation mode (video ↔ in-person).
 * @param {string} appointmentId
 * @param {'video'|'in-person'} newMode
 * @returns {Promise<{data, error}>}
 */

async function changeModeAppointment(appointmentId, newMode) {
  try {
    var m = String(newMode || '').toLowerCase().trim();
    var mode = (m === 'video' || m === 'online' || m.indexOf('video') >= 0) ? 'Video' : 'In-Person';
    const res = await fetch(
      window.SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(appointmentId),
      {
        method: 'PATCH',
        headers: {
          'apikey':        window.SUPABASE_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({ mode: mode, updated_at: new Date().toISOString() })
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      return { data: null, error: new Error('HTTP ' + res.status + ' — ' + txt) };
    }
    return { data: true, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

/**
 * Fetch all unbooked slots for a consultant on or after today.
 * Only slots with a booked_appointment_id are hidden — is_active is not
 * used here because booking used to set is_active=false incorrectly.
 * @param {string} consultantId
 * @returns {Promise<{data, error}>}
 */
function _sbFmtSlotTime(timeStr) {
  if (!timeStr) return '—';
  if (/AM|PM/i.test(timeStr)) return timeStr;
  var parts = String(timeStr).split(':');
  var hh = +parts[0];
  var m = parts[1] || '00';
  var ampm = hh >= 12 ? 'PM' : 'AM';
  var hr = hh % 12 || 12;
  return hr + ':' + m + ' ' + ampm;
}

async function _freeConsultantSlot(appointmentId, slotId) {
  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) return;
  var headers = {
    'apikey':        window.SUPABASE_KEY,
    'Authorization': 'Bearer ' + window.SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal'
  };
  var body = JSON.stringify({ booked_appointment_id: null, is_active: true });

  if (slotId) {
    await fetch(
      window.SUPABASE_URL + '/rest/v1/consultant_slots?id=eq.' + encodeURIComponent(slotId),
      { method: 'PATCH', headers, body }
    );
    return;
  }
  if (!appointmentId) return;

  var findRes = await fetch(
    window.SUPABASE_URL + '/rest/v1/consultant_slots'
      + '?booked_appointment_id=eq.' + encodeURIComponent(appointmentId)
      + '&select=id',
    { headers: { apikey: window.SUPABASE_KEY, Authorization: 'Bearer ' + window.SUPABASE_KEY } }
  );
  if (!findRes.ok) return;
  var foundSlots = await findRes.json();
  if (!foundSlots.length) return;
  await fetch(
    window.SUPABASE_URL + '/rest/v1/consultant_slots?id=eq.' + encodeURIComponent(foundSlots[0].id),
    { method: 'PATCH', headers, body }
  );
}

async function fetchAvailableSlotsForConsultant(consultantId) {
  if (!consultantId) return { data: [], error: new Error('No consultant ID') };
  try {
    const today = new Date().toISOString().substring(0, 10);
    const url = window.SUPABASE_URL
      + '/rest/v1/consultant_slots'
      + '?consultant_id=eq.' + encodeURIComponent(consultantId)
      + '&slot_date=gte.' + today
      + '&booked_appointment_id=is.null'
      + '&select=id,slot_date,slot_time,is_active,booked_appointment_id'
      + '&order=slot_date.asc,slot_time.asc'
      + '&limit=120';

    const res = await fetch(url, {
      headers: {
        'apikey':        window.SUPABASE_KEY,
        'Authorization': 'Bearer ' + window.SUPABASE_KEY
      }
    });
    if (!res.ok) {
      const txt = await res.text();
      return { data: null, error: new Error('HTTP ' + res.status + ' — ' + txt) };
    }
    const rows = await res.json();

    const data = rows.map(function(s) {
      return {
        id:            s.id,
        slot_date:     s.slot_date,
        slot_time:     _sbFmtSlotTime(s.slot_time),
        slot_time_raw: s.slot_time
      };
    });

    return { data: data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}