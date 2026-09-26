'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2, Mic, Sparkles, ScanSearch, AlertCircle, Utensils } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { ScanAIAssistant } from '@/components/scan-ai-assistant';
import { toast } from 'sonner';

const FoodCard = dynamic(
  () => import('@/components/food-card').then((m) => m.FoodCard),
  { loading: () => <div className="py-8 text-center text-sm font-medium text-muted-foreground">Loading analysis results...</div> },
);

export default function UnpackagedScanPage() {
  const { profile, targets, token } = useProfile();
  const router = useRouter();
  const [foodName, setFoodName] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [showOptionalInput, setShowOptionalInput] = useState(false);
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

  const runPhotoAnalysis = async (base64: string, type: string) => {
    if (!profile) {
      toast.error('Please set up your profile first.');
      return;
    }
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';

      const res = await fetch('/api/food/unpackaged', {
        method: 'POST',
        headers,
        body: JSON.stringify({ profile, imageBase64: base64, mimeType: type }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Failed to analyze food photo';
        setError(errMsg);
        if (/quota|rate limit/i.test(errMsg)) setScanCooldown(120);
        toast.error('Could not analyze photo — see details below');
      } else {
        setAnalysis(data.analysis);
        setFoodName(data.identifiedName || '');
        toast.success(`Identified: ${data.identifiedName}`);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeByName = async (name?: string) => {
    const query = (name || foodName).trim();
    if (!query) return;
    if (!profile) {
      toast.error('Please set up your profile first.');
      return;
    }
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';

      const res = await fetch('/api/food/unpackaged', {
        method: 'POST',
        headers,
        body: JSON.stringify({ profile, foodName: query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to analyze');
        toast.error(data.error || 'Failed');
      } else {
        setAnalysis(data.analysis);
        toast.success(`Analyzed: ${data.identifiedName}`);
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Voice recognition is not supported in this browser');
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

  const handleScanPhoto = () => {
    if (scanCooldown > 0) {
      toast.error(`Quota cooldown — please wait ${scanCooldown}s before scanning again`);
      return;
    }
    if (!imageBase64) {
      toast.error('Please upload or take a photo first');
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
      const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
      setMimeType(mimeMatch?.[1] === 'image/jpg' ? 'image/jpeg' : (mimeMatch?.[1] || 'image/jpeg'));
      toast.success('Photo ready — click "Scan & Analyze Meal" below');
    } catch {
      toast.error('Failed to process image');
    } finally {
      setImageProcessing(false);
    }
    e.target.value = '';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 animate-fade-in">
      {/* HEADER HERO */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Unpackaged Food Scanner</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Snap or upload a photo of any home-cooked dish or meal. AI identifies ingredients, estimates calories, and checks your daily budget.
            </p>
          </div>
        </div>
      </div>

      {/* UPLOAD & CAMERA CARD */}
      <Card className="p-6 sm:p-8 mb-8 border-emerald-500/30 shadow-md glass-card max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Meal Photo Recognition</h2>
        </div>

        {imagePreview && (
          <div className="mb-6 rounded-2xl overflow-hidden border-2 border-emerald-500/30 max-h-80 shadow-md">
            <img src={imagePreview} alt="Food photo preview" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading || imageProcessing}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-500/40 p-6 sm:p-8 transition hover:border-emerald-500 hover:bg-emerald-500/5 disabled:opacity-50"
          >
            {imageProcessing ? (
              <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
            ) : (
              <Camera className="h-10 w-10 text-emerald-500" />
            )}
            <span className="text-sm font-bold">Take Meal Photo</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || imageProcessing}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-emerald-500/40 p-6 sm:p-8 transition hover:border-emerald-500 hover:bg-emerald-500/5 disabled:opacity-50"
          >
            {imageProcessing ? (
              <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
            ) : (
              <Upload className="h-10 w-10 text-emerald-500" />
            )}
            <span className="text-sm font-bold">Upload Image</span>
          </button>
        </div>

        {imagePreview && (
          <Button
            onClick={handleScanPhoto}
            disabled={loading || imageProcessing || !imageBase64 || scanCooldown > 0}
            className="w-full gap-2 h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md mb-4"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                AI Analyzing Meal Photo...
              </>
            ) : scanCooldown > 0 ? (
              <>Wait {scanCooldown}s (quota cooldown)</>
            ) : (
              <>
                <ScanSearch className="h-5 w-5" />
                Scan & Analyze Meal
              </>
            )}
          </Button>
        )}

        <p className="text-xs sm:text-sm text-muted-foreground text-center">
          Our Vision AI identifies dish name, ingredient breakdown, portion size, and profile safety score.
        </p>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </Card>

      {/* OPTIONAL MANUAL DISH NAME INPUT */}
      <div className="max-w-4xl mx-auto mb-8 text-center">
        <button
          type="button"
          onClick={() => setShowOptionalInput(!showOptionalInput)}
          className="text-xs sm:text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <Utensils className="h-4 w-4" />
          {showOptionalInput ? 'Hide manual dish input' : 'Or search by dish name / voice'}
        </button>

        {showOptionalInput && (
          <Card className="p-5 mt-3 border-border shadow-sm text-left animate-slide-up">
            <div className="flex gap-2">
              <Input
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="e.g. Grilled Chicken Salad, Paneer Butter Masala..."
                className="text-sm h-11"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeByName()}
              />
              <Button onClick={handleVoice} variant="outline" className="h-11 w-11 p-0 shrink-0">
                <Mic className={`h-5 w-5 ${listening ? 'text-destructive animate-pulse' : ''}`} />
              </Button>
              <Button onClick={() => handleAnalyzeByName()} disabled={!foodName || loading} className="h-11 px-5 font-bold text-sm">
                Analyze
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* LOADING */}
      {loading && (
        <Card className="p-8 text-center border-emerald-500/30 bg-emerald-500/5 animate-fade-in max-w-4xl mx-auto mb-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-base font-bold text-foreground">AI is inspecting your meal photo...</p>
          <p className="text-sm text-muted-foreground mt-1">Identifying dish ingredients, calories, macros, and profile fit.</p>
        </Card>
      )}

      {/* ERROR */}
      {error && !loading && (
        <Card className="p-6 text-center border-destructive/50 bg-destructive/5 text-destructive font-semibold text-sm max-w-4xl mx-auto mb-8 animate-scale-in">
          <div className="flex items-center justify-center gap-2 mb-2 font-bold text-base">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
          <p className="text-xs text-muted-foreground">
            {error.includes('quota') || error.includes('rate limit')
              ? 'Free API quota reached. Please wait 1–2 minutes before trying again.'
              : 'Try re-uploading the photo or typing the dish name.'}
          </p>
        </Card>
      )}

      {/* RESULTS CARD & AI ASSISTANT BELOW IT */}
      {analysis && !loading && (
        <div className="animate-scale-in space-y-6 max-w-4xl mx-auto">
          <FoodCard
            analysis={analysis}
            profile={profile}
            targets={targets ?? (profile ? calculateTargets(profile) : null)}
            onLogged={() => router.push('/dashboard')}
          />

          {/* INTEGRATED AI ASSISTANT DIRECTLY BELOW SCAN RESULTS */}
          <ScanAIAssistant
            analysis={analysis}
            onAnalysisUpdated={(newAnalysis) => setAnalysis(newAnalysis)}
            scanType="unpackaged"
          />
        </div>
      )}
    </div>
  );
}
