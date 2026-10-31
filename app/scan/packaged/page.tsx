'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Barcode, ScanLine, Loader2, ClipboardList, Camera, Upload, AlertCircle } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { ScanAIAssistant } from '@/components/scan-ai-assistant';
import { toast } from 'sonner';

const BarcodeScanner = dynamic(
  () => import('@/components/barcode-scanner').then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="text-sm font-medium text-muted-foreground py-4 text-center">Loading camera scanner...</div> },
);

const FoodCard = dynamic(
  () => import('@/components/food-card').then((m) => m.FoodCard),
  { loading: () => <div className="py-8 text-center text-sm font-medium text-muted-foreground">Loading analysis results...</div> },
);

function isUsableLabelOcr(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 25) return false;

  const hasIngredientSection = /\bingredients?\b/i.test(normalized);
  const hasSeparators = /[,;:]/.test(normalized);
  const words = normalized.match(/[a-z]{3,}/gi) || [];
  const readableWords = words.filter((word) => !/^(?:the|and|with|from|food|total|amount|daily|value|serving|calories)$/i.test(word));

  return hasIngredientSection && hasSeparators && readableWords.length >= 4;
}

export default function PackagedScanPage() {
  const { profile, targets, token } = useProfile();
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const labelCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const handleScan = async (
    type: 'barcode' | 'ingredients' | 'label-image',
    overrideBarcode?: string,
    imageBase64?: string,
    mimeType?: string,
  ) => {
    if (!profile) {
      toast.error('Please set up your profile first for personalized results.');
      return;
    }
    const code = (overrideBarcode || barcode || '').trim();
    const text = ingredientText.trim();
    const isPureDigits = /^\d{6,14}$/.test(text);

    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';

      const sendBarcode =
        type === 'barcode' ? code : type === 'ingredients' && isPureDigits ? text : (code || undefined);
      // An image-only request must not reuse OCR text from a previous scan.
      const sendText = type === 'label-image' ? undefined : text || undefined;
      const sendImage = type === 'label-image' ? imageBase64 : undefined;

      const res = await fetch('/api/food/packaged', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          barcode: sendBarcode,
          ingredientText: sendText,
          imageBase64: sendImage,
          mimeType,
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to analyze food');
        toast.error(data.error || 'Failed to analyze food');
      } else {
        setAnalysis(data.analysis);
        if (data.analysis.ingredients?.length) {
          setIngredientText(data.analysis.ingredients.join(', '));
        }
        toast.success('Food analyzed successfully!');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeDetected = (code: string) => {
    setBarcode(code);
    handleScan('barcode', code);
  };

  const processLabelImage = async (file: File) => {
    if (!file) return;

    setOcrLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const { compressImage, prepareImageForOcr } = await import('@/lib/image-utils');
      const dataUrl = await compressImage(file);
      setLabelPreview(dataUrl);

      try {
        const { extractTextFromImage } = await import('@/lib/ocr-client');
        const ocrImage = await prepareImageForOcr(file);
        const ocrText = await extractTextFromImage(ocrImage);
        if (isUsableLabelOcr(ocrText)) {
          setIngredientText(ocrText);
          toast.info('Ingredients detected from label — analyzing...');
          await handleScan('ingredients', undefined, dataUrl, 'image/jpeg');
        } else {
          setIngredientText('');
          toast.info('OCR was unclear — using the full label image for analysis...');
          await handleScan('label-image', undefined, dataUrl, 'image/jpeg');
        }
      } catch {
        await handleScan('label-image', undefined, dataUrl, 'image/jpeg');
      }
    } catch {
      setError('Unable to read this image. Please retake the photo with the ingredient text in focus and good lighting.');
      toast.error('Failed to process image');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleLabelImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await processLabelImage(file);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      labelCameraRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      toast.error('Camera access was denied. You can upload a label image instead.');
      labelCameraRef.current?.click();
    }
  };

  const captureCameraImage = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera is still starting. Try again in a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    stopCamera();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (blob) await processLabelImage(new File([blob], 'label-photo.jpg', { type: 'image/jpeg' }));
  };

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const effectiveTargets = targets ?? (profile ? calculateTargets(profile) : null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 animate-fade-in">
      {/* HEADER HERO */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Packaged Food Scanner</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Scan barcodes, take photos of ingredient labels, or paste ingredients to check for harmful additives.
            </p>
          </div>
        </div>
      </div>

      {/* SCAN OPTIONS GRID */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* OPTION 1: BARCODE & QR CODE CAMERA SCAN */}
        <Card className="p-6 border-primary/20 shadow-sm glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Option 1: Camera Barcode & QR Code Scanner</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Point your camera at any product barcode or QR code for instant nutrition facts & additive detection.
          </p>
          <BarcodeScanner onDetected={handleBarcodeDetected} />
        </Card>

        {/* OPTION 2: MANUAL BARCODE / QR CODE */}
        <Card className="p-6 border-primary/20 shadow-sm glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Barcode className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Option 2: Enter Barcode or QR Code Manually</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Type the code numbers or QR content to look up product nutrition facts from Open Food Facts & AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. 3017620422003 or 048500001028"
              onKeyDown={(e) => e.key === 'Enter' && barcode && handleScan('barcode')}
              className="flex-1 text-sm h-11"
            />
            <Button
              onClick={() => handleScan('barcode')}
              disabled={!barcode || loading}
              className="gap-2 h-11 px-5 text-sm font-bold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Scan Code
            </Button>
          </div>
        </Card>

        {/* OPTION 3: OCR LABEL IMAGE */}
        <Card className="p-6 border-primary/20 shadow-sm glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Option 3: Photo of Ingredient Label (OCR)</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Photograph the ingredient list on packaging. AI reads ingredients and flags artificial dyes & preservatives.
          </p>
          {labelPreview && (
            <div className="mb-4 rounded-xl overflow-hidden border border-border max-h-56">
              <img src={labelPreview} alt="Label preview" className="w-full object-cover" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={openCamera}
              disabled={ocrLoading || loading}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-5 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {ocrLoading ? <Loader2 className="h-7 w-7 text-primary animate-spin" /> : <Camera className="h-7 w-7 text-primary" />}
              <span className="text-xs font-bold">Take Label Photo</span>
            </button>
            <button
              type="button"
              onClick={() => labelInputRef.current?.click()}
              disabled={ocrLoading || loading}
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-5 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {ocrLoading ? <Loader2 className="h-7 w-7 text-primary animate-spin" /> : <Upload className="h-7 w-7 text-primary" />}
              <span className="text-xs font-bold">Upload Image</span>
            </button>
          </div>
          {cameraOpen && (
            <div className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-black p-3">
              <video ref={videoRef} autoPlay playsInline muted className="max-h-72 w-full rounded-lg object-contain" />
              <div className="flex gap-2">
                <Button type="button" onClick={captureCameraImage} className="flex-1">Capture label</Button>
                <Button type="button" onClick={stopCamera} variant="outline">Cancel</Button>
              </div>
            </div>
          )}
          <input ref={labelCameraRef} type="file" accept="image/*" capture="environment" onChange={handleLabelImage} className="hidden" />
          <input ref={labelInputRef} type="file" accept="image/*" onChange={handleLabelImage} className="hidden" />
        </Card>

        {/* OPTION 4: PASTE INGREDIENTS */}
        <Card className="p-6 border-primary/20 shadow-sm glass-card">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold">Option 4: Paste Ingredient List</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Copy & paste the ingredient text directly to evaluate harmful additives, trans fats, and allergens.
          </p>
          <Label htmlFor="ingredients" className="sr-only">Ingredients</Label>
          <Textarea
            id="ingredients"
            value={ingredientText}
            onChange={(e) => setIngredientText(e.target.value)}
            placeholder="e.g. Wheat flour, sugar, palm oil, cocoa powder, sodium bicarbonate, artificial flavor (vanillin), soy lecithin..."
            rows={4}
            className="mb-3 text-sm p-3"
          />
          <Button
            onClick={() => handleScan('ingredients')}
            disabled={!ingredientText || loading}
            className="gap-2 h-11 px-5 text-sm font-bold w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Analyze Ingredients
          </Button>
        </Card>
      </div>

      {/* LOADING INDICATOR */}
      {(loading || ocrLoading) && (
        <Card className="p-8 text-center border-primary/30 bg-primary/5 animate-fade-in mb-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-base font-bold text-foreground">
            {ocrLoading ? 'Reading label text with AI...' : 'Analyzing food ingredients...'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Evaluating additives, allergens, and profile safety ratings.</p>
        </Card>
      )}

      {/* ERROR MESSAGE */}
      {error && !loading && (
        <Card className="p-6 text-center border-destructive/50 bg-destructive/5 text-destructive font-semibold text-sm mb-8 animate-scale-in flex items-center justify-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </Card>
      )}

      {/* ANALYSIS RESULT FOOD CARD & AI ASSISTANT BELOW IT */}
      {analysis && !loading && (
        <div className="animate-scale-in space-y-6">
          <FoodCard
            analysis={analysis}
            profile={profile}
            targets={effectiveTargets}
            onLogged={() => router.push('/dashboard')}
          />

          {/* INTEGRATED AI ASSISTANT DIRECTLY BELOW SCAN RESULTS */}
          <ScanAIAssistant
            analysis={analysis}
            onAnalysisUpdated={(newAnalysis) => setAnalysis(newAnalysis)}
            scanType="packaged"
          />
        </div>
      )}
    </div>
  );
}
