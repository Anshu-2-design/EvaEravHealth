/* Integration Layer, Booking Flow & Admin Portal */

// Shared store keys
var IK={pt:'evh_patients',ap:'evh_appointments',cn:'evh_consultants',
  sl:'evh_slots',py:'evh_payments',ac:'evh_activity',au:'evh_audit',cs:'evh_consents'};
function iSv(k,d){try{localStorage.setItem(k,JSON.stringify(d));}catch(e){}}
function iLd(k,d){try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}}

// MOVED: tpl-adm-empty-row, tpl-abd-badge
function _admEmptyRow(colspan, msg) {
  var frag = cloneTemplate('tpl-adm-empty-row');
  if (!frag || !frag.firstElementChild) return document.createElement('tr');
  var tr = frag.firstElementChild;
  var td = tr.querySelector('td');
  if (td) td.colSpan = colspan;
  fillTemplate(tr, { msg: msg });
  return tr;
}
function _abdBadge(mod, text) {
  var frag = cloneTemplate('tpl-abd-badge');
  if (!frag || !frag.firstElementChild) return document.createElement('span');
  var el = frag.firstElementChild;
  el.className = 'abd ' + mod;
  el.textContent = text;
  return el;
}
function _abdFill(host, mod, text) {
  if (!host) return;
  host.innerHTML = '';
  host.appendChild(_abdBadge(mod, text));
}

// BroadcastChannel for cross-tab sync
var iBc;
try{iBc=new BroadcastChannel('evh_v7');}catch(e){iBc={postMessage:function(){}};}

var _admRefreshTimer = null;
var ADM_REFRESH_MS = 5000;
var _ADM_STORAGE_KEYS = Object.keys(IK).map(function(k){ return IK[k]; });

function _admIsPortalActive() {
  var el = document.getElementById('adm-portal-screen');
  return !!(el && el.classList.contains('active'));
}

function _admStopLiveRefresh() {
  if (_admRefreshTimer) {
    clearInterval(_admRefreshTimer);
    _admRefreshTimer = null;
  }
}

function _admStartLiveRefresh() {
  intRAdm();
  if (_admRefreshTimer) return;
  _admRefreshTimer = setInterval(function() {
    if (!_admIsPortalActive()) {
      _admStopLiveRefresh();
      return;
    }
    intRAdm();
  }, ADM_REFRESH_MS);
}

function _admOnExternalDataChange(source) {
  if (!_admIsPortalActive()) return;
  intRAdm();
  if (source === 'broadcast') return;
}

iBc.onmessage=function(e){
  _admOnExternalDataChange('broadcast');
  var msgs={
    new_assess:'New assessment submitted',
    new_book:'Appointment booked',
    new_con:'Consultant added',
    new_slot:'Slot added'
  };
  if(msgs[e.data.t])intToast('info',msgs[e.data.t],'','Sync');
};
function iBcast(t,d){try{iBc.postMessage({t:t,d:d});}catch(e){}}

function _bindAdminLiveRefresh() {
  window.addEventListener('storage', function(e) {
    if (!e.key || _ADM_STORAGE_KEYS.indexOf(e.key) === -1) return;
    _admOnExternalDataChange('storage');
  });

  var _showScreenOrig = typeof showScreen === 'function' ? showScreen : null;
  if (_showScreenOrig) {
    showScreen = function(id) {
      _showScreenOrig(id);
      if (id === 'adm-portal-screen') _admStartLiveRefresh();
      else _admStopLiveRefresh();
    };
  }
}

// Activity log
function iLogA(icon,title,desc,src){
  var f=iLd(IK.ac,[]);
  f.unshift({icon:icon,title:title,desc:desc,src:src,
    ts:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})});
  if(f.length>60)f.length=60;
  iSv(IK.ac,f);
}

// Toast notifications
function intSendReport(){
  var name=(S.answers&&S.answers.name)||'Patient';
  var email=prompt('Enter email address to send report to:','');
  if(email===null)return;
  if(email&&!/^[^@]+@[^@]+\.[^@]+$/.test(email)){intToast('warn','Invalid email','Please enter a valid email address','');return;}
  var phone=prompt('Enter WhatsApp number (with country code, e.g. +919876543210) — or leave blank to skip:','');
  if(phone===null)return;
  if(!email&&!phone){intToast('warn','Nothing to send to','Please enter email or WhatsApp number','');return;}
  intToast('info','Sending report…','Please wait','');
  setTimeout(function(){
    if(email)intToast('success','Report sent to email',email,'EvaEraHealth');
    if(phone)intToast('success','Report sent via WhatsApp',phone,'EvaEraHealth');
  },1400);
}

function intToast(type,title,msg,src){
  var tc=document.getElementById('int-toast-c');
  if(!tc)return;
  // MOVED: tpl-int-toast
  var frag=cloneTemplate('tpl-int-toast');
  if(!frag||!frag.firstElementChild)return;
  var t=frag.firstElementChild;
  t.classList.add(type||'info');
  fillTemplate(t,{title:title||'',msg:msg||'',src:src||''});
  var msgEl=t.querySelector('.int-toast__msg');
  if(msgEl&&!msg)msgEl.style.display='none';
  var close=t.querySelector('[data-action="intToastClose"]');
  if(close)close.addEventListener('click',function(){if(t.parentNode)t.parentNode.removeChild(t);});
  tc.appendChild(t);
  setTimeout(function(){t.classList.add('out');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},4500);
}

// Portal navigation
function intEnter(p){
  document.getElementById('int-launcher').style.display='none';
  if(p==='patient')showScreen('auth-screen');
  else if(p==='hcp')showScreen('hcp-auth-screen');
  else if(p==='admin')showScreen('adm-login-screen');
}
function intShowLauncher(){
  _admStopLiveRefresh();
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.getElementById('int-launcher').style.display='flex';
}

// OTP input auto-advance
function intOTPnx(el,rid){
  if(el.value.length===1){
    var row=document.getElementById(rid);
    var ins=Array.from(row.querySelectorAll('input[maxlength="1"]'));
    var i=ins.indexOf(el);
    if(i<ins.length-1)ins[i+1].focus();
  }
}

// Admin sidebar navigation
function showAdmMod(n,btn){
  document.querySelectorAll('.adm-mod').forEach(function(m){m.classList.remove('on');});
  document.querySelectorAll('.adm-nav').forEach(function(b){b.classList.remove('on');});
  var mod=document.getElementById('admmod-'+n);
  if(mod)mod.classList.add('on');
  if(btn)btn.classList.add('on');
  if(n==='slots'){
    _slLoadWeekFromDb(_slWkOff);
  }
  if(n==='payments')admRPy();
  if(n==='compliance')admRCp();
}

// Admin — Edit consultant opener
function admOpenEdit(cid){
  var list=_admConCache||[];var c=list.find(function(x){return x.id===cid;});if(!c)return;
  var ttl=document.getElementById('adm-con-ttl');if(ttl)ttl.textContent='Edit Consultant';
  var btn=document.getElementById('anc-savebtn');if(btn)btn.textContent='Save Changes';
  document.getElementById('anc-nm').value=c.name||'';
  document.getElementById('anc-ql').value=c.qual||'';
  document.getElementById('anc-la').value=c.lang||'Hindi, English';
  document.getElementById('anc-fe').value=c.fee||1500;
  document.getElementById('anc-exp').value=c.exp||'';
  document.getElementById('anc-eid').value=cid;
  var sp=document.getElementById('anc-sp');var spFound=false;
  for(var i=0;i<sp.options.length;i++){
    if(sp.options[i].text.replace(/&amp;/g,'&')===c.spec||sp.options[i].value===c.spec){sp.selectedIndex=i;spFound=true;break;}
  }
  if(!spFound){sp.value='custom';var sc2=document.getElementById('anc-sp-c');if(sc2){sc2.style.display='block';sc2.value=c.spec||'';}}
  var durSel=document.getElementById('anc-dur');var stdDur=['20','30','45','60','90'];
  if(durSel&&c.defaultDur){
    if(stdDur.indexOf(String(c.defaultDur))>=0){durSel.value=String(c.defaultDur);}
    else{durSel.value='c';var dc=document.getElementById('anc-dur-c');if(dc){dc.style.display='block';dc.value=c.defaultDur;}}
  }
  document.getElementById('adm-con-modal').classList.remove('is-hidden');
  document.getElementById('adm-con-modal').style.display='flex';
}

