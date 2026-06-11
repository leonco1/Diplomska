import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../api';

export default function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Please choose a video file.');
      return;
    }
    setProgress(0);
    try {
      const video = await uploadVideo({ title, description, file }, setProgress);
      navigate(`/watch/${video.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="upload">
      <h1>Upload a video</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Title
          <input
            type="text"
            value={title}
            required
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            rows={3}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label>
          Video file
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {uploading && (
          <div className="progress">
            <div className="bar" style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
