import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePick() {
    if (!formRef.current?.reportValidity()) return;
    fileRef.current?.click();
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const video = await uploadVideo(
        { title, description, file },
        setProgress,
      );
      navigate(`/watch/${video.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="max-w-[560px]">
      <h1 className="mt-0 mb-3 border-b border-yt-border pb-2 text-[15px] font-bold uppercase">
        Video File Upload
      </h1>
      <form
        ref={formRef}
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-4 border border-yt-border bg-[#f8f8f8] p-4"
      >
        <label className="flex flex-col gap-1 text-[11px] font-bold text-yt-gray uppercase">
          Title
          <input
            type="text"
            className="yt-input font-normal"
            value={title}
            required
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-bold text-yt-gray uppercase">
          Description
          <textarea
            className="yt-input font-normal"
            value={description}
            rows={3}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />

        {uploading && (
          <div className="relative h-[18px] overflow-hidden border border-[#ccc] bg-white">
            <div
              className="h-full bg-linear-to-b from-[#ffd9d9] to-yt-red"
              style={{ width: `${progress}%` }}
            />
            <span className="absolute inset-0 grid place-items-center text-[11px] font-bold">
              {progress}%
            </span>
          </div>
        )}

        {error && (
          <p className="m-0 border border-[#ecc] bg-[#fff7f7] px-3 py-2 text-yt-red">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={handlePick}
          className="yt-btn self-start"
        >
          {uploading ? 'Uploading…' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}
