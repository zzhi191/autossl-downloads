# 授权服务器数据库设计

## 数据库选型
PostgreSQL

## 表结构

### users
用户表

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  avatar_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',  -- active, suspended, deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### licenses
授权码表

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(50) UNIQUE NOT NULL,  -- XXXX-XXXX-XXXX-XXXX
  user_id UUID REFERENCES users(id),
  plan VARCHAR(20) NOT NULL,  -- free, professional, enterprise
  status VARCHAR(20) DEFAULT 'inactive',  -- inactive, active, expired, revoked
  max_devices INT DEFAULT 1,
  max_domains INT DEFAULT 1,  -- -1 表示无限
  max_servers INT DEFAULT 1,
  features JSONB DEFAULT '[]',
  expires_at TIMESTAMP,
  activated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_user ON licenses(user_id);
```

### devices
设备绑定表

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  device_id VARCHAR(100) NOT NULL,  -- 设备指纹
  device_name VARCHAR(100),
  platform VARCHAR(50),  -- darwin, win32, linux
  last_seen_at TIMESTAMP,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(license_id, device_id)
);

CREATE INDEX idx_devices_license ON devices(license_id);
CREATE INDEX idx_devices_fingerprint ON devices(device_id);
```

### subscriptions
订阅表

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  license_id UUID REFERENCES licenses(id),
  plan VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, active, cancelled, expired
  period VARCHAR(20) NOT NULL,  -- monthly, yearly
  amount INT NOT NULL,  -- 金额（分）
  currency VARCHAR(10) DEFAULT 'CNY',
  auto_renew BOOLEAN DEFAULT true,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### orders
订单表

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount INT NOT NULL,  -- 金额（分）
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending',  -- pending, paid, failed, refunded
  payment_method VARCHAR(20),  -- wechat, alipay
  payment_id VARCHAR(100),  -- 第三方支付流水号
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_no ON orders(order_no);
CREATE INDEX idx_orders_status ON orders(status);
```

### verify_logs
验证日志表（用于分析和安全审计）

```sql
CREATE TABLE verify_logs (
  id BIGSERIAL PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  device_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  result VARCHAR(20),  -- success, failed, expired
  error_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verify_logs_license ON verify_logs(license_id);
CREATE INDEX idx_verify_logs_time ON verify_logs(created_at);
```

## 授权码格式

格式：`XXXX-XXXX-XXXX-XXXX`

生成规则：
```javascript
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除易混淆字符
  const segments = []
  for (let i = 0; i < 4; i++) {
    let segment = ''
    for (let j = 0; j < 4; j++) {
      segment += chars[Math.floor(Math.random() * chars.length)]
    }
    segments.push(segment)
  }
  return segments.join('-')
}
```

## 版本功能配置

```javascript
const PLANS = {
  free: {
    maxDomains: 1,
    maxServers: 1,
    maxDevices: 1,
    features: []
  },
  professional: {
    maxDomains: -1,  // 无限
    maxServers: 5,
    maxDevices: 2,
    features: ['auto_renew', 'priority_support']
  },
  enterprise: {
    maxDomains: -1,
    maxServers: -1,
    maxDevices: 5,
    features: ['auto_renew', 'priority_support', 'api_access', 'white_label']
  }
}
```

## 定价配置

```javascript
const PRICING = {
  professional: {
    monthly: 1900,   // ¥19/月
    yearly: 9900     // ¥99/年 (省¥129)
  },
  enterprise: {
    monthly: 4900,   // ¥49/月
    yearly: 29900    // ¥299/年 (省¥289)
  }
}
```
