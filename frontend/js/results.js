/* Results Rendering & Care Plan */

function _resAppend(host, tplId, setup) {
  var frag = cloneTemplate(tplId);
  if (!frag || !frag.firstElementChild) return null;
  var el = frag.firstElementChild;
  if (setup) setup(el);
  host.appendChild(el);
  return el;
}
function _resScoreBandCls(band) {
  if (band === 'Low' || band === 'None' || band === 'Normal' || band === 'Minimal') return 'score-band--ok';
  if (band === 'High' || band === 'Severe' || band === 'Dysfunction' || band === 'Significant') return 'score-band--danger';
  return 'score-band--warn';
}
function _resFillRingSvg(svg, pct, color) {
  if (!svg) return;
  svg.innerHTML = '';
  var NS = 'http://www.w3.org/2000/svg';
  var circ = 2 * Math.PI * 36;
  var dash = circ * (pct / 100);
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  svg.appendChild(el('circle', { cx: '40', cy: '40', r: '36', fill: 'none', stroke: '#F0EBE8', 'stroke-width': '8' }));
  svg.appendChild(el('circle', {
    cx: '40', cy: '40', r: '36', fill: 'none', stroke: color, 'stroke-width': '8',
    'stroke-linecap': 'round', 'stroke-dasharray': dash.toFixed(1) + ' ' + circ.toFixed(1),
    transform: 'rotate(-90 40 40)'
  }));
  svg.appendChild(el('text', {
    x: '40', y: '45', 'text-anchor': 'middle', 'font-size': '14', 'font-weight': '700', fill: color
  }, String(Math.round(pct))));
}
function _resBindActions(root) {
  if (!root) return;
  root.querySelectorAll('[data-action="intShowBooking"]').forEach(function(b) { b.addEventListener('click', intShowBooking); });
  root.querySelectorAll('[data-action="resRetake"]').forEach(function(b) { b.addEventListener('click', startForm); });
  root.querySelectorAll('[data-action="resDownload"]').forEach(function(b) { b.addEventListener('click', downloadUserReport); });
  root.querySelectorAll('[data-action="resSendReport"]').forEach(function(b) { b.addEventListener('click', intSendReport); });
  root.querySelectorAll('[data-action="showPrivacyNotice"]').forEach(function(b) { b.addEventListener('click', showPrivacyNotice); });
  root.querySelectorAll('[data-action="deleteMyData"]').forEach(function(b) { b.addEventListener('click', deleteMyData); });
  root.querySelectorAll('[data-action="exportMyData"]').forEach(function(b) { b.addEventListener('click', exportMyData); });
}

