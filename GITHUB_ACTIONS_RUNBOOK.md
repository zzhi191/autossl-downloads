# autoSSL GitHub Actions 操作说明

这份文档给团队成员直接照着操作用，不需要先理解完整实现细节。

适用范围：

- 验证 `autoSSL` 的 Windows 打包
- 验证 `autoSSL` 的 macOS 打包
- 生成一个同时包含 macOS 和 Windows 附件的 draft release

## 先决条件

开始前请先确认：

- 相关改动已经 push 到 GitHub
- GitHub 仓库里能看到以下 Actions：
  - `AutoSSL Windows Build`
  - `AutoSSL macOS Build`
  - `AutoSSL Desktop Release`

## 日常验证顺序

如果只是想验证这次代码能不能正常出桌面包，按下面顺序执行：

1. 打开 GitHub 仓库的 `Actions`
2. 运行 `AutoSSL Windows Build`
3. 等待成功后，打开本次运行的 `Artifacts`
4. 确认存在 `autossl-windows-bundle`
5. 回到 `Actions`
6. 运行 `AutoSSL macOS Build`
7. 等待成功后，打开本次运行的 `Artifacts`
8. 确认存在 `autossl-macos-bundle`

只要这两条都成功，就说明当前代码已经具备 GitHub 桌面打包能力。

## 出 draft release 的顺序

如果要生成一个可下载的 draft release，建议按下面顺序执行：

1. 先确认 `AutoSSL Windows Build` 已成功
2. 再确认 `AutoSSL macOS Build` 已成功
3. 回到 `Actions`
4. 运行 `AutoSSL Desktop Release`
5. 如果是手动运行，输入：

```text
release_tag = autossl-v1.0.0
```

6. 等待 workflow 完成
7. 打开 GitHub 仓库的 `Releases`
8. 找到新生成的 draft release
9. 检查附件是否同时包含：
   - Windows `.exe`
   - macOS `.dmg`
   - macOS `.zip`
   - `latest*.yml`
   - `.blockmap`

## tag 发布方式

如果你希望通过 git tag 触发 desktop release，可以执行：

```bash
git tag autossl-v1.0.0
git push origin autossl-v1.0.0
```

推送后，`AutoSSL Desktop Release` 会自动触发。

## 团队重点检查项

每次跑完建议至少检查这几项：

- Windows 构建是否真的产出了 `.exe`
- macOS 构建是否真的产出了 `.dmg` 和 `.zip`
- release 页面是否同时挂上两个平台的附件
- `latest*.yml` 和 `.blockmap` 是否一起生成
- release 是否仍是 `draft` 状态，而不是误发正式版

## 当前边界

这套流程当前是可构建、可下载、可生成 draft release 的状态，但还不是最终正式发行状态。

当前要明确知道：

- Windows 包还是 unsigned
- macOS 包也还是 unsigned
- 还没有接入 Windows 代码签名证书
- 还没有接入 macOS 签名和 notarization

所以这套流程更适合：

- 内部验证
- 小范围测试分发
- release 节点检查

暂时不等于：

- 正式签名发行
- 面向所有外部用户的最终发布方案

## 失败时怎么处理

如果某一步失败，建议这样处理：

- `Windows Build` 失败：先修 Windows 构建，不要直接跑 release
- `macOS Build` 失败：先修 macOS 构建，不要直接跑 release
- `Desktop Release` 失败：先确认前两个单平台 build 是否本来就成功

一个简单原则：

- 单平台 build 没稳定前，不要跳过直接发 release

## 相关文档

- 发布说明：[RELEASE.md](./RELEASE.md)
- 项目主页说明：[README.md](./README.md)
- 详细博客文章：https://yijiebuyi.com/blog/autossl-github-windows-build-release/
