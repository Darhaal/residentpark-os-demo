// Title: Help Button
// Path: src/components/HelpButton.tsx
// Functionality: Navbar (?) button. Opens a role-aware popover with a short, numbered
//   "what to do" guide for admins vs residents. Copy lives in src/localization/en/help.ts.

'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { en } from '@/localization/en';

interface HelpButtonProps {
  isAdmin?: boolean;
}

export function HelpButton({ isAdmin = false }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = en.help;

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const heading = isAdmin ? t.adminHeading : t.residentHeading;
  const steps = isAdmin ? t.adminSteps : t.residentSteps;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={t.buttonAria}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
          open ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.title}
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(21rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.title}</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-950">{heading}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.closeAria}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ol className="max-h-[60vh] space-y-2.5 overflow-y-auto px-4 py-3.5">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-sm leading-snug text-zinc-600">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="border-t border-zinc-100 px-4 py-2.5">
            <p className="text-[11px] text-zinc-400">{t.footer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
