/**
 * SSH 部署服务
 */

const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * 部署证书到远程服务器
 */
async function deployCert(server, cert) {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('ready', () => {
      console.log('SSH连接成功')

      // 创建临时文件
      const tmpDir = os.tmpdir()
      const tmpCrtPath = path.join(tmpDir, `cert_${Date.now()}.crt`)
      const tmpKeyPath = path.join(tmpDir, `key_${Date.now()}.key`)

      try {
        // 写入临时文件
        fs.writeFileSync(tmpCrtPath, cert.crt)
        fs.writeFileSync(tmpKeyPath, cert.key)

        // 执行部署流程
        deployFiles(conn, server, tmpCrtPath, tmpKeyPath)
          .then((deployedPaths) => {
            // 清理临时文件
            fs.unlinkSync(tmpCrtPath)
            fs.unlinkSync(tmpKeyPath)
            conn.end()
            resolve({ success: true, message: '部署成功', paths: deployedPaths })
          })
          .catch(err => {
            // 清理临时文件
            try {
              fs.unlinkSync(tmpCrtPath)
              fs.unlinkSync(tmpKeyPath)
            } catch (e) { }
            conn.end()
            reject(err)
          })
      } catch (error) {
        conn.end()
        reject(error)
      }
    })

    conn.on('error', (err) => {
      console.error('SSH连接错误:', err)
      reject(err)
    })

    // 连接配置
    const connectConfig = {
      host: server.host,
      port: server.port || 22,
      username: server.username,
      readyTimeout: 20000
    }

    // 仅在有密码短语时添加，避免传递空字符串导致的问题
    // 优先使用 keyPassphrase（来自服务器配置），其次使用 passphrase（来自部署配置）
    const effectivePassphrase = server.keyPassphrase || server.passphrase
    if (effectivePassphrase && typeof effectivePassphrase === 'string' && effectivePassphrase.trim() !== '') {
      connectConfig.passphrase = effectivePassphrase
    }

    // 优先使用私钥文件路径，其次使用直接存储的私钥内容（向后兼容）
    let pk = null
    if (server.privateKeyPath) {
      try {
        // 处理 ~ 开头的路径
        let keyPath = server.privateKeyPath
        if (keyPath.startsWith('~')) {
          keyPath = keyPath.replace('~', os.homedir())
        }
        pk = fs.readFileSync(keyPath, 'utf8')
      } catch (err) {
        return reject(new Error(`无法读取私钥文件 ${server.privateKeyPath}: ${err.message}`))
      }
    } else if (server.privateKey) {
      pk = typeof server.privateKey === 'string' ? server.privateKey : server.privateKey.toString()

      // 检查解密状态
      if (pk === 'DECRYPT_FAILED') {
        return reject(new Error('私钥解密失败：可能是数据库加密密钥发生变化。请在该服务器配置中重新输入并保存私钥。'))
      }
    }

    if (pk) {
      // 1. 彻底移除所有非 ASCII 字符（处理可能的智能引号、宽字符空格、隐藏字符等）
      pk = pk.replace(/[^\x00-\x7F]/g, '')

      // 2. 支持所有换行符 (\r\n, \r, \n) 并修剪每一行
      const lines = pk.split(/\r\n|\r|\n/).map(line => line.trim())

      // 3. 特殊处理：保留 PEM 格式（如以前的 RSA 格式）可能需要的空行，但移除 OpenSSH 格式的多余空行
      const isOpenssh = lines[0] && lines[0].includes('OPENSSH PRIVATE KEY')
      const cleanedLines = lines.filter((line, index) => {
        if (isOpenssh) return line.length > 0 // OpenSSH 格式内部不应有空行
        return true // 其他格式保持结构
      })

      pk = cleanedLines.join('\n').trim()

      // 4. 二核诊断：深度解析内部结构判断加密状态 (仅限 OPENSSH 格式)
      if (isOpenssh) {
        try {
          const base64Content = pk.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, '')
          const buffer = Buffer.from(base64Content, 'base64')

          let pos = 15 // 跳过 magic
          const readString = (buf, start) => {
            const len = buf.readUInt32BE(start)
            return {
              val: buf.slice(start + 4, start + 4 + len).toString(),
              next: start + 4 + len
            }
          }

          const cipher = readString(buffer, pos)
          const kdf = readString(buffer, cipher.next)

          if (cipher.val !== 'none' && !connectConfig.passphrase) {
            console.warn('私钥已加密，但未提供私钥密码(Passphrase)，可能导致连接失败。')
          }
        } catch (e) {
          console.warn('无法检测私钥加密状态。')
        }
      }

      connectConfig.privateKey = pk
    } else if (server.password) {
      console.log('Using Password authentication')
      connectConfig.password = server.password
    }

    try {
      console.log('Connecting to SSH...')
      conn.connect(connectConfig)
    } catch (e) {
      console.error('SSH immediate connect error:', e)
      reject(e)
    }
  })
}

/**
 * 部署文件到服务器
 */
