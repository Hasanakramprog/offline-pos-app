'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  database: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run:   (sql, params) => ipcRenderer.invoke('db:run',   sql, params),
    exec:  (sql)         => ipcRenderer.invoke('db:exec',  sql),
  },
  file: {
    backup: () => ipcRenderer.invoke('file:backup'),
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
    getPrinters: () => ipcRenderer.invoke('print:getPrinters'),
  },
});
