// Central place for what each role is allowed to see.
export const ROLE_PAGES = {
  Owner: ['dashboard', 'purchase', 'sell', 'stock', 'pnl', 'crm', 'expenses', 'settings'],
  Staff: ['dashboard', 'purchase', 'sell', 'stock', 'crm', 'expenses', 'settings'],
  Technician: ['dashboard', 'settings']
};

export function pagesForRole(role) {
  return ROLE_PAGES[role] || ROLE_PAGES.Staff;
}
