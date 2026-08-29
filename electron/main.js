const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const CertdDatabase = require('./db')
const AcmeService = require('./services/acme-service')
const SshService = require('./services/ssh-service')
const CertService = require('./services/cert-service')
const AutoRenewService = require('./services/auto-renew-service')
const LicenseService = require('./services/license-service')
const {
  getProviderCredentials,
  saveProviderCredentials
} = require('./services/dns-provider-credentials')
// const Store = require('electron-store') // Removed

// ==================== 状态维护 ====================
let mainWindow
let certdDB
let currentUser = null // 当前登录用户信息

/**
 * 获取基于用户的本地存储 (支持账号隔离)
 */
async function getUserStore() {
  const { default: Store } = await import('electron-store')
  const userId = currentUser?.id?.toString() || 'default'
  return new Store({ name: `config-${userId}` })
}

// 存储 IPC
ipcMain.handle('profile:get-all', async () => {
  const store = await getUserStore()
  const userId = currentUser?.id?.toString() || 'default'
  const verifiedProfiles = certdDB?.getLatestCertApplyConfigs(userId) || []
  return verifiedProfiles.length > 0 ? verifiedProfiles : store.get('accessProfiles', [])
})

ipcMain.handle('profile:get-by-provider', async (event, provider) => {
  const store = await getUserStore()
  const userId = currentUser?.id?.toString() || 'default'
  const fallbackConfig = certdDB?.getLatestCertApplyConfigByProvider(provider, userId)
  return getProviderCredentials(store, provider, fallbackConfig)
})

ipcMain.handle('profile:save', async (event, profile) => {
  const store = await getUserStore()
  const profiles = store.get('accessProfiles', [])
  // 简单的去重/更新逻辑
  const index = profiles.findIndex(p => p.accessKeyId === profile.accessKeyId)
  if (index > -1) {
    profiles[index] = { ...profiles[index], ...profile }
  } else {
    profiles.push(profile)
  }
  store.set('accessProfiles', profiles)
  saveProviderCredentials(store, profile)
  return true
})

ipcMain.handle('profile:save-draft', async (event, draft) => {
  const store = await getUserStore()
  store.set('applyFormDraft', draft)
  return true
})

ipcMain.handle('profile:get-draft', async () => {
  const store = await getUserStore()
  return store.get('applyFormDraft', null)
})

// 授权管理 IPC
ipcMain.handle('license:init', async (event, token) => {
  return await LicenseService.init(token)
})

ipcMain.handle('license:get', async () => {
  return LicenseService.getLicense()
})

ipcMain.handle('license:activate', async (event, key) => {
  return await LicenseService.activate(key)
})

ipcMain.handle('license:refresh', async () => {
  return await LicenseService.checkDeviceLicense()
})

ipcMain.handle('license:get-machine-id', async () => {
  return LicenseService.getMachineId()
})

// 文件选择对话框
ipcMain.handle('dialog:open-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  if (result.canceled) {
    return null
  }
  return result.filePaths
})

// 安全的日志函数
function safeLog(...args) {
  try {
    console.log(...args)
  } catch (err) {
    // 忽略 EPIPE 错误
  }
}

// 捕获未处理的错误
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE') {
    return
  }
  try {
    console.error('Uncaught Exception:', error)
  } catch (e) {
    // 静默处理
  }
})

process.on('unhandledRejection', (reason) => {
  try {
    console.error('Unhandled Rejection:', reason)
  } catch (e) {
    // 静默处理
  }
})

// 初始化数据库
function initDatabase() {
  certdDB = new CertdDatabase()
  safeLog('✅ Database initialized')
}

