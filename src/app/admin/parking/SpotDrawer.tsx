// Title: Parking Spot Drawer
// Path: src/app/admin/parking/SpotDrawer.tsx
// Functionality: Side drawer for all operations on a single parking spot —
//   assign, move, revoke, block/unblock, and manual status change. Presentational:
//   all state and mutation handlers are owned by ParkingClient and passed as props.

'use client';

import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Car, Lock, Unlock, Users, Building, Search, X,
  ArrowRightLeft, Trash2, MapPin,
} from 'lucide-react';
import { VehicleTopDownIcon } from '@/components/parking/VehicleTopDownIcon';
import {
  PARKING_MANUAL_STATUS_OPTIONS,
  PARKING_SPOT_STATE_UI,
  PARKING_ZONE_LABELS,
  parkingSpotStateOf,
} from '@/config/parking';
import { PARKING_SPOT_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import type { ParkingSpot, SpotMode, Vehicle } from './types';

interface SpotDrawerProps {
  spot: ParkingSpot;
  isViewingHistory: boolean;
  mode: SpotMode;
  setMode: (mode: SpotMode) => void;
  reason: string;
  setReason: (value: string) => void;
  moveTarget: string;
  setMoveTarget: (value: string) => void;
  statusTarget: string;
  setStatusTarget: (value: string) => void;
  vehSearch: string;
  setVehSearch: (value: string) => void;
  isProcessing: boolean;
  availableTargets: ParkingSpot[];
  poolFiltered: Vehicle[];
  onClose: () => void;
  onAssign: (vehicle: Vehicle) => void;
  onMove: () => void;
  onRevoke: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onStatus: () => void;
}

export function SpotDrawer({
  spot,
  isViewingHistory,
  mode,
  setMode,
  reason,
  setReason,
  moveTarget,
  setMoveTarget,
  statusTarget,
  setStatusTarget,
  vehSearch,
  setVehSearch,
  isProcessing,
  availableTargets,
  poolFiltered,
  onClose,
  onAssign,
  onMove,
  onRevoke,
  onBlock,
  onUnblock,
  onStatus,
}: SpotDrawerProps) {
  const t = en.adminParking;
  const state = parkingSpotStateOf(spot.status);

  return (
    <Modal
      onClose={onClose}
      label={`${t.drawerLabel} ${spot.spot_number}`}
      overlayClassName="z-[150] items-stretch justify-end p-0"
      backdropClassName="bg-zinc-950/40"
      className="h-full max-w-md"
    >
      <div className="w-full bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <DrawerHeader spot={spot} onClose={onClose} />

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {spot.vehicles && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{t.assignedVehicle}</div>
              <div className="flex items-center gap-3">
                <VehicleTopDownIcon
                  color={spot.vehicles.color}
                  make={spot.vehicles.make}
                  model={spot.vehicles.model}
                  className="h-14 w-10 shrink-0"
                />
                <div>
                  <div className="font-mono font-bold text-zinc-900">{spot.vehicles.plate_number}</div>
                  <div className="text-xs text-zinc-500">
                    {spot.vehicles.make} {spot.vehicles.model}
                    {spot.vehicles.year ? ` / ${spot.vehicles.year}` : ''}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm pt-1">
                <Meta icon={Building} label={t.unitLabel}  value={spot.apartments?.apartment_number || '-'} />
                <Meta icon={Users}    label={t.ownerLabel} value={spot.vehicles.profiles?.full_name || '-'} />
              </div>
            </div>
          )}

          {isViewingHistory ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
              {t.historyEditingDisabled}
            </div>
          ) : (
            <>
              {mode === null && (
                <div className="grid grid-cols-2 gap-2">
                  {state === 'available' && (
                    <>
                      <Button onClick={() => setMode('assign')} className="bg-zinc-950 text-white col-span-2">
                        <Car className="h-4 w-4 mr-2" /> {t.assignVehicle}
                      </Button>
                      <Button variant="outline" onClick={() => { setMode('block'); setReason(''); }} className="text-destructive border-destructive/30 hover:bg-destructive/10 col-span-2">
                        <Lock className="h-4 w-4 mr-2" /> {t.blockSpot}
                      </Button>
                    </>
                  )}
                  {state === 'occupied' && (
                    <>
                      <Button variant="outline" onClick={() => { setMode('move'); setReason(''); setMoveTarget(''); }} className="col-span-2">
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> {t.moveToAnotherSpot}
                      </Button>
                      <Button variant="outline" onClick={() => { setMode('revoke'); setReason(''); }} className="text-destructive border-destructive/30 hover:bg-destructive/10 col-span-2">
                        <Trash2 className="h-4 w-4 mr-2" /> {t.revokeAssignment}
                      </Button>
                    </>
                  )}
                  {state === 'blocked' && (
                    <Button onClick={onUnblock} disabled={isProcessing} className="bg-success text-success-foreground hover:bg-success/90 col-span-2">
                      {isProcessing ? <Spinner className="size-4 text-current" /> : <><Unlock className="h-4 w-4 mr-2" /> {t.unblockSpot}</>}
                    </Button>
                  )}
                  {state === 'conflict' && (
                    <Button variant="outline" onClick={() => { setMode('revoke'); setReason(''); }} className="text-destructive border-destructive/30 hover:bg-destructive/10 col-span-2">
                      <Trash2 className="h-4 w-4 mr-2" /> {t.revokeAndClear}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => { setMode('status'); setReason(''); setStatusTarget(PARKING_SPOT_STATUS.available); }} className="col-span-2 text-zinc-500">
                    {t.changeStatusManually}
                  </Button>
                </div>
              )}

              {mode === 'assign' && (
                <div className="space-y-3">
                  <BackRow label={t.assignVehicleTitle} onBack={() => setMode(null)} />
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input autoFocus aria-label={t.assignSearchAriaLabel} placeholder={t.assignSearchPlaceholder} value={vehSearch} onChange={e => setVehSearch(e.target.value)} className="pl-9 h-10" />
                  </div>
                  {poolFiltered.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-6 text-center">{t.noVehiclesAvailable}</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2 -mx-1 px-1">
                      {poolFiltered.map(v => (
                        <button
                          key={v.id}
                          disabled={isProcessing}
                          onClick={() => onAssign(v)}
                          className="w-full text-left rounded-lg border border-zinc-200 p-3 hover:border-zinc-400 hover:bg-zinc-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                        >
                          <VehicleTopDownIcon color={v.color} make={v.make} model={v.model} className="h-10 w-8 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-sm text-zinc-900 truncate">{v.plate_number}</div>
                            <div className="text-[11px] text-zinc-500">{t.unitPrefix} {v.apartments?.apartment_number || '-'} / {v.make}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode === 'move' && (
                <div className="space-y-3">
                  <BackRow label={t.moveVehicleTitle} onBack={() => setMode(null)} />
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.targetSpotLabel}</Label>
                    <select aria-label={t.targetSpotAriaLabel} value={moveTarget} onChange={e => setMoveTarget(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium">
                      <option value="">{t.targetSpotPlaceholder}</option>
                      {availableTargets.map(s => <option key={s.id} value={s.id}>{s.spot_number} / {PARKING_ZONE_LABELS[s.zone || ''] || s.zone}</option>)}
                    </select>
                  </div>
                  <ReasonField value={reason} onChange={setReason} />
                  <Button onClick={onMove} disabled={isProcessing || !moveTarget || reason.trim().length < 3} className="w-full bg-zinc-950 text-white">
                    {isProcessing ? <Spinner className="size-4 text-current" /> : t.confirmMove}
                  </Button>
                </div>
              )}

              {mode === 'revoke' && (
                <div className="space-y-3">
                  <BackRow label={t.revokeAssignmentTitle} onBack={() => setMode(null)} />
                  <ReasonField value={reason} onChange={setReason} />
                  <Button variant="destructive" onClick={onRevoke} disabled={isProcessing || reason.trim().length < 3} className="w-full">
                    {isProcessing ? <Spinner className="size-4 text-current" /> : t.confirmRevoke}
                  </Button>
                </div>
              )}

              {mode === 'block' && (
                <div className="space-y-3">
                  <BackRow label={t.blockSpotTitle} onBack={() => setMode(null)} />
                  <ReasonField value={reason} onChange={setReason} placeholder={t.blockReasonPlaceholder} />
                  <Button variant="destructive" onClick={onBlock} disabled={isProcessing || reason.trim().length < 3} className="w-full">
                    {isProcessing ? <Spinner className="size-4 text-current" /> : t.confirmBlock}
                  </Button>
                </div>
              )}

              {mode === 'status' && (
                <div className="space-y-3">
                  <BackRow label={t.changeStatusTitle} onBack={() => setMode(null)} />
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.newStatusLabel}</Label>
                    <select aria-label={t.newStatusAriaLabel} value={statusTarget} onChange={e => setStatusTarget(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium">
                      {PARKING_MANUAL_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <ReasonField value={reason} onChange={setReason} />
                  <Button onClick={onStatus} disabled={isProcessing || reason.trim().length < 3} className="w-full bg-zinc-950 text-white">
                    {isProcessing ? <Spinner className="size-4 text-current" /> : t.applyStatus}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DrawerHeader({ spot, onClose }: { spot: ParkingSpot; onClose: () => void }) {
  const ui = PARKING_SPOT_STATE_UI[parkingSpotStateOf(spot.status)];
  const dt = en.adminParking;
  return (
    <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between bg-zinc-50 shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight font-mono">{spot.spot_number}</h2>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={ui.badge} className="uppercase tracking-wider text-[10px] font-bold">{ui.label}</Badge>
          <span className="text-xs text-zinc-500">{PARKING_ZONE_LABELS[spot.zone || ''] || spot.zone} / {dt.floorPrefix} {spot.floor || '1'}</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label={dt.closeAriaLabel} className="h-8 w-8 bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</div>
      <div className="font-semibold text-zinc-900 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-zinc-900">{label}</h3>
      <Button variant="ghost" size="sm" onClick={onBack} className="text-zinc-500 h-7">{en.adminParking.back}</Button>
    </div>
  );
}

function ReasonField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const rt = en.adminParking;
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{rt.reasonLabel}</Label>
      <Input autoFocus aria-label={rt.reasonAriaLabel} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || rt.reasonPlaceholder} className="h-10" />
    </div>
  );
}
