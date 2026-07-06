/* Utilities, Privacy, Filters & Toggles */

function _tplOuterHTML(id, setup) {
  var frag = cloneTemplate(id);
  if (!frag || !frag.firstElementChild) return '';
  var root = frag.firstElementChild;
  if (setup) setup(root);
  return root.outerHTML;
}
function cloneTemplate(id) {
  var t = document.getElementById(id);
  return t ? t.content.cloneNode(true) : null;
}
function fillTemplate(root, map) {
  if (!root || !map) return;
  Object.keys(map).forEach(function(k) {
    var sel = '[data-fill="' + k + '"]';
    var el = root.querySelector(sel);
    if (!el && root.getAttribute && root.getAttribute('data-fill') === k) el = root;
    if (el) el.textContent = map[k];
  });
}
function mountTemplate(id, parent) {
  var frag = cloneTemplate(id);
  if (!frag) return null;
  var node = frag.firstElementChild ? frag : document.createDocumentFragment();
  if (frag.firstElementChild) {
    while (frag.firstChild) parent.appendChild(frag.firstChild);
    return parent.lastElementChild;
  }
  parent.appendChild(frag);
  return parent.lastElementChild;
}
function fillList(root, listKey, items, fn) {
  var host = listHost(root, listKey);
  if (!host) return;
  host.innerHTML = '';
  items.forEach(function(item) {
    var row = typeof fn === 'function' ? fn(item) : item;
    if (typeof row === 'string') host.insertAdjacentHTML('beforeend', row);
    else if (row) host.appendChild(row);
  });
}
function listHost(root, listKey) {
  if (!root) return null;
  if (root.getAttribute && root.getAttribute('data-list') === listKey) return root;
  return root.querySelector('[data-list="' + listKey + '"]');
}

function exportMyData(){
  var obj={exportedAt:new Date().toISOString(),platform:'EvaEraHealth v10',notice:'DPDP Act 2023 — Data Portability',
    profile:{name:S.answers&&S.answers.name,age:S.answers&&S.answers.age,stage:S.answers&&S.answers.stage},
    scores:S.scores||{},answers:S.answers||{},triage:S.triage||[]};
  var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='EvaEraHealth_MyData_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  intToast('success','Data Exported','Personal data downloaded as JSON','DPDP');
}
function deleteMyData(){
  if(!confirm('Delete all your EvaEraHealth data permanently? This cannot be undone.')) return;
  ['evr_session_v7','evr_patients_v7','evr_answers_v7'].forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  S.patients=[];S.session=null;S.answers={};S.scores={};S.triage=[];
  alert('Your local data has been deleted. For server-side deletion email dpo@evaerahealth.in');
  showScreen('auth-screen');
}
function showPrivacyNotice(){
  // MOVED: tpl-privacy-modal
  var existing=document.getElementById('privacy-modal-root');
  if(existing)existing.remove();
  var frag=cloneTemplate('tpl-privacy-modal');
  if(!frag)return;
  var m=frag.firstElementChild;
  m.id='privacy-modal-root';
  document.body.appendChild(m);
  m.querySelector('[data-action="privacyClose"]').addEventListener('click',function(){m.remove();});
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
}
function filterBySeverity(level,btn){
  S._severityFilter=level;
  if(btn){btn.closest('div').querySelectorAll('button').forEach(function(b){b.style.opacity='0.55';});btn.style.opacity='1';}
  renderPatientList();
}
function toggleMed(key, el) {
  if(key === 'med_none') {
    // Selecting 'No medications' clears all others
    var meds=['med_ssri','med_hrt','med_betablocker','med_statin','med_thyroid','med_insulin','med_antihyp','med_sleep','med_nsaid'];
    meds.forEach(function(k){ S.answers[k]=false; });
    el.closest('.cards').querySelectorAll('.card-opt').forEach(function(c){c.classList.remove('selected');});
  } else {
    S.answers['med_none'] = false;
  }
  S.answers[key] = !S.answers[key];
  if(S.answers[key]) el.classList.add('selected');
  else el.classList.remove('selected');
}
function toggleFamHx(key, el) {
  if(key === 'fam_none') {
    var all=['fam_breast_cancer','fam_ovarian_cancer','fam_osteoporosis','fam_cvd','fam_diabetes','fam_depression','fam_early_menopause'];
    all.forEach(function(k){ S.answers[k]=false; });
    el.closest('.cards').querySelectorAll('.card-opt').forEach(function(c){c.classList.remove('selected');});
  } else {
    S.answers['fam_none']=false;
  }
  S.answers[key] = !S.answers[key];
  if(S.answers[key]) el.classList.add('selected');
  else   el.classList.remove('selected');
}

