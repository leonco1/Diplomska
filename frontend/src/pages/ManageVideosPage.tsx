import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { deleteVideo, listVideos, updateVideo, type Video } from '../api';

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EditRow({
  video,
  onSaved,
  onCancel,
}: {
  video: Video;
  onSaved: (video: Video) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateVideo(video.id, { title, description }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update video');
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border border-yt-border bg-[#f8f8f8] p-3"
    >
      <input
        type="text"
        className="yt-input"
        value={title}
        required
        maxLength={200}
        aria-label="Title"
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="yt-input"
        value={description}
        rows={2}
        maxLength={2000}
        aria-label="Description"
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <p className="m-0 text-[12px] text-yt-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="yt-btn">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="yt-btn"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ManageVideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load videos'),
      );
  }, []);

  async function handleDelete(video: Video) {
    if (!window.confirm(`Delete "${video.title}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(video.id);
    setError(null);
    try {
      await deleteVideo(video.id);
      setVideos((prev) => prev?.filter((v) => v.id !== video.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(updated: Video) {
    setVideos(
      (prev) => prev?.map((v) => (v.id === updated.id ? updated : v)) ?? null,
    );
    setEditingId(null);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-yt-border pb-2">
        <h1 className="m-0 text-[15px] font-bold uppercase">Manage Videos</h1>
        <Link to="/upload" className="yt-btn no-underline">
          Upload New
        </Link>
      </div>

      {error && (
        <p className="mt-0 border border-[#ecc] bg-[#fff7f7] px-3 py-2 text-yt-red">
          {error}
        </p>
      )}

      {videos === null && !error && (
        <p className="text-[13px] text-yt-gray">Loading…</p>
      )}

      {videos?.length === 0 && (
        <p className="text-[13px] text-yt-gray">No videos uploaded yet.</p>
      )}

      {videos && videos.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {videos.map((video) => (
            <li
              key={video.id}
              className="border-b border-[#eee] pb-3 last:border-b-0"
            >
              {editingId === video.id ? (
                <EditRow
                  video={video}
                  onSaved={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/watch/${video.id}`}
                      className="yt-link text-[13px] font-bold"
                    >
                      {video.title}
                    </Link>
                    <p className="my-1 text-[12px] break-words text-yt-gray">
                      {video.description || <em>No description</em>}
                    </p>
                    <p className="m-0 text-[11px] text-yt-meta">
                      {new Date(video.createdAt).toLocaleDateString()} ·{' '}
                      {formatSize(video.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditingId(video.id)}
                      disabled={deletingId === video.id}
                      className="yt-btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(video)}
                      disabled={deletingId === video.id}
                      className="yt-btn text-yt-red"
                    >
                      {deletingId === video.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
