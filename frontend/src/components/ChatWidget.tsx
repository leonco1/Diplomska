import { useEffect, useRef, useState, type FormEvent } from 'react';
import { classifyTextEmotion, streamChat, type ChatMessage } from '../api';

// A chat message plus the optional emotion we detect for user messages.
type UiMessage = ChatMessage & { emotion?: string };

const EMOTION_EMOJI: Record<string, string> = {
  joy: '😊',
  sadness: '😢',
  anger: '😠',
  fear: '😨',
  surprise: '😲',
  disgust: '🤢',
  neutral: '😐',
};

const GREETING: UiMessage = {
  role: 'assistant',
  content:
    "Hi! I'm the StreamApp support bot. Ask me how to upload, watch, or troubleshoot videos.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: UiMessage = { role: 'user', content: text };
    // Conversation sent to the server (excludes the canned greeting).
    const history = [...messages.filter((m) => m !== GREETING), userMsg];

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '' },
    ]);
    setInput('');
    setBusy(true);

    // Best-effort: tag the user's message with its detected emotion. Failures
    // (e.g. OpenAI not configured) are ignored so chat still works.
    classifyTextEmotion(text)
      .then((res) =>
        setMessages((prev) =>
          prev.map((m) => (m === userMsg ? { ...m, emotion: res.emotion } : m)),
        ),
      )
      .catch(() => {});

    try {
      await streamChat(history, (token) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: next[next.length - 1].content + token,
          };
          return next;
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-[420px] w-[320px] max-w-[90vw] flex-col overflow-hidden rounded-[2px] border border-[#ccc] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-[#d3d3d3] bg-linear-to-b from-[#fefefe] to-[#f3f3f3] px-3 py-2 text-[13px] font-bold text-yt-text">
            <span>Help &amp; Support</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="cursor-pointer border-none bg-transparent text-[16px] leading-none text-yt-gray hover:text-yt-text"
            >
              ×
            </button>
          </div>
          <div
            className="flex flex-1 flex-col gap-2 overflow-y-auto bg-white p-3"
            ref={scrollRef}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-[2px] border px-2.5 py-1.5 text-[12px] leading-snug whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'self-end border-[#bdd2ea] bg-[#e8f0fa] text-yt-text'
                    : 'self-start border-yt-border bg-[#f8f8f8] text-yt-text'
                }`}
              >
                {m.content || (busy && i === messages.length - 1 ? '…' : '')}
                {m.emotion && (
                  <span
                    className="mt-1 block text-[10px] text-yt-meta capitalize"
                    title={`Detected emotion: ${m.emotion}`}
                  >
                    {EMOTION_EMOJI[m.emotion] ?? '🙂'} {m.emotion}
                  </span>
                )}
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-yt-border bg-[#f8f8f8] p-2"
            onSubmit={handleSubmit}
          >
            <input
              className="yt-input min-w-0 flex-1"
              value={input}
              placeholder="Ask a question…"
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="yt-btn"
            >
              Send
            </button>
          </form>
        </div>
      )}
      <button className="yt-btn" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : '💬 Support'}
      </button>
    </div>
  );
}
