// Title: Feedback Toasts
// Path: src/components/shared/FeedbackToasts.tsx
// Functionality: One consistent toast overlay for success/error feedback. Previously this
// ~15-line block was copy-pasted into every admin screen with slightly different colors.
// Now it lives once, uses semantic tokens, and is screen-reader friendly (aria-live).

'use client';

import { CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeedbackToastsProps {
  successMsg?: string | null;
  errorMsg?: string | null;
  onClear?: () => void;
}

export function FeedbackToasts({ successMsg, errorMsg, onClear }: FeedbackToastsProps) {
  if (!successMsg && !errorMsg) return null;

  return (
    <div
      className="fixed top-20 left-1/2 z-[300] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 pointer-events-none"
      aria-live="polite"
    >
      {successMsg && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-2xl animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-5 w-5 text-success" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive shadow-2xl animate-in fade-in slide-in-from-top-4"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>Error</strong>
            <p className="text-xs opacity-90">{errorMsg}</p>
          </div>
          {onClear && (
            <Button variant="ghost" size="icon" onClick={onClear} className="-mr-2 ml-auto h-6 w-6" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
