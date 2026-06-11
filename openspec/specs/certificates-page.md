# 证书管理页面规范

## 模块路径
`src/views/Certificates.vue`

## 功能描述
管理已申请的 SSL 证书，配置和执行证书部署。

## 页面结构

### 证书列表
| 列 | 说明 |
|----|------|
| 域名 | 证书覆盖的域名 |
| 部署服务器 | 已配置的目标服务器标签 |
| 状态 | 有效/已过期 |
| 剩余天数 | 距离过期的天数 |
| 过期时间 | 证书到期日期 |
| 操作 | 部署、一键重新部署、重新申请、删除 |

### 操作按钮

1. **部署**：打开部署配置对话框
2. **一键重新部署**：使用已保存的配置重新部署到所有关联服务器
3. **重新申请**：跳转到申请页面重新申请证书
4. **删除**：删除证书记录

### 部署配置对话框

#### 服务器部署配置
| 字段 | 类型 | 说明 |
|------|------|------|
| 服务器 | 下拉选择 | 选择已配置的服务器 |
| 证书路径 | 文本 | 远程服务器上的证书存放路径 |
| 私钥路径 | 文本 | 远程服务器上的私钥存放路径 |
| 私钥密码 | 密码框 | SSH 私钥的密码（如果有） |

**路径说明提示**：
- 证书路径：`这是远程服务器上的证书文件路径`
- 私钥路径：`这是远程服务器上的 SSL 证书私钥文件路径`

## IPC 通信

### 获取证书列表
```javascript
window.electron.ipcRenderer.invoke('cert:get-all')
```

### 添加部署配置
```javascript
window.electron.ipcRenderer.invoke('cert:add-deployment', 
  certId, serverId, certPath, keyPath, passphrase
)
```

### 执行部署
```javascript
window.electron.ipcRenderer.invoke('deploy:cert',
  certId, serverId, certPath, keyPath, passphrase
)
// 返回: { success: boolean, message?: string, error?: string }
```

### 获取已部署服务器
```javascript
window.electron.ipcRenderer.invoke('cert:get-deployed-servers', certId)
// 返回: DeployedServer[]
```

## 一键重新部署流程

```
用户点击"一键重新部署"
    ↓
显示确认对话框
    ↓
遍历所有已部署服务器配置
    ↓
依次调用 deploy:cert
    ↓
汇总结果并显示
```

## 部署状态反馈

- **成功**：绿色提示 "部署成功"
- **失败**：红色提示，显示具体错误信息
- **批量部署**：显示成功/失败数量统计

## 注意事项

1. **路径区分**：
   - 证书路径/私钥路径 = 远程服务器上的路径
   - 本地SSH私钥 = 本地电脑上用于登录服务器的私钥（在服务器管理中配置）

2. **密码优先级**：
   - 部署配置中的私钥密码 < 服务器配置中的私钥密码

3. **部署记录持久化**：
   - 每次配置部署后会保存到 `cert_server_deployments` 表
   - 一键重新部署时从数据库读取配置
