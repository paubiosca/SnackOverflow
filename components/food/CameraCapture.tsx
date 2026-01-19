'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';

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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check for multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // Ignore errors, assume single camera
      }
    };
    checkCameras();
  }, []);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = useCallback(async (facing: 'environment' | 'user' = facingMode) => {
    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          }
        });
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);
      setFacingMode(facing);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please use file upload instead.');
    }
  }, [stream, facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [stream]);

  const switchCamera = useCallback(() => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the image if using front camera
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0);

        // Convert to JPEG with good quality (0.85)
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        stopCamera();
        onCapture(imageData);
      }
    }
  }, [stopCamera, onCapture, facingMode]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image is too large. Please select an image under 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;

        // Resize image if needed for better performance
        const img = new Image();
        img.onload = () => {
          const maxDimension = 1920;
          let { width, height } = img;

          // Only resize if image is larger than max dimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const resizedData = canvas.toDataURL('image/jpeg', 0.85);
              onCapture(resizedData);
              return;
            }
          }

          // If no resize needed, use original
          onCapture(result);
        };
        img.onerror = () => {
          setError('Failed to process image. Please try another file.');
        };
        img.src = result;
      };
      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  }, [onCapture]);

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  // Directly open camera on mobile using file input with capture attribute
  const openMobileCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input - with capture for mobile camera */}
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
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Camera switch button */}
            {hasMultipleCameras && (
              <button
                onClick={switchCamera}
                className="absolute top-3 right-3 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors touch-manipulation"
                aria-label="Switch camera"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleCancel} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={capturePhoto} className="flex-1">
              <Camera className="w-4 h-4 mr-2" />
              Capture
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
              onClick={() => startCamera()}
              className="flex flex-col items-center justify-center p-8 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue active:bg-gray-100 transition-all touch-manipulation"
            >
              <Camera className="w-10 h-10 mb-2 text-accent-blue" />
              <span className="text-sm font-medium text-text-primary">Take Photo</span>
              <span className="text-xs text-text-secondary mt-1">Use camera</span>
            </button>

            <button
              onClick={() => {
                // Create a new file input without capture attribute for gallery access
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                input.click();
              }}
              className="flex flex-col items-center justify-center p-8 bg-secondary-bg rounded-apple-lg border-2 border-dashed border-border-light hover:border-accent-blue active:bg-gray-100 transition-all touch-manipulation"
            >
              <Upload className="w-10 h-10 mb-2 text-accent-purple" />
              <span className="text-sm font-medium text-text-primary">Upload Image</span>
              <span className="text-xs text-text-secondary mt-1">From gallery</span>
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