// 应用退出时关闭数据库
app.on('will-quit', () => {
  if (certdDB) {
    certdDB.close()
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    },
    title: 'AutoSSL - 证书管理客户端',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png')
  })

  // 设置 Dock 图标 (MacOS)
  if (process.platform === 'darwin') {
    try {
      const iconPath = path.join(__dirname, '../build/icon.png')
      app.dock.setIcon(iconPath)
    } catch (err) {
      console.error('Failed to set dock icon:', err)
    }
  }

  // 开发环境加载 Vite 服务器，打包后加载本地文件
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:6173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err)
    })
  }

  // 安全：阻止导航到外部 URL
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    if (!app.isPackaged) {
      if (!parsedUrl.protocol.startsWith('http') && parsedUrl.protocol !== 'file:') {
        safeLog('Blocked navigation to:', navigationUrl)
        event.preventDefault()
      }
    } else {
      if (parsedUrl.protocol !== 'file:') {
        safeLog('Blocked navigation to:', navigationUrl)
        event.preventDefault()
      }
    }
  })

  // 安全：阻止新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeLog('Blocked window.open to:', url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    // 先初始化数据库
    initDatabase()

    // 再创建窗口
    createWindow()

    // 初始化自动续期服务
    AutoRenewService.init(certdDB, AcmeService, SshService, () => currentUser?.id?.toString() || 'default')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error('Failed to initialize application:', error)
    dialog.showErrorBox(
      'AutoSSL 启动失败',
      error?.message || '应用初始化失败，请检查数据库或原生依赖配置。'
    )
    app.quit()
  }
})

// IPC: 手动触发证书续期检查
ipcMain.handle('cert:check-renew', async () => {
  const userId = currentUser?.id?.toString() || 'default'
  await AutoRenewService.manualCheck(userId)
  return { success: true }
})

ipcMain.handle('auto-renew:check', async () => {
  const userId = currentUser?.id?.toString() || 'default'
  return await AutoRenewService.manualCheck(userId)
})

ipcMain.handle('auto-renew:renew-cert', async (event, certId) => {
  const userId = currentUser?.id?.toString() || 'default'
  return await AutoRenewService.renewNow(certId, userId, currentUser?.email || '', (progress) => {
    event.sender.send('auto-renew:progress', progress)
  })
})

ipcMain.handle('auto-renew:last-run', () => {
  return AutoRenewService.getLastRunTime()
})

// 获取申请日志
ipcMain.handle('log:get-apply', (event, limit) => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getApplyLogs(limit, userId)
})

// 获取审计日志
ipcMain.handle('log:audit', (event, limit) => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getAuditLogs(limit, userId)
})

// 用户会话管理
ipcMain.handle('user:set-session', (event, user) => {
  currentUser = user
  if (certdDB && user?.id && user.id.toString() !== 'admin') {
    const userId = user.id.toString()
    certdDB.claimLegacyData(userId)
  }
  safeLog('👤 Current user session set:', user?.email || 'None')
  return true
})

