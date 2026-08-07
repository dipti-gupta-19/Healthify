'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2, Mic, Search } from 'lucide-react';
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (name?: string, ocrText?: string) => {
    const query = name || foodName;
    if (!query.trim() && !imageBase64) {
      toast.error('Enter a food name, upload a photo, or use voice input');
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
        body: JSON.stringify({
          foodName: query.trim() || undefined,
          profile,
          imageBase64,
          ocrText,
          mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to analyze food');
        toast.error(data.error || 'Failed to analyze food');
      } else {
        setAnalysis(data.analysis);
        if (data.identifiedName && !foodName) {
          setFoodName(data.identifiedName);
        }
        if (data.identifiedBy === 'ai') {
          toast.success('Food identified from photo!');
        }
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!profile) {
      toast.error('Please set up your profile first for personalized results.');
      return;
    }

    setOcrLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const { compressImage } = await import('@/lib/image-utils');
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setMimeType('image/jpeg');

      try {
        const { extractTextFromImage } = await import('@/lib/ocr');
        const ocrText = await extractTextFromImage(file);
        if (ocrText.length > 2) {
          toast.info('Analyzing image...');
          await handleAnalyze(undefined, ocrText);
        } else {
          toast.info('Identifying food from photo...');
          await handleAnalyze();
        }
      } catch {
        toast.info('Analyzing photo...');
        await handleAnalyze();
      }
    } catch {
      toast.error('Failed to process image');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-8">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Unpackaged Food Scanner</h1>
            <p className="text-muted-foreground">Upload a photo or name any meal — restaurant or home-cooked.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6 animate-slide-up">
        <h2 className="text-lg font-semibold mb-4">Upload a Photo</h2>
        {imagePreview && (
          <div className="mb-4 rounded-xl overflow-hidden border border-border">
            <img src={imagePreview} alt="Food preview" className="w-full max-h-64 object-cover" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={ocrLoading || loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary hover:bg-secondary/50 disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Camera className="h-8 w-8 text-primary" />}
            <span className="text-sm font-medium">{ocrLoading ? 'Reading...' : 'Take Photo'}</span>
            <span className="text-xs text-muted-foreground">Use camera (mobile)</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading || loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary hover:bg-secondary/50 disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-primary" />}
            <span className="text-sm font-medium">{ocrLoading ? 'Reading...' : 'Upload Image'}</span>
            <span className="text-xs text-muted-foreground">From gallery</span>
          </button>
        </div>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <p className="text-xs text-muted-foreground">
          Photo is analyzed automatically — AI identifies the dish and shows personalized nutrition.
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
          <Button onClick={() => handleAnalyze()} disabled={(!foodName && !imageBase64) || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Analyze
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {listening ? 'Listening... speak the dish name' : 'Tap the mic to speak, or type the dish name'}
        </p>
      </Card>

      {(loading || ocrLoading) && (
        <div className="flex flex-col items-center py-12 animate-fade-in">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">
            {ocrLoading ? 'Reading image text...' : 'Identifying food and analyzing nutrition...'}
          </p>
        </div>
      )}

      {error && !loading && (
        <Card className="p-6 text-center text-destructive animate-scale-in">
          {error}
        </Card>
      )}

      {analysis && !loading && (
        <div className="animate-scale-in">
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
