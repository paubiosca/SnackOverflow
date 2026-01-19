'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Camera, Type, Upload } from 'lucide-react';

interface IngredientInputProps {
  onAnalyze: (imageData: string | null, textInput: string) => void;
  onCancel: () => void;
  isAnalyzing: boolean;
}

export default function IngredientInput({ onAnalyze, onCancel, isAnalyzing }: IngredientInputProps) {
  const [inputMode, setInputMode] = useState<'photo' | 'text'>('text');
  const [textInput, setTextInput] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      onAnalyze(null, textInput);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageData(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        setImageData(data);
        stopCamera();
      }
    }
  };

  const handlePhotoSubmit = () => {
    if (imageData) {
      onAnalyze(imageData, textInput);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 bg-secondary-bg rounded-apple p-1">
        <button
          onClick={() => setInputMode('text')}
          className={`flex-1 py-2 px-4 rounded-apple text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            inputMode === 'text'
              ? 'bg-white text-accent-orange shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Type className="w-4 h-4" />
          Type Ingredients
        </button>
        <button
          onClick={() => setInputMode('photo')}
          className={`flex-1 py-2 px-4 rounded-apple text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            inputMode === 'photo'
              ? 'bg-white text-accent-orange shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Camera className="w-4 h-4" />
          Take Photo
        </button>
      </div>

      {/* Text input mode */}
      {inputMode === 'text' && (
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">What ingredients do you have?</h3>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="e.g., chicken breast, tomatoes, garlic, olive oil, pasta, parmesan cheese..."
            className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-orange min-h-[120px] resize-none"
          />
          <p className="text-xs text-text-secondary mt-2">
            List your ingredients separated by commas. Include approximate amounts if you know them.
          </p>
        </Card>
      )}

      {/* Photo input mode */}
      {inputMode === 'photo' && !showCamera && !imageData && (
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">Snap your fridge or pantry</h3>
          <div className="space-y-3">
            <button
              onClick={startCamera}
              className="w-full p-8 border-2 border-dashed border-border-light rounded-apple hover:border-accent-orange hover:bg-orange-50 transition-colors flex flex-col items-center gap-3"
            >
              <Camera className="w-12 h-12 text-accent-orange" />
              <span className="text-text-secondary">Open Camera</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-light" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-sm text-text-secondary">or</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-border-light rounded-apple hover:border-accent-orange hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5 text-text-secondary" />
              <span className="text-text-secondary">Upload Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </Card>
      )}

      {/* Camera view */}
      {showCamera && (
        <Card>
          <div className="relative rounded-apple overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="secondary" onClick={stopCamera}>
              Cancel
            </Button>
            <Button onClick={capturePhoto} fullWidth>
              Capture
            </Button>
          </div>
        </Card>
      )}

      {/* Image preview */}
      {imageData && !showCamera && (
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">Photo Preview</h3>
          <div className="rounded-apple overflow-hidden mb-4">
            <img src={imageData} alt="Ingredients" className="w-full h-48 object-cover" />
          </div>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Add any additional ingredients not in the photo (optional)"
            className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-orange min-h-[80px] resize-none"
          />
          <button
            onClick={() => setImageData(null)}
            className="mt-2 text-sm text-accent-red hover:underline"
          >
            Remove photo
          </button>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        {inputMode === 'text' ? (
          <Button
            onClick={handleTextSubmit}
            fullWidth
            disabled={!textInput.trim() || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Find Recipes'}
          </Button>
        ) : (
          <Button
            onClick={handlePhotoSubmit}
            fullWidth
            disabled={!imageData || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Ingredients'}
          </Button>
        )}
      </div>
    </div>
  );
}
