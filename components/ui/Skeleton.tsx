// Skeleton primitives. Use these to render the *shape* of content during loads
// so the layout doesn't shift in and the wait feels deliberate.

interface SkelProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkelProps) {
  return <div className={`skeleton rounded-apple ${className}`} style={style} />;
}

export function SkeletonLine({ className = '', style }: SkelProps) {
  return <div className={`skeleton rounded-md h-3 ${className}`} style={style} />;
}

export function SkeletonCircle({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`skeleton rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
