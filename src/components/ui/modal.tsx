// Title: Modal Primitive
// Path: src/components/ui/modal.tsx
// Functionality: Accessible overlay shell for dialogs and side drawers. Renders the
//   full-screen backdrop plus a role="dialog" aria-modal container, and wires up the
//   shared useModalA11y hook (Escape to close, focus trap, body scroll-lock, initial
//   focus and focus restore). Callers render their own panel content (card, form,
//   drawer body) as children and keep ownership of open/close state by conditionally
//   mounting this component.

'use client';

import type { ReactNode } from 'react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';

interface ModalProps {
  /** Called on Escape, backdrop click, and is also used to restore focus on unmount. */
  onClose: () => void;
  /** Accessible name for the dialog, exposed via aria-label. */
  label: string;
  children: ReactNode;
  /** Classes for the full-screen overlay: z-index, flex alignment, padding. */
  overlayClassName?: string;
  /** Classes for the dialog panel wrapper: sizing, animation. */
  className?: string;
  /** Classes for the backdrop layer (colour / blur). */
  backdropClassName?: string;
  /** Close when the backdrop is clicked. Defaults to true. */
  dismissOnBackdrop?: boolean;
}

export function Modal({
  onClose,
  label,
  children,
  overlayClassName,
  className,
  backdropClassName,
  dismissOnBackdrop = true,
}: ModalProps) {
  // The component is mounted only while open, so the hook is always active here.
  const ref = useModalA11y<HTMLDivElement>(true, onClose);

  return (
    <div className={cn('fixed inset-0 z-[120] flex items-center justify-center p-4', overlayClassName)}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={en.common.closeDialog}
        onClick={dismissOnBackdrop ? onClose : undefined}
        className={cn('absolute inset-0 bg-zinc-950/60 backdrop-blur-sm', backdropClassName)}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn('relative z-10 w-full outline-none', className)}
      >
        {children}
      </div>
    </div>
  );
}
