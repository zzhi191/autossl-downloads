/**
 * ACME 证书申请服务
 * 集成 certd 的 acme-client 核心功能
 */

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const psl = require('psl')

// 导入本地 DNS 提供商实现
const AliyunDnsProvider = require('./dns-providers/aliyun')
const TencentDnsProvider = require('./dns-providers/tencent')
const HuaweiDnsProvider = require('./dns-providers/huawei')

/**
 * 申请证书
 */
async function applyCert(domain, email, dnsProvider, onProgress = () => { }, cachedAccount = null) {
    const log = (step, status, message) => {
        console.log(`[ACME][${step}] ${status}: ${message}`)
        onProgress({ step, status, message })
    }

    let finalAccountKey = null // cachedAccount?.key || null
    let finalAccountUrl = null // cachedAccount?.url || null
    let updatedAccount = null

    try {
        log('init', 'processing', '正在初始化证书申请环境...')

        // 动态导入 @certd/acme-client
        const acme = await import('@certd/acme-client')

        // 0. 初始化 DNS 提供商插件
        let provider
        // ... DNS initialization logic ...
        if (dnsProvider && dnsProvider.type) {
            log('init', 'processing', `正在初始化 DNS 服务商: ${dnsProvider.type}`)
            try {
                if (dnsProvider.type === 'aliyun') {
                    provider = new AliyunDnsProvider({
                        accessKeyId: dnsProvider.accessKeyId,
                        accessKeySecret: dnsProvider.accessKeySecret
                    })
                } else if (dnsProvider.type === 'tencent' || dnsProvider.type === 'dnspod') {
                    provider = new TencentDnsProvider({
                        accessKeyId: dnsProvider.accessKeyId,
                        accessKeySecret: dnsProvider.accessKeySecret
                    })
                } else if (dnsProvider.type === 'huawei' || dnsProvider.type === 'huaweicloud') {
                    provider = new HuaweiDnsProvider({
                        accessKeyId: dnsProvider.accessKeyId,
                        accessKeySecret: dnsProvider.accessKeySecret
                    })
                } else {
                    throw new Error(`暂不支持该 DNS 服务商: ${dnsProvider.type}`)
                }
            } catch (err) {
                log('init', 'error', `DNS 插件初始化失败: ${err.message}`)
                throw new Error(`DNS 插件初始化失败: ${err.message}`)
            }
        } else {
            throw new Error('请选择 DNS 服务商并配置 AccessKey')
        }

        // ===== 预清理步骤：彻底清除该域名下的所有 ACME 验证记录 =====
        log('init', 'processing', '⚠️ 正在强制清理该域名下的所有历史 ACME 验证记录...')
        try {
            const parsed = psl.parse(domain)
            const mainDomain = parsed.domain
            const subDomain = parsed.subdomain
            const rr = subDomain ? `_acme-challenge.${subDomain}` : '_acme-challenge'

            // 获取所有记录并删除，而不仅仅是匹配某个值的记录
            await provider.removeRecord({
                domain: mainDomain,
                rr: rr,
                type: 'TXT'
            })
            log('init', 'processing', '历史验证记录已提交清理任务，等待 10 秒确保生效...')
            await new Promise(resolve => setTimeout(resolve, 10000))
        } catch (e) {
            log('init', 'processing', '清理历史记录时发生异常（可能记录本就不存在），继续下一步')
        }

        // 1. 准备账户密钥和 URL (对齐 certd 逻辑)
        const directoryUrl = acme.directory.letsencrypt.production
        console.log('[ACME] 使用 Let\'s Encrypt Production 环境（直连，无代理）')

        // 暂时禁用代理，测试直连
        const urlMapping = {
            enabled: false,
            mappings: {}
        }

        if (!finalAccountKey) {
            log('init', 'processing', '正在生成新的 ACME 账户密钥 (强制刷新)...')
            // 使用 crypto 生成私钥 (RSA 2048)
            finalAccountKey = await acme.crypto.createPrivateKey()
            updatedAccount = { key: finalAccountKey.toString(), url: null }
        }

        // 创建 ACME 客户端
        const client = new acme.Client({
            directoryUrl: directoryUrl,
            accountKey: finalAccountKey,
            accountUrl: finalAccountUrl,
            urlMapping, // 传入映射配置
            backoffAttempts: 20,
            backoffMin: 5000,
            backoffMax: 10000,
            logger: {
                info: (msg) => log('acme', 'processing', msg),
                error: (msg) => log('acme', 'error', msg),
                debug: (msg) => console.log(msg)
            }
        });

        // 如果没有 Account URL，说明是新账户，执行创建逻辑
        if (!finalAccountUrl) {
            log('acme', 'processing', '正在向 CA 注册账户...')
            await client.createAccount({
                termsOfServiceAgreed: true,
                contact: [`mailto:${email}`]
            })
            finalAccountUrl = client.getAccountUrl()
            updatedAccount = { key: finalAccountKey.toString(), url: finalAccountUrl }
        }

        // 2. 生成 CSR
        log('init', 'processing', '正在生成证书签名请求 (CSR)...')
        const [key, csr] = await acme.crypto.createCsr({
            altNames: [domain]
        });

        // 3. 定义挑战回调
        const challengeCreateFn = async (authz, keyAuthorizationGetter) => {
            const challenge = authz.challenges.find(c => c.type === 'dns-01')
            if (!challenge) {
                throw new Error(`在域名 ${authz.identifier.value} 中未找到 dns-01 挑战`)
            }

            // 获取 DNS TXT 记录值
            // 重要：对于 dns-01 挑战，keyAuthorizationGetter 已经返回了最终的 TXT 值
            // 即 base64url(SHA256(token + "." + thumbprint))，不需要再次 hash！
            const dnsRecordValue = await keyAuthorizationGetter(challenge)

            log('acme-debug', 'processing', `[DEBUG] Token: ${challenge.token}`)
            log('acme-debug', 'processing', `[DEBUG] DNS TXT Value: ${dnsRecordValue}`)

            const parsed = psl.parse(authz.identifier.value)
            if (parsed.error) {
                throw new Error(`域名解析失败: ${parsed.error.message}`)
            }

            const mainDomain = parsed.domain
            const subDomain = parsed.subdomain
            const rr = subDomain ? `_acme-challenge.${subDomain}` : '_acme-challenge'

            log('dns-add', 'processing', `正在添加 DNS 解析记录: ${rr}.${mainDomain} -> ${dnsRecordValue}`)

            await provider.createRecord({
                domain: mainDomain,
                rr: rr,
                value: dnsRecordValue,
                type: 'TXT'
            })

            log('dns-wait', 'processing', '记录已添加，等待 10 秒让 DNS 服务商生效...')
            await new Promise(resolve => setTimeout(resolve, 10000))

            // 验证记录是否真正生效（直接查询权威 DNS，绕过公共 DNS 缓存）
            log('dns-wait', 'processing', '正在通过权威 DNS 验证记录是否已生效...')
            let verified = false
            const dns = require('dns').promises

            // 1. 获取权威名称服务器
            let nsServers = ['223.5.5.5', '223.6.6.6'] // 默认阿里公共DNS作为兜底
            try {
                const nsRecords = await dns.resolveNs(mainDomain)
                if (nsRecords && nsRecords.length > 0) {
                    // 解析出 NS 的 IP 地址
                    const nsIps = await Promise.all(nsRecords.slice(0, 2).map(async ns => {
                        const addr = await dns.resolve4(ns)
                        return addr[0]
                    }))
                    nsServers = nsIps
                    log('dns-wait', 'processing', `已获取权威 DNS 服务器: ${nsRecords.join(', ')}`)
                }
            } catch (e) {
                log('dns-wait', 'processing', '获取权威 NS 失败，使用阿里公共 DNS 兜底')
            }

                const maxAttempts = 40; // 增加到 40 次，约 6.5 分钟
                for (let i = 0; i < maxAttempts; i++) {
                    await new Promise(resolve => setTimeout(resolve, 8000)) // 稍微延长单次间隔
                    try {
                        const fullDomain = `${rr}.${mainDomain}`
                        const authoritativeResults = await Promise.all(nsServers.map(async nsServer => {
                            try {
                                const resolver = new dns.Resolver()
                                resolver.setServers([nsServer])
                                const records = await resolver.resolveTxt(fullDomain)
                                return records.map(r => r.join(''))
                            } catch (error) {
                                return []
                            }
                        }))
                        const flatRecords = authoritativeResults.flat()

                        log('dns-wait', 'processing', `权威 DNS 查询结果: ${flatRecords.length > 0 ? flatRecords.join(', ') : '空'}（${authoritativeResults.map((records, index) => `${nsServers[index]}:${records.length > 0 ? '已同步' : '未同步'}`).join(', ')}）`)

                        // 核心逻辑：所有权威 NS 都必须包含预期值，避免某台 NS 未同步导致 CA 二次验证 SERVFAIL。
                        if (authoritativeResults.every(result => result.includes(dnsRecordValue))) {
                        log('dns-wait', 'processing', `✅ DNS 记录验证成功 (检测到预期值)`)

                        // 如果记录数大于1，说明还有旧记录干扰
                        if (flatRecords.length > 1) {
                            log('dns-wait', 'processing', `⚠️ 检测到 ${flatRecords.length} 条记录，建议下次清理干扰记录`)
                        }

                        verified = true
                        break
                    } else if (flatRecords.length > 0) {
                        log('dns-wait', 'processing', `⚠️ DNS 记录已更新但值不匹配，继续等待传播... (${i + 1}/${maxAttempts})`)
                    } else {
                        log('dns-wait', 'processing', `⏳ 权威服务器尚未同步记录，继续检测中... (${i + 1}/${maxAttempts})`)
                    }
                } catch (e) {
                    log('dns-wait', 'processing', `DNS 查询结果: 空 (${i + 1}/${maxAttempts})`)
                }
            }

            if (!verified) {
                const errorMsg = `DNS 验证超时: 权威 DNS 40 次轮询均未返回正确的验证值。\n\n` +
                    `预期值: ${dnsRecordValue}\n` +
                    `当前权威 DNS 返回: ${nsServers.join(', ')}\n\n` +
                    `可能原因:\n` +
                    `1. 您填写的 AccessKey 权限不足，未能成功添加 TXT 记录\n` +
                    `2. DNS 服务商全球同步极其缓慢\n\n` +
                    `解决方案: 请登录云厂商后台手动检查 _acme-challenge.${subDomain || mainDomain} 记录是否存在。`

                log('dns-wait', 'error', errorMsg)
                throw new Error('DNS 验证超时，已终止申请流程')
            }

            log('dns-wait', 'processing', '验证成功，额外预留 15 秒同步深度...')
            await new Promise(resolve => setTimeout(resolve, 15000))

            return {
                challenge,
                keyAuthorization: dnsRecordValue,
                recordReq: null,
                recordRes: null,
                dnsProvider: provider
            }
        }

        const challengeRemoveFn = async (authz, challenge, keyAuthorization, recordReq, recordRes) => {
            if (challenge.type === 'dns-01') {
                const parsed = psl.parse(authz.identifier.value)
                const mainDomain = parsed.domain
                const subDomain = parsed.subdomain
                const rr = subDomain ? `_acme-challenge.${subDomain}` : '_acme-challenge'

                log('dns-remove', 'processing', `正在清理 DNS 解析记录: ${rr}`)
                try {
                    await provider.removeRecord({
                        domain: mainDomain,
                        rr: rr,
                        value: keyAuthorization, // 已经是最终的 DNS TXT 值，不需要再 hash
                        type: 'TXT'
                    })
                } catch (err) {
                    console.warn('[DNS-01] Remove Record Failed:', err.message)
                }
            }
        }

        // 4. 执行全自动流程
        log('acme', 'processing', '开始执行 ACME 自动化流程 (跳过本地验证)...')
        const cert = await client.auto({
            csr,
            email,
            termsOfServiceAgreed: true,
            challengeCreateFn,
            challengeRemoveFn,
            skipChallengeVerification: true, // 跳过本地 DNS 检查，直接让 Let's Encrypt 验证
            waitDnsDiffuseTime: 60 // 等待 DNS 扩散较长时间
        });

        log('success', 'success', '证书已成功核发！')

        // 获取最终的 Account URL (如果是新注册的)
        if (updatedAccount && !updatedAccount.url) {
            try {
                updatedAccount.url = client.getAccountUrl()
            } catch (e) { }
        }

        const certId = Date.now().toString()

        return {
            success: true,
            message: '证书申请成功',
            certId,
            updatedAccount,
            data: {
                id: certId,
                crt: cert.toString(),
                key: key.toString(),
                expires: Date.now() + 90 * 24 * 60 * 60 * 1000
            }
        }

    } catch (error) {
        log('error', 'error', `证书申请失败: ${error.message}`)
        throw error
    }
}

/**
 * 使用外部 ACME 客户端库的示例（备选方案）
 */
async function applyCertWithLibrary(domain, email) {
    // 保留此函数的原有逻辑或直接留空
}

module.exports = {
    applyCert,
    applyCertWithLibrary
}