// Admin — Toggle consultant active state
function admTogCon(cid){
  var list=_admConCache||[];var c=list.find(function(x){return x.id===cid;});if(!c)return;
  var newActive=!c.active;
  if(!window.SUPABASE_URL||!window.SUPABASE_KEY){
    intToast('warn','Cannot update','Supabase not ready','Admin');
    return;
  }
  fetch(window.SUPABASE_URL+'/rest/v1/hcp_clinicians?id=eq.'+encodeURIComponent(cid),{
    method:'PATCH',
    headers:{
      apikey:window.SUPABASE_KEY,
      Authorization:'Bearer '+window.SUPABASE_KEY,
      'Content-Type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify({active:newActive})
  })
  .then(function(res){
    if(!res.ok)return res.text().then(function(t){throw new Error(t);});
    intToast(newActive?'success':'info',c.name+(newActive?' activated':' deactivated'),'','Admin');
    intRAdm();
  })
  .catch(function(err){
    intToast('warn','Update failed',err.message,'Admin');
  });
}

// Admin — Delete Consultant
function admDelCon(cid){
  var list=_admConCache||[];
  var c=list.find(function(x){return x.id===cid;});
  if(!c)return;
  if(!confirm('Permanently delete '+c.name+'?\n\nThis will:\n• Remove them from the consultant roster\n• Revoke their HCP portal access\n• Delete their record from Supabase\n\nThis cannot be undone.')){return;}
  if(typeof SUPABASE_URL!=='undefined'&&typeof SUPABASE_KEY!=='undefined'&&SUPABASE_URL&&SUPABASE_KEY&&c.id){
    fetch(SUPABASE_URL+'/rest/v1/hcp_clinicians?id=eq.'+encodeURIComponent(c.id),{
      method:'DELETE',
      headers:{
        'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,
        'Content-Type':'application/json','Prefer':'return=minimal'
      }
    })
    .then(function(res){
      if(!res.ok)return res.text().then(function(t){throw new Error(t);});
      
    })
    .catch(function(err){
      
      intToast('warn','Supabase delete failed','Removed locally only — check console','Admin');
    });
  }
  if(typeof hcpRevokeAccess==='function'&&c.hcpEmail)hcpRevokeAccess(c.hcpEmail);
  if(c.hcpEmail){var creds=iLd('evh_hcp_creds',{});delete creds[c.hcpEmail];iSv('evh_hcp_creds',creds);}
  iLogA('warn','Consultant deleted — '+c.name,c.hcpEmail||'','Admin');
  intToast('info',c.name+' deleted','Consultant removed from roster and Supabase','Admin');
  intRAdm();
}

// Admin — Add/Save Consultant
function admACon(){
  var nm=document.getElementById('anc-nm').value.trim();
  if(!nm){intToast('warn','Name required','','');return;}
  var rawSpec=document.getElementById('anc-sp').value;
  var spec=(rawSpec==='custom')?(document.getElementById('anc-sp-c').value.trim()||'Custom'):rawSpec;
  var rawDur=document.getElementById('anc-dur').value;
  var defaultDur=(rawDur==='c')?(parseInt(document.getElementById('anc-dur-c').value)||30):parseInt(rawDur)||30;
  var editId=document.getElementById('anc-eid').value;
  var list=_admConCache||[];
  if(editId){
    var c=list.find(function(x){return x.id===editId;});
    if(c){c.name=nm;c.qual=document.getElementById('anc-ql').value;c.spec=spec;
      c.fee=parseInt(document.getElementById('anc-fe').value)||1500;
      c.lang=document.getElementById('anc-la').value;c.exp=document.getElementById('anc-exp').value;
      c.defaultDur=defaultDur;}
    iSv(IK.cn,list);
    intToast('success','Consultant Updated',nm+' saved','Admin');
  } else {
    var emailSlug=nm.toLowerCase().replace(/dr\.\s*/,'').replace(/\s+/g,'.').replace(/[^a-z.]/g,'');
    var hcpEmail=emailSlug+'@evaerahealth.in';
    var hcpPass='Eva'+Math.random().toString(36).slice(2,6).toUpperCase()+'#'+Math.floor(10+Math.random()*90);
    var c={id:'CON-'+Date.now(),name:nm,qual:document.getElementById('anc-ql').value,spec:spec,
      fee:parseInt(document.getElementById('anc-fe').value)||1500,lang:document.getElementById('anc-la').value,
      exp:document.getElementById('anc-exp').value,defaultDur:defaultDur,active:true,
      hcpEmail:hcpEmail,hcpPass:hcpPass,addedAt:new Date().toLocaleString('en-IN')};
    list.push(c);iSv(IK.cn,list);
    var creds=iLd('evh_hcp_creds',{});creds[hcpEmail]=hcpPass;iSv('evh_hcp_creds',creds);
    iLogA('ok','Consultant added - '+nm,spec+' Rs'+c.fee,'Admin');
    iBcast('new_con',c);
    admShowCred(nm,hcpEmail,hcpPass);
  }
  admHideConModal();
  document.getElementById('anc-nm').value='';document.getElementById('anc-eid').value='';
  var ttl=document.getElementById('adm-con-ttl');if(ttl)ttl.textContent='Add Consultant';
  var btn=document.getElementById('anc-savebtn');if(btn)btn.textContent='Add → Visible in Patient Booking Now';
  intRAdm();
}

function admShowCred(name,email,pass){
  // MOVED: tpl-adm-cred-modal
  var existing=document.getElementById('adm-cred-modal-root');
  if(existing)existing.remove();
  var frag=cloneTemplate('tpl-adm-cred-modal');
  if(!frag)return;
  var m=frag.firstElementChild;
  m.id='adm-cred-modal-root';
  fillTemplate(m,{name:name,email:email,pass:pass});
  document.body.appendChild(m);
  var _cem=email,_cpw=pass;
  m.querySelector('[data-action="admCredClose"]').addEventListener('click',function(){m.remove();});
  m.querySelector('[data-action="admCredCopy"]').addEventListener('click',function(){
    try{navigator.clipboard.writeText('Email: '+_cem+'\nPassword: '+_cpw);}catch(e){}
    intToast('success','Credentials copied — share securely','','Admin');
    m.remove();
  });
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
}

// Admin — legacy slot modal (use weekly grid in Slot Management tab)
function admOSl() {
  intToast('info', 'Use the weekly grid to manage slots', 'Open Slot Management in the admin sidebar', 'Admin');
}
function admASl() {
  intToast('info', 'Use the weekly grid to manage slots', '', 'Admin');
}

// Admin — Supabase consultants (primary source for roster + booking)
var _admConCache = [];
var _admConFetchInFlight = false;
var _admConPending = [];

function _admMapSupabaseClinician(row) {
  return {
    id:         row.id,
    name:       row.name           || '',
    qual:       row.qualification  || '',
    spec:       row.specialisation || '',
    hcpEmail:   row.hcp_email      || '',
    hcpPass:    row.hcp_pass       || '',
    fee:        row.fee            || 1500,
    lang:       row.languages      || 'Hindi, English',
    exp:        row.experience     || '',
    defaultDur: row.default_dur    || 30,
    active:     row.active !== false,
  };
}

function _admActiveConsultants(cons) {
  return (cons || []).filter(function(c) { return c.active; });
}

function _admFetchConsultants(done) {
  if (typeof done === 'function') _admConPending.push(done);

  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _admFetchConsultants(); }, 'admFetchConsultants');
      return;
    }
    _admConCache = [];
    _admDrainConPending();
    return;
  }

  if (_admConFetchInFlight) return;
  _admConFetchInFlight = true;

  fetch(window.SUPABASE_URL + '/rest/v1/hcp_clinicians?select=*&order=name.asc', {
    cache: 'no-store',
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
    },
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ' — ' + t); });
    return res.json();
  })
  .then(function(rows) {
    _admConCache = (rows || []).map(_admMapSupabaseClinician);
    
  })
  .catch(function(err) {
    
    _admConCache = [];
  })
  .finally(function() {
    _admConFetchInFlight = false;
    _admDrainConPending();
  });
}

