/* Scoring Engine — Rules, Compute & Save */

var EVR_RULES = [
  {id:"EVR_VM01",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:5, sev:"mild",    action:"recommend_menopause_program"},
  {id:"EVR_VM02",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:10,sev:"moderate",action:"recommend_menopause_program"},
  {id:"EVR_VM03",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:14,sev:"moderate",action:"gurugram_clinic"},
  {id:"EVR_VM04",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:17,sev:"severe",  action:"gurugram_clinic"},
  {id:"EVR_VM05",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:8, sev:"mild",    action:"exercise_program"},
  {id:"EVR_VM06",dom:"vasomotor",inst:"MENQOL_vasomotor",op:">=",thresh:10,sev:"moderate",action:"nutrition_guidance"},
  {id:"EVR_PH01",dom:"physical",inst:"MENQOL_physical",op:">=",thresh:5, sev:"mild",    action:"exercise_program"},
  {id:"EVR_PH02",dom:"physical",inst:"MENQOL_physical",op:">=",thresh:10,sev:"moderate",action:"exercise_program"},
  {id:"EVR_PH03",dom:"physical",inst:"MENQOL_physical",op:">=",thresh:12,sev:"moderate",action:"nutrition_guidance"},
  {id:"EVR_PH04",dom:"physical",inst:"MENQOL_physical",op:">=",thresh:12,sev:"moderate",action:"recommend_menopause_program"},
  {id:"EVR_PH05",dom:"physical",inst:"MENQOL_physical",op:">=",thresh:16,sev:"severe",  action:"gurugram_clinic"},
  {id:"EVR_PS01",dom:"psychosocial",inst:"MENQOL_psychosocial",op:">=",thresh:5, sev:"mild",    action:"stress_management_program"},
  {id:"EVR_PS02",dom:"psychosocial",inst:"MENQOL_psychosocial",op:">=",thresh:10,sev:"moderate",action:"stress_management_program"},
  {id:"EVR_PS03",dom:"psychosocial",inst:"MENQOL_psychosocial",op:">=",thresh:12,sev:"moderate",action:"psychologist_referral"},
  {id:"EVR_PS04",dom:"psychosocial",inst:"MENQOL_psychosocial",op:">=",thresh:16,sev:"severe",  action:"psychologist_referral"},
  {id:"EVR_SX01",dom:"sexual",inst:"MENQOL_sexual",op:">=",thresh:5, sev:"mild",    action:"sexual_wellbeing_program"},
  {id:"EVR_SX02",dom:"sexual",inst:"MENQOL_sexual",op:">=",thresh:10,sev:"moderate",action:"sexual_wellbeing_program"},
  {id:"EVR_SX03",dom:"sexual",inst:"MENQOL_sexual",op:">=",thresh:12,sev:"moderate",action:"activate_psychosexual_module"},
  {id:"EVR_SX04",dom:"sexual",inst:"MENQOL_sexual",op:">=",thresh:16,sev:"severe",  action:"sexual_therapy_pathway"},
  {id:"EVR_PHQ01",dom:"depression",inst:"PHQ9",op:">=",thresh:5, sev:"mild",    action:"stress_management_program"},
  {id:"EVR_PHQ02",dom:"depression",inst:"PHQ9",op:">=",thresh:10,sev:"moderate",action:"stress_management_program"},
  {id:"EVR_PHQ03",dom:"depression",inst:"PHQ9",op:">=",thresh:10,sev:"moderate",action:"psychologist_referral"},
  {id:"EVR_PHQ04",dom:"depression",inst:"PHQ9",op:">=",thresh:15,sev:"severe",  action:"psychologist_referral"},
  {id:"EVR_PHQ05",dom:"depression",inst:"PHQ9",op:">=",thresh:15,sev:"severe",  action:"gurugram_clinic"},
  {id:"EVR_GAD01",dom:"anxiety",inst:"GAD7",op:">=",thresh:5, sev:"mild",    action:"stress_management_program"},
  {id:"EVR_GAD02",dom:"anxiety",inst:"GAD7",op:">=",thresh:10,sev:"moderate",action:"stress_management_program"},
  {id:"EVR_GAD03",dom:"anxiety",inst:"GAD7",op:">=",thresh:10,sev:"moderate",action:"psychologist_referral"},
  {id:"EVR_GAD04",dom:"anxiety",inst:"GAD7",op:">=",thresh:15,sev:"severe",  action:"psychologist_referral"},
  {id:"EVR_PSS01",dom:"stress",inst:"PSS8",op:">=",thresh:12,sev:"mild",    action:"stress_management_program"},
  {id:"EVR_PSS02",dom:"stress",inst:"PSS8",op:">=",thresh:21,sev:"moderate",action:"stress_management_program"},
  {id:"EVR_PSS03",dom:"stress",inst:"PSS8",op:">=",thresh:21,sev:"moderate",action:"exercise_program"},
  {id:"EVR_PSS04",dom:"stress",inst:"PSS8",op:">=",thresh:21,sev:"moderate",action:"nutrition_guidance"},
  {id:"EVR_PSS05",dom:"stress",inst:"PSS8",op:">=",thresh:22,sev:"severe",  action:"psychologist_referral"},
  {id:"EVR_ISI01",dom:"sleep",inst:"ISI",op:">=",thresh:8, sev:"mild",    action:"sleep_recovery_program"},
  {id:"EVR_ISI02",dom:"sleep",inst:"ISI",op:">=",thresh:15,sev:"moderate",action:"sleep_recovery_program"},
  {id:"EVR_ISI03",dom:"sleep",inst:"ISI",op:">=",thresh:22,sev:"severe",  action:"sleep_recovery_program"},
  {id:"EVR_ISI04",dom:"sleep",inst:"ISI",op:">=",thresh:15,sev:"moderate",action:"gurugram_clinic"},
    {id:"EVR_FSF01",dom:"sexual_function",inst:"FSFI",op:"<=",thresh:26.55,sev:"mild",    action:"sexual_wellbeing_program"},
  {id:"EVR_FSF02",dom:"sexual_function",inst:"FSFI",op:"<=",thresh:20,   sev:"moderate",action:"sexual_therapy_pathway"},
  {id:"EVR_FSF03",dom:"sexual_function",inst:"FSFI",op:"<=",thresh:15,   sev:"severe",  action:"sexual_therapy_pathway"},
  {id:"EVR_FSF04",dom:"sexual_function",inst:"FSFI",op:"<=",thresh:20,   sev:"moderate",action:"relationship_counselling"},
  {id:"EVR_FSF05",dom:"sexual_function",inst:"FSFI",op:"<=",thresh:26.55,sev:"mild",    action:"gurugram_clinic"},
  {id:"EVR_FSD01",dom:"sexual_distress",inst:"FSDSR",op:">=",thresh:11,sev:"mild",    action:"sexual_wellbeing_program"},
  {id:"EVR_FSD02",dom:"sexual_distress",inst:"FSDSR",op:">=",thresh:20,sev:"moderate",action:"sexual_therapy_pathway"},
  {id:"EVR_FSD03",dom:"sexual_distress",inst:"FSDSR",op:">=",thresh:28,sev:"severe",  action:"sexual_therapy_pathway"},
  {id:"EVR_FSD04",dom:"sexual_distress",inst:"FSDSR",op:">=",thresh:20,sev:"moderate",action:"relationship_counselling"},
  {id:"EVR_MCS01",dom:"relationship",inst:"MCSS",op:"<=",thresh:8, sev:"mild",    action:"relationship_counselling"},
  {id:"EVR_MCS02",dom:"relationship",inst:"MCSS",op:"<=",thresh:8, sev:"mild",    action:"sexual_wellbeing_program"},
  {id:"EVR_MCS03",dom:"relationship",inst:"MCSS",op:"<=",thresh:5, sev:"moderate",action:"relationship_counselling"},
  {id:"EVR_CMP01",dom:"composite",inst:"composite",op:">=",thresh:6, sev:"mild",    action:"recommend_menopause_program"},
  {id:"EVR_CMP02",dom:"composite",inst:"composite",op:">=",thresh:31,sev:"moderate",action:"gurugram_clinic"},
  {id:"EVR_CMP03",dom:"composite",inst:"composite",op:">=",thresh:56,sev:"severe",  action:"gurugram_clinic"},
  {id:"EVR_CMP04",dom:"composite",inst:"composite",op:">=",thresh:81,sev:"severe",  action:"gurugram_clinic"},
];
var CORE_RULES = [
  {id:"R1",condition:function(sc){ return sc.PHQ9_item9 > 0; },action:"psychiatric_alert",sev:"severe"},
  {id:"R2",condition:function(sc){ return (S.flags&&S.flags.sexuallyActive)&&sc.FSFI!==null&&sc.FSDSR!==null&&sc.FSFI<=19&&sc.FSDSR>=11; },action:"sexual_therapy_pathway",sev:"moderate"},
  {id:"R3",condition:function(sc){ return sc.MENQOL_sexual > 6; },action:"activate_psychosexual_module",sev:"mild"},
  {id:"R4",condition:function(sc){ return sc.rf1 === 'Yes'; },action:"gynecology_referral",sev:"severe"},
  {id:"R5",condition:function(sc){ var a=S.answers||{}; return !!(a.fam_breast_cancer||a.fam_ovarian_cancer); },action:"gynecology_referral",sev:"mild"},
  {id:"R6",condition:function(sc){ var a=S.answers||{}; return !!(a.fam_cvd); },action:"exercise_program",sev:"mild"},
  {id:"R7",condition:function(sc){ var a=S.answers||{}; return a.alcohol_use==='Heavy (>7 drinks/week)'; },action:"stress_management_program",sev:"moderate"},
  {id:"R8",condition:function(sc){ var a=S.answers||{}; if(!a.height_cm||!a.weight_kg)return false; return (a.weight_kg/Math.pow(a.height_cm/100,2))>30; },action:"nutrition_guidance",sev:"mild"},
  {id:"R9",condition:function(sc){ var a=S.answers||{}; return !!(a.med_ssri&&sc.PHQ9>=5); },action:"psychologist_referral",sev:"mild"},
  {id:"R10",condition:function(sc){ return sc.MENQOL_sexual>=14&&(!S.flags.psychosexualCompleted); },action:"sexual_therapy_pathway",sev:"moderate"},
];
var PRAKRITI_WEIGHTS = {
  'Vata':       {vm:0.22, ph:0.18, ps:0.28, sx:0.28, mh:0.28, sl:0.28, se:0.25, li:0.20},
  'Pitta':      {vm:0.30, ph:0.25, ps:0.20, sx:0.18, mh:0.22, sl:0.18, se:0.22, li:0.18},
  'Kapha':      {vm:0.20, ph:0.22, ps:0.18, sx:0.20, mh:0.18, sl:0.20, se:0.20, li:0.25},
  'Vata-Pitta': {vm:0.26, ph:0.22, ps:0.24, sx:0.23, mh:0.25, sl:0.23, se:0.22, li:0.19},
  'Tridosha':   {vm:0.25, ph:0.22, ps:0.20, sx:0.20, mh:0.22, sl:0.20, se:0.22, li:0.20}
};

