// Title: Admin Reports Localization
// Path: src/localization/en/admin-reports.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const adminReports = {
  pageTitle: 'Reports',
  clientTitle: 'Operational Reports',
  pageDescription: 'Live snapshot of parking occupancy, vehicles awaiting spots, and operating issues.',
  snapshotLabel: 'Snapshot',
  occupancyNote: 'Conflict spots count as occupied and are also shown as conflict incidents.',
  unavailableTitle: 'Reports unavailable',
  unavailableDescription: 'Operational reports could not be loaded.',
  sections: {
    occupancy: 'Parking occupancy',
    vehiclesWithoutSpot: 'Vehicles awaiting a spot',
    unitsWithoutVehicle: 'Units without a registered vehicle',
  },
  occupancyStats: {
    total: 'Total',
    available: 'Available',
    occupied: 'Occupied',
    blocked: 'Blocked',
    conflict: 'Conflict',
    reserved: 'Reserved',
  },
  summaryStats: {
    pendingAccounts: 'Pending accounts',
    pendingVehicles: 'Pending vehicles',
    openIssues: 'Open issues',
  },
  csv: {
    downloadedToast: 'Export downloaded.',
    label: 'CSV',
    vehiclesWithoutSpotFilename: (date: string) => `vehicles_without_spot_${date}.csv`,
    unitsWithoutVehicleFilename: (date: string) => `units_without_vehicle_${date}.csv`,
    vehiclesWithoutSpotHeaders: ['Plate', 'Make', 'Model', 'Unit', 'Owner'],
    unitsWithoutVehicleHeaders: ['Unit', 'Status', 'Residents'],
  },
  tables: {
    vehiclesWithoutSpotHead: ['Plate', 'Make / Model', 'Unit', 'Owner'],
    unitsWithoutVehicleHead: ['Unit', 'Status', 'Residents'],
  },
  empty: {
    title: 'Nothing to report',
    vehiclesWithoutSpot: 'Every approved vehicle has a spot.',
    unitsWithoutVehicle: 'Every unit has at least one vehicle.',
    value: '-',
  },
  unitPrefix: 'Unit',
  actionErrors: {
    loadSpots: 'Failed to load report parking spots.',
    loadVehicles: 'Failed to load report vehicles.',
    loadUnits: 'Failed to load report units.',
    loadProfiles: 'Failed to load report residents.',
    loadPendingAccounts: 'Failed to load pending account count.',
    loadPendingVehicles: 'Failed to load pending vehicle count.',
    loadIssueCount: 'Failed to load parking issue count.',
  },
} as const;
