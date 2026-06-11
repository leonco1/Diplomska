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

  if (error) return <p className="error">{error}</p>;
  if (!video) return <p className="muted">Loading…</p>;

  return (
    <div className="watch">
      <Link to="/" className="back">
        ← Back
      </Link>
      <video
        ref={playerRef}
        className="player"
        src={streamUrl(video.id)}
        controls
        autoPlay
      />
      <h1>{video.title}</h1>
      {video.description && <p className="desc">{video.description}</p>}

      <section className="watch-emotion">
        <h2>Track your reaction</h2>
        <p className="muted">
          Enable your camera to record how you feel while watching. Readings are
          saved to your watch history.
          {saved > 0 && ` (${saved} saved)`}
        </p>
        <EmotionTracker
          onSample={handleSample}
          startLabel="🎥 Track my reaction to this video"
        />
      </section>
    </div>
  );
}
