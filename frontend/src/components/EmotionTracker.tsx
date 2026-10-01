import { useEffect, useMemo, useRef, useState } from 'react';
import { detectFaceEmotion, type EmotionScore } from '../api';
import EmotionCharts, { type HistoryPoint } from './EmotionCharts';

const SAMPLE_INTERVAL_MS = 3000;
const CAPTURE_WIDTH = 320;
const MAX_HISTORY = 120;

const EMOJI: Record<string, string> = {
  joy: '😊',
  happy: '😊',
  happiness: '😊',
  sad: '😢',
  sadness: '😢',
  angry: '😠',
  anger: '😠',
  fear: '😨',
  surprise: '😲',
  disgust: '🤢',
  neutral: '😐',
};

export interface TrackedSample {
  tSeconds: number;
  dominant: EmotionScore;
  emotions: EmotionScore[];
}

interface Props {
  onSample?: (sample: TrackedSample) => void;
  startLabel?: string;
  showCharts?: boolean;
}

export default function EmotionTracker({
  onSample,
  startLabel,
  showCharts = true,
}: Props = {}) {
  const [enabled, setEnabled] = useState(false);
  const [current, setCurrent] = useState<EmotionScore | null>(null);
  const [breakdown, setBreakdown] = useState<EmotionScore[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [status, setStatus] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onSampleRef = useRef(onSample);
  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const emotionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const point of history) {
      for (const key of Object.keys(point)) {
        if (key !== 't') keys.add(key);
      }
    }
    return [...keys];
  }, [history]);

  function toggleTracking() {
    if (!enabled) {
      setCurrent(null);
      setBreakdown([]);
      setHistory([]);
    }
    setEnabled(!enabled);
  }

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    let timer: number | undefined;
    const startedAt = Date.now();
    const controller = new AbortController();

    async function start() {
      try {
        setStatus('Requesting camera…');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: CAPTURE_WIDTH },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('Reading…');
        timer = window.setInterval(sample, SAMPLE_INTERVAL_MS);
        sample();
      } catch {
        if (!cancelled) setStatus('Camera unavailable');
      }
    }

    async function sample() {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;

      const scale = CAPTURE_WIDTH / video.videoWidth;
      canvas.width = CAPTURE_WIDTH;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const result = await detectFaceEmotion(
          canvas.toDataURL('image/jpeg', 0.8),
          controller.signal,
        );
        if (cancelled) return;
        setCurrent(result.dominant);
        setStatus(result.faceDetected ? '' : 'No face detected');

        if (result.faceDetected && result.emotions.length) {
          setBreakdown(result.emotions);
          const tSeconds = Math.round((Date.now() - startedAt) / 1000);
          const point: HistoryPoint = { t: tSeconds };
          for (const { emotion, score } of result.emotions) {
            point[emotion] = score;
          }
          setHistory((prev) => [...prev, point].slice(-MAX_HISTORY));
          if (result.dominant) {
            onSampleRef.current?.({
              tSeconds,
              dominant: result.dominant,
              emotions: result.emotions,
            });
          }
        }
      } catch {
        if (!cancelled) setStatus('Detection error');
      }
    }

    start();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCurrent(null);
      setStatus('');
    };
  }, [enabled]);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggleTracking} className="yt-btn">
          {enabled
            ? 'Stop emotion tracking'
            : (startLabel ?? '🎥 Track my emotion')}
        </button>
        {enabled && current && (
          <span className="inline-flex items-center gap-1.5 border border-[#bdd2ea] bg-[#e8f0fa] px-2 py-1 text-[12px] font-bold capitalize">
            {EMOJI[current.emotion] ?? '🙂'} {current.emotion}
            <small className="font-normal text-yt-gray">
              {Math.round(current.score * 100)}%
            </small>
          </span>
        )}
        {enabled && status && (
          <span className="text-[12px] text-yt-gray">{status}</span>
        )}
      </div>
      <video
        ref={videoRef}
        className="mt-3 w-[240px] max-w-full -scale-x-100 border border-[#ccc] bg-black"
        muted
        playsInline
        style={{ display: enabled ? 'block' : 'none' }}
      />
      {showCharts && enabled && history.length > 0 && (
        <p className="mt-3 text-yt-gray">
          Collecting… {history.length} sample{history.length === 1 ? '' : 's'}{' '}
          so far. Stop tracking to see the summary.
        </p>
      )}
      {showCharts && !enabled && history.length > 0 && (
        <EmotionCharts
          history={history}
          emotionKeys={emotionKeys}
          breakdown={breakdown}
        />
      )}
    </div>
  );
}
