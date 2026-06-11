# 数据库规范

## 模块路径
`electron/db.js`

## 概述
使用 better-sqlite3 实现本地 SQLite 数据库，存储用户、服务器、证书等数据。

## 数据库文件位置
```
macOS: ~/Library/Application Support/certd-electron/certd.db
Windows: %APPDATA%/certd-electron/certd.db
Linux: ~/.config/certd-electron/certd.db
```

## 加密机制

### 加密算法
- 算法：AES-256-CBC
- IV：16 字节随机生成
- 密钥：基于 `os.hostname()` + 固定盐值的 SHA-256 哈希

### 存储格式
```
{iv_hex}:{encrypted_hex}
```

### 加密字段
- `users.password`
- `servers.password`
- `servers.private_key`
- `servers.key_passphrase`
- `cert_server_deployments.passphrase`

## 表结构

### users
用户账户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | 密码（加密） |
| role | TEXT | 角色（admin/user） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### servers
服务器配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 服务器名称 |
| host | TEXT | 主机地址 |
| port | INTEGER | SSH 端口（默认 22） |
| username | TEXT | SSH 用户名 |
| password | TEXT | SSH 密码（加密） |
| private_key | TEXT | SSH 私钥内容（加密，向后兼容） |
| private_key_path | TEXT | 本地 SSH 私钥路径 |
| key_passphrase | TEXT | 私钥密码（加密） |
| reload_command | TEXT | 部署后命令 |
| pre_command | TEXT | 部署前命令 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### certificates
证书表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| domain | TEXT | 域名 |
| server_id | TEXT | 关联服务器（已弃用） |
| crt | TEXT | 证书内容 |
| key | TEXT | 证书私钥 |
| expires_time | INTEGER | 过期时间戳 |
| apply_time | INTEGER | 申请时间戳 |
| status | TEXT | 状态（valid/expired） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### cert_server_deployments
证书-服务器部署关联表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| cert_id | TEXT | 证书 ID |
| server_id | TEXT | 服务器 ID |
| cert_path | TEXT | 远程证书路径 |
| key_path | TEXT | 远程私钥路径 |
| passphrase | TEXT | 部署时私钥密码（加密） |
| created_at | DATETIME | 创建时间 |

### cert_apply_logs
证书申请日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| domain | TEXT | 域名 |
| status | TEXT | 状态 |
| message | TEXT | 消息 |
| created_at | DATETIME | 创建时间 |

### deploy_logs
部署日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| cert_id | TEXT | 证书 ID |
| server_id | TEXT | 服务器 ID |
| status | TEXT | 状态（success/failed） |
| message | TEXT | 消息 |
| deployed_at | DATETIME | 部署时间 |

## 核心方法

### 服务器管理
- `saveServer(server)` - 保存/更新服务器
- `getServer(id)` - 获取单个服务器（解密敏感字段）
- `getAllServers()` - 获取所有服务器
- `deleteServer(id)` - 删除服务器

### 证书管理
- `saveCert(cert)` - 保存/更新证书
- `getCert(id)` - 获取单个证书
- `getAllCerts()` - 获取所有证书
- `deleteCert(id)` - 删除证书

### 部署配置
- `addCertServerDeployment(certId, serverId, certPath, keyPath, passphrase)` - 添加部署配置
- `getCertDeployedServers(certId)` - 获取证书的所有部署配置

## 迁移策略

数据库初始化时自动执行迁移：
```javascript
try {
  this.db.exec('ALTER TABLE servers ADD COLUMN private_key_path TEXT')
} catch (e) { /* 列已存在 */ }
```
