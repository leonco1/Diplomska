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

  if (loading) return <p className="text-yt-gray">Loading…</p>;
  if (error)
    return (
      <p className="border border-[#ecc] bg-[#fff7f7] px-3 py-2 text-yt-red">
        {error}
      </p>
    );

  if (views.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="mb-2 text-[18px] font-bold">Nothing watched yet</h2>
        <p className="text-yt-gray">
          Videos you watch show up here, along with your recorded emotions.{' '}
          <Link to="/" className="yt-link">
            Browse videos
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-3 border-b border-yt-border pb-2 text-[15px] font-bold uppercase">
        Watch History
      </h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-6">
        {views.map((v) => {
          const stat = stats[v.video.id];
          const top = stat?.aggregate[0];
          return (
            <Link
              key={v.id}
              to={`/watch/${v.video.id}`}
              className="group block no-underline"
            >
              <video
                className="block aspect-video w-full border border-[#ccc] bg-black object-cover"
                src={streamUrl(v.video.id)}
                muted
                preload="metadata"
              />
              <h3 className="mt-1.5 mb-0.5 text-[13px] leading-tight font-bold text-yt-blue group-hover:underline">
                {v.video.title}
              </h3>
              <p className="m-0 text-[11px] text-yt-meta">
                Watched {new Date(v.watchedAt).toLocaleString()}
              </p>
              {stat && stat.sampleCount > 0 ? (
                <p className="m-0 text-[11px] text-yt-meta">
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
                <p className="m-0 text-[11px] text-yt-meta">
                  No emotion data recorded
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
