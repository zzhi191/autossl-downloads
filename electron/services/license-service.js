
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');

const STORE_KEY = 'license_data';
const OFFLINE_GRACE_DAYS = 7;
const OFFLINE_GRACE_MS = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;

// 🔒 SECURITY HARDENING: Public key is hardcoded to prevent file tampering
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4TWuANPpLwBFD8C0cFwa
Djkh7gfFDjSiQ0r8Fv7O6BNJDHXbW74Tdrcnd8Icd7hN9NoNsmKMGE43yBxGK4mk
XvFTAI3D/req2M9VUF4GnqO8CWNo0PCUpv5z57jjYCfaCCUCU+deQ+8/UgPydH2W
fTc1gYhEkLATYYcZ6D/4zq3hGA21WCzFnu5Hn9QENt2WrhNav+9lQDVETHq7Ra4I
eGi3pVzeteOuOTREdOHiGeLQnm1N9J+D2GKqwHJZM1a7QhrAmTMcSdT1gMB4Ype9
HtvusWPYndNzeyiK7bp92Ai+zAEIP/rCLIKe8n5FcFhrEdVXltYfpR1atLXhpfZb
IwIDAQAB
-----END PUBLIC KEY-----`;

const APP_CODE = 'certd-electron';
const API_BASE_URL = `https://tools.fogomo.com/api/${APP_CODE}/electron/license`;

class LicenseService {
  constructor() {
    this.store = null;
    this.machineId = this.getStableMachineId();
    this._initialized = false;
  }

  /**
   * 获取极度稳定的设备指纹
   * 策略: 持久化文件 -> 兼容旧版 ID -> 原生 ID -> 随机生成并持久化
   */
  getStableMachineId() {
    let id = '';
    const idFilePath = path.join(os.homedir(), '.certd_device_id');

    // 1. 优先读取已持久化 ID，避免升级后 device_id 漂移
    try {
      if (fs.existsSync(idFilePath)) {
        id = fs.readFileSync(idFilePath, 'utf8').trim();
        if (id && id.length > 10) {
          console.log('[License] Using persistent ID from file:', idFilePath);
          return id;
        }
      }
    } catch (e) {
      console.error('[License] Read persistent ID failed', e);
    }

    // 2. 兼容旧版：优先沿用 node-machine-id 默认哈希值
    try {
      id = machineIdSync();
      if (id) {
        fs.writeFileSync(idFilePath, id, { mode: 0o600 });
        console.log('[License] Migrated legacy machine ID to file:', idFilePath);
        return id;
      }
    } catch (e) {
      console.warn('[License] Legacy machineId failed, trying original machineId...');
    }

    // 3. 新版回退：使用 original:true 的原始 ID 并持久化
    try {
      id = machineIdSync({ original: true });
      if (id) {
        fs.writeFileSync(idFilePath, id, { mode: 0o600 });
        console.log('[License] Persisted original machine ID to file:', idFilePath);
        return id;
      }
    } catch (e) {
      console.warn('[License] Native original machineId failed, trying generated fallback...');
    }

    // 4. 生成新的 ID 并持久化 (最后手段)
    try {
      // 结合一些系统噪音和随机数，确保唯一性
      const noise = os.hostname() + os.userInfo().username + Date.now() + Math.random();
      id = crypto.createHash('sha256').update(noise).digest('hex');

      fs.writeFileSync(idFilePath, id, { mode: 0o600 }); // 仅所有者可读写
      console.log('[License] Generated new persistent ID to file:', idFilePath);
      return id;
    } catch (e) {
      console.error('[License] Persistent ID write failed, using temporary memory ID', e);
      return crypto.createHash('md5').update('temp-' + Date.now()).digest('hex');
    }
  }

  async init(token) {
    await this.initStore();

    // 尝试自动通过设备ID获取授权 (Auto Provisioning)
    await this.checkDeviceLicense();

    return true;
  }

  getFreeLicense() {
    return { plan: 'free', constraints: { max_servers: 1, max_certs: 1 } };
  }

  stampVerifiedLicense(license) {
    return {
      ...license,
      lastVerified: Date.now(),
      offlineSince: null
    };
  }

  getOfflineBaseTime(license) {
    return Number(license?.offlineSince || license?.lastVerified || 0) || 0;
  }

  isOfflineGraceValid(license) {
    const baseTime = this.getOfflineBaseTime(license);
    return Boolean(baseTime) && (Date.now() - baseTime) <= OFFLINE_GRACE_MS;
  }

  getOfflineFallbackLicense(licenseKey) {
    const local = this.store?.get(STORE_KEY);
    if (!local) return { valid: false, reason: 'no_local_license' };
    if (licenseKey && local.licenseKey !== licenseKey) {
      return { valid: false, reason: 'license_key_mismatch' };
    }

    const withBaseline = (local.lastVerified || local.offlineSince)
      ? local
      : { ...local, lastVerified: Date.now(), offlineSince: Date.now() };

    const offlineLicense = withBaseline.offlineSince
      ? withBaseline
      : { ...withBaseline, offlineSince: Date.now() };

    if (!this.isOfflineGraceValid(offlineLicense)) {
      this.store.delete(STORE_KEY);
      return { valid: false, reason: 'offline_grace_expired' };
    }

    this.store.set(STORE_KEY, offlineLicense);
    return { valid: true, license: offlineLicense, offline: true };
  }

