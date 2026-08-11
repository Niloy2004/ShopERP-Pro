const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  search: {
    global: invoke('search:global')
  },
  auth: {
    login: invoke('auth:login'),
    changePassword: invoke('auth:changePassword')
  },
  session: {
    get: invoke('session:get'),
    save: invoke('session:save'),
    clear: invoke('session:clear')
  },
  dashboard: {
    summary: invoke('dashboard:summary')
  },
  vendors: {
    list: invoke('vendors:list'),
    add: invoke('vendors:add'),
    update: invoke('vendors:update'),
    ledger: invoke('vendors:ledger'),
    delete: invoke('vendors:delete')
  },
  items: {
    list: invoke('items:list'),
    add: invoke('items:add'),
    update: invoke('items:update'),
    delete: invoke('items:delete')
  },
  stock: {
    adjust: invoke('stock:adjust'),
    adjustments: invoke('stock:adjustments')
  },
  purchase: {
    create: invoke('purchase:create'),
    list: invoke('purchase:list'),
    items: invoke('purchase:items'),
    get: invoke('purchase:get'),
    update: invoke('purchase:update'),
    delete: invoke('purchase:delete')
  },
  sell: {
    nextInvoiceNo: invoke('sell:nextInvoiceNo'),
    checkStock: invoke('sell:checkStock'),
    checkStockForEdit: invoke('sell:checkStockForEdit'),
    create: invoke('sell:create'),
    update: invoke('sell:update'),
    delete: invoke('sell:delete'),
    get: invoke('sell:get'),
    list: invoke('sell:list'),
    items: invoke('sell:items'),
    generateInvoicePdf: invoke('sell:generateInvoicePdf')
  },
  pnl: {
    report: invoke('pnl:report')
  },
  customers: {
    list: invoke('customers:list'),
    get: invoke('customers:get'),
    add: invoke('customers:add'),
    update: invoke('customers:update'),
    delete: invoke('customers:delete'),
    history: invoke('customers:history'),
    amcDue: invoke('customers:amcDue')
  },
  dues: {
    summary: invoke('dues:summary'),
    forCustomer: invoke('dues:forCustomer'),
    recordPayment: invoke('dues:recordPayment')
  },
  installations: {
    create: invoke('installations:create'),
    upcoming: invoke('installations:upcoming'),
    forCustomer: invoke('installations:forCustomer'),
    markReminderSent: invoke('installations:markReminderSent'),
    markServiced: invoke('installations:markServiced')
  },
  whatsapp: {
    openChat: invoke('whatsapp:openChat')
  },
  invoices: {
    revealFolder: invoke('invoices:revealFolder')
  },
  service: {
    list: invoke('service:list'),
    create: invoke('service:create'),
    updateStatus: invoke('service:updateStatus')
  },
  settings: {
    get: invoke('settings:get'),
    set: invoke('settings:set')
  },
  users: {
    list: invoke('users:list'),
    add: invoke('users:add')
  },
  db: {
    export: invoke('db:export'),
    import: invoke('db:import')
  },
  importData: {
    items: invoke('import:items'),
    customers: invoke('import:customers')
  },
  expenses: {
    create: invoke('expenses:create'),
    list: invoke('expenses:list'),
    update: invoke('expenses:update'),
    delete: invoke('expenses:delete'),
    summary: invoke('expenses:summary')
  }
});
