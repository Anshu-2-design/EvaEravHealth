/* Wearable Corroboration Engine */

function setSexualActivityStatus(val, el) {
  setAns('sexual_activity_status', val);
  // Gate: if not sexually active by health reason, mark FSFI as not applicable
  S.flags.sexuallyActive = (val === 'sexually_active' || val === 'prefer_not_say');
  // Visual selection
  el.closest('.cards') && el.closest('.cards').querySelectorAll('.card-opt').forEach(function(c){c.classList.remove('selected');});
  el.classList.add('selected');
}

var WEARABLE_CORROBORATION = [
  // HRV (autonomic stress — corroborates PSS-8) 
  {key:'avg_hrv',    label:'HRV (RMSSD)',          corroborates:'PSS8',
   rules:[
     {cond:function(v){return v<20;},  mod:5,  action:'stress_management_program',sev:'moderate',note:'HRV <20ms — severe autonomic dysregulation, confirms high stress burden'},
     {cond:function(v){return v<30;},  mod:3,  action:'stress_management_program',sev:'mild',    note:'HRV <30ms — elevated sympathetic tone, corroborates PSS-8 elevation'},
     {cond:function(v){return v>=50;}, mod:-2, action:null,                        sev:null,      note:'HRV ≥50ms — good autonomic recovery (positive)'}
   ]},                                                            
  // RHR (cardiovascular load — corroborates vasomotor) 
  {key:'avg_rhr',    label:'Resting Heart Rate',   corroborates:'MENQOL_vasomotor',
   rules:[
     {cond:function(v){return v>85;},  mod:4,  action:'gurugram_clinic',            sev:'moderate',note:'RHR >85 bpm — elevated cardiovascular burden, vasomotor + cardiac review needed'},
     {cond:function(v){return v>75;},  mod:2,  action:'exercise_program',           sev:'mild',    note:'RHR >75 bpm — reduced cardiovascular fitness, exercise prescribed'},
     {cond:function(v){return v<60;},  mod:-1, action:null,                         sev:null,      note:'RHR <60 bpm — excellent cardiovascular fitness (positive)'}
   ]},                                                                                
  // Sleep duration (objective — corroborates ISI) 
  {key:'avg_sleep',  label:'Sleep Duration',        corroborates:'ISI',
   rules:[
     {cond:function(v){return v<5.5;}, mod:7,  action:'sleep_recovery_program',    sev:'severe',  note:'Objective sleep <5.5h — confirms severe insomnia burden (ISI corroborated)'},
     {cond:function(v){return v<6.5;}, mod:4,  action:'sleep_recovery_program',    sev:'moderate',note:'Objective sleep <6.5h — below NSF recommended minimum, confirms ISI burden'},
     {cond:function(v){return v<7.0;}, mod:1,  action:'sleep_recovery_program',    sev:'mild',    note:'Objective sleep <7h — below target'},
     {cond:function(v){return v>=8.0;},mod:-2, action:null,                         sev:null,      note:'Sleep ≥8h — optimal (positive indicator)'}
   ]},
  // Night sweats (objective — directly corroborates vasomotor)
  {key:'night_sweats_per_night',label:'Night Sweats',corroborates:'MENQOL_vasomotor',
   rules:[
     {cond:function(v){return v>=4;},  mod:6,  action:'recommend_menopause_program',sev:'severe',  note:'≥4 night sweats/night — severe objective vasomotor activity confirmed by device'},
     {cond:function(v){return v>=2;},  mod:3,  action:'recommend_menopause_program',sev:'moderate',note:'≥2 night sweats/night — significant vasomotor activity confirmed'},
     {cond:function(v){return v>=1;},  mod:1,  action:'recommend_menopause_program',sev:'mild',    note:'≥1 night sweat/night — vasomotor activity present'}
   ]},
  // Device stress score (corroborates PSS-8) 
  {key:'avg_stress', label:'Device Stress Score',  corroborates:'PSS8',
   rules:[
     {cond:function(v){return v>75;},  mod:4,  action:'stress_management_program', sev:'moderate',note:'Device stress >75/100 — corroborates high PSS-8 burden'},
     {cond:function(v){return v>55;},  mod:2,  action:'stress_management_program', sev:'mild',    note:'Device stress >55 — elevated, consistent with PSS-8 findings'},
     {cond:function(v){return v<25;},  mod:-2, action:null,                         sev:null,      note:'Device stress <25 — low (positive)'}
   ]},
  // Step count (activity — corroborates physical domain) 
  {key:'avg_steps',  label:'Daily Steps',           corroborates:'MENQOL_physical',
   rules:[
     {cond:function(v){return v<3000;},mod:3,  action:'exercise_program',           sev:'moderate',note:'Steps <3000/day — very low activity, corroborates physical burden'},
     {cond:function(v){return v<5000;},mod:1,  action:'exercise_program',           sev:'mild',    note:'Steps <5000/day — sedentary, physical programme recommended'},
     {cond:function(v){return v>=8000;},mod:-2,action:null,                         sev:null,      note:'Steps ≥8000/day — good activity (protective)'}
   ]},
  // SpO2 (independent safety check — not mapped to questionnaire) 
  {key:'avg_spo2',   label:'Blood Oxygen SpO₂',     corroborates:'ISI',
   rules:[
     {cond:function(v){return v<93;},  mod:8,  action:'gurugram_clinic',            sev:'severe',  note:'SpO2 <93% — requires immediate clinical review, possible sleep apnoea'},
     {cond:function(v){return v<95;},  mod:4,  action:'gurugram_clinic',            sev:'moderate',note:'SpO2 <95% — reduced oxygen, possible sleep-disordered breathing'}
   ]},
  // Active minutes (WHO-based — corroborates physical) 
  {key:'avg_active_minutes',label:'Active Minutes',  corroborates:'MENQOL_physical',
   rules:[
     {cond:function(v){return v<15;},  mod:2,  action:'exercise_program',           sev:'moderate',note:'Active minutes <15/day — very sedentary, physical programme needed'},
     {cond:function(v){return v>=30;}, mod:-2, action:null,                         sev:null,      note:'Active minutes ≥30/day — WHO target met (protective)'},
     {cond:function(v){return v>=60;}, mod:-3, action:null,                         sev:null,      note:'Active minutes ≥60/day — excellent activity level'}
   ]}
,
  {key:'avg_skin_temp', label:'Skin Temperature',   corroborates:'MENQOL_vasomotor',
   rules:[
     {cond:function(v){return v>38.0;},mod:5,  action:'gurugram_clinic',            sev:'moderate',note:'Skin temp >38°C — persistent fever / severe vasomotor'},
     {cond:function(v){return v>37.5;},mod:3,  action:'recommend_menopause_program',sev:'mild',    note:'Elevated skin temp >37.5°C — thermal dysregulation corroborates vasomotor'},
     {cond:function(v){return v<35.0;},mod:2,  action:'nutrition_guidance',         sev:'mild',    note:'Low skin temp <35°C — possible hypothyroid pattern'}
   ]},
  {key:'avg_distance_km',label:'Daily Distance',     corroborates:'MENQOL_physical',
   rules:[
     {cond:function(v){return v<2.0;}, mod:3,  action:'exercise_program',           sev:'moderate',note:'Distance <2km/day — very low mobility'},
     {cond:function(v){return v<4.0;}, mod:1,  action:'exercise_program',           sev:'mild',    note:'Distance <4km/day — below active threshold'},
     {cond:function(v){return v>=6.0;},mod:-2, action:null,                         sev:null,      note:'Distance ≥6km/day — good mobility (protective)'}
   ]},
  {key:'avg_resp_rate',  label:'Respiratory Rate',   corroborates:'ISI',
   rules:[
     {cond:function(v){return v>20;},  mod:3,  action:'sleep_recovery_program',     sev:'mild',    note:'Resp rate >20/min — possible sleep-disordered breathing'},
     {cond:function(v){return v<10;},  mod:2,  action:'gurugram_clinic',            sev:'mild',    note:'Low resp rate <10/min — bradypnea, clinical evaluation recommended'}
   ]},
  {key:'avg_hrv_night',  label:'Nocturnal HRV',      corroborates:'ISI',
   rules:[
     {cond:function(v){return v<15;},  mod:6,  action:'sleep_recovery_program',     sev:'severe',  note:'Nocturnal HRV <15ms — severe autonomic suppression during sleep'},
     {cond:function(v){return v<25;},  mod:3,  action:'stress_management_program',  sev:'moderate',note:'Nocturnal HRV <25ms — elevated sympathetic dominance during sleep'}
   ]}
]