  getEffectiveLicense() {
    if (!this.store) return this.getFreeLicense();

    const local = this.store.get(STORE_KEY);
    if (!local) return this.getFreeLicense();

    if (!local.lastVerified && !local.offlineSince) {
      const stamped = { ...local, lastVerified: Date.now() };
      this.store.set(STORE_KEY, stamped);
      return stamped;
    }

    if (local.offlineSince && !this.isOfflineGraceValid(local)) {
      this.store.delete(STORE_KEY);
      return this.getFreeLicense();
    }

    return local;
  }

  /**
   * 检查当前设备是否有云端下发的授权
   */
  async checkDeviceLicense() {
    try {
      console.log('[License] Checking cloud for device:', this.machineId);
      const res = await axios.post(`${API_BASE_URL}/check-device`, {
        device_id: this.machineId
      });

      console.log('[License] Cloud response:', res.data);

      if (res.data.success) {
        const { data, signature } = res.data;
        if (this.verifySignature(data, signature)) {
          const license = this.stampVerifiedLicense({ licenseKey: data.license_key, ...data });
          this.store.set(STORE_KEY, license);
          console.log('[License] Auto provisioned license:', license.plan);
          return { valid: true, license };
        } else {
          console.warn('[License] Signature verification failed');
          return { valid: false, reason: 'invalid_signature' };
        }
      }

      const message = res.data?.message || '';
      if (/no active license found/i.test(message)) {
        this.store.delete(STORE_KEY);
        console.log('[License] Cleared stale local cache after explicit no-license response');
        return { valid: false, reason: 'no_active_license' };
      }
    } catch (e) {
      console.error('[License] Cloud check failed:', e.message);
      return this.getOfflineFallbackLicense();
    }
    return { valid: false };
  }

  async initStore() {
    if (this._initialized) return;
    const { default: Store } = await import('electron-store');
    this.store = new Store();
    this._initialized = true;
  }

  /**
   * 验证响应包签名 (RSA-SHA256)
   * @security CRITICAL: This method must strictly return false on any error
   */
  verifySignature(data, signature) {
    if (!PUBLIC_KEY) return false; // 🔒 Strict Mode: No key = No trust
    if (!signature) return false;
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(JSON.stringify(data));
      verify.end();
      return verify.verify(PUBLIC_KEY, signature, 'base64');
    } catch (e) {
      console.error('[License] Verify error:', e);
      return false; // Fail secure
    }
  }

  /**
   * 激活/验证授权码
   */
  async verify(licenseKey) {
    await this.initStore();
    const key = licenseKey || this.store.get(STORE_KEY)?.licenseKey;
    if (!key) return { valid: false, reason: 'no_key' };

    try {
      const res = await axios.post(`${API_BASE_URL}/verify`, {
        license_key: key,
        app_key: APP_CODE,
        device_id: this.machineId
      });

      if (res.data.success) {
        const { data, signature } = res.data;
        if (this.verifySignature(data, signature)) {
          const license = this.stampVerifiedLicense({ licenseKey: key, ...data });
          this.store.set(STORE_KEY, license);
          return { valid: true, license };
        }
        return { valid: false, reason: 'invalid_signature' };
      }
    } catch (e) {
      return this.getOfflineFallbackLicense(key);
    }
    return { valid: false };
  }

  /**
   * 绑定此设备
   */
  async activate(licenseKey) {
    await this.initStore();
    try {
      const res = await axios.post(`${API_BASE_URL}/activate`, {
        license_key: licenseKey,
        app_key: APP_CODE,
        device_id: this.machineId,
        device_name: os.hostname(),
        platform: process.platform
      });

      if (res.data.success) {
        const { data, signature } = res.data;
        if (this.verifySignature(data, signature)) {
          const verified = await this.verify(licenseKey);
          if (verified.valid) {
            return { valid: true, success: true, license: verified.license, offline: verified.offline };
          }
          return { valid: false, success: false, reason: verified.reason || 'activation_failed' };
        }
        return { valid: false, success: false, reason: 'invalid_signature' };
      }

      return {
        valid: false,
        success: false,
        reason: res.data?.message || 'activation_failed'
      };
    } catch (e) {
      const reason = e.response?.data?.message || e.message;
      return { valid: false, success: false, reason, error: reason };
    }
  }

  /**
   * 检查某种资源是否达到上限
   * @param {string} type 'max_servers' | 'max_certs'
   * @param {number} currentCount 
   */
  async checkConstraint(type, currentCount) {
    await this.initStore();
    const license = this.getEffectiveLicense();
    if (!license) {
      // 未激活用户：只能各创建一个
      return currentCount < 1;
    }
    const limit = license.constraints?.[type] || 0;
    return currentCount < limit;
  }

  getLicense() {
    return this.getEffectiveLicense();
  }

  getMachineId() {
    return this.machineId;
  }

  /**
   * 同步证书配置到云端
   */
  async syncCertConfig(data) {
    await this.initStore();
    try {
      await axios.post(`${API_BASE_URL}/cert-config/sync`, data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 清除本地 License 缓存
   */
  clear() {
    if (this.store) {
      console.log('[License] Clear requested, preserving machine-bound local license cache');
    }
  }

  /**
   * 上报运行状态 (证书申请后调用)
   */
  async report(domain, success, message) {
    await this.initStore();
    const license = this.store.get(STORE_KEY);
    if (!license || !license.license_id) return;

    try {
      await axios.post(`${API_BASE_URL}/stats/report`, {
        license_id: license.license_id,
        device_id: this.machineId,
        domain,
        success,
        message
      });
    } catch (e) { }
  }
}

module.exports = new LicenseService();
