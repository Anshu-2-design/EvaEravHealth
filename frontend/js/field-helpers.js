/* Field Helpers & Step Content Builders */

function _stepHTML(id, setup) {
  var frag = cloneTemplate(id);
  if (!frag) return '';
  var wrap = document.createElement('div');
  while (frag.firstChild) wrap.appendChild(frag.firstChild);
  if (setup) setup(wrap);
  return wrap.innerHTML;
}

function _appendCardOpts(host, options, key, selectedVal, withDesc) {
  if (!host) return;
  options.forEach(function(opt) {
    var frag = cloneTemplate('tpl-card-opt');
    if (!frag || !frag.firstElementChild) return;
    var el = frag.firstElementChild;
    var val = Array.isArray(opt) ? (withDesc ? opt[1] : opt[0]) : opt;
    var label = Array.isArray(opt) ? (withDesc ? opt[1] : (opt[1] || opt[0])) : opt;
    var icon = Array.isArray(opt) && opt.length > 2 ? opt[0] : '';
    var text = Array.isArray(opt) ? (withDesc ? opt[1] : (opt[1] || opt[0])) : opt;
    if (withDesc && Array.isArray(opt)) {
      fillTemplate(el, { icon: opt[0], label: opt[1], desc: opt[2] || '' });
      var desc = el.querySelector('.card-desc');
      if (desc && !opt[2]) desc.style.display = 'none';
    } else {
      fillTemplate(el, { label: text, icon: '', desc: '' });
      var ic = el.querySelector('.card-icon');
      if (ic && !icon) ic.style.display = 'none';
    }
    if (selectedVal === val || selectedVal === text) el.classList.add('selected');
    el.dataset.ansKey = key;
    el.dataset.ansVal = val;
    host.appendChild(el);
  });
}

function _appendLikertItem(host, qKey, question, a, min, max, labels) {
  var itemFrag = cloneTemplate('tpl-likert-item');
  if (!itemFrag || !itemFrag.firstElementChild) return;
  var item = itemFrag.firstElementChild;
  fillTemplate(item, { question: question, labelMin: labels ? labels[0] : 'Not at all', labelMax: labels ? labels[1] : 'Extremely' });
  var scale = item.querySelector('[data-list="buttons"]');
  if (!scale) return;
  for (var v = min; v <= max; v++) {
    var bFrag = cloneTemplate('tpl-likert-btn');
    if (!bFrag || !bFrag.firstElementChild) continue;
    var btn = bFrag.firstElementChild;
    btn.textContent = v;
    btn.dataset.ansKey = qKey;
    btn.dataset.ansVal = String(v);
    if (a[qKey] === v) btn.classList.add('selected');
    scale.appendChild(btn);
  }
  host.appendChild(item);
}

function _appendSectionLabel(host, text, modClass) {
  var frag = cloneTemplate('tpl-section-label');
  if (!frag || !frag.firstElementChild) return;
  var el = frag.firstElementChild;
  fillTemplate(el, { text: text });
  if (modClass) el.classList.add(modClass);
  host.appendChild(el);
}

function _appendStepHint(host, text) {
  var frag = cloneTemplate('tpl-step-hint');
  if (!frag || !frag.firstElementChild) return;
  fillTemplate(frag.firstElementChild, { text: text });
  host.appendChild(frag.firstElementChild);
}

function _mountTpl(host, tplId, setup) {
  var frag = cloneTemplate(tplId);
  if (!frag || !frag.firstElementChild) return null;
  var el = frag.firstElementChild;
  if (setup) setup(el);
  host.appendChild(el);
  return el;
}

function _initRadioOpt(oEl, qKey, val, a) {
  oEl.dataset.ansKey = qKey;
  oEl.dataset.ansVal = String(val);
  var inp = oEl.querySelector('input[type="radio"]');
  if (inp) {
    inp.name = qKey;
    inp.checked = a[qKey] === val;
  }
  if (a[qKey] === val) oEl.classList.add('selected');
}

function _appendRadioItem(host, qKey, question, options, a, qHtml) {
  var itemFrag = cloneTemplate('tpl-radio-item');
  if (!itemFrag || !itemFrag.firstElementChild) return;
  var item = itemFrag.firstElementChild;
  var qEl = item.querySelector('.likert-q');
  if (qHtml && qEl) qEl.innerHTML = qHtml;
  else fillTemplate(item, { question: question });
  var optsHost = item.querySelector('[data-list="options"]');
  options.forEach(function(opt, v) {
    var oFrag = cloneTemplate('tpl-radio-opt');
    if (!oFrag || !oFrag.firstElementChild) return;
    var oEl = oFrag.firstElementChild;
    fillTemplate(oEl, { label: opt });
    _initRadioOpt(oEl, qKey, v, a);
    optsHost.appendChild(oEl);
  });
  host.appendChild(item);
}

function _appendLikertRange(host, qKey, question, a, min, max, labelMin, labelMax, titleFn) {
  var itemFrag = cloneTemplate('tpl-likert-item');
  if (!itemFrag || !itemFrag.firstElementChild) return;
  var item = itemFrag.firstElementChild;
  var qEl = item.querySelector('.likert-q');
  if (typeof question === 'string' && qEl) qEl.innerHTML = question;
  else fillTemplate(item, { question: question, labelMin: labelMin || 'Never', labelMax: labelMax || 'Always' });
  if (labelMin || labelMax) fillTemplate(item, { labelMin: labelMin || 'Never', labelMax: labelMax || 'Always' });
  var scale = item.querySelector('[data-list="buttons"]');
  for (var v = min; v <= max; v++) {
    var bFrag = cloneTemplate('tpl-likert-btn');
    if (!bFrag || !bFrag.firstElementChild) continue;
    var btn = bFrag.firstElementChild;
    btn.textContent = v;
    if (titleFn) btn.title = titleFn(v);
    btn.dataset.ansKey = qKey;
    btn.dataset.ansVal = String(v);
    if (a[qKey] === v) btn.classList.add('selected');
    scale.appendChild(btn);
  }
  host.appendChild(item);
}

function _appendPsychProgress(host, page, total) {
  _mountTpl(host, 'tpl-psych-progress', function(el) {
    fillTemplate(el, { pageLabel: 'Page ' + page + ' of ' + total });
    var bars = el.querySelector('[data-list="bars"]');
    for (var i = 1; i <= total; i++) {
      var bFrag = cloneTemplate('tpl-psych-progress-bar');
      if (!bFrag || !bFrag.firstElementChild) continue;
      var bar = bFrag.firstElementChild;
      if (i <= page) bar.classList.add('is-done');
      bars.appendChild(bar);
    }
  });
}

