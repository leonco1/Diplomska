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

/** Authenticated GET that parses JSON and throws `errorMessage` on a non-2xx. */
async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(errorMessage);
  return res.json() as Promise<T>;
}

/** Authenticated JSON POST that parses the response and throws `errorMessage` on a non-2xx. */
async function postJson<T>(
  url: string,
  body: unknown,
  errorMessage: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(errorMessage);
  return res.json() as Promise<T>;
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

export interface VideoEmotionSummary {
  video: Video;
  sampleCount: number;
  samples: EmotionSampleRecord[];
  aggregate: EmotionAggregate[];
}

export interface EmotionOverview {
  totalSamples: number;
  lifetime: EmotionAggregate[];
  perVideo: VideoEmotionSummary[];
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

export function listVideos(): Promise<Video[]> {
  return getJson('/videos', 'Failed to load videos');
}

export function getVideo(id: string): Promise<Video> {
  return getJson(`/videos/${id}`, 'Video not found');
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
export function detectFaceEmotion(
  image: string,
  signal?: AbortSignal,
): Promise<FaceEmotionResult> {
  return postJson(
    '/emotion/face',
    { image },
    'Face emotion detection failed',
    signal,
  );
}

/** Classifies the dominant emotion of a text message via the OpenAI chat path. */
export function classifyTextEmotion(
  text: string,
  signal?: AbortSignal,
): Promise<TextEmotionResult> {
  return postJson(
    '/chat/emotion',
    { text },
    'Text emotion classification failed',
    signal,
  );
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
export function getMe(): Promise<MeProfile> {
  return getJson('/me', 'Failed to load profile');
}

/** The current user's watch history, newest first. */
export function getHistory(): Promise<VideoView[]> {
  return getJson('/me/history', 'Failed to load history');
}

/** Record (or refresh) that the user watched a video. */
export function recordView(
  videoId: string,
  positionSeconds = 0,
): Promise<VideoView> {
  return postJson(
    '/me/history',
    { videoId, positionSeconds },
    'Failed to record view',
  );
}

/** Persist one facial-emotion reading captured while watching a video. */
export function saveEmotionSample(sample: {
  videoId: string;
  tSeconds: number;
  dominantEmotion: string;
  score: number;
  scores?: Record<string, number>;
}): Promise<EmotionSampleRecord> {
  return postJson('/me/emotions', sample, 'Failed to save emotion sample');
}

/** The user's persisted emotion timeline + aggregate for one video. */
export function getVideoEmotionStats(
  videoId: string,
): Promise<VideoEmotionStats> {
  return getJson(
    `/me/videos/${videoId}/emotions`,
    'Failed to load emotion stats',
  );
}

/** Per-video + lifetime emotion roll-up for the Emotion dashboard. */
export function getEmotionOverview(): Promise<EmotionOverview> {
  return getJson('/me/emotions', 'Failed to load emotion overview');
}
