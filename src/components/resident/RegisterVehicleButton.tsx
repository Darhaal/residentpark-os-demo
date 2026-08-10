// Title: Resident Vehicle Registration
// Path: src/components/resident/RegisterVehicleButton.tsx
// Functionality: Opens a resident-safe vehicle request modal from the dashboard.

'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, CheckCircle2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { useFeedback } from '@/hooks/use-feedback';
import { submitResidentVehicleAction } from '@/actions/resident';
import { en } from '@/localization/en';

interface RegisterVehicleButtonProps {
  hasApartment: boolean;
}

type VehicleFieldErrors = Partial<Record<'plateNumber' | 'make', string>>;

const currentYear = new Date().getFullYear();

export function RegisterVehicleButton({ hasApartment }: RegisterVehicleButtonProps) {
  const router = useRouter();
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>({});
  const t = en.vehicleForm;

  const resetForm = () => {
    setPlateNumber('');
    setMake('');
    setModel('');
    setColor('');
    setYear(String(currentYear));
    setFieldErrors({});
  };

  const openModal = () => {
    clearFeedback();
    if (!hasApartment) {
      showError(t.requiresUnit);
      return;
    }
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPlate = plateNumber.trim();
    const cleanMake = make.trim();
    const parsedYear = Number(year) || currentYear;
    const nextFieldErrors: VehicleFieldErrors = {};

    if (cleanPlate.length < 2) nextFieldErrors.plateNumber = t.plateRequired;
    if (!cleanMake) nextFieldErrors.make = t.makeRequired;

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      showError(t.requiredFields);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    clearFeedback();

    try {
      const res = await submitResidentVehicleAction({
        plateNumber: cleanPlate,
        make: cleanMake,
        model: model.trim(),
        color: color.trim(),
        year: parsedYear,
      });

      if (!res.success) {
        showError(res.error || t.submitError);
        return;
      }

      showToast(t.submitSuccess);
      resetForm();
      setIsOpen(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <Button
        variant="outline"
        size="sm"
        onClick={openModal}
        className="h-9 rounded-lg font-semibold border-zinc-200 shadow-sm hover:bg-zinc-100 hover:text-zinc-900 transition-all"
      >
        <Plus className="h-4 w-4 mr-1.5" /> {t.registerButton}
      </Button>

      {isOpen && (
        <Modal onClose={closeModal} label={t.registerModalTitle} overlayClassName="z-[140]" className="max-w-md">
          <Card className="w-full shadow-2xl border-zinc-200 animate-in fade-in zoom-in-95">
            <CardHeader className="border-b border-zinc-100 pb-4 flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-950 flex items-center gap-2">
                  <Car className="h-5 w-5 text-zinc-900" /> {t.registerModalTitle}
                </CardTitle>
                <CardDescription className="mt-1">{t.registerModalDescription}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeModal} disabled={isSubmitting} className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="resident-vehicle-plate" className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{t.plateLabel}</Label>
                    <Input
                      id="resident-vehicle-plate"
                      name="vehicle-plate"
                      autoComplete="off"
                      value={plateNumber}
                      onChange={event => {
                        setPlateNumber(event.target.value.toUpperCase());
                        if (fieldErrors.plateNumber) setFieldErrors(prev => ({ ...prev, plateNumber: undefined }));
                      }}
                      placeholder={t.platePlaceholder}
                      aria-invalid={Boolean(fieldErrors.plateNumber)}
                      aria-describedby={fieldErrors.plateNumber ? 'resident-vehicle-plate-error' : undefined}
                      autoFocus
                    />
                    {fieldErrors.plateNumber ? (
                      <p id="resident-vehicle-plate-error" role="alert" className="text-xs font-medium text-destructive">
                        {fieldErrors.plateNumber}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resident-vehicle-make" className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{t.makeLabel}</Label>
                    <Input
                      id="resident-vehicle-make"
                      name="vehicle-make"
                      autoComplete="off"
                      value={make}
                      onChange={event => {
                        setMake(event.target.value);
                        if (fieldErrors.make) setFieldErrors(prev => ({ ...prev, make: undefined }));
                      }}
                      placeholder={t.makePlaceholder}
                      aria-invalid={Boolean(fieldErrors.make)}
                      aria-describedby={fieldErrors.make ? 'resident-vehicle-make-error' : undefined}
                    />
                    {fieldErrors.make ? (
                      <p id="resident-vehicle-make-error" role="alert" className="text-xs font-medium text-destructive">
                        {fieldErrors.make}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="resident-vehicle-model" className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{t.modelLabel}</Label>
                    <Input id="resident-vehicle-model" name="vehicle-model" autoComplete="off" value={model} onChange={event => setModel(event.target.value)} placeholder={t.modelPlaceholder} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resident-vehicle-color" className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{t.colorLabel}</Label>
                    <Input id="resident-vehicle-color" name="vehicle-color" autoComplete="off" value={color} onChange={event => setColor(event.target.value)} placeholder={t.colorPlaceholder} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resident-vehicle-year" className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{t.yearLabel}</Label>
                    <Input id="resident-vehicle-year" name="vehicle-year" type="number" min={1980} max={currentYear + 1} autoComplete="off" value={year} onChange={event => setYear(event.target.value)} />
                  </div>
                </div>

                <div className="rounded-xl border border-info/20 bg-info/10 p-3 text-xs text-zinc-600">
                  {t.pendingNotice}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting} className="font-semibold">{t.cancel}</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-zinc-950 text-white font-semibold">
                    {isSubmitting ? <Spinner className="size-4 text-current" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> {t.submitRequest}</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Modal>
      )}
    </>
  );
}
