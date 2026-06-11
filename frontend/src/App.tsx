import { Link, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import WatchPage from './pages/WatchPage';
import EmotionPage from './pages/EmotionPage';
import HistoryPage from './pages/HistoryPage';
import ChatWidget from './components/ChatWidget';
import { useAuth } from './auth/AuthProvider';

export default function App() {
  const { authenticated, username, hasRole, logout } = useAuth();
  const isAdmin = hasRole('admin');

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          🎬 StreamApp
        </Link>
        <nav>
          <Link to="/">Browse</Link>
          <Link to="/history">History</Link>
          {isAdmin && <Link to="/upload">Upload</Link>}
          <Link to="/emotion">Emotion</Link>
        </nav>
        {authenticated && (
          <div className="user-box">
            <span className="muted">{username}</span>
            <button onClick={logout}>Log out</button>
          </div>
        )}
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Upload is admin-only; non-admins are bounced home. */}
          <Route
            path="/upload"
            element={isAdmin ? <UploadPage /> : <Navigate to="/" replace />}
          />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/emotion" element={<EmotionPage />} />
        </Routes>
      </main>

      <ChatWidget />
    </div>
  );
}
