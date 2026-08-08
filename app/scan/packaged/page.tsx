'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Barcode, ScanLine, Loader2, ClipboardList, Camera, Upload } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

const BarcodeScanner = dynamic(
  () => import('@/components/barcode-scanner').then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="text-sm text-muted-foreground py-2">Loading camera...</div> },
);

const FoodCard = dynamic(
  () => import('@/components/food-card').then((m) => m.FoodCard),
  { loading: () => <div className="py-8 text-center text-muted-foreground">Loading results...</div> },
);

export default function PackagedScanPage() {
  const { profile, targets } = useProfile();
  const router = useRouter();
  const [barcode, setBarcode] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const labelCameraRef = useRef<HTMLInputElement>(null);

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
    const code = overrideBarcode ?? barcode;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const res = await fetch('/api/food/packaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({
          barcode: type === 'barcode' ? code : undefined,
          ingredientText: type === 'ingredients' ? ingredientText : undefined,
          imageBase64: type === 'label-image' ? imageBase64 : undefined,
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
        toast.success('Ingredients analyzed!');
      }
    } catch {
      setError('Something went wrong. Try again.');
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeDetected = (code: string) => {
    setBarcode(code);
    handleScan('barcode', code);
  };

  const handleLabelImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const { compressImage } = await import('@/lib/image-utils');
      const dataUrl = await compressImage(file);
      setLabelPreview(dataUrl);

      try {
        const { extractTextFromImage } = await import('@/lib/ocr-client');
        const ocrText = await extractTextFromImage(file);
        if (ocrText.length > 5) {
          setIngredientText(ocrText);
          toast.info('Ingredients read from label — analyzing...');
          await handleScan('ingredients');
        } else {
          toast.info('Using AI to read ingredient label...');
          await handleScan('label-image', undefined, dataUrl, 'image/jpeg');
        }
      } catch {
        await handleScan('label-image', undefined, dataUrl, 'image/jpeg');
      }
    } catch {
      toast.error('Failed to process image');
    } finally {
      setOcrLoading(false);
    }
  };

  const effectiveTargets = targets ?? (profile ? calculateTargets(profile) : null);

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Packaged Food Scanner</h1>
            <p className="text-muted-foreground">Scan a barcode, photograph the ingredient label, or paste ingredients.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 1: Camera Barcode Scan</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Use your phone or webcam camera to scan the barcode on any packaged product.
        </p>
        <BarcodeScanner onDetected={handleBarcodeDetected} />
      </Card>

      <Card className="p-6 mb-6" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center gap-2 mb-4">
          <Barcode className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 2: Enter Barcode Manually</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Type the numbers under the barcode. We fetch nutrition facts and ingredients from Open Food Facts.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 3017620422003"
            onKeyDown={(e) => e.key === 'Enter' && barcode && handleScan('barcode')}
            className="flex-1"
          />
          <Button onClick={() => handleScan('barcode')} disabled={!barcode || loading} className="gap-2 w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Scan
          </Button>
        </div>
      </Card>

      <Card className="p-6 mb-6" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 3: Scan Ingredient Label (OCR)</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Photograph the ingredient list on the package. OCR reads the text and flags harmful additives automatically.
        </p>
        {labelPreview && (
          <div className="mb-4 rounded-xl overflow-hidden border border-border">
            <img src={labelPreview} alt="Label preview" className="w-full max-h-48 object-cover" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => labelCameraRef.current?.click()}
            disabled={ocrLoading || loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 transition hover:border-primary hover:bg-secondary/50 disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Camera className="h-6 w-6 text-primary" />}
            <span className="text-sm font-medium">Take Photo of Label</span>
          </button>
          <button
            onClick={() => labelInputRef.current?.click()}
            disabled={ocrLoading || loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-4 transition hover:border-primary hover:bg-secondary/50 disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <Upload className="h-6 w-6 text-primary" />}
            <span className="text-sm font-medium">Upload Label Image</span>
          </button>
        </div>
        <input ref={labelCameraRef} type="file" accept="image/*" capture="environment" onChange={handleLabelImage} className="hidden" />
        <input ref={labelInputRef} type="file" accept="image/*" onChange={handleLabelImage} className="hidden" />
      </Card>

      <Card className="p-6 mb-6" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 4: Paste Ingredient List</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Paste the full ingredient list printed on the packaging. We flag harmful additives, trans fats, and artificial dyes.
        </p>
        <Label htmlFor="ingredients" className="sr-only">Ingredients</Label>
        <Textarea
          id="ingredients"
          value={ingredientText}
          onChange={(e) => setIngredientText(e.target.value)}
          placeholder="e.g. Wheat flour, sugar, palm oil, cocoa powder, sodium bicarbonate, artificial flavor (vanillin), soy lecithin..."
          rows={4}
          className="mb-3"
        />
        <Button onClick={() => handleScan('ingredients')} disabled={!ingredientText || loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          Analyze Ingredients
        </Button>
      </Card>

      {(loading || ocrLoading) && (
        <div className="flex flex-col items-center py-12 animate-fade-in">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">
            {ocrLoading ? 'Reading ingredient label...' : 'Analyzing food...'}
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
            targets={effectiveTargets}
            onLogged={() => router.push('/dashboard')}
          />
        </div>
      )}
    </div>
  );
}
