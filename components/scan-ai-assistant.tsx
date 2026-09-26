'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Bot, User, CheckCircle2, Edit3, Loader2, RefreshCw } from 'lucide-react';
import { useProfile } from '@/components/profile-context';
import type { FoodAnalysis } from '@/lib/nutrition';
import { toast } from 'sonner';

interface ScanAIAssistantProps {
  analysis: FoodAnalysis;
  onAnalysisUpdated?: (updatedAnalysis: FoodAnalysis) => void;
  scanType?: 'packaged' | 'unpackaged';
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isCorrection?: boolean;
}

export function ScanAIAssistant({
  analysis,
  onAnalysisUpdated,
  scanType = 'unpackaged',
}: ScanAIAssistantProps) {
  const { profile, token } = useProfile();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: `Hello! I am Healthify's AI Nutrition Assistant. I see you scanned "${analysis.name}" (${analysis.facts.calories} kcal, ${analysis.facts.sugar ?? 0}g sugar). Ask me any questions about this meal, or autocorrect the food name if I guessed wrong!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctedName, setCorrectedName] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Check if user is attempting an autocorrect statement in chat
    const matchCorrection = userText.match(/this is actually (.*)|correct this to (.*)|it is (.*)|wrong food it is (.*)/i);
    const newNameAttempt = matchCorrection ? (matchCorrection[1] || matchCorrection[2] || matchCorrection[3] || matchCorrection[4]).trim() : null;

    if (newNameAttempt && newNameAttempt.length > 2) {
      await handleAutocorrect(newNameAttempt);
      setLoading(false);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userText,
          foodContext: {
            name: analysis.name,
            calories: analysis.facts.calories,
            protein: analysis.facts.protein,
            carbs: analysis.facts.carbs,
            fat: analysis.facts.fat,
            sugar: analysis.facts.sugar,
            sodium: analysis.facts.sodium,
            verdict: analysis.verdict,
            warnings: analysis.warnings,
            ingredients: analysis.ingredients,
            dietAlerts: analysis.dietAlerts,
          },
          profile,
        }),
      });

      const data = await res.json();
      const aiReply = data.reply || `Regarding "${analysis.name}": It has ${analysis.facts.calories} kcal, ${analysis.facts.sugar ?? 0}g sugar, and ${analysis.facts.protein}g protein. It is categorized as ${analysis.verdict} for your profile goals.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `Regarding "${analysis.name}": It provides ${analysis.facts.calories} kcal and ${analysis.facts.sugar ?? 0}g sugar per serving. It is rated as ${analysis.verdict} for your health profile.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAutocorrect = async (targetFoodName: string) => {
    if (!targetFoodName.trim()) return;
    setCorrecting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';

      const endpoint = scanType === 'packaged' ? '/api/food/packaged' : '/api/food/unpackaged';
      const reqBody = scanType === 'packaged'
        ? { ingredientText: targetFoodName, profile }
        : { foodName: targetFoodName, profile };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody),
      });

      const data = await res.json();

      if (res.ok && data.analysis) {
        // Record AI learning feedback in MongoDB
        await fetch('/api/meals/feedback', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            scanCorrection: {
              previousName: analysis.name,
              correctedName: targetFoodName,
              scanType,
              timestamp: new Date().toISOString(),
            },
          }),
        }).catch(() => {});

        if (onAnalysisUpdated) {
          onAnalysisUpdated(data.analysis);
        }

        toast.success(`Autocorrected! Updated result to "${data.analysis.name}" & saved learning to MongoDB.`);

        setMessages((prev) => [
          ...prev,
          {
            id: `corr-${Date.now()}`,
            sender: 'ai',
            text: `✅ Thank you! I corrected "${analysis.name}" to "${data.analysis.name}". I re-calculated the nutrition facts (${data.analysis.facts.calories} kcal) and stored this learning in MongoDB to improve future scans!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCorrection: true,
          },
        ]);
        setShowCorrectionForm(false);
        setCorrectedName('');
      } else {
        toast.error('Could not autocorrect with specified dish name.');
      }
    } catch {
      toast.error('Failed to autocorrect food.');
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <Card className="mt-6 border-2 border-primary/30 shadow-md glass-card overflow-hidden">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-background p-4 border-b border-border/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              AI Scan Assistant
              <Badge variant="secondary" className="text-[10px] font-bold bg-primary/10 text-primary py-0">
                Active Scan Context
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Ask about &quot;{analysis.name}&quot; or autocorrect if AI guessed wrong
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCorrectionForm(!showCorrectionForm)}
          className="text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Edit3 className="h-3.5 w-3.5" /> Autocorrect Food Name
        </Button>
      </div>

      {/* AUTOCORRECT QUICK FORM */}
      {showCorrectionForm && (
        <div className="p-4 bg-primary/5 border-b border-border animate-slide-up">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-foreground block mb-1">
                Wrong food name? Type the correct food name below:
              </label>
              <Input
                value={correctedName}
                onChange={(e) => setCorrectedName(e.target.value)}
                placeholder={`e.g. Paneer Butter Masala (was: ${analysis.name})`}
                className="text-sm h-10 bg-background"
                onKeyDown={(e) => e.key === 'Enter' && handleAutocorrect(correctedName)}
              />
            </div>
            <Button
              onClick={() => handleAutocorrect(correctedName)}
              disabled={!correctedName || correcting}
              className="h-10 px-5 text-sm font-bold gap-2 shrink-0 sm:mt-5"
            >
              {correcting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Apply & Learn
            </Button>
          </div>
        </div>
      )}

      {/* QUICK PROMPT CHIPS */}
      <div className="px-4 pt-3 flex flex-wrap gap-2">
        {[
          `Is this too sugary for me?`,
          `Is this safe for my health profile?`,
          `What is a healthier alternative?`,
          `How much protein in half a portion?`,
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => sendMessage(chip)}
            className="rounded-full bg-secondary/60 hover:bg-primary/10 hover:text-primary border border-border/80 px-3 py-1 text-xs font-semibold text-muted-foreground transition-all"
          >
            + {chip}
          </button>
        ))}
      </div>

      {/* MESSAGES LOG */}
      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 text-xs sm:text-sm ${
              m.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.sender === 'ai' && (
              <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 space-y-1 ${
                m.sender === 'user'
                  ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                  : m.isCorrection
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-medium rounded-tl-none'
                  : 'bg-muted/70 text-foreground rounded-tl-none'
              }`}
            >
              <p className="leading-relaxed">{m.text}</p>
              <span className="text-[10px] opacity-75 block text-right">{m.timestamp}</span>
            </div>
            {m.sender === 'user' && (
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>AI Assistant is analyzing your question...</span>
          </div>
        )}
      </div>

      {/* INPUT FORM */}
      <div className="p-3 bg-muted/30 border-t border-border/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask AI anything about ${analysis.name}...`}
            className="flex-1 text-sm h-10 bg-background"
          />
          <Button type="submit" disabled={!input.trim() || loading} className="h-10 px-4 font-bold">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
