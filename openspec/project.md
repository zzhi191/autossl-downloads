# AutoSSL - 证书管理客户端

## 项目概述

AutoSSL 是一个基于 Electron + Vue 3 的桌面证书管理客户端，支持自动申请、管理和部署 SSL/TLS 证书到远程服务器。

## 技术栈

- **前端**: Vue 3 + Ant Design Vue 4 + Vite
- **桌面框架**: Electron 28
- **数据库**: better-sqlite3 (本地 SQLite)
- **SSH**: ssh2 库用于远程服务器连接和文件部署
- **ACME**: @certd/acme-client 用于证书申请

## 核心功能

### 1. 证书申请
- 支持阿里云、腾讯云、华为云 DNS 验证
- 基于 ACME 协议（Let's Encrypt）
- 支持通配符证书申请

### 2. 服务器管理
- SSH 密码认证
- SSH 私钥认证（支持从本地文件读取）
- 私钥密码（Passphrase）支持

### 3. 证书部署
- 自动通过 SSH 上传证书到远程服务器
- 支持自定义证书存放路径
- 支持部署后执行重载命令（如 `nginx -s reload`）
- 一键重新部署功能

### 4. 证书监控
- 证书到期时间监控
- 自动续期提醒

## 目录结构

```
autoSSL/
├── electron/                 # Electron 主进程代码
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   ├── db.js                # 数据库操作
│   └── services/            # 后端服务
│       ├── acme-service.js  # ACME 证书申请服务
│       ├── ssh-service.js   # SSH 部署服务
│       └── cert-service.js  # 证书解析服务
├── src/                      # Vue 前端代码
│   ├── views/               # 页面组件
│   │   ├── Certificates.vue # 证书管理页
│   │   ├── Servers.vue      # 服务器管理页
│   │   ├── Apply.vue        # 证书申请页
│   │   └── Login.vue        # 登录页
│   ├── components/          # 通用组件
│   └── router/              # 路由配置
└── package.json
```

## 数据模型

### servers 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 服务器名称 |
| host | TEXT | 主机地址 |
| port | INTEGER | SSH 端口（默认22） |
| username | TEXT | SSH 用户名 |
| password | TEXT | SSH 密码（加密存储） |
| private_key | TEXT | SSH 私钥内容（加密存储，向后兼容） |
| private_key_path | TEXT | 本地 SSH 私钥文件路径 |
| key_passphrase | TEXT | 私钥密码（加密存储） |
| reload_command | TEXT | 部署后执行的命令 |
| pre_command | TEXT | 上传前执行的命令 |

### certificates 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| domain | TEXT | 域名 |
| crt | TEXT | 证书内容 |
| key | TEXT | 证书私钥 |
| expires_time | INTEGER | 过期时间戳 |
| status | TEXT | 状态（valid/expired） |

### cert_server_deployments 表
| 字段 | 类型 | 说明 |
|------|------|------|
| cert_id | TEXT | 证书 ID |
| server_id | TEXT | 服务器 ID |
| cert_path | TEXT | 远程服务器上的证书存放路径 |
| key_path | TEXT | 远程服务器上的私钥存放路径 |
| passphrase | TEXT | 部署时使用的私钥密码 |

## 关键概念区分

### 两种"私钥"

1. **SSH 登录私钥**
   - 位置：本地电脑（如 `~/.ssh/id_rsa`）
   - 作用：让软件能够通过 SSH 登录远程服务器
   - 配置位置：服务器管理页面

2. **SSL 证书私钥**
   - 位置：远程服务器（如 `/etc/nginx/ssl/cert.key`）
   - 作用：HTTPS 加密通信
   - 配置位置：证书部署配置

## 安全设计

- 所有敏感数据（密码、私钥）使用 AES-256-CBC 加密存储
- 加密密钥基于本机 hostname 生成，数据库不可跨机器迁移
- 预加载脚本使用 contextIsolation 隔离

## 授权管理 (Licensing)

AutoSSL 接入了 fogomo OS 统一授权体系：
1. **设备绑定**: 每台安装客户端的设备会生成唯一指纹，并与授权 Key 绑定。
2. **自动升级**: 支持管理员在后台通过机器码直接发放授权，客户端点击“刷新授权”即可自动升级 Pro 版，无需输入 Key。
3. **功能限制**: 系统会自动根据授权等级（Free/Pro/Enterprise）限制可管理的服务器数量和证书申请频率。

## 启动命令

```bash
# 开发模式
npm run electron:dev

# 构建打包
npm run electron:build
```
