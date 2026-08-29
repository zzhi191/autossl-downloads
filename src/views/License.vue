<template>
  <MainLayout>
    <div class="license-page">
      <div class="premium-header">
        <div class="header-content">
          <div class="title-row">
            <SafetyCertificateFilled class="header-icon" />
            <h1 class="premium-title">软件授权管理</h1>
          </div>
          <p class="premium-subtitle">管理您的设备指纹、授权期限及服务套餐，解锁全自动化证书更新能力</p>
        </div>
        <div class="header-addon">
           <a-button type="primary" shape="round" :loading="syncing" @click="handleSync" class="sync-gradient-btn">
             <ReloadOutlined /> 同步云端数据
           </a-button>
        </div>
      </div>

      <div class="premium-layout">
        <!-- 上部：授权看板 -->
        <a-row :gutter="[24, 24]" class="status-grid">
          <!-- 核心资产：授权卡片 -->
          <a-col :xs="24" :md="10">
            <div class="glass-card license-card" :class="{ pro: isPro, lifetime: license?.plan === 'lifetime' }">
              <div class="card-glow"></div>
              <div class="card-glass-body">
                <div class="plan-header">
                  <div class="plan-badge">
                    <CrownFilled v-if="license?.plan && license?.plan !== 'free'" />
                    <span>{{ planName }}</span>
                  </div>
                  <div class="brand-logo">AUTOSSL</div>
                </div>
                
                <div class="machine-id-zone">
                  <div class="zone-label">设备指纹 (UNIQUE IDENTITY)</div>
                  <div class="id-container">
                    <code class="machine-code">{{ machineId }}</code>
                    <a-tooltip title="点击复制">
                      <div class="copy-btn" @click="copyMachineId"><CopyOutlined /></div>
                    </a-tooltip>
                  </div>
                </div>

                <div class="meta-footer">
                  <div class="meta-item">
                    <div class="m-label">授权状态</div>
                    <div class="m-val active" v-if="license?.status === 'active'"><div class="dot green"></div>已激活</div>
                    <div class="m-val inactive" v-else><div class="dot gray"></div>未激活</div>
                  </div>
                  <div class="meta-item">
                    <div class="m-label">过期时间</div>
                    <div class="m-val">{{ license?.expire_at ? formatDate(license.expire_at) : '永久有效' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </a-col>

          <!-- 统计看板：资源额度 -->
          <a-col :xs="24" :md="14">
            <div class="glass-card resource-card">
              <h3 class="panel-title"><AppstoreAddOutlined /> 资源消耗进度</h3>
              <div class="usage-list">
                <div class="usage-item">
                  <div class="u-meta">
                    <span class="u-label">服务器节点上限</span>
                    <span class="u-count"><b>{{ currentStats.servers }}</b> / {{ license?.constraints?.max_servers || 1 }}</span>
                  </div>
                  <div class="u-progress-track">
                    <div class="u-progress-bar blue" :style="{ width: Math.min(100, (currentStats.servers / (license?.constraints?.max_servers || 1)) * 100) + '%' }"></div>
                  </div>
                </div>
                <div class="usage-item">
                  <div class="u-meta">
                    <span class="u-label">证书自动化上限</span>
                    <span class="u-count"><b>{{ currentStats.certs }}</b> / {{ license?.constraints?.max_certs || 1 }}</span>
                  </div>
                  <div class="u-progress-track">
                    <div class="u-progress-bar green" :style="{ width: Math.min(100, (currentStats.certs / (license?.constraints?.max_certs || 1)) * 100) + '%' }"></div>
                  </div>
                </div>
              </div>

              <div class="feature-tags">
                <div class="tag-chip" :class="{ enabled: hasFeature('auto_renew') }"><ThunderboltFilled /> 自动续期</div>
                <div class="tag-chip" :class="{ enabled: hasFeature('ssh_sync') }"><GlobalOutlined /> SSH 同步</div>
                <div class="tag-chip" :class="{ enabled: hasFeature('multi_domain') }"><CloudServerOutlined /> 多域名解析</div>
                <div class="tag-chip" :class="{ enabled: hasFeature('api_access') }"><ApiFilled /> API 接入</div>
              </div>
            </div>
          </a-col>
        </a-row>

        <!-- 激活中心 -->
        <div class="glass-card activation-hub">
          <div class="hub-text">
            <h3>激活新授权</h3>
            <p>请输入您获取的 24 位产品序列号以解锁对应的版本权益</p>
          </div>
          <div class="hub-input">
             <a-input-search
              v-model:value="activateKey"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              size="large"
              enter-button="立即激活"
              :loading="activating"
              @search="handleActivate"
              class="premium-search-input"
            />
          </div>
        </div>

        <!-- 套餐选购 -->
        <div class="shopping-center">
          <div class="center-header">
            <ShoppingFilled class="icon-accent" />
            <h2>推荐订阅方案</h2>
            <div class="header-line"></div>
          </div>
          <div class="plan-grid">
            <div 
              v-for="(p, index) in plans" 
              :key="p.id" 
              class="plan-glass-card" 
              :class="{ 
                hot: isRecommendedPlan(index),
                disabled: !getPlanAction(p).available,
                current: getPlanAction(p).type === 'renew'
              }" 
              @click="handleBuy(p)"
            >
              <div v-if="isRecommendedPlan(index)" class="hot-badge">推荐</div>
              <div v-if="getPlanAction(p).badge" class="status-overlay">
                <span>{{ getPlanAction(p).badge }}</span>
                <button
                  v-if="getPlanAction(p).type === 'upgrade'"
                  type="button"
                  class="upgrade-help-btn"
                  aria-label="查看升级后总权益"
                  @click.stop="showUpgradeInfo(p)"
                >
                  <QuestionCircleOutlined />
                </button>
              </div>
              <div class="p-header">
                <span class="p-name">{{ p.name }}</span>
              </div>
              <div class="p-pricing">
                <span class="sym">¥</span>
                <span class="amt">{{ p.price }}</span>
                <span class="dur">/年</span>
              </div>
              <div v-if="getPlanAction(p).description" class="p-action-note">
                {{ getPlanAction(p).description }}
              </div>
              <ul class="p-features">
                <li><CheckOutlined class="check" /> 证书额度: {{ p.constraints?.max_certs || 0 }} 个</li>
                <li><CheckOutlined class="check" /> 服务器额度: {{ p.constraints?.max_servers || 0 }} 台</li>
                <li><CheckOutlined class="check" /> 全自动化申请与同步</li>
                <li><CheckOutlined class="check" /> 7×12 优先技术支持</li>
              </ul>
              <a-button 
                type="primary" 
                block 
                size="large" 
                class="choose-btn"
                :disabled="!getPlanAction(p).available"
              >
                {{ getPlanAction(p).buttonText }}
              </a-button>
            </div>
          </div>
          
          <div class="bottom-links">
            <a-space :size="32">
              <span class="f-link" @click="showFAQ">常见问题 (FAQ)</span>
              <span class="f-link" @click="showContact">联系技术支持</span>
              <span class="f-link" @click="showTerms">服务条款与隐私</span>
            </a-space>
          </div>
        </div>
      </div>

      <!-- FAQ 弹窗 -->
      <a-modal v-model:open="faqVisible" title="常见问题 (FAQ)" :footer="null" width="600px">
        <div class="faq-content">
          <div class="faq-item">
            <h4>1. 授权是如何绑定的？</h4>
            <p>授权通过您的“设备指纹”进行唯一绑定。一个授权同时只能在一台计算机上激活。</p>
          </div>
          <div class="faq-item">
            <h4>2. 证书额度用完后怎么办？</h4>
            <p>您可以随时升级到更高版本的套餐，只需补齐差价即可解锁更多证书额度。</p>
          </div>
          <div class="faq-item">
            <h4>3. 自动续期失败了会提醒我吗？</h4>
            <p>系统会通过您注册的邮箱发送实时异常告警，并在仪表盘显著位置提示，确保您能第一时间处理。</p>
          </div>
          <div class="faq-item">
            <h4>4. 是否支持退款？</h4>
            <p>由于软件授权属于虚拟数字化商品，激活后暂不支持无理由退款，请您在试用满意后再进行购买。</p>
          </div>
        </div>
      </a-modal>

      <a-modal
        v-model:open="upgradeInfoVisible"
        title="升级后总权益"
        :footer="null"
        width="520px"
        centered
      >
        <div v-if="upgradePreview" class="upgrade-preview">
          <div class="upgrade-summary">
            <div>
              <span class="summary-label">当前方案</span>
              <strong>{{ upgradePreview.currentName }}</strong>
            </div>
            <div class="summary-arrow">→</div>
            <div>
              <span class="summary-label">升级后方案</span>
              <strong>{{ upgradePreview.targetName }}</strong>
            </div>
          </div>

          <div class="upgrade-benefit-list">
            <div class="benefit-row">
              <span>证书自动化上限</span>
              <strong>{{ upgradePreview.currentCerts }} → {{ upgradePreview.targetCerts }} 个</strong>
            </div>
            <div class="benefit-row">
              <span>服务器节点上限</span>
              <strong>{{ upgradePreview.currentServers }} → {{ upgradePreview.targetServers }} 台</strong>
            </div>
            <div class="benefit-row">
              <span>功能权益</span>
              <strong>自动续期、SSH 同步、多域名解析、API 接入</strong>
            </div>
          </div>

          <p class="upgrade-note">升级后按新套餐额度作为总权益生效，不与当前额度叠加。</p>
        </div>
      </a-modal>

      <!-- 支付弹窗 -->
      <a-modal
        v-model:open="payModalVisible"
        title="支付确认"
        :footer="null"
        width="420px"
        centered
        wrap-class-name="premium-modal"
        @cancel="stopPayPolling"
      >
        <div class="premium-pay-content">
          <div class="qr-wrapper">
             <div class="qr-container">
               <QRCodeVue3 v-if="payUrl" :value="payUrl" :width="200" :height="200" :dots-options="{ type: 'rounded', color: '#1a365d' }" />
               <div v-else-if="payLoading" class="qr-loading"><a-spin size="large" /></div>
               <div v-else class="qr-error">
                 <p>二维码加载失败</p>
                 <a-button type="primary" size="small" @click="retryCreateOrder">重试</a-button>
               </div>
             </div>
             <div class="qr-corner tl"></div><div class="qr-corner tr"></div><div class="qr-corner bl"></div><div class="qr-corner br"></div>
          </div>
          <div class="pay-info">
             <div class="amount-card">
               <span class="label">应付金额</span>
               <span class="value">¥{{ selectedPlan?.price }}</span>
             </div>
             <p class="instruction">请打开微信扫码完成支付</p>
          </div>
          <a-button type="primary" block size="large" class="verify-btn" :loading="checkingPay" @click="checkPaymentStatus(true)">
            我已完成支付
          </a-button>
        </div>
      </a-modal>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { 
  CrownFilled, 
  CopyOutlined, 
  ReloadOutlined,
  AppstoreAddOutlined,
  SafetyCertificateFilled,
  CheckOutlined,
  ShoppingFilled,
  ThunderboltFilled,
  GlobalOutlined,
  CloudServerOutlined,
  ApiFilled,
  QuestionCircleOutlined
} from '@ant-design/icons-vue';
import MainLayout from '@/components/MainLayout.vue';
import dayjs from 'dayjs';
import axios from 'axios';
import QRCodeVue3 from 'qrcode-vue3';
import { normalizeLicensePlans, unwrapLicenseApiResponse } from '@/utils/license-plans.mjs';

const API_BASE = 'https://tools.fogomo.com/api';

const machineId = ref('正在计算设备指纹...');
const license = ref(null);
const activateKey = ref('');
const activating = ref(false);
const syncing = ref(false);
const plans = ref([]);
const currentStats = ref({ servers: 0, certs: 0 });

const faqVisible = ref(false);
const upgradeInfoVisible = ref(false);

const showFAQ = () => { faqVisible.value = true; };
const showContact = () => {
  message.info({
    content: '技术支持请发送邮件至：support@fogomo.com 或关注“富贵猫”官方服务号。',
    duration: 5
  });
};
const showTerms = () => {
  message.success({
    content: '访问 fogomo.com/terms 查看详细的服务条款与隐私协议。',
    duration: 5
  });
};

// 支付相关
const payModalVisible = ref(false);
const payUrl = ref('');
const payLoading = ref(false);
const selectedPlan = ref(null);
const selectedUpgradePlan = ref(null);
const checkingPay = ref(false);
const payOrderNo = ref('');
let payPollingTimer = null;

const isPro = computed(() => {
   return license.value && license.value.plan && license.value.plan !== 'free';
});

const planName = computed(() => {
  if (!license.value) return '正在验证...';
  if (license.value.plan_name) return license.value.plan_name;
  if (isPro.value) return '专业版';
  return '基础免费版';
});

const handleSync = async (silent = false, retries = 3) => {
  if (!silent) syncing.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('license:refresh');
    if (res.valid) {
      license.value = res.license;
      
      // 如果是在线支付后的自动刷新，且依然显示 free，则递归重试一次 (带延迟)
      if (res.license.plan === 'free' && retries > 0) {
          console.log('[License] Still free, retrying sync in 2s...');
          setTimeout(() => handleSync(true, retries - 1), 2000);
          return;
      }
      
      if (!silent) message.success('授权令牌已同步成功');
      // 同步成功后，重新加载一次全局状态确保一致性
      loadInitial();
    } else {
      if (!silent) message.info('当前已是最新状态');
    }
  } catch (e) {
    if (!silent) message.error('同步失败，请检查网络连接');
  } finally {
    if (!silent) syncing.value = false;
  }
};

