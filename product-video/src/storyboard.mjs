export const TOTAL_FRAMES = 450;

export const SCENES = [
  {
    id: "problem",
    from: 0,
    to: 75,
    eyebrow: "AUTOSSL",
    title: "证书管理，不该是待办事项",
  },
  {
    id: "control",
    from: 75,
    to: 150,
    title: "服务器、域名、证书，一处管理",
  },
  {
    id: "request",
    from: 150,
    to: 225,
    title: "ACME 自动申请",
    detail: "DNS 验证",
  },
  {
    id: "deploy",
    from: 225,
    to: 300,
    title: "SSH 自动部署",
    detail: "证书即刻生效",
  },
  {
    id: "protect",
    from: 300,
    to: 375,
    title: "到期监控",
    detail: "自动续期",
  },
  {
    id: "end",
    from: 375,
    to: 450,
    title: "把证书管理交给自动化",
    detail: "申请 · 部署 · 续期，一处完成",
  },
];
