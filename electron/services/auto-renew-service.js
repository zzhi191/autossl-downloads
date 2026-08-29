/**
 * 自动续期服务
 * 每天检测证书过期时间，小于10天自动申请并部署
 */

const { app, Notification } = require('electron')
const fs = require('fs')
const path = require('path')
const psl = require('psl')

const LicenseService = require('./license-service')

// 续期阈值（天）
const RENEW_THRESHOLD_DAYS = 10

// 检查间隔（毫秒）- 24小时
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

let checkTimer = null
let certdDB = null
let AcmeService = null
let SshService = null
let lastRunTime = null
let resolveCurrentUserId = null

function normalizeTimestampMs(value) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  return timestamp < 1e12 ? timestamp * 1000 : timestamp
}

function isProLicense(license) {
  return Boolean(license && license.plan && license.plan !== 'free')
}

function getRegistrableDomain(domain) {
  if (!domain) return null
  const parsed = psl.parse(domain)
  return parsed.domain || domain
}

function hasUsableDnsProvider(config) {
  return Boolean(
    config &&
    config.provider &&
    config.accessKeyId &&
    config.accessKeySecret
  )
}

function normalizeRecoveredConfig(rawConfig, targetDomain, fallbackEmail) {
  if (!rawConfig) return null

  const provider = rawConfig.provider || rawConfig.type || rawConfig.dnsProvider?.type
  const accessKeyId = rawConfig.accessKeyId || rawConfig.dnsProvider?.accessKeyId
  const accessKeySecret = rawConfig.accessKeySecret || rawConfig.dnsProvider?.accessKeySecret
  const email = rawConfig.email || fallbackEmail || ''

  if (!provider || !accessKeyId || !accessKeySecret) {
    return null
  }

  return {
    domain: targetDomain,
    email,
    provider,
    accessKeyId,
    accessKeySecret
  }
}

function appendConfigCandidate(candidates, config, source, score) {
  if (!hasUsableDnsProvider(config)) return

  const candidate = {
    ...config,
    source,
    score
  }
  const dedupeKey = [
    candidate.provider,
    candidate.accessKeyId,
    candidate.accessKeySecret,
    candidate.email || ''
  ].join('::')

  const existing = candidates.findIndex(item => item.dedupeKey === dedupeKey)
  if (existing >= 0) {
    if (score > candidates[existing].score) {
      candidates[existing] = { ...candidate, dedupeKey }
    }
    return
  }

  candidates.push({ ...candidate, dedupeKey })
}

async function recoverApplyConfigsFromStore(domain, userId = 'default', fallbackEmail = '') {
  const { default: Store } = await import('electron-store')
  const targetRootDomain = getRegistrableDomain(domain)
  const storeNames = []

  if (userId) {
    storeNames.push(`config-${userId}`)
  }
  storeNames.push('config')

  const seenNames = new Set()
  const candidates = []

  storeNames.forEach((storeName, index) => {
    if (!storeName || seenNames.has(storeName)) return
    seenNames.add(storeName)

    const store = new Store({ name: storeName })
    const draft = store.get('applyFormDraft')
    const normalizedDraft = normalizeRecoveredConfig(draft, domain, fallbackEmail)

    if (normalizedDraft) {
      const draftDomain = draft?.domain || ''
      const draftRootDomain = getRegistrableDomain(draftDomain)
      const exactMatch = draftDomain === domain
      const rootMatch = draftRootDomain && targetRootDomain && draftRootDomain === targetRootDomain

      if (exactMatch || rootMatch) {
        appendConfigCandidate(
          candidates,
          normalizedDraft,
          `store:${storeName}:draft`,
          (exactMatch ? 100 : 50) - index
        )
      }
    }

    const profiles = store.get('accessProfiles', [])
    if (Array.isArray(profiles)) {
      profiles.forEach((profile, profileIndex) => {
        const normalizedProfile = normalizeRecoveredConfig(profile, domain, fallbackEmail)
        if (normalizedProfile) {
          appendConfigCandidate(
            candidates,
            normalizedProfile,
            `store:${storeName}:profile:${profileIndex}`,
            10 - index - (profileIndex / 100)
          )
        }
      })
    }
  })

  if (candidates.length === 0) {
    return []
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.map(({ dedupeKey, score, ...candidate }) => candidate)
}

function isDomainMismatchError(error) {
  const errorText = `${error?.code || ''} ${error?.message || ''}`
  return [
    'InvalidDomainName.NoExistError',
    'The specified domain name does not exist',
    'DomainNotFound',
    'NoExist'
  ].some(token => errorText.includes(token))
}

function emitProgress(onProgress, step, status, message) {
  try {
    onProgress({ step, status, message })
  } catch (error) {
    console.warn('[Auto-Renew] Progress callback failed:', error.message)
  }
}

function prepareAcmeRuntime() {
  // @certd/basic writes logs to ./logs/app.log. Finder-launched apps can start
  // from /, where streamroller recursively retries creating its log directory.
  const userDataPath = app.getPath('userData')
  fs.mkdirSync(path.join(userDataPath, 'logs'), { recursive: true })
  process.chdir(userDataPath)
}

/**
 * 初始化自动续期服务
 */
function getCurrentUserId() {
  const userId = resolveCurrentUserId ? resolveCurrentUserId() : null
  return userId ? userId.toString() : 'default'
}

function init(db, acme, ssh, getCurrentUserIdFn) {
  certdDB = db
  AcmeService = acme
  SshService = ssh
  resolveCurrentUserId = typeof getCurrentUserIdFn === 'function' ? getCurrentUserIdFn : null

  // 应用启动时立即检查一次
  setTimeout(() => {
    checkAndRenew(getCurrentUserId())
  }, 10000) // 延迟10秒，等待应用完全启动

  // 每24小时检查一次
  checkTimer = setInterval(() => {
    checkAndRenew(getCurrentUserId())
  }, CHECK_INTERVAL_MS)

  console.log('✅ Auto-renew service initialized')
}

/**
 * 停止自动续期服务
 */
function stop() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  console.log('Auto-renew service stopped')
}

