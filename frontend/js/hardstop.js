/* Hard Stop Screens & Step Summary */

function checkRedFlags(){
  var a=S.answers;
  var opts=[['No','Yes','Not sure'],['No','Occasionally','Frequently'],['No','Yes']];
  S.redFlagsTriggered=[];
  if(a.rf1!==undefined&&opts[0][a.rf1]==='Yes') S.redFlagsTriggered.push('Unusual vaginal bleeding');
  if(a.rf2!==undefined&&opts[1][a.rf2]==='Frequently') S.redFlagsTriggered.push('Persistent pelvic pain');
  if(a.rf3!==undefined&&opts[2][a.rf3]==='Yes') S.redFlagsTriggered.push('Breast changes');
}

function showGyneHardStop(){
  S.flags.gyneRedFlag=true;
  showScreen('gyne-stop-screen');
  var body=document.getElementById('gyne-stop-body');
  if(!body)return;
  body.innerHTML='';
  // MOVED: tpl-gyne-stop-body
  var frag=cloneTemplate('tpl-gyne-stop-body');
  if(!frag)return;
  var root=frag.firstElementChild;
  var host=root.querySelector('[data-list="flags"]');
  if(host){
    S.redFlagsTriggered.forEach(function(f){
      var li=document.createElement('li');
      li.textContent=f;
      host.appendChild(li);
    });
  }
  body.appendChild(root);
  if (typeof evhApplyClinicEmailLabels === 'function') evhApplyClinicEmailLabels(root);
  _bindHardStopActions(root);
}

function overrideGyneStop(){
  showScreen('form-screen');
  S.currentStep++;
  if(S.currentStep>=STEPS.length){startProcessing();return;}
  renderStepDots();renderStep(S.currentStep);updateDots();
}

function showPsychiatricHardStop(){
  showScreen('psych-stop-screen');
  var body=document.getElementById('psych-stop-body');
  if(!body)return;
  body.innerHTML='';
  // MOVED: tpl-psych-stop-body
  mountTemplate('tpl-psych-stop-body', body);
  if (body.firstElementChild && typeof evhApplyClinicEmailLabels === 'function') {
    evhApplyClinicEmailLabels(body.firstElementChild);
  }
  _bindHardStopActions(body.firstElementChild);
}

function overridePsychStop(){
  showScreen('form-screen');
  S.psychiatricHardStop=true;
  S.currentStep++;
  if(S.currentStep>=STEPS.length){startProcessing();return;}
  renderStepDots();renderStep(S.currentStep);updateDots();
}

function _bindHardStopActions(root){
  if(!root)return;
  root.querySelectorAll('[data-action]').forEach(function(el){
    var act=el.getAttribute('data-action');
    if(act==='overrideGyneStop') el.addEventListener('click',overrideGyneStop);
    if(act==='overridePsychStop') el.addEventListener('click',overridePsychStop);
    if(act==='startProcessing') el.addEventListener('click',startProcessing);
  });
}

