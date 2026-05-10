'use client';

import { useRef, useState } from 'react';
import JSZip from 'jszip';
import { Upload, Check, FileArchive, Loader2 } from 'lucide-react';

// One-off Apple Health backfill. User does:
//   iPhone: Health → tap profile photo → Export All Health Data → wait 5-15 min
//          → Share → AirDrop / iCloud Drive to laptop
//   Laptop: drag the export.zip here. Done.
//
// Parsing happens 100% in the browser (Vercel serverless can't handle a 200MB
// upload in one request anyway). We aggregate per-day totals for the four
// metrics we care about and POST the small JSON array to /api/health/import.

const RELEVANT_TYPES: Record<string, 'active' | 'bmr' | 'steps' | 'rhr'> = {
  HKQuantityTypeIdentifierActiveEnergyBurned: 'active',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'bmr',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
};

interface DailyAgg {
  active: number;
  bmr: number;
  steps: number;
  rhr: number[]; // average at the end
}

// Match a self-closing <Record .../> tag. Greedy on attrs but capture only what
// we need. Attribute order in Apple's export is stable: type, sourceName,
// sourceVersion?, unit?, creationDate, startDate, endDate, value.
const RECORD_RE =
  /<Record\s+type="([^"]+)"[^/]*?startDate="([^"]+)"[^/]*?value="([^"]+)"[^/]*?\/>/g;

async function parseExportXml(
  text: string,
  onProgress: (count: number) => void,
): Promise<{ date: string; active_kcal: number; bmr_kcal: number; steps: number; resting_hr: number | null }[]> {
  const daily = new Map<string, DailyAgg>();
  let count = 0;
  let m: RegExpExecArray | null;
  RECORD_RE.lastIndex = 0;
  while ((m = RECORD_RE.exec(text)) !== null) {
    const kind = RELEVANT_TYPES[m[1]];
    if (!kind) continue;
    const day = m[2].slice(0, 10); // "YYYY-MM-DD HH:mm:ss +0000" → "YYYY-MM-DD"
    const v = parseFloat(m[3]);
    if (!Number.isFinite(v)) continue;
    let row = daily.get(day);
    if (!row) {
      row = { active: 0, bmr: 0, steps: 0, rhr: [] };
      daily.set(day, row);
    }
    if (kind === 'rhr') row.rhr.push(v);
    else (row[kind] as number) += v;
    if (++count % 25000 === 0) {
      onProgress(count);
      // Yield to the event loop so the UI updates.
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress(count);

  const out: { date: string; active_kcal: number; bmr_kcal: number; steps: number; resting_hr: number | null }[] = [];
  Array.from(daily.entries()).forEach(([date, r]) => {
    out.push({
      date,
      active_kcal: Math.round(r.active),
      bmr_kcal: Math.round(r.bmr),
      steps: Math.round(r.steps),
      resting_hr: r.rhr.length ? Math.round(r.rhr.reduce((a: number, b: number) => a + b, 0) / r.rhr.length) : null,
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

type Stage = 'idle' | 'unzipping' | 'parsing' | 'uploading' | 'done' | 'error';

export default function HealthImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<{ days: number; written: number; firstDate?: string; lastDate?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setStage('idle');
    setResult(null);
    setError(null);
    try {
      setStage('unzipping');
      setProgress(`Reading ${(file.size / 1_000_000).toFixed(0)} MB zip…`);
      const zip = await JSZip.loadAsync(file);
      // Apple Health export contains "apple_health_export/export.xml" (path may vary by locale)
      const xmlEntry = Object.values(zip.files).find((f) => /export\.xml$/i.test(f.name) && !f.dir);
      if (!xmlEntry) throw new Error('Could not find export.xml inside the zip — is this an Apple Health export?');

      setProgress('Extracting XML…');
      const text = await xmlEntry.async('text');

      setStage('parsing');
      setProgress('Parsing health records…');
      const days = await parseExportXml(text, (n) => {
        setProgress(`Parsing… ${n.toLocaleString()} records scanned`);
      });
      if (days.length === 0) throw new Error('No relevant health records found.');

      setStage('uploading');
      setProgress(`Uploading ${days.length} days…`);
      const res = await fetch('/api/health/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(days),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Import failed');

      setStage('done');
      setResult({
        days: days.length,
        written: data.written,
        firstDate: days[0]?.date,
        lastDate: days[days.length - 1]?.date,
      });
    } catch (e) {
      console.error('[HealthImport] error', e);
      setError(e instanceof Error ? e.message : 'Import failed');
      setStage('error');
    }
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const busy = stage === 'unzipping' || stage === 'parsing' || stage === 'uploading';

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-2">
        <FileArchive className="w-5 h-5 text-accent-blue" />
        <h3 className="font-semibold text-text-primary">Import Apple Health (one-off)</h3>
      </div>
      <p className="text-sm text-text-secondary mb-3 leading-relaxed">
        Free way to backfill your full history. On iPhone: open <b>Health</b> → tap your profile
        photo (top right) → <b>Export All Health Data</b>. Wait 5-15 minutes, then AirDrop or
        iCloud Drive the resulting <b>export.zip</b> to this Mac and drag it below.
      </p>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          busy ? 'border-amber-300 bg-amber-50/50' : 'border-border-light hover:border-accent-blue hover:bg-secondary-bg'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={onPick}
          disabled={busy}
        />
        {!busy && stage !== 'done' && (
          <>
            <Upload className="w-6 h-6 text-text-secondary mx-auto mb-2" />
            <div className="text-sm font-medium text-text-primary">Drop export.zip here</div>
            <div className="text-xs text-text-secondary mt-0.5">or tap to choose</div>
          </>
        )}
        {busy && (
          <div className="flex flex-col items-center gap-2 text-sm text-text-primary">
            <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
            <div>{progress}</div>
            <div className="text-xs text-text-secondary capitalize">{stage}…</div>
          </div>
        )}
        {stage === 'done' && result && (
          <div className="flex flex-col items-center gap-1 text-sm">
            <Check className="w-6 h-6 text-green-600" />
            <div className="font-medium text-green-700">
              Imported {result.written} days
            </div>
            {result.firstDate && result.lastDate && (
              <div className="text-xs text-text-secondary">
                {result.firstDate} → {result.lastDate}
              </div>
            )}
            <button
              onClick={() => setStage('idle')}
              className="text-xs text-accent-blue underline mt-1"
            >
              Import another file
            </button>
          </div>
        )}
        {stage === 'error' && error && (
          <div className="text-sm text-accent-red">
            {error}
            <button
              onClick={() => setStage('idle')}
              className="block text-xs text-accent-blue underline mt-2"
            >
              Try again
            </button>
          </div>
        )}
      </label>

      <p className="text-xs text-text-secondary mt-2 italic">
        100% local — the file is parsed in your browser; only the small daily summary is sent to the server.
      </p>
    </div>
  );
}