function startProcessing(){
  showScreen('loading-screen');
  setTimeout(function(){
    S.scores=computeScores();
    S.scores.menqolPsychTriggered=S.flags.menqolPsychTriggered?1:0;
    S.scores.menqolSexualTriggered=S.flags.menqolSexualTriggered?1:0;
    S.scores.sleepModerate=S.flags.sleepModerate?1:0;
    S.scores.gyneRedFlag=S.flags.gyneRedFlag?1:0;
    S.triage=runRuleEngine(S.scores);
    // Merge wearable-triggered actions into triage
    if(S.scores.wearableCorroboration && S.scores.wearableCorroboration.length) {
      var sevOrder2={severe:3,moderate:2,mild:1};
      var wearableActions = calcWearableMod(S.answers).actions;
      wearableActions.forEach(function(wa) {
        var existing = S.triage.find(function(t){return t.action===wa.action;});
        if(existing) {
          if(sevOrder2[wa.sev]>sevOrder2[existing.sev]) existing.sev=wa.sev;
          existing.rules = existing.rules.concat(wa.rules);
        } else {
          S.triage.push(wa);
        }
      });
      S.triage.sort(function(a,b){return sevOrder2[b.sev]-sevOrder2[a.sev];});
    }
    S.psychiatricAlert=S.triage.some(function(t){return t.action==='psychiatric_alert';});
    saveResult();
    if (typeof saveToSupabase === 'function') saveToSupabase();
    saveDemographicsToSupabase();
    setTimeout(function(){showResults();},1500);
  },3000);
}
function showResults(){
  showScreen('results-screen');
  var a=S.answers,sc=S.scores;
  var name=a.name||'there';
  var composite=(sc&&sc.composite!==undefined)?sc.composite:0;
  var band=sc&&sc.composite_band?sc.composite_band:(composite<=5?'Optimal':composite<=30?'Mild':composite<=55?'Moderate':composite<=80?'Severe':'Critical');
  var bandIcon=band==='Optimal'?'🌟':band==='Mild'?'🌿':band==='Moderate'?'🌀':band==='Severe'?'⚠️':'🆘';
  var bandMsg=band==='Optimal'?'Excellent — your health profile shows minimal menopausal burden. Keep up your wellness practices.':
    band==='Mild'?'You have some manageable symptoms. Lifestyle and Ayurvedic support can help.':
    band==='Moderate'?'Your assessment shows a moderate wellness burden. Personalised clinical support is recommended.':
    band==='Severe'?'Your assessment shows significant burden. A specialist programme and multidisciplinary care are advised.':
    'Your assessment indicates urgent clinical attention. Please contact our team today.';
  var pathItems=[];
  if(S.flags.menqolPsychTriggered&&S.flags.mentalHealthCompleted) pathItems.push('🧠 Mental Health');
  if(S.flags.menqolSexualTriggered&&S.flags.psychosexualCompleted) pathItems.push('💙 Sexual Wellbeing');
  if(S.flags.sleepModerate) pathItems.push('🌙 Sleep');
  if(S.flags.gyneRedFlag) pathItems.push('🏥 Gynaecology');
  var bandCls=composite<=5?'cb-band--optimal':composite<=30?'cb-band--mild':composite<=55?'cb-band--moderate':composite<=80?'cb-band--severe':'cb-band--critical';
  var rings=[
    {label:'Vasomotor',score:Math.max(0,100-(sc.MENQOL_vasomotor||0)*5),color:'#E91E8C'},
    {label:'Physical',score:Math.max(0,100-(sc.MENQOL_physical||0)*3-(sc.ISI||0)*2),color:'#9C27B0'},
    {label:'Emotional',score:Math.max(0,100-(sc.MENQOL_psychosocial||0)*3-(sc.PHQ9||0)*1.5),color:'#3F51B5'},
    {label:'Intimacy',score:Math.max(0,100-(sc.MENQOL_sexual||0)*5-(sc.FSDSR||0)*1),color:'#E64A19'},
  ];
  var domainRows=[
    {label:'MenQOL Vasomotor',val:sc.MENQOL_vasomotor,max:20,band:sc.MENQOL_vasomotor<7?'Low':sc.MENQOL_vasomotor<14?'Moderate':'High'},
    {label:'MenQOL Physical',val:sc.MENQOL_physical,max:20,band:sc.MENQOL_physical<7?'Low':sc.MENQOL_physical<14?'Moderate':'High'},
    {label:'MenQOL Psychosocial',val:sc.MENQOL_psychosocial,max:20,band:sc.MENQOL_psychosocial<7?'Low':sc.MENQOL_psychosocial<14?'Moderate':'High'},
    {label:'MenQOL Sexual',val:sc.MENQOL_sexual,max:20,band:sc.MENQOL_sexual<7?'Low':sc.MENQOL_sexual<14?'Moderate':'High'},
  ];
  if(S.flags.mentalHealthCompleted){
    domainRows.push({label:'PHQ-9 Depression',val:sc.PHQ9,max:27,band:sc.PHQ9_band});
    domainRows.push({label:'GAD-7 Anxiety',val:sc.GAD7,max:21,band:sc.GAD7_band});
    domainRows.push({label:'PSS-8 Stress',val:sc.PSS8,max:32,band:sc.PSS8_band});
  }
  domainRows.push({label:'ISI Sleep',val:sc.ISI,max:28,band:sc.ISI_band});
  if(S.flags.psychosexualCompleted){
    domainRows.push({label:'FSFI Total',val:sc.FSFI,max:36,band:sc.FSFI_band||'Not assessed'});
    domainRows.push({label:'FSDSR Sexual Distress',val:sc.FSDSR,max:52,band:sc.FSDSR_band||'Not assessed'});
    if(sc.FSFI_domain){var fdLbls={desire:'Desire',arousal:'Arousal',lubrication:'Lubrication',orgasm:'Orgasm',satisfaction:'Satisfaction',pain:'Pain'};Object.keys(fdLbls).forEach(function(k){var dom=sc.FSFI_domain[k];if(dom)domainRows.push({label:'  FSFI '+fdLbls[k],val:dom.score,max:6,band:dom.impaired?'Impaired':'Normal'});});}
    if(sc.FSFI_impaired_domains>0)domainRows.push({label:'Impaired domains',val:sc.FSFI_impaired_domains,max:6,band:sc.FSFI_impaired_domains>=4?'Severe':sc.FSFI_impaired_domains>=2?'Moderate':'Mild'});
  }
  // MOVED: tpl-results-screen
  var screen=document.getElementById('results-screen');
  screen.innerHTML='';
  var shell=mountTemplate('tpl-results-screen',screen);
  var host=shell?listHost(shell,'content'):screen;
  if(!host){ generateAIMessage(name,sc); return; }
  if(S.psychiatricAlert) _resAppend(host,'tpl-res-psych-banner');
  if(S.scores&&S.scores.criticalFlags&&S.scores.criticalFlags.length){
    var cfArr=S.scores.criticalFlags,p1f=cfArr.filter(function(f){return f.priority===1;}),p2f=cfArr.filter(function(f){return f.priority===2;});
    if(p1f.length>0) _resAppend(host,'tpl-res-critical-p1',function(el){
      fillTemplate(el,{title:p1f.length+' Immediate Action Required'});
      var list=el.querySelector('[data-list="flags"]');
      p1f.forEach(function(f){var ff=cloneTemplate('tpl-res-critical-flag');if(ff&&ff.firstElementChild){fillTemplate(ff.firstElementChild,{label:'⚠ '+f.label});if(list)list.appendChild(ff.firstElementChild);}});
    });
    if(p2f.length>0) _resAppend(host,'tpl-res-critical-p2',function(el){
      fillTemplate(el,{title:'⚠ '+p2f.length+' Clinical Risk Factor'+(p2f.length>1?'s':'')+' Identified'});
      var list=el.querySelector('[data-list="flags"]');
      p2f.forEach(function(f){var ff=cloneTemplate('tpl-res-critical-flag');if(ff&&ff.firstElementChild){fillTemplate(ff.firstElementChild,{label:'• '+f.label});if(list)list.appendChild(ff.firstElementChild);}});
    });
  }
  if(S.redFlagsTriggered&&S.redFlagsTriggered.length) _resAppend(host,'tpl-res-redflag',function(el){
    var s=el.querySelector('[data-fill="flags"]');if(s)s.textContent=S.redFlagsTriggered.join(', ');
    if (typeof evhApplyClinicEmailLabels === 'function') evhApplyClinicEmailLabels(el);
  });
  _resAppend(host,'tpl-res-header',function(el){fillTemplate(el,{greeting:'Hello, '+name+' 🌸'});});
  _resAppend(host,'tpl-res-composite',function(el){
    fillTemplate(el,{icon:bandIcon,band:band,msg:bandMsg,modules:pathItems.length?'Modules assessed: '+pathItems.join(' · '):''});
    var bEl=el.querySelector('.cb-band');if(bEl)bEl.classList.add(bandCls);
    if(!pathItems.length){var mEl=el.querySelector('.cb-modules');if(mEl)mEl.remove();}
  });
  if(S.scores&&S.scores.criticalFlagCount>0){
    var cfC=S.scores.criticalFlagCount,cfP1=S.scores.hasPriority1Flag;
    _resAppend(host,'tpl-res-critical-banner',function(el){
      el.classList.add(cfP1?'res-critical-banner--urgent':'res-critical-banner--warn');
      fillTemplate(el,{icon:cfP1?'🚨':'⚠️',title:cfC+' Critical Flag'+(cfC>1?'s':'')+' Identified',sub:S.scores.criticalFlags.slice(0,2).map(function(f){return f.label;}).join(' · ')+(cfC>2?' +more':'')});
    });
  }
  _resAppend(host,'tpl-res-ai-box');
  _resAppend(host,'tpl-res-rings',function(grid){
    rings.forEach(function(r){
      var pct=Math.min(100,Math.max(0,r.score)),circ=2*Math.PI*36,dash=circ*(pct/100);
      _resAppend(grid,'tpl-res-ring-card',function(card){
        fillTemplate(card,{label:r.label,score:Math.round(pct)+'/100',desc:pct>=70?'😊 Good':pct>=40?'🌿 Moderate':'🌱 Needs Care'});
        var svg=card.querySelector('.ring-svg');
        if(svg)_resFillRingSvg(svg,pct,r.color);
      });
    });
  });
  _resAppend(host,'tpl-res-domain-panel',function(panel){
    var list=panel.querySelector('[data-list="rows"]');
    domainRows.forEach(function(row){
      if(row.val===undefined||row.val===null)return;
      var ff=cloneTemplate('tpl-res-score-row');if(!ff||!ff.firstElementChild)return;
      var rowEl=ff.firstElementChild;
      fillTemplate(rowEl,{label:row.label,val:row.val.toFixed(0)+'/'+row.max});
      var bandEl=rowEl.querySelector('.score-band');
      if(bandEl){bandEl.textContent=row.band;bandEl.classList.add(_resScoreBandCls(row.band));}
      if(list)list.appendChild(rowEl);
    });
    if(a.prakriti||a.vikriti){
      var dosha=panel.querySelector('.res-dosha-row');
      if(dosha){
        var parts=[];
        if(a.prakriti)parts.push('🌿 Prakriti: '+a.prakriti);
        if(a.vikriti)parts.push('⚖️ Vikriti: '+a.vikriti.replace('_',' '));
        dosha.textContent=parts.join('  ');
      }
    }else{var dRow=panel.querySelector('.res-dosha-row');if(dRow)dRow.remove();}
  });
  // ── Positive Findings Summary for Patient ──
  var a2=S.answers||{};
  var posFindings=[];
  // Lifestyle risks
  if(a2.smoking_history&&a2.smoking_history!=='Never smoked'&&a2.smoking_history!=='Prefer not to say')
    posFindings.push({icon:'🚬',label:'Smoking',val:a2.smoking_history,note:'Increases cardiovascular and cancer risk during menopause'});
  if(a2.alcohol_use&&a2.alcohol_use!=='Non-drinker'&&a2.alcohol_use!=='Prefer not to say')
    posFindings.push({icon:'🍷',label:'Alcohol',val:a2.alcohol_use,note:'Can worsen hot flushes, disrupt sleep and affect bone density'});
  if(a2.hrt_history&&a2.hrt_history!=='Never used HRT'&&a2.hrt_history!=='Not Sure / Prefer not to say')
    posFindings.push({icon:'💊',label:'HRT History',val:a2.hrt_history,note:'Your consultant will review appropriateness for your symptoms'});
  // Family history positives
  var fhLabels={'fam_breast_cancer':'Family Hx: Breast Cancer','fam_ovarian_cancer':'Family Hx: Ovarian Cancer','fam_osteoporosis':'Family Hx: Osteoporosis','fam_cvd':'Family Hx: Heart Disease','fam_diabetes':'Family Hx: Diabetes','fam_depression':'Family Hx: Depression','fam_early_menopause':'Family Hx: Early Menopause'};
  Object.keys(fhLabels).forEach(function(k){if(a2[k])posFindings.push({icon:'🧬',label:fhLabels[k],val:'Positive',note:'Genetic predisposition — discuss with your specialist'});});
  // Medications
  var mLabels={'med_ssri':'On Antidepressants','med_antihyp':'On Antihypertensives','med_betablocker':'On Beta-blockers','med_statin':'On Statins','med_thyroid':'On Thyroid Medication','med_insulin':'On Insulin/Diabetes Medication','med_sleep':'On Sleep Medication','med_nsaid':'Regular NSAIDs'};
  Object.keys(mLabels).forEach(function(k){if(a2[k])posFindings.push({icon:'💊',label:mLabels[k],val:'Confirmed',note:'Inform your consultant — may affect assessment interpretation'});});
  // BMI
  var bmiV=(a2.height_cm&&a2.weight_kg)?(a2.weight_kg/Math.pow(a2.height_cm/100,2)):null;
  if(bmiV&&(bmiV>27.5||bmiV<18.5))posFindings.push({icon:'⚖️',label:'BMI',val:bmiV.toFixed(1)+' kg/m²',note:bmiV>30?'Obesity increases cardiovascular and metabolic risk':bmiV>27.5?'Overweight — affects hormonal balance':'Underweight — bone health concern'});
  // Wearable abnormals
  var wd6=a2.wearable_data||{};
  if(wd6.avg_rhr&&wd6.avg_rhr>80)posFindings.push({icon:'❤️',label:'Elevated Resting HR',val:wd6.avg_rhr+' bpm',note:'Normal <80 bpm — may reflect vasomotor or stress burden'});
  if(wd6.avg_hrv&&wd6.avg_hrv<30)posFindings.push({icon:'📊',label:'Low HRV',val:wd6.avg_hrv+' ms',note:'Low heart rate variability indicates high stress and poor recovery'});
  if(wd6.avg_sleep&&wd6.avg_sleep<6.5)posFindings.push({icon:'😴',label:'Insufficient Sleep',val:wd6.avg_sleep+' hrs avg',note:'Below recommended 7-9 hrs — correlates with your ISI sleep score'});
  if(wd6.avg_steps&&wd6.avg_steps<5000)posFindings.push({icon:'🚶',label:'Low Daily Steps',val:wd6.avg_steps.toLocaleString()+' /day',note:'Below 7,500 target — increases bone loss and metabolic risk in menopause'});
  if(wd6.avg_stress&&wd6.avg_stress>50)posFindings.push({icon:'🌀',label:'High Stress Score',val:wd6.avg_stress+'/100',note:'Elevated autonomic stress — correlates with mood and sleep symptoms'});
  if(wd6.night_sweats_per_night&&wd6.night_sweats_per_night>=2)posFindings.push({icon:'🌡',label:'Frequent Night Sweats',val:wd6.night_sweats_per_night+' /night',note:'Significant vasomotor activity — confirmed by wearable'});
  if(posFindings.length) _resAppend(host,'tpl-res-findings',function(panel){
    var list=panel.querySelector('[data-list="items"]');
    posFindings.forEach(function(f){
      var ff=cloneTemplate('tpl-res-finding-item');if(!ff||!ff.firstElementChild)return;
      var item=ff.firstElementChild;
      fillTemplate(item,{icon:f.icon,note:f.note});
      var titleEl=item.querySelector('.res-finding-item__title');
      if(titleEl)titleEl.innerHTML=f.label+' <em>— '+f.val+'</em>';
      if(list)list.appendChild(item);
    });
  });
  var carePlanEl=_resAppend(host,'tpl-res-care-plan',function(el){fillTemplate(el,{sub:'Based on your adaptive assessment — '+STEPS.length+' sections completed'});});
  var cardsHost=carePlanEl?carePlanEl.querySelector('[data-list="cards"]'):null;
  // ── PRAKRITI/VIKRITI HELPER 
  // Used by every care card to personalise recommendations
  function _pk(){return (S.answers&&S.answers.prakriti)||'';}
  function _vk(){return (S.answers&&S.answers.vikriti)||'';}
  function _sc(){return S.scores||{};}
  function _wd(){return (S.answers&&S.answers.wearable_data)||{};}
  // Generates a Prakriti+Vikriti clinical note suffix for any care card
  function _ayurNote(){
    var pk=_pk(),vk=_vk(),lines=[];
    if(!pk)return '';
    // Prakriti-specific clinical note
    if(pk.indexOf('Vata-Pitta')>=0)
      lines.push('Vata-Pitta constitution: needs both grounding (Ashwagandha, Sesame oil Abhyanga) and cooling (Shatavari, Brahmi). Avoid excessive heat AND cold stimuli.');
    else if(pk.indexOf('Vata')>=0)
      lines.push('Vata constitution: prioritise warmth, stability and routine. Ashwagandha, warm Abhyanga oil massage, and a consistent daily schedule (Dinacharya) are foundational.');
    else if(pk.indexOf('Pitta')>=0)
      lines.push('Pitta constitution: requires cooling, calming approach. Shatavari, Brahmi, moon-bathing, and avoidance of spicy food, overheating and competitive pressure.');
    else if(pk.indexOf('Kapha')>=0)
      lines.push('Kapha constitution: needs stimulation and lightness. Trikatu (ginger-pepper-pippali), vigorous morning movement, light warming diet and avoidance of daytime sleep.');
    // Vikriti-specific active imbalance note
    if(vk){
      if(vk.indexOf('Vata')>=0&&vk.indexOf('Pitta')>=0)
        lines.push('Vikriti Vata-Pitta excess: the active imbalance combines anxiety-driven dryness with inflammatory heat — requires simultaneous grounding AND cooling protocols.');
      else if(vk.indexOf('Vata')>=0)
        lines.push('Active Vata imbalance: counter with warm, oily, heavy foods; oil pulling, Sesame Abhyanga, Ashwagandha 600mg/day and Triphala at bedtime.');
      else if(vk.indexOf('Pitta')>=0)
        lines.push('Active Pitta imbalance: reduce heat exposures, prioritise Shatavari, Amalaki, cooling pranayama (Sheetali, Sitali) and afternoon rest.');
      else if(vk.indexOf('Kapha')>=0)
        lines.push('Active Kapha imbalance: stimulate Agni with Trikatu churna before meals, vigorous Surya Namaskar, and dry brushing (Garshana) to move lymph.');
      else if(vk.indexOf('Mixed')>=0)
        lines.push('Mixed Vikriti: assess the most predominant dosha symptom and address that first — avoid aggressive treatments targeting all doshas simultaneously.');
    }
    return lines.length ? ' <em style="color:var(--teal);font-size:11px">🌿 '+lines.join(' ')+'</em>' : '';
  }

  var actionMeta={
    psychiatric_alert:{icon:'🆘',title:'Immediate Mental Health Support',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var d='<strong>Please contact a mental health professional today.</strong> Your assessment has identified an urgent mental health concern requiring immediate attention.';
        if(sc.PHQ9_item9>0) d+=' Suicidal ideation has been flagged — please call iCall: 9152987821 or Vandrevala Foundation: 1860-2662-345 (24/7).';
        if(pk.indexOf('Vata')>=0) d+=' For Vata types in acute distress: Ashwagandha and Brahmi are calming, but must not replace professional care. Avoid isolation.';
        else if(pk.indexOf('Pitta')>=0) d+=' For Pitta types: the intensity of Pitta can make mental health crises feel overwhelmingly urgent — this is treatable with the right support.';
        return d;
      })(),
      cta:'📞 Book Now: +91 80690 50000',ctaHref:'tel:+918069050000'},

    psychologist_referral:{icon:'🧠',title:'Expert Referral — Psychologist',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var d='';
        // Score-specific context
        if(sc.PHQ9>=20) d='Your PHQ-9 of '+sc.PHQ9+'/27 (Severe depression range) indicates a significant mental health burden. ';
        else if(sc.PHQ9>=15) d='PHQ-9: '+sc.PHQ9+'/27 (Moderately-Severe) — specialist psychological support is indicated. ';
        else if(sc.GAD7>=15) d='GAD-7: '+sc.GAD7+'/21 (Severe anxiety) — cognitive-behavioural therapy for anxiety is strongly recommended. ';
        else if(sc.PSS8>=22) d='PSS-8: '+sc.PSS8+'/32 (High stress) — structured stress reduction with a psychologist is recommended. ';
        else d='Your assessment indicates moderate psychological burden that would benefit from professional psychological support. ';
        if(sc.PHQ9>=5&&S.answers&&S.answers.med_ssri) d+='Note: You are on SSRIs — your true PHQ-9 burden may be higher than measured. ';
        // Prakriti-specific therapy approach
        if(pk.indexOf('Vata')>=0) d+='For Vata constitution: CBT combined with somatic grounding practices (body scan, yoga nidra, Ashwagandha) addresses the anxiety-grief pattern common in Vata during menopause.';
        else if(pk.indexOf('Pitta')>=0) d+='For Pitta constitution: therapy should focus on self-compassion, perfectionism and anger — ACT (Acceptance & Commitment Therapy) suits Pitta temperament. Brahmi 300mg helps.';
        else if(pk.indexOf('Kapha')>=0) d+='For Kapha constitution: behavioural activation therapy (BAT) works well — structured daily schedule, social engagement and gentle stimulation counter Kapha withdrawal.';
        else if(pk.indexOf('Vata-Pitta')>=0) d+='Vata-Pitta profile: DBT (Dialectical Behaviour Therapy) skills — emotion regulation for Pitta intensity + mindfulness for Vata anxiety — are well matched.';
        if(vk.indexOf('Vata')>=0) d+=' Current Vata excess: racing thoughts and anxiety are a Vata disturbance — Ashwagandha and Shirodhara (forehead oil therapy) can complement therapy.';
        else if(vk.indexOf('Pitta')>=0) d+=' Current Pitta excess: irritability and emotional inflammation may intensify psychological symptoms — cooling Brahmi and Amalaki are adjunct supports.';
        return d;
      })(),
      cta:'📞 Book Now: +91 80690 50000',ctaHref:'tel:+918069050000'},

    gynecology_referral:{icon:'👩‍⚕️',title:'Expert Referral — Gynaecologist',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),a=S.answers||{};
        var d='';
        // Reason-specific context
        if(sc.rf1==='Yes') d='<strong>Abnormal bleeding flagged</strong> — requires prompt gynaecological assessment to rule out pathology. ';
        else if(sc.rf3==='Yes') d='<strong>Breast change reported</strong> — clinical examination and imaging are indicated. ';
        else if(a.fam_breast_cancer||a.fam_ovarian_cancer) d='Family history of breast/ovarian cancer — genetic counselling and preventive screening are recommended. ';
        else d='Your menopause assessment indicates benefit from a specialist gynaecological review for symptom management and HRT evaluation. ';
        if(sc.MENQOL_vasomotor>=14) d+='Vasomotor score '+sc.MENQOL_vasomotor+'/20 — HRT candidacy assessment is appropriate. ';
        // Prakriti-specific surgical/hormonal considerations
        if(pk.indexOf('Pitta')>=0) d+='Pitta constitution: prone to inflammatory conditions — pre-HRT assessment should include inflammatory markers (CRP, ESR). Cooling Shatavari supports hormonal balance naturally.';
        else if(pk.indexOf('Vata')>=0) d+='Vata constitution: bone density screening is a priority — Vata types have higher osteoporosis risk during menopause. Ashwagandha and calcium supplementation are appropriate alongside HRT discussion.';
        else if(pk.indexOf('Kapha')>=0) d+='Kapha constitution: metabolic profile (thyroid, lipids, insulin) should be assessed during gynaecological review — Kapha is prone to hypothyroid-like symptoms.';
        if(vk.indexOf('Pitta')>=0) d+=' Active Pitta Vikriti: inflammatory conditions (fibroids, endometriosis risk) are heightened — discuss this with your gynaecologist.';
        return d;
      })(),
      cta:'📞 Book Now: +91 80690 50000',ctaHref:'tel:+918069050000'},

    gurugram_clinic:{icon:'🏥',title:'EvaEraHealth Clinic — Gurugram',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var comp=sc.composite||0;
        var d='';
        // Severity-appropriate urgency
        if(comp>=76) d='<strong>Your EvaEraHealth assessment places you in the Critical category.</strong> An in-person consultation is strongly recommended — same week. ';
        else if(comp>=56) d='Your Severe wellness level warrants an in-person consultation with our multidisciplinary menopause team. ';
        else d='An in-person consultation at EvaEraHealth Gurugram is recommended based on your assessment findings. ';
        // Prakriti-specific clinic services
        if(pk.indexOf('Vata-Pitta')>=0) d+='Your Vata-Pitta profile will receive a combined Ayurvedic-integrative plan: Panchakarma consultation, HRT assessment and Nadi Pariksha pulse diagnosis.';
        else if(pk.indexOf('Vata')>=0) d+='For your Vata constitution: the clinic offers Shirodhara (forehead oil therapy), Basti (enema therapy for Vata) and Ayurvedic consultation alongside conventional menopause care.';
        else if(pk.indexOf('Pitta')>=0) d+='For your Pitta constitution: the clinic provides Virechana (therapeutic purgation), Pitta-pacifying Panchakarma and cooling herbal therapies alongside conventional care.';
        else if(pk.indexOf('Kapha')>=0) d+='For your Kapha constitution: Udwartanam (dry herbal massage), Kapha-reducing Panchakarma and metabolic support are available.';
        if(vk&&vk!=='Balanced') d+=' Your current Vikriti ('+vk.replace(/_/g,' ')+') will be addressed with targeted dosha-specific treatment alongside your primary menopause care plan.';
        return d;
      })(),
      cta:'📞 +91 80690 50000',ctaHref:'tel:+918069050000'},

    sexual_therapy_pathway:{icon:'💜',title:'Sexual Therapy Pathway',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var d='';
        if(sc.FSFI!==null&&sc.FSFI!==undefined) d='FSFI score '+sc.FSFI+'/36 ('+sc.FSFI_band+') — ';
        else if(sc.MENQOL_sexual>=14) d='Sexual domain score '+sc.MENQOL_sexual+'/20 — ';
        else d='Your sexual wellbeing assessment indicates ';
        d+='integrated psychosexual therapy is recommended. This combines CBT, body-awareness techniques, and couples work where applicable. ';
        // Prakriti-specific sexual health approach
        if(pk.indexOf('Vata')>=0) d+='For Vata constitution: sexual dysfunction is often rooted in anxiety, dryness and disconnection. Shatavari (800mg/day) lubricates tissues; warm Abhyanga, intimacy-focused yoga (Ananda Balasana) and sensate focus therapy address Vata pattern.';
        else if(pk.indexOf('Pitta')>=0) d+='For Pitta constitution: sexual difficulties often involve performance pressure, self-criticism or physical discomfort from heat. Cooling Shatavari, Brahmi, and non-goal-oriented sensate focus work well for Pitta.';
        else if(pk.indexOf('Kapha')>=0) d+='For Kapha constitution: low libido and withdrawal are classic Kapha patterns. Saffron-infused warm milk, Ashwagandha, and graduated intimacy exercises with partner involvement help rekindle Kapha energy.';
        else if(pk.indexOf('Vata-Pitta')>=0) d+='Vata-Pitta sexual challenges combine dryness-anxiety (Vata) with heat-irritability (Pitta) — Shatavari addresses both; therapy should work with both patterns.';
        if(vk.indexOf('Vata')>=0) d+=' Vata Vikriti: vaginal dryness and low desire are Vata manifestations — Sesame Yoni Pichu (topical oil application) and Shatavari 800mg are Ayurvedic first-line.';
        else if(vk.indexOf('Kapha')>=0) d+=' Kapha Vikriti: emotional withdrawal from intimacy — warmth, stimulation and Ashwagandha 600mg can re-engage Kapha energy.';
        return d;
      })(),
      cta:'📞 Book Now: +91 80690 50000',ctaHref:'tel:+918069050000'},

    sexual_wellbeing_program:{icon:'🌺',title:'Sexual Wellness Programme',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var d='Specialised support for sexual health through education, therapy and community. ';
        if(pk.indexOf('Vata')>=0) d+='Vata focus: pelvic floor physiotherapy, vaginal moisturisers, Shatavari Ghee, and intimacy-rebuilding exercises.';
        else if(pk.indexOf('Pitta')>=0) d+='Pitta focus: managing peri-menopausal libido changes with cooling herbs (Shatavari, Rose water), and reducing performance anxiety.';
        else if(pk.indexOf('Kapha')>=0) d+='Kapha focus: behavioural activation for intimacy, Ashwagandha supplementation, and partner communication skills.';
        else d+='Education about hormonal changes, evidence-based options (lubricants, local oestrogen, Shatavari), and peer support.';
        return d;
      })()},

    relationship_counselling:{icon:'💑',title:'Relationship Counselling',
      desc:(function(){
        var pk=_pk(),vk=_vk();
        var d='Couples or individual counselling to navigate intimacy, communication and emotional changes during menopause. ';
        if(pk.indexOf('Vata')>=0) d+='For Vata: focus on reassurance, consistent emotional availability and communication — Vata fears abandonment and instability.';
        else if(pk.indexOf('Pitta')>=0) d+='For Pitta: focus on softening criticism and perfectionism in the relationship — Pitta\'s intensity can create friction. Compassionate communication techniques help.';
        else if(pk.indexOf('Kapha')>=0) d+='For Kapha: focus on re-engagement and social connection — Kapha\'s withdrawal can be misread as rejection. Structured shared activities re-establish intimacy.';
        if(vk.indexOf('Pitta')>=0) d+=' Pitta Vikriti: anger and irritability may be projecting into the relationship — therapy can help distinguish hormonal from relational drivers.';
        return d;
      })()},

    sleep_recovery_program:{icon:'🌙',title:'Sleep Recovery Programme',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),wd=_wd();
        var d='';
        // Score-specific
        if(sc.ISI>=22) d='ISI score '+sc.ISI+'/28 (Severe insomnia) — CBT-I (Cognitive Behavioural Therapy for Insomnia) is the gold-standard first-line treatment. ';
        else if(sc.ISI>=15) d='ISI score '+sc.ISI+'/28 (Moderate insomnia) — sleep hygiene and structured relaxation protocols are indicated. ';
        else d='Your sleep assessment indicates benefit from structured sleep support. ';
        if(wd.avg_sleep&&wd.avg_sleep<6) d+='Wearable confirms average '+wd.avg_sleep+'h — significantly below the 7-9h target. ';
        if(wd.night_sweats_per_night&&wd.night_sweats_per_night>=2) d+='Wearable: '+wd.night_sweats_per_night+' night sweats/night are disrupting sleep continuity. ';
        // Prakriti-specific sleep protocols
        if(pk.indexOf('Vata')>=0) d+='Vata sleep protocol: Abhyanga warm sesame oil on feet/scalp before bed, Brahmi Ghee, Jatamansi 500mg, warm milk with nutmeg. Keep room dark, warm and silent. Avoid screens 90min before bed.';
        else if(pk.indexOf('Pitta')>=0) d+='Pitta sleep protocol: Cool bedroom (18-20°C), Brahmi+Shatavari at night, lavender/sandalwood diffusion, avoid stimulating conversations or work after 7pm. Sheetali pranayama before bed.';
        else if(pk.indexOf('Kapha')>=0) d+='Kapha sleep protocol: avoid sleeping more than 7.5h (increases Kapha heaviness), keep consistent wake time, morning exercise by 7am. Trikatu tea in the morning activates Agni. Reduce daytime napping.';
        else if(pk.indexOf('Vata-Pitta')>=0) d+='Vata-Pitta sleep protocol: combine cooling (lavender, Brahmi) with grounding (warm Abhyanga, Ashwagandha) — address both the racing thoughts (Vata) and late-night intensity (Pitta) aspects.';
        // Vikriti-specific additions
        if(vk.indexOf('Vata')>=0) d+=' Vata Vikriti: Ashwagandha 600mg + Jatamansi at bedtime — addresses the anxiety-driven insomnia of active Vata imbalance.';
        else if(vk.indexOf('Pitta')>=0) d+=' Pitta Vikriti: Brahmi 500mg + Amalaki at bedtime — cooling support for the overheating, ruminating mind of Pitta excess.';
        return d;
      })()},

    stress_management_program:{icon:'🧘',title:'Stress Management Programme',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),wd=_wd();
        var d='';
        // Score-specific
        if(sc.PSS8>=22) d='PSS-8: '+sc.PSS8+'/32 (High stress) — ';
        else if(sc.GAD7>=10) d='GAD-7: '+sc.GAD7+'/21 — ';
        else if(sc.PHQ9>=10) d='PHQ-9: '+sc.PHQ9+'/27 — ';
        else d='Your stress assessment indicates — ';
        d+='structured stress management is recommended alongside any clinical treatment. ';
        if(wd.avg_hrv&&wd.avg_hrv<30) d+='Wearable HRV '+wd.avg_hrv+'ms (low) confirms elevated autonomic stress load. ';
        if(wd.avg_stress&&wd.avg_stress>60) d+='Device stress score '+wd.avg_stress+'/100 corroborates chronic stress burden. ';
        // Prakriti-specific stress techniques
        if(pk.indexOf('Vata')>=0) d+='For Vata constitution: Nadi Shodhana (alternate nostril breathing) 10min twice daily, Yoga Nidra, Ashwagandha KSM-66 600mg. Grounding practices: walking barefoot on grass, gardening, warm baths. Avoid over-scheduling.';
        else if(pk.indexOf('Pitta')>=0) d+='For Pitta constitution: Sheetali pranayama, Chandra Bhedana (moon breath), Brahmi 500mg. Channel Pitta energy through creative outlets, gentle walks in nature. Avoid competitive or high-stakes activities during peak stress.';
        else if(pk.indexOf('Kapha')>=0) d+='For Kapha constitution: vigorous exercise (Surya Namaskar, brisk walks) is the best stress reliever — Kapha needs movement. Social engagement, Trikatu adaptogen and challenging mental tasks help lift Kapha depression-stress.';
        else if(pk.indexOf('Vata-Pitta')>=0) d+='Vata-Pitta stress programme: Nadi Shodhana for Vata anxiety + Sheetali for Pitta heat. Ashwagandha for Vata, Brahmi for Pitta — these two herbs work synergistically for this dual constitution.';
        // Vikriti-specific
        if(vk.indexOf('Vata')>=0) d+=' Vata Vikriti: this active imbalance amplifies anxiety — Ashwagandha 600mg/day is clinically validated for stress reduction and is Vata-pacifying.';
        else if(vk.indexOf('Pitta')>=0) d+=' Pitta Vikriti: inflammatory stress response — reduce Pitta foods (spicy, acidic, fermented), add Shatavari and Amalaki to cool the physiological stress reaction.';
        else if(vk.indexOf('Kapha')>=0) d+=' Kapha Vikriti: sluggishness masks stress as low motivation — Trikatu and stimulating exercise (20min morning vigorous activity) shifts Kapha state.';
        return d;
      })()},

    recommend_menopause_program:{icon:'🌸',title:'Menopause Wellness Programme',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),a=S.answers||{};
        var d='';
        var comp=sc.composite||0;
        // Severity-appropriate framing
        if(comp>=81) d='<strong>Critical — your wellness assessment indicates urgent care</strong> — your personalised menopause programme will be intensive and multidisciplinary. ';
        else if(comp>=56) d='Your Severe assessment ('+comp+'/100) indicates significant menopausal burden. Your programme will be comprehensive. ';
        else if(comp>=31) d='Moderate wellness burden detected — your programme focuses on targeted symptom relief and prevention. ';
        else d='Your menopause wellness programme will build on your current health foundations. ';
        // Vasomotor burden note
        if(sc.MENQOL_vasomotor>=14) d+='Vasomotor score '+sc.MENQOL_vasomotor+'/20 is high — your programme will prioritise hot flush management. ';
        // Full Prakriti programme description
        if(pk.indexOf('Vata-Pitta')>=0)
          d+='Vata-Pitta programme: Shatavari 800mg + Ashwagandha 600mg daily (addresses both doshas). Abhyanga with cooling-grounding sesame-coconut oil blend. Avoid both extreme heat AND cold. Yoga: Restorative poses (Supta Baddha Konasana, Legs-up-wall) balance Vata and Pitta simultaneously. Chandraprabha Vati supports genitourinary symptoms.';
        else if(pk.indexOf('Vata')>=0)
          d+='Vata programme: Ashwagandha 600mg, Shatavari 500mg, Triphala (bedtime). Daily Abhyanga with warm sesame oil. Regular meals — no fasting. Yoga: Grounding poses (Tadasana, Virabhadrasana, Balasana). Warm, oily, nourishing diet. Avoid cold, raw foods and erratic schedules.';
        else if(pk.indexOf('Pitta')>=0)
          d+='Pitta programme: Shatavari 800mg + Brahmi 500mg + Amalaki daily. Moon-bathing and evening walks. Yoga: Cooling poses (Chandra Namaskar, Sitali pranayama, Shavasana). Avoid spicy, sour, fermented foods. Coconut oil Abhyanga with sandalwood/rose essential oils. Chandraprabha Vati for hot flushes.';
        else if(pk.indexOf('Kapha')>=0)
          d+='Kapha programme: Trikatu churna before meals, Guggul (Triphala Guggul) for metabolism, Ginger + Cinnamon tea daily. Morning Surya Namaskar (12 rounds) and Garshana dry brushing. Avoid heavy, cold, sweet foods. Yoga: Dynamic poses (Trikonasana, Navasana). Stimulation and social engagement are medicine for Kapha.';
        else
          d+='Your personalised EvaEraHealth menopause programme includes Ayurvedic constitution assessment, integrative lifestyle protocols, and evidence-based menopause management.';
        // Stage-specific note
        if(a.stage==='Surgical Menopause') d+=' Surgical menopause: abrupt hormone loss requires more intensive support — your programme will address rapid oestrogen withdrawal specifically.';
        // Vikriti integration
        if(vk&&vk!=='Balanced')
          d+=' Your current imbalance ('+vk.replace(/_/g,' ')+') is addressed with targeted protocols within the programme.';
        return d;
      })()},

    exercise_program:{icon:'🏃\u200d\u2640\ufe0f',title:'Movement & Exercise',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),wd=_wd();
        var d='';
        var steps=wd.avg_steps;
        if(steps&&steps<3000) d='🚨 Wearable: only '+Number(steps).toLocaleString()+' steps/day — critically low for menopausal bone and metabolic health. ';
        else if(steps&&steps<5000) d='⚠️ Wearable: '+Number(steps).toLocaleString()+' steps/day — below the 7,500 menopause target. ';
        else if(steps&&steps>=7500) d='✅ Wearable confirms '+Number(steps).toLocaleString()+' steps/day — maintain this as a minimum baseline. ';
        // Prakriti-specific exercise prescriptions
        if(pk.indexOf('Vata')>=0)
          d+='Vata exercise Rx: gentle, grounding movement. Yoga (Hatha, Restorative), walking in nature, swimming. 30min daily at moderate intensity. AVOID: high-impact HIIT, endurance running, hot yoga — these aggravate Vata dryness and depletion. Best times: 6-10am (Kapha hours, stabilising for Vata).';
        else if(pk.indexOf('Pitta')>=0)
          d+='Pitta exercise Rx: cooling, non-competitive exercise. Swimming, evening walks, restorative yoga, cycling. 45min daily. AVOID: midday workouts in heat, competitive sports that trigger Pitta intensity, Bikram yoga. Best times: 6-10am or 6-10pm (avoid 10am-2pm Pitta hours).';
        else if(pk.indexOf('Kapha')>=0)
          d+='Kapha exercise Rx: vigorous, stimulating movement is medicine. Brisk walking 45min, strength training 3×/week, aerobics classes, Surya Namaskar 12 rounds. Kapha needs intensity and variety to shift stagnation. Best times: 6-10am (Kapha hours — movement during this time maximally reduces Kapha buildup).';
        else if(pk.indexOf('Vata-Pitta')>=0)
          d+='Vata-Pitta exercise Rx: moderate-intensity, cooling and grounding. Yoga (Hatha/Vinyasa), swimming, morning walks. 40min daily. Avoid extremes in both intensity (HIIT) and heat (Bikram yoga). Consistency over intensity.';
        else
          d+='Target 7,500 steps/day minimum, 150min moderate aerobic activity/week, and 2× weekly strength training to protect bone density during menopause.';
        // Vikriti-specific modification
        if(vk.indexOf('Vata')>=0) d+=' Vata excess active: reduce exercise intensity temporarily until symptoms stabilise — over-exertion worsens Vata depletion.';
        else if(vk.indexOf('Pitta')>=0) d+=' Pitta excess active: avoid exercising in heat or when irritable — this amplifies Pitta. Morning swimming or gentle yoga are safest.';
        else if(vk.indexOf('Kapha')>=0) d+=' Kapha excess active: this is the time to push through resistance — vigorous exercise is the single most effective Kapha-reducing intervention.';
        return d;
      })()},

    nutrition_guidance:{icon:'🥗',title:'Nutrition & Diet',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk(),wd=_wd(),a=S.answers||{};
        var d='';
        var bmi=(a.height_cm&&a.weight_kg)?(a.weight_kg/Math.pow(a.height_cm/100,2)).toFixed(1):null;
        // Wearable-informed specifics
        if(wd.avg_stress&&wd.avg_stress>60) d+='Wearable stress '+wd.avg_stress+'/100 — magnesium glycinate 400mg at night, Ashwagandha adaptogen and B-vitamin complex help buffer cortisol. ';
        if(wd.avg_sleep&&wd.avg_sleep<5.5) d+='Wearable sleep '+wd.avg_sleep+'h — add tryptophan-rich evening foods: warm golden milk (turmeric+ashwagandha), dates, almonds, nutmeg per Ayurvedic Dinacharya. ';
        if(bmi&&parseFloat(bmi)>30) d+='BMI '+bmi+' — prioritise anti-inflammatory, low-glycaemic diet to reduce menopausal metabolic risk. ';
        else if(bmi&&parseFloat(bmi)>27.5) d+='BMI '+bmi+' — include high-fibre foods (psyllium, flaxseed) and time-restricted eating to support metabolic health. ';
        // Prakriti-specific full diet prescriptions
        if(pk.indexOf('Vata-Pitta')>=0)
          d+='Vata-Pitta diet: warm, mildly spiced, nourishing AND non-inflammatory. Ghee + warm sesame oil (Vata), coconut water + cooling herbs (Pitta). Include: khichdi, warm soups, pomegranate, coriander chutney, Shatavari Kalpa powder. Avoid: cold raw foods (Vata), spicy curries (Pitta), fermented foods.';
        else if(pk.indexOf('Vata')>=0)
          d+='Vata diet Rx: warm, oily, grounding, sweet-sour-salty tastes. Ghee 1 tsp/day, sesame seeds, root vegetables (sweet potato, beets), warm lentil soups, dates and figs. Herbs: Ashwagandha, Shatavari, Triphala (bedtime). AVOID: cold/raw foods, fasting >4h, bitter/astringent/pungent tastes.';
        else if(pk.indexOf('Pitta')>=0)
          d+='Pitta diet Rx: cooling, anti-inflammatory, sweet-bitter-astringent tastes. Coconut water, pomegranate, coriander, fennel, cucumber, leafy greens. Herbs: Shatavari 800mg, Amalaki, Brahmi, Rose water. AVOID: spicy foods, alcohol, acidic/fermented foods, excessive red meat. Reduce salt.';
        else if(pk.indexOf('Kapha')>=0)
          d+='Kapha diet Rx: light, warming, spicy-bitter-astringent tastes. Fresh ginger tea, mustard seeds, pepper, leafy greens, legumes. Herbs: Trikatu, Guggul, Cinnamon. AVOID: dairy, sweet/heavy/oily foods, cold drinks, daytime napping after meals. Eat largest meal at noon.';
        else
          d+='Balanced menopause diet: calcium 1200mg/day (sesame, almonds, leafy greens), Vitamin D3 2000IU, omega-3 (walnuts, flaxseed, fatty fish), phytoestrogens (edamame, flaxseed, chickpeas), and Shatavari as an adaptogenic herb.';
        // Vikriti-specific add-on
        if(vk.indexOf('Vata')>=0) d+=' Vata imbalance: increase Ama-reducing foods — Triphala at bedtime, warm cumin-coriander-fennel tea (CCF tea) after meals.';
        else if(vk.indexOf('Pitta')>=0) d+=' Pitta imbalance: add Amalaki churna 3g/day — a Pitta-pacifying Rasayana that also supports liver detoxification and hormonal clearance.';
        else if(vk.indexOf('Kapha')>=0) d+=' Kapha imbalance: Trikatu churna 500mg before meals stimulates Agni and reduces Kapha mucus buildup.';
        return d;
      })()},

    activate_psychosexual_module:{icon:'💭',title:'Psychosexual Wellbeing Support',
      desc:(function(){
        var sc=_sc(),pk=_pk(),vk=_vk();
        var d='An integrated mind-body assessment for sexual and psychological wellbeing during menopause. ';
        if(sc.MENQOL_sexual>=12) d+='Your sexual wellbeing domain score ('+sc.MENQOL_sexual+'/20) suggests meaningful sexual health impact. ';
        if(pk.indexOf('Vata')>=0) d+='Vata sexual wellbeing: addresses vaginal dryness, low libido and anxiety around intimacy. Shatavari Ghee and pelvic floor work are first-line Ayurvedic support.';
        else if(pk.indexOf('Pitta')>=0) d+='Pitta sexual wellbeing: manages performance pressure, physical discomfort and emotional intensity in intimacy. Cooling Shatavari and sensate focus therapy are recommended.';
        else if(pk.indexOf('Kapha')>=0) d+='Kapha sexual wellbeing: addresses low libido and emotional withdrawal. Ashwagandha, partner communication and graduated intimacy exercises reawaken Kapha desire.';
        return d;
      })()},
  };
  var shown=0;
  (S.triage||[]).forEach(function(t){
    if(shown>=7)return;
    var m=actionMeta[t.action];
    if(!m)return;
    var sevClass=t.sev==='severe'?'urgent':t.sev==='moderate'?'moderate':'mild';
    var ff=cloneTemplate('tpl-res-care-card');if(!ff||!ff.firstElementChild)return;
    var card=ff.firstElementChild;
    card.classList.add(sevClass);
    fillTemplate(card,{icon:m.icon,title:m.title,badge:(t.sev==='severe'?'📋 Recommended Action':t.sev==='moderate'?'💡 Suggested Support':'✅ Wellness Tip')});
    var descEl=card.querySelector('.cc-desc');if(descEl)descEl.innerHTML=m.desc;
    if(m.cta){
      var ctaHost=card.querySelector('.cc-cta-host');
      var isBookable=['gynecology_referral','psychologist_referral','gurugram_clinic','sexual_therapy_pathway','psychiatric_alert'].indexOf(t.action)>=0;
      if(ctaHost){
        if(isBookable){var btn=document.createElement('button');btn.type='button';btn.className='cc-cta cc-cta--btn';btn.dataset.action='intShowBooking';btn.textContent='📅 '+m.cta;ctaHost.appendChild(btn);}
        else{var link=document.createElement('a');link.className='cc-cta';link.href=m.ctaHref;link.textContent=m.cta;ctaHost.appendChild(link);}
      }
    }
    if(cardsHost)cardsHost.appendChild(card);
    shown++;
  });
  if(shown===0){var wf=cloneTemplate('tpl-res-wellness-card');if(wf&&wf.firstElementChild&&cardsHost)cardsHost.appendChild(wf.firstElementChild);}
  _resAppend(host,'tpl-res-disclaimer');
  _resAppend(host,'tpl-res-book-panel');
  _resAppend(host,'tpl-res-cta-row',function(row){
    var btnHost=listHost(row,'buttons');
    ['tpl-res-cta-retake','tpl-res-cta-download','tpl-res-cta-send'].forEach(function(tid){var f=cloneTemplate(tid);if(f&&f.firstElementChild&&btnHost)btnHost.appendChild(f.firstElementChild);});
  });
  mountTemplate('tpl-res-float-book',screen);
  _resAppend(host,'tpl-res-dpdp-panel');
  _resAppend(host,'tpl-res-footer');
  _resBindActions(screen);
  generateAIMessage(name,sc);
}
async function generateAIMessage(name, sc) {
  if(!sc||(sc.composite===0&&!S.answers.mq_v1)){var el=document.getElementById('ai-message-text');if(el)el.textContent='"Complete the full assessment to receive your personalised wellness message."';
return;
}
  var band = sc.composite<=5?'optimal':sc.composite<=30?'mild':sc.composite<=55?'moderate':sc.composite<=80?'significant':'high';
    var wNote='';
  if(S.answers&&S.answers.wearable&&S.answers.wearable!=='None / No wearable'&&sc&&sc.wearableNotes&&sc.wearableNotes.length){
    wNote=' Wearable device ('+S.answers.wearable+') corroboration: '+sc.wearableNotes.slice(0,2).join('; ')+'.';
  }
  // ISSUE-01 fix: pass red flag status, dominant domain, max severity to prompt
  var redFlagActive = S.answers && (S.answers.rf1===1||S.answers.rf3===1||(S.answers.rf2===2));
  var psychiatricAlert = sc.PHQ9_item9 > 0;
  // Compute dominant domain (highest scoring) for ISSUE-03 fix
  var domainScores = [
    {name:'vasomotor symptoms (hot flushes and night sweats)',score:sc.MENQOL_vasomotor||0,max:20},
    {name:'physical symptoms (fatigue and joint pain)',score:sc.MENQOL_physical||0,max:20},
    {name:'emotional wellbeing (anxiety and mood)',score:sc.MENQOL_psychosocial||0,max:20},
    {name:'sleep quality',score:(sc.ISI||0)/28*20,max:20},
    {name:'depression',score:(sc.PHQ9||0)/27*20,max:20},
    {name:'anxiety',score:(sc.GAD7||0)/21*20,max:20},
  ];
  var topDomain = domainScores.sort(function(a,b){return b.score-a.score;})[0];
  // Compute max triage severity for ISSUE-02 fix
  var maxTriageSev = 'mild';
  if(S.triage && S.triage.length) {
    var sevMap={severe:3,moderate:2,mild:1};
    S.triage.forEach(function(t){if(sevMap[t.sev||t[1]]>sevMap[maxTriageSev])maxTriageSev=t.sev||t[1];});
  }
  // Build clinical urgency override string
  var urgencyNote='';
  if(redFlagActive){
    urgencyNote=' CRITICAL INSTRUCTION: This woman has reported a gynaecological concern (unusual bleeding or breast change). Your FIRST sentence MUST be: "Your assessment has flagged something that needs prompt medical attention — please contact the EvaEraHealth clinic today at +91 80690 50000." Do not start with any other sentence.';
  } else if(psychiatricAlert){
    urgencyNote=' CRITICAL: She reported suicidal thoughts (PHQ-9 item 9). Begin with: "I want you to know that support is available right now — please call iCall at 9152987821 or Vandrevala Foundation at 1860-2662-345."';
  } else if(maxTriageSev==='severe'){
    urgencyNote=' IMPORTANT: Her assessment includes at least one SEVERE clinical recommendation. Your message should be warm but clearly encourage her to seek specialist support, naming the specific concern: '+topDomain.name+'. Do not be alarming but do be clear that professional support is strongly recommended.';
  }
  // ISSUE-03 fix: specify dominant domain for personalisation
  var domainInstruction = ' Her primary area of concern is '+topDomain.name+' (score '+Math.round(topDomain.score)+'/20 equivalent). Sentence 2 should specifically address this domain with an empathetic acknowledgement and one practical suggestion.';
  var prompt = 'You are a warm, compassionate AI wellness companion for EvaEraHealth, an AI-powered perimenopause and menopause platform for Indian women.'
    +urgencyNote
    +' Write a personalised, empathetic 3-sentence wellness message for a woman named '+name
    +'. Her assessment: composite '+sc.composite+'/100 ('+band+' burden),'
    +' PHQ-9:'+sc.PHQ9+', GAD-7:'+sc.GAD7+', ISI:'+sc.ISI+', FSFI:'+sc.FSFI+'.'
    +domainInstruction
    +' Assessment modules completed: '+(S.flags&&S.flags.mentalHealthCompleted?'mental health, ':'')+''+(S.flags&&S.flags.psychosexualCompleted?'sexual wellbeing, ':'')+'sleep.'
    +(wNote?' '+wNote:'')
    +' RULES: Warm encouraging English only. No clinical jargon. No bullet points. Under 80 words.'
    +' Only reference domains that were assessed. Do NOT mention or grade modules that are marked as not completed this session.';
  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        messages:[{role:'user',content:prompt}]
      })
    });
    var data = await response.json();
    var text = data.content && data.content[0] ? data.content[0].text : 'Your wellbeing journey is unique and deeply personal. EvaEraHealth is here to walk alongside you every step of the way. Today, take one small, gentle action for yourself — you deserve it.';
    var el = document.getElementById('ai-message-text');
    if(el) el.textContent = '"' + text + '"';
  } catch(e) {
    var el = document.getElementById('ai-message-text');
    if(el) el.textContent = '"Your wellbeing journey is unique and deeply personal. EvaEraHealth is here to walk alongside you every step of the way. Today, take one small, gentle action for yourself — you deserve it."';
  }
}

