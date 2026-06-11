import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHistory,
  getVideoEmotionStats,
  streamUrl,
  type VideoView,
  type VideoEmotionStats,
} from '../api';

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

export default function HistoryPage() {
  const [views, setViews] = useState<VideoView[]>([]);
  const [stats, setStats] = useState<Record<string, VideoEmotionStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then(async (history) => {
        setViews(history);
        // Fetch the per-video emotion summary for each watched video in parallel.
        const entries = await Promise.all(
          history.map(async (v) => {
            try {
              return [
                v.video.id,
                await getVideoEmotionStats(v.video.id),
              ] as const;
            } catch {
              return null;
            }
          }),
        );
        setStats(
          Object.fromEntries(
            entries.filter(Boolean) as [string, VideoEmotionStats][],
          ),
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  if (views.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing watched yet</h2>
        <p className="muted">
          Videos you watch show up here, along with your recorded emotions.{' '}
          <Link to="/">Browse videos</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1>Watch history</h1>
      <div className="grid">
        {views.map((v) => {
          const stat = stats[v.video.id];
          const top = stat?.aggregate[0];
          return (
            <Link key={v.id} to={`/watch/${v.video.id}`} className="card">
              <video
                className="thumb"
                src={streamUrl(v.video.id)}
                muted
                preload="metadata"
              />
              <div className="card-body">
                <h3>{v.video.title}</h3>
                <p className="muted">
                  Watched {new Date(v.watchedAt).toLocaleString()}
                </p>
                {stat && stat.sampleCount > 0 ? (
                  <p className="muted">
                    {top && (
                      <>
                        Mostly {EMOJI[top.emotion] ?? '🙂'} {top.emotion}
                        {' · '}
                      </>
                    )}
                    {stat.sampleCount} emotion sample
                    {stat.sampleCount === 1 ? '' : 's'}
                  </p>
                ) : (
                  <p className="muted">No emotion data recorded</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
