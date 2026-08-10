// Title: Shared Vehicle Form Component
// Path: src/components/shared/VehicleForm.tsx
// Functionality: Unified form for vehicle registration used across the admin panel.
//   Handles nullish ownerIds without UI selection bleeding.

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ApartmentCombobox, ApartmentObj as BaseAptObj } from '@/components/ui/apartment-combobox';
import { en as locale } from '@/localization/en';

export interface ExtendedApartmentObj extends BaseAptObj {
  profiles?: { id: string; full_name: string | null; }[];
}

export interface VehicleFormData {
  apartmentId: string;
  ownerId: string | null;
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
}

interface VehicleFormProps {
  apartments: ExtendedApartmentObj[];
  onSubmit: (data: VehicleFormData) => void;
  onCancel: () => void;
  isProcessing: boolean;
  initialData?: Partial<VehicleFormData>;
}

const messages = locale.vehicleForm;

export function VehicleForm({ apartments, onSubmit, onCancel, isProcessing, initialData }: VehicleFormProps) {
  const [formData, setFormData] = useState<{
    apartmentId: string;
    ownerId: string; // Internal state uses string for native <select> compatibility
    plateNumber: string;
    make: string;
    model: string;
    color: string;
    // Kept as a string while editing so the field can be cleared/retyped freely;
    // parsed once on submit (parsing per keystroke snapped it back to the current year).
    year: string;
  }>({
    apartmentId: initialData?.apartmentId || '',
    ownerId: initialData?.ownerId ?? '', // Strictly preserve nulls as empty string
    plateNumber: initialData?.plateNumber || '',
    make: initialData?.make || '',
    model: initialData?.model || '',
    color: initialData?.color || '',
    year: String(initialData?.year || new Date().getFullYear()),
  });

  const selectedAptDetails = useMemo(() =>
    apartments.find(a => a.id === formData.apartmentId),
  [apartments, formData.apartmentId]);

  const aptProfiles = selectedAptDetails?.profiles || [];

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      // Map empty string safely back to null for database strictness
      ownerId: formData.ownerId === '' ? null : formData.ownerId,
      year: parseInt(formData.year, 10) || new Date().getFullYear(),
    });
  };

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{messages.apartmentLabel}</Label>
        <ApartmentCombobox
          apartments={apartments}
          value={formData.apartmentId}
          onChange={(val) => setFormData(prev => ({...prev, apartmentId: val, ownerId: ''}))}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">{messages.ownerLabel}</Label>
        <select
          value={formData.ownerId}
          onChange={e => setFormData(prev => ({...prev, ownerId: e.target.value}))}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground"
          disabled={!formData.apartmentId}
        >
          <option value="">{messages.noOwnerOption}</option>
          {aptProfiles.map((p: { id: string; full_name: string | null }) => (
            <option key={p.id} value={p.id}>{p.full_name || messages.unnamedResident}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">{messages.plateLabel}</Label>
          <Input name="vehicle-plate" autoComplete="off" value={formData.plateNumber} onChange={e=>setFormData({...formData, plateNumber: e.target.value})} placeholder={messages.platePlaceholder} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">{messages.makeLabel}</Label>
          <Input name="vehicle-make" autoComplete="off" value={formData.make} onChange={e=>setFormData({...formData, make: e.target.value})} placeholder={messages.makePlaceholder} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
         <div className="space-y-2">
           <Label className="text-xs font-medium text-muted-foreground">{messages.modelLabel}</Label>
           <Input name="vehicle-model" autoComplete="off" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} placeholder={messages.modelPlaceholder} />
         </div>
         <div className="space-y-2">
           <Label className="text-xs font-medium text-muted-foreground">{messages.colorLabel}</Label>
           <Input name="vehicle-color" autoComplete="off" value={formData.color} onChange={e=>setFormData({...formData, color: e.target.value})} placeholder={messages.colorPlaceholder} />
         </div>
         <div className="space-y-2">
           <Label className="text-xs font-medium text-muted-foreground">{messages.yearLabel}</Label>
           <Input name="vehicle-year" type="number" autoComplete="off" value={formData.year} onChange={e=>setFormData({...formData, year: e.target.value})} placeholder={messages.yearPlaceholder} />
         </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="h-10 sm:min-w-28" disabled={isProcessing}>{messages.cancel}</Button>
        <Button type="button" onClick={handleSubmit} disabled={isProcessing || !formData.apartmentId || !formData.plateNumber || !formData.make} className="h-10 sm:min-w-32">
          {isProcessing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : messages.submit}
        </Button>
      </div>
    </div>
  );
}
