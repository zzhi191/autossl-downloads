# autoSSL Release Guide

`autoSSL` 目前已经支持在 GitHub 上针对 macOS 和 Windows 平台完成构建、产物下载和 draft release 生成。

这份文档专门说明发布相关流程，README 里只保留入口和简版说明。

## 相关工作流

### Windows Build

- 文件：`.github/workflows/autossl-windows-build.yml`
- 作用：在 GitHub Windows runner 上构建 `autoSSL`，并上传安装包及升级元数据
- 适合场景：先验证构建链路是否稳定，再决定是否出 release

触发方式：

- 手动从 Actions 页面运行
- 推送到 `main` / `master` / `develop`
- 修改 `autoSSL/**` 的 PR

产物包括：

- `dist-electron/*.exe`
- `latest*.yml`
- `.blockmap`

### macOS Build

- 文件：`.github/workflows/autossl-macos-build.yml`
- 作用：在 GitHub macOS runner 上构建 `autoSSL`，并上传 `dmg`、`zip` 和升级元数据
- 适合场景：先验证 macOS 打包是否稳定，再决定是否出 release

触发方式：

- 手动从 Actions 页面运行
- 推送到 `main` / `master` / `develop`
- 修改 `autoSSL/**` 的 PR

产物包括：

- `dist-electron/*.dmg`
- `dist-electron/*.zip`
- `latest-mac*.yml`
- `.blockmap`

### Desktop Draft Release

- 文件：`.github/workflows/autossl-release-desktop.yml`
- 作用：同时构建 Windows 和 macOS 包，并生成 GitHub draft release

触发方式：

- push 一个 tag，格式为 `autossl-v*`
- 或在 Actions 页面手动运行，并填写 `release_tag`

示例：

```text
autossl-v1.0.0
```

## 最短操作路径

如果你只想尽快走通一轮 GitHub 桌面打包和 draft release，可以按下面顺序执行：

1. 打开 GitHub Actions，运行 `AutoSSL Windows Build`
2. 打开 GitHub Actions，运行 `AutoSSL macOS Build`
3. 到 Artifacts 下载 `autossl-windows-bundle` 和 `autossl-macos-bundle`
4. 如果准备出 release，创建并推送 tag：

```bash
git tag autossl-v1.0.0
git push origin autossl-v1.0.0
```

5. 等 `AutoSSL Desktop Release` 跑完
6. 到 GitHub Releases 下载 draft release 附件并分别安装验证

如果不想 push tag，也可以手动运行 `AutoSSL Desktop Release`，并填写：

```text
release_tag = autossl-v1.0.0
```

## 首次实跑顺序

如果这是这套 workflow 第一次在 GitHub 上实际运行，建议严格按下面顺序验证：

1. 先 push 当前改动到 GitHub
2. 手动运行 `AutoSSL Windows Build`
3. 确认产出 `autossl-windows-bundle`
4. 手动运行 `AutoSSL macOS Build`
5. 确认产出 `autossl-macos-bundle`
6. 两边都成功后，再运行 `AutoSSL Desktop Release`
7. 如果走手动 release，填写：

```text
release_tag = autossl-v1.0.0
```

第一次实跑时，建议重点检查：

- Windows 是否成功产出 `.exe`
- macOS 是否成功产出 `.dmg` 和 `.zip`
- release 页面是否同时挂上两个平台的附件
- `latest*.yml` 和 `.blockmap` 是否一起进入 artifact / release

如果任一单平台 build 失败，不要先跑 release，先修单平台构建问题。

## 标准发布清单

如果你准备实际对外发一个桌面 draft release，建议按这个顺序走：

1. 先确认 `.github/workflows/autossl-windows-build.yml` 至少成功跑过一次
2. 再确认 `.github/workflows/autossl-macos-build.yml` 也至少成功跑过一次
3. 确认当前仓库在 GitHub Windows 和 macOS runner 上都能稳定打包
4. 选择 tag 发布或手动发布
5. 等 workflow 完成后，到 GitHub Releases 页面查看 draft release
6. 下载 release 附件，至少分别做一次本机安装验证
7. 确认安装包可用后，再决定是否发布为正式 release

## 当前边界

当前这套方案已经解决了：

- GitHub 上可构建 Windows 安装包
- GitHub 上可构建 macOS 安装包
- 构建结果可通过 Artifacts 下载
- 可通过 tag 或手动输入 tag 生成双平台 draft release
- release 附件包含两个平台的安装包和升级元数据

