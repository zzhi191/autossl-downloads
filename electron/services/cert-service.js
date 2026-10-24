/**
 * 证书服务 - 证书过期时间计算等
 */

/**
 * 检查证书过期时间
 */
function checkExpiry(cert) {
  if (!cert || !cert.crt) {
    return null
  }
  
  try {
    // 使用 @peculiar/x509 解析证书
    const { X509Certificate } = require('@peculiar/x509')
    
    // 从 PEM 格式提取证书
    let certPem = cert.crt
    if (!certPem.includes('-----BEGIN')) {
      certPem = `-----BEGIN CERTIFICATE-----\n${certPem}\n-----END CERTIFICATE-----`
    }
    
    // 解析证书
    const certObj = X509Certificate.fromPEM(certPem)
    const expires = new Date(certObj.notAfter).getTime()
    const now = Date.now()
    const daysLeft = Math.floor((expires - now) / (1000 * 60 * 60 * 24))
    
    // 获取域名
    const domains = []
    const subject = certObj.subject
    
    // 提取 Common Name
    const cn = subject.get('CN')
    if (cn) {
      domains.push(cn)
    }
    
    // 提取 Subject Alternative Names
    const sanExt = certObj.extensions.find(e => e.id === '2.5.29.17') // SAN extension
    if (sanExt) {
      // 解析 SAN 扩展（简化处理）
      // 实际需要解析 ASN.1 结构，这里先使用域名
    }
    
    return {
      expires,
      daysLeft,
      status: daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring' : 'valid',
      domains: domains.length > 0 ? domains : [cert.domain || 'unknown']
    }
  } catch (error) {
    console.error('Check cert expiry error:', error)
    // 如果解析失败，尝试从数据库中的 expiresTime
    if (cert.expiresTime) {
      const now = Date.now()
      const daysLeft = Math.floor((cert.expiresTime - now) / (1000 * 60 * 60 * 24))
      return {
        expires: cert.expiresTime,
        daysLeft,
        status: daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring' : 'valid',
        domains: [cert.domain || 'unknown']
      }
    }
    return null
  }
}

module.exports = {
  checkExpiry
}