function _admDrainConPending() {
  var cbs = _admConPending.slice();
  _admConPending = [];
  cbs.forEach(function(cb) {
    try { cb(_admConCache); } catch (e) {  }
  });
}

// Admin — Supabase slot availability counts (for consultant roster)
var _admSlotCountCache = {};

function _admTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function _admFetchSlotCounts(done) {
  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _admFetchSlotCounts(done); }, 'admFetchSlotCounts');
      return;
    }
    _admSlotCountCache = {};
    if (typeof done === 'function') done(_admSlotCountCache);
    return;
  }

  var url = window.SUPABASE_URL
    + '/rest/v1/consultant_slots'
    + '?slot_date=gte.' + _admTodayStr()
    + '&booked_appointment_id=is.null'
    + '&is_active=eq.true'
    + '&select=consultant_id';

  fetch(url, {
    cache: 'no-store',
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
    },
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ' — ' + t); });
    return res.json();
  })
  .then(function(rows) {
    var counts = {};
    (rows || []).forEach(function(row) {
      var cid = row.consultant_id;
      if (!cid) return;
      counts[cid] = (counts[cid] || 0) + 1;
    });
    _admSlotCountCache = counts;
    
  })
  .catch(function(err) {
    
    _admSlotCountCache = {};
  })
  .finally(function() {
    if (typeof done === 'function') done(_admSlotCountCache);
  });
}

// Admin render — Consultants
function admRCon(cons, slotCounts){
  var list = cons || _admConCache || [];
  slotCounts = slotCounts || _admSlotCountCache || {};
  var tb=document.getElementById('adm-con-tb');if(!tb)return;
  tb.innerHTML='';
  if(!list.length){
    tb.appendChild(_admEmptyRow(6, 'No consultants yet. Add one to enable patient booking.'));
    return;
  }
  var sp={
    'Gynaecologist & Menopause Consultant':'abd-b','Menopause Specialist':'abd-p',
    'Psychiatrist':'abd-r','Clinical Psychologist':'abd-a','Counsellor':'abd-a',
    'Ayurveda Consultant':'abd-g','Clinical Nutritionist':'abd-g','Physiotherapist':'abd-b',
    'Yoga Instructor':'abd-g','Lifestyle Coach':'abd-p','Aerobics & Zumba Expert':'abd-p',
    'Dermatologist':'abd-b','Sexologist':'abd-a','Earth Harmony Expert':'abd-g',
    'Gynaecologist':'abd-b','Psychologist':'abd-a','Ayurvedic Physician':'abd-g'
  };
  list.forEach(function(c){
    // MOVED: tpl-adm-con-row
    var frag=cloneTemplate('tpl-adm-con-row');
    if(!frag||!frag.firstElementChild)return;
    var tr=frag.firstElementChild;
    var av = slotCounts[c.id] || 0;
    fillTemplate(tr,{name:c.name,qual:c.qual||'',fee:'Rs '+c.fee});
    var specEl=tr.querySelector('[data-fill="specBadge"]');
    if(specEl){specEl.className='abd '+(sp[c.spec]||'abd-s');specEl.textContent=c.spec;}
    var avEl=tr.querySelector('[data-fill="availBadge"]');
    if(avEl){avEl.className='abd '+(av>0?'abd-g':'abd-s');avEl.textContent=av+' available';}
    var actEl=tr.querySelector('[data-fill="activeBadge"]');
    if(actEl){actEl.className='abd '+(c.active?'abd-g':'abd-s');actEl.textContent=c.active?'Active':'Off';}
    var actions=tr.querySelector('[data-fill="actions"]');
    if(actions){
      // MOVED: tpl-adm-con-btn
      actions.innerHTML='';
      [['✏ Edit','adm-con-btn--edit',function(){admOpenEdit(c.id);}],
       [(c.active?'Deactivate':'Activate'),c.active?'adm-con-btn--toggle-on':'adm-con-btn--toggle-off',function(){admTogCon(c.id);}],
       ['🗑 Delete','adm-con-btn--delete',function(){admDelCon(c.id);}]
      ].forEach(function(spec){
        var bFrag=cloneTemplate('tpl-adm-con-btn');
        if(!bFrag||!bFrag.firstElementChild)return;
        var btn=bFrag.firstElementChild;
        fillTemplate(btn,{label:spec[0]});
        btn.className='adm-con-btn '+spec[1];
        btn.addEventListener('click',spec[2]);
        actions.appendChild(btn);
      });
    }
    tb.appendChild(tr);
  });
}

// Admin render — Slots
function admFSF(){
  var el=document.getElementById('adm-sf');if(!el)return;
  var cons=_admConCache||[];
  el.innerHTML='';
  var opt0=document.createElement('option');
  opt0.value='';opt0.textContent='All';
  el.appendChild(opt0);
  cons.forEach(function(c){
    var opt=document.createElement('option');
    opt.value=c.id;opt.textContent=c.name;
    el.appendChild(opt);
  });
}
function admRSl(){
  var cid=document.getElementById('adm-sf')?document.getElementById('adm-sf').value:'';
  var sls=[];
  if(cid)sls=sls.filter(function(s){return s.consultantId===cid;});
  var tb=document.getElementById('adm-slot-tb');if(!tb)return;
  tb.innerHTML='';
  if(!sls.length){
    tb.appendChild(_admEmptyRow(6, 'No slots yet'));
    return;
  }
  // MOVED: tpl-adm-slot-row
  sls.forEach(function(s){
    var frag=cloneTemplate('tpl-adm-slot-row');
    if(!frag||!frag.firstElementChild)return;
    var tr=frag.firstElementChild;
    fillTemplate(tr,{consultant:s.consultantName,date:s.date,time:s.time,dur:(s.dur||30)+'min',booked:s.bookedBy||'--'});
    var stEl=tr.querySelector('[data-fill="status"]');
    if(stEl){
      var mod=s.status==='available'?'abd-g':s.status==='booked'?'abd-r':'abd-s';
      _abdFill(stEl, mod, s.status);
    }
    tb.appendChild(tr);
  });
}

// Admin — Supabase appointments (primary source for admin portal)
var _admApptCache = [];
var _admApptRawCache = [];
var _admApptFetchInFlight = false;
var _admApptPending = [];
var _admPatientCount = 0;

function _admNormMode(mode) {
  var m = String(mode || '').toLowerCase();
  if (m === 'online' || m === 'video') return 'online';
  return 'offline';
}

function _admModeLabel(mode) {
  return _admNormMode(mode) === 'online' ? 'Online' : 'Offline';
}

function _admMapSupabaseRow(row) {
  return {
    id:             row.id,
    patientName:    row.patient_name    || '',
    consultantName: row.clinician_name  || '',
    date:           row.appt_date       || '',
    time:           row.appt_time       || '',
    mode:           _admNormMode(row.mode),
    fee:            row.fee             || 0,
    status:         row.status          || 'confirmed',
    _source:        'supabase',
  };
}

