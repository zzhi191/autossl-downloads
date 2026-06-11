/**
 * Electron Preload Script
 * 安全地暴露 Node.js API 给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // IPC 通信
  ipcRenderer: {
    invoke: (channel, ...args) => {
      // 白名单允许的 IPC 通道
      const allowedChannels = [
        'admin:login',
        'server:save',
        'server:get',
        'server:get-all',
        'server:delete',
        'server:test-connection',
        'cert:save',
        'cert:get',
        'cert:get-all',
        'cert:get-expiring',
        'cert:delete',
        'cert:check-expiry',
        'cert:get-config',
        'acme:apply',
        'cert:add-deployment',
        'cert:remove-deployment',
        'deploy:cert',
        'log:apply',
        'log:deploy',
        'dialog:open-file',
        'dialog:select-path',
        'profile:get-all',
        'profile:save',
        'profile:save-draft',
        'profile:get-draft',
        'license:init',
        'license:get',
        'license:activate',
        'license:refresh',
        'license:get-machine-id',
        'auto-renew:check',
        'auto-renew:renew-cert',
        'auto-renew:last-run',
        'log:get-apply',
        'user:set-session',
        'quit-app',
        'close-window'
      ]
      if (allowedChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args)
      }
      throw new Error(`IPC channel "${channel}" is not allowed`)
    },
    on: (channel, func) => {
      const allowedEvents = ['acme:progress']
      if (allowedEvents.includes(channel)) {
        const subscription = (event, ...args) => func(...args)
        ipcRenderer.on(channel, subscription)
        return () => ipcRenderer.removeListener(channel, subscription)
      }
    }
  },

  // 系统信息
  platform: process.platform,
  version: process.version
})

console.log('✓ Preload script loaded successfully')
