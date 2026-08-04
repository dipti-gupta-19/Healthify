'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Camera, X, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const startScan = async () => {
    setStarting(true);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      const reader = new BrowserMultiFormatReader(hints);

      if (!videoRef.current) {
        toast.error('Camera element not ready');
        setStarting(false);
        return;
      }

      setScanning(true);
      setStarting(false);

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText();
            stopScan();
            onDetected(code);
            toast.success(`Barcode detected: ${code}`);
          }
        },
      );
      controlsRef.current = controls;
    } catch (err) {
      setScanning(false);
      setStarting(false);
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      toast.error(`Camera error: ${msg}. Check permissions or use manual entry.`);
    }
  };

  const stopScan = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  return (
    <div>
      {!scanning ? (
        <Button onClick={startScan} variant="outline" className="w-full gap-2" disabled={starting}>
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {starting ? 'Starting camera...' : 'Scan with Camera'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border-2 border-primary bg-black">
            <video ref={videoRef} className="w-full" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-16 border-2 border-primary rounded-lg bg-primary/10">
                <div className="h-full w-full flex items-center justify-center">
                  <ScanLine className="h-6 w-6 text-primary animate-pulse" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Point your camera at the barcode on the packaging
          </p>
          <Button onClick={stopScan} variant="outline" className="w-full gap-2">
            <X className="h-4 w-4" /> Stop Camera
          </Button>
        </div>
      )}
    </div>
  );
}