function _appendFsfiItems(host, items, startNum, a) {
  items.forEach(function(q, idx) {
    var n = startNum + idx;
    _appendLikertRange(host, 'fsfi_' + n, n + '. ' + q, a, 0, 5, 'Never', 'Always');
  });
}

function _comorBorderClass(val) {
  if (!val || val === 'No') return 'comor-row--no';
  if (val === 'Controlled') return 'comor-row--ctrl';
  if (val === 'Uncontrolled') return 'comor-row--unctrl';
  return 'comor-row--unsure';
}

function _bindFieldActions(root) {
  if (!root) return;
  root.querySelectorAll('[data-action="setAnsInput"]').forEach(function(el) {
    var k = el.getAttribute('data-field');
    if (k && S.answers[k]) el.value = S.answers[k];
    el.addEventListener('input', function() { setAns(k, el.value); });
  });
  root.querySelectorAll('[data-action="setAnsNumInput"]').forEach(function(el) {
    var k = el.getAttribute('data-field');
    if (k && S.answers[k]) el.value = S.answers[k];
    el.addEventListener('input', function() { setAnsNum(k, el.value); });
  });
  root.querySelectorAll('[data-action="setAnsNumBmi"]').forEach(function(el) {
    var k = el.getAttribute('data-field');
    if (k && S.answers[k]) el.value = S.answers[k];
    el.addEventListener('input', function() { setAnsNum(k, el.value); calcBMI(); });
  });
  root.querySelectorAll('[data-action="setAnsSelect"]').forEach(function(el) {
    var k = el.getAttribute('data-field');
    if (k === 'country') {
      ['India','UAE','UK','USA','Canada','Australia','Singapore','Nepal','Bangladesh','Sri Lanka','Other'].forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (S.answers.country === opt) o.selected = true;
        el.appendChild(o);
      });
    }
    el.addEventListener('change', function() { setAns(k, el.value); });
  });
  root.querySelectorAll('[data-action="toggleCard"]').forEach(function(el) {
    el.addEventListener('click', function() { toggleCard(el.dataset.ansKey, el.dataset.ansVal, el); });
  });
  root.querySelectorAll('[data-action="setLikert"]').forEach(function(el) {
    el.addEventListener('click', function() { setLikert(el.dataset.ansKey, +el.dataset.ansVal, el); });
  });
  root.querySelectorAll('[data-action="setRadio"]').forEach(function(el) {
    el.addEventListener('click', function() { setRadio(el.dataset.ansKey, +el.dataset.ansVal, el); });
  });
  root.querySelectorAll('[data-action="selectVikriti"]').forEach(function(el) {
    el.addEventListener('click', function() {
      setAns('vikriti', el.dataset.ansVal);
      el.closest('.vikriti-grid').querySelectorAll('.vikriti-card').forEach(function(c) { c.classList.remove('selected'); });
      el.classList.add('selected');
    });
  });
  root.querySelectorAll('[data-action="selectWearable"]').forEach(function(el) {
    el.addEventListener('click', function() {
      setAns('wearable', el.dataset.ansVal);
      toggleWearableInputs(el.dataset.ansVal);
      el.parentElement.querySelectorAll('.device-chip').forEach(function(c) { c.classList.remove('selected'); });
      el.classList.add('selected');
    });
  });
  root.querySelectorAll('[data-action="setWFldInput"]').forEach(function(el) {
    var k = el.getAttribute('data-field');
    if (k && S.answers.wearable_data && S.answers.wearable_data[k]) el.value = S.answers.wearable_data[k];
    el.addEventListener('input', function() { setWFld(k, el.value); });
  });
  root.querySelectorAll('[data-action="setComordiity"]').forEach(function(el) {
    el.addEventListener('click', function() {
      setComordiity(el.dataset.condName, el.dataset.condVal, el);
    });
  });
  root.querySelectorAll('[data-action="setSexualActivityStatus"]').forEach(function(el) {
    el.addEventListener('click', function() {
      setSexualActivityStatus(el.dataset.ansVal, el);
    });
  });
  root.querySelectorAll('[data-action="toggleMed"]').forEach(function(el) {
    el.addEventListener('click', function() { toggleMed(el.dataset.ansKey, el); });
  });
  root.querySelectorAll('[data-action="toggleFamHx"]').forEach(function(el) {
    el.addEventListener('click', function() { toggleFamHx(el.dataset.ansKey, el); });
  });
  root.querySelectorAll('[data-action="gateChoiceYes"]').forEach(function(el) {
    el.addEventListener('click', function() { gateChoice(el.dataset.gateId, 'yes'); });
  });
  root.querySelectorAll('[data-action="gateChoiceNo"]').forEach(function(el) {
    el.addEventListener('click', function() { gateChoice(el.dataset.gateId, 'no'); });
  });
}