function _admFetchAppointments(done) {
  if (typeof done === 'function') _admApptPending.push(done);

  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _admFetchAppointments(); }, 'admFetchAppointments');
      return;
    }
    _admApptCache = [];
    _admApptRawCache = [];
    _admDrainApptPending();
    return;
  }

  if (_admApptFetchInFlight) return;
  _admApptFetchInFlight = true;

  var url = window.SUPABASE_URL
    + '/rest/v1/appointments?select=*&order=created_at.desc';

  fetch(url, {
    cache: 'no-store',
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
    },
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ' — ' + t); });
    return res.json();
  })
  .then(function(rows) {
    _admApptRawCache = rows || [];
    _admApptCache = _admApptRawCache.map(_admMapSupabaseRow);
    
  })
  .catch(function(err) {
    
    _admApptCache = [];
    _admApptRawCache = [];
  })
  .finally(function() {
    _admApptFetchInFlight = false;
    _admDrainApptPending();
  });
}

function _admDrainApptPending() {
  var cbs = _admApptPending.slice();
  _admApptPending = [];
  cbs.forEach(function(cb) {
    try { cb(_admApptCache); } catch (e) {  }
  });
}

function _admFetchPatientCount(done) {
  if (typeof done !== 'function') return;

  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    _admPatientCount = 0;
    done(_admPatientCount);
    return;
  }

  fetch(window.SUPABASE_URL + '/rest/v1/assessments?select=email_id', {
    cache: 'no-store',
    headers: {
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
    },
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    return res.json();
  })
  .then(function(rows) {
    var seen = {};
    (rows || []).forEach(function(r) {
      var key = (r.email_id || '').trim().toLowerCase();
      if (key) seen[key] = true;
    });
    _admPatientCount = Object.keys(seen).length || (rows || []).length;
  })
  .catch(function(err) {
    
    _admPatientCount = 0;
  })
  .finally(function() { done(_admPatientCount); });
}

function _admPaymentsFromAppts(rawRows) {
  return (rawRows || []).map(function(r) {
    var paid = String(r.payment_status || '').toLowerCase() === 'paid';
    return {
      id:             r.transaction_id || r.id,
      patientName:    r.patient_name   || '',
      consultantName: r.clinician_name || '',
      amount:         r.fee            || 0,
      method:         r.payment_method || 'UPI',
      status:         paid ? 'success' : (r.payment_status || 'pending'),
      ts:             r.booked_at
        ? new Date(r.booked_at).toLocaleString('en-IN')
        : (r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : ''),
    };
  }).sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
}

function _admFeedFromAppts(rawRows) {
  return (rawRows || []).slice(0, 8).map(function(r) {
    var when = r.booked_at || r.created_at;
    return {
      icon:  'ok',
      title: 'Appointment — ' + (r.patient_name || 'Patient'),
      desc:  (r.clinician_name || 'Consultant') + ' · ' + (r.appt_date || '') + ' ' + (r.appt_time || ''),
      src:   'Booking',
      ts:    when
        ? new Date(when).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '',
    };
  });
}

function _admRenderAppointmentRows(aps, tb, includeFee) {
  if (!tb) return;
  tb.innerHTML = '';
  if (!aps.length) {
    tb.appendChild(_admEmptyRow(includeFee ? 7 : 5, 'No appointments yet'));
    return;
  }
  aps.forEach(function(a) {
    var frag = cloneTemplate('tpl-adm-appt-row');
    if (!frag || !frag.firstElementChild) return;
    var tr = frag.firstElementChild;
    fillTemplate(tr, {
      id:         a.id,
      patient:    a.patientName,
      consultant: a.consultantName,
      datetime:   a.date + ' ' + a.time,
      mode:       _admModeLabel(a.mode),
      fee:        'Rs ' + a.fee,
    });
    var stCell = tr.querySelector('[data-fill="statusCell"]');
    if (stCell) {
      var mod = a.status === 'completed' ? 'abd-b' : a.status === 'cancelled' ? 'abd-r' : 'abd-g';
      _abdFill(stCell, mod, a.status);
      if (a.status === 'confirmed' || a.status === 'rescheduled' || a.status === 'pending' || a.status === 'booked') {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'adm-appt-complete-btn';
        btn.textContent = '✓ Complete';
        btn.addEventListener('click', function() { admMarkApptComplete(a.id); });
        stCell.appendChild(btn);
      }
    }
    tb.appendChild(tr);
  });
}

// Admin render — Appointments
function admRAp(aps) {
  aps = aps || _admApptCache;
  var b = document.getElementById('adm-apt-badge');
  if (b) b.textContent = aps.length;
  var ea = document.getElementById('adms-ap');
  if (ea) ea.textContent = aps.length;
  _admRenderAppointmentRows(aps, document.getElementById('adm-appt-tb'), true);
}

// Admin — Mark appointment complete
function admMarkApptComplete(apId) {
  var cached = _admApptCache.find(function(a) { return a.id === apId; });
  var rawRow = _admApptRawCache.find(function(r) { return r.id === apId; });
  var patientName = cached ? cached.patientName : 'Patient';
  var consultantName = cached ? cached.consultantName : 'Consultant';

  function _doneSuccess(emailed) {
    iLogA('ok', 'Appointment completed', patientName + ' with ' + consultantName, 'Admin');
    var sub = patientName + ' consultation done';
    if (emailed) sub += ' · patient notified by email';
    intToast('success', 'Marked Complete', sub, 'Admin');
    intRAdm();
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    _doneSuccess(false);
    return;
  }

  fetch(
    window.SUPABASE_URL + '/rest/v1/appointments?id=eq.' + encodeURIComponent(apId),
    {
      method: 'PATCH',
      headers: {
        'apikey':        window.SUPABASE_KEY,
        'Authorization': 'Bearer ' + window.SUPABASE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        status:       'completed',
        completed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }),
    }
  )
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ' — ' + t); });
    var emailPayload = typeof evhApptCompletedEmailPayload === 'function'
      ? evhApptCompletedEmailPayload(rawRow || cached)
      : null;
    if (emailPayload && typeof evhSendAppointmentCompletedEmail === 'function') {
      return evhSendAppointmentCompletedEmail(emailPayload).then(function(sent) { _doneSuccess(sent); });
    }
    _doneSuccess(false);
  })
  .catch(function(err) {
    
    intToast('warn', 'Could not update appointment', 'Check Supabase permissions or try again', 'Admin');
  });
}

// Admin render — Payments (from Supabase appointments)
function admRPy(){
  var pays = _admPaymentsFromAppts(_admApptRawCache);
  var ok=pays.filter(function(p){return p.status==='success';});
  var rev=ok.reduce(function(s,p){return s+p.amount;},0);
  var er=document.getElementById('pstat-rv');if(er)er.textContent='Rs '+rev.toLocaleString('en-IN');
  var eo=document.getElementById('pstat-ok');if(eo)eo.textContent=ok.length;
  var ep=document.getElementById('pstat-pe');if(ep)ep.textContent=pays.filter(function(p){return p.status==='pending';}).length;
  var ef=document.getElementById('pstat-fa');if(ef)ef.textContent=pays.filter(function(p){return p.status==='failed';}).length;
  var tb=document.getElementById('adm-pay-tb');if(!tb)return;
  tb.innerHTML='';
  if(!pays.length){
    tb.appendChild(_admEmptyRow(6, 'No transactions yet'));
    return;
  }
  // MOVED: tpl-adm-pay-row
  pays.forEach(function(p){
    var frag=cloneTemplate('tpl-adm-pay-row');
    if(!frag||!frag.firstElementChild)return;
    var tr=frag.firstElementChild;
    fillTemplate(tr,{id:p.id,patient:p.patientName,amount:'Rs '+p.amount,method:(p.method||'').toUpperCase(),ts:p.ts});
    var stEl=tr.querySelector('[data-fill="status"]');
    if(stEl){
      var mod=p.status==='success'?'abd-g':p.status==='failed'?'abd-r':'abd-a';
      _abdFill(stEl, mod, p.status);
    }
    tb.appendChild(tr);
  });
}

