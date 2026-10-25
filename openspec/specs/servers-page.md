# 服务器管理页面规范

## 模块路径
`src/views/Servers.vue`

## 功能描述
管理用于证书部署的远程服务器配置。

## 页面结构

### 服务器列表
- 展示所有已配置的服务器
- 显示字段：服务器名称、主机地址、端口、用户名
- 操作按钮：编辑、删除

### 添加/编辑服务器对话框

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 服务器名称 | 文本 | ✓ | 用于识别的服务器别名 |
| 主机地址 | 文本 | ✓ | IP 或域名 |
| 端口 | 数字 | ✓ | SSH 端口，默认 22 |
| 用户名 | 文本 | ✓ | SSH 登录用户名 |
| 认证方式 | 单选 | ✓ | 密码 / 私钥 |
| 密码 | 密码框 | * | 密码认证时必填 |
| 本地SSH私钥 | 路径选择 | * | 私钥认证时必填，支持文件选择 |
| 私钥密码 | 密码框 | | 私钥有密码时填写 |
| 重载命令 | 文本区 | | 如 `nginx -s reload` |
| 前置命令 | 文本区 | | 上传证书前执行的命令 |

## 表单校验规则

```javascript
{
  name: [{ required: true, message: '请输入服务器名称' }],
  host: [{ required: true, message: '请输入主机地址' }],
  port: [{ required: true, message: '请输入端口' }],
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ validator: /* 密码认证时必填 */ }],
  privateKeyPath: [{ validator: /* 私钥认证时必填 */ }]
}
```

## IPC 通信

### 获取服务器列表
```javascript
window.electron.ipcRenderer.invoke('server:get-all')
// 返回: Server[]
```

### 保存服务器
```javascript
window.electron.ipcRenderer.invoke('server:save', serverData)
// 返回: { success: boolean, error?: string }
```

### 删除服务器
```javascript
window.electron.ipcRenderer.invoke('server:delete', serverId)
// 返回: boolean
```

### 选择私钥文件
```javascript
window.electron.ipcRenderer.invoke('dialog:open-file', {
  title: '选择SSH私钥文件',
  defaultPath: os.homedir() + '/.ssh',
  properties: ['openFile', 'showHiddenFiles']
})
// 返回: string[] | null
```

## 数据流

```
用户填写表单
    ↓
前端校验
    ↓
调用 server:save IPC
    ↓
后端加密敏感字段（password, keyPassphrase）
    ↓
存入 SQLite 数据库
    ↓
刷新列表
```

## 注意事项

1. **私钥路径**：支持 `~` 开头的路径，如 `~/.ssh/id_rsa`
2. **私钥内容**：不再直接粘贴私钥内容，改为选择本地文件路径
3. **向后兼容**：仍支持旧版本存储的 `privateKey` 字段
4. **安全性**：密码和私钥密码使用 AES-256-CBC 加密后存入数据库