function calcWearableMod(answers) {
  var wd = answers.wearable_data || {};
  if(!answers.wearable || answers.wearable === 'None / No wearable') {
    return {mod:0, actions:[], notes:[], corroboration:[]};
  }
  var totalMod = 0;
  var triggeredActions = {};
  var notes = [];
  var corroboration = [];
  var sevOrder = {severe:3, moderate:2, mild:1};

  WEARABLE_CORROBORATION.forEach(function(metric) {
    var val = parseFloat(wd[metric.key]);
    if(isNaN(val) || val === null || val === undefined) return;

    // Find the first matching rule (rules are ordered most severe first)
    var matched = false;
    metric.rules.forEach(function(rule) {
      if(matched) return; // only first matching rule fires per metric
      if(rule.cond(val)) {
        matched = true;
        totalMod += rule.mod;
        notes.push(metric.label + ': ' + rule.note);
        corroboration.push({
          metric: metric.key,
          label: metric.label,
          value: val,
          corroborates: metric.corroborates,
          modifier: rule.mod,
          action: rule.action,
          severity: rule.sev,
          note: rule.note
        });
        if(rule.action) {
          if(!triggeredActions[rule.action]) {
            triggeredActions[rule.action] = {sev: rule.sev, rules:[]};
          }
          triggeredActions[rule.action].rules.push('WRB_' + metric.key.toUpperCase());
          if(sevOrder[rule.sev] > sevOrder[triggeredActions[rule.action].sev]) {
            triggeredActions[rule.action].sev = rule.sev;
          }
        }
      }
    });
  });

  var actionList = Object.entries(triggeredActions).map(function(e) {
    return {action: e[0], sev: e[1].sev, rules: e[1].rules, source: 'wearable'};
  });

  return {
    mod: totalMod,
    actions: actionList,
    notes: notes,
    corroboration: corroboration
  };
}