/**
 * 检查并续期
 */
async function checkAndRenew(userId = 'default') {
  lastRunTime = Date.now()
  if (!certdDB) {
    console.error('Auto-renew: Database not initialized')
    return
  }

  console.log('[Auto-Renew] Starting certificate expiry check...')

  // 0. 权限检查
  const license = LicenseService.getLicense()
  const isPro = isProLicense(license)
  if (!isPro) {
    console.log('[Auto-Renew] 当前为免费版，仅执行过期检测，不执行自动续期')
  }

  try {
    const certs = certdDB.getAllCerts(userId)
    const now = Date.now()

    for (const cert of certs) {
      const expiresTime = normalizeTimestampMs(cert.expiresTime)
      if (!expiresTime) continue

      const remainingMs = expiresTime - now
      const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000))

      console.log(`[Auto-Renew] ${cert.domain}: ${remainingDays} days remaining`)

      if (remainingDays <= RENEW_THRESHOLD_DAYS && remainingDays > 0) {
        console.log(`[Auto-Renew] ${cert.domain} needs renewal (${remainingDays} days left)`)
        if (isPro) {
          await renewCertificate(cert, userId)
        } else {
          showNotification('证书即将过期', `${cert.domain} 还有 ${remainingDays} 天过期，请手动续期或升级专业版。`)
        }
      }
    }

    console.log('[Auto-Renew] Check completed')
  } catch (error) {
    console.error('[Auto-Renew] Error:', error)
    showNotification('证书续期检查失败', error.message)
  }
}

/**
 * 续期单个证书
 */
