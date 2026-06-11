# Directus 授权系统配置指南

## 环境搭建

我们将使用 Directus 官方脚手架初始化项目，并采用 **Docker Compose** 方案一键启动 Directus + PostgreSQL。

### 1. 初始化项目结构

```bash
# 切换到管理端目录
cd ../admin/licensing-server

# 使用官方脚手架初始化 (我们采用标准结构)
# 包括: uploads/, extensions/, .env, package.json
```

### 2. Docker Compose 配置 (`docker-compose.yml`)

```yaml
version: '3'
services:
  database:
    image: postgres:15
    volumes:
      - ./data/db:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: directus

  directus:
    image: directus/directus:latest
    ports:
      - 8055:8055
    volumes:
      - ./uploads:/directus/uploads
      - ./extensions:/directus/extensions
    environment:
      KEY: 'random-key'
      SECRET: 'random-secret'
      DB_CLIENT: 'pg'
      DB_HOST: 'database'
      DB_PORT: '5432'
      DB_DATABASE: 'directus'
      DB_USER: 'directus'
      DB_PASSWORD: 'your_password'
      ADMIN_EMAIL: 'admin@example.com'
      ADMIN_PASSWORD: 'admin_password'
    depends_on:
      - database
```

## 数据模型初始化 (Collections)

进入 Directus 后台后，首要任务是创建核心表：

1. **Apps**: `id`, `name`, `app_key`, `secret_token`
2. **Plans**: `id`, `app` (M2O), `name`, `max_devices`, `features`, `price`
3. **Licenses**: `id`, `license_key`, `app` (M2O), `plan` (M2O), `status`, `expiry_date`
4. **Devices**: `id`, `license` (M2O), `fingerprint`, `last_heartbeat`

## 授权 API 调用示例

### 1. 验证授权
**请求**: `GET /items/Licenses?filter[license_key][_eq]=XXX&fields=*,app.*,plan.*`
**Header**: `Authorization: Static-Token <Shared-Token>`

### 2. 绑定设备
**请求**: `POST /items/Devices`
**Body**:
```json
{
  "license": "LICENSE_ID",
  "fingerprint": "DEVICE_ID",
  "device_name": "My MacBook"
}
```

## 扩展建议

- **自定义端点**: 在 `extensions/endpoints` 下编写自定义 Node.js 逻辑以处理复杂的加密校验。
- **自定义面板**: 在 `extensions/displays` 下编写 Vue3 组件，在 Directus 后台直接展示证书状态图表。
- **数据同步**: 利用 Directus 的 Webhooks 将授权状态同步给其他业务系统。
