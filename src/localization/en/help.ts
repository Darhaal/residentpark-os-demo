// Title: Help / onboarding copy
// Path: src/localization/en/help.ts
// Functionality: Short, role-aware "what to do" guide shown from the navbar (?) button.
// Draft bullets — intended to be refined with product later.

export const help = {
  buttonAria: 'Help and quick guide',
  title: 'Quick guide',
  closeAria: 'Close help',
  adminHeading: 'Running the building',
  residentHeading: 'Your resident portal',
  adminSteps: [
    'Approvals — review new residents, approve them and assign an apartment.',
    'Parking — open the garage map to assign, move, block or free spots (drag a vehicle onto a spot).',
    'Issues — resolve problems residents report on their spots.',
    'Disruptions — plan construction, relocate affected spots and notify residents.',
    'Notices — post building-wide announcements.',
    'Reports show the big picture; superadmins can review every action in Logs.',
  ],
  residentSteps: [
    'Add your vehicle on the dashboard so management can assign you a spot.',
    'Open the Garage Map to see your spot and the rest of the garage.',
    'Found a problem on your spot? Report it from the map (blocked, damaged, wrong car).',
    'Check Notices for announcements and parking disruptions.',
    'New here? Management reviews your account before a spot is assigned.',
  ],
  footer: 'This guide is a work in progress — more detailed help is coming.',
} as const;