const loadInitial = async () => {
  try {
    const info = await window.electron.ipcRenderer.invoke('license:get');
    license.value = info;
    const s = await window.electron.ipcRenderer.invoke('server:get-all');
    const c = await window.electron.ipcRenderer.invoke('cert:get-all');
    currentStats.value = { servers: s.length, certs: c.length };
    machineId.value = await window.electron.ipcRenderer.invoke('license:get-machine-id');
  } catch (e) {
    console.error(e);
  }
};

const handleActivate = async () => {
  if (!activateKey.value) return;
  activating.value = true;
  try {
    const res = await window.electron.ipcRenderer.invoke('license:activate', activateKey.value);
    if (res.valid) {
      message.success('激活成功！高级版功能已解锁');
      license.value = res.license;
      activateKey.value = '';
    } else {
      message.error(res.reason === 'invalid_signature' ? '数据鉴权失败' : '序列号无效或已过期');
    }
  } catch (e) {
    message.error('激活请求异常');
  } finally {
    activating.value = false;
  }
};

const fetchPlans = async () => {
  try {
    const res = await axios.get(`${API_BASE}/certd-electron/electron/license/plans`);
    plans.value = normalizeLicensePlans(res.data);
  } catch (e) {
    console.error('Fetch plans error:', e);
    plans.value = [];
  }
};

