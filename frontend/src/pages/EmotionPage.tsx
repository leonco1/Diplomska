import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEmotionOverview,
  type EmotionAggregate,
  type EmotionOverview,
  type EmotionScore,
  type EmotionSampleRecord,
  type VideoEmotionSummary,
} from '../api';
import EmotionCharts, {
  EmotionBars,
  type HistoryPoint,
} from '../components/EmotionCharts';

function aggregateToShares(
  aggregate: EmotionAggregate[],
  totalSamples: number,
): EmotionScore[] {
  if (totalSamples === 0) return [];
  return aggregate.map((a) => ({
    emotion: a.emotion,
    score: a.count / totalSamples,
  }));
}

function samplesToHistory(samples: EmotionSampleRecord[]): HistoryPoint[] {
  return samples.map((s) => ({ t: s.tSeconds, ...s.scores }));
}

function emotionKeysFrom(history: HistoryPoint[]): string[] {
  const keys = new Set<string>();
  for (const point of history) {
    for (const key of Object.keys(point)) {
      if (key !== 't') keys.add(key);
    }
  }
  return [...keys];
}

function VideoEmotionCard({ entry }: { entry: VideoEmotionSummary }) {
  const history = samplesToHistory(entry.samples);
  const emotionKeys = emotionKeysFrom(history);
  const shares = aggregateToShares(entry.aggregate, entry.sampleCount);

  return (
    <section className="mt-4 border border-yt-border bg-[#f8f8f8] p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="m-0 text-[15px] font-bold">
          <Link to={`/watch/${entry.video.id}`} className="yt-link">
            {entry.video.title}
          </Link>
        </h3>
        <span className="text-[11px] whitespace-nowrap text-yt-meta">
          {entry.sampleCount} reading{entry.sampleCount === 1 ? '' : 's'}
        </span>
      </div>
      {history.length > 1 ? (
        <EmotionCharts
          history={history}
          emotionKeys={emotionKeys}
          breakdown={shares}
          breakdownTitle="Emotion mix"
        />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <EmotionBars data={shares} title="Emotion mix" />
        </div>
      )}
    </section>
  );
}

export default function EmotionPage() {
  const [overview, setOverview] = useState<EmotionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmotionOverview()
      .then(setOverview)
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

  const lifetimeShares = overview
    ? aggregateToShares(overview.lifetime, overview.totalSamples)
    : [];

  return (
    <div>
      <h1 className="mt-0 mb-3 border-b border-yt-border pb-2 text-[15px] font-bold uppercase">
        Emotion Recognition
      </h1>
      <p className="max-w-[60ch] text-yt-gray">
        Emotions recorded while you watch are summarised here — your all-time
        mix across every video, and a per-video breakdown. Enable the camera on
        a video's watch page to add readings.
      </p>

      {!overview || overview.totalSamples === 0 ? (
        <div className="py-16 text-center">
          <h2 className="mb-2 text-[18px] font-bold">No emotion data yet</h2>
          <p className="text-yt-gray">
            Open a video, start “Track my reaction”, and your emotions will be
            recorded here.{' '}
            <Link to="/" className="yt-link">
              Browse videos
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="mb-1 text-[15px] font-bold">
              Your all-time emotions
            </h2>
            <p className="text-yt-gray">
              Share of {overview.totalSamples} reading
              {overview.totalSamples === 1 ? '' : 's'} across all videos.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <EmotionBars data={lifetimeShares} title="All-time emotion mix" />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-1 text-[15px] font-bold">By video</h2>
            {overview.perVideo.map((entry) => (
              <VideoEmotionCard key={entry.video.id} entry={entry} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
