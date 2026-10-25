# 自动续期服务规范

## 模块路径
`electron/services/auto-renew-service.js`

## 功能描述
自动检测证书过期时间，在证书即将过期时自动重新申请并部署到所有已配置的服务器。

## 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `RENEW_THRESHOLD_DAYS` | 10 | 续期阈值（天） |
| `CHECK_INTERVAL_MS` | 86400000 | 检查间隔（24小时） |

## 完整自动续期流程

```
应用启动
    ↓
延迟 10 秒执行首次检查
    ↓
遍历所有证书
    ↓
检测剩余天数 ≤ 10 天？
    ↓ 是
从 cert_apply_configs 读取 DNS 配置
    ↓
配置存在？
    ↓ 是                    ↓ 否
调用 AcmeService.applyCert()    发送提醒通知
    ↓
更新证书记录
    ↓
从 cert_server_deployments 读取部署配置
    ↓
依次调用 SshService.deployCert()
    ↓
发送成功/失败通知
```

## 核心函数

### `init(db, acme, ssh)`
初始化自动续期服务。

### `checkAndRenew()`
执行证书过期检查和自动续期。

### `renewCertificate(cert)`
续期单个证书：
1. 读取保存的申请配置
2. 调用 ACME 服务申请新证书
3. 更新数据库中的证书记录
4. 部署到所有已配置的服务器

### `deployToAllServers(certId, cert)`
部署证书到所有已配置的服务器。

## 数据库表

### cert_apply_configs
保存证书申请配置，用于自动续期。

| 字段 | 类型 | 说明 |
|------|------|------|
| cert_id | TEXT | 证书 ID（唯一） |
| domain | TEXT | 域名 |
| email | TEXT | 申请邮箱 |
| provider | TEXT | DNS 提供商（aliyun/tencent） |
| access_key_id | TEXT | AccessKey ID（加密） |
| access_key_secret | TEXT | AccessKey Secret（加密） |

## 通知类型

| 场景 | 标题 | 内容 |
|------|------|------|
| 开始续期 | 证书自动续期开始 | 正在为 xxx 自动续期证书... |
| 续期成功 | 证书自动续期成功 | xxx 已自动续期并部署到所有服务器 |
| 续期失败 | 证书自动续期失败 | xxx: 错误信息 |
| 无配置 | 证书即将过期 | xxx 将在 N 天后过期，请手动重新申请 |

## 日志示例

```
[Auto-Renew] Starting certificate expiry check...
[Auto-Renew] example.com: 89 days remaining
[Auto-Renew] expiring.com: 8 days remaining
[Auto-Renew] expiring.com needs renewal (8 days left)
[Auto-Renew] Starting automatic renewal for expiring.com
[Auto-Renew] expiring.com - init: 正在初始化证书申请环境...
[Auto-Renew] expiring.com - acme: 开始执行 ACME 自动化流程...
[Auto-Renew] Certificate renewed for expiring.com
[Auto-Renew] Deploying to 2 server(s)...
[Auto-Renew] Deployed to 生产服务器 successfully
[Auto-Renew] Deployed to 测试服务器 successfully
[Notification] 证书自动续期成功: expiring.com 已自动续期并部署到所有服务器
[Auto-Renew] Check completed
```

## 注意事项

1. **配置保存时机**：证书首次申请成功后自动保存配置
2. **旧证书兼容**：已存在但无配置的证书只会收到提醒通知
3. **失败处理**：续期失败会发送通知，并记录到申请日志
4. **部署失败独立**：单个服务器部署失败不影响其他服务器
