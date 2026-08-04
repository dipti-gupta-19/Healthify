'use client';

import { useState } from 'react';
import { useProfile } from '@/components/profile-context';
import { FoodCard } from '@/components/food-card';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Barcode, ScanLine, Loader2, ClipboardList, Camera } from 'lucide-react';
import type { FoodAnalysis } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

export default function PackagedScanPage() {
  const { profile, targets } = useProfile();
  const [barcode, setBarcode] = useState('');
  const [ingredientText, setIngredientText] = useState('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async (type: 'barcode' | 'ingredients', overrideBarcode?: string) => {
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
          profile,
        }),
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

  const handleBarcodeDetected = (code: string) => {
    setBarcode(code);
    handleScan('barcode', code);
  };

  const effectiveTargets = targets ?? (profile ? calculateTargets(profile) : null);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Packaged Food Scanner</h1>
            <p className="text-muted-foreground">Scan a barcode with your camera or paste the ingredient list.</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 1: Camera Barcode Scan</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Use your phone or webcam camera to scan the barcode on any packaged product.
        </p>
        <BarcodeScanner onDetected={handleBarcodeDetected} />
      </Card>

      <Card className="p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center gap-2 mb-4">
          <Barcode className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 2: Enter Barcode Manually</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Type the numbers under the barcode. We fetch nutrition facts and ingredients from Open Food Facts.
        </p>
        <div className="flex gap-3">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 3017620422003"
            onKeyDown={(e) => e.key === 'Enter' && barcode && handleScan('barcode')}
          />
          <Button onClick={() => handleScan('barcode')} disabled={!barcode || loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Scan
          </Button>
        </div>
      </Card>

      <Card className="p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Option 3: Paste Ingredient List</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Paste the full ingredient list printed on the packaging. We flag harmful additives, trans fats, and artificial dyes, and estimate nutrition.
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

      {loading && (
        <div className="flex flex-col items-center py-12 animate-fade-in">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Analyzing food...</p>
        </div>
      )}

      {error && !loading && (
        <Card className="p-6 text-center text-destructive animate-scale-in">
          {error}
        </Card>
      )}

      {analysis && !loading && (
        <div className="animate-scale-in">
          <FoodCard analysis={analysis} profile={profile} targets={effectiveTargets} />
        </div>
      )}
    </div>
  );
}
