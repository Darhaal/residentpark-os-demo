// Title: Parking Map Client
// Path: src/app/admin/parking/ParkingClient.tsx
// Functionality: Composition root for the admin parking map. State, derived data and
//   mutations live in useParkingMap; this file wires the toolbar, stats, filters, map
//   views, unassigned-vehicle pool and the spot drawer together.

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import {
  AlertTriangle, Car, Maximize2, Minimize2, Map as MapIcon, RefreshCw, LayoutGrid,
} from 'lucide-react';
import { SpotDrawer } from './SpotDrawer';
import { SpotTile } from './SpotTile';
import { ParkingMap } from './ParkingMap';
import { ParkingFilters } from './ParkingFilters';
import { ParkingStats } from './ParkingStats';
import { UnassignedPool } from './UnassignedPool';
import { useParkingMap } from './use-parking-map';
import type { ParkingClientProps, ParkingSpot } from './types';

export type { ParkingSpot, Vehicle } from './types';

export function ParkingClient(props: ParkingClientProps) {
  const m = useParkingMap(props);
  const t = m.t;

  const renderSpot = (spot: ParkingSpot, side: 'left' | 'right' | 'grid' | 'spatial') => (
    <SpotTile
      key={spot.id}
      spot={spot}
      side={side}
      selected={m.selectedSpotId === spot.id}
      hasDrag={!!m.dragging}
      isOver={m.dragOverSpotId === spot.id}
      isViewingHistory={m.isViewingHistory}
      searchActive={m.searchActive}
      matches={m.matchesSearch(spot)}
      onOpen={m.openSpot}
      onKeyDown={m.handleSpotKeyDown}
      setRef={m.setSpotRef}
      onDragStartSpot={m.handleDragStartFromSpot}
      onDragEnd={m.handleDragEnd}
      setDragOver={m.setDragOverSpotId}
      onDrop={m.handleDropOnSpot}
    />
  );

  return (
    <main className={m.isFullscreen ? 'fixed inset-0 z-[100] bg-zinc-50 flex flex-col h-screen overflow-hidden' : 'flex-1 flex flex-col'}>
      <FeedbackToasts successMsg={m.successMsg} errorMsg={m.errorMsg} onClear={m.clearFeedback} />

      <div className={`flex-1 overflow-y-auto ${m.isFullscreen ? 'p-6' : 'p-4 sm:p-8'}`}>
        <div className="max-w-[1400px] mx-auto space-y-6">
          <PageHeader
            title={t.pageTitle}
            icon={MapIcon}
            description={m.allSelectedFloorsSpatial ? t.descSpatial : m.viewMode === 'lanes' ? t.descLanes : t.descGrid}
            className="border-b-0 pb-0"
            actions={
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="viewDate" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.timeMachineLabel}</Label>
                  <Input
                    id="viewDate"
                    type="date"
                    aria-label={t.viewDateAriaLabel}
                    value={m.viewDate}
                    onChange={e => m.handleDateChange(e.target.value)}
                    className={`h-10 shadow-sm font-medium ${m.isViewingHistory ? 'border-warning bg-warning/10 text-warning' : 'bg-white'}`}
                  />
                </div>
                <Button variant="outline" onClick={m.refresh} disabled={m.isPending} className="h-10 bg-white border-zinc-200" aria-label={t.refreshAriaLabel}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {!m.allSelectedFloorsSpatial && (
                  <Button
                    variant="outline"
                    onClick={() => m.setViewMode(mode => mode === 'lanes' ? 'grid' : 'lanes')}
                    className="h-10 bg-white border-zinc-200"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">{m.viewMode === 'lanes' ? t.switchToGrid : t.switchToLanes}</span>
                  </Button>
                )}
                <Button variant="outline" onClick={() => m.setIsFullscreen(v => !v)} className="h-10 bg-white border-zinc-200">
                  {m.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  <span className="hidden sm:inline ml-2">{m.isFullscreen ? t.exitFullscreen : t.enterFullscreen}</span>
                </Button>
              </div>
            }
          />

          {m.isViewingHistory && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t.historyBanner}
            </div>
          )}

          {m.dragging && (
            <div className="rounded-lg border border-info/30 bg-info/10 px-4 py-2 text-sm font-medium text-info flex items-center gap-2">
              <Car className="h-4 w-4" />
              {t.draggingPrefix} <span className="font-mono font-bold mx-1">{m.dragging.plate}</span> {t.draggingSuffix}
            </div>
          )}

          <ParkingStats stats={m.stats} />

          <ParkingFilters
            search={m.search}
            setSearch={m.setSearch}
            zoneFilter={m.zoneFilter}
            setZoneFilter={m.setZoneFilter}
            statusFilter={m.statusFilter}
            setStatusFilter={m.setStatusFilter}
            zonesOnFloor={m.zonesOnFloor}
            floors={m.floors}
            selectedFloors={m.selectedFloors}
            setSelectedFloors={m.setSelectedFloors}
            setFloorAnchor={m.setFloorAnchor}
            allFloorsSelected={m.allFloorsSelected}
            onFloorTabClick={m.handleFloorTabClick}
          />

          {m.byZone.length === 0 ? (
            <EmptyState icon={MapIcon} title={t.noSpotsTitle} description={t.noSpotsDescription} />
          ) : (
            <ParkingMap
              byZone={m.byZone}
              spots={m.visibleSpots}
              layoutShapes={m.layoutShapes}
              spatialFloorKeys={m.spatialFloorKeys}
              viewMode={m.viewMode}
              renderSpot={renderSpot}
            />
          )}

          <p className="text-[11px] text-zinc-400 text-center hidden sm:block">
            {t.keyboardHint}
          </p>
        </div>
      </div>

      {m.pool.length > 0 && !m.isViewingHistory && (
        <UnassignedPool pool={m.pool} onDragStart={m.handleDragStartFromPool} onDragEnd={m.handleDragEnd} />
      )}

      {m.selectedSpot && (
        <SpotDrawer
          spot={m.selectedSpot}
          isViewingHistory={m.isViewingHistory}
          mode={m.mode}
          setMode={m.setMode}
          reason={m.reason}
          setReason={m.setReason}
          moveTarget={m.moveTarget}
          setMoveTarget={m.setMoveTarget}
          statusTarget={m.statusTarget}
          setStatusTarget={m.setStatusTarget}
          vehSearch={m.vehSearch}
          setVehSearch={m.setVehSearch}
          isProcessing={m.isProcessing}
          availableTargets={m.availableTargets}
          poolFiltered={m.poolFiltered}
          onClose={m.closeDrawer}
          onAssign={m.doAssign}
          onMove={m.doMove}
          onRevoke={m.doRevoke}
          onBlock={m.doBlock}
          onUnblock={m.doUnblock}
          onStatus={m.doStatus}
        />
      )}
    </main>
  );
}
