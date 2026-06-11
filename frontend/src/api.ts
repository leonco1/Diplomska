import keycloak from './auth/keycloak';

export interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/**
 * fetch wrapper that refreshes and attaches the Keycloak bearer token.
 * Use for every authenticated API call (everything except the public stream URL).
 */
async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  // Refresh if the token expires within 30s; ignore failures (call may still 401).
  await keycloak.updateToken(30).catch(() => undefined);
  const headers = new Headers(init.headers);
  if (keycloak.token) headers.set('Authorization', `Bearer ${keycloak.token}`);
  return fetch(input, { ...init, headers });
}

export interface MeProfile {
  id: string;
  keycloakId: string;
  email: string;
  username: string;
  roles: string[];
}

export interface VideoView {
  id: string;
  video: Video;
  lastPositionSeconds: number;
  firstWatchedAt: string;
  watchedAt: string;
}

export interface EmotionSampleRecord {
  id: string;
  tSeconds: number;
  dominantEmotion: string;
  score: number;
  scores: Record<string, number>;
  createdAt: string;
}

export interface EmotionAggregate {
  emotion: string;
  averageScore: number;
  count: number;
}

export interface VideoEmotionStats {
  videoId: string;
  sampleCount: number;
  samples: EmotionSampleRecord[];
  aggregate: EmotionAggregate[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EmotionScore {
  emotion: string;
  score: number;
}

export interface FaceEmotionResult {
  faceDetected: boolean;
  dominant: EmotionScore | null;
  emotions: EmotionScore[];
}

export interface TextEmotionResult {
  emotion: string;
  confidence: number;
}

export async function listVideos(): Promise<Video[]> {
  const res = await authFetch('/videos');
  if (!res.ok) throw new Error('Failed to load videos');
  return res.json();
}

export async function getVideo(id: string): Promise<Video> {
  const res = await authFetch(`/videos/${id}`);
  if (!res.ok) throw new Error('Video not found');
  return res.json();
}

export function streamUrl(id: string): string {
  return `/videos/${id}/stream`;
}

export async function uploadVideo(
  data: { title: string; description: string; file: File },
  onProgress?: (percent: number) => void,
): Promise<Video> {
  // Use XHR so we can report upload progress.
  await keycloak.updateToken(30).catch(() => undefined);
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('title', data.title);
    form.append('description', data.description);
    form.append('file', data.file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/videos');
    if (keycloak.token) {
      xhr.setRequestHeader('Authorization', `Bearer ${keycloak.token}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = 'Upload failed';
        try {
          msg = JSON.parse(xhr.responseText).message ?? msg;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

/**
 * Sends a base64 (data-URL) webcam frame to the backend for facial emotion
 * detection via @vladmandic/human. Returns the dominant emotion + all scores.
 */
export async function detectFaceEmotion(
  image: string,
  signal?: AbortSignal,
): Promise<FaceEmotionResult> {
  const res = await authFetch('/emotion/face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
    signal,
  });
  if (!res.ok) throw new Error('Face emotion detection failed');
  return res.json();
}

/** Classifies the dominant emotion of a text message via the OpenAI chat path. */
export async function classifyTextEmotion(
  text: string,
  signal?: AbortSignal,
): Promise<TextEmotionResult> {
  const res = await authFetch('/chat/emotion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error('Text emotion classification failed');
  return res.json();
}

/**
 * Sends the conversation to the support bot and streams the reply.
 * Calls onToken for each text chunk. Resolves when the stream ends.
 */
export async function streamChat(
  messages: ChatMessage[],
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await authFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error('Chat request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.error) throw new Error(payload.error);
      if (payload.text) onToken(payload.text);
      // payload.done -> stream finished
    }
  }
}

/** The current user's profile + realm roles. */
export async function getMe(): Promise<MeProfile> {
  const res = await authFetch('/me');
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

/** The current user's watch history, newest first. */
export async function getHistory(): Promise<VideoView[]> {
  const res = await authFetch('/me/history');
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

/** Record (or refresh) that the user watched a video. */
export async function recordView(
  videoId: string,
  positionSeconds = 0,
): Promise<VideoView> {
  const res = await authFetch('/me/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, positionSeconds }),
  });
  if (!res.ok) throw new Error('Failed to record view');
  return res.json();
}

/** Persist one facial-emotion reading captured while watching a video. */
export async function saveEmotionSample(sample: {
  videoId: string;
  tSeconds: number;
  dominantEmotion: string;
  score: number;
  scores?: Record<string, number>;
}): Promise<EmotionSampleRecord> {
  const res = await authFetch('/me/emotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample),
  });
  if (!res.ok) throw new Error('Failed to save emotion sample');
  return res.json();
}

/** The user's persisted emotion timeline + aggregate for one video. */
export async function getVideoEmotionStats(
  videoId: string,
): Promise<VideoEmotionStats> {
  const res = await authFetch(`/me/videos/${videoId}/emotions`);
  if (!res.ok) throw new Error('Failed to load emotion stats');
  return res.json();
}