// Admin render — Compliance
function admRCp(){
  var cs=iLd(IK.cs,[]);
  var el=document.getElementById('adm-comp-b');if(!el)return;
  var rows=[
    ['Para 6(1) Informed Consent','8-item consent logged per session','abd-g','Compliant'],
    ['Para 7 Data Minimisation','Only clinically required data','abd-g','Compliant'],
    ['Para 8 Purpose Limitation','Assessment, triage and booking only','abd-g','Compliant'],
    ['Para 11 Right to Erasure','Delete My Data button available','abd-a','Demo mode'],
    ['Para 13 Data Fiduciary','DPO: dpo@evaerahealth.in','abd-g','Compliant'],
    ['DPIA','Data Protection Impact Assessment','abd-r','Required before launch'],
    ['IEC/IRB','Ethics dossier submitted Mar 2026','abd-a','Awaiting approval']
  ];
  // MOVED: tpl-adm-comp-row + tpl-adm-comp-footer
  el.innerHTML='';
  rows.forEach(function(r){
    var frag=cloneTemplate('tpl-adm-comp-row');
    if(!frag||!frag.firstElementChild)return;
    var row=frag.firstElementChild;
    fillTemplate(row,{title:r[0],sub:r[1]});
    var badge=row.querySelector('[data-fill="badge"]');
    if(badge){badge.className='abd '+r[2];badge.textContent=r[3];}
    el.appendChild(row);
  });
  var footFrag=cloneTemplate('tpl-adm-comp-footer');
  if(footFrag&&footFrag.firstElementChild){
    fillTemplate(footFrag.firstElementChild,{count:String(cs.length)});
    el.appendChild(footFrag.firstElementChild);
  }
}

// Admin render — Dashboard
function admRDash(aps){
  aps = aps || _admApptCache;
  var pays = _admPaymentsFromAppts(_admApptRawCache);
  var cons = _admConCache || [];
  var ea=document.getElementById('adms-as');if(ea)ea.textContent=_admPatientCount;
  var eap=document.getElementById('adms-ap');if(eap)eap.textContent=aps.length;
  var er=document.getElementById('adms-rv');
  if(er)er.textContent='Rs '+pays.filter(function(p){return p.status==='success';}).reduce(function(s,p){return s+p.amount;},0).toLocaleString('en-IN');
  var ec=document.getElementById('adms-cn');if(ec)ec.textContent=cons.filter(function(c){return c.active;}).length;
  var feed = _admFeedFromAppts(_admApptRawCache);
  var fel=document.getElementById('adm-feed-b');
  if(fel){
    fel.innerHTML='';
    if(feed.length){
      // MOVED: tpl-adm-feed-item
      feed.slice(0,8).forEach(function(x){
        var frag=cloneTemplate('tpl-adm-feed-item');
        if(!frag||!frag.firstElementChild)return;
        fillTemplate(frag.firstElementChild,{title:x.title,meta:x.desc+' • '+x.ts+' • '+x.src});
        fel.appendChild(frag.firstElementChild);
      });
    } else {
      mountTemplate('tpl-adm-feed-empty',fel);
    }
  }
  var ra=document.getElementById('adm-rec-ap');
  if(ra){
    ra.innerHTML='';
    if(aps.length){
      // MOVED: tpl-adm-dash-table
      var tblFrag=cloneTemplate('tpl-adm-dash-table');
      if(tblFrag&&tblFrag.firstElementChild){
        var tbl=tblFrag.firstElementChild;
        var tbody=tbl.querySelector('tbody');
        aps.slice(0,5).forEach(function(a){
          var frag=cloneTemplate('tpl-adm-dash-appt-row');
          if(!frag||!frag.firstElementChild)return;
          var tr=frag.firstElementChild;
          fillTemplate(tr,{patient:a.patientName,consultant:a.consultantName,datetime:a.date+' '+a.time,mode:_admModeLabel(a.mode)});
          var stEl=tr.querySelector('[data-fill="status"]');
          if(stEl)_abdFill(stEl,a.status==='completed'?'abd-b':a.status==='cancelled'?'abd-r':'abd-g',a.status);
          if(tbody)tbody.appendChild(tr);
        });
        ra.appendChild(tbl);
      }
    } else {
      mountTemplate('tpl-adm-dash-empty',ra);
    }
  }
}

function intRAdm(){
  _admFetchConsultants(function() {
    _admFetchSlotCounts(function(counts) {
      admRCon(_admConCache, counts);
      admRSl();
      _admFetchAppointments(function(aps) {
        _admFetchPatientCount(function() {
          admRDash(aps);
          admRAp(aps);
          if(document.getElementById('admmod-payments')&&document.getElementById('admmod-payments').classList.contains('on'))admRPy();
        });
      });
    });
  });
}

// ─── BOOKING FLOW
var BK={step:1,mode:null,con:null,slot:null,pay:'upi'};

function intShowBooking(){
  var active = document.querySelector('.screen.active');
  BK={step:1,mode:null,con:null,slot:null,pay:'upi',
    returnScreen: active ? active.id : 'results-screen'};
  var pd=document.getElementById('patient-dashboard-screen');
  if(pd)pd.style.display='';
  showScreen('int-bk-screen');
  _admFetchConsultants(function() { intRBk(); });
}

function intRBk(){
  var subs=['','Choose appointment type','Select your doctor','Choose a time slot','Payment','Confirmed!'];
  for(var i=1;i<=5;i++){
    var d=document.getElementById('ibpd'+i);var l=document.getElementById('ibpl'+i);
    if(d)d.className='ibpd '+(i<BK.step?'done':i===BK.step?'active':'');
    if(l)l.className='ibpl '+(i<BK.step?'done':'');
  }
  var sub=document.getElementById('int-bk-sub');
  if(sub)sub.textContent='Step '+BK.step+' of 5 - '+subs[BK.step];
  var bb=document.getElementById('ibk-bk');
  if(bb){
    if(BK.step<5){
      bb.classList.remove('is-hidden');
      bb.style.display='block';
      bb.textContent=BK.step===1?_bkExitLabel():'\u2190 Back';
    }else{
      bb.classList.add('is-hidden');
      bb.style.display='none';
    }
  }
  var bn=document.getElementById('ibk-nx');if(bn)bn.style.display=BK.step<4?'block':'none';
  intRBkContent();
}

function _bkMountEmpty(parent, icon, html) {
  var frag = cloneTemplate('tpl-bk-empty');
  if (!frag || !frag.firstElementChild) return;
  var el = frag.firstElementChild;
  var iconEl = el.querySelector('[data-fill="icon"]');
  if (iconEl) iconEl.textContent = icon;
  var htmlEl = el.querySelector('[data-fill="html"]');
  if (htmlEl) htmlEl.innerHTML = html;
  parent.appendChild(el);
}