/* HCP clinical notes — keyed by patient email (authId), not per-assessment id */

function evhNoteLookupKeys(patient) {
  var keys = [];
  var seen = {};
  function add(k) {
    if (!k || seen[k]) return;
    seen[k] = true;
    keys.push(k);
  }
  if (!patient) return keys;
  var email = (patient.authId || patient.email || '').trim().toLowerCase();
  if (email) add(email);
  if (window.S && S.session && S.session.authId) {
    add(S.session.authId.trim().toLowerCase());
  }
  if (patient.sessionId) add('sess_' + patient.sessionId);
  if (patient.id) add(patient.id);
  return keys;
}

function evhNoteSaveKey(patient) {
  var keys = evhNoteLookupKeys(patient);
  return keys.length ? keys[0] : '';
}

function evhGetHCPNote(patient) {
  if (!patient) return null;
  var keys = evhNoteLookupKeys(patient);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    try {
      var raw = localStorage.getItem('evh_pat_note_' + k);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.note) return parsed;
      }
    } catch (e) {}
    try {
      var plain = localStorage.getItem('hcp_note_' + k);
      if (plain) {
        var text = JSON.parse(plain);
        if (text) return { note: text, consultant: 'Your Consultant', savedAt: '' };
      }
    } catch (e2) {}
  }
  return null;
}

function evhSaveHCPNote(patient, noteText, consultantName) {
  if (!patient) return;
  var payload = {
    note:       noteText || '',
    consultant: consultantName || 'Your Consultant',
    savedAt:    new Date().toLocaleString('en-IN'),
  };
  var keys = evhNoteLookupKeys(patient);
  if (!keys.length) keys = [patient.id || 'unknown'];
  keys.forEach(function(k) {
    try {
      localStorage.setItem('hcp_note_' + k, JSON.stringify(payload.note));
      localStorage.setItem('evh_pat_note_' + k, JSON.stringify(payload));
    } catch (e) {}
  });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var bc = new BroadcastChannel('evh_hcp_note');
      bc.postMessage({ keys: keys });
      bc.close();
    }
  } catch (e) {}
}

/* Patient → clinic contact via SendGrid (backend /send-clinic-contact) */

function evhClinicEmailAddress() {
  return window.CLINIC_EMAIL || 'vrinda20032001@gmail.com';
}

function evhApplyClinicEmailLabels(root) {
  root = root || document;
  var email = evhClinicEmailAddress();
  root.querySelectorAll('[data-fill="clinicEmailLabel"]').forEach(function(el) {
    var prefix = el.getAttribute('data-email-prefix') || '✉️ Email: ';
    el.textContent = prefix + email;
  });
}

function evhLoadClinicEmailConfig() {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  if (!base) {
    evhApplyClinicEmailLabels(document);
    return;
  }
  fetch(base + '/config', { cache: 'no-store' })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(cfg) {
      if (cfg && cfg.clinic_email) window.CLINIC_EMAIL = cfg.clinic_email;
      evhApplyClinicEmailLabels(document);
    })
    .catch(function() { evhApplyClinicEmailLabels(document); });
}

