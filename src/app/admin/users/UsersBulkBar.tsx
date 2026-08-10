// Title: Users Bulk Bar
// Path: src/app/admin/users/UsersBulkBar.tsx
// Functionality: Route-level component for identity and role workflows and UI composition.

// Floating bulk-action bar shown when one or more users are selected.

'use client';

import { Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { en } from '@/localization/en';

interface UsersBulkBarProps {
  count: number;
  onApprove: () => void;
  onSuspend: () => void;
  onRoleChange: () => void;
  onClear: () => void;
}

const messages = en.adminUsers;

export function UsersBulkBar({ count, onApprove, onSuspend, onRoleChange, onClear }: UsersBulkBarProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-950 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-10 border border-zinc-800">
      <div className="flex items-center gap-3 font-bold">
        <Layers className="h-5 w-5 text-zinc-400" /><span>{count} {messages.selected}</span>
      </div>
      <div className="w-px h-6 bg-zinc-800" />
      <div className="flex gap-2">
        <Button size="sm" onClick={onApprove} className="bg-success hover:bg-success/90 text-success-foreground font-bold h-9">{messages.approve}</Button>
        <Button size="sm" onClick={onSuspend} className="bg-destructive hover:bg-destructive/90 text-white font-bold h-9">{messages.suspend}</Button>
        <Button size="sm" onClick={onRoleChange} className="bg-info hover:bg-info/90 text-info-foreground font-bold h-9">{messages.roleChange}</Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="text-zinc-500 hover:text-white h-9 w-9 p-0"><X className="h-5 w-5" /></Button>
      </div>
    </div>
  );
}