function intRBkContent(){
  var bc=document.getElementById('int-bk-body');
  if(!bc)return;
  bc.innerHTML='';

  if(BK.step===1){
    // MOVED: tpl-bk-mode-grid + tpl-bk-mode-card
    var gridFrag=cloneTemplate('tpl-bk-mode-grid');
    if(!gridFrag||!gridFrag.firstElementChild)return;
    var grid=gridFrag.firstElementChild;
    [{m:'online',icon:'📹',title:'Video Call',sub:'Google Meet link sent in confirmation email.'},
     {m:'offline',icon:'🏥',title:'In-Person Visit',sub:'Gurugram clinic. Visit details sent to your email.'}
    ].forEach(function(spec){
      var cFrag=cloneTemplate('tpl-bk-mode-card');
      if(!cFrag||!cFrag.firstElementChild)return;
      var card=cFrag.firstElementChild;
      fillTemplate(card,{icon:spec.icon,title:spec.title,sub:spec.sub});
      card.dataset.mode=spec.m;
      if(BK.mode===spec.m)card.classList.add(spec.m==='online'?'selected-online':'selected-offline');
      card.addEventListener('click',function(){
        BK.mode=spec.m;
        grid.querySelectorAll('.bk-mode-card').forEach(function(x){x.classList.remove('selected-online','selected-offline');});
        card.classList.add(spec.m==='online'?'selected-online':'selected-offline');
      });
      grid.appendChild(card);
    });
    bc.appendChild(grid);
    return;
  }

  if(BK.step===2){
    mountTemplate('tpl-bk-loading', bc);
    _admFetchConsultants(function(cons) {
      bc.innerHTML='';
      var active = _admActiveConsultants(cons);
      if(!active.length){
        _bkMountEmpty(bc,'👩‍⚕️','No consultants yet.<br>Open Admin Portal and add consultants first.');
        return;
      }
      active.forEach(function(c){
        var frag=cloneTemplate('tpl-bk-doctor-card');
        if(!frag||!frag.firstElementChild)return;
        var card=frag.firstElementChild;
        var initials=c.name.replace('Dr. ','').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2);
        fillTemplate(card,{initials:initials,name:c.name,qual:c.qual+' - '+c.spec,meta:c.lang+' - Rs '+c.fee});
        card.dataset.cid=c.id;
        if(BK.con&&BK.con.id===c.id)card.classList.add('selected');
        card.addEventListener('click',function(){
          BK.con=c;
          bc.querySelectorAll('.bk-doctor-card').forEach(function(x){x.classList.remove('selected');});
          card.classList.add('selected');
        });
        bc.appendChild(card);
      });
    });
    return;
  }

  if(BK.step===3){
    if(!BK.con){
      var hint=document.createElement('div');
      hint.className='bk-slot-label';
      hint.textContent='Go back and select a consultant.';
      bc.appendChild(hint);
      return;
    }
    // MOVED: tpl-bk-loading
    mountTemplate('tpl-bk-loading',bc);
    slFetchSlotsForConsultant(BK.con.id, function(slots){
      bc.innerHTML='';
      if(!slots.length){
        _bkMountEmpty(bc,'📅','No available slots for '+BK.con.name+'.<br><span class="bk-empty-hint">The admin needs to set slots for this consultant.</span>');
        return;
      }
      var grouped={};
      slots.forEach(function(s){if(!grouped[s.date])grouped[s.date]=[];grouped[s.date].push(s);});
      var lblFrag=cloneTemplate('tpl-bk-slot-label');
      if(lblFrag&&lblFrag.firstElementChild){fillTemplate(lblFrag.firstElementChild,{text:'Available slots for '+BK.con.name+':'});bc.appendChild(lblFrag.firstElementChild);}
      var wrapFrag=cloneTemplate('tpl-bk-slot-wrap');
      var wrap=wrapFrag&&wrapFrag.firstElementChild?wrapFrag.firstElementChild:null;
      if(!wrap){wrap=document.createElement('div');}
      var daysHost=listHost(wrap,'days')||wrap;
      Object.keys(grouped).sort().forEach(function(date){
        var dayFrag=cloneTemplate('tpl-bk-slot-day');
        if(!dayFrag)return;
        var dayWrap=dayFrag.querySelector('.bk-slot-day-wrap');
        if(!dayWrap)return;
        var labelEl=dayWrap.querySelector('.bk-slot-day');
        var slotHost=listHost(dayWrap,'slots');
        if(!slotHost)return;
        var d=new Date(date+'T00:00:00');
        var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var mos=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if(labelEl)labelEl.textContent=days[d.getDay()]+', '+d.getDate()+' '+mos[d.getMonth()]+' '+d.getFullYear();
        grouped[date].forEach(function(s){
          var bFrag=cloneTemplate('tpl-bk-slot-btn');
          if(!bFrag||!bFrag.firstElementChild)return;
          var btn=bFrag.firstElementChild;
          fillTemplate(btn,{time:s.time});
          btn.dataset.slotId=s.id;
          if(BK.slot&&BK.slot.id===s.id)btn.classList.add('selected');
          btn.addEventListener('click',function(){
            if(BK.slot&&BK.slot.id===s.id){BK.slot=null;btn.classList.remove('selected');return;}
            bc.querySelectorAll('.bk-slot-btn').forEach(function(x){x.classList.remove('selected');});
            BK.slot=s;btn.classList.add('selected');
          });
          slotHost.appendChild(btn);
        });
        daysHost.appendChild(dayWrap);
      });
      bc.appendChild(wrap);
    });
    return;
  }

  if(BK.step===4){
    // MOVED: tpl-bk-order-summary + tpl-bk-pay-grid + tpl-bk-pay-card
    var sumFrag=cloneTemplate('tpl-bk-order-summary');
    if(sumFrag&&sumFrag.firstElementChild){
      fillTemplate(sumFrag.firstElementChild,{
        consultant:BK.con?BK.con.name:'',
        datetime:BK.slot?BK.slot.date+' '+BK.slot.time:'',
        mode:BK.mode==='online'?'Online Video':'In-Person',
        fee:'Rs '+(BK.con?BK.con.fee:1500)
      });
      bc.appendChild(sumFrag.firstElementChild);
    }
    mountTemplate('tpl-bk-pay-label',bc);
    var pgridFrag=cloneTemplate('tpl-bk-pay-grid');
    if(!pgridFrag||!pgridFrag.firstElementChild)return;
    var pgrid=pgridFrag.firstElementChild;
    [{k:'upi',t:'UPI',s:'PhonePe, GPay'},{k:'card',t:'Card',s:'Debit/Credit'},{k:'nb',t:'Net Banking',s:'All banks'},{k:'wallet',t:'Wallet',s:'Paytm, Amazon'}].forEach(function(pm){
      var pFrag=cloneTemplate('tpl-bk-pay-card');
      if(!pFrag||!pFrag.firstElementChild)return;
      var pcard=pFrag.firstElementChild;
      fillTemplate(pcard,{title:pm.t,sub:pm.s});
      pcard.dataset.payKey=pm.k;
      if(BK.pay===pm.k)pcard.classList.add('selected');
      pcard.addEventListener('click',function(){
        BK.pay=pm.k;
        pgrid.querySelectorAll('.bk-pay-card').forEach(function(x){x.classList.remove('selected');});
        pcard.classList.add('selected');
      });
      pgrid.appendChild(pcard);
    });
    bc.appendChild(pgrid);
    var paybtn=document.createElement('button');
    paybtn.id='int-pay-b';
    paybtn.className='bk-pay-btn';
    paybtn.textContent='Pay Rs '+(BK.con?BK.con.fee:1500)+' via Razorpay';
    paybtn.addEventListener('click',intPay);
    bc.appendChild(paybtn);
    return;
  }

  if(BK.step===5){
    // MOVED: tpl-bk-confirm
    var cFrag=cloneTemplate('tpl-bk-confirm');
    if(!cFrag||!cFrag.firstElementChild)return;
    var wrap=cFrag.firstElementChild;
    var backbtn=wrap.querySelector('.bk-confirm-back');
    if(backbtn){
      fillTemplate(backbtn,{backLabel:(BK.returnScreen==='patient-dashboard-screen')?'← Back to Dashboard':'← Back to My Results'});
      backbtn.addEventListener('click',async function(){
        var target=BK.returnScreen||'results-screen';
        if(target==='patient-dashboard-screen'){
          if(BK.saveComplete){backbtn.textContent='Loading your dashboard…';backbtn.disabled=true;try{await BK.saveComplete;}catch(e){}}
          var patient=window._pdCurrentPatient||(window.S&&S.currentPatient)||null;
          if(!patient){
            var pts=_pd_iLd?_pd_iLd('evr_patients_v7',[]):(function(){try{return JSON.parse(localStorage.getItem('evr_patients_v7')||'[]');}catch(e){return [];}})();
            var authId=(window.S&&S.session&&S.session.authId)?S.session.authId.trim().toLowerCase():null;
            patient=authId?pts.filter(function(p){return p.authId&&p.authId.trim().toLowerCase()===authId;}).sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);})[0]:null;
          }
          if(patient&&typeof showPatientDashboard==='function'){await showPatientDashboard(patient);}
          else{showScreen(target);}
        } else {showScreen(target);}
      });
    }
    bc.appendChild(wrap);
    return;
  }
}

