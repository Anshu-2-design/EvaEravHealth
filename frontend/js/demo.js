/* Demo Fill & Quick Test Utilities */

function quickDemoFill(){
  // Populate all demo answers
  S.answers.name='Demo Patient';
  S.answers.age=48;
  S.answers.city='Gurugram';
  S.answers.country='India';
  S.answers.stage='Menopause (<1yr)';
  S.answers.ethnicity='South Asian';
  S.answers.hrt_history='Considering HRT';
  S.answers.parity='2';
  S.answers.smoking_history='Never smoked';
  S.answers.alcohol_use='Non-drinker';
  S.answers.marital='Married';
  S.answers.occupation='Professional';
  S.answers.education='Postgraduate';
  S.answers.height_cm=160;
  S.answers.weight_kg=68;
  S.answers.menstrual_pattern='Irregular cycles';

  // Red flags — all NO (safe demo, no hard stop)
  S.answers.rf1=0; S.answers.rf2=0; S.answers.rf3=0;

  // MenQOL — moderate-severity (4-5 out of 7)
  ['mq_v1','mq_v2','mq_v3','mq_v4','mq_v5','mq_v6'].forEach(function(k){S.answers[k]=5;});
  ['mq_p1','mq_p2','mq_p3','mq_p4','mq_p5','mq_p6','mq_p7','mq_p8'].forEach(function(k){S.answers[k]=4;});
  ['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'].forEach(function(k){S.answers[k]=5;});
  ['mq_s1','mq_s2','mq_s3'].forEach(function(k){S.answers[k]=4;});

  // PHQ-9 — keys phq_0..phq_8 (0-indexed); item 9 = 0 (no suicidal ideation)
  [0,1,2,3,4,5,6,7].forEach(function(i){S.answers['phq_'+i]=i<4?2:1;});
  S.answers['phq_8']=0;

  // GAD-7 — keys gad_0..gad_6
  [0,1,2,3,4,5,6].forEach(function(i){S.answers['gad_'+i]=i<3?2:1;});

  // PSS-8 — keys pss_0..pss_7
  [0,1,2,3,4,5,6,7].forEach(function(i){S.answers['pss_'+i]=i<4?2:1;});

  // ISI — keys isi_0..isi_6
  [0,1,2,3,4,5,6].forEach(function(i){S.answers['isi_'+i]=i<3?2:1;});

  // Prakriti & Vikriti
  S.answers.prakriti='Vata-Pitta';
  S.answers.vikriti='Vata_Pitta_excess';
  // Wearable data

  S.answers.wearable='Apple Watch Series 9';
  S.answers.wearable_data={avg_rhr:78,avg_hrv:28,avg_spo2:97,avg_sleep:5.9,avg_steps:4800,avg_stress:58,night_sweats_per_night:2};
  
  // Comorbidities
  S.answers.comorbidities={Hypothyroidism:'Controlled'};

  // Set all required flags
  S.flags.mentalHealthCompleted=true;
  S.flags.sleepModerate=true;
  S.flags.menqolPsychTriggered=true;
  S.flags.menqolSexualTriggered=false;
  S.answers.gate_psych_choice='no';
  S.answers.gate_sexual_choice='no';
  S.answers.psychosexual_skipped=true;

  // Go straight to processing (no navigation, no confirm dialog)
  startProcessing();
}
// Legacy alias — unused but kept for safety
// function quickDemoFillFromLauncher(){ quickDemoFill(); }
function quickDemoFillFromLauncher(){
  document.getElementById('int-launcher').style.display = 'none'; // ADD THIS
  quickDemoFill();
}

document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('[data-action="quickDemoFillFromLauncher"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',quickDemoFillFromLauncher);}
  });
  document.querySelectorAll('[data-action="quickDemoFill"]').forEach(function(el){
    if(!el.dataset.boundAction){el.dataset.boundAction='1';el.addEventListener('click',quickDemoFill);}
  });
});
function _fillDemoAnswers(){ quickDemoFill(); }

function _fillDemoAnswers_UNUSED(){
  // Demographics
  S.answers.name='Demo Patient';
  S.answers.age=48;
  S.answers.city='Gurugram';
  S.answers.country='India';
  S.answers.stage='Menopause (<1yr)';
  S.answers.ethnicity='South Asian';
  S.answers.hrt_history='Considering HRT';
  S.answers.parity='2';
  S.answers.smoking_history='Never smoked';
  S.answers.alcohol_use='Non-drinker';
  S.answers.marital='Married';
  S.answers.height_cm=160;
  S.answers.weight_kg=68;
  // Red flags — all NO (no hard stop)
  S.answers.rf1=0; S.answers.rf2=0; S.answers.rf3=0;
  // MenQOL — moderate-severity answers (4-5 out of 7)
  ['mq_v1','mq_v2','mq_v3','mq_v4','mq_v5','mq_v6'].forEach(function(k){S.answers[k]=5;});
  ['mq_p1','mq_p2','mq_p3','mq_p4','mq_p5','mq_p6','mq_p7','mq_p8'].forEach(function(k){S.answers[k]=4;});
  ['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'].forEach(function(k){S.answers[k]=5;});
  ['mq_s1','mq_s2','mq_s3'].forEach(function(k){S.answers[k]=4;});
  // PHQ-9 — keys are phq_0..phq_8 (0-indexed)
  [0,1,2,3,4,5,6,7].forEach(function(i){S.answers['phq_'+i]=i<4?2:1;});
  S.answers['phq_8']=0; // item 9 = 0 — no suicidal ideation (safe demo)
  // GAD-7 — keys are gad_0..gad_6
  [0,1,2,3,4,5,6].forEach(function(i){S.answers['gad_'+i]=i<3?2:1;});
  // PSS-8 — keys are pss_0..pss_7
  [0,1,2,3,4,5,6,7].forEach(function(i){S.answers['pss_'+i]=i<4?2:1;});
  // ISI — keys are isi_0..isi_6
  [0,1,2,3,4,5,6].forEach(function(i){S.answers['isi_'+i]=i<3?2:1;});
  // Set mental health module flags
  S.flags.mentalHealthCompleted=true;
  // Gate choices — include mental health, skip sexual for demo speed
  S.answers.gate_psych_choice='no';
  S.answers.gate_sexual_choice='no';
  S.answers.gate_sleep_choice='no';
  // Prakriti & Vikriti — correct casing
  S.answers.prakriti='Vata-Pitta';
  S.answers.vikriti='Vata_Pitta_excess';
  // Wearable — moderate data for demo
  S.answers.wearable='Apple Watch Series 9';
  S.answers.wearable_data={avg_rhr:78,avg_hrv:28,avg_spo2:97,avg_sleep:5.9,avg_steps:4800,avg_stress:58,night_sweats_per_night:2};
  // Comorbidities — minor controlled
  S.answers.comorbidities={Hypothyroidism:'Controlled'};
  // Trigger flags from MenQOL scores
  var _psScore=(['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'].reduce(function(s,k){return s+(S.answers[k]||0);},0));
  S.flags.menqolPsychTriggered=_psScore>=14;
  var _sxScore=(['mq_s1','mq_s2','mq_s3'].reduce(function(s,k){return s+(S.answers[k]||0);},0));
  S.flags.menqolSexualTriggered=_sxScore>=8;
  S.flags.sleepModerate=true;
  // end of _fillDemoAnswers_UNUSED (not called)
}