function downloadUserReport() {
  var a    = S.answers || {};
  var sc   = S.scores  || {};
  var name = a.name || 'Patient';
  var comp = sc.composite || 0;
  var band = sc.composite_band || (comp<=5?'Optimal':comp<=30?'Mild':comp<=55?'Moderate':comp<=80?'Severe':'Critical');
  var dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

  var aiEl  = document.getElementById('ai-message-text');
  var aiMsg = aiEl ? aiEl.textContent.replace(/^"|"$/g,'').trim() : '';

  // MOVED: tpl-print-report-body + row/triage sub-templates
  var bodyFrag = cloneTemplate('tpl-print-report-body');
  if (!bodyFrag || !bodyFrag.firstElementChild) return;
  var bodyEl = bodyFrag.firstElementChild;
  fillTemplate(bodyEl, {
    dateLine: 'Wellness Assessment Report — ' + dateStr,
    greeting: 'Hello, ' + name,
    composite: comp + '/100',
    band: band,
    aiMsg: aiMsg ? '"' + aiMsg + '"' : ''
  });
  var aiBox = bodyEl.querySelector('.print-report-ai-msg');
  if (aiBox && !aiMsg) aiBox.classList.add('is-hidden');

  var scoreDefs = [
    ['MenQOL Vasomotor', sc.MENQOL_vasomotor, 20],
    ['MenQOL Physical', sc.MENQOL_physical, 20],
    ['MenQOL Psychosocial', sc.MENQOL_psychosocial, 20],
    ['MenQOL Sexual', sc.MENQOL_sexual, 20],
    ['ISI Sleep', sc.ISI, 28],
    ['PHQ-9 Depression', sc.PHQ9, 27],
    ['GAD-7 Anxiety', sc.GAD7, 21],
    ['PSS-8 Stress', sc.PSS8, 32],
    ['FSFI Sexual Function', sc.FSFI, 36]
  ];
  var tbody = bodyEl.querySelector('[data-list="scoreRows"]');
  if (tbody) {
    scoreDefs.forEach(function(def) {
      var val = def[1];
      if (val === undefined || val === null) return;
      var rFrag = cloneTemplate('tpl-print-report-score-row');
      if (!rFrag || !rFrag.firstElementChild) return;
      fillTemplate(rFrag.firstElementChild, {
        label: def[0],
        val: val + (def[2] ? ' / ' + def[2] : '')
      });
      tbody.appendChild(rFrag.firstElementChild);
    });
  }

  var triageHost = bodyEl.querySelector('[data-fill="triageHost"]');
  var triage = (S.triage || []).slice(0, 8);
  if (triageHost && triage.length) {
    var tFrag = cloneTemplate('tpl-print-report-triage-wrap');
    if (tFrag && tFrag.firstElementChild) {
      var tWrap = tFrag.firstElementChild;
      var list = tWrap.querySelector('[data-list="items"]');
      triage.forEach(function(t) {
        var iFrag = cloneTemplate('tpl-print-report-triage-item');
        if (!iFrag || !iFrag.firstElementChild) return;
        fillTemplate(iFrag.firstElementChild, {
          action: t.action.replace(/_/g, ' '),
          sev: '(' + t.sev + ')'
        });
        if (list) list.appendChild(iFrag.firstElementChild);
      });
      triageHost.appendChild(tWrap);
    }
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<title>EvaEraHealth Wellness Report — ' + name + '</title>'
    + '<link rel="stylesheet" href="css/print-report.css">'
    + '</head><body class="print-report-body">'
    + bodyEl.outerHTML
    + '</body></html>';

  var blob = new Blob([html], {type:'text/html'});
  var url  = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'EvaEraHealth_Report_'+name.replace(/\s+/g,'_')+'.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
window.downloadUserReport = downloadUserReport;