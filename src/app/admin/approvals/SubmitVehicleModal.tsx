// Title: Submit Vehicle Request Modal
// Path: src/app/admin/approvals/SubmitVehicleModal.tsx
// Functionality: Hosts the shared vehicle form for a new approval-queue request.

import { Modal } from '@/components/ui/modal';
import { VehicleForm, type ExtendedApartmentObj, type VehicleFormData } from '@/components/shared/VehicleForm';
import { en } from '@/localization/en';

const messages = en.adminApprovals;

interface SubmitVehicleModalProps {
  apartments: ExtendedApartmentObj[];
  isProcessing: boolean;
  onSubmit: (data: VehicleFormData) => void;
  onCancel: () => void;
}

export function SubmitVehicleModal({ apartments, isProcessing, onSubmit, onCancel }: SubmitVehicleModalProps) {
  const close = () => {
    if (!isProcessing) onCancel();
  };

  return (
    <Modal onClose={close} label={messages.addVehicleRequestTitle} overlayClassName="z-[80]" className="max-w-md">
      <div className="flex w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">{messages.addVehicleRequestTitle}</h2>
        </header>
        <div className="p-5">
          <VehicleForm apartments={apartments} isProcessing={isProcessing} onSubmit={onSubmit} onCancel={close} />
        </div>
      </div>
    </Modal>
  );
}
