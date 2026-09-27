'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope,
  Sparkles,
  ShieldAlert,
  HeartPulse,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Utensils,
  Search,
  MessageSquarePlus,
} from 'lucide-react';
import {
  HealthCondition,
  DailyHealthCheckin,
  getStoredHealthCheckin,
  saveHealthCheckin,
  getHealthAdvice,
  parseCustomSymptoms,
} from '@/lib/health-checkin';
import { toast } from 'sonner';

interface HealthCheckinBannerProps {
  onConditionChange?: (condition: HealthCondition, customSymptoms?: string) => void;
  selectedDateStr?: string;
  autoExpandRecommendations?: boolean;
}

const CONDITIONS: { id: HealthCondition; label: string; icon: string; bg: string }[] = [
  { id: 'healthy', label: 'Healthy & Great', icon: '😃', bg: 'hover:border-emerald-500 hover:bg-emerald-500/10' },
  { id: 'cough', label: 'Cough & Cold', icon: '😷', bg: 'hover:border-amber-500 hover:bg-amber-500/10' },
  { id: 'fever', label: 'Fever / Temp', icon: '🤒', bg: 'hover:border-rose-500 hover:bg-rose-500/10' },
  { id: 'stomach_upset', label: 'Stomach Upset', icon: '🤢', bg: 'hover:border-purple-500 hover:bg-purple-500/10' },
  { id: 'sore_throat', label: 'Sore Throat', icon: '🗣️', bg: 'hover:border-orange-500 hover:bg-orange-500/10' },
  { id: 'fatigue', label: 'Fatigue / Low Energy', icon: '😴', bg: 'hover:border-sky-500 hover:bg-sky-500/10' },
];

export function HealthCheckinBanner({
  onConditionChange,
  selectedDateStr,
  autoExpandRecommendations = true,
}: HealthCheckinBannerProps) {
  const dateKey = selectedDateStr || new Date().toISOString().split('T')[0];
  const [checkin, setCheckin] = useState<DailyHealthCheckin>(() => getStoredHealthCheckin(dateKey));
  const [customText, setCustomText] = useState(checkin.customSymptoms || '');
  const [showDetails, setShowDetails] = useState(autoExpandRecommendations);

  useEffect(() => {
    const current = getStoredHealthCheckin(dateKey);
    setCheckin(current);
    if (current.customSymptoms) setCustomText(current.customSymptoms);
  }, [dateKey]);

  const handleSelect = (cond: HealthCondition) => {
    const updated: DailyHealthCheckin = { date: dateKey, condition: cond, customSymptoms: '' };
    setCheckin(updated);
    setCustomText('');
    saveHealthCheckin(updated);
    setShowDetails(true);
    if (onConditionChange) onConditionChange(cond, '');
    toast.success(`Health status set to "${CONDITIONS.find((c) => c.id === cond)?.label}"`);
  };

  const handleCustomSymptomSubmit = (text: string) => {
    if (!text.trim()) {
      handleSelect('healthy');
      return;
    }
    const parsed = parseCustomSymptoms(text);
    const updated: DailyHealthCheckin = {
      date: dateKey,
      condition: parsed.condition,
      customSymptoms: text.trim(),
    };
    setCheckin(updated);
    saveHealthCheckin(updated);
    setShowDetails(true);
    if (onConditionChange) onConditionChange(parsed.condition, text.trim());
    toast.success(`AI analyzed symptoms: "${text.trim()}"`);
  };

  const advice = getHealthAdvice(checkin.condition);

  return (
    <Card className="p-4 sm:p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-secondary/30 shadow-md relative overflow-hidden space-y-4">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-primary/40 text-primary font-bold text-xs px-2.5 py-0.5">
            <Stethoscope className="h-3.5 w-3.5" /> Daily AI Health Validator
          </Badge>
          {checkin.condition !== 'healthy' && (
            <Badge variant="destructive" className="text-xs font-bold px-2 py-0.5 animate-pulse">
              {advice.badge}
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs font-bold text-primary h-7 px-2"
        >
          <span>{showDetails ? 'Hide AI Food Suggestions' : 'Show AI Food Suggestions'}</span>
          {showDetails ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </Button>
      </div>

      {/* QUESTION TITLE & SUBTITLE */}
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-foreground flex items-center gap-2">
          How are you feeling today?
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Tap your condition or type your symptoms below to get personalized AI diet recommendations.
        </p>
      </div>

      {/* CUSTOM SYMPTOM TYPING INPUT */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCustomSymptomSubmit(customText))}
              placeholder="Or type custom symptoms (e.g. headache, acidity, cold & runny nose, fever)..."
              className="pl-9 h-10 text-xs sm:text-sm bg-background/90 border-primary/20 focus:border-primary"
            />
          </div>
          <Button
            type="button"
            onClick={() => handleCustomSymptomSubmit(customText)}
            className="h-10 text-xs font-bold px-4 gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" /> Analyze
          </Button>
        </div>
      </div>

      {/* QUICK SELECTION PILLS - MOBILE FRIENDLY GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
        {CONDITIONS.map((item) => {
          const active = checkin.condition === item.id && !checkin.customSymptoms;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 sm:p-3 text-xs font-bold transition-all shadow-2xs text-center active:scale-95 ${
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02] ring-2 ring-primary/40'
                  : `border-border bg-card text-foreground ${item.bg}`
              }`}
            >
              <span className="text-base sm:text-lg">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary-foreground" />}
            </button>
          );
        })}
      </div>

      {/* DYNAMIC AI RECOMMENDATIONS AREA */}
      {showDetails && (
        <div className="pt-4 border-t border-border/60 animate-fade-in space-y-4">
          {/* AI VERDICT BANNER */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-background/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="text-2xl">{CONDITIONS.find((c) => c.id === checkin.condition)?.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-foreground">
                    {checkin.customSymptoms ? `Symptoms: "${checkin.customSymptoms}"` : advice.title}
                  </h3>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{advice.description}</p>
              </div>
            </div>
          </div>

          {/* AI SUGGESTED FOODS & FOODS TO AVOID */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* RECOMMENDED FOODS */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Utensils className="h-4 w-4" /> Recommended Foods for {advice.title}
              </h4>
              <div className="space-y-2">
                {advice.recommendedFoods.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3 text-xs shadow-2xs"
                  >
                    <span className="text-xl shrink-0">{f.emoji}</span>
                    <div>
                      <span className="font-bold text-foreground text-sm">{f.name}</span>
                      <p className="text-muted-foreground leading-normal mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FOODS TO AVOID & TIPS */}
            <div className="space-y-3">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Foods to Avoid Today
                </h4>
                <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5 text-xs">
                  {advice.avoidFoods.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground font-medium">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4" /> AI Health Tips
                </h4>
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1 text-xs">
                  {advice.tips.map((t, i) => (
                    <p key={i} className="text-muted-foreground font-medium">💡 {t}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
