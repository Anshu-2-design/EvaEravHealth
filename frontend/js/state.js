/* Global State, Step & Gate Definitions */

/* Structure:
     S{}        — Global state object
     STEPS[]    — Assessment step definitions
     Functions  — Auth, navigation, scoring, rendering
     HCP Portal — Clinical dashboard logic
     Admin      — Admin portal logic */

var S = {
  portal:'user', authMode:'login', authId:'',
  session:null, consentGiven:false, consentData:{}, consentTimestamp:'',
  currentStep:0,
  answers:{},
  scores:{},
  triage:[],
  flags:{
    menqolPsychTriggered:false,   // Psychosocial domain ≥ moderate → mental health module
    menqolSexualTriggered:false,  // Sexual domain ≥ moderate → psychosexual module
    sleepModerate:false,          // ISI ≥ 8 → sleep programme flag
    sleepSevere:false,            // ISI ≥ 15
    gyneRedFlag:false,            // red flag override path
    mentalHealthCompleted:false,  // user completed PHQ9/GAD7/PSS8
    psychosexualCompleted:false,  // user completed FSFI/FSDSR
    sleepDeepDive:false,          // user opted for sleep recommendations
  },
  redFlagsTriggered:[],
  psychiatricAlert:false,
  psychiatricHardStop:false,
  selectedPatient:null,
  patients:[]
};
var BASE_STEPS = [
  {id:'demographics',        title:'About You',                  icon:'👩',  subtitle:'Help us personalise your care pathway'},
  {id:'red_flags',           title:'Clinical Safety Screen',     icon:'🔍',  subtitle:'A few important safety questions — please answer honestly'},
  {id:'menqol_vasomotor',    title:'Vasomotor Symptoms',         icon:'🌡️', subtitle:'Hot flushes, night sweats and related symptoms — past 4 weeks (1=Not at all · 8=Extremely)'},
  {id:'menqol_physical',     title:'Physical Symptoms',          icon:'🏃‍♀️', subtitle:'Physical discomforts over the past 4 weeks (1=Not at all · 8=Extremely)'},
  {id:'menqol_psychosocial', title:'Emotional Wellbeing',        icon:'💜',  subtitle:'Emotional and psychological experiences — past 4 weeks (1=Not at all · 8=Extremely)'},
  {id:'menqol_sexual',       title:'Intimate Wellbeing',         icon:'🌺',  subtitle:'Intimate health experiences — past 4 weeks (1=Not at all · 8=Extremely)'},
  {id:'sleep',               title:'Sleep Quality',              icon:'🌙',  subtitle:'Rate your sleep difficulties over the past 2 weeks'},
  {id:'prakriti',            title:'Ayurvedic Constitution',     icon:'🌿',  subtitle:'Your Prakriti type — choose the description that fits you most naturally'},
  {id:'vikriti',             title:'Current Imbalance',          icon:'⚖️',  subtitle:'Your Vikriti — how you feel right now, your current state'},
  {id:'wearable_data',       title:'Wearable Health Data',       icon:'⌚',  subtitle:'Enter recent data from your wearable device (all fields optional)'},
  {id:'comorbidities',       title:'Health Conditions',          icon:'🏥',  subtitle:'Please indicate any existing health conditions and their management status'},
];
var GATE_PSYCH = {id:'gate_psych',     title:'Mental Health Check-In',     icon:'🧠',  subtitle:'', isGate:true};
var GATE_SEXUAL= {id:'gate_sexual',    title:'Sexual Wellbeing Check-In',  icon:'💙',  subtitle:'', isGate:true};
var GATE_SLEEP = {id:'gate_sleep',     title:'Sleep Programme',            icon:'😴',  subtitle:'', isGate:true};
var STEP_MENTAL = {id:'mental_health', title:'Mental Health Assessment',   icon:'🧠',  subtitle:'Over the past 2 weeks, how often have you been bothered by the following?'};
var STEP_PSX1 = {id:'psychosexual_1', title:'Sexual Wellbeing — Part 1', icon:'💙', subtitle:'Sexual activity status, desire & arousal (FSFI 1–6)'};
var STEP_PSX2 = {id:'psychosexual_2', title:'Sexual Wellbeing — Part 2', icon:'💜', subtitle:'Lubrication, orgasm & satisfaction (FSFI 7–16)'};
var STEP_PSX3 = {id:'psychosexual_3', title:'Sexual Wellbeing — Part 3', icon:'💗', subtitle:'Pain, sexual distress (FSDSR) & relationship wellbeing'};
var STEPS = BASE_STEPS.slice();
function rebuildSteps() {
  STEPS = [];
  BASE_STEPS.forEach(function(step) {
    STEPS.push(step);
    if(step.id === 'menqol_psychosocial') {
      if(S.flags.menqolPsychTriggered) {
        STEPS.push(GATE_PSYCH);
        if(S.flags.mentalHealthCompleted === false && S.answers.gate_psych_choice === 'yes') {
          STEPS.push(STEP_MENTAL);
        }
      }
    }
    if(step.id === 'menqol_sexual') {
      if(S.flags.menqolSexualTriggered) {
        STEPS.push(GATE_SEXUAL);
        if(S.flags.psychosexualCompleted === false && S.answers.gate_sexual_choice === 'yes') {
          STEPS.push(STEP_PSX1, STEP_PSX2, STEP_PSX3);
        }
      }
    }
    if(step.id === 'sleep') {
      if(S.flags.sleepModerate || S.flags.sleepSevere) {
        STEPS.push(GATE_SLEEP);
      }
    }
  });
}
