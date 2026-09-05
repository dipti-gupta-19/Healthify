'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'What did I eat today?',
  'How close am I to my goal?',
  'Suggest a protein habit for me',
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-muted-foreground"
          style={{
            animation: `chatDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Individual message bubble ────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className={cn(
        'flex w-full gap-2',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm bg-muted text-foreground',
        )}
      >
        {msg.text}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pulse the FAB once after 3s to draw attention
  useEffect(() => {
    const t = setTimeout(() => setPulsed(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        // Send last 4 messages (2 turns) as history for conversational continuity
        const history = messages
          .slice(-4)
          .map((m) => ({ role: m.role, text: m.text }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'demo-user',
          },
          body: JSON.stringify({ message: trimmed, history }),
        });

        const data = await res.json();
        const replyText: string = data.reply ?? data.error ?? 'Sorry, something went wrong.';

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: replyText,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: 'Network error — please try again.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Keyframes injected as a style tag — keeps this file self-contained */}
      <style>{`
        @keyframes chatDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chatPulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          style={{ animation: 'chatSlideUp 0.22s ease-out', height: '520px' }}
          role="dialog"
          aria-label="Healthify AI Assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight text-foreground">
                AI Nutrition Assistant
              </p>
              <p className="text-xs text-muted-foreground">Powered by your meal data</p>
            </div>
            <button
              id="chat-widget-close"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 scroll-smooth">
            {/* Welcome message */}
            {!hasMessages && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="max-w-[78%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                    Hey! I can answer questions about your meals, nutrition goals, or suggest habits. What would you like to know? 🥗
                  </div>
                </div>

                {/* Suggestion pills */}
                <div className="mt-1 flex flex-col gap-1.5 pl-9">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      id={`chat-suggestion-${s.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => sendMessage(s)}
                      className="w-fit rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-left text-xs font-medium text-primary transition hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-border bg-card px-3 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition">
              <textarea
                ref={inputRef}
                id="chat-widget-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-grow: reset then set scrollHeight
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your meals or goals…"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
                style={{ minHeight: '22px', maxHeight: '100px' }}
                aria-label="Chat message input"
              />
              <button
                id="chat-widget-send"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className={cn(
                  'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                  input.trim() && !loading
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[10px] text-muted-foreground">
              Based on your logged meals · Not medical advice
            </p>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        id="chat-widget-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI chat' : 'Open AI chat assistant'}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200',
          open
            ? 'bg-card border border-border text-foreground hover:bg-muted'
            : 'bg-primary text-primary-foreground hover:opacity-90',
        )}
        style={{ boxShadow: open ? undefined : '0 4px 24px hsl(152 56% 40% / 0.4)' }}
      >
        {/* Pulse ring — shown only before first interaction */}
        {pulsed && !open && messages.length === 0 && (
          <span
            className="absolute inset-0 rounded-full bg-primary"
            style={{ animation: 'chatPulseRing 1.5s ease-out infinite' }}
          />
        )}
        {open ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