function computeMenQOLDomain(keys, maxRaw){
  var n=keys.length;
  var total=keys.reduce(function(s,k){return s+(S.answers[k]||1);},0);
  return Math.round((total-n)/(maxRaw-n)*20);
}
function setAns(key,val){S.answers[key]=val;}
function setAnsNum(key,val){S.answers[key]=parseFloat(val)||0;}
function toggleCard(key,val,el){
  S.answers[key]=val;
  var parent=el.parentElement;
  parent.querySelectorAll('.card-opt').forEach(function(c){c.classList.remove('selected');});
  el.classList.add('selected');
}
function toggleChip(key,val,el){
  S.answers[key]=val;
  el.closest('.device-chips').querySelectorAll('.device-chip').forEach(function(c){c.classList.remove('selected');});
  el.classList.add('selected');
}
function setLikert(key,val,btn){
  S.answers[key]=val;
  btn.closest('.likert-scale').querySelectorAll('.likert-btn').forEach(function(b){b.classList.remove('selected');});
  btn.classList.add('selected');
}
function setRadio(key,val,opt){
  S.answers[key]=val;
  var group = opt.closest('.radio-group');
  if (!group) return;
  group.querySelectorAll('.radio-opt').forEach(function(o){
    o.classList.remove('selected');
    var inp = o.querySelector('input[type="radio"]');
    if (inp) inp.checked = false;
  });
  opt.classList.add('selected');
  var selInp = opt.querySelector('input[type="radio"]');
  if (selInp) selInp.checked = true;
}
function calcBMI(){
  var h=parseFloat(S.answers.height_cm)||0;
  var w=parseFloat(S.answers.weight_kg)||0;
  if(h>0&&w>0){
    var bmi=w/((h/100)*(h/100));
    S.answers.bmi=bmi;
    var d=document.getElementById('bmi-display');
    if(d){d.style.display='block';d.textContent='BMI: '+bmi.toFixed(1)+' kg/m²  ('+(bmi<18.5?'Underweight':bmi<23?'Normal':bmi<27.5?'Overweight':'Obese')+')';}
  }
}
function setComor(cond,val,el){
  if(!S.answers.comorbidities)S.answers.comorbidities={};
  S.answers.comorbidities[cond]=val;
  el.closest('.comor-row').querySelectorAll('.comor-opt').forEach(function(o){
    o.classList.remove('sel-no','sel-ctrl','sel-unctrl');
  });
  el.classList.add(val==='No'?'sel-no':val==='Controlled'?'sel-ctrl':'sel-unctrl');
}
function setWD(key,val){
  if(!S.answers.wearable_data)S.answers.wearable_data={};
  S.answers.wearable_data[key]=parseFloat(val)||val;
}
function buildStepContent(id){
  var a=S.answers;
  if(id==='demographics')      return buildDemographics(a);
  if(id==='red_flags')         return buildRedFlags(a);
  if(id==='menqol_vasomotor')  return buildMenQOLVasomotor(a);
  if(id==='menqol_physical')   return buildMenQOLPhysical(a);
  if(id==='menqol_psychosocial') return buildMenQOLPsychosocial(a);
  if(id==='gate_psych')        return buildGatePsych(a);
  if(id==='mental_health')     return buildMentalHealth(a);
  if(id==='menqol_sexual')     return buildMenQOLSexual(a);
  if(id==='gate_sexual')       return buildGateSexual(a);
  if(id==='sleep')             return buildSleep(a);
  if(id==='gate_sleep')        return buildGateSleep(a);
  if(id==='psychosexual_1')    return buildPsychosexual1(a);
  if(id==='psychosexual_2')    return buildPsychosexual2(a);
  if(id==='psychosexual_3')    return buildPsychosexual3(a);
  if(id==='prakriti')          return buildPrakriti(a);
  if(id==='vikriti')           return buildVikriti(a);
  if(id==='wearable_data')     return buildWearableData(a);
  if(id==='comorbidities')     return buildComorbidities(a);
  // MOVED: tpl-step-loading
  return _stepHTML('tpl-step-loading');
}
function buildDemographics(a){
  // MOVED: tpl-step-demographics
  return _stepHTML('tpl-step-demographics', function(root) {
    root.querySelectorAll('[data-field]').forEach(function(el) {
      var k = el.getAttribute('data-field');
      if (a[k] !== undefined && a[k] !== '') el.value = a[k];
    });
    _appendCardOpts(root.querySelector('[data-list="ethnicity"]'),
      ['South Asian','East Asian','Southeast Asian','Middle Eastern','African / Afro-Caribbean','Caucasian / White European','Mixed / Multi-ethnic','Prefer not to say'],
      'ethnicity', a.ethnicity, false);
    _appendCardOpts(root.querySelector('[data-list="stage"]'),
      [['🟢','Normal Cycle'],['🔴','Perimenopause'],['🌸','Menopause (<1yr)'],['🌺','Post-Menopause'],['🌙','Surgical Menopause']],
      'stage', a.stage, true);
    _appendCardOpts(root.querySelector('[data-list="marital"]'),
      ['Married','Partner','Single','Separated/Divorced','Widowed','Prefer not to say'], 'marital', a.marital, false);
    _appendCardOpts(root.querySelector('[data-list="education"]'),
      ['Up to 12th','Graduate','Post-Graduate','Doctorate','Prefer not to say'], 'education', a.education, false);
    _appendCardOpts(root.querySelector('[data-list="smoking"]'),
      ['Never smoked','Ex-smoker (quit >1 year ago)','Ex-smoker (quit <1 year ago)','Current smoker','Prefer not to say'], 'smoking_history', a.smoking_history, false);
    _appendCardOpts(root.querySelector('[data-list="alcohol"]'),
      ['Non-drinker','Occasional (≤1 drink/week)','Moderate (2–7 drinks/week)','Heavy (>7 drinks/week)','Prefer not to say'], 'alcohol_use', a.alcohol_use, false);
    var famHx=[
      {k:'fam_breast_cancer',l:'Breast cancer'},{k:'fam_ovarian_cancer',l:'Ovarian cancer'},
      {k:'fam_osteoporosis',l:'Osteoporosis / Fractures'},{k:'fam_cvd',l:'Heart disease / Stroke'},
      {k:'fam_diabetes',l:'Type 2 Diabetes'},{k:'fam_depression',l:'Depression / Anxiety'},
      {k:'fam_early_menopause',l:'Early menopause (<45y)'},{k:'fam_none',l:'None of the above'}
    ];
    var famHost = root.querySelector('[data-list="famHx"]');
    famHx.forEach(function(f) {
      var frag = cloneTemplate('tpl-card-opt');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      el.textContent = f.l;
      el.style.fontSize = '12px';
      el.classList.add('card-opt--fam-sm');
      if (a[f.k]) el.classList.add('selected');
      el.dataset.ansKey = f.k;
      el.dataset.ansVal = f.k;
      el.dataset.action = 'toggleFamHx';
      el.addEventListener('click', function() { toggleFamHx(f.k, el); });
      famHost.appendChild(el);
    });
    _appendCardOpts(root.querySelector('[data-list="hrt"]'),
      ['Never used HRT','Currently using HRT','Used HRT in the past','Considering HRT','Not Sure / Prefer not to say'], 'hrt_history', a.hrt_history, false);
    _appendCardOpts(root.querySelector('[data-list="parity"]'),
      ['0 (Nulliparous)','1','2','3','4 or more','Prefer not to say'], 'parity', a.parity, false);
    var bmiEl = root.querySelector('#bmi-display');
    if (bmiEl && a.bmi) { bmiEl.textContent = 'BMI: ' + a.bmi.toFixed(1) + ' kg/m²'; bmiEl.style.display = 'block'; }
  });
}
function buildRedFlags(a){
  // MOVED: tpl-step-red-flags + tpl-rf-question + tpl-radio-opt
  return _stepHTML('tpl-step-red-flags', function(root) {
    var qs=[
      {key:'rf1',q:'In the past 6 months, have you had any unusual vaginal bleeding (not your normal period)?',opts:['No','Yes','Not sure']},
      {key:'rf2',q:'Do you experience persistent pelvic pain (not related to your period)?',opts:['No','Occasionally','Frequently']},
      {key:'rf3',q:'Have you noticed any new breast lumps, nipple discharge, or skin changes on your breast?',opts:['No','Yes']},
    ];
    var host = root.querySelector('[data-list="questions"]');
    qs.forEach(function(q) {
      var qFrag = cloneTemplate('tpl-rf-question');
      if (!qFrag || !qFrag.firstElementChild) return;
      var qEl = qFrag.firstElementChild;
      fillTemplate(qEl, { question: q.q });
      var optsHost = qEl.querySelector('[data-list="options"]');
      q.opts.forEach(function(opt, i) {
        var oFrag = cloneTemplate('tpl-radio-opt');
        if (!oFrag || !oFrag.firstElementChild) return;
        var oEl = oFrag.firstElementChild;
        fillTemplate(oEl, { label: opt });
        _initRadioOpt(oEl, q.key, i, a);
        optsHost.appendChild(oEl);
      });
      host.appendChild(qEl);
    });
  });
}
function buildMenQOLVasomotor(a){
  var qs=[
    {k:'mq_v1',q:'Hot flushes (sudden feeling of heat spreading over your body)'},
    {k:'mq_v2',q:'Night sweats (sweating that wakes you at night)'},
    {k:'mq_v3',q:'Sweating during the day'},
    {k:'mq_v4',q:'Feeling cold or chilly despite normal temperature'},
    {k:'mq_v5',q:'Heart pounding or racing (palpitations)'},
    {k:'mq_v6',q:'Feeling flushed or red in the face'},
  ];
  return buildMenQOLItems(qs,a);
}
function buildMenQOLPhysical(a){
  var qs=[
    {k:'mq_p1',q:'Feeling tired or lacking energy'},
    {k:'mq_p2',q:'Difficulty sleeping / waking in the night (not due to sweating)'},
    {k:'mq_p3',q:'Aches and pains in joints or muscles'},
    {k:'mq_p4',q:'Changes in skin — dryness, itching, or ageing faster'},
    {k:'mq_p5',q:'Weight gain'},
    {k:'mq_p6',q:'Frequent headaches'},
    {k:'mq_p7',q:'Hair thinning or increased hair loss'},
    {k:'mq_p8',q:'Changes in physical appearance bothering you'},
  ];
  return buildMenQOLItems(qs,a);
}
function buildMenQOLPsychosocial(a){
  var html='';
  var psKeys=['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'];
  var filled=psKeys.filter(function(k){return a[k]!==undefined;}).length;
  if(filled>0){
    var score=computeMenQOLDomain(psKeys,56);
    var band=score<8?'Low':score<14?'Moderate':'High';
    var color=score<8?'var(--ok)':score<14?'var(--warn)':'var(--danger)';
    // MOVED: tpl-menqol-domain-score
    html+=_stepHTML('tpl-menqol-domain-score', function(el) {
      fillTemplate(el, { scoreText: score + '/20 (' + band + ')' });
      var bar = el.querySelector('[data-fill="barStyle"]');
      if (bar) { bar.style.width = (score/20*100) + '%'; bar.style.background = color; }
    });
  }
  var qs=[
    {k:'mq_ps1',q:'Feeling anxious or nervous'},
    {k:'mq_ps2',q:'Loss of interest in most things you used to enjoy'},
    {k:'mq_ps3',q:'Feeling depressed or sad'},
    {k:'mq_ps4',q:'Being impatient with others or quick-tempered'},
    {k:'mq_ps5',q:'Feeling overwhelmed'},
    {k:'mq_ps6',q:'Difficulty concentrating or feeling foggy / forgetful'},
    {k:'mq_ps7',q:'Feeling less motivated or not wanting to do anything'},
  ];
  return html+buildMenQOLItems(qs,a);
}
function buildMenQOLSexual(a){
  // MOVED: tpl-menqol-privacy
  var html=_stepHTML('tpl-menqol-privacy');
  var qs=[
    {k:'mq_s1',q:'Changes in or lack of sexual desire / interest'},
    {k:'mq_s2',q:'Vaginal dryness, discomfort, or pain during intimacy'},
    {k:'mq_s3',q:'Avoiding intimacy (due to discomfort or loss of interest)'},
  ];
  return html+buildMenQOLItems(qs,a);
}
function buildMenQOLItems(qs,a){
  return _stepHTML('tpl-step-menqol', function(root) {
    var host = listHost(root, 'items');
    if (!host) return;
    qs.forEach(function(q) { _appendLikertItem(host, q.k, q.q, a, 1, 8, ['Not at all', 'Extremely']); });
  });
}
function buildGatePsych(a){
  var score=S.answers._menqol_ps_score||0;
  var band=score<8?'Low':score<14?'Moderate':'High';
  var color=score<8?'ok':score<14?'moderate':'severe';
  // MOVED: tpl-step-gate
  return _stepHTML('tpl-step-gate', function(root) {
    fillTemplate(root, {
      icon: '🧠',
      desc: 'Your psychosocial domain score suggests ' + (band==='Low'?'mild emotional changes — common in perimenopause.':band==='Moderate'?'some emotional difficulties that may benefit from a detailed mental health check-in.':'significant emotional challenges that strongly benefit from a mental health assessment.'),
      question: 'Would you like to complete a detailed mental health assessment? (PHQ-9 · GAD-7 · PSS-8 — takes ~4 minutes)',
      footnote: 'You can complete this section later with your clinician'
    });
    var badge = root.querySelector('[data-fill="badgeClass"]');
    if (badge) { badge.className = 'gate-score-badge ' + color; badge.textContent = 'Emotional Wellbeing: ' + band + ' (' + score + '/20)'; }
    root.querySelector('.gate-btn-yes').textContent = 'Yes, continue';
    root.querySelector('.gate-btn-no').textContent = 'Skip for now';
    root.querySelectorAll('[data-action="gateChoiceYes"]').forEach(function(b){ b.dataset.gateId='gate_psych'; });
    root.querySelectorAll('[data-action="gateChoiceNo"]').forEach(function(b){ b.dataset.gateId='gate_psych'; });
  });
}
function buildGateSexual(a){
  var score=S.answers._menqol_sx_score||0;
  var band=score<8?'Low':score<14?'Moderate':'High';
  var color=score<8?'ok':score<14?'moderate':'severe';
  return _stepHTML('tpl-step-gate', function(root) {
    fillTemplate(root, { icon: '💜', desc: 'Your intimate wellbeing score indicates ' + (band==='Low'?'mild changes — often addressed through lifestyle and Ayurvedic support.':band==='Moderate'?'some challenges that may benefit from a detailed sexual health assessment.':'significant concerns that strongly benefit from specialised sexual health support.'), question: 'Would you like to complete a detailed sexual wellbeing assessment?\n(FSFI · FSDSR · Relationship — takes ~5 minutes)', footnote: 'All responses are confidential — DPDP Act 2023' });
    var badge = root.querySelector('[data-fill="badgeClass"]');
    if (badge) { badge.className = 'gate-score-badge ' + color; badge.textContent = 'Sexual Wellbeing: ' + band + ' (' + score + '/20)'; }
    root.querySelector('.gate-btn-yes').textContent = 'Yes, continue';
    root.querySelectorAll('[data-action="gateChoiceYes"]').forEach(function(b){ b.dataset.gateId='gate_sexual'; });
    root.querySelectorAll('[data-action="gateChoiceNo"]').forEach(function(b){ b.dataset.gateId='gate_sexual'; });
  });
}
function buildGateSleep(a){
  var isi=S.answers._isi_score||0;
  var band=isi<8?'No Clinically Significant Insomnia':isi<15?'Subthreshold Insomnia':'Moderate–Severe Insomnia';
  var color=isi<8?'ok':isi<15?'moderate':'severe';
  return _stepHTML('tpl-step-gate', function(root) {
    fillTemplate(root, { icon: '🌙', desc: (band==='Subthreshold Insomnia'?'Your sleep score suggests subthreshold insomnia — early sleep support can prevent this from worsening.':'Your sleep score indicates severe insomnia. A structured sleep recovery programme is strongly recommended.'), question: 'Would you like a personalised sleep recovery programme included in your care plan?', footnote: '' });
    var badge = root.querySelector('[data-fill="badgeClass"]');
    if (badge) { badge.className = 'gate-score-badge ' + color; badge.textContent = 'Sleep Difficulty: ' + band + ' (ISI ' + isi + '/28)'; }
    root.querySelector('.gate-btn-yes').textContent = 'Yes, include it';
    root.querySelector('.gate-btn-no').textContent = 'Continue without';
    root.querySelectorAll('[data-action="gateChoiceYes"]').forEach(function(b){ b.dataset.gateId='gate_sleep'; });
    root.querySelectorAll('[data-action="gateChoiceNo"]').forEach(function(b){ b.dataset.gateId='gate_sleep'; });
    var fn = root.querySelector('.gate-footnote');
    if (fn && !fn.textContent) fn.style.display = 'none';
  });
}
function buildMentalHealth(a){
  // MOVED: tpl-step-mental-health + tpl-section-label + tpl-radio-item + tpl-pss-intro
  return _stepHTML('tpl-step-mental-health', function(root) {
    var host = listHost(root, 'sections');
    if (!host) return;
    var phqQs=['Little interest or pleasure in doing things','Feeling down, depressed, or hopeless','Trouble falling or staying asleep, or sleeping too much','Feeling tired or having little energy','Poor appetite or overeating','Feeling bad about yourself — or that you are a failure','Trouble concentrating on things','Moving or speaking so slowly that other people could have noticed, or being fidgety/restless','Thoughts that you would be better off dead, or of hurting yourself'];
    var phqOpts=['Not at all','Several days','More than half the days','Nearly every day'];
    _appendSectionLabel(host, 'PHQ-9 — Depression Screen');
    phqQs.forEach(function(q, i) {
      var qHtml = (i + 1) + '. ' + q + (i === 8 ? ' <strong class="q-emphasis-danger">[Important — please answer carefully]</strong>' : '');
      _appendRadioItem(host, 'phq_' + i, '', phqOpts, a, qHtml);
    });
    _appendSectionLabel(host, 'GAD-7 — Anxiety Screen', 'section-label--spaced');
    var gadQs=['Feeling nervous, anxious, or on edge','Not being able to stop or control worrying','Worrying too much about different things','Trouble relaxing','Being so restless that it is hard to sit still','Becoming easily annoyed or irritable','Feeling afraid, as if something awful might happen'];
    gadQs.forEach(function(q, i) {
      _appendRadioItem(host, 'gad_' + i, (i + 1) + '. ' + q, phqOpts, a);
    });
    _appendSectionLabel(host, 'PSS-8 — Perceived Stress', 'section-label--spaced');
    _mountTpl(host, 'tpl-pss-intro');
    var pssQs=['Upset because of something that happened unexpectedly','Unable to control important things in your life','Nervous and stressed','Confident about your ability to handle personal problems','Felt that things were going your way','Unable to cope with all the things you had to do','Able to control irritations in your life','Felt that you were on top of things'];
    var pssOpts=['Never','Almost Never','Sometimes','Fairly Often','Very Often'];
    var pssRev=[false,false,false,true,true,false,true,true];
    pssQs.forEach(function(q, i) {
      var qText = (i + 1) + '. ' + q + (pssRev[i] ? ' <span class="q-reverse-tag">(reverse)</span>' : '');
      _appendLikertRange(host, 'pss_' + i, qText, a, 0, 4, 'Never', 'Very Often', function(v) { return pssOpts[v]; });
    });
  });
}
function buildSleep(a){
  // MOVED: tpl-step-sleep + tpl-likert-item
  return _stepHTML('tpl-step-sleep', function(root) {
    var host = listHost(root, 'items');
    if (!host) return;
    var qs=[
      {k:'isi_0',q:'Difficulty falling asleep',labels:['None','Mild','Moderate','Severe','Very Severe']},
      {k:'isi_1',q:'Difficulty staying asleep or waking in the middle of the night',labels:['None','Mild','Moderate','Severe','Very Severe']},
      {k:'isi_2',q:'Early morning awakening',labels:['None','Mild','Moderate','Severe','Very Severe']},
      {k:'isi_3',q:'How satisfied / dissatisfied are you with your current sleep pattern?',labels:['Very Satisfied','Satisfied','Neutral','Dissatisfied','Very Dissatisfied']},
      {k:'isi_4',q:'How noticeable to others do you think your sleep problem is in terms of impairing quality of life?',labels:['Not at all','A little','Somewhat','Much','Very Much']},
      {k:'isi_5',q:'How worried / distressed are you about your current sleep problem?',labels:['Not at all','A little','Somewhat','Much','Very Much']},
      {k:'isi_6',q:'To what extent do you consider your sleep problem to interfere with your daily functioning?',labels:['Not at all','A little','Somewhat','Much','Very Much']},
    ];
    qs.forEach(function(q) {
      _appendLikertRange(host, q.k, q.q, a, 0, 4, q.labels[0], q.labels[4], function(v) { return q.labels[v]; });
    });
  });
}
function buildPsychosexual1(a){
  // MOVED: tpl-step-psychosexual-1 + psych templates
  return _stepHTML('tpl-step-psychosexual-1', function(root) {
    var host = listHost(root, 'content');
    if (!host) return;
    _appendPsychProgress(host, 1, 3);
    _mountTpl(host, 'tpl-psych-privacy');
    _mountTpl(host, 'tpl-psych-activity-panel', function(panel) {
      var optsHost = panel.querySelector('[data-list="options"]');
      [['sexually_active','Sexually active','Currently engaging in or interested in sexual activity'],['not_active_by_choice','Not active — by choice','Choosing not to be sexually active'],['not_active_health','Not active — health reason','Due to health, pain, or physical reason'],['prefer_not_say','Prefer not to say','Answer without indicating status']].forEach(function(opt) {
        var frag = cloneTemplate('tpl-psych-activity-opt');
        if (!frag || !frag.firstElementChild) return;
        var el = frag.firstElementChild;
        fillTemplate(el, { title: opt[1], desc: opt[2] });
        el.dataset.ansVal = opt[0];
        if (a.sexual_activity_status === opt[0]) el.classList.add('selected');
        optsHost.appendChild(el);
      });
    });
    _mountTpl(host, 'tpl-psych-rating-hint', function(el) {
      fillTemplate(el, { label: 'Rating scale:', text: '0 = No sexual activity / Did not apply · 1 = Almost never · 3 = Sometimes · 5 = Almost always' });
    });
    _appendSectionLabel(host, '💕 Desire (Items 1–2)');
    _appendStepHint(host, 'Sexual desire includes wanting to have sex, thinking about sex, or feeling frustrated due to lack of sex.');
    _appendFsfiItems(host, ['How often did you feel sexual desire or interest?','How would you rate your level of sexual desire or interest?'], 1, a);
    _appendSectionLabel(host, '🌊 Arousal (Items 3–6)', 'section-label--spaced-sm');
    _appendStepHint(host, 'Sexual arousal is a feeling that includes warmth or tingling in the genitals, lubrication (wetness), or muscle contractions.');
    _appendFsfiItems(host, ['How often did you feel sexually aroused during sexual activity?','How would you rate your level of sexual arousal during sexual activity?','How confident were you about becoming sexually aroused?','How often were you satisfied with your arousal during sexual activity?'], 3, a);
  });
}
function buildPsychosexual2(a){
  // MOVED: tpl-step-psychosexual-2
  return _stepHTML('tpl-step-psychosexual-2', function(root) {
    var host = listHost(root, 'content');
    if (!host) return;
    _appendPsychProgress(host, 2, 3);
    _mountTpl(host, 'tpl-psych-rating-hint', function(el) {
      fillTemplate(el, { label: 'Rating:', text: '0 = No sexual activity · 1 = Almost never · 3 = Sometimes · 5 = Almost always' });
    });
    _appendSectionLabel(host, '💧 Lubrication (Items 7–10)');
    _appendStepHint(host, 'Lubrication refers to vaginal wetness or moisture during sexual activity.');
    _appendFsfiItems(host, ['How often did you become lubricated (wet) during sexual activity?','How difficult was it to become lubricated (wet) during sexual activity?','How often did you maintain your lubrication until completion?','How difficult was it to maintain your lubrication to completion?'], 7, a);
    _appendSectionLabel(host, '✨ Orgasm (Items 11–13)', 'section-label--spaced-sm');
    _appendStepHint(host, 'Orgasm is the release of tension that builds during sexual stimulation.');
    _appendFsfiItems(host, ['How often did you reach orgasm?','How difficult was it to reach orgasm during sexual stimulation or intercourse?','How satisfied were you with your ability to reach orgasm?'], 11, a);
    _appendSectionLabel(host, '🌸 Satisfaction (Items 14–16)', 'section-label--spaced-sm');
    _appendStepHint(host, 'Satisfaction includes emotional closeness, relationship quality, and your overall sexual experience.');
    var sat=['How satisfied have you been with the emotional closeness during sex?','How satisfied have you been with your sexual relationship with your partner?','How satisfied have you been with your overall sex life?'];
    sat.forEach(function(q, idx) {
      var n = idx + 14;
      _appendLikertRange(host, 'fsfi_' + n, n + '. ' + q, a, 0, 5, 'Not satisfied', 'Very satisfied');
    });
  });
}
function buildPsychosexual3(a){
  // MOVED: tpl-step-psychosexual-3
  return _stepHTML('tpl-step-psychosexual-3', function(root) {
    var host = listHost(root, 'content');
    if (!host) return;
    _appendPsychProgress(host, 3, 3);
    _mountTpl(host, 'tpl-psych-rating-hint', function(el) {
      fillTemplate(el, { label: 'Rating:', text: '0 = No sexual activity · 1 = Almost never · 3 = Sometimes · 5 = Almost always' });
    });
    _appendSectionLabel(host, '🩹 Pain & Discomfort (Items 17–19)');
    _appendStepHint(host, 'These questions ask about any discomfort or pain during or after sexual activity. Select 0 if you had no sexual activity.');
    var pain=['How often did you experience discomfort or pain during vaginal penetration?','How often did you experience discomfort or pain following vaginal penetration?','How would you rate your level of discomfort or pain during or following vaginal penetration?'];
    pain.forEach(function(q, idx) {
      var n = idx + 17;
      _appendLikertRange(host, 'fsfi_' + n, n + '. ' + q, a, 0, 5, 'Never / No pain', 'Always / Severe');
    });
    _appendSectionLabel(host, '😔 Sexual Distress — FSDSR', 'section-label--spaced-lg');
    _appendStepHint(host, 'How much has each of the following distressed or bothered you in the past 30 days? 0 = Not at all · 4 = Extremely');
    var fds=['Distressed about your sex life','Unhappy about your sexual relationship','Dissatisfied with your sex life','Unhappy about how often you have sex','Worried that your sexual desire is too low','Experiencing a problem with sexual desire','Self-conscious about your sexuality','Frustrated about your sex life','Bothered by how often you are interested in sex','Difficulty being sexually aroused','Difficulty reaching orgasm','Feel your body does not respond to sexual stimulation','Pain during sexual intercourse'];
    fds.forEach(function(q, i) {
      _appendLikertRange(host, 'fsdsr_' + i, (i + 1) + '. ' + q, a, 0, 4, 'Not at all', 'Extremely');
    });
    _appendSectionLabel(host, '💑 Relationship Wellbeing', 'section-label--spaced-lg');
    _mountTpl(host, 'tpl-psych-research-note');
    _appendStepHint(host, '0 = Not at all / Very poor · 4 = Completely / Excellent');
    var mcs=['How satisfied are you with your current intimate relationship?','How well does your partner understand your menopause-related changes?','How much does your intimate relationship support your wellbeing?','How supported do you feel by your partner regarding your health?','Overall, how would you rate the quality of your intimate relationship?'];
    mcs.forEach(function(q, i) {
      _appendLikertRange(host, 'mcss_' + (i + 1), (i + 1) + '. ' + q, a, 0, 4, 'Not at all', 'Completely');
    });
    _mountTpl(host, 'tpl-psych-complete');
  });
}
function buildPrakriti(a){
  // MOVED: tpl-step-prakriti + tpl-card-opt
  return _stepHTML('tpl-step-prakriti', function(root) {
    var prakritis=[
      {v:'Vata',icon:'🌬️',title:'Vata — Air & Space',desc:'Naturally slim, creative, quick-thinking, enthusiastic. Tend to be irregular in habits, get cold easily, experience anxiety under stress. Light sleeper. Skin tends to dry.'},
      {v:'Pitta',icon:'🔥',title:'Pitta — Fire & Water',desc:'Medium build, ambitious, sharp intellect, strong digestion. Can be intense or irritable under stress. Warm body temperature, prone to inflammation. Moderate sleep.'},
      {v:'Kapha',icon:'🌊',title:'Kapha — Earth & Water',desc:'Sturdy build, calm, compassionate, enduring stamina. Tend to gain weight easily, slow metabolism. Deep sleeper. Prone to congestion, feels heavier emotionally.'},
      {v:'Vata-Pitta',icon:'🌀',title:'Vata-Pitta Dual',desc:'Mix of Vata and Pitta qualities — creative and driven, but prone to anxiety and inflammation. Variable energy with bursts of intensity.'},
      {v:'Tridosha',icon:'⚖️',title:'Tridosha — Balanced',desc:'Relatively equal Vata, Pitta and Kapha. Adaptable and resilient. True Tridosha is rare — often indicates uncertainty about type.'},
    ];
    var host = root.querySelector('[data-list="options"]');
    prakritis.forEach(function(p) {
      var frag = cloneTemplate('tpl-card-opt');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      el.classList.add('card-opt--left');
      fillTemplate(el, { icon: p.icon, label: p.title, desc: p.desc });
      if (a.prakriti === p.v) el.classList.add('selected');
      el.dataset.ansKey = 'prakriti'; el.dataset.ansVal = p.v;
      host.appendChild(el);
    });
  });
}
function buildVikriti(a){
  // MOVED: tpl-step-vikriti + tpl-vikriti-card
  return _stepHTML('tpl-step-vikriti', function(root) {
    var vikritis=[
      {v:'Vata_excess',icon:'🍃',name:'Vata Excess',desc:'Feeling scattered, anxious, dry, cold, restless. Difficulty sleeping, racing thoughts, irregular appetite, joints aching.'},
      {v:'Pitta_excess',icon:'🌶️',name:'Pitta Excess',desc:'Feeling hot, irritable, inflamed, overly critical. Hot flushes intense, skin flushed or sensitive, digestion acidic, perfectionistic.'},
      {v:'Kapha_excess',icon:'🌧️',name:'Kapha Excess',desc:'Feeling heavy, sluggish, foggy, unmotivated. Weight gain, congestion, low mood, wanting to sleep more, emotionally withdrawn.'},
      {v:'Vata_Pitta_excess',icon:'⚡',name:'Vata-Pitta Excess',desc:'Combination of anxiety and heat — restless mind with hot flushes, irritability with fear, disturbed sleep with sweating.'},
      {v:'Mixed',icon:'🌪️',name:'Mixed / Unsure',desc:'Experiencing symptoms from multiple doshas — common during perimenopause when all three can be disturbed simultaneously.'},
      {v:'Balanced',icon:'🌸',name:'Relatively Balanced',desc:'Feeling generally well — perhaps mild symptoms that are manageable. Good energy and mood most days.'},
    ];
    var host = root.querySelector('[data-list="options"]');
    vikritis.forEach(function(v) {
      var frag = cloneTemplate('tpl-vikriti-card');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      fillTemplate(el, { icon: v.icon, name: v.name, desc: v.desc });
      if (a.vikriti === v.v) el.classList.add('selected');
      el.dataset.ansVal = v.v;
      host.appendChild(el);
    });
  });
}
function buildWearableData(a){
  // MOVED: tpl-step-wearable + tpl-wearable-chip + tpl-wearable-field
  var wd=a.wearable_data||{};
  var devices=['None / No wearable','Apple Health','Apple Watch','Fitbit','Garmin','Samsung Galaxy Watch','Whoop','Oura Ring','Xiaomi Mi Band','Other'];
  var fields=[
    {k:'avg_rhr',l:'Resting Heart Rate',u:'bpm',ph:'e.g. 72',h:'Normal: 60–80 bpm'},
    {k:'avg_hrv',l:'HRV (RMSSD)',u:'ms',ph:'e.g. 38',h:'Higher = better recovery'},
    {k:'avg_spo2',l:'Blood Oxygen SpO₂',u:'%',ph:'e.g. 97',h:'Normal: 95–100%'},
    {k:'avg_sleep',l:'Avg Sleep',u:'hrs',ph:'e.g. 6.5',h:'Target: 7–9 hours'},
    {k:'avg_steps',l:'Daily Steps',u:'steps',ph:'e.g. 7500',h:'Target: >8,000/day'},
    {k:'avg_stress',l:'Stress Score',u:'/100',ph:'e.g. 42',h:'Lower = less stressed'},
    {k:'night_sweats_per_night',l:'Night Sweats',u:'per night',ph:'e.g. 2',h:'0 = none'},
    {k:'avg_active_minutes',l:'Active Minutes',u:'min/day',ph:'e.g. 30',h:'Target: ≥30 min'},
    {k:'resp_rate',l:'Resp. Rate',u:'breaths/min',ph:'e.g. 16',h:'Normal: 12–20'},
    {k:'avg_skin_temp',l:'Skin Temp Variation',u:'°C',ph:'e.g. 0.5',h:'Normal: <1°C variation'}
  ];
  return _stepHTML('tpl-step-wearable', function(root) {
    var chips = root.querySelector('[data-list="devices"]');
    devices.forEach(function(d) {
      var frag = cloneTemplate('tpl-wearable-chip');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      fillTemplate(el, { label: d });
      el.dataset.ansVal = d;
      if (a.wearable === d) el.classList.add('selected');
      chips.appendChild(el);
    });
    var inputs = root.querySelector('#wearable-inputs');
    if (inputs) inputs.classList.toggle('is-visible', a.wearable && a.wearable !== 'None / No wearable');
    var hint = root.querySelector('.wearable-hint-box');
    if (hint) {
      hint.innerHTML = '';
      // MOVED: tpl-wearable-hint
      var hFrag = cloneTemplate('tpl-wearable-hint');
      if (hFrag) {
        while (hFrag.firstChild) hint.appendChild(hFrag.firstChild);
      }
    }
    var fieldsHost = root.querySelector('[data-list="fields"]');
    fields.forEach(function(f) {
      var frag = cloneTemplate('tpl-wearable-field');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      fillTemplate(el, { label: f.l + ' ' + f.u, hint: f.h });
      var inp = el.querySelector('input');
      if (inp) {
        inp.dataset.field = f.k;
        inp.placeholder = f.ph;
        if (wd[f.k]) inp.value = wd[f.k];
      }
      fieldsHost.appendChild(el);
    });
  });
}
function setWFld(k,v){if(!S.answers.wearable_data)S.answers.wearable_data={};S.answers.wearable_data[k]=parseFloat(v)||v;}
function toggleWearableInputs(d){var el=document.getElementById('wearable-inputs');if(el)el.classList.toggle('is-visible',d&&d!=='None / No wearable');}
function buildComorbidities(a){
  // MOVED: tpl-step-comorbidities + tpl-comor-row + tpl-comor-opt
  var comor=a.comorbidities||{};
  var conditions=[
    {n:'Hypertension',icon:'❤️'},{n:'Diabetes',icon:'🩸'},{n:'Hypothyroidism',icon:'🦋'},
    {n:'Hyperthyroidism',icon:'⚡'},{n:'Hyperlipidemia',icon:'💊'},{n:'Anaemia',icon:'🩺'},
    {n:'PCOD',icon:'🌿'},{n:'Osteoporosis',icon:'🦴'},{n:'Heart Disease',icon:'🫀'},
    {n:'CKD',icon:'💧'},{n:'Autoimmune Disorder',icon:'🛡️'},{n:'Stroke (history)',icon:'🧠'},{n:'Cancer (history)',icon:'🎗️'}
  ];
  var opts=['No','Controlled','Uncontrolled','Not Sure'];
  var meds=[
    {k:'med_ssri',l:'Antidepressants (SSRIs/SNRIs)'},{k:'med_hrt',l:'Hormone Replacement Therapy'},
    {k:'med_betablocker',l:'Beta-blockers'},{k:'med_statin',l:'Cholesterol medication (Statins)'},
    {k:'med_thyroid',l:'Thyroid medication'},{k:'med_insulin',l:'Insulin / Diabetes medication'},
    {k:'med_antihyp',l:'Blood pressure medication'},{k:'med_sleep',l:'Sleep medication / Sedatives'},
    {k:'med_nsaid',l:'Regular pain relief (NSAIDs)'},{k:'med_none',l:'No regular medications'}
  ];
  return _stepHTML('tpl-step-comorbidities', function(root) {
    var condHost = root.querySelector('[data-list="conditions"]');
    conditions.forEach(function(cond) {
      var cur = comor[cond.n] || '';
      var cid = 'comor_' + cond.n.replace(/[^a-z]/gi, '');
      var frag = cloneTemplate('tpl-comor-row');
      if (!frag || !frag.firstElementChild) return;
      var row = frag.firstElementChild;
      row.id = cid;
      row.classList.add(_comorBorderClass(cur));
      fillTemplate(row, { icon: cond.icon, name: cond.n });
      var optsHost = row.querySelector('[data-list="opts"]');
      opts.forEach(function(opt) {
        var oFrag = cloneTemplate('tpl-comor-opt');
        if (!oFrag || !oFrag.firstElementChild) return;
        var oEl = oFrag.firstElementChild;
        fillTemplate(oEl, { label: opt });
        oEl.dataset.condName = cond.n;
        oEl.dataset.condVal = opt;
        if (cur === opt) {
          oEl.classList.add(opt === 'No' ? 'sel-no' : opt === 'Controlled' ? 'sel-ctrl' : opt === 'Uncontrolled' ? 'sel-unctrl' : 'sel-unsure');
        }
        optsHost.appendChild(oEl);
      });
      condHost.appendChild(row);
    });
    var medsHost = root.querySelector('[data-list="meds"]');
    meds.forEach(function(m) {
      var frag = cloneTemplate('tpl-card-opt');
      if (!frag || !frag.firstElementChild) return;
      var el = frag.firstElementChild;
      fillTemplate(el, { label: m.l, icon: '', desc: '' });
      el.classList.add('card-opt--fam-sm');
      if (a[m.k]) el.classList.add('selected');
      el.dataset.ansKey = m.k;
      el.dataset.ansVal = m.k;
      el.dataset.action = 'toggleMed';
      medsHost.appendChild(el);
    });
  });
}
function setComordiity(name,val,el){
  if(!S.answers.comorbidities)S.answers.comorbidities={};
  S.answers.comorbidities[name]=val;
  var card=el.closest('.comor-row-card');
  if(!card)return;
  var colMap={No:'sel-no',Controlled:'sel-ctrl',Uncontrolled:'sel-unctrl','Not Sure':'sel-unsure'};
  card.querySelectorAll('.comor-opt-btn').forEach(function(b){
    b.classList.remove('sel-no','sel-ctrl','sel-unctrl','sel-unsure');
  });
  el.classList.add(colMap[val]||'');
  card.className='comor-row-card '+_comorBorderClass(val);
  card.id=card.id;
}
