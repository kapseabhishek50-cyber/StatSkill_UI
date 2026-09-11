import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Card, ErrorNote, Loading } from '../../components/ui.jsx';
import { useMutation } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

const SUGGESTIONS = [
  'What should I learn next?',
  'Explain my biggest skill gap',
  'How does a quiz update my level?',
  'What did my uploaded profile suggest?',
];

export default function Assistant() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const ask = useMutation(async (value) => {
    const result = await api.post(endpoints.assistant, { question: value });
    setMessages((current) => [...current, { question: value, ...result }]);
    return result;
  });

  async function submit(event) {
    event.preventDefault();
    const value = question.trim();
    if (!value || ask.loading) return;
    setQuestion('');
    await ask.run(value);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">AI assistant</h1>
        <p className="mt-1 text-sm text-ink-2">Ask about your computed gaps, learning path, quiz evidence, or uploaded profile.</p>
      </div>

      <Card>
        {!messages.length && (
          <div className="py-6 text-center">
            <MessageCircle size={26} className="mx-auto text-ink-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-ink">Your answers are grounded in your current role and recorded competency data.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="btn-quiet text-xs" onClick={() => setQuestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={`${message.question}-${index}`} className="space-y-2">
              <p className="rounded-md bg-surface-2 p-3 text-sm text-ink">{message.question}</p>
              <div className="border-l-2 border-[var(--series-1)] pl-3 text-sm text-ink-2">
                {message.answer}
                <p className="mt-2 text-[11px] text-ink-muted">Based on your current role record · {message.source}</p>
              </div>
            </div>
          ))}
          {ask.loading && <Loading label="Checking your competency record" />}
        </div>

        <ErrorNote error={ask.error} />
        <form onSubmit={submit} className="mt-5 flex gap-2 border-t border-hairline pt-4">
          <input className="field" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your learning path" aria-label="Assistant question" />
          <button className="btn-primary shrink-0" type="submit" disabled={!question.trim() || ask.loading} aria-label="Ask assistant">
            <Send size={15} aria-hidden="true" />
            Ask
          </button>
        </form>
      </Card>
    </div>
  );
}
