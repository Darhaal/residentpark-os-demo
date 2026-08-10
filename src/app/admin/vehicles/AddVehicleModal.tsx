// Title: Add Vehicle Modal
// Path: src/app/admin/vehicles/AddVehicleModal.tsx
// Functionality: Modal workflow for vehicle operations, validation, and feedback.

// Admin register-vehicle modal wraps the shared VehicleForm.

'use client';

import { Car } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { VehicleForm, type ExtendedApartmentObj, type VehicleFormData } from '@/components/shared/VehicleForm';
import { en } from '@/localization/en';

const messages = en.adminVehicles;

interface AddVehicleModalProps {
  apartments: ExtendedApartmentObj[];
  isProcessing: boolean;
  onSubmit: (data: VehicleFormData) => void;
  onCancel: () => void;
}

export function AddVehicleModal({ apartments, isProcessing, onSubmit, onCancel }: AddVehicleModalProps) {
  return (
    <Modal onClose={onCancel} label={messages.registerVehicle} overlayClassName="z-[80]" className="max-w-md">
      <div className="flex w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-3 text-xl font-semibold text-foreground">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/30">
              <Car className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            {messages.registerVehicle}
          </h2>
        </header>
        <div className="p-5">
          <VehicleForm
            apartments={apartments}
            isProcessing={isProcessing}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
      </div>
    </Modal>
  );
}
