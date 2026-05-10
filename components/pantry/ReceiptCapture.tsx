'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface Props {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

// Two affordances side-by-side: native camera (capture="environment") and
// gallery picker. Mirrors the photo flow on /add-food but without the resize
// down to 1920px — receipts often need more resolution to be readable.
export default function ReceiptCapture({ onCapture, onCancel }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image is too large. Please pick something under 12MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Resize: keep aspect ratio, max 2400px on the long edge so OCR has
      // enough resolution but the API call doesn't time out.
      const img = new Image();
      img.onload = () => {
        const max = 2400;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width > height) { height = (height / width) * max; width = max; }
          else { width = (width / height) * max; height = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          onCapture(canvas.toDataURL('image/jpeg', 0.88));
        } else {
          onCapture(result);
        }
      };
      img.onerror = () => setError('Failed to process image. Please try another file.');
      img.src = result;
    };
    reader.onerror = () => setError('Failed to read file. Please try again.');
    reader.readAsDataURL(file);
  }, [onCapture]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-accent-red/10 text-accent-red rounded-apple text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light active:bg-gray-100 touch-manipulation"
        >
          <Camera className="w-7 h-7 mb-1 text-accent-blue" />
          <span className="text-sm font-medium text-text-primary">Take Photo</span>
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light active:bg-gray-100 touch-manipulation"
        >
          <ImageIcon className="w-7 h-7 mb-1 text-accent-purple" />
          <span className="text-sm font-medium text-text-primary">Choose Photo</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
        className="hidden"
      />

      <button
        onClick={onCancel}
        className="w-full py-2 text-sm text-text-secondary flex items-center justify-center gap-2"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
    </div>
  );
}
