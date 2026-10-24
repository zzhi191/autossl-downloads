# 安全与防破解规范

## 代码保护

### 1. JavaScript 混淆
使用 `javascript-obfuscator` 混淆主进程代码。

```javascript
// webpack.config.js
const JavaScriptObfuscator = require('webpack-obfuscator')

module.exports = {
  plugins: [
    new JavaScriptObfuscator({
      rotateStringArray: true,
      stringArray: true,
      stringArrayThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold': 0.4,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75
    }, ['excluded_bundle_name.js'])
  ]
}
```

### 2. ASAR 加密
使用 `asarmor` 或自定义加密保护 app.asar。

```bash
# 打包后处理
npx asarmor dist/mac/Certd.app/Contents/Resources/app.asar
```

### 3. 关键逻辑服务端化
将核心验证逻辑放在服务端，客户端只做展示：
- 授权验证
- 功能开关
- 使用量统计

## 设备指纹

### 采集信息
```javascript
const crypto = require('crypto')
const os = require('os')
const { machineIdSync } = require('node-machine-id')

function generateDeviceId() {
  const data = [
    machineIdSync(),           // 机器唯一标识
    os.hostname(),             // 主机名
    os.platform(),             // 平台
    os.arch(),                 // 架构
    os.cpus()[0]?.model,       // CPU 型号
    os.totalmem()              // 总内存
  ].join('|')
  
  return crypto.createHash('sha256').update(data).digest('hex')
}
```

### 防克隆
- 同一授权码限制绑定设备数量
- 设备指纹变化时需要重新激活
- 异常设备变化发出警告

## 通信安全

### 1. HTTPS 强制
所有 API 通信必须使用 HTTPS。

### 2. 请求签名
```javascript
function signRequest(method, path, body, timestamp, secret) {
  const payload = [method, path, timestamp, JSON.stringify(body)].join('\n')
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
```

### 3. 证书锁定 (Certificate Pinning)
```javascript
const https = require('https')

const pinnedCert = '...' // 服务器证书指纹

const agent = new https.Agent({
  checkServerIdentity: (host, cert) => {
    const fingerprint = cert.fingerprint256
    if (fingerprint !== pinnedCert) {
      throw new Error('Certificate mismatch')
    }
  }
})
```

## 运行时保护

### 1. 调试器检测
```javascript
const isDebuggerAttached = () => {
  return process.env.NODE_INSPECT || 
         process.execArgv.some(arg => arg.includes('inspect'))
}

if (isDebuggerAttached()) {
  app.quit()
}
```

### 2. 完整性校验
```javascript
const fs = require('fs')
const crypto = require('crypto')

function verifyIntegrity() {
  const files = ['main.js', 'preload.js', 'license-service.js']
  const expectedHashes = require('./integrity.json')
  
  for (const file of files) {
    const content = fs.readFileSync(file)
    const hash = crypto.createHash('sha256').update(content).digest('hex')
    if (hash !== expectedHashes[file]) {
      return false
    }
  }
  return true
}
```

### 3. 时间篡改检测
```javascript
async function verifySystemTime() {
  const serverTime = await fetchServerTime()
  const localTime = Date.now()
  const diff = Math.abs(serverTime - localTime)
  
  if (diff > 24 * 60 * 60 * 1000) { // 超过24小时
    return false
  }
  return true
}
```

## 服务端防护

### 1. 频率限制
```javascript
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每IP最多100次请求
  message: { error: 'Too many requests' }
})

app.use('/api/', limiter)
```

### 2. IP 黑名单
对异常行为的 IP 进行封禁：
- 短时间大量激活尝试
- 频繁验证失败
- 同一授权码多地登录

### 3. 行为分析
监控异常模式：
- 同一授权码快速切换设备
- 离线时间过长后突然在线
- 验证请求来源异常

## 授权撤销

### 远程禁用
```javascript
// 服务端可随时标记授权为 revoked
// 客户端下次验证时立即失效
```

### 紧急响应
发现大规模破解时：
1. 服务端强制要求所有客户端重新验证
2. 更换签名密钥
3. 推送紧急更新