function intBkNx(){
  if(BK.step===1&&!BK.mode){intToast('warn','Please select Online or In-Person first','','');return;}
  if(BK.step===2&&!BK.con){intToast('warn','Please select a consultant','','');return;}
  if(BK.step===3&&!BK.slot){intToast('warn','Please select an available slot','','');return;}
  BK.step++;intRBk();
}

function _bkExitLabel(){
  if(BK.returnScreen==='patient-dashboard-screen')return'\u2190 Back to Dashboard';
  if(BK.returnScreen==='hcp-portal-screen')return'\u2190 Back to HCP Portal';
  if(BK.returnScreen==='results-screen')return'\u2190 Back to Results';
  return'\u2190 Back';
}

function intBkExit(){
  var target=BK.returnScreen||'results-screen';
  if(target==='patient-dashboard-screen'){
    var patient=window._pdCurrentPatient||(window.S&&S.currentPatient)||null;
    if(!patient){
      var pts=_pd_iLd?_pd_iLd('evr_patients_v7',[]):(function(){try{return JSON.parse(localStorage.getItem('evr_patients_v7')||'[]');}catch(e){return [];}})();
      var authId=(window.S&&S.session&&S.session.authId)?S.session.authId.trim().toLowerCase():null;
      patient=authId?pts.filter(function(p){return p.authId&&p.authId.trim().toLowerCase()===authId;}).sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);})[0]:null;
    }
    if(patient&&typeof showPatientDashboard==='function'){showPatientDashboard(patient);return;}
  }
  if(target==='hcp-portal-screen'&&typeof showHCPDashboard==='function'){showHCPDashboard();return;}
  showScreen(target);
}

function intBkPv(){
  if(BK.step===1){intBkExit();return;}
  if(BK.step>1&&BK.step<5){BK.step--;intRBk();}
}

// ─── SAVE APPOINTMENT TO SUPABASE
function _saveAppointmentToSupabase(ap, onSaved) {
  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) {
    
    _whenReady(function() { _saveAppointmentToSupabase(ap); }, 'saveAppointment');
    return;
  }
  var clinicianEmail = (ap.consultantEmail || '').toLowerCase();
  var row = {
    clinician_id:       ap.consultantId   || ap.consultantEmail || 'unknown',
    clinician_name:     ap.consultantName || '',
    clinician_email:    clinicianEmail,
    clinician_spec:     ap.consultantSpec || '',
    patient_name:       ap.patientName    || '',
    patient_email:      ap.patientEmail   || null,
    patient_session_id: ap.sessionId      || null,
    appt_date:          ap.date           || null,
    appt_time:          ap.time           || '',
    duration_min:       ap.dur            || 30,
    mode:               ap.mode === 'online' ? 'Video' : 'In-Person',
    fee:                ap.fee            || 1500,
    payment_status:     'paid',
    payment_method:     ap.payMethod      || 'UPI',
    transaction_id:     ap.payId          || null,
    status:             'confirmed',
    booked_at:          new Date().toISOString(),
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString()
  };

  

  fetch(window.SUPABASE_URL + '/rest/v1/appointments', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        window.SUPABASE_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_KEY,
      'Prefer':        'return=representation'
    },
    body: JSON.stringify(row)
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ' — ' + t); });
    return res.json();
  })
  .then(function(data) {
    var inserted = Array.isArray(data) ? data[0] : data;
    

    if (inserted && inserted.id) ap.supabaseId = inserted.id;

    // Send confirmation email and get meet link back
    // Backend base URL — defined in js/config.js (loaded first)
    var backendBase = window.OTP_BACKEND_URL;

    fetch(backendBase + '/send-appointment-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_email: row.patient_email,
        patient_name:  row.patient_name,
        doctor_name:   row.clinician_name,
        doctor_email:  row.clinician_email,
        date:          row.appt_date,
        time:          row.appt_time,
        mode:          row.mode,
        fee:           row.fee,
        booking_id:    inserted && inserted.id ? inserted.id : ap.id,
        meet_link:     null
      })
    })
    .then(function(res) {
      if (!res.ok) return res.json().then(function(e){ throw new Error(e.detail || 'send failed'); });
      return res.json();
    })
    .then(function(emailData) {
      
      // Update the Video Link row with the real meet link from backend
      var meetLink = emailData && emailData.meet_link;
      var linkEl = document.getElementById('cnf-meet-link');
      if (linkEl) {
        if (meetLink) {
          // MOVED: tpl-int-meet-link
          linkEl.innerHTML = '';
          linkEl.className = '';
          var mFrag = cloneTemplate('tpl-int-meet-link');
          if (mFrag && mFrag.firstElementChild) {
            var a = mFrag.firstElementChild;
            a.href = meetLink;
            a.textContent = meetLink;
            linkEl.appendChild(a);
          }
        } else {
          linkEl.textContent = 'Link sent to your email';
        }
      }
    })
    .catch(function(err) {
      var linkEl = document.getElementById('cnf-meet-link');
      if (linkEl) linkEl.textContent = 'Link will be sent to your email';
    });

    if (typeof onSaved === 'function') onSaved(inserted && inserted.id ? inserted.id : null);
    if (typeof intRAdm === 'function') intRAdm();
  })
  .catch(function(err) {
    intToast('warn', 'Booking could not be completed', 'Please try again or contact clinic@evaerahealth.in', 'EvaEraHealth');
    if (typeof onSaved === 'function') onSaved(null);
  });
}

