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
  joy: '#d97706',
  happy: '#d97706',
  happiness: '#d97706',
  sad: '#2563eb',
  sadness: '#2563eb',
  angry: '#cc181e',
  anger: '#cc181e',
  fear: '#7c3aed',
  surprise: '#db2777',
  disgust: '#059669',
  neutral: '#666666',
};
export const colorFor = (emotion: string) => COLORS[emotion] ?? '#999999';
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

// Shared 2012-style card wrapper for both charts.
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-yt-border bg-white p-3 pb-1">
      <h4 className="mt-0 mb-2 text-[11px] font-bold tracking-wide text-yt-gray uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}

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
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 48, bottom: 4, left: 8 }}
        >
          <CartesianGrid
            stroke="#e8e8e8"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={fmtPct}
            stroke="#666666"
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="emotion"
            width={72}
            stroke="#666666"
            fontSize={11}
            tickFormatter={(s: string) =>
              s.charAt(0).toUpperCase() + s.slice(1)
            }
          />
          <Bar dataKey="score" radius={[0, 2, 2, 0]} isAnimationActive={false}>
            {data.map((b) => (
              <Cell key={b.emotion} fill={colorFor(b.emotion)} />
            ))}
            {/* Always-on value labels so scores are readable without hovering. */}
            <LabelList
              dataKey="score"
              position="right"
              formatter={(v) => fmtPct(Number(v))}
              fill="#333333"
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
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
    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
      <ChartCard title="Emotion over time">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={history}
            margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
          >
            <CartesianGrid stroke="#e8e8e8" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(s) => `${s}s`}
              stroke="#666666"
              fontSize={11}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={fmtPct}
              stroke="#666666"
              fontSize={11}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #cccccc',
                fontSize: 12,
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
      </ChartCard>

      <EmotionBars data={breakdown} title={breakdownTitle} />
    </div>
  );
}
