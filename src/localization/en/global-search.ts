// Title: Global Search Localization
// Path: src/localization/en/global-search.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const globalSearch = {
  openAria: 'Open search (Ctrl+K)',
  buttonLabel: 'Search...',
  shortcut: 'Ctrl K',
  dialogAria: 'Global search',
  placeholder: 'Search plate, resident, unit, or spot...',
  queryAria: 'Search query',
  minimumQuery: 'Type at least 2 characters to search.',
  noResults: (query: string) => `No results for "${query}".`,
  errorFallback: 'Search is unavailable right now.',
  groups: {
    vehicles: 'Vehicles',
    residents: 'Residents',
    apartments: 'Apartments',
    spots: 'Parking spots',
  },
  noName: 'No name',
  emptyValue: '-',
  unitPrefix: 'Unit',
  floorPrefix: 'Floor',
  openHint: 'to open',
  closeHint: 'Esc to close',
} as const;