当前仍然要注意：

- 生成的是 **unsigned desktop release**
- 还没有接入 Windows 签名证书
- 还没有接入 macOS 签名和 notarization
- 更适合测试分发和内部验证，不等于已完成正式签名发布

## CI 依赖说明

当前 `autoSSL/package.json` 在本地开发中引用了：

```json
"@certd/plugin-lib": "file:../packages/plugins/plugin-lib"
```

由于当前仓库没有把这个本地目录一起提交到 GitHub Actions 环境里，CI 中会临时改用 npm 上已发布的 `@certd/plugin-lib@1.37.7` 完成桌面打包。

这意味着：

- 本地开发仍保留 `file:` 依赖体验
- CI 通过已发布 npm 版本兜底
- 后续如果 monorepo 结构或发布策略调整，可以再统一收敛

## 延伸阅读

完整的实战记录、踩坑过程和设计取舍说明可以看这篇文章：

- https://yijiebuyi.com/blog/autossl-github-windows-build-release/

团队直接照着点的 Actions 操作版文档在这里：

- [GITHUB_ACTIONS_RUNBOOK.md](./GITHUB_ACTIONS_RUNBOOK.md)

## English Quick Guide

`autoSSL` can now build both macOS and Windows packages on GitHub and generate a draft release for download and internal testing.

This section is a short English reference for collaborators who do not read the Chinese release notes.

### Workflows

#### Windows Build

- File: `.github/workflows/autossl-windows-build.yml`
- Purpose: build the Windows installer on GitHub Actions and upload artifacts
- Best for: validating that the Windows packaging pipeline is stable before creating a release

Triggers:

- Manual run from the Actions page
- Push to `main`, `master`, or `develop`
- Pull requests touching `autoSSL/**`

Artifacts include:

- `dist-electron/*.exe`
- `latest*.yml`
- `.blockmap`

#### macOS Build

- File: `.github/workflows/autossl-macos-build.yml`
- Purpose: build the macOS installer and upload artifacts
- Best for: validating that the macOS packaging pipeline is stable before creating a release

Triggers:

- Manual run from the Actions page
- Push to `main`, `master`, or `develop`
- Pull requests touching `autoSSL/**`

Artifacts include:

- `dist-electron/*.dmg`
- `dist-electron/*.zip`
- `latest-mac*.yml`
- `.blockmap`

#### Desktop Draft Release

- File: `.github/workflows/autossl-release-desktop.yml`
- Purpose: build both desktop packages and create a GitHub draft release

Triggers:

- Push a tag matching `autossl-v*`
- Or run the workflow manually with `release_tag`

Example:

```text
autossl-v1.0.0
```

### Shortest Path

If you only want the fastest path to a desktop package and draft release:

1. Run `AutoSSL Windows Build` in GitHub Actions
2. Run `AutoSSL macOS Build` in GitHub Actions
3. Download `autossl-windows-bundle` and `autossl-macos-bundle` from Artifacts
4. If you want a release, create and push a tag:

```bash
git tag autossl-v1.0.0
git push origin autossl-v1.0.0
```

5. Wait for `AutoSSL Desktop Release` to finish
6. Download the draft release assets from GitHub Releases and verify installation locally on each platform

If you do not want to push a tag, you can run `AutoSSL Desktop Release` manually and set:

```text
release_tag = autossl-v1.0.0
```

### Current Limits

What is already covered:

- Windows builds run on GitHub
- macOS builds run on GitHub
- Build outputs are downloadable from Artifacts
- Draft releases can be created by tag or manual trigger
- Release assets include installers and update metadata for both platforms

What is not covered yet:

- The desktop packages are still **unsigned**
- No Windows code signing certificate has been integrated yet
- No macOS signing or notarization has been integrated yet
- The current setup is good for internal testing and controlled distribution, but it is not a fully signed production release flow

### CI Dependency Note

`autoSSL/package.json` currently uses this local dependency during development:

```json
"@certd/plugin-lib": "file:../packages/plugins/plugin-lib"
```

Because that local path is not available in the GitHub Actions environment, CI temporarily switches to the published npm package `@certd/plugin-lib@1.37.7` for desktop builds.

### Related Article

For the full implementation story, tradeoffs, and troubleshooting notes:

- https://yijiebuyi.com/blog/autossl-github-windows-build-release/