function buildStepSummary(stepId){
  var a=S.answers; var lines=[];
  if(stepId==='demographics'){
    var flds=[['name','Name'],['age','Age','years'],['city','City'],['stage','Stage'],['prakriti','Prakriti']];
    flds.forEach(function(f){if(a[f[0]]!==undefined&&a[f[0]]!=='')lines.push({l:f[1],v:a[f[0]]+(f[2]?' '+f[2]:'')});});
    if(a.height_cm&&a.weight_kg){var bmi=a.weight_kg/((a.height_cm/100)*(a.height_cm/100));lines.push({l:'BMI',v:bmi.toFixed(1)+' kg/m²'});}
  }else if(stepId==='red_flags'){
    var rfOpts=[['No','Yes','Not sure'],['No','Occasionally','Frequently'],['No','Yes']];
    var rfQ=['Unusual vaginal bleeding','Persistent pelvic pain','Breast changes'];
    ['rf1','rf2','rf3'].forEach(function(id,i){if(a[id]!==undefined){var v=rfOpts[i][a[id]]||'-';lines.push({l:rfQ[i],v:v,flag:v==='Yes'||v==='Frequently'});}});
  }else if(stepId.startsWith('menqol_')){
    var qMap={menqol_vasomotor:['Hot flushes','Night sweats','Sweating','Feeling flushed','Chills','Heart racing'],menqol_physical:['Aches & pains','Feel tired','Poor sleep','Decreased fitness','Bloating','Low backache','Urinary frequency','Vaginal dryness'],menqol_psychosocial:['Low patience','Anxious/nervous','Memory lapses','Low confidence','Mood changes','Feeling depressed','Want to be alone'],menqol_sexual:['Vaginal dryness (sex)','Avoid intimacy','Low interest']};
    var kMap={menqol_vasomotor:['mq_v1','mq_v2','mq_v3','mq_v4','mq_v5','mq_v6'],menqol_physical:['mq_p1','mq_p2','mq_p3','mq_p4','mq_p5','mq_p6','mq_p7','mq_p8'],menqol_psychosocial:['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'],menqol_sexual:['mq_s1','mq_s2','mq_s3']};
    var qs=qMap[stepId]||[];var ks=kMap[stepId]||[];
    qs.forEach(function(q,i){var v=a[ks[i]];if(v!==undefined)lines.push({l:q,v:v+'/8 '+(v<=3?'Low':v<=5?'Moderate':'High'),flag:v>=6});});
  }else if(stepId==='mental_health'){
    var phqQ=['Little interest/pleasure','Feeling down','Sleep problems','Feeling tired','Appetite','Feel bad about self','Concentration','Slowed/restless','Thoughts of self-harm'];
    var gadQ=['Feeling nervous','Uncontrollable worry','Worry too much','Trouble relaxing','Too restless','Easily annoyed','Feeling afraid'];
    phqQ.forEach(function(q,i){var v=a['phq_'+i];if(v!==undefined)lines.push({l:'PHQ: '+q,v:['Never','Few days','>Half days','Nearly daily'][v]||v,flag:i===8&&v>0});});
    gadQ.forEach(function(q,i){var v=a['gad_'+i];if(v!==undefined)lines.push({l:'GAD: '+q,v:['Never','Few days','>Half days','Nearly daily'][v]||v});});
  }else if(stepId==='sleep'){
    var isiQ=['Falling asleep','Staying asleep','Waking early','Sleep satisfaction','Others notice','Worry about sleep','Daytime impact'];
    isiQ.forEach(function(q,i){var v=a['isi_'+i];if(v!==undefined)lines.push({l:q,v:v+'/4'});});
  }else if(stepId==='psychosexual'){
    lines.push({l:'FSFI (19 items)',v:'Completed'});lines.push({l:'FSDSR (13 items)',v:'Completed'});lines.push({l:'Relationship (5 items)',v:'Completed'});
  }else if(stepId==='prakriti'){if(a.prakriti)lines.push({l:'Your Prakriti',v:a.prakriti});
  }else if(stepId==='vikriti'){if(a.vikriti)lines.push({l:'Your Vikriti',v:a.vikriti.replace(/_/g,' ')});
  }else if(stepId==='wearable_data'){
    if(!a.wearable||a.wearable==='None / No wearable'){lines.push({l:'Device',v:'None'});}
    else{var wd=a.wearable_data||{};lines.push({l:'Device',v:a.wearable});if(wd.avg_rhr)lines.push({l:'Resting HR',v:wd.avg_rhr+' bpm'});if(wd.avg_sleep)lines.push({l:'Avg Sleep',v:wd.avg_sleep+'h'});if(wd.avg_steps)lines.push({l:'Daily Steps',v:wd.avg_steps.toLocaleString()});}
  }else if(stepId==='comorbidities'){
    var comor=a.comorbidities||{};var active=Object.entries(comor).filter(function(e){return e[1]&&e[1]!=='No';});
    if(active.length)active.forEach(function(e){lines.push({l:e[0],v:e[1],flag:e[1]==='Uncontrolled'});});
    else lines.push({l:'Comorbidities',v:'None reported'});
  }else{lines.push({l:'Section',v:'Responses recorded'});}
  if(!lines.length)lines.push({l:'Status',v:'All responses recorded'});
  // MOVED: tpl-step-summary-wrap + tpl-step-summary-row
  return _tplOuterHTML('tpl-step-summary-wrap', function(wrap) {
    var list = listHost(wrap, 'rows');
    if (!list) return;
    lines.forEach(function(l) {
      var rowFrag = cloneTemplate('tpl-step-summary-row');
      if (!rowFrag || !rowFrag.firstElementChild) return;
      var row = rowFrag.firstElementChild;
      fillTemplate(row, { label: l.l, value: l.v });
      var valEl = row.querySelector('[data-fill="value"]');
      if (valEl) valEl.classList.add(l.flag ? 'step-summary-value--flag' : 'step-summary-value--normal');
      list.appendChild(row);
    });
  });
}
