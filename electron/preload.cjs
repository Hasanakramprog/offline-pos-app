'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  database: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run:   (sql, params) => ipcRenderer.invoke('db:run',   sql, params),
    exec:  (sql)         => ipcRenderer.invoke('db:exec',  sql),
  },
  file: {
    backup:  () => ipcRenderer.invoke('file:backup'),
    restore: () => ipcRenderer.invoke('file:restore'),
  },
  system: {
    getAppVersion: () => ipcRenderer.invoke('system:version'),
    getUserData:   () => ipcRenderer.invoke('system:userData'),
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },
  hardware: {
    openDrawer: (printerName) => ipcRenderer.invoke('hardware:open-drawer', printerName),
  },
  print: {
    receipt: (html, printerName) => ipcRenderer.invoke('print:receipt', html, printerName),
    pdf: (html) => ipcRenderer.invoke('print:pdf', html),
    getPrinters: () => ipcRenderer.invoke('print:getPrinters'),
  },
  sync: {
    getStatus:  ()           => ipcRenderer.invoke('sync:status'),
    configure:  (url, key)   => ipcRenderer.invoke('sync:configure', url, key),
    flushNow:   ()           => ipcRenderer.invoke('sync:flush'),
  },
});
