# 客户端授权模块规范

## 模块路径
`electron/services/license-service.js`

## 功能描述
客户端授权验证模块，负责与授权服务器通信，验证和缓存授权状态。

## 配置常量

```javascript
const LICENSE_SERVER = 'https://license.certd.io/api/v1'
const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000  // 24小时
const OFFLINE_GRACE_DAYS = 7  // 离线宽限期
```

## 核心函数

### `init()`
初始化授权服务，启动定期验证。

### `getDeviceId()`
生成设备指纹。

```javascript
// 基于以下信息生成唯一标识
- os.hostname()
- os.platform()
- os.arch()
- MAC 地址
- CPU 序列号（如可用）
```

### `activate(licenseKey)`
激活授权码。

**流程：**
1. 生成设备指纹
2. 调用 `/license/activate` API
3. 保存授权信息到本地
4. 返回激活结果

### `verify()`
验证授权状态。

**流程：**
1. 检查本地缓存是否有效
2. 如果在线，调用 `/license/verify` API
3. 更新本地缓存
4. 如果离线，检查宽限期

### `deactivate()`
解绑当前设备。

### `getLicenseInfo()`
获取当前授权信息。

```javascript
{
  isActivated: boolean,
  plan: 'free' | 'professional' | 'enterprise',
  expiresAt: Date,
  remainingDays: number,
  maxDomains: number,
  maxServers: number,
  features: string[]
}
```

### `checkFeature(featureName)`
检查是否有某功能权限。

### `checkLimit(type, currentCount)`
检查是否超出限制。

## 本地存储结构

使用 `electron-store` 存储：

```javascript
{
  license: {
    licenseId: "uuid",
    licenseKey: "XXXX-XXXX-XXXX-XXXX",
    deviceId: "fingerprint",
    plan: "professional",
    expiresAt: 1234567890000,
    maxDomains: -1,
    maxServers: 5,
    features: ["auto_renew"],
    lastVerified: 1234567890000,
    offlineSince: null
  }
}
```

## 授权检查时机

1. **应用启动时**：验证授权状态
2. **每24小时**：定期心跳验证
3. **关键操作前**：
   - 添加域名时检查域名数量限制
   - 添加服务器时检查服务器数量限制
   - 使用高级功能时检查功能权限

## 离线处理

```
在线状态
    ↓
网络断开
    ↓
使用本地缓存（最多7天）
    ↓
宽限期结束
    ↓
降级为免费版功能
    ↓
恢复网络后重新验证
```

## 授权过期处理

1. **到期前7天**：显示续费提醒
2. **到期当天**：弹窗提示续费
3. **到期后**：
   - 保留已有数据
   - 限制为免费版功能
   - 禁止添加新域名/服务器

## IPC 接口

### `license:activate`
```javascript
ipcMain.handle('license:activate', (event, licenseKey) => {
  return LicenseService.activate(licenseKey)
})
```

### `license:get-info`
```javascript
ipcMain.handle('license:get-info', () => {
  return LicenseService.getLicenseInfo()
})
```

### `license:check-limit`
```javascript
ipcMain.handle('license:check-limit', (event, type, count) => {
  return LicenseService.checkLimit(type, count)
})
```

### `license:deactivate`
```javascript
ipcMain.handle('license:deactivate', () => {
  return LicenseService.deactivate()
})
```

## UI 集成点

### 1. 激活页面
- 输入授权码
- 显示激活状态
- 购买链接

### 2. 设置页面
- 显示当前版本
- 显示到期时间
- 解绑设备按钮
- 续费按钮

### 3. 功能限制提示
- 添加域名时提示升级
- 添加服务器时提示升级
- 使用高级功能时提示升级

## 错误处理

| 场景 | 处理 |
|------|------|
| 网络错误 | 使用本地缓存，进入离线模式 |
| 授权码无效 | 显示错误提示 |
| 设备数超限 | 引导用户解绑其他设备 |
| 授权过期 | 引导用户续费 |
