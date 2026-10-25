# 数据库规范

## 模块路径
`electron/db.js`

## 概述
使用 better-sqlite3 实现本地 SQLite 数据库，存储服务器、证书、申请配置、部署配置和日志等本机数据。

客户端账号身份不再由本地数据库中的 `admin` 账号决定，而是由 fogomo Tools API 远端账号决定。登录成功后，主进程通过 `user:set-session` 设置当前用户，并使用该远端用户 id 作为本地数据的 `user_id`。

历史 `user_id = 'admin'` 只表示旧版本本地数据的迁移来源，不再是可登录身份。

## 数据库文件位置
```
macOS: ~/Library/Application Support/auto-ssl/certd.db
Windows: %APPDATA%/auto-ssl/certd.db
Linux: ~/.config/auto-ssl/certd.db
```

## 加密机制

### 新写入格式
- 优先使用 Electron `safeStorage`，存储前缀为 `v2:safe:`。
- 如果 `safeStorage` 不可用，使用本机生成的 32 字节随机密钥和 AES-256-GCM，存储前缀为 `v2:gcm:`。
- AES-GCM 格式必须保存 IV、auth tag 和密文，解密时必须校验 auth tag。

### 历史读取兼容
- 旧数据可能使用 `{iv_hex}:{encrypted_hex}` 的 AES-256-CBC 格式。
- 旧 CBC 密钥基于 `os.hostname()` + 固定盐值派生，只允许用于读取历史数据。
- 新数据禁止继续写入旧 CBC 格式。

### 加密字段
- `servers.password`
- `servers.private_key`
- `servers.key_passphrase`
- `cert_server_deployments.passphrase`
- `cert_apply_configs.access_key_secret`

## 表结构

### admin
历史本地管理员表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| username | TEXT | 历史用户名 |
| password | TEXT | 历史密码摘要 |
| role | TEXT | 角色（admin/user） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

本表仅为旧数据兼容保留。初始化时必须删除旧开发默认账号 `admin` / `zzhi.net@gmail.com` 与默认密码 `zhangzhi.net` 对应的记录。客户端不得再通过 `admin:login` 或本地管理员表完成登录。

### servers
服务器配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| user_id | TEXT | 当前远端用户 id；历史数据迁移前为 `admin` |
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
| user_id | TEXT | 当前远端用户 id；历史数据迁移前为 `admin` |
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
| user_id | TEXT | 当前远端用户 id |
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
| user_id | TEXT | 当前远端用户 id |
| created_at | DATETIME | 部署时间 |

### cert_apply_configs
证书申请配置表，用于手动申请、续期和自动续期复用。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| user_id | TEXT | 当前远端用户 id；历史数据迁移前为 `admin` |
| cert_id | TEXT | 证书 ID，唯一 |
| domain | TEXT | 域名 |
| email | TEXT | ACME 邮箱 |
| provider | TEXT | DNS 服务商 |
| access_key_id | TEXT | DNS AccessKey ID |
| access_key_secret | TEXT | DNS AccessKey Secret（加密） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

## 核心方法

### 账号与数据归属
- `claimLegacyData(targetUserId)` - 将 `user_id = 'admin'` 的历史本地数据迁移到当前远端用户 id。
- `getLocalAdminDataSummary()` - 只读统计历史本地数据，用于内部兼容；登录页不得展示该统计卡。

### 服务器管理
- `saveServer(server, userId)` - 保存/更新当前用户服务器
- `getServer(id, userId)` - 获取当前用户单个服务器（解密敏感字段）
- `getAllServers(userId)` - 获取当前用户所有服务器
- `deleteServer(id, userId)` - 删除当前用户服务器

### 证书管理
- `saveCert(cert, userId)` - 保存/更新当前用户证书
- `getCert(id, userId)` - 获取当前用户单个证书
- `getAllCerts(userId)` - 获取当前用户所有证书
- `deleteCert(id, userId)` - 删除当前用户已过期证书

### 部署配置
- `addCertServerDeployment(certId, serverId, certPath, keyPath, passphrase, userId)` - 添加部署配置
- `getCertDeployedServers(certId, userId)` - 获取证书的所有部署配置

## 迁移策略

数据库初始化时自动执行迁移：
```javascript
try {
  this.db.exec('ALTER TABLE servers ADD COLUMN private_key_path TEXT')
} catch (e) { /* 列已存在 */ }
```

用户隔离迁移规则：
- 旧表缺少 `user_id` 时添加该列。
- 对 `servers`、`certificates`、`cert_apply_configs`、`cert_apply_logs`、`deploy_logs`、`audit_logs`、`server_creation_logs` 中 `user_id IS NULL` 的旧行，初始化时先标记为 `admin`。
- 第一次远端账号成功登录或恢复会话时，`claimLegacyData(remoteUserId)` 将这些 `admin` 行更新为当前远端用户 id。
- 迁移只改变本地行归属，不删除证书内容，也不把证书私钥上传到云端。
