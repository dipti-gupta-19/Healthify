'use client';

import { useState, useRef } from 'react';
import { useProfile } from '@/components/profile-context';
import { FoodCard } from '@/components/food-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2, Mic, Search } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

export default function UnpackagedScanPage() {
  const { profile, targets } = useProfile();
  const [foodName, setFoodName] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (name?: string) => {
    const query = name || foodName;
    if (!query.trim()) {
      toast.error('Enter or say a food name first');
      return;
    }
    if (!profile) {
      toast.error('Please set up your profile first for personalized results.');
      return;
    }
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const res = await fetch('/api/food/unpackaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({ foodName: query, profile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to analyze food');
        toast.error(data.error || 'Failed to analyze food');
      } else {
        setAnalysis(data.analysis);
      }
    } catch {
      setError('Something went wrong. Try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Voice input not supported on this browser');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setFoodName(transcript);
      setListening(false);
      handleAnalyze(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error('Voice input failed');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const fileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFoodName(fileName);
      toast.info(`Photo uploaded! Enter the dish name and tap Analyze. (Vision API can be added next.)`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Unpackaged Food Scanner</h1>
            <p className="text-muted-foreground">Upload a photo or name any meal — restaurant or home-cooked.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6 animate-slide-up">
        <h2 className="text-lg font-semibold mb-4">Upload a Photo</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary hover:bg-secondary/50"
          >
            <Camera className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Take Photo</span>
            <span className="text-xs text-muted-foreground">Use camera (mobile)</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary hover:bg-secondary/50"
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Upload Image</span>
            <span className="text-xs text-muted-foreground">From gallery</span>
          </button>
        </div>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <p className="text-xs text-muted-foreground">
          On mobile, "Take Photo" opens your camera directly. On desktop, use "Upload Image".
        </p>
      </Card>

      <Card className="p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-lg font-semibold mb-4">Name or Speak the Dish</h2>
        <div className="flex gap-3 mb-3">
          <Input
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="e.g. 2 rotis and dal, chicken biryani, paneer curry..."
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <Button onClick={handleVoice} variant="outline" size="icon" title="Voice input">
            <Mic className={`h-4 w-4 ${listening ? 'text-destructive animate-pulse' : ''}`} />
          </Button>
          <Button onClick={() => handleAnalyze()} disabled={!foodName || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Analyze
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {listening ? 'Listening... speak the dish name' : 'Tap the mic to speak, or type the dish name'}
        </p>
      </Card>

      {loading && (
        <div className="flex flex-col items-center py-12 animate-fade-in">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Identifying food and analyzing nutrition...</p>
        </div>
      )}

      {error && !loading && (
        <Card className="p-6 text-center text-destructive animate-scale-in">
          {error}
        </Card>
      )}

      {analysis && !loading && (
        <div className="animate-scale-in">
          <FoodCard analysis={analysis} profile={profile} targets={targets ?? (profile ? calculateTargets(profile) : null)} />
        </div>
      )}
    </div>
  );
}
