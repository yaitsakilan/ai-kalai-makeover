// billl/js/state.js

export const state = {
  currentPage: 'dashboard',
  isTyping: false,
  pendingData: null,
  isEditingPendingCard: false,
  isRecording: false,
  activeRecordingType: null,
  chatMessages: [
    {role:'ai', text:'Vanakkam Kalai! 👋 I\'m your personal AI business assistant. Type or speak a business entry in English or Tamil:\n\n<em>"Priya facial 1200 paid"</em>\n<em>"rent 15000 this month"</em>\n<em>"Insta idea: bridal makeup tutorial"</em>\n\nI\'ll extract and save the details for you!'}
  ],
  reminders: [
    {text:"Check pending payments regularly",level:'red',icon:'ti-alert-circle'},
    {text:"Update expense entries daily",level:'amber',icon:'ti-clock'},
    {text:"Confirm upcoming event details",level:'amber',icon:'ti-calendar-event'},
    {text:"Review monthly bills",level:'red',icon:'ti-bolt'},
    {text:"Verify daily customer entries",level:'blue',icon:'ti-user-check'}
  ],
  mediaRecorder: null,
  audioChunks: [],
  audioCtx: null,
  analyser: null,
  sourceNode: null,
  animId: null,
  recordingStartTime: 0,
  recordingInterval: null,
  bulkRowCounter: 0
};
