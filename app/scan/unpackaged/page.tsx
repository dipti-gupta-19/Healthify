'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2, Mic, Sparkles, ScanSearch } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

const FoodCard = dynamic(
  () => import('@/components/food-card').then((m) => m.FoodCard),
  { loading: () => <div className="py-8 text-center text-muted-foreground">Loading results...</div> },
);

export default function UnpackagedScanPage() {
  const { profile, targets } = useProfile();
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
      const res = await fetch('/api/food/unpackaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
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
      toast.error('Voice not supported');
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
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Unpackaged Food Scanner</h1>
            <p className="text-muted-foreground">Just upload a photo — AI names the dish, lists ingredients, and checks your profile.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6 border-primary/30">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Upload a Photo</h2>
        </div>
        {imagePreview && (
          <div className="mb-4 rounded-xl overflow-hidden border border-border">
            <img src={imagePreview} alt="Food preview" className="w-full max-h-72 object-cover" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading || imageProcessing}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 p-6 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {imageProcessing ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Camera className="h-8 w-8 text-primary" />}
            <span className="text-sm font-medium">Take Photo</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || imageProcessing}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 p-6 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {imageProcessing ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-primary" />}
            <span className="text-sm font-medium">Upload Image</span>
          </button>
        </div>

        {imagePreview && (
          <Button
            onClick={handleScanPhoto}
            disabled={loading || imageProcessing || !imageBase64 || scanCooldown > 0}
            className="w-full gap-2 mb-3"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing meal...
              </>
            ) : scanCooldown > 0 ? (
              <>Wait {scanCooldown}s (quota cooldown)</>
            ) : (
              <>
                <ScanSearch className="h-5 w-5" />
                Scan & Analyze
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Upload a photo, then tap Scan & Analyze — AI identifies the dish, ingredients, allergens, and your daily budget impact.
        </p>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </Card>

      <button
        type="button"
        onClick={() => setShowOptionalInput(!showOptionalInput)}
        className="text-xs text-muted-foreground hover:text-foreground mb-2"
      >
        {showOptionalInput ? 'Hide' : 'Optional: type dish name if photo fails'}
      </button>

      {showOptionalInput && (
        <Card className="p-4 mb-6">
          <div className="flex gap-2">
            <Input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="Only if photo didn't work..."
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeByName()}
            />
            <Button onClick={handleVoice} variant="outline" size="icon">
              <Mic className={`h-4 w-4 ${listening ? 'text-destructive animate-pulse' : ''}`} />
            </Button>
            <Button onClick={() => handleAnalyzeByName()} disabled={!foodName || loading}>
              Analyze
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground font-medium">AI analyzing your meal...</p>
          <p className="text-xs text-muted-foreground mt-1">Identifying dish, ingredients & nutrition</p>
        </div>
      )}

      {error && !loading && (
        <Card className="p-6 text-center border-destructive/50 bg-destructive/5 mb-6">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-xs text-muted-foreground">
            {error.includes('quota') || error.includes('rate limit')
              ? 'Free tier is limited. Wait 2–5 minutes, then click Scan & Analyze once.'
              : error.includes('GEMINI_API_KEY') || error.includes('Invalid GEMINI')
                ? 'Add GEMINI_API_KEY to .env, then restart: npm run dev:clean'
                : error.includes('not set up') || error.includes('Generative Language')
                  ? 'Enable Generative Language API in Google Cloud, or use a key from aistudio.google.com/apikey'
                  : 'Restart: npm run dev:clean (required after changing .env)'}
          </p>
        </Card>
      )}

      {analysis && !loading && (
        <FoodCard
          analysis={analysis}
          profile={profile}
          targets={targets ?? (profile ? calculateTargets(profile) : null)}
          onLogged={() => router.push('/dashboard')}
        />
      )}
    </div>
  );
}
