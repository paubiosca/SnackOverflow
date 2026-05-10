import Card from '@/components/ui/Card';
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton';

// Renders the dashboard's *shape* while real data loads. Mirrors the live
// layout: header, calorie summary card with ring + macros, then a stack of
// section cards and meal sections.
export default function DashboardSkeleton() {
  return (
    <main className="min-h-screen pb-24">
      <header
        className="bg-white px-4 pb-4 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <SkeletonLine className="w-24 h-6" />
        <SkeletonLine className="w-40 h-3 mt-2" />
      </header>

      <div className="px-4 py-4 space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SkeletonLine className="w-20 h-3 mb-2" />
              <SkeletonLine className="w-32 h-7 mb-2" />
              <SkeletonLine className="w-24 h-3" />
            </div>
            <Skeleton className="rounded-full" style={{ width: 96, height: 96 }} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonLine className="w-12 h-3" />
                <SkeletonLine className="w-16 h-4" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SkeletonLine className="w-32 h-4 mb-3" />
          <Skeleton className="h-24 w-full" />
        </Card>

        <Card>
          <SkeletonLine className="w-28 h-4 mb-3" />
          <Skeleton className="h-16 w-full" />
        </Card>

        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="flex items-center justify-between mb-2">
              <SkeletonLine className="w-20 h-4" />
              <SkeletonLine className="w-12 h-3" />
            </div>
            <SkeletonLine className="w-full h-8 mt-2" />
          </Card>
        ))}
      </div>
    </main>
  );
}
