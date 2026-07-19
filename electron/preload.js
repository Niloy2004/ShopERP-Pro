const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
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
    ledger: invoke('vendors:ledger')
  },
  items: {
    list: invoke('items:list'),
    add: invoke('items:add'),
    update: invoke('items:update')
  },
  stock: {
    adjust: invoke('stock:adjust'),
    adjustments: invoke('stock:adjustments')
  },
  purchase: {
    create: invoke('purchase:create'),
    list: invoke('purchase:list'),
    items: invoke('purchase:items')
  },
  sell: {
    nextInvoiceNo: invoke('sell:nextInvoiceNo'),
    checkStock: invoke('sell:checkStock'),
    create: invoke('sell:create'),
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
  }
});
