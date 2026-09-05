'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  Loader2,
  Mic,
  Sparkles,
  ScanSearch,
  MessageSquareText,
  Utensils,
  ArrowRight,
} from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

const FoodCard = dynamic(
  () => import('@/components/food-card').then((m) => m.FoodCard),
  { loading: () => <div className="py-8 text-center text-muted-foreground">Loading results...</div> },
);

const QUICK_MEAL_SUGGESTIONS = [
  '2 Rotis + 1 Bowl Dal Tadka',
  '1 Plate Chicken Biryani',
  '3 Idlis + Sambar & Chutney',
  '2 Boiled Eggs + 1 Slice Toast',
  '150g Paneer Tikka + Green Salad',
  '1 Bowl Curd Rice with Tadka',
  '1 Bowl Oats with Milk & Honey',
  '1 Masala Dosa with Sambar',
];

export default function UnpackagedScanPage() {
  const { profile, targets } = useProfile();
  const router = useRouter();

  // Mode: 'chat' (Describe to LLM) or 'photo' (Camera / Upload)
  const [activeTab, setActiveTab] = useState<'chat' | 'photo'>('chat');
  const [foodName, setFoodName] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [scanCooldown, setScanCooldown] = useState(0);

  useEffect(() => {
    if (scanCooldown <= 0) return;
    const t = setInterval(() => setScanCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [scanCooldown]);

  const handleAnalyzeByName = async (nameToAnalyze?: string) => {
    const query = (nameToAnalyze || foodName).trim();
    if (!query) {
      toast.error('Please enter what you ate and how much');
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
        body: JSON.stringify({ profile, foodName: query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to analyze meal');
        toast.error(data.error || 'Failed');
      } else {
        setAnalysis(data.analysis);
        toast.success(`Analyzed: ${data.identifiedName}`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Voice recognition is not supported in this browser.');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setFoodName(transcript);
      setListening(false);
      handleAnalyzeByName(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const runPhotoAnalysis = async (base64: string, type: string) => {
    if (!profile) {
      toast.error('Please set up your profile first.');
      return;
    }
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const res = await fetch('/api/food/unpackaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({ profile, imageBase64: base64, mimeType: type }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to analyze food';
        setError(errMsg);
        if (/quota|rate limit/i.test(errMsg)) setScanCooldown(120);
        toast.error('Could not analyze photo — check details below');
      } else {
        setAnalysis(data.analysis);
        setFoodName(data.identifiedName || '');
        toast.success(`Identified: ${data.identifiedName}`);
      }
    } catch {
      setError('Something went wrong. Try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleScanPhoto = () => {
    if (scanCooldown > 0) {
      toast.error(`Quota cooldown — wait ${scanCooldown}s before scanning again`);
      return;
    }
    if (!imageBase64) {
      toast.error('Upload a photo first');
      return;
    }
    runPhotoAnalysis(imageBase64, mimeType);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setAnalysis(null);
    setFoodName('');
    setImageProcessing(true);

    try {
      const { compressImage } = await import('@/lib/image-utils');
      const dataUrl = await compressImage(file, 800);
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setMimeType('image/jpeg');
      toast.success('Photo ready — tap "Scan & Analyze" below');
    } catch {
      toast.error('Failed to process image');
    } finally {
      setImageProcessing(false);
    }
    e.target.value = '';
  };

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
            <Utensils className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Unpackaged Food Analyzer</h1>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs hidden sm:inline-flex">
                AI Powered
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              No barcode? Describe what you ate with quantities or upload a photo.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex rounded-xl bg-muted/70 p-1 border border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
            activeTab === 'chat'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquareText className="h-4 w-4 text-primary" />
          <span>Describe Meal (Text / Voice)</span>
          <span className="hidden sm:inline-block rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.2 font-medium">
            Fastest
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photo')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
            activeTab === 'photo'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="h-4 w-4 text-primary" />
          <span>Photo Scanner</span>
        </button>
      </div>

      {/* Mode 1: Conversational LLM Input */}
      {activeTab === 'chat' && (
        <Card className="p-5 sm:p-6 border-primary/20 bg-card/60 backdrop-blur-sm shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm sm:text-base font-semibold">Tell Healthify AI what you ate</h2>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Includes quantities & portions
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyzeByName();
            }}
            className="space-y-3"
          >
            <div className="relative">
              <Input
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g. 2 rotis with 1 bowl dal tadka and cucumber salad, or 150g grilled chicken with rice"
                disabled={loading}
                className="pr-12 text-xs sm:text-sm h-11 bg-background/80 focus-visible:ring-primary/40 border-primary/25"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleVoice}
                disabled={loading}
                className="absolute right-1 top-1 h-9 w-9 text-muted-foreground hover:text-primary"
                title="Speak meal"
              >
                <Mic className={`h-4 w-4 ${listening ? 'text-destructive animate-pulse' : ''}`} />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Tip: Mention quantities (e.g. 2 pieces, 1 bowl, 150g, 1 cup) for precise macro breakdown.
              </p>
              <Button
                type="submit"
                disabled={!foodName.trim() || loading}
                className="gap-2 shrink-0 px-4 h-9"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Analyze Meal</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Quick Tap Suggestions */}
          <div className="border-t border-border/60 pt-3 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Popular combinations with quantities:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MEAL_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFoodName(s);
                    handleAnalyzeByName(s);
                  }}
                  disabled={loading}
                  className="rounded-full border border-border bg-background/80 hover:bg-primary/10 hover:border-primary/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Mode 2: Photo Scanner */}
      {activeTab === 'photo' && (
        <Card className="p-6 border-primary/20 bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Upload or Snap Meal Photo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={imageProcessing || loading}
              className="h-24 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Camera className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Take Photo</span>
              <span className="text-[11px] text-muted-foreground">Using your phone camera</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageProcessing || loading}
              className="h-24 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Upload Image</span>
              <span className="text-[11px] text-muted-foreground">PNG, JPG up to 10MB</span>
            </Button>
          </div>

          {imagePreview && (
            <div className="mb-4 rounded-xl overflow-hidden border bg-black/5 flex justify-center max-h-64">
              <img src={imagePreview} alt="Food preview" className="max-h-64 object-contain rounded-lg" />
            </div>
          )}

          {imageBase64 && (
            <Button
              onClick={handleScanPhoto}
              disabled={loading || imageProcessing || !imageBase64 || scanCooldown > 0}
              className="w-full gap-2 mb-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Photo...
                </>
              ) : scanCooldown > 0 ? (
                <>Wait {scanCooldown}s (cooldown)</>
              ) : (
                <>
                  <ScanSearch className="h-5 w-5" />
                  Scan & Analyze Photo
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            AI identifies the dish, visible ingredients, portions, and compares against your profile targets.
          </p>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center py-10 animate-fade-in">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-foreground">Healthify AI is analyzing your meal...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Computing calories, macros, portion weights, and dietary suitability
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="p-5 text-center border-destructive/50 bg-destructive/5 animate-scale-in">
          <p className="text-sm text-destructive font-semibold mb-1">{error}</p>
          <p className="text-xs text-muted-foreground">
            Please check your input or connection and try again.
          </p>
        </Card>
      )}

      {/* Results rendering into FoodCard */}
      {analysis && !loading && (
        <div className="animate-scale-in pt-2">
          <FoodCard
            analysis={analysis}
            profile={profile}
            targets={targets ?? (profile ? calculateTargets(profile) : null)}
            onLogged={() => router.push('/dashboard')}
          />
        </div>
      )}
    </div>
  );
}
