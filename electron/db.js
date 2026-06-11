const Database = require('better-sqlite3')
const crypto = require('crypto')
const path = require('path')
const { app } = require('electron')

// 加密密钥（应用启动时生成，基于机器特征）
const ENCRYPTION_KEY = crypto.createHash('sha256')
  .update(require('os').hostname() + 'certd-electron-secret-key')
  .digest()

/**
 * 加密字符串
 */
function encrypt(text) {
  if (!text) return ''
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密字符串
 */
function decrypt(encrypted) {
  if (!encrypted) return ''
  try {
    const parts = encrypted.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encryptedText = parts[1]
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    return ''
  }
}

function normalizeTimestampMs(value) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  return timestamp < 1e12 ? timestamp * 1000 : timestamp
}

/**
 * 证书管理数据库类
 */
class CertdDatabase {
  constructor() {
    // 数据库文件路径（存储在用户数据目录）
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'certd.db')

    console.log('📂 Database path:', dbPath)

    // 打开数据库
    this.db = new Database(dbPath)

    // 初始化表结构
    this.initTables()
    this.initAuditLogs()

    // 初始化管理员账户
    this.initAdmin()

    console.log('✅ Certd database initialized')
  }

  /**
   * 初始化表结构
   */
  initTables() {
    // 1. 管理员账户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 2. 服务器配置表（只存储SSH连接信息）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT,
        private_key TEXT,
        private_key_path TEXT,
        key_passphrase TEXT,
        reload_command TEXT,
        pre_command TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 迁移：添加新列（如果不存在）
    try {
      this.db.exec('ALTER TABLE servers ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }
    try {
      this.db.exec('ALTER TABLE servers ADD COLUMN private_key_path TEXT')
    } catch (e) { /* 列已存在 */ }
    try {
      this.db.exec('ALTER TABLE servers ADD COLUMN key_passphrase TEXT')
    } catch (e) { /* 列已存在 */ }

    // 3. 证书表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        domain TEXT NOT NULL,
        server_id TEXT,
        crt TEXT NOT NULL,
        key TEXT NOT NULL,
        expires_time INTEGER,
        apply_time INTEGER,
        status TEXT DEFAULT 'valid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
      )
    `)

    // 迁移：证书表添加 user_id
    try {
      this.db.exec('ALTER TABLE certificates ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }

    // 4. 证书申请记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cert_apply_logs (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        status TEXT,
        message TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 5. 证书-服务器部署关联表（支持一对多，每个部署可以指定不同的路径）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cert_server_deployments (
        id TEXT PRIMARY KEY,
        cert_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        cert_path TEXT NOT NULL,
        key_path TEXT NOT NULL,
        passphrase TEXT,
        deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cert_id) REFERENCES certificates(id) ON DELETE CASCADE,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        UNIQUE(cert_id, server_id)
      )
    `)

    // 6. 部署记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deploy_logs (
        id TEXT PRIMARY KEY,
        cert_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        status TEXT,
        message TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cert_id) REFERENCES certificates(id) ON DELETE CASCADE,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      )
    `)

    // 7. 证书申请配置表（用于自动续期）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cert_apply_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        cert_id TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        access_key_id TEXT,
        access_key_secret TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cert_id) REFERENCES certificates(id) ON DELETE CASCADE
      )
    `)

    // 迁移：申请配置表添加 user_id
    try {
      this.db.exec('ALTER TABLE cert_apply_configs ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_certificates_domain ON certificates(domain);
      CREATE INDEX IF NOT EXISTS idx_certificates_expires ON certificates(expires_time);
      CREATE INDEX IF NOT EXISTS idx_cert_deployments_cert ON cert_server_deployments(cert_id);
      CREATE INDEX IF NOT EXISTS idx_cert_deployments_server ON cert_server_deployments(server_id);
      CREATE INDEX IF NOT EXISTS idx_deploy_logs_cert ON deploy_logs(cert_id);
      CREATE INDEX IF NOT EXISTS idx_deploy_logs_server ON deploy_logs(server_id);
    `)

    this.db.exec("UPDATE servers SET user_id = 'admin' WHERE user_id IS NULL")
    this.db.exec("UPDATE certificates SET user_id = 'admin' WHERE user_id IS NULL")
    this.db.exec("UPDATE cert_apply_configs SET user_id = 'admin' WHERE user_id IS NULL")

    // 迁移：日志表添加 user_id
    try {
      this.db.exec('ALTER TABLE cert_apply_logs ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }
    try {
      this.db.exec('ALTER TABLE deploy_logs ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }

    this.db.exec("UPDATE cert_apply_logs SET user_id = 'admin' WHERE user_id IS NULL")
    this.db.exec("UPDATE deploy_logs SET user_id = 'admin' WHERE user_id IS NULL")


    // 8. 服务器创建日志表（用于统计配额，不随服务器删除而减少）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_creation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT NOT NULL,
        name TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 迁移：日志表添加 user_id
    try {
      this.db.exec('ALTER TABLE server_creation_logs ADD COLUMN user_id TEXT')
    } catch (e) { /* 列已存在 */ }

    this.db.exec("UPDATE server_creation_logs SET user_id = 'admin' WHERE user_id IS NULL")

    console.log('✅ User data isolation initialized (legacy data assigned to admin)')
  }

  /**
   * 将旧的 admin 数据迁移到新用户名下
   */
  claimLegacyData(targetUserId) {
    if (!targetUserId || targetUserId === 'admin') return { changes: 0 }

    const legacyCounts = [
      this.db.prepare("SELECT COUNT(*) as count FROM servers WHERE user_id = 'admin'").get().count,
      this.db.prepare("SELECT COUNT(*) as count FROM certificates WHERE user_id = 'admin'").get().count,
      this.db.prepare("SELECT COUNT(*) as count FROM cert_apply_configs WHERE user_id = 'admin'").get().count,
      this.db.prepare("SELECT COUNT(*) as count FROM server_creation_logs WHERE user_id = 'admin'").get().count
    ]
    if (legacyCounts.every((count) => count === 0)) return { changes: 0 }

    const serverStmt = this.db.prepare("UPDATE servers SET user_id = ? WHERE user_id = 'admin'")
    const certStmt = this.db.prepare("UPDATE certificates SET user_id = ? WHERE user_id = 'admin'")
    const configStmt = this.db.prepare("UPDATE cert_apply_configs SET user_id = ? WHERE user_id = 'admin'")
    const logStmt = this.db.prepare("UPDATE server_creation_logs SET user_id = ? WHERE user_id = 'admin'")

    const s = serverStmt.run(targetUserId).changes
    const c = certStmt.run(targetUserId).changes
    const conf = configStmt.run(targetUserId).changes
    logStmt.run(targetUserId)

    console.log(`✅ Legacy data claimed by ${targetUserId}: ${s} servers, ${c} certificates`)
    return { changes: s + c + conf }
  }

  /**
   * 初始化审计日志表
   */
  initAuditLogs() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_name TEXT,
    user_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

    try {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)')
    } catch (e) { }
  }

  /**
   * 记录审计日志
   */
  addAuditLog(log, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs(action, target_type, target_name, user_id, details)
VALUES(?, ?, ?, ?, ?)
  `)
    stmt.run(log.action, log.targetType, log.targetName, effectiveUserId, log.details || '')
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(limit = 100, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
SELECT * FROM audit_logs 
      WHERE user_id = ?
  ORDER BY created_at DESC
LIMIT ?
  `)
    return stmt.all(effectiveUserId, limit)
  }

  /**
   * 初始化管理员账户（密码：zhangzhi.net）
   */
  initAdmin() {
    const crypto = require('crypto')
    const password = 'zhangzhi.net'
    // 使用 MD5 加密（与 certd 保持一致）
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex')
    const username = 'zzhi.net@gmail.com'

    // 1. 尝试将旧账号 'admin' 改名（如果新账号还不存在）
    try {
      this.db.prepare("UPDATE OR IGNORE admin SET username = ? WHERE username = 'admin'").run(username)
    } catch (e) {
      console.warn('Failed to rename admin account:', e.message)
    }

    // 2. 如果新旧账号都存在，删除旧的 'admin'（防止以后冲突）
    try {
      this.db.prepare("DELETE FROM admin WHERE username = 'admin' AND EXISTS (SELECT 1 FROM admin WHERE username = ?)").run(username)
    } catch (e) { /* ignore */ }

    // 3. 确保新账号存在
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO admin(username, password)
      VALUES(?, ?)
    `)
    stmt.run(username, hashedPassword)

    console.log('✅ Admin account initialized/updated (username: zzhi.net@gmail.com)')
  }

  /**
   * 管理员登录验证
   */
  verifyAdmin(username, password) {
    const crypto = require('crypto')
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex')

    // 仅支持新邮箱名进行本地超级管理员验证
    const stmt = this.db.prepare('SELECT * FROM admin WHERE username = ? AND password = ?')
    const admin = stmt.get(username, hashedPassword)
    return !!admin
  }

  /**
   * 服务器管理
   */
  saveServer(server, userId) {
    const stmt = this.db.prepare(`
      INSERT INTO servers(id, user_id, name, host, port, username, password, private_key, private_key_path, key_passphrase, reload_command, pre_command, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
user_id = excluded.user_id,
  name = excluded.name,
  host = excluded.host,
  port = excluded.port,
  username = excluded.username,
  password = excluded.password,
  private_key = excluded.private_key,
  private_key_path = excluded.private_key_path,
  key_passphrase = excluded.key_passphrase,
  reload_command = excluded.reload_command,
  pre_command = excluded.pre_command,
  updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      server.id,
      userId || server.user_id || 'default',
      server.name,
      server.host,
      server.port || 22,
      server.username,
      server.password ? encrypt(server.password) : null,
      server.privateKey ? encrypt(server.privateKey) : null,
      server.privateKeyPath || null,
      server.keyPassphrase ? encrypt(server.keyPassphrase) : null,
      server.reloadCommand,
      server.preCommand
    )
  }

  getServer(id, userId) {
    const stmt = this.db.prepare("SELECT * FROM servers WHERE id = ? AND user_id = ?")
    const server = stmt.get(id, userId || 'admin')
    if (!server) return null

    return {
      ...server,
      password: server.password ? decrypt(server.password) : null,
      privateKey: server.private_key ? decrypt(server.private_key) : null,
      privateKeyPath: server.private_key_path || null,
      keyPassphrase: server.key_passphrase ? decrypt(server.key_passphrase) : null,
      reloadCommand: server.reload_command,
      preCommand: server.pre_command
    }
  }

  getServerOwner(id) {
    const stmt = this.db.prepare("SELECT user_id FROM servers WHERE id = ?")
    const row = stmt.get(id)
    return row?.user_id || null
  }

  getAllServers(userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare("SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC")
    const servers = stmt.all(effectiveUserId)

    return servers.map(server => ({
      id: server.id,
      user_id: server.user_id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      password: server.password ? decrypt(server.password) : null,
      privateKey: server.private_key ? decrypt(server.private_key) : null,
      privateKeyPath: server.private_key_path || null,
      keyPassphrase: server.key_passphrase ? decrypt(server.key_passphrase) : null,
      reloadCommand: server.reload_command,
      preCommand: server.pre_command,
      createdAt: server.created_at,
      updatedAt: server.updated_at
    }))
  }

  deleteServer(id, userId) {
    const stmt = this.db.prepare('DELETE FROM servers WHERE id = ? AND user_id = ?')
    return stmt.run(id, userId || 'admin').changes > 0
  }

  /**
   * 记录服务器创建日志
   */
  addServerCreationLog(server, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
      INSERT INTO server_creation_logs(server_id, name, user_id)
VALUES(?, ?, ?)
  `)
    stmt.run(server.id, server.name, effectiveUserId)
  }

  /**
   * 获取服务器使用量（基于创建历史）
   */
  getServerUsageCount(userId) {
    const effectiveUserId = userId || 'admin'
    // 统计过去 365 天内的创建记录？或者全部？根据需求，这里统计全部
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM server_creation_logs WHERE user_id = ?")
    return stmt.get(effectiveUserId).count
  }

  /**
   * 证书管理
   */
  saveCert(cert, userId) {
    const expiresTime = normalizeTimestampMs(cert.expiresTime)
    const stmt = this.db.prepare(`
      INSERT INTO certificates(id, user_id, domain, server_id, crt, key, expires_time, apply_time, status, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
user_id = excluded.user_id,
  domain = excluded.domain,
  server_id = excluded.server_id,
  crt = excluded.crt,
  key = excluded.key,
  expires_time = excluded.expires_time,
  apply_time = excluded.apply_time,
  status = excluded.status,
  updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      cert.id,
      userId || cert.user_id || 'admin',
      cert.domain,
      cert.serverId,
      encrypt(cert.crt),
      encrypt(cert.key),
      expiresTime,
      cert.applyTime || Date.now(),
      cert.status || 'valid'
    )
  }

  getCert(id, userId) {
    const stmt = this.db.prepare("SELECT * FROM certificates WHERE id = ? AND user_id = ?")
    const cert = stmt.get(id, userId || 'admin')
    if (!cert) return null

    return {
      id: cert.id,
      user_id: cert.user_id,
      domain: cert.domain,
      serverId: cert.server_id,
      crt: decrypt(cert.crt),
      key: decrypt(cert.key),
      expiresTime: normalizeTimestampMs(cert.expires_time),
      applyTime: cert.apply_time,
      status: cert.status,
      createdAt: cert.created_at,
      updatedAt: cert.updated_at
    }
  }

  getCertOwner(id) {
    const stmt = this.db.prepare("SELECT user_id FROM certificates WHERE id = ?")
    const row = stmt.get(id)
    return row?.user_id || null
  }

  getAllCerts(userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY expires_time ASC")
    const certs = stmt.all(effectiveUserId)

    return certs.map(cert => {
      // 获取该证书部署到的所有服务器
      const deployedServers = this.getCertDeployedServers(cert.id, effectiveUserId)

      return {
        id: cert.id,
        user_id: cert.user_id,
        domain: cert.domain,
        serverId: cert.server_id,
        deployedServerIds: deployedServers.map(s => s.id),
        deployedServers: deployedServers,
        crt: decrypt(cert.crt),
        key: decrypt(cert.key),
        expiresTime: normalizeTimestampMs(cert.expires_time),
        applyTime: cert.apply_time,
        status: cert.status,
        createdAt: cert.created_at,
        updatedAt: cert.updated_at
      }
    })
  }

  /**
   * 获取证书申请使用量（基于成功记录）
   */
  getCertUsageCount(userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM cert_apply_logs WHERE status = 'success' AND user_id = ?")
    return stmt.get(effectiveUserId).count
  }

  /**
   * 获取证书部署到的服务器列表（包含部署路径）
   */
  getCertDeployedServers(certId, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
      SELECT s.*, d.cert_path, d.key_path, d.passphrase, d.deployed_at
      FROM servers s
      INNER JOIN cert_server_deployments d ON s.id = d.server_id
      INNER JOIN certificates c ON c.id = d.cert_id
      WHERE d.cert_id = ?
        AND c.user_id = ?
        AND s.user_id = ?
  ORDER BY d.deployed_at DESC
    `)
    const results = stmt.all(certId, effectiveUserId, effectiveUserId)

    return results.map(row => ({
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      certPath: row.cert_path,
      keyPath: row.key_path,
      passphrase: row.passphrase ? decrypt(row.passphrase) : null,
      deployedAt: row.deployed_at
    }))
  }

  /**
   * 添加证书-服务器部署关联（包含部署路径）
   */
  addCertServerDeployment(certId, serverId, certPath, keyPath, passphrase, userId) {
    const effectiveUserId = userId || 'admin'
    const cert = this.getCert(certId, effectiveUserId)
    if (!cert) {
      throw new Error('证书不存在或无权限访问')
    }

    const server = this.getServer(serverId, effectiveUserId)
    if (!server) {
      throw new Error('服务器不存在或无权限访问')
    }

    const id = `${certId}_${serverId}_${Date.now()} `
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cert_server_deployments(id, cert_id, server_id, cert_path, key_path, passphrase)
VALUES(?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, certId, serverId, certPath, keyPath, passphrase ? encrypt(passphrase) : null)
    return true
  }

  /**
   * 删除证书-服务器部署关联
   */
  removeCertServerDeployment(certId, serverId, userId) {
    const effectiveUserId = userId || 'admin'
    if (!this.getCert(certId, effectiveUserId) || !this.getServer(serverId, effectiveUserId)) {
      return false
    }

    const stmt = this.db.prepare(`
      DELETE FROM cert_server_deployments 
      WHERE cert_id = ? AND server_id = ?
  `)
    return stmt.run(certId, serverId).changes > 0
  }

  getExpiringCerts(daysThreshold = 30, userId) {
    const now = Date.now()
    const threshold = now + (daysThreshold * 24 * 60 * 60 * 1000)
    const certs = this.getAllCerts(userId)
      .filter(cert => cert.expiresTime && cert.expiresTime >= now && cert.expiresTime <= threshold)
      .sort((a, b) => a.expiresTime - b.expiresTime)

    return certs.map(cert => ({
      ...cert,
      daysLeft: Math.floor((cert.expiresTime - now) / (1000 * 60 * 60 * 24))
    }))
  }

  deleteCert(id, userId) {
    const stmt = this.db.prepare('DELETE FROM certificates WHERE id = ? AND user_id = ?')
    return stmt.run(id, userId || 'admin').changes > 0
  }

  /**
   * 申请日志
   */
  addApplyLog(log, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
      INSERT INTO cert_apply_logs(id, domain, status, message, user_id)
VALUES(?, ?, ?, ?, ?)
  `)
    stmt.run(log.id, log.domain, log.status, log.message, effectiveUserId)
  }

  getApplyLogs(limit = 50, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
SELECT * FROM cert_apply_logs 
      WHERE user_id = ?
  ORDER BY created_at DESC
LIMIT ?
  `)
    return stmt.all(effectiveUserId, limit)
  }

  /**
   * 部署日志
   */
  addDeployLog(log, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
      INSERT INTO deploy_logs(id, cert_id, server_id, status, message, user_id)
VALUES(?, ?, ?, ?, ?, ?)
  `)
    stmt.run(log.id, log.certId, log.serverId, log.status, log.message, effectiveUserId)
  }

  getDeployLogs(limit = 50, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare(`
SELECT * FROM deploy_logs 
      WHERE user_id = ?
  ORDER BY created_at DESC
LIMIT ?
  `)
    return stmt.all(effectiveUserId, limit)
  }

  /**
   * 证书申请配置（用于自动续期）
   */
  saveCertApplyConfig(config, userId) {
    const stmt = this.db.prepare(`
      INSERT INTO cert_apply_configs(user_id, cert_id, domain, email, provider, access_key_id, access_key_secret, updated_at)
VALUES(?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cert_id) DO UPDATE SET
user_id = excluded.user_id,
  domain = excluded.domain,
  email = excluded.email,
  provider = excluded.provider,
  access_key_id = excluded.access_key_id,
  access_key_secret = excluded.access_key_secret,
  updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(
      userId || config.user_id || 'default',
      config.certId,
      config.domain,
      config.email,
      config.provider,
      config.accessKeyId ? encrypt(config.accessKeyId) : null,
      config.accessKeySecret ? encrypt(config.accessKeySecret) : null
    )
  }

  getCertApplyConfig(certId, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare("SELECT * FROM cert_apply_configs WHERE cert_id = ? AND user_id = ?")
    const config = stmt.get(certId, effectiveUserId)
    if (!config) return null

    return {
      user_id: config.user_id,
      certId: config.cert_id,
      domain: config.domain,
      email: config.email,
      provider: config.provider,
      accessKeyId: config.access_key_id ? decrypt(config.access_key_id) : null,
      accessKeySecret: config.access_key_secret ? decrypt(config.access_key_secret) : null
    }
  }

  getCertApplyConfigByDomain(domain, userId) {
    const effectiveUserId = userId || 'admin'
    const stmt = this.db.prepare("SELECT * FROM cert_apply_configs WHERE domain = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1")
    const config = stmt.get(domain, effectiveUserId)
    if (!config) return null

    return {
      user_id: config.user_id,
      certId: config.cert_id,
      domain: config.domain,
      email: config.email,
      provider: config.provider,
      accessKeyId: config.access_key_id ? decrypt(config.access_key_id) : null,
      accessKeySecret: config.access_key_secret ? decrypt(config.access_key_secret) : null
    }
  }

  /**
   * 关闭数据库
   */
  close() {
    this.db.close()
  }
}

module.exports = CertdDatabase