async function renewCertificate(cert, userId = 'default', options = {}) {
  const { manual = false, fallbackEmail = '', onProgress = () => {} } = options
  const domain = cert.domain

  try {
    emitProgress(onProgress, 'init', 'processing', `正在准备续期 ${domain}...`)
    const applyConfigCandidates = []
    appendConfigCandidate(
      applyConfigCandidates,
      certdDB.getCertApplyConfig(cert.id, userId),
      'db:cert',
      1000
    )
    appendConfigCandidate(
      applyConfigCandidates,
      certdDB.getCertApplyConfigByDomain(domain, userId),
      'db:domain',
      900
    )

    const recoveredConfigs = await recoverApplyConfigsFromStore(domain, userId, fallbackEmail)
    recoveredConfigs.forEach((config, index) => {
      appendConfigCandidate(applyConfigCandidates, config, config.source, 800 - index)
    })

    const candidates = applyConfigCandidates
      .sort((a, b) => b.score - a.score)
      .map(({ dedupeKey, score, ...candidate }) => candidate)

    if (candidates.length === 0) {
      if (manual) {
        throw new Error('未找到该证书的申请配置，请先重新申请一次证书。')
      }

      const expiresTime = normalizeTimestampMs(cert.expiresTime)
      console.log(`[Auto-Renew] No apply config found for ${domain}, sending notification only`)
      showNotification('证书即将过期',
        `${domain} 将在 ${Math.floor((expiresTime - Date.now()) / (24 * 60 * 60 * 1000))} 天后过期。\n由于没有保存的申请配置，请手动重新申请。`)
      return
    }

    showNotification('证书自动续期开始', `正在为 ${domain} 自动续期证书...`)
    console.log(`[Auto-Renew] Starting automatic renewal for ${domain}`)
    emitProgress(onProgress, 'init', 'processing', '正在加载证书申请配置...')

    prepareAcmeRuntime()
    const { default: Store } = await import('electron-store')
    const store = new Store({ name: `config-${userId}` })
    const acmeAccount = store.get('acmeAccount')
    let applyConfig = null
    let applyEmail = ''
    let result = null
    let lastError = null

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]
      const candidateEmail = candidate.email || fallbackEmail
      if (!candidateEmail) {
        lastError = new Error('未找到证书申请邮箱，请先在证书管理中重新申请一次证书。')
        continue
      }

      const dnsProvider = {
        type: candidate.provider,
        accessKeyId: candidate.accessKeyId,
        accessKeySecret: candidate.accessKeySecret
      }

      try {
        console.log(`[Auto-Renew] Trying apply config from ${candidate.source || 'unknown'} using provider ${candidate.provider}`)
        emitProgress(onProgress, 'init', 'processing', `正在使用 ${candidate.provider} 重新申请证书...`)
        result = await AcmeService.applyCert(
          domain,
          candidateEmail,
          dnsProvider,
          (progress) => {
            console.log(`[Auto-Renew] ${domain} - ${progress.step}: ${progress.message}`)
            emitProgress(onProgress, progress.step, progress.status, progress.message)
          },
          acmeAccount
        )

        if (!result.success) {
          throw new Error(result.message || '证书申请失败')
        }

        applyConfig = candidate
        applyEmail = candidateEmail
        break
      } catch (error) {
        lastError = error
        if (isDomainMismatchError(error) && index < candidates.length - 1) {
          console.warn(`[Auto-Renew] Provider ${candidate.provider} does not host ${domain}, trying next config`)
          continue
        }
        throw error
      }
    }

    if (!result || !applyConfig) {
      throw lastError || new Error('证书申请失败')
    }

    console.log(`[Auto-Renew] Certificate renewed for ${domain}`)
    emitProgress(onProgress, 'success', 'success', '证书续期签发成功，正在更新本地证书库...')

    // 4. 更新证书记录
    const newCert = {
      id: cert.id, // 保持原 ID
      domain: domain,
      crt: result.data.crt,
      key: result.data.key,
      expiresTime: normalizeTimestampMs(result.data.expires),
      applyTime: Date.now(),
      status: 'valid'
    }
    certdDB.saveCert(newCert, userId)

    // 5. 更新申请配置关联
    certdDB.saveCertApplyConfig({
      certId: cert.id,
      domain: domain,
      email: applyEmail,
      provider: applyConfig.provider,
      accessKeyId: applyConfig.accessKeyId,
      accessKeySecret: applyConfig.accessKeySecret
    }, userId)

    const mergeResult = certdDB.mergeDuplicateCertsByDomain(domain, cert.id, userId)
    if (mergeResult.removedCerts > 0) {
      console.log(`[Auto-Renew] Merged ${mergeResult.removedCerts} duplicate certificate record(s) for ${domain}`)
    }

    // 6. 自动部署到所有已配置的服务器
    await deployToAllServers(cert.id, newCert, userId, onProgress)

    certdDB.addApplyLog({
      id: Date.now().toString(),
      domain: domain,
      status: 'success',
      message: '自动续期成功'
    }, userId)

    showNotification('证书自动续期成功', `${domain} 已自动续期并部署到所有服务器`)
    emitProgress(onProgress, 'done', 'success', '续期流程完成。')

    // 7. 上报续期成功到云端
    LicenseService.report(domain, true, '自动续期成功').catch(() => { });

  } catch (error) {
    console.error(`[Auto-Renew] Failed to renew ${domain}:`, error)
    emitProgress(onProgress, 'error', 'error', `续期失败: ${error.message}`)
    showNotification('证书自动续期失败', `${domain}: ${error.message}`)

    // 记录错误日志
    if (certdDB) {
      certdDB.addApplyLog({
        id: Date.now().toString(),
        domain: domain,
        status: 'error',
        message: `自动续期失败: ${error.message}`
      }, userId)
    }

    throw error
  }
}

