import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getVideo,
  recordView,
  saveEmotionSample,
  streamUrl,
  type Video,
} from '../api';
import EmotionTracker, {
  type TrackedSample,
} from '../components/EmotionTracker';

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const playerRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    getVideo(id)
      .then(setVideo)
      .catch((e) => setError(e.message));
    // Record that this user watched the video (best-effort).
    recordView(id).catch(() => undefined);
  }, [id]);

  // Persist each tracked emotion sample against this video.
  const handleSample = useCallback(
    (sample: TrackedSample) => {
      if (!id) return;
      const scores: Record<string, number> = {};
      for (const e of sample.emotions) scores[e.emotion] = e.score;
      saveEmotionSample({
        videoId: id,
        tSeconds: Math.round(playerRef.current?.currentTime ?? sample.tSeconds),
        dominantEmotion: sample.dominant.emotion,
        score: sample.dominant.score,
        scores,
      })
        .then(() => setSaved((n) => n + 1))
        .catch(() => undefined);
    },
    [id],
  );

  if (error)
    return (
      <p className="border border-[#ecc] bg-[#fff7f7] px-3 py-2 text-yt-red">
        {error}
      </p>
    );
  if (!video) return <p className="text-yt-gray">Loading…</p>;

  return (
    <div className="mx-auto max-w-[854px]">
      <Link to="/" className="yt-link mb-2 inline-block text-[11px]">
        « Back to Browse
      </Link>

      <h1 className="mb-2 text-[22px] leading-tight font-normal text-[#1a1a1a]">
        {video.title}
      </h1>

      <video
        ref={playerRef}
        className="block max-h-[480px] w-full border border-[#ccc] bg-black"
        src={streamUrl(video.id)}
        controls
        autoPlay
      />

      {/* 2012-style info bar under the player */}
      <div className="mt-2 border-b border-yt-border pb-2 text-[11px] text-yt-meta">
        Uploaded {new Date(video.createdAt).toLocaleDateString()}
      </div>

      {video.description && (
        <div className="mt-3 border border-yt-border bg-[#f8f8f8] p-3">
          <h4 className="mt-0 mb-1 text-[11px] font-bold text-yt-gray uppercase">
            Description
          </h4>
          <p className="m-0 whitespace-pre-wrap text-yt-text">
            {video.description}
          </p>
        </div>
      )}

      <section className="mt-6 border-t border-yt-border pt-4">
        <h2 className="mt-0 mb-1 text-[15px] font-bold">Track your reaction</h2>
        <p className="text-yt-gray">
          Enable your camera to record how you feel while watching. Readings are
          saved and visualised on the{' '}
          <Link to="/emotion" className="yt-link">
            Emotion
          </Link>{' '}
          page.
          {saved > 0 && ` (${saved} saved)`}
        </p>
        <EmotionTracker
          onSample={handleSample}
          startLabel="🎥 Track my reaction to this video"
          showCharts={false}
        />
      </section>
    </div>
  );
}