const hasFeature = (code) => {
  const isPro = license.value?.plan && license.value?.plan !== 'free';
  return isPro || license.value?.features?.includes(code);
};

const formatDate = (d) => dayjs(d).format('YYYY-MM-DD');
const copyMachineId = () => {
  navigator.clipboard.writeText(machineId.value);
  message.success('设备指纹已复制到剪贴板');
};

const getPlanLimits = (source) => ({
  certs: source?.constraints?.max_certs || 0,
  servers: source?.constraints?.max_servers || 0
});

const isRecommendedPlan = (index) => {
  return plans.value.length > 0 && index === Math.floor(plans.value.length / 2);
};

const upgradePreview = computed(() => {
  if (!selectedUpgradePlan.value) return null;
  const current = getPlanLimits(license.value);
  const target = getPlanLimits(selectedUpgradePlan.value);
  return {
    currentName: planName.value,
    targetName: selectedUpgradePlan.value.name,
    currentCerts: current.certs,
    targetCerts: target.certs,
    currentServers: current.servers,
    targetServers: target.servers
  };
});

const showUpgradeInfo = (plan) => {
  selectedUpgradePlan.value = plan;
  upgradeInfoVisible.value = true;
};

const getPlanAction = (plan) => {
  if (!license.value || !license.value.plan || license.value.plan === 'free') {
    return {
      type: 'subscribe',
      available: true,
      buttonText: '立即订阅',
      description: '开通后按该套餐额度生效'
    };
  }

  if (license.value.plan === 'lifetime') {
    return {
      type: 'blocked',
      available: false,
      buttonText: '无需购买',
      badge: '已是终身授权',
      description: '当前授权已覆盖长期使用'
    };
  }

  const current = getPlanLimits(license.value);
  const target = getPlanLimits(plan);
  const samePlan = license.value.plan === plan.code;
  const higherLimits = target.certs > current.certs || target.servers > current.servers;
  const lowerLimits = target.certs < current.certs || target.servers < current.servers;

  if (lowerLimits) {
    return {
      type: 'blocked',
      available: false,
      buttonText: '当前方案更优',
      badge: '当前方案更优',
      description: '低于当前授权额度，不能降级购买'
    };
  }

  if (higherLimits) {
    return {
      type: 'upgrade',
      available: true,
      buttonText: '升级方案',
      badge: samePlan ? '升级额度' : '可升级',
      description: '升级后按新套餐额度生效，不与原额度叠加'
    };
  }

  return {
    type: 'renew',
    available: true,
    buttonText: '续费当前方案',
    badge: samePlan ? '当前方案' : '可续费',
    description: '续费只延长有效期，不叠加资源额度'
  };
};

