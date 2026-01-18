'use client';

import { useRef, useState, useCallback } from 'react';
import Button from '@/components/ui/Button';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraActive(true);
        setError(null);
      }
    } catch (err) {
      setError('Unable to access camera. Please use file upload instead.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        stopCamera();
        onCapture(imageData);
      }
    }
  }, [stopCamera, onCapture]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onCapture(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onCapture]);

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {isCameraActive ? (
        <div className="space-y-4">
          <div className="relative rounded-apple-lg overflow-hidden bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="flex-1">
              📸 Capture
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-accent-red/10 text-accent-red rounded-apple text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={startCamera}
              className="flex flex-col items-center justify-center p-8 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue transition-colors"
            >
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm font-medium text-text-primary">Take Photo</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-8 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue transition-colors"
            >
              <span className="text-4xl mb-2">🖼️</span>
              <span className="text-sm font-medium text-text-primary">Upload Image</span>
            </button>
          </div>

          <Button variant="secondary" fullWidth onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
