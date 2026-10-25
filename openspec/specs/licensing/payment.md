# 支付集成规范

## 支付渠道

### 1. 微信支付
- Native 支付（扫码支付）
- 适用于桌面客户端

### 2. 支付宝 (目前已暂停支持)
> 💡 注意：当前仅配置并激活了微信支付渠道。支付宝扫码支付功能目前在 UI 侧已屏蔽。

## 支付流程

```
用户选择套餐
    ↓
客户端调用 /subscription/create
    ↓
服务端创建订单
    ↓
服务端调用支付平台生成支付链接
    ↓
返回支付二维码/链接
    ↓
客户端显示二维码
    ↓
用户扫码支付
    ↓
支付平台回调服务端
    ↓
服务端更新订单状态
    ↓
服务端激活/续期授权
    ↓
客户端轮询订单状态
    ↓
支付成功，刷新授权信息
```

## 微信支付集成

### 配置
```javascript
const wechatConfig = {
  appid: 'wx...',
  mchid: '商户号',
  apiKey: 'API密钥',
  serialNo: '证书序列号',
  privateKey: '商户私钥',
  notifyUrl: 'https://license.certd.io/api/v1/payment/wechat/notify'
}
```

### 创建订单 API
```javascript
// POST /v3/pay/transactions/native
{
  appid: 'wx...',
  mchid: '商户号',
  description: 'Certd 专业版 - 年付',
  out_trade_no: 'ORDER_202601230001',
  notify_url: 'https://...',
  amount: {
    total: 9900,
    currency: 'CNY'
  }
}
```

### 回调处理
```javascript
app.post('/payment/wechat/notify', async (req, res) => {
  // 1. 验证签名
  // 2. 解密通知数据
  // 3. 更新订单状态
  // 4. 激活授权
  res.json({ code: 'SUCCESS', message: '成功' })
})
```

## 支付宝集成 (Legacy/Disabled)

### 配置
```javascript
const alipayConfig = {
  appId: '应用ID',
  privateKey: '应用私钥',
  alipayPublicKey: '支付宝公钥',
  gateway: 'https://openapi.alipay.com/gateway.do',
  notifyUrl: 'https://license.certd.io/api/v1/payment/alipay/notify'
}
```

### 创建订单
```javascript
// alipay.trade.precreate
{
  out_trade_no: 'ORDER_202601230001',
  total_amount: '99.00',
  subject: 'Certd 专业版 - 年付'
}
```

## 订单状态轮询

客户端创建订单后，每 3 秒轮询一次订单状态：

```javascript
// GET /orders/{orderId}/status
{
  "status": "pending" | "paid" | "failed" | "expired"
}
```

轮询超时时间：5 分钟

## 退款流程

```
用户申请退款
    ↓
管理员审核
    ↓
调用支付平台退款 API
    ↓
更新订单状态为 refunded
    ↓
撤销授权
```

## 自动续费

### 微信支付委托代扣
1. 用户首次支付时签约
2. 到期前 3 天自动扣款
3. 失败则发送通知提醒手动续费

### 续费提醒
- 到期前 7 天：应用内通知
- 到期前 3 天：邮件通知
- 到期前 1 天：强提醒

## 发票管理

### 发票信息表
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20),  -- personal, company
  title VARCHAR(200),
  tax_no VARCHAR(50),
  amount INT,
  status VARCHAR(20),  -- pending, issued, sent
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 开票流程
1. 用户填写发票信息
2. 调用电子发票平台 API
3. 生成 PDF 并存储
4. 发送到用户邮箱
