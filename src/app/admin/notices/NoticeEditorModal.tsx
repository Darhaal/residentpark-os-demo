// Title: Notice Editor Modal
// Path: src/app/admin/notices/NoticeEditorModal.tsx
// Functionality: Modal workflow for notice operations, validation, and feedback.

// Dedicated large modal for composing a notice with the rich-text editor.
// Edits a local draft and commits it back to the compose form on save.

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { en } from '@/localization/en';

const messages = en.adminNotices;

interface NoticeEditorModalProps {
  value: string;
  placeholder?: string;
  onClose: () => void;
  onSave: (html: string) => void;
}

export function NoticeEditorModal({ value, placeholder, onClose, onSave }: NoticeEditorModalProps) {
  const [draft, setDraft] = useState(value);

  return (
    <Modal onClose={onClose} label={messages.editorTitle} overlayClassName="z-[160]" className="max-w-3xl">
      <div className="flex h-[88vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 className="truncate text-xl font-semibold text-foreground">{messages.editorTitle}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={messages.editorCancel}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 overflow-hidden bg-muted/10 p-5">
          <RichTextEditor value={draft} onChange={setDraft} placeholder={placeholder} />
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 sm:min-w-28">{messages.editorCancel}</Button>
          <Button type="button" onClick={() => onSave(draft)} className="h-10 sm:min-w-28">{messages.editorSave}</Button>
        </footer>
      </div>
    </Modal>
  );
}
