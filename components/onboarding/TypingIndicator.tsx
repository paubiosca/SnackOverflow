'use client';

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-secondary-bg rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex gap-1 items-center">
          <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
