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
  content: "Hi! I'm the StreamApp support bot. Ask me how to upload, watch, or troubleshoot videos.",
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

    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
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
    <div className="chat">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Support</span>
            <button onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="chat-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.content || (busy && i === messages.length - 1 ? '…' : '')}
                {m.emotion && (
                  <span className="emotion-chip" title={`Detected emotion: ${m.emotion}`}>
                    {EMOTION_EMOJI[m.emotion] ?? '🙂'} {m.emotion}
                  </span>
                )}
              </div>
            ))}
          </div>
          <form className="chat-input" onSubmit={handleSubmit}>
            <input
              value={input}
              placeholder="Ask a question…"
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : '💬 Support'}
      </button>
    </div>
  );
}
