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

/**
 * Turn a per-emotion aggregate into bar-chart data, where each bar is the
 * share of readings that emotion dominated (so the bars sum to ~100%).
 */
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

/** Build a timeline (one point per sample) from persisted samples. */
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
    <section className="emotion-video-card">
      <div className="emotion-video-head">
        <h3>
          <Link to={`/watch/${entry.video.id}`}>{entry.video.title}</Link>
        </h3>
        <span className="muted">
          {entry.sampleCount} reading{entry.sampleCount === 1 ? '' : 's'}
        </span>
      </div>
      {/* A single sample has no meaningful arc — show just the distribution. */}
      {history.length > 1 ? (
        <EmotionCharts
          history={history}
          emotionKeys={emotionKeys}
          breakdown={shares}
          breakdownTitle="Emotion mix"
        />
      ) : (
        <div className="emotion-charts">
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

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  const lifetimeShares = overview
    ? aggregateToShares(overview.lifetime, overview.totalSamples)
    : [];

  return (
    <div className="emotion-page">
      <h1>Emotion recognition</h1>
      <p className="desc">
        Emotions recorded while you watch are summarised here — your all-time
        mix across every video, and a per-video breakdown. Enable the camera on
        a video's watch page to add readings.
      </p>

      {!overview || overview.totalSamples === 0 ? (
        <div className="empty">
          <h2>No emotion data yet</h2>
          <p className="muted">
            Open a video, start “Track my reaction”, and your emotions will be
            recorded here. <Link to="/">Browse videos</Link>.
          </p>
        </div>
      ) : (
        <>
          <section className="emotion-lifetime">
            <h2>Your all-time emotions</h2>
            <p className="muted">
              Share of {overview.totalSamples} reading
              {overview.totalSamples === 1 ? '' : 's'} across all videos.
            </p>
            <div className="emotion-charts">
              <EmotionBars data={lifetimeShares} title="All-time emotion mix" />
            </div>
          </section>

          <section className="emotion-per-video">
            <h2>By video</h2>
            {overview.perVideo.map((entry) => (
              <VideoEmotionCard key={entry.video.id} entry={entry} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
