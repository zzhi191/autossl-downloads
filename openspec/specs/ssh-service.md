# SSH 部署服务规范

## 模块路径
`electron/services/ssh-service.js`

## 功能描述
通过 SSH 协议将 SSL 证书部署到远程服务器。

## 核心函数

### `deployCert(server, cert)`

部署证书到远程服务器。

**参数：**
- `server`: 服务器配置对象
  - `host`: 主机地址
  - `port`: SSH 端口（默认 22）
  - `username`: SSH 用户名
  - `password`: SSH 密码（密码认证时使用）
  - `privateKey`: SSH 私钥内容（向后兼容）
  - `privateKeyPath`: 本地 SSH 私钥文件路径（优先使用）
  - `keyPassphrase`: 私钥密码
  - `passphrase`: 部署配置中的私钥密码（备用）
  - `certPath`: 远程服务器上的证书存放路径
  - `keyPath`: 远程服务器上的私钥存放路径
  - `reloadCommand`: 部署后执行的命令
  - `preCommand`: 部署前执行的命令
- `cert`: 证书对象
  - `crt`: 证书内容
  - `key`: 证书私钥内容

**返回：**
- `Promise<{ success: boolean, message?: string, error?: string }>`

## 认证优先级

1. **私钥来源**：
   - 优先使用 `privateKeyPath`（从本地文件读取）
   - 其次使用 `privateKey`（从数据库读取，向后兼容）

2. **私钥密码**：
   - 优先使用 `keyPassphrase`（服务器配置）
   - 其次使用 `passphrase`（部署配置）

## 私钥处理流程

1. **路径解析**：处理 `~` 开头的路径，替换为用户主目录
2. **文件读取**：使用 `fs.readFileSync` 读取私钥内容
3. **字符清理**：
   - 移除非 ASCII 字符
   - 统一换行符（`\r\n`, `\r` → `\n`）
   - 修剪每行首尾空格
4. **格式检测**：
   - 检测是否为 OpenSSH 格式
   - 解析 Cipher 和 KDF 字段判断是否加密
5. **错误诊断**：
   - 如果私钥已加密但未提供密码，输出 `[CRITICAL]` 警告

## 部署流程

1. 建立 SSH 连接
2. 创建本地临时文件（证书和私钥）
3. 执行前置命令（preCommand）
4. 创建远程目录（如果不存在）
5. 通过 SFTP 上传文件
6. 执行重载命令（reloadCommand）
7. 清理临时文件
8. 关闭连接

## 错误处理

| 错误消息 | 原因 |
|---------|------|
| `Cannot parse privateKey: Malformed OpenSSH private key` | 私钥格式错误或密码错误 |
| `无法读取私钥文件` | 私钥路径不存在或无权限 |
| `私钥解密失败` | 数据库加密密钥变化 |
| `Encrypted private OpenSSH key detected, but no passphrase given` | 私钥已加密但未提供密码 |

## 依赖

- `ssh2`: SSH 客户端库
- `fs`: 文件系统操作
- `os`: 获取用户主目录
- `path`: 路径处理