async function deployFiles(conn, server, tmpCrtPath, tmpKeyPath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }

      const runSequentially = async () => {
        try {
          // 1. 执行前置命令
          if (server.preCommand) {
            console.log('执行前置命令...')
            await execCommand(conn, server.preCommand)
          }

          const remoteTmpDir = '/tmp' // 远程临时目录，通常有写权限
          const deployedPaths = {}

          // 2. 处理证书文件
          if (server.certPath) {
            const resolvedCertPath = await resolveRemoteTargetPath(conn, server.certPath, 'public.pem')
            const certDir = path.posix.dirname(resolvedCertPath)
            const remoteTmpCertPath = `${remoteTmpDir}/cert_${Date.now()}.crt`

            console.log(`上传证书到临时路径: ${remoteTmpCertPath}`)
            await uploadFile(sftp, tmpCrtPath, remoteTmpCertPath)

            console.log(`[sudo] 创建目录并移动证书: ${resolvedCertPath}`)
            await execCommand(conn, `sudo mkdir -p "${certDir}"`)
            await execCommand(conn, `sudo mv "${remoteTmpCertPath}" "${resolvedCertPath}"`)
            await execCommand(conn, `sudo chmod 644 "${resolvedCertPath}"`)
            await verifyRemoteFile(conn, resolvedCertPath, '证书文件')
            deployedPaths.certPath = resolvedCertPath
          }

          // 3. 处理私钥文件
          if (server.keyPath) {
            const resolvedKeyPath = await resolveRemoteTargetPath(conn, server.keyPath, 'private.key')
            const keyDir = path.posix.dirname(resolvedKeyPath)
            const remoteTmpKeyPath = `${remoteTmpDir}/key_${Date.now()}.key`

            console.log(`上传私钥到临时路径: ${remoteTmpKeyPath}`)
            await uploadFile(sftp, tmpKeyPath, remoteTmpKeyPath)

            console.log(`[sudo] 创建目录并移动私钥: ${resolvedKeyPath}`)
            await execCommand(conn, `sudo mkdir -p "${keyDir}"`)
            await execCommand(conn, `sudo mv "${remoteTmpKeyPath}" "${resolvedKeyPath}"`)
            await execCommand(conn, `sudo chmod 600 "${resolvedKeyPath}"`)
            await verifyRemoteFile(conn, resolvedKeyPath, '私钥文件')
            deployedPaths.keyPath = resolvedKeyPath
          }

          // 4. 执行后置命令（重载服务）
          if (server.reloadCommand) {
            console.log('执行重载命令...')
            // 自动尝试 sudo 执行重载
            const sudoReload = server.reloadCommand.trim().startsWith('sudo')
              ? server.reloadCommand
              : `sudo ${server.reloadCommand}`
            await execCommand(conn, sudoReload)
          }

          resolve(deployedPaths)
        } catch (error) {
          reject(error)
        }
      }

      runSequentially()
    })
  })
}

/**
 * 上传文件（目录已由 mkdir -p 命令创建）
 */
function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) {
        reject(new Error(`文件上传失败 ${remotePath}: ${err.message}`))
      } else {
        console.log(`文件上传成功: ${remotePath}`)
        resolve()
      }
    })
  })
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`
}

async function resolveRemoteTargetPath(conn, targetPath, defaultFileName) {
  const normalizedTarget = normalizeRemotePath(targetPath)
  if (!normalizedTarget) {
    throw new Error('部署路径不能为空')
  }

  if (looksLikeDirectoryPath(normalizedTarget)) {
    return path.posix.join(normalizedTarget, defaultFileName)
  }

  const type = await detectRemotePathType(conn, normalizedTarget)
  if (type === 'directory') {
    return path.posix.join(normalizedTarget, defaultFileName)
  }

  return normalizedTarget
}

function normalizeRemotePath(targetPath) {
  const rawPath = String(targetPath || '').trim()
  if (!rawPath) return ''

  const normalized = path.posix.normalize(rawPath)
  if (rawPath.endsWith('/') && normalized !== '/') {
    return `${normalized}/`
  }
  return normalized
}

function looksLikeDirectoryPath(targetPath) {
  return targetPath.endsWith('/')
}

async function detectRemotePathType(conn, remotePath) {
  const escapedPath = shellEscape(remotePath)
  const result = await execCommand(
    conn,
    `if [ -d ${escapedPath} ]; then printf 'directory'; elif [ -e ${escapedPath} ]; then printf 'file'; else printf 'missing'; fi`
  )
  return result.trim()
}

async function verifyRemoteFile(conn, remotePath, label) {
  const escapedPath = shellEscape(remotePath)
  await execCommand(
    conn,
    `sudo test -s ${escapedPath} && printf '${label} verified'`
  )
}

/**
 * 执行命令
 */
function execCommand(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stdout = ''
      let stderr = ''

      stream.on('close', (code, signal) => {
        if (code !== 0) {
          reject(new Error(`命令执行失败，退出码: ${code}\n${stderr}`))
        } else {
          console.log(`命令执行成功: ${command}`)
          resolve(stdout)
        }
      })

      stream.on('data', (data) => {
        stdout += data.toString()
      })

      stream.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    })
  })
}

/**
 * 测试 SSH 连接
 */
async function testConnection(server) {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('ready', () => {
      conn.end()
      resolve({ success: true, message: '连接成功' })
    })

    conn.on('error', (err) => {
      reject(err)
    })

    // 连接配置逻辑抽取... (为了避免重复代码，这里复制一份配置逻辑，或者重构)
    const connectConfig = {
      host: server.host,
      port: server.port || 22,
      username: server.username,
      readyTimeout: 10000
    }

    if (server.password) {
      connectConfig.password = server.password
    } else {
      // 这里的私钥逻辑和 deployCert 一致
      let pk = null
      if (server.privateKeyPath) {
        try {
          let keyPath = server.privateKeyPath
          if (keyPath.startsWith('~')) keyPath = keyPath.replace('~', os.homedir())
          pk = fs.readFileSync(keyPath, 'utf8')
        } catch (e) { }
      } else if (server.privateKey) {
        pk = server.privateKey
      }
      if (pk) {
        connectConfig.privateKey = pk
        if (server.keyPassphrase) connectConfig.passphrase = server.keyPassphrase
      }
    }

    try {
      conn.connect(connectConfig)
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  deployCert,
  testConnection
}
