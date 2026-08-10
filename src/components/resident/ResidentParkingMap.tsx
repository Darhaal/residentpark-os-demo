// Title: Resident Privacy-Safe Parking Map
// Path: src/components/resident/ResidentParkingMap.tsx
// Functionality: Coordinates privacy-safe garage presentation and assigned-spot issue reporting.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { EmptyState } from '@/components/ui/empty-state';
import { useFeedback } from '@/hooks/use-feedback';
import { en } from '@/localization/en';
import type { ParkingLayoutShape } from '@/config/parking-layout';
import { ResidentParkingGrid } from './ResidentParkingGrid';
import { ResidentParkingIssueModal } from './ResidentParkingIssueModal';
import { ResidentParkingMapHeader } from './ResidentParkingMapHeader';
import type { ResidentMapSpot } from './resident-parking-map-types';
import { buildResidentParkingFloors } from './resident-parking-map-utils';

export type { ResidentMapSpot } from './resident-parking-map-types';

const messages = en.residentParkingMap;

export function ResidentParkingMap({
  spots,
  layoutShapes,
  apartmentNumber,
  spatialRenderEnabled,
}: {
  spots: ResidentMapSpot[];
  layoutShapes: ParkingLayoutShape[];
  apartmentNumber: string | null;
  spatialRenderEnabled?: boolean;
}) {
  const router = useRouter();
  const feedback = useFeedback();
  const [selectedSpot, setSelectedSpot] = useState<ResidentMapSpot | null>(null);

  if (spots.length === 0) {
    return (
      <EmptyState icon={MapPin} title={messages.unavailableTitle} description={messages.unavailableDescription} />
    );
  }

  const ownSpotCount = spots.filter((spot) => spot.is_own).length;
  const activeRelocation = spots.find(
    (spot) => spot.is_own && spot.relocation_status && spot.temporary_spot_number,
  );
  const floors = buildResidentParkingFloors(spots);

  const openIssueModal = (spot: ResidentMapSpot) => {
    feedback.clearFeedback();
    setSelectedSpot(spot);
  };

  const handleSubmitted = () => {
    feedback.showToast(messages.issueSubmitted);
    setSelectedSpot(null);
    router.refresh();
  };

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm" aria-labelledby="resident-parking-map-title">
      <FeedbackToasts successMsg={feedback.successMsg} errorMsg={feedback.errorMsg} onClear={feedback.clearFeedback} />

      <ResidentParkingMapHeader
        apartmentNumber={apartmentNumber}
        ownSpotCount={ownSpotCount}
        activeRelocation={activeRelocation}
      />
      <ResidentParkingGrid
        floors={floors}
        layoutShapes={layoutShapes}
        onReportIssue={openIssueModal}
        spatialRenderEnabled={spatialRenderEnabled}
      />

      {selectedSpot && (
        <ResidentParkingIssueModal
          spot={selectedSpot}
          onBeforeSubmit={feedback.clearFeedback}
          onClose={() => setSelectedSpot(null)}
          onError={feedback.showError}
          onSubmitted={handleSubmitted}
        />
      )}
    </section>
  );
}
