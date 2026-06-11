import EmotionTracker from '../components/EmotionTracker';

export default function EmotionPage() {
  return (
    <div className="emotion-page">
      <h1>Emotion recognition</h1>
      <p className="desc">
        Enable your camera to track your facial emotion in real time. When you
        stop tracking, a summary of the whole session is shown below.
      </p>
      <EmotionTracker />
    </div>
  );
}
