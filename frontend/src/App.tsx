import { type FormEvent, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import WatchPage from './pages/WatchPage';
import EmotionPage from './pages/EmotionPage';
import HistoryPage from './pages/HistoryPage';
import ChatWidget from './components/ChatWidget';
import { useAuth } from './auth/AuthProvider';

function Logo() {
  return (
    <Link to="/" className="flex items-center no-underline" title="StreamApp">
      <span className="text-[24px] leading-none font-bold tracking-[-1.5px] text-[#1a1a1a]">
        Stream
      </span>
      <span className="ml-[1px] rounded-[4px] bg-yt-red px-[5px] pt-[2px] pb-[3px] text-[20px] leading-none font-bold tracking-[-1px] text-white shadow-[inset_0_-2px_3px_rgba(0,0,0,0.25)]">
        App
      </span>
    </Link>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `px-2 py-1 text-[13px] no-underline ${
    isActive ? 'font-bold text-yt-text' : 'text-yt-gray hover:text-yt-text'
  }`;
}

export default function App() {
  const { authenticated, username, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const isAdmin = hasRole('admin');

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-yt-border bg-white">
        <div className="mx-auto flex h-[55px] max-w-[1003px] items-center gap-5 px-4">
          <Logo />

          {/* 2012 masthead search */}
          <form
            onSubmit={handleSearch}
            className="flex flex-1 justify-center"
            role="search"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder=""
              aria-label="Search"
              className="yt-input h-[29px] w-full max-w-[420px] rounded-r-none border-r-0"
            />
            <button
              type="submit"
              aria-label="Search"
              className="h-[29px] cursor-pointer rounded-r-[2px] border border-solid border-[#d3d3d3] bg-linear-to-b from-[#f8f8f8] to-[#f1f1f1] px-6 text-[13px] text-[#333] hover:border-[#c6c6c6] hover:from-[#f0f0f0] hover:to-[#e6e6e6]"
            >
              🔍
            </button>
          </form>

          {isAdmin && (
            <Link to="/upload" className="yt-btn no-underline">
              Upload
            </Link>
          )}
          {authenticated && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[11px] text-yt-gray">{username}</span>
              <button onClick={logout} className="yt-btn">
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Secondary nav row, old-tabs style */}
        <div className="mx-auto flex max-w-[1003px] items-center gap-1 px-4 pb-1">
          <NavLink to="/" end className={navClass}>
            Browse
          </NavLink>
          <span className="text-[#ccc]">|</span>
          <NavLink to="/history" className={navClass}>
            History
          </NavLink>
          <span className="text-[#ccc]">|</span>
          <NavLink to="/emotion" className={navClass}>
            Emotion
          </NavLink>
          {isAdmin && (
            <>
              <span className="text-[#ccc]">|</span>
              <NavLink to="/upload" className={navClass}>
                Upload
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto my-4 max-w-[1003px] border border-[#ddd] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
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

      <footer className="mx-auto max-w-[1003px] px-4 pb-8 text-center text-[11px] text-yt-meta">
        © 2012 StreamApp, LLC
      </footer>

      <ChatWidget />
    </div>
  );
}
