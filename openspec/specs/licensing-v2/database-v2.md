# 多应用授权系统数据库设计 (Directus Collections)

## 核心集合 (Collections)

### 1. Apps (应用表)
管理所有接入授权系统的软件产品。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 内部主键 |
| `name` | String | 应用名称 (如: Certd Electron) |
| `app_key` | String | 用于区分应用的唯一标识 (如: `certd_electron`) |
| `secret_token` | String | 用于 API 签名的密钥 |
| `status` | Enum | `active`, `suspended` |
| `icon` | File | 应用图标 |

### 2. Plans (套餐配置表)
定义每个应用的收费等级。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 内部主键 |
| `app` | M2O | 关联 `Apps` |
| `name` | String | 套餐名称 (如: 专业版) |
| `code` | String | 套餐编码 (如: `professional`) |
| `max_devices` | Integer | 允许绑定的最大设备数 (-1 为无限) |
| `max_domains` | Integer | 业务限制：最大域名数 |
| `max_servers` | Integer | 业务限制：最大服务器数 |
| `features` | JSON | 功能开关数组 (如: `["auto_renew", "ssh_key_picker"]`) |
| `yearly_price` | Float | 年付价格 (元) |

### 3. Licenses (授权记录表)
核心授权码。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 内部主键 |
| `license_key` | String | 唯一授权码 (XXXX-XXXX-XXXX-XXXX) |
| `app` | M2O | 关联 `Apps` |
| `plan` | M2O | 关联 `Plans` |
| `user_email` | String | 购买者邮箱 |
| `status` | Enum | `active`, `expired`, `blocked` |
| `expiry_date` | DateTime | 到期时间 |
| `activated_at` | DateTime | 首次激活时间 |

### 4. Devices (设备绑定表)
记录具体绑定的硬件。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 内部主键 |
| `license` | M2O | 关联 `Licenses` |
| `device_fingerprint` | String | 客户端生成的设备唯一指纹 |
| `device_name` | String | 用户自定义名称或系统名称 |
| `platform` | String | darwin, win32, linux |
| `last_heartbeat` | DateTime | 最后一次校核时间 |

### 5. Orders (财务流水表)
关联支付记录。

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 内部主键 |
| `order_no` | String | 支付平台单号 |
| `license` | M2O | 关联新生成或续费的 `Licenses` |
| `amount` | Float | 支付金额 |
| `pay_status` | Enum | `paid`, `pending`, `failed` |

## 权限设计 (RBAC)

### 角色: `SoftwareClient`
- **Licenses**: 仅允许读取（通过 Filter 匹配自己的 Key）。
- **Devices**: 允许读取（属于自己的 Key）、允许创建、允许修改 `last_heartbeat`。
- **Apps**: 发起请求时需携带 `app_key` 进行校验。

## Flows 自动化流程设计

1. **支付回调 Flow**: 
   - 触发: Webhook (支付宝/微信通知)。
   - 动作: 更新 `Orders` 状态 -> 查找或创建 `Licenses` -> 发送邮件告知用户授权码。

2. **过期检测 Flow**:
   - 触发: Cron 定时任务 (每日)。
   - 动作: 更新 `expiry_date` 已过的 `Licenses` 状态为 `expired`。
