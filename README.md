# Certd Electron 客户端

证书管理客户端 - 自动申请和部署 SSL 证书

## 项目位置

项目位于 `certd` 根目录下的 `certd-electron/`，可以直接引用 certd 的核心模块。

## 功能特性

- ✅ 服务器管理（SSH 连接配置）
- ✅ 证书管理（申请、查看、删除）
- ✅ 证书过期监控
- ✅ 自动部署证书到远程服务器
- ✅ SQLite 本地数据存储
- ✅ 数据加密存储
- ✅ 使用 certd 的 acme-client，并内置 DNS/SSH 部署实现

## 当前打包状态

- macOS：本地打包脚本和 GitHub Actions workflow 已补齐
- Windows：本地打包脚本和 GitHub Actions workflow 已补齐
- Draft Release：已升级为 macOS + Windows 双平台 draft release workflow
- macOS Release：生成可安装的 `.dmg` 和 `.zip`，不走 Mac App Store
- 当前边界：未签名 DMG 可用于直接下载/内部安装；首次打开可能触发 macOS Gatekeeper 提示

## 快速开始

### 安装依赖

```bash
cd certd-electron
npm install
```

### 开发模式

```bash
npm run electron:dev
# 或
./start.sh
```

### 构建应用

```bash
npm run electron:build
```

### Windows 安装包

在 Windows 机器上可直接构建 NSIS 安装包：

```bash
npm run electron:build:win
```

产物默认输出到 `autoSSL/dist-electron/`。

- Windows 安装包通常位于 `dist-electron/*.exe`
- 同目录还会生成 `latest*.yml` 和 `.blockmap` 等升级元数据

### macOS 安装包

在 macOS 机器上可直接构建 `dmg` 和 `zip` 安装包：

```bash
npm run electron:build:mac
```

产物同样默认输出到 `autoSSL/dist-electron/`。

- macOS 安装包通常位于 `dist-electron/*.dmg`
- 同目录还会生成 `dist-electron/*.zip`、`latest-mac*.yml` 和 `.blockmap`

### GitHub Actions 桌面打包

参考 `smartControl` 的桌面构建方式，仓库根目录现在提供了两条构建工作流和一条双平台 release 工作流：

- Windows Build：`.github/workflows/autossl-windows-build.yml`
- macOS Build：`.github/workflows/autossl-macos-build.yml`
- Desktop Release：`.github/workflows/autossl-release-desktop.yml`

构建工作流支持：

- 手动从 Actions 页面运行
- 推送到 `main` / `master` / `develop`
- 修改 `autoSSL/**` 的 PR

其中 Windows Build 会：

1. 在 `windows-latest` 上拉取代码
2. 安装 `autoSSL` 依赖
3. 构建 Vite 前端
4. 执行 `npm run electron:build:win`
5. 上传生成的 `.exe`、`.blockmap`、`latest*.yml` 为 workflow artifacts

macOS Build 会：

1. 在 `macos-14` 上拉取代码
2. 安装 `autoSSL` 依赖
3. 执行 `npm run electron:build:mac`
4. 上传生成的 `.dmg`、`.zip`、`.blockmap`、`latest-mac*.yml` 为 workflow artifacts

如果你只想快速验证单平台打包链路，可以分别运行：

- `AutoSSL Windows Build`
- `AutoSSL macOS Build`

然后到 Artifacts 下载：

- `autossl-windows-bundle`
- `autossl-macos-bundle`

### GitHub Draft Release（macOS + Windows）

如果希望像 `smartControl` 一样在 GitHub 上生成一个同时包含 macOS 和 Windows 安装包的 draft release，可以使用：

- 文件：`.github/workflows/autossl-release-desktop.yml`
- 触发：
  - push 一个 tag，格式为 `autossl-v*`
  - 或在 Actions 页面手动运行，并填写 `release_tag`
- 示例：`autossl-v1.0.0`

这个工作流会：

1. 分别在 `windows-latest` 和 `macos-14` 上构建桌面安装包
2. 收集两个平台的产物
3. 创建一个 draft GitHub Release
4. 一次性附带上传 Windows 和 macOS 安装包及升级元数据

注意：当前目标是生成可安装的 DMG，不发布 Mac App Store。未签名/未公证的 DMG 仍可安装，但用户首次打开时可能需要在系统设置里允许打开；后续如果要减少 Gatekeeper 提示，可以再走可选的 Developer ID 签名和 notarization。

完整发布流程、最短路径、tag 规范和 release 检查项已经整理到：

- [RELEASE.md](./RELEASE.md)
- [GITHUB_ACTIONS_RUNBOOK.md](./GITHUB_ACTIONS_RUNBOOK.md)

### 延伸阅读

如果你想看这次 GitHub Windows 打包和 Draft Release 的完整落地过程、踩坑点与触发方式说明，可以直接看这篇文章：

- 博客地址：https://yijiebuyi.com/blog/autossl-github-windows-build-release/

## 项目结构

```
certd-electron/
├── electron/              # Electron 主进程
│   ├── main.js          # 主进程入口
│   ├── preload.js       # 预加载脚本
│   ├── db.js            # SQLite 数据库
│   └── services/        # 服务模块
│       ├── acme-service.js    # ACME 证书申请（使用 certd 的 acme-client）
│       ├── ssh-service.js     # SSH 部署
│       └── cert-service.js   # 证书管理
├── src/                  # 前端代码
│   ├── views/           # 页面组件
│   ├── router/          # 路由配置
│   └── main.js          # 前端入口
└── package.json
```

## 使用说明

1. **添加服务器**：配置 SSH 连接信息和证书部署路径
2. **申请证书**：通过 ACME 协议申请 SSL 证书（使用 certd 的 acme-client）
3. **部署证书**：自动将证书部署到远程服务器
4. **监控过期**：自动监控证书过期时间，及时提醒

## 技术栈

- Electron 40
- Vue 3
- Ant Design Vue
- Better-SQLite3
- 使用 certd 的 `@certd/acme-client`

## 注意事项

- 证书和服务器密码等敏感信息会加密存储
- 确保 SSH 用户有证书目录的写入权限
- 重载命令需要配置正确（如 nginx -s reload）
- 项目使用端口 **6173**（可在 vite.config.js 中修改）

## 开发说明

ACME 申请使用 `@certd/acme-client`，DNS 服务商和 SSH 部署逻辑由当前客户端内置实现。
