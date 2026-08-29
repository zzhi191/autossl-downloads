# 授权服务器 API 规范

## 基础信息

- **基础 URL**: `https://tools.fogomo.com/api`
- **认证方式**: Bearer Token (JWT)
- **响应格式**: JSON，生产接口外层统一为 `{ data, code, msg }`

## 用户 API

### POST /auth/check-email

检查邮箱是否已在指定应用注册

**请求体：**

```json
{
  "email": "user@example.com",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "registered": true
  },
  "code": 200,
  "msg": "success"
}
```

### POST /auth/send-code

发送注册验证码

**请求体：**

```json
{
  "email": "user@example.com",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "success": true,
    "message": "验证码已发送"
  },
  "code": 200,
  "msg": "success"
}
```

### POST /auth/send-reset-code

发送密码重置验证码。该接口只允许已注册邮箱调用，验证码只可用于密码重置，不能用于注册。

**请求体：**

```json
{
  "email": "user@example.com",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "success": true,
    "message": "验证码已发送"
  },
  "code": 200,
  "msg": "success"
}
```

### POST /auth/reset-password

通过注册邮箱验证码重置登录密码。服务端必须使用 bcrypt 哈希保存新密码。

**请求体：**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "password": "new-password123",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "success": true,
    "message": "密码已重置"
  },
  "code": 200,
  "msg": "success"
}
```

### POST /auth/register

用户注册

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "code": "123456",
  "machineId": "local-machine-id",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "access_token": "jwt_token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "appCode": "certd-electron"
    }
  },
  "code": 200,
  "msg": "success"
}
```

### POST /auth/login

用户登录

**请求体：**

```json
{
  "email": "user@example.com",
  "pass": "password123",
  "appCode": "certd-electron"
}
```

**响应：**

```json
{
  "data": {
    "access_token": "jwt_token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "appCode": "certd-electron"
    },
    "accessibleApps": [],
    "defaultAppCode": "certd-electron",
    "isSuperAdmin": false
  },
  "code": 200,
  "msg": "success"
}
```

AutoSSL Electron 客户端必须携带 `appCode: "certd-electron"`。本地 `admin` 账号不再作为客户端登录身份，历史本地数据只在远端账号登录后由客户端本机迁移归属。

### GET /auth/profile

获取用户信息（需认证）

**响应：**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "用户名",
    "plan": "professional",
    "expiresAt": "2027-01-23T00:00:00Z"
  }
}
```

## 授权 API

### POST /license/activate

激活授权码

**请求体：**

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "device_fingerprint",
  "deviceName": "MacBook Pro"
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "licenseId": "uuid",
    "plan": "professional",
    "maxDomains": -1,
    "maxServers": 5,
    "expiresAt": "2027-01-23T00:00:00Z",
    "features": ["auto_renew", "unlimited_domains"]
  }
}
```

### POST /license/verify

验证授权状态（心跳）

**请求体：**

```json
{
  "licenseId": "uuid",
  "deviceId": "device_fingerprint"
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "plan": "professional",
    "expiresAt": "2027-01-23T00:00:00Z",
    "remainingDays": 365
  }
}
```

### POST /license/deactivate

解绑设备

**请求体：**

```json
{
  "licenseId": "uuid",
  "deviceId": "device_fingerprint"
}
```

### GET /license/devices

获取已绑定的设备列表

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "deviceId": "fingerprint1",
      "deviceName": "MacBook Pro",
      "activatedAt": "2026-01-23T00:00:00Z",
      "lastSeenAt": "2026-01-23T12:00:00Z"
    }
  ]
}
```

## 订阅 API

### GET /subscription

获取当前订阅信息

**响应：**

```json
{
  "success": true,
  "data": {
    "plan": "professional",
    "status": "active",
    "startDate": "2026-01-23T00:00:00Z",
    "expiresAt": "2027-01-23T00:00:00Z",
    "autoRenew": true,
    "paymentMethod": "wechat"
  }
}
```

### POST /subscription/create

创建订阅（生成支付链接）

**请求体：**

```json
{
  "plan": "professional",
  "period": "yearly",
  "paymentMethod": "wechat"
}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "paymentUrl": "weixin://pay/...",
    "qrCode": "base64_qr_image",
    "amount": 9900,
    "expiresAt": 1234567890
  }
}
```

### POST /subscription/cancel

取消自动续费

## 错误码

| 代码 | 说明           |
| ---- | -------------- |
| 1001 | 无效的授权码   |
| 1002 | 授权码已被使用 |
| 1003 | 授权已过期     |
| 1004 | 设备数量超限   |
| 1005 | 设备未绑定     |
| 2001 | 用户不存在     |
| 2002 | 密码错误       |
| 2003 | 邮箱已注册     |
| 3001 | 支付失败       |
| 3002 | 订阅不存在     |
