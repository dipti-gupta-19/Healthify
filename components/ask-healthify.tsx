'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Bot, User, RotateCcw, Loader2, HelpCircle } from 'lucide-react';
import type { FoodAnalysis, UserProfile } from '@/lib/nutrition';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'gemini' | 'fallback';
}

interface AskHealthifyProps {
  food: FoodAnalysis;
  profile: UserProfile | null;
}

export function AskHealthify({ food, profile }: AskHealthifyProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate dynamic suggested questions based on food & profile
  const suggestedQuestions = getSuggestedQuestions(food, profile);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/food/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food,
          profile,
          question: q,
          history: chatHistory,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Failed to get answer');
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        source: data.source,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const fallbackText = `I couldn't reach the nutrition server right now. Based on **${food.name}**, it provides ${food.facts.calories} calories and ${food.facts.sodium}mg sodium. Please try again!`;
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: fallbackText,
          source: 'fallback',
        },
      ]);
      toast.error('Could not get answer. Showing basic summary.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputValue('');
  };

  return (
    <Card className="overflow-hidden border border-primary/20 bg-gradient-to-b from-primary/[0.04] via-background to-background shadow-md">
      {/* Header */}
      <div className="border-b border-border/60 p-4 sm:p-5 flex items-center justify-between bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
            <Bot className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight">Ask Healthify</h3>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4 font-medium flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> AI Advisor
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              You scanned: <span className="font-semibold text-foreground">{food.name}</span> {food.emoji || '🍽️'}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            title="Reset conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>

      {/* Main Conversation & Questions Area */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Suggested Questions (always accessible or clickable) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span>{messages.length === 0 ? 'Suggested questions for this food:' : 'Quick ask:'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(q)}
                disabled={loading}
                className="group inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-150 hover:bg-primary/10 hover:border-primary/50 hover:shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div className="space-y-3 pt-2 max-h-[360px] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed sm:text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-br-none shadow-sm'
                      : 'bg-muted/80 text-foreground border border-border/60 rounded-bl-none shadow-sm'
                  }`}
                >
                  <FormattedMessageContent content={m.content} />
                </div>

                {m.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="bg-muted/80 border border-border/60 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Analyzing with {food.name} data...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(inputValue);
          }}
          className="flex items-center gap-2 pt-1"
        >
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask anything about ${food.name}...`}
            disabled={loading}
            className="flex-1 text-xs sm:text-sm bg-background/80 focus-visible:ring-primary/40 border-primary/20"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputValue.trim() || loading}
            className="shrink-0 gap-1.5 px-3"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}

/** Formats simple markdown bold, bullets and linebreaks for readable medical advice */
function FormattedMessageContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Bullet point
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('-');
        const isNumbered = /^\d+[\).]\s+/.test(trimmed);

        const cleanLine = isBullet
          ? trimmed.replace(/^[•*-]\s*/, '')
          : isNumbered
          ? trimmed.replace(/^\d+[\).]\s*/, '')
          : trimmed;

        return (
          <div key={idx} className={isBullet || isNumbered ? 'flex gap-2 pl-1' : ''}>
            {isBullet && <span className="text-primary font-bold select-none">•</span>}
            {isNumbered && (
              <span className="text-primary font-semibold select-none">
                {trimmed.match(/^\d+[\).]/)?.[0]}
              </span>
            )}
            <div className="flex-1">
              <ParseBoldText text={cleanLine} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ParseBoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Determines smart suggested questions based on food nutrients and user profile */
function getSuggestedQuestions(food: FoodAnalysis, profile: UserProfile | null): string[] {
  const questions: string[] = [];

  // 1. Goal-tailored question (Requirement: "Is this good for weight loss?")
  if (profile?.goal === 'gain') {
    questions.push('Is this good for muscle gain?');
  } else if (profile?.goal === 'maintain') {
    questions.push('Is this healthy for maintaining weight?');
  } else {
    // Default or weight loss
    questions.push('Is this good for weight loss?');
  }

  // 2. High-nutrient / flags (Requirement: "Why is the sodium high?")
  if ((food.facts?.sodium ?? 0) >= 400) {
    questions.push('Why is the sodium high?');
  } else if ((food.facts?.sugar ?? 0) >= 10) {
    questions.push('Why is the sugar high?');
  } else if ((food.facts?.calories ?? 0) > 350) {
    questions.push('Is the calorie count too high?');
  } else if (food.harmfulAdditives && food.harmfulAdditives.length > 0) {
    questions.push('Are the additives harmful?');
  } else {
    questions.push('Is this nutrient-dense?');
  }

  // 3. Nighttime eating question (Requirement: "Can I eat this at night?")
  questions.push('Can I eat this at night?');

  // 4. Healthy alternative swap question (Requirement: "What can I eat instead?")
  questions.push('What can I eat instead?');

  return questions;
}
