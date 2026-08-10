// Title: Vehicle Form Localization
// Path: src/localization/en/vehicle-form.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const vehicleForm = {
  apartmentLabel: 'Apartment',
  ownerLabel: 'Owner (Resident)',
  noOwnerOption: '-- No specific owner / shared vehicle --',
  unnamedResident: 'Unnamed Resident',
  plateLabel: 'Plate Number *',
  platePlaceholder: 'A123BC',
  makeLabel: 'Make *',
  makePlaceholder: 'Toyota',
  modelLabel: 'Model',
  modelPlaceholder: 'Camry',
  colorLabel: 'Color',
  colorPlaceholder: 'Silver',
  yearLabel: 'Year',
  yearPlaceholder: '2024',
  cancel: 'Cancel',
  submit: 'Submit',

  // Resident registration button / modal
  registerButton: 'Register Vehicle',
  registerModalTitle: 'Register Vehicle',
  registerModalDescription: 'Submit a vehicle request for management approval.',
  requiresUnit: 'Your account must be assigned to a unit before registering a vehicle.',
  requiredFields: 'Plate number and make are required.',
  plateRequired: 'Enter at least 2 characters for the plate number.',
  makeRequired: 'Enter the vehicle make.',
  submitRequest: 'Submit Request',
  submitError: 'Vehicle request could not be submitted.',
  submitSuccess: 'Vehicle submitted for approval.',
  pendingNotice: 'New vehicles appear as pending until property management approves the request.',
} as const;
