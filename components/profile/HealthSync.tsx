'use client';

import { useEffect, useState } from 'react';
import { Activity, Copy, Check, ExternalLink, Loader2, Trash2 } from 'lucide-react';

interface HealthToken {
  id: string;
  token: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

// Profile-page card for Apple Health sync. The user generates a personal token,
// pastes it into an iOS Shortcut, and the Shortcut POSTs daily Health summaries
// to /api/health/ingest. Free, robust, no third-party aggregator.
export default function HealthSync() {
  const [tokens, setTokens] = useState<HealthToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    fetch('/api/health/token')
      .then((r) => (r.ok ? r.json() : { tokens: [] }))
      .then((d) => setTokens(d.tokens ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/health/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'iPhone' }),
      });
      const data = await res.json();
      if (data.token) setTokens((prev) => [data.token, ...prev]);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/health/token?id=${id}`, { method: 'DELETE' });
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCopy = async (token: HealthToken) => {
    await navigator.clipboard.writeText(token.token);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-5 h-5 text-accent-blue" />
        <h3 className="font-semibold text-text-primary">Apple Health sync</h3>
      </div>

      {loading ? (
        <div className="text-sm text-text-secondary flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking…
        </div>
      ) : tokens.length === 0 ? (
        <>
          <p className="text-sm text-text-secondary mb-3">
            Use an iOS Shortcut to send your daily Apple Health summary (active calories,
            BMR, steps, resting HR) so net calories appear on your dashboard.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
          >
            {creating ? 'Generating…' : 'Generate sync token'}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {tokens.map((t) => (
            <div key={t.id} className="rounded-lg border border-border-light p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {t.label ?? 'Sync token'}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {t.lastUsedAt
                      ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}`
                      : `Created ${new Date(t.createdAt).toLocaleDateString()} · never used`}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  aria-label="Delete token"
                  className="p-1.5 text-text-secondary hover:text-accent-red"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 bg-secondary-bg rounded text-xs font-mono text-text-primary truncate">
                  {t.token}
                </code>
                <button
                  onClick={() => handleCopy(t)}
                  className="px-3 py-1.5 bg-accent-blue text-white rounded text-xs font-medium flex items-center gap-1"
                >
                  {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === t.id ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="text-sm text-accent-blue underline disabled:opacity-50"
          >
            + Generate another
          </button>
        </div>
      )}

      <button
        onClick={() => setShowHelp((s) => !s)}
        className="mt-3 text-sm text-accent-blue flex items-center gap-1"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {showHelp ? 'Hide setup instructions' : 'How to set up the Shortcut'}
      </button>

      {showHelp && (
        <div className="mt-3 text-sm text-text-primary bg-secondary-bg rounded-lg p-3 space-y-2 leading-relaxed">
          <p className="font-medium">In the iOS Shortcuts app:</p>
          <ol className="list-decimal list-inside space-y-1 text-text-secondary">
            <li>New Shortcut. Add action <b>Find Health Samples</b>: Active Energy, Today, sum.</li>
            <li>Set the result variable to <code>active</code>. Repeat for Basal Energy → <code>bmr</code>, Step Count → <code>steps</code>, Resting Heart Rate → <code>resting</code>.</li>
            <li>Add <b>Format Date</b>: Current Date, format <code>yyyy-MM-dd</code> → <code>date</code>.</li>
            <li>Add <b>Get Contents of URL</b>:
              <ul className="list-disc list-inside ml-4">
                <li>URL: <code>{typeof window !== 'undefined' ? window.location.origin : '<APP URL>'}/api/health/ingest</code></li>
                <li>Method: POST</li>
                <li>Headers: <code>Authorization: Bearer YOUR_TOKEN</code>, <code>Content-Type: application/json</code></li>
                <li>Request Body (JSON): <code>{`{ "date": date, "active_kcal": active, "bmr_kcal": bmr, "steps": steps, "resting_hr": resting }`}</code></li>
              </ul>
            </li>
            <li>In <b>Automation</b>, schedule the Shortcut daily (e.g., 11:00 PM) with "Run Immediately" enabled. iOS 17+ runs it without a notification tap.</li>
          </ol>
          <p className="text-text-secondary text-xs italic">
            Tip: the same Shortcut works manually too — long-press it on the home screen and tap Run to backfill any day.
          </p>

          <p className="font-medium pt-2 border-t border-border-light">One-time history backfill (optional)</p>
          <p className="text-text-secondary text-xs">
            Make a second Shortcut that loops over the last 30-90 days and POSTs them all at once.
            The endpoint accepts an array of <code>{`{ date, active_kcal, bmr_kcal, steps, resting_hr }`}</code>.
            Pattern:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-text-secondary">
            <li><b>Get Numbers from Input</b> = 30 (or however many days back you want).</li>
            <li><b>Repeat with each</b> from 1 to 30:
              <ul className="list-disc list-inside ml-4">
                <li>Compute <code>day = today − n days</code>.</li>
                <li>Pull Active/Basal/Steps/RHR for that day (Date Range = day to day+1).</li>
                <li><b>Add to Dictionary</b>: build a per-day object with the same keys.</li>
                <li><b>Add to List</b>: append the dictionary to a results list.</li>
              </ul>
            </li>
            <li>One <b>Get Contents of URL</b> POST — Request Body: the list (JSON array). Same Bearer header.</li>
          </ol>
          <p className="text-text-secondary text-xs italic">
            Run once. After that the daily Shortcut keeps things fresh.
          </p>
        </div>
      )}
    </div>
  );
}
