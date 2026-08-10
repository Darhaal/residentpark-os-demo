// Title: Global Search (Command Palette)
// Path: src/components/GlobalSearch.tsx
// Functionality: App-wide Cmd/Ctrl+K search across vehicles, residents, apartments, spots.
// Read-only, admin-only (mounted from TopNav for admins). Results link to the relevant screen.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Car, User, Building, MapPin, CornerDownLeft, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { globalSearchAction, type SearchResults } from '@/actions/search';
import { en } from '@/localization/en';
import { ROUTES } from '@/config/routes';
import { UI_TIMING } from '@/config/limits';
import { approvalStatusBadgeVariant } from '@/config/status-ui';

const EMPTY: SearchResults = { vehicles: [], residents: [], apartments: [], spots: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults(EMPTY);
    setLoading(false);
    setError(null);
  }, []);

  const openSearch = useCallback(() => setOpen(true), []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < UI_TIMING.minimumSearchChars) {
      setResults(EMPTY);
      setLoading(false);
      setError(null);
    }
  };

  // Global Cmd/Ctrl+K to toggle. (Esc, focus trap and scroll-lock come from Modal.)
  // Match on e.code ('KeyK' = the physical K key) so the shortcut works on non-Latin
  // keyboard layouts (e.g. Russian), where e.key for that key is a Cyrillic letter, not 'k'.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        if (open) closeSearch();
        else openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSearch, open, openSearch]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), UI_TIMING.searchFocusDelayMs);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < UI_TIMING.minimumSearchChars) return;

    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await globalSearchAction(q);
        if (res.success && 'results' in res) {
          setResults(res.results);
        } else {
          setResults(EMPTY);
          setError(res.error || en.globalSearch.errorFallback);
        }
      } catch {
        setResults(EMPTY);
        setError(en.globalSearch.errorFallback);
      } finally {
        setLoading(false);
      }
    }, UI_TIMING.globalSearchDebounceMs);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback((href: string) => { closeSearch(); router.push(href); }, [closeSearch, router]);

  const total = results.vehicles.length + results.residents.length + results.apartments.length + results.spots.length;

  return (
    <>
      <button
        onClick={openSearch}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors text-sm"
        aria-label={en.globalSearch.openAria}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">{en.globalSearch.buttonLabel}</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 ml-2 text-[10px] font-mono font-bold text-zinc-400 bg-white border border-zinc-200 rounded px-1.5 py-0.5">{en.globalSearch.shortcut}</kbd>
      </button>

      {open && (
        <Modal onClose={closeSearch} label={en.globalSearch.dialogAria} overlayClassName="z-[200] items-start pt-[10vh]" backdropClassName="bg-zinc-950/40" className="max-w-xl">
          <div className="w-full bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-4 border-b border-zinc-100">
              <Search className="h-5 w-5 text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder={en.globalSearch.placeholder}
                className="flex-1 h-14 bg-transparent outline-none text-base text-zinc-900 placeholder:text-zinc-400"
                aria-label={en.globalSearch.queryAria}
              />
              {loading && <Spinner className="size-4" />}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {error ? (
                <div role="alert" className="m-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : query.trim().length < UI_TIMING.minimumSearchChars ? (
                <p className="px-3 py-8 text-center text-sm text-zinc-400">{en.globalSearch.minimumQuery}</p>
              ) : !loading && total === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">{en.globalSearch.noResults(query.trim())}</p>
              ) : (
                <div className="space-y-3">
                  <Group label={en.globalSearch.groups.vehicles} icon={Car} show={results.vehicles.length > 0}>
                    {results.vehicles.map(v => (
                      <Row key={v.id} onClick={() => go(`${ROUTES.admin.vehicles}?q=${encodeURIComponent(v.plate_number)}`)}>
                        <span className="font-mono font-bold text-zinc-900">{v.plate_number}</span>
                        <span className="text-zinc-500 truncate">{v.make} {v.model} - {v.owner || en.globalSearch.emptyValue} - {en.globalSearch.unitPrefix} {v.unit || en.globalSearch.emptyValue}</span>
                        <Badge variant={approvalStatusBadgeVariant(v.approval_status)} className="ml-auto shrink-0 text-[10px] uppercase">{v.approval_status.replace('_', ' ')}</Badge>
                      </Row>
                    ))}
                  </Group>
                  <Group label={en.globalSearch.groups.residents} icon={User} show={results.residents.length > 0}>
                    {results.residents.map(r => (
                      <Row key={r.id} onClick={() => go(`${ROUTES.admin.users}?search=${encodeURIComponent(r.full_name || r.email || '')}`)}>
                        <span className="font-semibold text-zinc-900 truncate">{r.full_name || en.globalSearch.noName}</span>
                        <span className="text-zinc-500 truncate">{r.email} - {en.globalSearch.unitPrefix} {r.unit || en.globalSearch.emptyValue}</span>
                        <Badge variant={approvalStatusBadgeVariant(r.approval_status)} className="ml-auto shrink-0 text-[10px] uppercase">{r.role}</Badge>
                      </Row>
                    ))}
                  </Group>
                  <Group label={en.globalSearch.groups.apartments} icon={Building} show={results.apartments.length > 0}>
                    {results.apartments.map(a => (
                      <Row key={a.id} onClick={() => go(`${ROUTES.admin.apartments}?q=${encodeURIComponent(a.apartment_number)}`)}>
                        <span className="font-semibold text-zinc-900">{en.globalSearch.unitPrefix} {a.apartment_number}</span>
                        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] uppercase">{a.status}</Badge>
                      </Row>
                    ))}
                  </Group>
                  <Group label={en.globalSearch.groups.spots} icon={MapPin} show={results.spots.length > 0}>
                    {results.spots.map(s => (
                      <Row key={s.id} onClick={() => go(`${ROUTES.admin.parking}?q=${encodeURIComponent(s.spot_number)}`)}>
                        <span className="font-mono font-bold text-zinc-900">{s.spot_number}</span>
                        <span className="text-zinc-500 truncate">{s.zone} - {en.globalSearch.floorPrefix} {s.floor}{s.plate ? ` - ${s.plate}` : ''}{s.unit ? ` - ${en.globalSearch.unitPrefix} ${s.unit}` : ''}</span>
                        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] uppercase">{s.status}</Badge>
                      </Row>
                    ))}
                  </Group>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/60 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> {en.globalSearch.openHint}</span>
              <span>{en.globalSearch.closeHint}</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Group({ label, icon: Icon, show, children }: { label: string; icon: React.ComponentType<{ className?: string }>; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"><Icon className="h-3 w-3" /> {label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-zinc-100 transition-colors">
      {children}
    </button>
  );
}