function evhSendAppointmentCompletedEmail(payload) {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  if (!base || !payload || !payload.patient_email) return Promise.resolve(false);
  return fetch(base + '/send-appointment-completed', {
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

function evhApptCompletedEmailPayload(appt) {
  if (!appt) return null;
  return {
    patient_email: appt.patient_email || appt.patientEmail || null,
    patient_name:  appt.patient_name || appt.patientName || 'Patient',
    doctor_name:   appt.clinician_name || appt.consultantName || 'Consultant',
    date:          appt.appt_date || appt.date || '',
    time:          appt.appt_time || appt.time || '',
    mode:          appt.mode || '',
    booking_id:    appt.id ? String(appt.id) : ''
  };
}

function evhSendClinicEmail(contactType, btnEl) {
  var base = window.OTP_BACKEND_URL || window.API_BASE_URL;
  var clinicEmail = evhClinicEmailAddress();
  var subjectMap = {
    gyne:    'Urgent Gynaecology Consultation',
    psych:   'Urgent Mental Health Consultation',
    general: 'Clinic Contact Request'
  };
  var subject = subjectMap[contactType] || subjectMap.general;

  if (!base) {
    window.location.href = 'mailto:' + clinicEmail + '?subject=' + encodeURIComponent(subject);
    return;
  }

  var origText = btnEl ? btnEl.textContent : '';
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Sending…'; }

  fetch(base + '/send-clinic-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_type:  contactType || 'general',
      patient_name:  (window.S && S.answers && S.answers.name) || 'Patient',
      patient_email: (window.S && S.session && S.session.authId) || null,
      subject:       subject,
      flags:         (window.S && S.redFlagsTriggered) || [],
      message:       ''
    })
  })
  .then(function(res) {
    if (!res.ok) return res.json().then(function(e) { throw new Error(e.detail || 'Send failed'); });
    return res.json();
  })
  .then(function(data) {
    if (typeof intToast === 'function') {
      intToast('success', 'Email sent to clinic', data.message || 'The clinic will contact you soon.', 'EvaEraHealth');
    } else {
      alert(data.message || 'Email sent to clinic.');
    }
    if (btnEl) btnEl.textContent = '✉️ Email sent ✓';
  })
  .catch(function(err) {
    
    if (typeof intToast === 'function') {
      intToast('warn', 'Could not send email', err.message, 'EvaEraHealth');
    } else {
      alert('Could not send email: ' + err.message);
    }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = origText; }
  });
}

function evhBindClinicEmailButtons() {
  if (window._evhClinicEmailBound) return;
  window._evhClinicEmailBound = true;
  document.addEventListener('click', function(ev) {
    var el = ev.target.closest('[data-action="sendClinicEmail"]');
    if (!el) return;
    ev.preventDefault();
    evhSendClinicEmail(el.getAttribute('data-contact-type') || 'general', el);
  });
}

evhBindClinicEmailButtons();
evhLoadClinicEmailConfig();

window.onload = function() {
  var _lastAct=Date.now(),_tWarn=false;
  ['click','keydown','touchstart'].forEach(function(ev){document.addEventListener(ev,function(){_lastAct=Date.now();_tWarn=false;});});
  setInterval(function(){
    var idle=(Date.now()-_lastAct)/1000;
    if(idle>1500&&!_tWarn&&S.currentStep>0){_tWarn=true;
      // MOVED: tpl-session-idle-toast
      var frag=cloneTemplate('tpl-session-idle-toast');
      if(frag&&frag.firstElementChild){
        var t=frag.firstElementChild;
        document.body.appendChild(t);
        setTimeout(function(){if(t.parentNode)t.remove();},5000);
      }}
    if(idle>1800&&S.session){try{localStorage.setItem('evr_answers_v7',JSON.stringify({answers:S.answers,flags:S.flags,step:S.currentStep,ts:new Date().toISOString()}));}catch(e){}}
  },30000);
  CONSENT_ITEMS.filter(function(i){return i.required;}).forEach(function(i){S.consentData[i.id]=false;});
  if(loadSession()&&S.session){showConsent();}
};

