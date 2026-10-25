# 多项目通用授权系统实现计划 (Directus 架构)

## 概述

本项目旨在建立一个可扩展的通用授权中心，不仅支持当前的 `Certd Electron`，还可无缝接入未来开发的任何软件。系统采用 **Directus** 作为后端心脏，负责数据模型管理、API 分发和管理后台。

## 核心设计思想

- **多租户/多应用支持**：通过 `Apps` 表隔离不同软件的授权。
- **配置驱动**：套餐和功能限制通过数据库配置，无需修改代码。
- **安全优先**：采用设备指纹绑定和心跳校验。
- **零代码管理**：管理人员直接通过 Directus 优雅的 UI 进行日常运维。

## 实现阶段

### 第一阶段：基础设施与数据模型 ✅ 已完成
- [x] 1.1 在 `admin/licensing-server` 目录下初始化 Directus 环境
- [x] 1.2 配置 PostgreSQL 数据库连接
- [x] 1.3 配置 Redis 缓存（可选）
- [x] 1.4 创建核心 API 端点：
    - [x] `/license/verify` - 授权验证
    - [x] `/license/activate` - 激活授权
    - [x] `/license/heartbeat` - 心跳检测
    - [x] `/license/deactivate` - 解绑设备
- [x] 1.5 创建支付集成端点：
    - [x] `/payment/create-order` - 创建订单
    - [x] `/payment/wechat/notify` - 微信支付回调
    - [x] `/payment/alipay/notify` - 支付宝回调
    - [x] `/payment/order-status/:orderNo` - 订单状态查询
- [x] 1.6 编写完整的 OpenSpec 文档

### 第二阶段：数据库初始化与测试 (进行中)
- [ ] 2.1 启动 Directus 服务
- [ ] 2.2 在 Directus 后台创建数据模型：
    - [ ] `Apps`: 管理不同的软件产品
    - [ ] `Plans`: 配置不同应用下的套餐等级
    - [ ] `Licenses`: 核心授权码表
    - [ ] `Devices`: 设备绑定与活跃记录
    - [ ] `Orders`: 订单记录
- [ ] 2.3 配置权限角色 (RBAC)：为客户端分配受限的 API 访问权限
- [ ] 2.4 添加示例数据进行测试
- [ ] 2.5 测试所有 API 端点

### 第三阶段：客户端接入 (Certd Electron)
- [ ] 3.1 在客户端实现 `license-service.js`
- [ ] 3.2 实现设备指纹采集逻辑
- [ ] 3.3 创建激活界面 UI
- [ ] 3.4 实现激活、验证、心跳的全流程
- [ ] 3.5 添加授权过期提醒
- [ ] 3.6 实现功能限制检查（域名数、服务器数）

### 第四阶段：支付集成
- [ ] 4.1 接入微信支付 SDK
- [ ] 4.2 接入支付宝 SDK
- [ ] 4.3 完善支付回调逻辑
- [ ] 4.4 测试支付流程
- [ ] 4.5 添加订单超时处理

### 第五阶段：安全加固
- [ ] 5.1 添加代码混淆（客户端）
- [ ] 5.2 ASAR 加密
- [ ] 5.3 请求签名验证
- [ ] 5.4 防调试检测
- [ ] 5.5 时间篡改检测

## 已创建的文件

### 服务端 (`admin/licensing-server/`)
- `package.json` - 项目配置
- `.env` - 环境变量（已配置测试数据库）
- `.env.example` - 环境变量模板
- `README.md` - 项目说明文档
- `extensions/endpoints/license/index.js` - 授权 API
- `extensions/endpoints/payment/index.js` - 支付 API

### 文档 (`certd-electron/openspec/specs/licensing-v2/`)
- `implementation-plan.md` - 实现计划
- `database-v2.md` - 数据库设计
- `directus-config.md` - Directus 配置指南
- `client-integration-api.md` - 客户端集成 API 规范

## 下一步操作

**立即可执行：**

1. **启动服务**：
```bash
cd admin/licensing-server
npm install
npx directus bootstrap
npm start
```

2. **访问后台**：http://localhost:8055
   - 用户名：admin@certd.io
   - 密码：admin123456（见 .env）

3. **创建数据模型**：参照 `database-v2.md` 在后台手动创建 Collections

4. **测试 API**：使用 Postman 或 curl 测试授权端点

## 扩展性说明

- **接入新应用**：只需在 `Apps` 表新增一条记录，并在 `Plans` 表配置对应的套餐，新应用即可立即使用现成的授权接口。
- **自定义业务**：通过 Directus Flows 实现特定应用的逻辑，如"激活后自动发送欢迎邮件"。
