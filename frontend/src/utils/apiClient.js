import { supabase } from '../lib/supabase.js';

// In dev: Vite proxy forwards /api → http://localhost:3001 (no prefix needed)
// In prod: VITE_API_URL is set to deployed backend URL
const BASE = import.meta.env.VITE_API_URL || '';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'Content-Type': 'application/json',
  };
}

export async function analyzeText(text, fileName, fileType, file) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Authorization': `Bearer ${session?.access_token || ''}` };

  let body;
  if (file) {
    const form = new FormData();
    form.append('file', file);
    form.append('text', text);
    form.append('fileName', fileName);
    form.append('fileType', fileType);
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ text, fileName, fileType });
  }

  const res = await fetch(`${BASE}/api/analyze/text`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Analysis failed');
  return res.json();
}

export async function analyzeImage(imageFile, fileName, fileType) {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  form.append('image', imageFile);
  form.append('fileName', fileName);
  form.append('fileType', fileType);

  const res = await fetch(`${BASE}/api/analyze/image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session?.access_token || ''}` },
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Image analysis failed');
  return res.json();
}

export async function chatMessage(message, financialData, history) {
  const res = await fetch(`${BASE}/api/analyze/chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ message, financialData, history }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  const data = await res.json();
  return data.reply;
}

export async function fetchHistory() {
  const res = await fetch(`${BASE}/api/history`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

export async function fetchAnalysisById(id) {
  const res = await fetch(`${BASE}/api/history/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export async function deleteAnalysis(id) {
  const res = await fetch(`${BASE}/api/history/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return res.ok;
}
