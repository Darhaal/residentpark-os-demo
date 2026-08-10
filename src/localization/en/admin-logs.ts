// Title: Admin Logs Localization
// Path: src/localization/en/admin-logs.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const adminLogs = {
  navTitle: 'Access Control',
  pageTitle: 'System Audit Logs',
  pageDescription: 'System audit trail.',
  summaryAria: 'Audit log summary',
  summary: {
    loaded: 'Loaded records',
    streamMode: 'Stream mode',
    activeFilters: 'Active filters',
  },

  // Status badges
  live: 'Live',
  history: 'History',

  // Toolbar buttons
  addNote: 'Add Note',
  sync: 'Sync',
  exportCsv: 'Export CSV',
  exporting: 'Exporting...',

  // Inline error banner
  errorTitle: 'Error',

  // Filters
  searchPlaceholder: 'Search...',
  searchAriaLabel: 'Search audit logs',
  filterAriaLabel: 'Filter by action type',
  allActions: 'All Actions',
  fromDateAriaLabel: 'From date',
  toDateAriaLabel: 'To date',

  // Table headers
  colTimestamp: 'Timestamp (UTC)',
  colActor: 'Actor',
  colActionType: 'Action Type',
  colSummary: 'Summary',

  // Table row fallbacks
  systemActor: 'System',
  unknownEmail: 'Unknown Email',
  inspectButton: 'Inspect',

  // Empty state
  noRecordsTitle: 'No records found',
  noRecordsDescription: 'No audit events match your filters.',

  // Load more
  queryingDb: 'Querying DB...',
  loadOlderRecords: 'Load Older Records',

  // Add note modal
  addNoteTitle: 'Add Audit Note',
  addNoteDescription: 'Create a superadmin audit note for operational context.',
  domainLabel: 'Domain Space',
  domainSystem: 'System',
  domainIdentity: 'Identity',
  domainProperty: 'Property',
  domainVehicle: 'Vehicle',
  severityLabel: 'Severity',
  severityInfo: 'Info',
  severityWarning: 'Warning',
  severityCritical: 'Critical',
  actionTypeTagLabel: 'Action Type Tag',
  actionTypePlaceholder: 'e.g. MANUAL_OVERRIDE',
  eventDescriptionLabel: 'Event Description / Payload',
  eventDescriptionPlaceholder: 'Record your operational notes here...',
  cancel: 'Cancel',
  submitToBus: 'Create Note',

  // Event detail modal
  eventDetailsTitle: 'Event Details',
  entityFallback: 'Entity',
  entityIdFallback: 'N/A',
  ipLabel: 'IP',
  ipFallback: 'Unknown',
  oldValueLabel: 'Old Value',
  newValueLabel: 'New Value',
  noDifferences: 'No structural differences detected.',

  // Page-level error state
  unavailableTitle: 'Audit logs unavailable',
  unavailableDescription: 'System audit logs could not be loaded.',

  // Inline error / success messages
  loadError: 'Failed to load audit logs.',
  loadOlderError: 'Failed to load older records.',
  createSuccess: 'Manual audit log created successfully.',
  createError: 'Failed to create log.',
  exportError: 'Failed to compile export data.',
  noExportData: 'No data found to export.',
  exportSuccess: 'Export downloaded successfully.',
} as const;
