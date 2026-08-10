// Title: Parking Map State Hook
// Path: src/app/admin/parking/use-parking-map.ts
// Functionality: Owns all state, derived data and mutations for the admin parking map —
//   filtering, multi-floor selection, time machine, stats, drag-and-drop, keyboard
//   navigation and the spot drawer operations. Presentational components consume the
//   returned values. Extracted from ParkingClient to keep that file composition-only.

'use client';

import { useCallback, useMemo, useRef, useState, useTransition, type MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  assignParkingSpotAction,
  transferParkingSpotAction,
  revokeParkingSpotAction,
  updateSpotStatusAction,
} from '@/actions/parking';
import { loadParkingMapStateAction } from '@/actions/loaders';
import { useFeedback } from '@/hooks/use-feedback';
import {
  parkingSpotStateCountsAsOccupied,
  parkingSpotStateOf,
} from '@/config/parking';
import { FILTER_ALL, PARKING_SPOT_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import { floorHasSpatialLayout, type ParkingLayoutShape } from '@/config/parking-layout';
import type {
  DragPayload,
  ParkingClientProps,
  ParkingSpot,
  ParkingStats,
  SpotMode,
  Vehicle,
} from './types';

const sortSpots = (spots: ParkingSpot[]) =>
  [...spots].sort((a, b) => a.spot_number.localeCompare(b.spot_number, undefined, { numeric: true }));

export function useParkingMap({ initialDate, initialSpots, initialPool, initialLayoutShapes }: ParkingClientProps) {
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();
  const t = en.adminParking;
  // Seed from ?q= so Global Search spot results deep-link straight to the match; a
  // deep link also starts with EVERY floor selected, or a spot on another floor
  // would be filtered out before the search even applies.
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('q') ?? '';

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'lanes' | 'grid'>('lanes');
  const [spots, setSpots] = useState<ParkingSpot[]>(sortSpots(initialSpots));
  const [pool, setPool] = useState<Vehicle[]>(initialPool);
  const [layoutShapes, setLayoutShapes] = useState<ParkingLayoutShape[]>(initialLayoutShapes);
  const [viewDate, setViewDate] = useState(initialDate);
  const [selectedFloors, setSelectedFloors] = useState<string[]>(() => (
    initialSearch
      ? Array.from(new Set(initialSpots.map((spot) => spot.floor || '1')))
      : [initialSpots[0]?.floor || '1']
  ));
  const [floorAnchor, setFloorAnchor] = useState<string | null>(initialSpots[0]?.floor || '1');
  const [search, setSearch] = useState(initialSearch);
  const [zoneFilter, setZoneFilter] = useState(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [isPending, startTransition] = useTransition();

  // Drawer state
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [mode, setMode] = useState<SpotMode>(null);
  const [reason, setReason] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [statusTarget, setStatusTarget] = useState<string>(PARKING_SPOT_STATUS.available);
  const [vehSearch, setVehSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Drag & drop state
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverSpotId, setDragOverSpotId] = useState<string | null>(null);

  // Keyboard navigation — map of spotId → button element
  const spotRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const isViewingHistory = viewDate !== initialDate;

  // ── Data refresh ────────────────────────────────────────────────────────────

  const refreshData = useCallback(async (targetDate: string) => {
    clearFeedback();
    const res = await loadParkingMapStateAction(targetDate);
    if (!res.success) { showError(res.error || t.loadError); return false; }
    const state = res.state as { spots: ParkingSpot[]; unassigned_pool: Vehicle[]; layout_shapes: ParkingLayoutShape[] };
    const sorted = sortSpots(state.spots);
    setSpots(sorted);
    setPool(state.unassigned_pool || []);
    setLayoutShapes(state.layout_shapes || []);
    setSelectedFloors(prev => (prev.length ? prev : [sorted[0]?.floor || '1']));
    return true;
  }, [clearFeedback, showError, t.loadError]);

  const handleDateChange = (nextDate: string) => {
    startTransition(async () => {
      const loaded = await refreshData(nextDate);
      if (loaded) setViewDate(nextDate);
    });
  };

  const refresh = () => startTransition(async () => { await refreshData(viewDate); });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const floors = useMemo(() => Array.from(new Set(spots.map(s => s.floor || '1'))).sort(), [spots]);
  const floorSpots = useMemo(() => spots.filter(s => selectedFloors.includes(s.floor || '1')), [spots, selectedFloors]);
  const spatialFloorKeys = useMemo(() => floors.filter((floor) => (
    floorHasSpatialLayout(spots.filter((spot) => (spot.floor || '1') === floor))
  )), [floors, spots]);
  const allSelectedFloorsSpatial = selectedFloors.length > 0
    && selectedFloors.every((floor) => spatialFloorKeys.includes(floor));
  const zonesOnFloor = useMemo(() => Array.from(new Set(floorSpots.map(s => s.zone || 'residential'))), [floorSpots]);

  const allFloorsSelected = floors.length > 0 && selectedFloors.length === floors.length;

  // Floor tabs support multi-select: plain click = just that floor; Ctrl/⌘-click toggles
  // a floor in/out; Shift-click selects a contiguous range from the last anchor.
  const handleFloorTabClick = (floor: string, event: ReactMouseEvent) => {
    if (event.shiftKey && floorAnchor) {
      const a = floors.indexOf(floorAnchor);
      const b = floors.indexOf(floor);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        setSelectedFloors(floors.slice(lo, hi + 1));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setSelectedFloors(prev =>
        prev.includes(floor)
          ? (prev.length > 1 ? prev.filter(f => f !== floor) : prev)
          : [...prev, floor]
      );
      setFloorAnchor(floor);
      return;
    }
    setSelectedFloors([floor]);
    setFloorAnchor(floor);
  };

  const stats = useMemo<ParkingStats>(() => {
    const acc = { total: floorSpots.length, available: 0, occupied: 0, blocked: 0, conflict: 0 };
    for (const s of floorSpots) {
      const st = parkingSpotStateOf(s.status);
      if (st === 'available') acc.available++;
      if (parkingSpotStateCountsAsOccupied(st)) acc.occupied++;
      if (st === 'blocked')   acc.blocked++;
      if (st === 'conflict')  acc.conflict++;
    }
    return { ...acc, occupancy: acc.total ? Math.round((acc.occupied / acc.total) * 100) : 0 };
  }, [floorSpots]);

  const matchesSearch = useCallback((spot: ParkingSpot) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      spot.spot_number.toLowerCase().includes(q) ||
      (spot.apartments?.apartment_number || '').toLowerCase().includes(q) ||
      (spot.vehicles?.plate_number || '').toLowerCase().includes(q)
    );
  }, [search]);

  const byZone = useMemo(() => {
    const visible = floorSpots.filter(s =>
      (zoneFilter === FILTER_ALL || s.zone === zoneFilter) &&
      (statusFilter === FILTER_ALL || parkingSpotStateOf(s.status) === statusFilter)
    );
    const groups: Record<string, ParkingSpot[]> = {};
    for (const s of visible) {
      const z = s.zone || 'residential';
      (groups[z] ||= []).push(s);
    }
    return Object.entries(groups);
  }, [floorSpots, zoneFilter, statusFilter]);

  // Flat list of all visible spots — used for keyboard navigation order
  const visibleSpots = useMemo(() => byZone.flatMap(([, list]) => list), [byZone]);

  const selectedSpot = useMemo(() => spots.find(s => s.id === selectedSpotId) || null, [spots, selectedSpotId]);
  const availableTargets = useMemo(
    () => floorSpots.filter(s => parkingSpotStateOf(s.status) === 'available' && s.id !== selectedSpotId),
    [floorSpots, selectedSpotId]
  );
  const poolFiltered = useMemo(() => {
    const q = vehSearch.trim().toLowerCase();
    return pool.filter(v => !q || v.plate_number.toLowerCase().includes(q) || (v.apartments?.apartment_number || '').toLowerCase().includes(q));
  }, [pool, vehSearch]);

  // ── Drawer ops ────────────────────────────────────────────────────────────────

  const openSpot = (id: string) => {
    setSelectedSpotId(id);
    setMode(null);
    setReason('');
    setMoveTarget('');
    setVehSearch('');
  };

  const closeDrawer = () => { setSelectedSpotId(null); setMode(null); };

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setIsProcessing(true);
    try {
      const res = await fn();
      if (!res.success) { showError(res.error || t.operationFailed); return false; }
      showToast(ok);
      await refreshData(viewDate);
      return true;
    } finally { setIsProcessing(false); }
  };

  const doAssign = async (vehicle: Vehicle) => {
    if (!selectedSpot) return;
    const ok = await run(
      () => assignParkingSpotAction(selectedSpot.id, vehicle.apartment_id, vehicle.id, 'permanent'),
      t.assigned(vehicle.plate_number, selectedSpot.spot_number)
    );
    if (ok) closeDrawer();
  };

  const doMove = async () => {
    if (!selectedSpot || !moveTarget || reason.trim().length < 3 || !selectedSpot.assigned_apartment_id) return;
    const ok = await run(
      () => transferParkingSpotAction(selectedSpot.id, moveTarget, selectedSpot.assigned_apartment_id!, selectedSpot.assigned_vehicle_id, reason),
      t.vehicleMoved
    );
    if (ok) closeDrawer();
  };

  const doRevoke = async () => {
    if (!selectedSpot || reason.trim().length < 3) return;
    const ok = await run(() => revokeParkingSpotAction(selectedSpot.id, reason), t.assignmentRevoked);
    if (ok) closeDrawer();
  };

  const doBlock = async () => {
    if (!selectedSpot || reason.trim().length < 3) return;
    const ok = await run(() => updateSpotStatusAction(selectedSpot.id, PARKING_SPOT_STATUS.blocked, reason), t.spotBlocked);
    if (ok) closeDrawer();
  };

  const doUnblock = async () => {
    if (!selectedSpot) return;
    const ok = await run(() => updateSpotStatusAction(selectedSpot.id, PARKING_SPOT_STATUS.available, 'Unblocked by admin'), t.spotUnblocked);
    if (ok) closeDrawer();
  };

  const doStatus = async () => {
    if (!selectedSpot || reason.trim().length < 3) return;
    const ok = await run(() => updateSpotStatusAction(selectedSpot.id, statusTarget, reason), t.statusSet(statusTarget));
    if (ok) closeDrawer();
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────────

  const handleDragStartFromPool = (vehicle: Vehicle) => {
    setDragging({ vehicleId: vehicle.id, plate: vehicle.plate_number, apartment_id: vehicle.apartment_id, fromSpotId: null });
  };

  const handleDragStartFromSpot = (spot: ParkingSpot) => {
    if (!spot.vehicles || !spot.assigned_apartment_id) return;
    setDragging({ vehicleId: spot.vehicles.id, plate: spot.vehicles.plate_number, apartment_id: spot.assigned_apartment_id, fromSpotId: spot.id });
  };

  const handleDragEnd = () => { setDragging(null); setDragOverSpotId(null); };

  const handleDropOnSpot = async (e: React.DragEvent, spot: ParkingSpot) => {
    e.preventDefault();
    setDragOverSpotId(null);
    if (!dragging || parkingSpotStateOf(spot.status) !== 'available' || isViewingHistory) return;
    const { vehicleId, apartment_id, plate, fromSpotId } = dragging;
    setDragging(null);
    if (fromSpotId) {
      await run(
        () => transferParkingSpotAction(fromSpotId, spot.id, apartment_id, vehicleId, 'Moved via drag and drop'),
        t.vehicleMoved
      );
    } else {
      await run(
        () => assignParkingSpotAction(spot.id, apartment_id, vehicleId, 'permanent'),
        t.assignedDrop(plate)
      );
    }
  };

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  const setSpotRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) spotRefs.current.set(id, el);
    else spotRefs.current.delete(id);
  }, []);

  const handleSpotKeyDown = (e: React.KeyboardEvent, spotId: string) => {
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpot(spotId); return; }
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const idx = visibleSpots.findIndex(s => s.id === spotId);
    if (idx === -1) return;
    const nextIdx = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? idx + 1 : idx - 1;
    const next = visibleSpots[nextIdx];
    if (next) spotRefs.current.get(next.id)?.focus();
  };

  const searchActive = search.trim().length > 0;

  return {
    t,
    // feedback
    errorMsg, successMsg, clearFeedback,
    // view chrome
    isFullscreen, setIsFullscreen, viewMode, setViewMode, allSelectedFloorsSpatial,
    viewDate, isViewingHistory, handleDateChange, refresh, isPending,
    // filters
    search, setSearch, zoneFilter, setZoneFilter, statusFilter, setStatusFilter,
    zonesOnFloor,
    floors, selectedFloors, setSelectedFloors, setFloorAnchor, allFloorsSelected, handleFloorTabClick,
    // data
    stats, byZone, visibleSpots, layoutShapes, spatialFloorKeys, pool,
    // tile state + handlers
    dragging, dragOverSpotId, setDragOverSpotId, selectedSpotId,
    matchesSearch, searchActive,
    openSpot, handleSpotKeyDown, setSpotRef,
    handleDragStartFromSpot, handleDragStartFromPool, handleDragEnd, handleDropOnSpot,
    // drawer
    selectedSpot, mode, setMode, reason, setReason, moveTarget, setMoveTarget,
    statusTarget, setStatusTarget, vehSearch, setVehSearch, isProcessing,
    availableTargets, poolFiltered, closeDrawer,
    doAssign, doMove, doRevoke, doBlock, doUnblock, doStatus,
  };
}
