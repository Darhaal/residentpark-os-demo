// Title: SSR QA Harness
// Path: scripts/ssr-qa.mjs
// Functionality: Golden-path smoke assertions against a running dev/preview server.
//
// Signs in via the GoTrue REST password grant, crafts the @supabase/ssr auth cookie,
// fetches server-rendered pages over plain HTTP, and asserts golden-path structure:
// auth pages (h1, password reveal), resident dashboard/parking (fixed TopNav, release
// grid fallback on D1/D2, zero foreign-plate privacy leaks, notices),
// authorization boundaries (resident vs admin vs superadmin), the always-open admin
// side panel, and Global Search deep-link seeding.
//
// Prerequisites: `npm run seed:testers` and `npm run seed:demo-building` (it asserts
// against the D-building fixtures), plus a running app server.
// Usage: QA_BASE_URL=http://localhost:3000 node scripts/ssr-qa.mjs
// Read-only against the app: it performs GETs only; sign-ins are normal auth events.
import { existsSync, readFileSync } from 'node:fs';

const BASE = process.env.QA_BASE_URL || 'http://localhost:63884';

function envVal(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync('.env.local')) return '';
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1 || t.slice(0, eq).trim() !== key) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return '';
}

const SUPABASE_URL = envVal('NEXT_PUBLIC_SUPABASE_URL');
const ANON = envVal('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const COOKIE_KEY = `sb-${REF}-auth-token`;

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sessionCookie(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();
  const encoded = 'base64-' + b64url(JSON.stringify(session));
  if (encoded.length <= 3180) return `${COOKIE_KEY}=${encoded}`;
  const parts = [];
  for (let i = 0; i * 3180 < encoded.length; i++) parts.push(`${COOKIE_KEY}.${i}=${encoded.slice(i * 3180, (i + 1) * 3180)}`);
  return parts.join('; ');
}

async function page(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), html: res.status === 200 ? await res.text() : '' };
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const count = (html, needle) => html.split(needle).length - 1;

// ── Public pages ────────────────────────────────────────────────────────────────
{
  const login = await page('/login');
  check('login 200', login.status === 200);
  check('login has semantic h1 (F5)', /<h1>[^<]*Welcome Back[^<]*<\/h1>/.test(login.html));
  check('login has password reveal toggle', login.html.includes('aria-label="Show password"'));
  const reg = await page('/register');
  check('register has semantic h1 (F5)', /<h1>/.test(reg.html));
}

// ── Resident (demo.alice) ───────────────────────────────────────────────────────
{
  const c = await sessionCookie('demo.alice@qa.local', (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!'));
  const dash = await page('/', c);
  check('resident dashboard 200', dash.status === 200, `status=${dash.status}${dash.location ? ' -> ' + dash.location : ''}`);
  check('dashboard shows unit D-101', dash.html.includes('D-101'));
  check('dashboard shows own spot D1-01', dash.html.includes('D1-01'));
  check('TopNav is fixed (never scrolls away)', dash.html.includes('fixed inset-x-0 top-0'));

  const park = await page('/parking', c);
  check('resident /parking 200', park.status === 200);
  check('D1 renders the grid while the spatial flag is off', !park.html.includes('data-parking-layout="spatial"') && park.html.includes('D1-06'));
  check('layout shapes stay hidden while the spatial flag is off', count(park.html, 'data-layout-shape=') === 0, `found=${count(park.html, 'data-layout-shape=')}`);
  check('D2 stays on the grid fallback (no spatial attr for D2)', !park.html.includes('data-parking-floor="D2"'));
  check('own plate DMO-101 visible to Alice', park.html.includes('DMO-101'));
  const leaks = ['DMO-102', 'DMO-103', 'DMO-104', 'DMO-105', 'DMO-106'].filter((p) => park.html.includes(p));
  check('PRIVACY: zero foreign plates in resident HTML', leaks.length === 0, leaks.length ? `LEAKED: ${leaks.join(',')}` : '');
  check('D2 spots present in grid (D2-08)', park.html.includes('D2-08'));

  const notices = await page('/notices', c);
  check('resident sees seeded unread notice', notices.html.includes('Garage deep-clean this Friday'));

  const admin = await page('/admin/reports', c);
  check('resident blocked from /admin (redirect)', admin.status >= 300 && admin.status < 400, `status=${admin.status} -> ${admin.location}`);
}

// ── Admin (tester.admin) ────────────────────────────────────────────────────────
{
  const c = await sessionCookie('tester.admin@qa.local', (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!'));
  const reports = await page('/admin/reports', c);
  check('admin reports 200', reports.status === 200, `status=${reports.status}${reports.location ? ' -> ' + reports.location : ''}`);
  check('admin side panel present and permanently open (w-64)', reports.html.includes('id="admin-side-panel"') && reports.html.includes('w-64'));
  check('no collapse toggle on the side panel', !reports.html.includes('aria-controls="admin-side-panel-navigation"'));

  const veh = await page('/admin/vehicles?q=DMO-106', c);
  check('search deep link seeds Vehicles (?q=DMO-106)', veh.html.includes('value="DMO-106"'));
  check('deep-linked vehicle row visible (Kia EV6)', veh.html.includes('DMO-106') && veh.html.includes('EV6'));

  const apt = await page('/admin/apartments?q=D-104', c);
  check('search deep link seeds Apartments (?q=D-104)', apt.html.includes('value="D-104"'));

  const parkAdmin = await page('/admin/parking?q=D2-01', c);
  check('search deep link seeds Parking (?q=D2-01)', parkAdmin.html.includes('value="D2-01"'));
  check('parking deep link renders the D2 spot (all floors selected)', parkAdmin.html.includes('D2-01'));

  const users = await page('/admin/users?search=Frank', c);
  check('users ?search=Frank pre-filters server-side', users.html.includes('Frank Demo') && users.html.includes('value="Frank"'));

  const adminParkD1 = await page('/admin/parking', c);
  check('admin parking loads (D1 default floor present)', adminParkD1.status === 200 && adminParkD1.html.includes('D1-01'));
  check('admin grid/lanes toggle remains available while spatial is off', adminParkD1.html.includes('>Grid<'));

  const logs = await page('/admin/logs', c);
  check('regular admin blocked from audit logs', (logs.status >= 300 && logs.status < 400) || !logs.html.includes('AUDIT_LOG'), `status=${logs.status} -> ${logs.location ?? '(200 shell)'}`);
}

// ── Superadmin (tester.super) ──────────────────────────────────────────────────
{
  const c = await sessionCookie('tester.super@qa.local', (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!'));
  const logs = await page('/admin/logs', c);
  check('superadmin reaches audit logs', logs.status === 200, `status=${logs.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
