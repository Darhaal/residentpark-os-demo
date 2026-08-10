// Title: Resident Vehicle Status Badge
// Path: src/components/resident/ResidentVehicleStatusBadge.tsx
// Functionality: Maps every resident-visible vehicle lifecycle state to an explicit semantic badge.

import { Archive, CircleHelp, CircleX, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { en } from '@/localization/en';

interface ResidentVehicleStatusBadgeProps {
  status: string;
  className?: string;
}

export function ResidentVehicleStatusBadge({ status, className }: ResidentVehicleStatusBadgeProps) {
  if (status === VEHICLE_APPROVAL_STATUS.approved) {
    return (
      <Badge variant="success" className={className}>
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        {en.residentDashboard.activeVehicle}
      </Badge>
    );
  }

  if (status === VEHICLE_APPROVAL_STATUS.pendingApproval) {
    return (
      <Badge variant="warning" className={className}>
        <Clock aria-hidden="true" />
        {en.residentDashboard.pendingVehicle}
      </Badge>
    );
  }

  if (status === VEHICLE_APPROVAL_STATUS.rejected) {
    return (
      <Badge variant="destructive" className={className}>
        <CircleX aria-hidden="true" />
        {en.residentDashboard.rejectedVehicle}
      </Badge>
    );
  }

  if (status === VEHICLE_APPROVAL_STATUS.archived) {
    return (
      <Badge variant="secondary" className={className}>
        <Archive aria-hidden="true" />
        {en.residentDashboard.archivedVehicle}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      <CircleHelp aria-hidden="true" />
      {en.residentDashboard.unknownVehicleStatus}
    </Badge>
  );
}