// ─── PAYMENT & BOOKING CONFIRMATION
function intPay(){
  var btn=document.getElementById('int-pay-b');
  if(btn){btn.textContent='Processing via Razorpay...';btn.disabled=true;}
  setTimeout(function(){
    var patName =
      (window.S && S.currentPatient && S.currentPatient.name) ? S.currentPatient.name :
      (window.S && S.answers && S.answers.name) ? S.answers.name : 'Patient';
    var patId = (window.S && S.session && S.session.id) ? S.session.id : ('GUEST-' + Date.now());

    var patEmail = null;
    if (window.S && S.session && S.session.authId) {
      patEmail = S.session.authId;
    }

    var conEmail = '';
    var conSpec  = '';
    var conList  = _admConCache || [];
    var conFull  = conList.find(function(c) { return c.id === BK.con.id; });
    if (conFull) {
      conEmail = conFull.hcpEmail || '';
      conSpec  = conFull.spec     || '';
    }

    var ap = {
      id:             'EVH-' + Date.now(),
      patientId:      patId,
      patientName:    patName,
      patientEmail:   patEmail,
      sessionId:      (window.S && S.session) ? S.session.id : null,
      consultantId:   BK.con.id,
      consultantName: BK.con.name,
      consultantEmail:conEmail,
      consultantSpec: conSpec,
      date:           BK.slot.date,
      time:           BK.slot.time,
      mode:           BK.mode,
      dur:            BK.slot.dur || 30,
      fee:            BK.con.fee  || 1500,
      payMethod:      BK.pay,
      payId:          'RZP-' + Math.random().toString(36).substr(2,8).toUpperCase(),
      status:         'confirmed',
      ts:             new Date().toLocaleString('en-IN'),
      bookedAt:       Date.now()
    };

    // Save to Supabase — track completion
    BK.saveComplete = new Promise(function(resolve) {
      _saveAppointmentToSupabase(ap, function(supabaseApptId) {
        if (supabaseApptId) {
          slMarkSlotBooked(BK.slot.id, supabaseApptId);
          ap.id = supabaseApptId;
        } else {
          
        }
        resolve(supabaseApptId);
      });
    });

    // Move to confirmation step
    BK.step = 5; intRBk();
    var cd = document.getElementById('int-cnf-det');
    if (cd) {
      var bookingId = ap.id;
      var rows = [
        ['Patient',     ap.patientName],
        ['Booking ID',  bookingId],
        ['Consultant',  ap.consultantName],
        ['Date & Time', ap.date+' '+ap.time],
        ['Mode',        BK.mode==='online'?'Online Video':'In-Person']
      ];
      var meetRowIdx = -1;
      if (BK.mode === 'online') {
        meetRowIdx = rows.length;
        rows.push(['Video Link', '']);
      }
      rows.push(['Payment', 'Rs '+ap.fee+' Paid']);
      // MOVED: tpl-bk-confirm-det + tpl-bk-confirm-det-row
      cd.innerHTML = '';
      var detFrag = cloneTemplate('tpl-bk-confirm-det');
      if (detFrag && detFrag.firstElementChild) {
        var detGrid = detFrag.firstElementChild;
        var detHost = listHost(detGrid, 'rows');
        if (detHost) {
          rows.forEach(function(r, idx) {
            var rFrag = cloneTemplate('tpl-bk-confirm-det-row');
            if (!rFrag || !rFrag.firstElementChild) return;
            var rowEl = rFrag.firstElementChild;
            var valEl = rowEl.querySelector('[data-fill="value"]');
            fillTemplate(rowEl, { label: r[0] });
            if (idx === 1 && valEl) {
              valEl.className = 'bk-confirm-det-row__mono';
              valEl.textContent = r[1];
            } else if (idx === meetRowIdx && valEl) {
              valEl.id = 'cnf-meet-link';
              valEl.className = 'bk-confirm-det-row__pending';
              valEl.textContent = 'Generating…';
            } else if (idx === rows.length - 1 && valEl) {
              var strong = document.createElement('strong');
              strong.className = 'bk-confirm-det-row__paid';
              strong.textContent = r[1];
              valEl.appendChild(strong);
            } else if (valEl) {
              valEl.textContent = r[1];
            }
            detHost.appendChild(rowEl);
          });
        }
        cd.appendChild(detGrid);
      }
    }

    iLogA('ok', 'Appointment booked - ' + ap.patientName,
      (BK.mode === 'online' ? 'Online' : 'Offline') + ' with ' + ap.consultantName + ' on ' + ap.date + ' ' + ap.time, 'Patient');
    iLogA('ok', 'Payment received - Rs ' + ap.fee, ap.payId + ' ' + BK.pay.toUpperCase(), 'Razorpay');

    BK.saveComplete.then(function(supabaseId) {
      if (!supabaseId) return;
      var idEl = cd && cd.querySelector('.bk-confirm-det-row__mono');
      if (idEl) idEl.textContent = supabaseId;
    });

    intToast('success','Appointment Confirmed!',ap.consultantName+' on '+ap.date+' '+ap.time,'EvaEraHealth');
  }, 1800);
}

// Admin modal helpers (moved from inline onclick/onchange)
function admShowConModal(){
  var m=document.getElementById('adm-con-modal');
  if(m){m.classList.remove('is-hidden');m.style.display='flex';}
}
function admHideConModal(){
  var m=document.getElementById('adm-con-modal');
  if(m){m.style.display='none';m.classList.add('is-hidden');}
}
function admHideSlotModal(){
  var m=document.getElementById('adm-slot-modal');
  if(m){m.style.display='none';m.classList.add('is-hidden');}
}
function admBackToStep1(){
  document.getElementById('adm-s2').style.display='none';
  document.getElementById('adm-s1').style.display='block';
  var si2=document.getElementById('adm-si2');
  if(si2)si2.style.background='rgba(255,255,255,0.15)';
}
function ancSpToggle(){
  var el=document.getElementById('anc-sp');
  var c=document.getElementById('anc-sp-c');
  if(!el||!c)return;
  if(el.value==='custom'){c.classList.remove('is-hidden');c.style.display='block';}
  else{c.classList.add('is-hidden');c.style.display='none';}
}
function ancDurToggle(){
  var el=document.getElementById('anc-dur');
  var c=document.getElementById('anc-dur-c');
  if(!el||!c)return;
  if(el.value==='c'){c.classList.remove('is-hidden');c.style.display='block';}
  else{c.classList.add('is-hidden');c.style.display='none';}
}
function ansDuToggle(){
  var el=document.getElementById('ans-du');
  var c=document.getElementById('ans-du-c');
  if(!el||!c)return;
  if(el.value==='c'){c.classList.remove('is-hidden');c.style.display='block';}
  else{c.classList.add('is-hidden');c.style.display='none';}
}

function _bindDataAction(el,fn){
  if(!el||el.dataset.boundAction)return;
  el.dataset.boundAction='1';
  el.addEventListener('click',fn);
}

function _bindIntegrationHtml(){
  document.querySelectorAll('#int-launcher [data-action="intEnter"]').forEach(function(card){
    _bindDataAction(card,function(){intEnter(card.getAttribute('data-portal'));});
  });
  document.querySelectorAll('[data-action="intShowLauncher"]').forEach(function(el){
    _bindDataAction(el,function(e){e.preventDefault();intShowLauncher();});
  });
  document.querySelectorAll('.adm-nav[data-adm-mod]').forEach(function(el){
    _bindDataAction(el,function(){showAdmMod(el.getAttribute('data-adm-mod'),el);});
  });
  document.querySelectorAll('[data-action="showAdmMod"]').forEach(function(el){
    _bindDataAction(el,function(){showAdmMod(el.getAttribute('data-adm-mod'),null);});
  });
  document.querySelectorAll('[data-action="admShowConModal"]').forEach(function(el){
    _bindDataAction(el,admShowConModal);
  });
  document.querySelectorAll('[data-action="admHideConModal"]').forEach(function(el){
    _bindDataAction(el,admHideConModal);
  });
  document.querySelectorAll('[data-action="admHideSlotModal"]').forEach(function(el){
    _bindDataAction(el,admHideSlotModal);
  });
  document.querySelectorAll('[data-action="admACon"]').forEach(function(el){
    _bindDataAction(el,admACon);
  });
  document.querySelectorAll('[data-action="admASl"]').forEach(function(el){
    _bindDataAction(el,admASl);
  });
  document.querySelectorAll('[data-action="intBkPv"]').forEach(function(el){
    _bindDataAction(el,intBkPv);
  });
  document.querySelectorAll('[data-action="intBkNx"]').forEach(function(el){
    _bindDataAction(el,intBkNx);
  });
  var ancSp=document.getElementById('anc-sp');
  if(ancSp&&!ancSp.dataset.boundAction){ancSp.dataset.boundAction='1';ancSp.addEventListener('change',ancSpToggle);}
  var ancDur=document.getElementById('anc-dur');
  if(ancDur&&!ancDur.dataset.boundAction){ancDur.dataset.boundAction='1';ancDur.addEventListener('change',ancDurToggle);}
  var ansDu=document.getElementById('ans-du');
  if(ansDu&&!ansDu.dataset.boundAction){ansDu.dataset.boundAction='1';ansDu.addEventListener('change',ansDuToggle);}
}

// Init on page load
window.addEventListener('load',function(){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  var lnc=document.getElementById('int-launcher');
  if(lnc)lnc.style.display='flex';
  _bindIntegrationHtml();
  _bindAdminLiveRefresh();
  ['adm-con-modal','adm-slot-modal'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('click',function(e){
      if(e.target===el){
        el.style.display='none';
        el.classList.add('is-hidden');
      }
    });
  });
});