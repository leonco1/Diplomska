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

async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  await keycloak.updateToken(30).catch(() => undefined);
  const headers = new Headers(init.headers);
  if (keycloak.token) headers.set('Authorization', `Bearer ${keycloak.token}`);
  return fetch(input, { ...init, headers });
}

async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(errorMessage);
  return res.json() as Promise<T>;
}

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

async function errorMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = body?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? fallback);
}

export async function updateVideo(
  id: string,
  data: { title?: string; description?: string },
): Promise<Video> {
  const res = await authFetch(`/videos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(await errorMessage(res, 'Failed to update video'));
  return res.json() as Promise<Video>;
}

export async function deleteVideo(id: string): Promise<void> {
  const res = await authFetch(`/videos/${id}`, { method: 'DELETE' });
  if (!res.ok)
    throw new Error(await errorMessage(res, 'Failed to delete video'));
}

export function streamUrl(id: string): string {
  return `/videos/${id}/stream`;
}

export async function uploadVideo(
  data: { title: string; description: string; file: File },
  onProgress?: (percent: number) => void,
): Promise<Video> {
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
        try {
          reject(
            new Error(JSON.parse(xhr.responseText).message ?? 'Upload failed'),
          );
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

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

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.error) throw new Error(payload.error);
      if (payload.text) onToken(payload.text);
    }
  }
}

export function getMe(): Promise<MeProfile> {
  return getJson('/me', 'Failed to load profile');
}

export function getHistory(): Promise<VideoView[]> {
  return getJson('/me/history', 'Failed to load history');
}

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

export function saveEmotionSample(sample: {
  videoId: string;
  tSeconds: number;
  dominantEmotion: string;
  score: number;
  scores?: Record<string, number>;
}): Promise<EmotionSampleRecord> {
  return postJson('/me/emotions', sample, 'Failed to save emotion sample');
}

export function getVideoEmotionStats(
  videoId: string,
): Promise<VideoEmotionStats> {
  return getJson(
    `/me/videos/${videoId}/emotions`,
    'Failed to load emotion stats',
  );
}

export function getEmotionOverview(): Promise<EmotionOverview> {
  return getJson('/me/emotions', 'Failed to load emotion overview');
}
