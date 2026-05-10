// Thin Strava API client. Free, public API, OAuth 2.0.
//
// Required env vars:
//   STRAVA_CLIENT_ID
//   STRAVA_CLIENT_SECRET
//   STRAVA_VERIFY_TOKEN     (any random string; Strava webhook handshake echoes it)
//   NEXT_PUBLIC_APP_URL     (used as redirect_uri base — must match the Authorization
//                            Callback Domain configured in Strava's API settings)
//
// Strava console: https://www.strava.com/settings/api

const API_BASE = 'https://www.strava.com/api/v3';
const OAUTH_BASE = 'https://www.strava.com/oauth';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

// `read,activity:read` is enough to pull the athlete's activities and totals.
// We don't need write access — we don't post to Strava.
export const SCOPE = 'read,activity:read';

export function authorizationUrl(redirectUri: string, state: string): string {
  const u = new URL(`${OAUTH_BASE}/authorize`);
  u.searchParams.set('client_id', requireEnv('STRAVA_CLIENT_ID'));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('approval_prompt', 'auto');
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('state', state);
  return u.toString();
}

export interface TokenResponse {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_at: number;        // unix seconds
  expires_in: number;        // seconds remaining
  athlete?: { id: number; firstname?: string; lastname?: string };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireEnv('STRAVA_CLIENT_ID'),
      client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${t}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireEnv('STRAVA_CLIENT_ID'),
      client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${t}`);
  }
  return res.json();
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;                  // legacy; e.g. "Run"
  sport_type?: string;           // newer; e.g. "Run", "TrailRun"
  start_date: string;            // ISO 8601 UTC
  start_date_local?: string;     // ISO 8601 in athlete's local TZ
  moving_time: number;           // seconds
  distance: number;              // meters
  calories?: number;             // sometimes absent on summary endpoint — use kilojoules fallback
  kilojoules?: number;           // for cycling power-meter rides; energy in kJ
  total_elevation_gain?: number;
}

// Pull a page of recent activities. `after` is unix seconds (only activities
// after this time are returned). Strava paginates with per_page (max 200).
export async function listActivities(
  accessToken: string,
  opts: { after?: number; perPage?: number; page?: number } = {},
): Promise<StravaActivity[]> {
  const u = new URL(`${API_BASE}/athlete/activities`);
  if (opts.after) u.searchParams.set('after', String(opts.after));
  u.searchParams.set('per_page', String(opts.perPage ?? 100));
  u.searchParams.set('page', String(opts.page ?? 1));
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Strava listActivities failed: ${res.status} ${t}`);
  }
  return res.json();
}

// Detailed activity (calories often only present here, not in summary). Used
// when the summary list omits the kcal field.
export async function getActivityDetail(accessToken: string, id: number): Promise<StravaActivity & { calories?: number }> {
  const res = await fetch(`${API_BASE}/activities/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Strava getActivity ${id} failed: ${res.status} ${t}`);
  }
  return res.json();
}

// Best-effort calorie extraction. Strava's summary list often returns 0 or
// missing for `calories`; the detail endpoint is more reliable. As a final
// fallback, kilojoules ≈ kcal for cycling/running thanks to ~25% efficiency
// (1 kJ of mechanical ≈ 1 kcal of metabolic burn for typical aerobic exercise).
export function bestKcal(activity: StravaActivity): number | null {
  if (activity.calories && activity.calories > 0) return Math.round(activity.calories);
  if (activity.kilojoules && activity.kilojoules > 0) return Math.round(activity.kilojoules);
  return null;
}

// --- Webhook subscription management -----------------------------------------

export interface WebhookSubscription {
  id: number;
  application_id: number;
  callback_url: string;
  created_at: string;
  updated_at: string;
}

// Strava only allows ONE active subscription per app. Idempotent: if one exists,
// returns it; if the URL differs, we'd need to delete + recreate (caller's job).
export async function ensureWebhookSubscription(callbackUrl: string): Promise<WebhookSubscription> {
  const list = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${requireEnv('STRAVA_CLIENT_ID')}&client_secret=${requireEnv('STRAVA_CLIENT_SECRET')}`,
  );
  if (list.ok) {
    const subs: WebhookSubscription[] = await list.json();
    if (subs.length > 0) return subs[0];
  }

  const body = new URLSearchParams({
    client_id: requireEnv('STRAVA_CLIENT_ID'),
    client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
    callback_url: callbackUrl,
    verify_token: requireEnv('STRAVA_VERIFY_TOKEN'),
  });
  const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Strava subscribe failed: ${res.status} ${t}`);
  }
  return res.json();
}
