// billl/js/api.js

const GROQ_PROXY_URL = '/.netlify/functions/groq-proxy';

function getApiKey() {
  return window.GROQ_API_KEY || localStorage.getItem('GROQ_API_KEY') || '';
}

/**
 * Generic helper to make JSON requests to the Groq completions endpoint
 * @param {string} path - E.g. 'chat/completions'
 * @param {object} payload - The body payload (model, messages, temperature, etc.)
 */
export async function callGroqAPI(path, payload) {
  const apiKey = getApiKey();
  const resp = await fetch(`${GROQ_PROXY_URL}?path=${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`Groq API failed with status ${resp.status}`);
  }

  return await resp.json();
}

/**
 * Service to transcribe audio blobs using Whisper large v3
 * @param {Blob} audioBlob - The WebM audio binary blob
 */
export async function transcribeAudio(audioBlob) {
  const apiKey = getApiKey();
  const formData = new FormData();
  formData.append('file', audioBlob, 'speech.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('prompt', 'Transcribe billing entries for Kalai Makeover beauty salon in Tamil, English, or mixed Tamil-English code-switching.');
  
  const resp = await fetch(`${GROQ_PROXY_URL}?path=audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    body: formData
  });
  
  if (!resp.ok) {
    throw new Error(`Groq transcription API failed with status ${resp.status}`);
  }
  
  const res = await resp.json();
  return res.text || '';
}
