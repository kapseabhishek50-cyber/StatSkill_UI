import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, User } from 'lucide-react';
import { api, endpoints } from '../lib/index.js';

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your StatSkill AI statistical learning co-pilot. Ask me about your competency gaps, recommended courses, or statistical methodologies.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await api.post(endpoints.assistant, { question: text });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer || 'I am ready to help you navigate your official statistical learning pathway.',
          source: res.source,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Unable to reach the AI assistant right now. Please check that the server is running.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    'Explain sampling methodology',
    'Recommend courses for Python',
    'Why is my AI/ML gap high?',
    'Create MCQs about this topic',
    'Create a revision plan',
  ];

  return (
    <>
      {/* Open Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary fixed bottom-5 right-5 z-50 !rounded-pill !px-4 !py-2.5 shadow-card-hover"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={16} />
          <span>Ask StatSkill AI</span>
        </button>
      )}

      {/* Chat Drawer */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[400px] rounded-card-lg border border-hairline bg-surface shadow-card-hover overflow-hidden flex flex-col animate-scale-in">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-surface">
            <div className="flex items-center gap-2.5">
              <div className="icon-chip !w-9 !h-9">
                <Bot size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-ink">StatSkill AI Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-good" />
                  <p className="text-[11px] text-ink-2">MoSPI & NSSTA Co-pilot</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-button p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors duration-200"
              aria-label="Close assistant"
            >
              <X size={17} />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex gap-1.5 overflow-x-auto px-3.5 py-2.5 border-b border-hairline">
            {QUICK_PROMPTS.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(q)}
                className="shrink-0 rounded-pill border border-hairline bg-plane px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:border-primary-border hover:text-primary hover:bg-primary-light transition-all duration-200 whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-plane p-3.5 space-y-3 max-h-[300px]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary mt-0.5 border border-primary-border">
                    <Bot size={13} />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-button px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface text-ink border border-hairline'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.source && (
                    <span className="mt-1 block text-[10px] opacity-60">
                      Source: {m.source}
                    </span>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 mt-0.5 border border-hairline">
                    <User size={13} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center text-xs text-ink-muted">
                <Bot size={13} className="text-primary" />
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary opacity-60" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary opacity-60" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary opacity-60" style={{ animationDelay: '300ms' }} />
                  <span className="ml-1">Analyzing your statistical learning path...</span>
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-hairline bg-surface p-2.5 flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about official statistics or your path..."
              className="field !text-[13px] flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn btn-primary !px-3 flex items-center justify-center"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