ipcMain.handle('user:get-local-data-summary', () => {
  if (!certdDB) return { hasData: false, total: 0 }
  return certdDB.getLocalAdminDataSummary()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ==================== 服务器管理 ====================

ipcMain.handle('server:save', async (event, server) => {
  if (!certdDB) return false
  try {
    const userId = currentUser?.id?.toString() || 'default'

    const ownerUserId = server.id ? certdDB.getServerOwner(server.id) : null
    if (ownerUserId && ownerUserId !== userId) {
      return { success: false, error: '该服务器ID已被其他账户占用' }
    }

    // 如果是新创建服务器（没有ID或检查是否存在）
    let isNew = true;
    if (server.id) {
      const existing = certdDB.getServer(server.id, userId);
      if (existing) {
        isNew = false;
      }
    }

    if (isNew) {
      // 权限检查 (基于创建历史)
      const serverUsage = certdDB.getServerUsageCount(userId);
      const canAdd = await LicenseService.checkConstraint('max_servers', serverUsage);
      if (!canAdd) {
        return { success: false, error: '当前套餐服务器创建数量已达上限 (包含已删除历史)，请升级专业版' };
      }
    }

    // 生成 ID (如果是新)
    if (!server.id) {
      server.id = Date.now().toString();
    }

    certdDB.saveServer(server, userId)

    // 如果是新创建，记录日志
    if (isNew) {
      certdDB.addServerCreationLog(server, userId);
    }

    return { success: true }
  } catch (error) {
    safeLog('Save server error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('server:get', (event, id) => {
  if (!certdDB) return null
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getServer(id, userId)
})

ipcMain.handle('server:get-all', () => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getAllServers(userId)
})

ipcMain.handle('server:delete', (event, id) => {
  if (!certdDB) return false
  const userId = currentUser?.id?.toString() || 'default'

  // 先获取信息用于日志
  const server = certdDB.getServer(id, userId)
  const result = certdDB.deleteServer(id, userId)

  if (result && server) {
    certdDB.addAuditLog({
      action: 'delete',
      targetType: 'server',
      targetName: server.name,
      details: `删除服务器: ${server.name} (${server.host})`
    }, userId)
  }

  return result
})

ipcMain.handle('server:test-connection', async (event, server) => {
  try {
    return await SshService.testConnection(server)
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ==================== 证书管理 ====================

ipcMain.handle('cert:save', async (event, cert) => {
  if (!certdDB) return false
  try {
    const userId = currentUser?.id?.toString() || 'default'
    const ownerUserId = cert.id ? certdDB.getCertOwner(cert.id) : null
    if (ownerUserId && ownerUserId !== userId) {
      return { success: false, error: '该证书ID已被其他账户占用' }
    }
    // 检查是否已存在
    const existing = certdDB.getCert(cert.id, userId);
    if (!existing) {
      const currentCertCount = certdDB.getAllCerts(userId).length;
      const canAdd = await LicenseService.checkConstraint('max_certs', currentCertCount);
      if (!canAdd) {
        return { success: false, error: '当前套餐证书数量已达上限，请升级专业版' };
      }
    }

    certdDB.saveCert(cert, userId)
    return { success: true }
  } catch (error) {
    safeLog('Save cert error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('cert:get', (event, id) => {
  if (!certdDB) return null
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getCert(id, userId)
})

ipcMain.handle('cert:get-all', () => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getAllCerts(userId)
})

ipcMain.handle('cert:get-expiring', (event, days) => {
  if (!certdDB) return []
  // 注意：getExpiringCerts 内部目前没过滤 userId，需要补上
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getExpiringCerts(days || 30, userId)
})

ipcMain.handle('cert:delete', (event, id) => {
  if (!certdDB) return { success: false, error: 'Database not initialized' }
  const userId = currentUser?.id?.toString() || 'default'

  // 先获取信息用于日志
  const cert = certdDB.getCert(id, userId)
  if (!cert) {
    return { success: false, error: '证书不存在' }
  }

  if (!cert.expiresTime || cert.expiresTime > Date.now()) {
    return { success: false, error: '生效中的证书不允许删除，只有已过期证书才可以删除' }
  }

  const result = certdDB.deleteCert(id, userId)

  if (result && cert) {
    certdDB.addAuditLog({
      action: 'delete',
      targetType: 'certificate',
      targetName: cert.domain,
      details: `删除证书: ${cert.domain}`
    }, userId)
  }

  return { success: result, error: result ? null : '删除操作失败' }
})

ipcMain.handle('cert:get-config', (event, domain) => {
  if (!certdDB) return null
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getCertApplyConfigByDomain(domain, userId)
})

// 获取证书部署的服务器列表
ipcMain.handle('cert:get-deployed-servers', (event, certId) => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getCertDeployedServers(certId, userId)
})

// 添加证书-服务器部署关联
ipcMain.handle('cert:add-deployment', (event, certId, serverId, certPath, keyPath, passphrase) => {
  if (!certdDB) return { success: false }
  try {
    const userId = currentUser?.id?.toString() || 'default'
    if (!certPath || !keyPath) {
      return { success: false, error: '证书路径和私钥路径不能为空' }
    }
    certdDB.addCertServerDeployment(certId, serverId, certPath, keyPath, passphrase, userId)
    return { success: true }
  } catch (error) {
    safeLog('Add deployment error:', error)
    return { success: false, error: error.message }
  }
})

// 删除证书-服务器部署关联
ipcMain.handle('cert:remove-deployment', (event, certId, serverId) => {
  if (!certdDB) return { success: false }
  try {
    const userId = currentUser?.id?.toString() || 'default'
    const result = certdDB.removeCertServerDeployment(certId, serverId, userId)
    return { success: result }
  } catch (error) {
    safeLog('Remove deployment error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('cert:check-expiry', (event, certId) => {
  if (!certdDB) return null
  const userId = currentUser?.id?.toString() || 'default'
  const cert = certdDB.getCert(certId, userId)
  if (!cert) return null

  return CertService.checkExpiry(cert)
})

// ==================== 证书申请 ====================

ipcMain.handle('acme:apply', async (event, { domain, email, dnsProvider }) => {
  let applyStage = '初始化申请'
  try {
    const userId = currentUser?.id?.toString() || 'default'
    // 权限检查：按当前已保存证书数量计算
    applyStage = '检查证书配额'
    const currentCertCount = certdDB.getAllCerts(userId).length;
    const canApply = await LicenseService.checkConstraint('max_certs', currentCertCount);
    if (!canApply) {
      return { success: false, error: '当前套餐证书数量已达上限，请删除不用的证书或升级专业版' };
    }

    applyStage = '加载本地申请配置'
    const store = await getUserStore()

    // 1. 确保有持久化的 ACME 账户密钥（防止 429 报错）
    applyStage = '准备 ACME 账户密钥'

    // @certd/basic 默认把日志写入相对路径 ./logs/app.log。
    // macOS 从 Finder 启动时工作目录可能是 /，会触发 streamroller 的
    // mkdir 递归并最终报 Maximum call stack size exceeded。
    const userDataPath = app.getPath('userData')
    fs.mkdirSync(path.join(userDataPath, 'logs'), { recursive: true })
    process.chdir(userDataPath)

    let acmeAccount = store.get('acmeAccount', null)
    if (!acmeAccount || !acmeAccount.key) {
      safeLog('Generating initial ACME account key...')
      const acme = await import('@certd/acme-client')
      const key = await acme.crypto.createPrivateKey()
      acmeAccount = { key: key.toString(), url: null }
      store.set('acmeAccount', acmeAccount)
    }

    // 2. 调用申请服务
    applyStage = '执行 ACME 证书申请'
    const result = await AcmeService.applyCert(domain, email, dnsProvider, (progress) => {
      event.sender.send('acme:progress', progress)
    }, acmeAccount)

    // 3. 更新账户信息（主要是关联已注册的 Account URL）
    if (result.updatedAccount) {
      store.set('acmeAccount', { ...acmeAccount, ...result.updatedAccount })
      safeLog('ACME account URL updated and saved')
    }

    // 1. 先将证书存入证书库
    certdDB.saveCert({
      id: result.certId,
      domain,
      crt: result.data.crt,
      key: result.data.key,
      expiresTime: result.data.expires
    }, userId)
    safeLog('Certificate saved to local database')

    // 2. 再保存申请日志 (这会增加 getCertUsageCount)
    certdDB.addApplyLog({
      id: Date.now().toString(),
      domain,
      status: 'success',
      message: '证书申请成功'
    }, userId)

    // 3. 最后保存申请配置，用于后期自动续期
    if (result.certId) {
      certdDB.saveCertApplyConfig({
        certId: result.certId,
        domain,
        email,
        provider: dnsProvider.type,
        accessKeyId: dnsProvider.accessKeyId,
        accessKeySecret: dnsProvider.accessKeySecret
      }, userId)
      safeLog('Certificate apply config saved for auto-renewal')

      const mergeResult = certdDB.mergeDuplicateCertsByDomain(domain, result.certId, userId)
      if (mergeResult.removedCerts > 0) {
        safeLog(`Merged ${mergeResult.removedCerts} duplicate certificate record(s) for ${domain}`)
      }

      // 4. 同步配置到云端
      LicenseService.syncCertConfig({
        domain,
        email,
        provider: dnsProvider.type
      }).then(res => {
        if (res.success) safeLog('✅ Certificate config synced to cloud')
      }).catch(e => {
        safeLog('❌ Cloud sync failed:', e.message)
      })

      // 5. 上报证书申请记录到云端
      LicenseService.report(domain, true, '证书申请成功').catch(() => { });
    }

    return { success: true, data: result, message: result.message || '证书申请成功' }
  } catch (error) {
    const errorMessage = error?.message || String(error)
    const errorStack = error?.stack || ''
    const detailedError = `[${applyStage}] ${errorMessage}`
    safeLog('Apply cert error:', detailedError)
    if (errorStack) safeLog(errorStack)

    // 保存错误日志 (失败不计入 quota)
    if (certdDB) {
      const userId = currentUser?.id?.toString() || 'default'
      certdDB.addApplyLog({
        id: Date.now().toString(),
        domain,
        status: 'error',
        message: `${detailedError}${errorStack ? `\n${errorStack}` : ''}`
      }, userId)
    }

    return { success: false, error: detailedError }
  }
})

// ==================== 证书部署 ====================

ipcMain.handle('deploy:cert', async (event, certId, serverId, certPath, keyPath, passphrase) => {
  if (!certdDB) {
    return { success: false, error: 'Database not initialized' }
  }

  try {
    const userId = currentUser?.id?.toString() || 'default'
    const cert = certdDB.getCert(certId, userId)
    const server = certdDB.getServer(serverId, userId)

    if (!cert) {
      throw new Error('证书不存在')
    }
    if (!server) {
      throw new Error('服务器不存在')
    }

    // 使用传入的路径和密码，如果没有则从部署关联中获取
    let deployCertPath = certPath
    let deployKeyPath = keyPath
    let deployPassphrase = passphrase

    if (!deployCertPath || !deployKeyPath) {
      const deployedServers = certdDB.getCertDeployedServers(certId, userId)
      const deployment = deployedServers.find(d => d.id === serverId)
      if (deployment) {
        if (!deployCertPath) deployCertPath = deployment.certPath
        if (!deployKeyPath) deployKeyPath = deployment.keyPath
        if (!deployPassphrase) deployPassphrase = deployment.passphrase
      }
    }

    if (!deployCertPath || !deployKeyPath) {
      throw new Error('未指定证书路径或私钥路径')
    }

    // 创建临时部署配置
    const deployServer = {
      ...server,
      certPath: deployCertPath,
      keyPath: deployKeyPath,
      passphrase: deployPassphrase
    }

    // 调试日志
    safeLog('Deploying to server:', server.name, {
      hasPassword: !!server.password,
      hasPrivateKey: !!server.privateKey,
      hasPrivateKeyPath: !!server.privateKeyPath,
      hasPassphrase: !!deployPassphrase
    })

    // 部署证书
    const result = await SshService.deployCert(deployServer, cert)

    // 保存部署日志
    const deployedMessage = result?.paths
      ? `部署成功: ${server.name}${result.paths.certPath ? ` | cert=${result.paths.certPath}` : ''}${result.paths.keyPath ? ` | key=${result.paths.keyPath}` : ''}`
      : `部署成功: ${server.name}`

    certdDB.addDeployLog({
      id: Date.now().toString(),
      certId,
      serverId,
      status: 'success',
      message: deployedMessage
    }, userId)

    // 上报部署成功
    LicenseService.report(cert.domain, true, deployedMessage).catch(() => { });

    return { success: true, data: result, message: deployedMessage }
  } catch (error) {
    safeLog('Deploy cert error:', error)

    // 保存错误日志
    if (certdDB) {
      const userId = currentUser?.id?.toString() || 'default'
      certdDB.addDeployLog({
        id: Date.now().toString(),
        certId,
        serverId,
        status: 'error',
        message: error.message
      }, userId)
    }

    return { success: false, error: error.message }
  }
})

// ==================== 日志查询 ====================

ipcMain.handle('log:apply', (event, limit) => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getApplyLogs(limit || 50, userId)
})

ipcMain.handle('log:deploy', (event, limit, certId) => {
  if (!certdDB) return []
  const userId = currentUser?.id?.toString() || 'default'
  return certdDB.getDeployLogs(limit || 50, userId, certId || null)
})

// ==================== 退出应用 ====================

ipcMain.handle('quit-app', () => {
  app.quit()
})

ipcMain.handle('close-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }
})

// ==================== 文件/目录选择对话框 ====================

ipcMain.handle('dialog:select-path', async (event, options) => {
  try {
    const { type = 'directory', title = '选择路径', defaultPath } = options || {}

    const dialogOptions = {
      title,
      defaultPath: defaultPath || app.getPath('home'),
      properties: []
    }

    if (type === 'directory') {
      // 选择目录模式：允许选择目录，选择后直接返回目录路径
      dialogOptions.properties.push('openDirectory')
    } else if (type === 'file') {
      // 选择文件模式
      dialogOptions.properties.push('openFile')
      if (options.filters) {
        dialogOptions.filters = options.filters
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, dialogOptions)

    if (result.canceled) {
      return { success: false, canceled: true }
    }

    const selectedPath = result.filePaths[0] || null

    // 直接返回选择的路径（无论是目录还是文件）
    return {
      success: true,
      path: selectedPath
    }
  } catch (error) {
    safeLog('Dialog select path error:', error)
    return { success: false, error: error.message }
  }
})

safeLog('✅ Electron main process initialized')
