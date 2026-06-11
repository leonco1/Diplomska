import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listVideos, streamUrl, type Video } from '../api';

export default function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  if (videos.length === 0) {
    return (
      <div className="empty">
        <h2>No videos yet</h2>
        <p className="muted">
          Be the first to <Link to="/upload">upload a video</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1>Browse</h1>
      <div className="grid">
        {videos.map((v) => (
          <Link key={v.id} to={`/watch/${v.id}`} className="card">
            <video
              className="thumb"
              src={streamUrl(v.id)}
              muted
              preload="metadata"
            />
            <div className="card-body">
              <h3>{v.title}</h3>
              <p className="muted">
                {new Date(v.createdAt).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