const getCloudAuthToken = () => {
  const token = localStorage.getItem('token');
  return token && token.trim() ? token : null;
};

const handleCloudAuthExpired = () => {
  localStorage.removeItem('token');
  window.dispatchEvent(new Event('cloud-auth-changed'));
  message.warning('订阅支付需要有效的云端登录状态，请使用注册邮箱登录后再试。');
};

const handleBuy = async (plan) => {
  const action = getPlanAction(plan);
  if (!action.available) {
    message.info(action.description || '您当前已拥有更高级别的授权，无需降级购买');
    return;
  }
  const token = getCloudAuthToken();
  if (!token) {
    message.warning('订阅支付需要云端登录，请使用注册邮箱登录后再试。');
    return;
  }

  const createOrder = async () => {
    selectedPlan.value = plan;
    payModalVisible.value = true;
    payUrl.value = '';
    payLoading.value = true;
    try {
      const res = await axios.post(`${API_BASE}/certd-electron/electron/license/create-order`, {
        planId: plan.id,
        amount: plan.price,
        deviceId: machineId.value
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      const responseData = unwrapLicenseApiResponse(res.data);
      if (responseData?.success) {
        payOrderNo.value = responseData.data.orderNo;
        payUrl.value = responseData.data.payUrl;
        startPayPolling();
      } else {
        message.error(responseData?.message || '订单创建失败');
        payModalVisible.value = false;
      }
    } catch (e) {
      if (e.response?.status === 401) {
        handleCloudAuthExpired();
        payModalVisible.value = false;
        return;
      }
      const errMsg = e.response?.data?.message || (e.code === 'ECONNABORTED' ? '请求超时，请检查网络' : '订单创建失败');
      message.error(errMsg);
      payModalVisible.value = false;
    } finally {
      payLoading.value = false;
    }
  };

  const retryCreateOrder = () => {
    createOrder();
  };

  if (action.type === 'renew' || action.type === 'upgrade') {
    Modal.confirm({
      title: action.type === 'renew' ? '确认续费当前方案？' : '确认升级授权方案？',
      content: action.type === 'renew'
        ? '续费会延长当前授权有效期，资源额度保持当前方案额度，不会叠加。'
        : '升级后会按新套餐额度生效，资源额度不会与当前授权累加。',
      okText: '确认支付',
      cancelText: '取消',
      onOk: createOrder
    });
    return;
  }

  createOrder();
};

const checkPaymentStatus = async (isManual = false) => {
  if (!payOrderNo.value) return;
  if (isManual) checkingPay.value = true;
  try {
    const token = getCloudAuthToken();
    if (!token) {
      if (isManual) {
        message.warning('云端登录已失效，请重新登录后再查询支付状态。');
      }
      return;
    }
    const res = await axios.get(`${API_BASE}/certd-electron/electron/license/query-order/${payOrderNo.value}${isManual ? '?manual=true' : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const responseData = unwrapLicenseApiResponse(res.data);
    if (responseData?.status === 'paid') {
      message.success('支付成功，授权已开通！');
      stopPayPolling();
      // 延迟 2 秒刷新，防止后端数据同步延迟
      setTimeout(() => {
        payModalVisible.value = false;
        handleSync(true); 
      }, 2000);
    } else if (isManual) {
      message.info('尚未收到支付结果，请支付后重试');
    }
  } catch (e) {
    if (e.response?.status === 401) {
      handleCloudAuthExpired();
      stopPayPolling();
      payModalVisible.value = false;
      return;
    }
    console.error(e);
  } finally {
    if (isManual) checkingPay.value = false;
  }
};

const startPayPolling = () => {
  stopPayPolling();
  payPollingTimer = setInterval(() => checkPaymentStatus(false), 3000);
};

const stopPayPolling = () => {
  if (payPollingTimer) clearInterval(payPollingTimer);
};

onMounted(() => {
  loadInitial();
  fetchPlans();
  handleSync(true);
});

onUnmounted(() => {
  stopPayPolling();
});
</script>

<style scoped>
.license-page {
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
}

/* 顶部页眉美化 */
.premium-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: white;
  padding: 32px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.03);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.header-icon {
  font-size: 32px;
  color: #1890ff;
  filter: drop-shadow(0 4px 10px rgba(24, 144, 255, 0.3));
}

.premium-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  color: #1e293b;
  letter-spacing: -1px;
}

.premium-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 15px;
}

.sync-gradient-btn {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  border: none;
  height: 42px;
  padding: 0 24px;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(24, 144, 255, 0.3);
}

/* 玻璃卡片通用样式 */
.glass-card {
  background: white;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.02);
  height: 100%;
  transition: all 0.4s ease;
}

.glass-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
}

/* 授权卡片设计 */
.license-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: white;
  position: relative;
  overflow: hidden;
  border: none;
}

.license-card.pro {
  background: linear-gradient(135deg, #1890ff 0%, #003a8c 100%);
}

.license-card.lifetime {
  background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
}

.card-glow {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.plan-badge {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: 1px;
}

.brand-logo {
  font-size: 11px;
  font-weight: 900;
  opacity: 0.3;
  letter-spacing: 4px;
}

.machine-id-zone {
  margin-bottom: 40px;
}

.zone-label {
  font-size: 11px;
  opacity: 0.5;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.id-container {
  background: rgba(0,0,0,0.2);
  padding: 16px;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.machine-code {
  font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
  font-size: 12px;
  color: #38bdf8;
  word-break: break-all;
}

.copy-btn {
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: 0.3s;
}

.copy-btn:hover { opacity: 1; transform: scale(1.1); }

.meta-footer {
  display: flex;
  gap: 48px;
}

.m-label {
  font-size: 12px;
  opacity: 0.5;
  margin-bottom: 4px;
}

.m-val {
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.green { background: #4ade80; box-shadow: 0 0 10px #4ade80; }
.dot.gray { background: #94a3b8; }

/* 资源进度卡片 */
.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.usage-item {
  margin-bottom: 24px;
}

.u-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.u-label { font-size: 14px; font-weight: 600; color: #475569; }
.u-count { font-size: 13px; color: #94a3b8; }
.u-count b { color: #1e293b; font-size: 15px; }

.u-progress-track {
  height: 10px;
  background: #f1f5f9;
  border-radius: 5px;
  overflow: hidden;
}

.u-progress-bar {
  height: 100%;
  border-radius: 5px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.u-progress-bar.blue { background: linear-gradient(90deg, #1890ff, #00f2ff); }
.u-progress-bar.green { background: linear-gradient(90deg, #10b981, #34d399); }

.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid #f1f5f9;
}

.tag-chip {
  padding: 8px 16px;
  border-radius: 12px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #f1f5f9;
}

.tag-chip.enabled {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #dcfce7;
}

/* 激活中心美化 */
.activation-hub {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 60px;
  background: linear-gradient(90deg, #f0f9ff 0%, #ffffff 100%);
  border: 1px solid #e0f2fe;
}

.hub-text h3 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #0c4a6e; }
.hub-text p { margin: 0; color: #64748b; font-size: 14px; }
.hub-input { flex: 1; max-width: 500px; }

.premium-search-input :deep(.ant-input-search-button) {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%) !important;
  border: none !important;
  height: 40px !important;
  padding: 0 24px !important;
  font-weight: 700 !important;
  border-top-right-radius: 12px !important;
  border-bottom-right-radius: 12px !important;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2) !important;
}

.premium-search-input :deep(.ant-input-lg) {
  border-radius: 12px 0 0 12px !important;
}

/* 套餐方案卡片 */
.shopping-center {
  margin-top: 64px;
  text-align: center;
}

.center-header {
  margin-bottom: 48px;
}

.icon-accent { font-size: 40px; color: #1890ff; margin-bottom: 16px; opacity: 0.8; }
.center-header h2 { font-size: 32px; font-weight: 900; color: #1e293b; letter-spacing: -1px; }

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.plan-glass-card {
  background: white;
  border-radius: 20px;
  padding: 32px 20px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 15px rgba(0,0,0,0.02);
  transition: all 0.4s;
  position: relative;
  text-align: left;
  display: flex;
  flex-direction: column;
  min-height: 480px;
}

.plan-glass-card:hover {
  transform: translateY(-10px);
  border-color: #1890ff;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.plan-glass-card.disabled {
  opacity: 0.7;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

.plan-glass-card.current {
  border-color: #f59e0b;
}

.status-overlay {
  position: absolute;
  top: 48px;
  right: 16px;
  background: #64748b;
  color: white;
  padding: 4px 8px 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.upgrade-help-btn {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}

.upgrade-help-btn:hover {
  background: rgba(255, 255, 255, 0.36);
}

.plan-glass-card.hot {
  border-color: #1890ff;
  background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
}

.hot-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #1890ff;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}

.p-name { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 20px; display: block; }
.p-pricing { margin-bottom: 24px; display: flex; align-items: baseline; }
.p-pricing .sym { font-size: 15px; color: #ef4444; font-weight: 700; }
.p-pricing .amt { font-size: 38px; color: #ef4444; font-weight: 900; line-height: 1; margin: 0 2px; }
.p-pricing .dur { color: #94a3b8; font-size: 13px; font-weight: 600; }

.p-action-note {
  min-height: 36px;
  margin: -12px 0 18px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.p-features {
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  flex: 1;
}

.p-features li {
  margin-bottom: 12px;
  font-size: 12px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
}

.p-features .check { color: #10b981; font-weight: 900; }

.upgrade-preview {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.upgrade-summary {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.summary-label {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
}

.summary-arrow {
  color: #1890ff;
  font-size: 18px;
  font-weight: 800;
}

.upgrade-benefit-list {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.benefit-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.benefit-row:last-child {
  border-bottom: 0;
}

.benefit-row strong {
  color: #1e293b;
  text-align: right;
}

.upgrade-note {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.6;
}

.choose-btn {
  height: 52px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 16px;
  box-shadow: 0 4px 15px rgba(24, 144, 255, 0.2);
}

@media (max-width: 1180px) {
  .plan-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
}

.bottom-links {
  margin-top: 64px;
  padding: 40px 0;
  border-top: 1px solid #f1f5f9;
}

.f-link {
  color: #94a3b8;
  font-weight: 600;
  font-size: 14px;
  transition: 0.3s;
  cursor: pointer;
}

.f-link:hover { color: #1890ff; }

.faq-content { padding: 8px 0; }
.faq-item { margin-bottom: 24px; }
.faq-item h4 { font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.faq-item p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; }

/* 支付弹窗美化 */
.premium-pay-content { padding: 8px 0; }

.qr-wrapper {
  position: relative;
  width: 240px;
  height: 240px;
  margin: 0 auto 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-container {
  background: white;
  padding: 10px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}

.qr-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
}

.qr-error {
  text-align: center;
  color: #ef4444;
  font-size: 14px;
  padding: 20px;
}

.qr-error p {
  margin: 0 0 12px;
}

.qr-corner { position: absolute; width: 24px; height: 24px; border: 4px solid #1890ff; }
.qr-corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 12px; }
.qr-corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 12px; }
.qr-corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 12px; }
.qr-corner.br { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 12px; }

.pay-info { text-align: center; margin-bottom: 32px; }
.amount-card {
  display: inline-flex;
  flex-direction: column;
  background: #f8fafc;
  padding: 12px 32px;
  border-radius: 16px;
  margin-bottom: 12px;
}

.amount-card .label { font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
.amount-card .value { font-size: 32px; font-weight: 900; color: #1e293b; }

.instruction { color: #64748b; font-size: 14px; }

.verify-btn { height: 56px; border-radius: 16px; font-weight: 800; font-size: 17px; background: #1e293b; border: none; }
.verify-btn:hover { background: #334155; }
</style>
