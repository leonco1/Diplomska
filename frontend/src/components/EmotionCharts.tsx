import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { EmotionScore } from '../api';

// A single timeline sample: elapsed seconds plus a score per emotion.
export type HistoryPoint = { t: number } & Record<string, number>;

// Stable colours keyed by (normalised) emotion so a given emotion keeps the
// same colour across both charts and across the whole session.
const COLORS: Record<string, string> = {
  joy: '#fbbf24',
  happy: '#fbbf24',
  happiness: '#fbbf24',
  sad: '#60a5fa',
  sadness: '#60a5fa',
  angry: '#f87171',
  anger: '#f87171',
  fear: '#a78bfa',
  surprise: '#f472b6',
  disgust: '#34d399',
  neutral: '#9ca3af',
};
export const colorFor = (emotion: string) => COLORS[emotion] ?? '#cbd5e1';
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Horizontal bar chart of a set of emotion scores (each 0–1). Reused for the
 * "latest frame" breakdown, per-video distributions, and the lifetime mix.
 */
export function EmotionBars({
  data,
  title,
}: {
  data: EmotionScore[];
  title: string;
}) {
  if (data.length === 0) return null;
  return (
    <div className="emotion-chart-card">
      <h4>{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 48, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            stroke="#2a2e3c"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={fmtPct}
            stroke="#9ca3af"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="emotion"
            width={72}
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(s: string) =>
              s.charAt(0).toUpperCase() + s.slice(1)
            }
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((b) => (
              <Cell key={b.emotion} fill={colorFor(b.emotion)} />
            ))}
            {/* Always-on value labels so scores are readable without hovering. */}
            <LabelList
              dataKey="score"
              position="right"
              formatter={(v) => fmtPct(Number(v))}
              fill="#e8eaf1"
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Props {
  /** Time-series of emotion scores collected over the session. */
  history: HistoryPoint[];
  /** All emotion keys seen so far, so the timeline draws a line per emotion. */
  emotionKeys: string[];
  /** Scores from the most recent frame, sorted high → low. */
  breakdown: EmotionScore[];
  /** Title for the bar-chart card (defaults to the live "Latest frame" copy). */
  breakdownTitle?: string;
}

/**
 * Two views of the viewer's tracked emotions:
 *  - a live timeline (one line per emotion) showing the emotional arc, and
 *  - a bar chart of the latest frame's full score distribution.
 */
export default function EmotionCharts({
  history,
  emotionKeys,
  breakdown,
  breakdownTitle = 'Latest frame',
}: Props) {
  if (history.length === 0) return null;

  return (
    <div className="emotion-charts">
      <div className="emotion-chart-card">
        <h4>Emotion over time</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={history}
            margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
          >
            <CartesianGrid stroke="#2a2e3c" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(s) => `${s}s`}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={fmtPct}
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                background: '#1b1e27',
                border: '1px solid #2a2e3c',
              }}
              labelFormatter={(s) => `${s}s`}
              formatter={(v, name) => [fmtPct(Number(v)), name]}
            />
            <Legend />
            {emotionKeys.map((k) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                name={k}
                stroke={colorFor(k)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <EmotionBars data={breakdown} title={breakdownTitle} />
    </div>
  );
}
