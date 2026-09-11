import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  Pin,
  Send,
  Sparkles,
  Bot,
  Brain,
  Terminal,
  BarChart2,
  FileText,
  Map,
  Shield,
  CornerDownRight,
  X,
} from 'lucide-react';
import { Card, Badge, Button, Loading, ErrorNote, Empty } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints, formatDate } from '../../lib/index.js';

const GROUP_ICONS = {
  Brain: Brain,
  Terminal: Terminal,
  BarChart2: BarChart2,
  FileText: FileText,
  Map: Map,
  Shield: Shield,
};

export default function Discussions() {
  const groupsApi = useApi(endpoints.discussionGroups);
  const groups = groupsApi.data?.groups ?? [];

  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newText, setNewText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (groups.length > 0 && !activeGroup) {
      setActiveGroup(groups[0]);
    }
  }, [groups, activeGroup]);

  useEffect(() => {
    if (!activeGroup?._id) return;
    let cancelled = false;

    async function load() {
      setLoadingMessages(true);
      try {
        const res = await api.get(`/discussions/groups/${activeGroup._id}/messages`);
        if (!cancelled) setMessages(res.messages || []);
      } catch (err) {
        console.error('Failed to load group messages', err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const postMessage = async (content, replyToId) => {
    if (!content.trim() || !activeGroup) return;
    const payload = { content: content.trim(), replyTo: replyToId };
    try {
      const res = await api.post(`/discussions/groups/${activeGroup._id}/messages`, payload);
      if (res.message) setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      console.error('Failed to post message', err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    postMessage(newText, null);
    setNewText('');
    setReplyTo(null);
  };

  const handleAskAi = async () => {
    if (!aiPrompt.trim() || !activeGroup || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post(`/discussions/groups/${activeGroup._id}/ask-ai`, { prompt: aiPrompt.trim() });
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
        setAiPrompt('');
        setShowAiModal(false);
      }
    } catch (err) {
      console.error('AI co-pilot error', err);
    } finally {
      setAiLoading(false);
    }
  };

  if (groupsApi.loading) return <Loading label="Loading statistical discussion groups" />;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">
            Statistical Learning Discussions
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Collaborative peer capacity building across official statistical domains. Meaningful contributions award <span className="font-semibold text-primary">+20 XP</span> towards your streak.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAiModal(true)}>
          <Sparkles size={14} />
          Ask AI Co-pilot
        </Button>
      </div>

      <ErrorNote error={groupsApi.error} />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ── Groups Sidebar ──────────────────────────── */}
        <div className="space-y-2 lg:col-span-4">
          <h3 className="label px-1">
            Learning Groups
          </h3>
          <div className="space-y-1.5">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group.icon] || MessageSquare;
              const isActive = activeGroup?._id === group._id;
              return (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => setActiveGroup(group)}
                  className={`w-full text-left p-3 rounded-button border transition-all duration-200 flex items-start gap-3 ${
                    isActive
                      ? 'border-primary bg-primary-light shadow-xs'
                      : 'border-hairline bg-surface hover:bg-plane hover:border-primary-border'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-button ${
                      isActive ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-[13px] font-semibold text-ink truncate">{group.title}</h4>
                      <span className="flex items-center gap-1 text-[11px] text-ink-muted shrink-0">
                        <Users size={12} /> {group.memberCount || 30}
                      </span>
                    </div>
                    <p className="text-xs text-ink-2 truncate mt-0.5">{group.topic}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Conversation Thread ─────────────────────── */}
        <div className="flex flex-col rounded-card-lg border border-hairline bg-surface shadow-card lg:col-span-8 overflow-hidden">
          {/* Group Header */}
          {activeGroup && (
            <div className="flex items-center justify-between border-b border-hairline bg-plane px-5 py-3">
              <div>
                <h3 className="text-[13px] font-bold text-ink flex items-center gap-2">
                  <span>{activeGroup.title}</span>
                  <Badge band="accent">{activeGroup.category}</Badge>
                </h3>
                <p className="text-xs text-ink-2 mt-0.5 line-clamp-1">{activeGroup.topic}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[520px]">
            {loadingMessages ? (
              <Loading label="Loading discussion messages" />
            ) : messages.length === 0 ? (
              <Empty>No messages yet. Start the discussion!</Empty>
            ) : (
              messages.map((m) => (
                <div
                  key={m._id}
                  className={`rounded-button border p-4 transition-all duration-200 ${
                    m.isPinned
                      ? 'border-warning bg-plane'
                      : m.isAiGenerated
                      ? 'border-primary-border bg-primary-light'
                      : 'border-hairline bg-plane'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          m.isAiGenerated
                            ? 'bg-primary text-white'
                            : m.authorRole === 'trainer'
                            ? 'bg-warning text-white'
                            : 'bg-surface-2 text-ink'
                        }`}
                      >
                        {m.isAiGenerated ? <Bot size={14} /> : m.authorName[0]}
                      </div>
                      <span className="text-xs font-semibold text-ink">{m.authorName}</span>
                      {m.isAiGenerated ? (
                        <span className="pill pill-primary !text-[10px]">
                          AI Co-pilot
                        </span>
                      ) : m.authorRole === 'trainer' ? (
                        <span className="pill pill-warning !text-[10px]">
                          NSSTA Trainer
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                      {m.isPinned && (
                        <span className="flex items-center gap-1 text-warning font-medium">
                          <Pin size={12} /> Pinned
                        </span>
                      )}
                      <span>{formatDate(m.createdAt)}</span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-ink leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2 text-[11px] text-ink-muted">
                    <button
                      type="button"
                      onClick={() => setReplyTo(m)}
                      className="hover:text-primary transition-colors duration-200 flex items-center gap-1"
                    >
                      <CornerDownRight size={12} /> Reply
                    </button>
                    {m.helpfulCount > 0 && <span>{m.helpfulCount} helpful</span>}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Context Banner */}
          {replyTo && (
            <div className="flex items-center justify-between border-t border-hairline bg-primary-light px-4 py-2 text-xs">
              <span className="truncate text-ink-2">
                Replying to <strong className="text-ink">{replyTo.authorName}</strong>: &quot;{replyTo.content.slice(0, 40)}...&quot;
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-ink-muted hover:text-ink transition-colors duration-200"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="border-t border-hairline bg-surface p-3 flex gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={`Contribute to ${activeGroup?.title || 'discussion'}... (+20 XP)`}
              className="field !text-xs flex-1"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!newText.trim()}>
              <Send size={14} />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </div>
      </div>

      {/* ── Ask AI Modal ─────────────────────────────── */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card-lg border border-hairline bg-surface p-5 shadow-card-hover space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-ink flex items-center gap-2">
                <Sparkles size={15} className="text-primary" />
                Ask AI Co-pilot
                <span className="text-ink-2 font-normal">( {activeGroup?.title} )</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-button p-1 text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors duration-200"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-ink-2">
              StatSkill AI will analyze official MoSPI guidelines and post a contextually validated response.
            </p>
            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Explain how to handle outlier weights in CPI revisions under NQAF guidelines..."
              className="field !text-xs w-full"
              disabled={aiLoading}
            />
            <div className="flex justify-end gap-2">
              <Button variant="quiet" onClick={() => setShowAiModal(false)} disabled={aiLoading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAskAi} disabled={!aiPrompt.trim() || aiLoading}>
                <Sparkles size={14} />
                {aiLoading ? 'Generating...' : 'Post AI Response'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
