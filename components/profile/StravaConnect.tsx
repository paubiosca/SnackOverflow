'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';

interface RecentActivity {
  type: string;
  name: string | null;
  date: string;
  startDate: string;
  durationMin: number | null;
  distanceKm: number | null;
  kcal: number | null;
}

// Profile card for connecting Strava (which receives auto-synced activities
// from Garmin watches). Provides:
//   - "Connect Strava" button → OAuth redirect
//   - "Backfill last 90 days" button → one-shot pull
//   - Recent activities preview (last 5)
//   - Today's running kcal summary
export default function StravaConnect() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [todayKcal, setTodayKcal] = useState(0);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Config health: which Strava env vars are missing in the running deploy.
  // null = not checked yet, [] = healthy, non-empty = misconfigured.
  const [missingEnv, setMissingEnv] = useState<string[] | null>(null);

  const refresh = async () => {
    // Probe config first so even an unconfigured deploy renders a clear warning
    // instead of just a broken "Connect Strava" button. /api/strava/health is
    // public and cheap; it returns 503 with `missing: [...]` when env is bad.
    try {
      const h = await fetch('/api/strava/health').then((r) => r.json());
      setMissingEnv(Array.isArray(h?.missing) ? h.missing : []);
    } catch {
      setMissingEnv([]);
    }
    const res = await fetch('/api/strava/status');
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setConnected(!!data.connected);
    setTodayKcal(Number(data.todayKcal ?? 0));
    setRecent(data.recent ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // If we just came back from OAuth, surface a quick toast.
    const p = new URLSearchParams(window.location.search);
    const flag = p.get('strava');
    if (flag === 'connected') setMessage('Strava connected. Backfill the last 90 days to import history.');
    else if (flag === 'denied') setMessage('Strava connection cancelled.');
    else if (flag === 'failed') setMessage('Strava connection failed — try again.');
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/strava/connect');
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else { alert(data.error ?? 'Connect failed'); setConnecting(false); }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Connect failed');
      setConnecting(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setMessage(null);
    try {
      const res = await fetch('/api/strava/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Backfill failed');
      setMessage(`Imported ${data.written} activities (last ${data.days} days).`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-text-primary">Strava (Garmin runs)</h3>
      </div>

      {missingEnv && missingEnv.length > 0 && (
        <div className="mb-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="font-medium">Strava is not configured on this deploy.</p>
            <p className="mt-0.5 text-amber-800">
              Missing env vars: <span className="font-mono">{missingEnv.join(', ')}</span>. Add them in
              Vercel → Project Settings → Environment Variables and redeploy.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-secondary flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking…
        </div>
      ) : !connected ? (
        <>
          <p className="text-sm text-text-secondary mb-3">
            Connect Strava to pull running calories from your Garmin watch automatically.
            Free, secure OAuth — no passwords stored.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
          >
            {connecting ? 'Opening Strava…' : 'Connect Strava'}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-text-primary mb-3">
            <Check className="w-4 h-4 text-green-600" />
            Connected
            <span className="ml-auto text-xs text-text-secondary">
              {todayKcal > 0 ? `${todayKcal} kcal burned today` : 'no run today'}
            </span>
          </div>

          {recent.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {recent.slice(0, 5).map((a) => (
                <div key={a.startDate} className="flex items-center justify-between text-xs text-text-secondary">
                  <div className="truncate flex-1">
                    <span className="font-medium text-text-primary">{a.type}</span>
                    {a.distanceKm ? ` · ${a.distanceKm} km` : ''}
                    {a.durationMin ? ` · ${a.durationMin} min` : ''}
                  </div>
                  <div className="ml-2 shrink-0">
                    {a.kcal ? `${a.kcal} kcal` : '—'} · {new Date(a.startDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="w-full px-4 py-2 border border-border-light rounded-lg text-sm font-medium text-text-primary disabled:opacity-50 active:scale-95 transition-transform touch-manipulation flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Backfilling…' : 'Backfill last 90 days'}
          </button>
        </>
      )}

      {message && (
        <p className="mt-2 text-xs text-text-secondary">{message}</p>
      )}
    </div>
  );
}
