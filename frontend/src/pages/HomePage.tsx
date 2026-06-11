import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listVideos, streamUrl, type Video } from '../api';

export default function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();

  useEffect(() => {
    listVideos()
      .then(setVideos)
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

  const shown = query
    ? videos.filter((v) => v.title.toLowerCase().includes(query))
    : videos;

  if (videos.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="mb-2 text-[18px] font-bold">No videos yet</h2>
        <p className="text-yt-gray">
          Be the first to{' '}
          <Link to="/upload" className="yt-link">
            upload a video
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-3 border-b border-yt-border pb-2 text-[15px] font-bold uppercase">
        {query ? `Search results for "${searchParams.get('q')}"` : 'Browse'}
      </h1>
      {shown.length === 0 ? (
        <p className="py-8 text-yt-gray">No videos matched your search.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-6">
          {shown.map((v) => (
            <Link
              key={v.id}
              to={`/watch/${v.id}`}
              className="group block no-underline"
            >
              <video
                className="block aspect-video w-full border border-[#ccc] bg-black object-cover"
                src={streamUrl(v.id)}
                muted
                preload="metadata"
              />
              <h3 className="mt-1.5 mb-0.5 text-[13px] leading-tight font-bold text-yt-blue group-hover:underline">
                {v.title}
              </h3>
              <p className="m-0 text-[11px] text-yt-meta">
                {new Date(v.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
