// Central place for what each role is allowed to see.
// Owner: everything. Staff: day-to-day operational modules. Technician: just enough to see service work.
export const ROLE_PAGES = {
  Owner: ['dashboard', 'purchase', 'sell', 'stock', 'pnl', 'crm', 'settings'],
  Staff: ['dashboard', 'purchase', 'sell', 'stock', 'crm', 'settings'],
  Technician: ['dashboard', 'settings']
};

export function pagesForRole(role) {
  return ROLE_PAGES[role] || ROLE_PAGES.Staff;
}
