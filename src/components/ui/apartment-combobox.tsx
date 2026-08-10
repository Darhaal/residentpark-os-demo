// Title: Shared Apartment Combobox
// Path: src/components/ui/apartment-combobox.tsx
// Functionality: Standardized UI component for selecting apartments.
//   Uses onPointerDown + stopPropagation to avoid selection race conditions.

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';

export interface ApartmentObj {
  id: string;
  apartment_number: string;
}

interface ApartmentComboboxProps {
  apartments: ApartmentObj[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ApartmentCombobox({ apartments, value, onChange, disabled }: ApartmentComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const messages = en.common.apartmentCombobox;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = apartments.find(a => a.id === value);
  const filtered = apartments.filter(a => a.apartment_number.toLowerCase().includes(search.toLowerCase())).slice(0, 50);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm font-medium shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          disabled ? 'cursor-not-allowed bg-muted/50 text-muted-foreground opacity-60' : 'cursor-pointer hover:bg-muted/30'
        )}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? `${messages.unitPrefix} ${selected.apartment_number}` : messages.selectUnit}
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1.5 flex w-full animate-in flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-sm fade-in zoom-in-95 duration-100">
          <div className="relative border-b border-border bg-muted/20 p-2">
            <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              autoFocus
              placeholder={messages.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1.5 custom-scrollbar">
            {filtered.length > 0 ? filtered.map(a => (
              <button
                type="button"
                key={a.id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Prevent race conditions with blur/click outside
                  onChange(a.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  value === a.id && 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/20'
                )}
              >
                <div className="font-semibold">{messages.unitPrefix} {a.apartment_number}</div>
              </button>
            )) : (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">{messages.noResults}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