/**
 * 部署到所有已配置的服务器
 */
async function deployToAllServers(certId, cert, userId = 'default', onProgress = () => {}) {
  const deployedServers = certdDB.getCertDeployedServers(certId, userId)

  if (!deployedServers || deployedServers.length === 0) {
    console.log(`[Auto-Renew] No deployment configs found for cert ${certId}`)
    emitProgress(onProgress, 'deploy', 'warning', '当前证书未配置部署服务器，已跳过自动部署。')
    return
  }

  console.log(`[Auto-Renew] Deploying to ${deployedServers.length} server(s)...`)
  emitProgress(onProgress, 'deploy', 'processing', `检测到 ${deployedServers.length} 个部署任务，正在开始部署...`)

  for (const serverConfig of deployedServers) {
    try {
      const server = certdDB.getServer(serverConfig.id, userId)
      if (!server) {
        console.log(`[Auto-Renew] Server ${serverConfig.id} not found, skipping`)
        emitProgress(onProgress, 'deploy', 'warning', `服务器 ${serverConfig.id} 不存在，已跳过。`)
        continue
      }

      const deployServer = {
        ...server,
        certPath: serverConfig.certPath,
        keyPath: serverConfig.keyPath,
        passphrase: serverConfig.passphrase
      }

      emitProgress(onProgress, 'deploy', 'processing', `正在部署到服务器 [${server.name}]...`)
      const result = await SshService.deployCert(deployServer, cert)
      console.log(`[Auto-Renew] Deployed to ${server.name} successfully`)
      const deployedMessage = result?.paths
        ? `部署成功: ${server.name}${result.paths.certPath ? ` | cert=${result.paths.certPath}` : ''}${result.paths.keyPath ? ` | key=${result.paths.keyPath}` : ''}`
        : `部署成功: ${server.name}`
      emitProgress(onProgress, 'deploy', 'success', deployedMessage)

      // 记录部署日志
      certdDB.addDeployLog({
        id: Date.now().toString(),
        certId: certId,
        serverId: server.id,
        status: 'success',
        message: '自动续期部署成功'
      }, userId)

    } catch (error) {
      console.error(`[Auto-Renew] Deploy to ${serverConfig.name || serverConfig.id} failed:`, error)
      emitProgress(onProgress, 'deploy', 'error', `服务器 [${serverConfig.name || serverConfig.id}] 部署失败: ${error.message}`)

      // 记录部署失败日志
      certdDB.addDeployLog({
        id: Date.now().toString(),
        certId: certId,
        serverId: serverConfig.id,
        status: 'failed',
        message: `自动续期部署失败: ${error.message}`
      }, userId)
    }
  }
}

/**
 * 显示系统通知
 */
function showNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../../build/icon.png')
    })
    notification.show()
  }
  console.log(`[Notification] ${title}: ${body}`)
}

/**
 * 手动触发检查（供 IPC 调用）
 */
function manualCheck(userId = 'default') {
  return checkAndRenew(userId)
}

async function renewNow(certId, userId = 'default', fallbackEmail = '', onProgress = () => {}) {
  if (!certdDB) {
    throw new Error('数据库未初始化')
  }

  if (!isProLicense(LicenseService.getLicense())) {
    throw new Error('自动续期是专业版功能，请先升级授权。')
  }

  const cert = certdDB.getCert(certId, userId)
  if (!cert) {
    throw new Error('未找到要续期的证书记录。')
  }

  await renewCertificate(cert, userId, { manual: true, fallbackEmail, onProgress })
  return { success: true, message: `${cert.domain} 已开始立即续期。` }
}

function getLastRunTime() {
  return lastRunTime
}

module.exports = {
  init,
  stop,
  checkAndRenew,
  manualCheck,
  getLastRunTime,
  renewNow
}