var VIKRITI_IMBALANCE = {
  //                Vata_ex  Pitta_ex  Kapha_ex  VP_ex  Mixed  Balanced
  'Vata':          [  1,       3,        6,        1,     3,     -2  ],
  'Pitta':         [  3,       1,        3,        1,     3,     -2  ],
  'Kapha':         [  6,       3,        1,        3,     3,     -2  ],
  'Vata-Pitta':    [  1,       1,        6,        1,     1,     -2  ],
  'Tridosha':      [  2,       2,        2,        2,     2,     -4  ]
};
var VIKRITI_ORDER = ['Vata_excess','Pitta_excess','Kapha_excess','Vata_Pitta_excess','Mixed','Balanced'];

function calcVikritImbablance(prakriti, vikriti) {
  if(!vikriti || vikriti === '—') return 0;
  var row = VIKRITI_IMBALANCE[prakriti] || VIKRITI_IMBALANCE['Tridosha'];
  var idx = VIKRITI_ORDER.indexOf(vikriti);
  if(idx < 0) return 0;
  return row[idx]; // modifier added directly to composite
}

function avg(keys, a) {
  var sum = 0;
  keys.forEach(function(k) { sum += (a[k] || 1); });
  return sum / keys.length;
}
function calcComorbidityMod(comor) {
  var mod = 0;
  var table = {
    'Hypertension':         {Controlled:6,  Uncontrolled:14, 'Not Sure':8 },
    'Diabetes':             {Controlled:8,  Uncontrolled:16, 'Not Sure':10},
    'Hypothyroidism':       {Controlled:5,  Uncontrolled:11, 'Not Sure':7 },
    'Hyperthyroidism':      {Controlled:4,  Uncontrolled:9,  'Not Sure':5 },
    'Hyperlipidemia':       {Controlled:4,  Uncontrolled:9,  'Not Sure':5 },
    'Anaemia':              {Controlled:4,  Uncontrolled:9,  'Not Sure':5 },
    'PCOD':                 {Controlled:8,  Uncontrolled:12, 'Not Sure':9 },
    'Osteoporosis':         {Controlled:7,  Uncontrolled:12, 'Not Sure':8 },
    'Heart Disease':        {Controlled:12, Uncontrolled:18, 'Not Sure':13},
    'CKD':                  {Controlled:9,  Uncontrolled:14, 'Not Sure':10},
    'Autoimmune Disorder':  {Controlled:7,  Uncontrolled:12, 'Not Sure':8 },
    'Stroke (history)':     {Controlled:11, Uncontrolled:16, 'Not Sure':12},
    'Cancer (history)':     {Controlled:11, Uncontrolled:16, 'Not Sure':12},
    'Depression':           {Controlled:7,  Uncontrolled:13, 'Not Sure':8 },
    'Anxiety Disorder':     {Controlled:6,  Uncontrolled:11, 'Not Sure':7 },
    'Fibromyalgia':         {Controlled:8,  Uncontrolled:13, 'Not Sure':9 },
    'Endometriosis':        {Controlled:8,  Uncontrolled:12, 'Not Sure':9 }
  };
  Object.keys(comor || {}).forEach(function(cond) {
    var status = comor[cond];
    if (table[cond]) {
      if (table[cond][status]) {
        mod += table[cond][status];
      } else if (status === 'Not Sure' && table[cond]) {
        mod += table[cond]['Not Sure'] || Math.round((table[cond]['Controlled']||0)*0.6);
      }
    }
  });
  return mod;
}
function downloadHCPJSON() {
  var p = S.selectedPatient;
  if (!p) { alert('No patient selected'); return; }
  var blob = new Blob([JSON.stringify(p, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'EvaEraHealth_' + (p.name || 'Patient').replace(/\s/g,'_') + '_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
function computeScores() {
  var a = S.answers;
  var sc = {};
  var vm = ['mq_v1','mq_v2','mq_v3','mq_v4','mq_v5','mq_v6'];
  var ph = ['mq_p1','mq_p2','mq_p3','mq_p4','mq_p5','mq_p6','mq_p7','mq_p8'];
  var ps = ['mq_ps1','mq_ps2','mq_ps3','mq_ps4','mq_ps5','mq_ps6','mq_ps7'];
  var sx = ['mq_s1','mq_s2','mq_s3'];
  // DEF-07: Standardised to computeMenQOLDomain formula (0 at baseline, consistent with gate trigger)
  sc.MENQOL_vasomotor    = computeMenQOLDomain(vm, 48, a);
  sc.MENQOL_physical     = computeMenQOLDomain(ph, 64, a);
  sc.MENQOL_psychosocial = computeMenQOLDomain(ps, 56, a);
  sc.MENQOL_sexual       = computeMenQOLDomain(sx, 24, a);
  sc.PHQ9 = 0;
  for(var i=0;i<9;i++) sc.PHQ9 += (a['phq_'+i]||0);
  sc.PHQ9_item9 = a['phq_8']||0;
  sc.PHQ9_band = sc.PHQ9<=4?'Minimal':sc.PHQ9<=9?'Mild':sc.PHQ9<=14?'Moderate':sc.PHQ9<=19?'Moderately Severe':'Severe';
  sc.GAD7 = 0;
  for(var i=0;i<7;i++) sc.GAD7 += (a['gad_'+i]||0);
  sc.GAD7_band = sc.GAD7<=4?'Minimal':sc.GAD7<=9?'Mild':sc.GAD7<=14?'Moderate':'Severe';
  // PSS-8: Cohen & Williamson 1988. Reverse items: 4,5,7,8 (1-indexed)
  // DIRECT: items 1,2,3,6 | REVERSE: items 4,5,7,8 | Validated per Cohen 1988
  var pssReverse = [false, false, false, true, true, false, true, true];
  var pssAnswered = [0,1,2,3,4,5,6,7].filter(function(i){return a['pss_'+i]!==undefined;}).length;
  if(pssAnswered >= 6) {
    sc.PSS8 = 0;
    for(var i=0;i<8;i++) {
      var pssRaw = (a['pss_'+i] !== undefined) ? a['pss_'+i] : 2;
      sc.PSS8 += pssReverse[i] ? (4 - pssRaw) : pssRaw;
    }
    // Evidence: Warttig et al. 2013 — Low:0-11, Moderate:12-21, High:22-32
    sc.PSS8_band = sc.PSS8<=11?'Low':sc.PSS8<=21?'Moderate':'High';
  } else {
    sc.PSS8 = null;
    sc.PSS8_band = 'Not assessed';
  }
  sc.ISI = 0;
  for(var i=0;i<7;i++) sc.ISI += (a['isi_'+i]||0);
  sc.ISI_band = sc.ISI<=7?'None':sc.ISI<=14?'Subthreshold':sc.ISI<=21?'Moderate':'Severe';
  // Psychosexual scoring: only if BOTH flag AND answers indicate completion
  // psychosexual_skipped=true means user declined OR never reached the module
  var fsfiAnsweredCount = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]
    .filter(function(i){ return a['fsfi_'+i] !== undefined && a['fsfi_'+i] > 0; }).length;
  var psychosexualDone = S.flags.psychosexualCompleted && !a.psychosexual_skipped && fsfiAnsweredCount >= 15;
  if(psychosexualDone) {
    // FSFI: Rosen et al. 2000. Items 1,2,14,15 scale 1-5 (floor=1); items 3-13,16-19 scale 0-5 (0=no activity).
    function fsfiItm(key,floor1){var v=a[key];if(v===undefined||v===null)return floor1?1:0;return floor1?Math.max(1,v):Math.max(0,v);}
    var fd=(fsfiItm('fsfi_1',true)+fsfiItm('fsfi_2',true))*0.6;
    var fa=(fsfiItm('fsfi_3',false)+fsfiItm('fsfi_4',false)+fsfiItm('fsfi_5',false)+fsfiItm('fsfi_6',false))*0.3;
    var fl=(fsfiItm('fsfi_7',false)+fsfiItm('fsfi_8',false)+fsfiItm('fsfi_9',false)+fsfiItm('fsfi_10',false))*0.3;
    var fo=(fsfiItm('fsfi_11',false)+fsfiItm('fsfi_12',false)+fsfiItm('fsfi_13',false))*0.4;
    var fss=(fsfiItm('fsfi_14',true)+fsfiItm('fsfi_15',true)+fsfiItm('fsfi_16',false))*0.4;
    var fp=(fsfiItm('fsfi_17',false)+fsfiItm('fsfi_18',false)+fsfiItm('fsfi_19',false))*0.4;
    sc.FSFI=Math.round((fd+fa+fl+fo+fss+fp)*10)/10;
    sc.FSFI_domain={desire:{score:Math.round(fd*10)/10,cutoff:3.6,impaired:fd<=3.6},arousal:{score:Math.round(fa*10)/10,cutoff:3.9,impaired:fa<=3.9&&fa>0},lubrication:{score:Math.round(fl*10)/10,cutoff:4.1,impaired:fl<=4.1&&fl>0},orgasm:{score:Math.round(fo*10)/10,cutoff:3.9,impaired:fo<=3.9&&fo>0},satisfaction:{score:Math.round(fss*10)/10,cutoff:3.8,impaired:fss<=3.8},pain:{score:Math.round(fp*10)/10,cutoff:3.8,impaired:fp<=3.8&&fp>0}};
    sc.FSFI6=Math.round(fp*10)/10;
    sc.FSFI_impaired_domains=Object.values(sc.FSFI_domain).filter(function(d){return d.impaired;}).length;
    sc.FSFI_band=sc.FSFI<=26.55?(sc.FSFI<=15?'Severe Dysfunction':sc.FSFI<=20?'Moderate Dysfunction':'Mild Dysfunction'):'Normal Function';
    sc.FSDSR=0;
    for(var i=0;i<13;i++) sc.FSDSR+=(a['fsdsr_'+i]||0);
    sc.FSDSR_band=sc.FSDSR>=28?'Severe Sexual Distress':sc.FSDSR>=20?'Moderate Sexual Distress':sc.FSDSR>=11?'Mild Sexual Distress':'No Significant Distress';
  } else {
    sc.FSFI=null;sc.FSFI6=null;sc.FSDSR=null;sc.FSFI_domain=null;sc.FSFI_impaired_domains=null;
    sc.FSFI_band='Not assessed';sc.FSDSR_band='Not assessed';
  }
  // MCSS (not inside duplicate FSFI block — BUG FIXED)
  if(psychosexualDone) {
    sc.MCSS = 0;
    for(var i=1;i<=5;i++) sc.MCSS += (a['mcss_'+i]||0);
    sc.MCSS_band = sc.MCSS<=8?'Poor':sc.MCSS<=14?'Fair':'Good';
  } else { sc.MCSS = null; sc.MCSS_band = 'Not assessed'; }
  sc.rf1 = a.rf1===1?'Yes':a.rf1===2?'Not sure':'No';
  sc.rf2 = a.rf2===2?'Frequently':a.rf2===1?'Occasionally':'No';
  sc.rf3 = a.rf3===1?'Yes':'No';
  sc.comorbidityMod = calcComorbidityMod(a.comorbidities||{});
  var prakriti = a.prakriti || 'Tridosha';
  var W = PRAKRITI_WEIGHTS[prakriti] || PRAKRITI_WEIGHTS['Tridosha'];
  var stageVmMul=1.0, stagePhMul=1.0, stagePsMul=1.0;
  var stg = a.stage||'';
  if(stg==='Surgical Menopause')    {stageVmMul=1.30;stagePhMul=0.90;stagePsMul=1.10;}
  else if(stg==='Post-Menopause')   {stageVmMul=1.18;stagePhMul=0.92;stagePsMul=1.05;}
  else if(stg==='Menopause (<1yr)') {stageVmMul=1.10;stagePhMul=0.97;stagePsMul=1.02;}
  else if(stg==='Perimenopause')    {stageVmMul=0.95;stagePhMul=1.02;stagePsMul=0.98;}
  else if(stg==='Normal Cycle')     {stageVmMul=0.85;stagePhMul=1.00;stagePsMul=0.95;}
  var menopauseN=(sc.MENQOL_vasomotor/20*0.35*stageVmMul+sc.MENQOL_physical/20*0.35*stagePhMul+sc.MENQOL_psychosocial/20*0.20*stagePsMul+sc.MENQOL_sexual/20*0.10);
  var pss8Val=(sc.PSS8!==null)?sc.PSS8:null;
  var mentalN=(pss8Val!==null)?(sc.PHQ9/27*0.45+sc.GAD7/21*0.35+pss8Val/32*0.20):(sc.PHQ9/27*0.58+sc.GAD7/21*0.42);
  var sleepN=sc.ISI/28;
  var stressN=(pss8Val!==null)?(pss8Val/32):(sc.ISI/28*0.6+sc.PHQ9/27*0.4);
  var sexualN    = sc.FSFI !== null ? Math.max(0, Math.min(1, (1 - sc.FSFI/36)*0.5 + (sc.FSDSR/52)*0.5)) : stressN;
  // DEF-06: Lifestyle score computed from wearable + comorbidity data (replaces hardcoded 0.1)
  // Components: physical activity (steps + active mins), sleep adequacy, self-reported stress device score
  var lifestyleN = (function(){
    var wd = a.wearable_data || {};
    var hasWearable = a.wearable && a.wearable !== 'None / No wearable';
    if(!hasWearable) return 0.18; // FIXED: over-punitive default reduced
    // Activity score (0-1, higher = more burden from inactivity)
    var steps = parseFloat(wd.avg_steps) || 0;
    var activeMins = parseFloat(wd.avg_active_minutes) || 0;
    var activityScore = steps > 8000 && activeMins >= 30 ? 0.1
      : steps > 5000 ? 0.3
      : steps > 3000 ? 0.5
      : 0.7;
    // Sleep adequacy (wearable-reported)
    var sleepHrs = parseFloat(wd.avg_sleep) || 0;
    var sleepScore = sleepHrs >= 8 ? 0.1
      : sleepHrs >= 7 ? 0.2
      : sleepHrs >= 6 ? 0.45
      : sleepHrs > 0 ? 0.7 : 0.35;
    // Device stress score
    var devStress = parseFloat(wd.avg_stress) || 0;
    var stressScore = devStress > 75 ? 0.8
      : devStress > 55 ? 0.55
      : devStress > 25 ? 0.35
      : devStress > 0 ? 0.15 : 0.35;
    var riskBoost=0;
    if(a.alcohol_use==='Heavy (>7 drinks/week)') riskBoost+=0.15;
    else if(a.alcohol_use==='Moderate (2–7 drinks/week)') riskBoost+=0.07;
    if(a.smoking_history&&a.smoking_history.indexOf('Current')>=0) riskBoost+=0.10;
    var bmiR=(a.height_cm&&a.weight_kg)?(a.weight_kg/Math.pow(a.height_cm/100,2)):null;
    if(bmiR&&bmiR>30) riskBoost+=0.10; else if(bmiR&&bmiR>27.5) riskBoost+=0.05;
    return Math.min(1.0,(activityScore*0.5+sleepScore*0.3+stressScore*0.2)+riskBoost);
  })();
  var prakritiMul = {menopause: W.vm+W.ph, mental: W.mh, sleep: W.sl, sexual: W.se, lifestyle: W.li, stress: 1.0};
  // DEF-12: Normalisation divisors now use Tridosha neutral baseline (not Vata-centric)
  // Tridosha: vm=0.25, ph=0.22 → menopause_base=0.47; mh=0.22; sl=0.20; se=0.22
  // This eliminates systematic Pitta composite inflation (was: Pitta menopause weight = 0.55/0.40 = 1.375×)
  var raw =
    (menopauseN  * 0.30 * (prakritiMul.menopause/0.47)) +
    (mentalN     * 0.25 * (prakritiMul.mental/0.22))    +
    (sleepN      * 0.15 * (prakritiMul.sleep/0.20))     +
    (sexualN     * 0.15 * (prakritiMul.sexual/0.22))    +
    (stressN     * 0.05)                                 +
    (lifestyleN  * 0.10);
  // Vikriti imbalance modifier — deviation from Prakriti increases burden
  var vikritMod = calcVikritImbablance(prakriti, a.vikriti);
  sc.vikritMod = vikritMod;
  // Wearable corroboration modifier
  var wearableMod = calcWearableMod(a);
  sc.wearableMod = wearableMod.mod;
  sc.wearableCorroboration = wearableMod.corroboration;
  sc.wearableNotes = wearableMod.notes;
  // Composite: questionnaire + comorbidity + vikriti + wearable (all additive)
  var medMod=0;
  if(a.med_ssri) medMod+=2; if(a.med_antihyp) medMod+=3; if(a.med_insulin) medMod+=4;
  if(a.alcohol_use==='Heavy (>7 drinks/week)') medMod+=5; else if(a.alcohol_use==='Moderate (2–7 drinks/week)') medMod+=2;
  if(a.smoking_history&&a.smoking_history.indexOf('Current')>=0) medMod+=4;
  if(a.fam_breast_cancer||a.fam_ovarian_cancer) medMod+=2; if(a.fam_cvd) medMod+=2;
  sc.medMod=medMod;
  sc.composite = Math.max(0, Math.min(100, Math.round(raw*100+sc.comorbidityMod*0.45+vikritMod+wearableMod.mod+medMod)));
  // 5-BAND: Optimal(0-5) | Mild(6-30) | Moderate(31-55) | Severe(56-80) | Critical(81-100)
  // A zero score = no burden = Optimal (not 'Mild')
  sc.composite_band = sc.composite<=5?'Optimal':sc.composite<=30?'Mild':sc.composite<=55?'Moderate':sc.composite<=80?'Severe':'Critical';
  var cf=[];
  if(sc.PHQ9_item9>0) cf.push({code:'PSY-01',label:'Suicidal ideation (PHQ-9 item 9)',priority:1});
  if(sc.rf1==='Yes') cf.push({code:'RF-01',label:'Abnormal uterine/vaginal bleeding',priority:1});
  if(sc.rf3==='Yes') cf.push({code:'RF-03',label:'Breast change reported',priority:1});
  if(sc.rf2==='Frequently') cf.push({code:'RF-02',label:'Frequent pelvic pain',priority:2});
  var wd0=a.wearable_data||{};
  if(wd0.avg_spo2&&wd0.avg_spo2<90) cf.push({code:'WRB-SPO2-CRIT',label:'SpO₂ '+wd0.avg_spo2+'% critical (<90%)',priority:1});
  else if(wd0.avg_spo2&&wd0.avg_spo2<95) cf.push({code:'WRB-SPO2-LOW',label:'SpO₂ '+wd0.avg_spo2+'% below normal',priority:2});
  if(wd0.avg_rhr&&wd0.avg_rhr>100) cf.push({code:'WRB-RHR',label:'Resting HR '+wd0.avg_rhr+'bpm tachycardia',priority:1});
  var cmx=a.comorbidities||{};
  if((cmx['Heart Disease']||'')==='Uncontrolled') cf.push({code:'CMX-HD',label:'Heart Disease Uncontrolled',priority:1});
  if((cmx['Diabetes']||'')==='Uncontrolled') cf.push({code:'CMX-DM',label:'Diabetes Uncontrolled',priority:2});
  if((cmx['Hypertension']||'')==='Uncontrolled') cf.push({code:'CMX-HTN',label:'Hypertension Uncontrolled',priority:2});
  if(a.fam_breast_cancer||a.fam_ovarian_cancer) cf.push({code:'FAM-CA',label:'Family hx: breast/ovarian cancer',priority:3});
  if(a.fam_cvd) cf.push({code:'FAM-CVD',label:'Family hx: heart disease',priority:3});
  cf.sort(function(a2,b2){return a2.priority-b2.priority;});
  sc.criticalFlags=cf; sc.criticalFlagCount=cf.length; sc.hasPriority1Flag=cf.some(function(f){return f.priority===1;});
  // ISSUE-04 EXPANDED: domain-composite discordance alert for all bands
  sc.domain_alert = null;
  var _da=[];
  if(sc.ISI>=15)  _da.push('sleep (ISI='+sc.ISI+'/28, '+sc.ISI_band+')');
  if(sc.PHQ9>=10) _da.push('low mood (PHQ-9='+sc.PHQ9+'/27, '+sc.PHQ9_band+')');
  if(sc.GAD7>=10) _da.push('anxiety (GAD-7='+sc.GAD7+'/21, '+sc.GAD7_band+')');
  if(sc.PSS8!==null&&sc.PSS8>=21) _da.push('stress (PSS-8='+sc.PSS8+'/32, High)');
  if(sc.MENQOL_vasomotor>=14) _da.push('vasomotor ('+sc.MENQOL_vasomotor+'/20)');
  if(_da.length>0) sc.domain_alert=(sc.composite<=30?'Overall score is '+sc.composite_band+', but specific domains need attention: ':'Key domains needing attention: ')+_da.join('; ')+'.';
  sc.stage_note = (stageVmMul>1.0)?'Stage-adjusted for '+stg+' (vasomotor ×'+stageVmMul.toFixed(2)+')':null;
  return sc;
}
function runRuleEngine(scores) {
  var triggered = {};
  var sevOrder  = {severe:3,moderate:2,mild:1};
  var sexActive    = S.flags && S.flags.sexuallyActive;
  var psychComplete= S.flags && S.flags.psychosexualCompleted;
  EVR_RULES.forEach(function(rule) {
    var v = scores[rule.inst];
    if(v === undefined || v === null) return;
    if((rule.inst==='FSFI'||rule.inst==='MCSS') && psychComplete && !sexActive) return;
    var fired = (rule.op==='>=') ? v >= rule.thresh : v <= rule.thresh;
    if(fired) {
      if(!triggered[rule.action]) triggered[rule.action]={sev:'mild',rules:[],notes:[]};
      triggered[rule.action].rules.push(rule.id+'('+rule.dom+')');
      if(sevOrder[rule.sev]>sevOrder[triggered[rule.action].sev]) triggered[rule.action].sev=rule.sev;
    }
  });
  CORE_RULES.forEach(function(rule) {
    try {
      if(rule.condition(scores)) {
        if(!triggered[rule.action]) triggered[rule.action]={sev:rule.sev,rules:[],notes:[]};
        triggered[rule.action].rules.push(rule.id);
        if(sevOrder[rule.sev]>sevOrder[triggered[rule.action].sev]) triggered[rule.action].sev=rule.sev;
      }
    } catch(e) {}
  });
  if(scores.rf1==='Yes'||scores.rf3==='Yes'||scores.rf2==='Frequently') {
    if(!triggered['gynecology_referral']) triggered['gynecology_referral']={sev:'severe',rules:[],notes:[]};
    triggered['gynecology_referral'].sev='severe';
    triggered['gynecology_referral'].rules.push('RED_FLAG');
  }
  if(scores.PHQ9_item9>0) {
    triggered['psychiatric_alert']={sev:'severe',rules:['R1_PHQ9_ITEM9'],notes:['Suicidal ideation flagged — immediate support required']};
  }
  var a=S.answers||{};
  if(a.med_ssri&&scores.PHQ9>=5&&triggered['psychologist_referral']) {
    triggered['psychologist_referral'].notes.push('NOTE: Patient on SSRIs — PHQ-9 may be attenuated; true burden may be higher');
  }
  try {
    var wm=calcWearableMod(S.answers||{});
    (wm.actions||[]).forEach(function(wa){
      if(!triggered[wa.action]) triggered[wa.action]={sev:wa.sev,rules:[],notes:[]};
      triggered[wa.action].rules.push('WRB_'+wa.action.toUpperCase());
      if(sevOrder[wa.sev]>sevOrder[triggered[wa.action].sev]) triggered[wa.action].sev=wa.sev;
    });
  } catch(e) {}
  var result=Object.entries(triggered).map(function(e){ return {action:e[0],sev:e[1].sev,rules:e[1].rules,notes:e[1].notes||[]}; });
  result.sort(function(a,b){ return sevOrder[b.sev]-sevOrder[a.sev]; });
  return result;
}

function buildWearableRecord(a){
  var wd=a.wearable_data||{};
  var device=a.wearable||'Not specified';
  if(device==='None / No wearable'||!a.wearable) return null;
  var correlations=[];
  if(wd.avg_hrv&&wd.avg_hrv<30) correlations.push('HRV '+wd.avg_hrv+'ms (low) — autonomic stress pattern');
  if(wd.avg_sleep&&wd.avg_sleep<6.5) correlations.push('Sleep '+wd.avg_sleep+'h — below recommended 7-9h');
  if(wd.night_sweats_per_night&&wd.night_sweats_per_night>=2) correlations.push('Night sweats '+wd.night_sweats_per_night+'/night — significant vasomotor activity');
  if(wd.avg_stress&&wd.avg_stress>50) correlations.push('Stress score '+wd.avg_stress+'/100 — elevated autonomic burden');
  return {device:device,period:wd.period||'Last 30 days',avg_rhr:wd.avg_rhr,avg_hrv:wd.avg_hrv,avg_spo2:wd.avg_spo2,avg_skin_temp:wd.avg_skin_temp,avg_sleep:wd.avg_sleep,night_sweats_per_night:wd.night_sweats_per_night,avg_steps:wd.avg_steps,avg_stress:wd.avg_stress,correlations:correlations};
}
function saveResult(){
  loadPatients();var a=S.answers;
  var patient={id:'P'+Date.now(),name:a.name||'Anonymous',age:a.age||'—',city:a.city||'—',stage:a.stage||'—',menstrual_pattern:a.menstrual_pattern||'—',prakriti:a.prakriti||'Tridosha',vikriti:(a.vikriti||'—').replace(/_/g,' '),marital:a.marital||'—',occupation:a.occupation||'—',education:a.education||'—',sexual_activity_status:a.sexual_activity_status||'—',scores:S.scores,triage:S.triage,psychiatricAlert:S.psychiatricAlert,redFlags:S.redFlagsTriggered,flags:S.flags,comorbidities:a.comorbidities||{},wearable:buildWearableRecord(a),wearable_data:a.wearable_data||{},timestamp:new Date().toISOString(),sessionId:S.session?S.session.id:'guest',authId:S.session?S.session.authId||null:null,composite:S.scores.composite,consentTimestamp:S.consentTimestamp||'',answers:a};
  var dup=S.patients.find(function(p){return p.sessionId===patient.sessionId&&(new Date()-new Date(p.timestamp))<300000;});
  if(dup)S.patients[S.patients.indexOf(dup)]=patient;
  else S.patients.unshift(patient);
  if(S.patients.length>200)S.patients=S.patients.slice(0,200);
  savePatients();
  try{localStorage.setItem('evr_answers_v7',JSON.stringify({answers:a,flags:S.flags,step:S.currentStep,ts:new Date().toISOString()}));}catch(e){}
}
