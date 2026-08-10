// Title: Admin Parking Localization
// Path: src/localization/en/admin-parking.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const adminParking = {
  // ── Page shell ────────────────────────────────────────────────────────────────
  navTitle: 'Parking Map',
  unavailableTitle: 'Parking map unavailable',
  unavailableDescription: 'Parking map data could not be loaded.',

  // ── Page header ───────────────────────────────────────────────────────────────
  pageTitle: 'Parking Map',
  descLanes: 'Garage lane view — drag to assign, arrow keys to navigate spots.',
  descGrid: 'Click any spot to inspect or manage it.',
  descSpatial: 'Garage layout view - select a spot to inspect or manage it.',

  // ── Toolbar ───────────────────────────────────────────────────────────────────
  timeMachineLabel: 'Time Machine',
  viewDateAriaLabel: 'View date',
  refreshAriaLabel: 'Refresh',
  switchToGrid: 'Grid',
  switchToLanes: 'Lanes',
  exitFullscreen: 'Exit',
  enterFullscreen: 'Fullscreen',

  // ── Banners ───────────────────────────────────────────────────────────────────
  historyBanner: 'Viewing an assignment-history snapshot. Editing is disabled, and operational spot statuses are not historically versioned.',
  draggingPrefix: 'Dragging',
  draggingSuffix: '— drop onto any green available spot',

  // ── Stats ─────────────────────────────────────────────────────────────────────
  statTotal: 'Total',
  statAvailable: 'Available',
  statOccupied: 'Occupied',
  statBlocked: 'Blocked',
  statConflicts: 'Conflicts',
  occupancyLabel: (pct: number) => `${pct}% occupied`,

  // ── Filters ───────────────────────────────────────────────────────────────────
  searchPlaceholder: 'Search plate, unit, or spot...',
  searchAriaLabel: 'Search by plate, unit, or spot',
  filterZoneAriaLabel: 'Filter by zone',
  allZones: 'All zones',
  filterStatusAriaLabel: 'Filter by status',
  allStatuses: 'All statuses',
  floorsAriaLabel: 'Floors',

  // ── Floor tabs ────────────────────────────────────────────────────────────────
  streetFloor: 'Street',
  floorLabel: (floor: string) => `Floor ${floor}`,
  allFloors: 'All',
  floorMultiHint: 'Click a floor · Ctrl/⌘-click to add · Shift-click for a range',

  // ── Empty state ───────────────────────────────────────────────────────────────
  noSpotsTitle: 'No spots match',
  noSpotsDescription: 'Try clearing the search or filters for this floor.',

  // ── Keyboard hint ─────────────────────────────────────────────────────────────
  keyboardHint: 'Arrow keys navigate spots · Enter/Space opens drawer · Esc closes · Drag occupied spots to move',

  // ── Spot tile ─────────────────────────────────────────────────────────────────
  dropHere: 'Drop here',
  unitPrefix: 'Unit',
  aisleLabel: 'Aisle',

  // ── Vehicle pool ──────────────────────────────────────────────────────────────
  unassignedBadge: (count: number) => `${count} unassigned`,
  poolHint: 'Drag a vehicle card onto any available spot · or open a spot and use Assign',

  // ── Side drawer — view ────────────────────────────────────────────────────────
  assignedVehicle: 'Assigned Vehicle',
  unitLabel: 'Unit',
  ownerLabel: 'Owner',
  closeAriaLabel: 'Close',
  drawerLabel: 'Parking spot actions',
  floorPrefix: 'Floor',
  historyEditingDisabled: 'Editing disabled while viewing history.',

  // ── Action buttons ────────────────────────────────────────────────────────────
  assignVehicle: 'Assign vehicle',
  blockSpot: 'Block spot',
  moveToAnotherSpot: 'Move to another spot',
  revokeAssignment: 'Revoke assignment',
  unblockSpot: 'Unblock spot',
  revokeAndClear: 'Revoke and clear',
  changeStatusManually: 'Change status manually',
  back: 'Back',

  // ── Assign mode ───────────────────────────────────────────────────────────────
  assignVehicleTitle: 'Assign vehicle',
  assignSearchPlaceholder: 'Search plate or unit...',
  assignSearchAriaLabel: 'Search vehicles',
  noVehiclesAvailable: 'No approved vehicles available to assign.',

  // ── Move mode ─────────────────────────────────────────────────────────────────
  moveVehicleTitle: 'Move vehicle',
  targetSpotLabel: 'Target spot',
  targetSpotAriaLabel: 'Target spot',
  targetSpotPlaceholder: 'Select an available spot...',
  confirmMove: 'Confirm move',

  // ── Revoke mode ───────────────────────────────────────────────────────────────
  revokeAssignmentTitle: 'Revoke assignment',
  confirmRevoke: 'Confirm revoke',

  // ── Block mode ────────────────────────────────────────────────────────────────
  blockSpotTitle: 'Block spot',
  blockReasonPlaceholder: 'e.g. Maintenance, construction...',
  confirmBlock: 'Confirm block',

  // ── Status mode ───────────────────────────────────────────────────────────────
  changeStatusTitle: 'Change status',
  newStatusLabel: 'New status',
  newStatusAriaLabel: 'New status',
  applyStatus: 'Apply status',

  // ── Reason field ──────────────────────────────────────────────────────────────
  reasonLabel: 'Operational reason (required)',
  reasonAriaLabel: 'Operational reason',
  reasonPlaceholder: 'Logged to the audit trail...',

  // ── Success / error messages ──────────────────────────────────────────────────
  assigned: (plate: string, spot: string) => `Assigned ${plate} to ${spot}`,
  assignedDrop: (plate: string) => `Assigned ${plate}`,
  vehicleMoved: 'Vehicle moved',
  assignmentRevoked: 'Assignment revoked',
  spotBlocked: 'Spot blocked',
  spotUnblocked: 'Spot unblocked',
  statusSet: (status: string) => `Status set to ${status}`,
  loadError: 'Failed to load parking map.',
  operationFailed: 'Operation failed.',
} as const;
