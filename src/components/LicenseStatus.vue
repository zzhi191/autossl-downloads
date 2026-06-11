
<template>
  <div class="license-status-wrapper">
    <a-tag 
      :color="statusColor" 
      class="status-tag" 
      @click="showModal = true"
    >
      <template #icon>
        <LoadingOutlined v-if="!licenseInfo" />
        <CrownOutlined v-else-if="isPro" />
        <InfoCircleOutlined v-else />
      </template>
      {{ planName }}
    </a-tag>

    <a-modal
      v-model:open="showModal"
      title="授权管理"
      :footer="null"
      width="400px"
      centered
    >
      <div class="license-details">
        <div class="status-summary card">
          <div class="info-item">
            <span class="label">当前版本：</span>
            <span class="value" :class="{ 'pro-text': isPro }">{{ planName }}</span>
          </div>
          <div class="info-item" v-if="licenseInfo?.expire_at">
            <span class="label">有效期至：</span>
            <span class="value">{{ formatDate(licenseInfo.expire_at) }}</span>
          </div>
          <div class="info-item">
            <span class="label">机器 ID：</span>
            <span class="value machine-id-value">
              <code :title="machineId">{{ formattedMachineId }}</code>
              <a-typography-link @click="copyMachineId" v-if="machineId">
                <CopyOutlined />
              </a-typography-link>
            </span>
          </div>
          <div class="refresh-action">
            <a-button type="link" size="small" :loading="refreshing" @click="handleRefresh">
              <template #icon><ReloadOutlined /></template>
              刷新授权状态
            </a-button>
          </div>
        </div>
        
        <div v-if="!isPro" class="upgrade-section">
          <a-divider>升级专业版</a-divider>
          <div class="plan-list">
            <div 
              v-for="plan in availablePlans" 
              :key="plan.id" 
              class="plan-card" 
              :class="{ disabled: !isPlanAvailable(plan) }"
              @click="handleBuy(plan)"
            >
              <div class="plan-info">
                <span class="plan-name">{{ plan.name }}</span>
                <span class="plan-price">¥{{ plan.price }}/年</span>
              </div>
              <a-button 
                type="primary" 
                shape="round" 
                size="small"
                :disabled="!isPlanAvailable(plan)"
              >
                {{ isPlanAvailable(plan) ? (licenseInfo?.plan === plan.code ? '续费' : '立即升级') : '已拥有' }}
              </a-button>
            </div>
          </div>
        </div>

        <a-divider>激活码激活</a-divider>
        <div class="activation-section">
          <a-input-search
            v-model:value="licenseKey"
            placeholder="请输入授权码"
            enter-button="提交"
            size="middle"
            :loading="activating"
            @search="handleActivate"
          />
        </div>
      </div>
    </a-modal>

    <!-- 支付弹窗 -->
    <a-modal
      v-model:open="showPaymentModal"
      title="扫码支付"
      :footer="null"
      width="320px"
      centered
      @cancel="stopPolling"
    >
      <div class="payment-modal-content">
        <div class="amount">支付金额：<span>¥{{ currentOrder?.amount }}</span></div>
        <div class="qr-code-wrapper">
          <QRCodeVue3 v-if="currentOrder?.qr_code" :value="currentOrder.qr_code" :width="180" :height="180" />
          <div v-else class="qr-placeholder">正在加载支付码...</div>
          <div class="qr-overlay" v-if="orderPaid">
            <CheckCircleFilled class="success-icon" />
            <p>支付成功</p>
          </div>
        </div>
        <p class="payment-tip">请使用微信扫码支付</p>
        <div class="order-no">订单号: {{ currentOrder?.order_no }}</div>
        <a-button type="primary" block style="margin-top:20px" :loading="checkingPay" @click="checkPaymentStatus(currentOrder?.order_no, true)">
          我已支付，点击验证
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { CrownOutlined, InfoCircleOutlined, CheckCircleFilled, ReloadOutlined, CopyOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import axios from 'axios'
import QRCodeVue3 from 'qrcode-vue3'
import { normalizeLicensePlans } from '@/utils/license-plans.mjs'

const SERVER_BASE = 'https://tools.fogomo.com'

const showModal = ref(false)
const showPaymentModal = ref(false)
const activating = ref(false)
const checkingPay = ref(false)
const licenseKey = ref('')
const licenseInfo = ref(null)
const availablePlans = ref([])
const currentOrder = ref(null)
const orderPaid = ref(false)
const machineId = ref('')
const refreshing = ref(false)
let pollTimer = null

const formattedMachineId = computed(() => {
  if (!machineId.value) return '获取中...'
  if (machineId.value.length <= 16) return machineId.value
  return `${machineId.value.slice(0, 8)}...${machineId.value.slice(-8)}`
})

const isPro = computed(() => {
   return licenseInfo.value && licenseInfo.value.plan && licenseInfo.value.plan !== 'free';
});

const planName = computed(() => {
  if (!licenseInfo.value) return '验证中...'
  if (licenseInfo.value.plan_name) return licenseInfo.value.plan_name
  if (isPro.value) return '专业版'
  return '免费版'
})

const statusColor = computed(() => {
   if (!licenseInfo.value) return 'default';
   return isPro.value ? 'gold' : 'blue';
});

const getServerUrl = (path) => {
  if (path.startsWith('http')) return path
  return `${SERVER_BASE}${path}`
}

const fetchLicense = async (retries = 10) => {
  try {
    const data = await window.electron.ipcRenderer.invoke('license:get')
    if (data && data.plan) {
      licenseInfo.value = data
      
      // Double check: if still free, try refresh once
      if (data.plan === 'free' && retries > 8) {
         handleRefresh(true);
      }
    } else if (retries > 0) {
      // Retry with backoff
      setTimeout(() => fetchLicense(retries - 1), 500)
    } else {
      console.warn('License init timeout, using default free')
      licenseInfo.value = { plan: 'free' }
    }
  } catch (e) {
    console.error('Fetch license error:', e)
    if (retries === 0) {
       licenseInfo.value = { plan: 'free' }
    } else {
       setTimeout(() => fetchLicense(retries - 1), 500)
    }
  }
}

const fetchMachineId = async () => {
  try {
    machineId.value = await window.electron.ipcRenderer.invoke('license:get-machine-id')
  } catch (e) {
    console.error('Fetch machine id error:', e)
  }
}

const handleRefresh = async (silent = false) => {
  if (!silent) refreshing.value = true
  try {
    const res = await window.electron.ipcRenderer.invoke('license:refresh')
    if (res.valid) {
      licenseInfo.value = res.license
      if (!silent) message.success('授权已更新')
    } else {
      if (!silent) message.info('云端暂无新授权')
    }
  } catch (e) {
    if (!silent) message.error('刷新失败')
  } finally {
    if (!silent) refreshing.value = false
  }
}

const copyMachineId = () => {
  if (!machineId.value) return
  navigator.clipboard.writeText(machineId.value)
  message.success('机器 ID 已复制')
}

const fetchPlans = async () => {
  try {
    const res = await axios.get(`${SERVER_BASE}/api/certd-electron/electron/license/plans`)
    availablePlans.value = normalizeLicensePlans(res.data)
  } catch (e) {
    console.error('Fetch plans error:', e)
    availablePlans.value = []
  }
}

const isPlanAvailable = (plan) => {
  if (!licenseInfo.value || !licenseInfo.value.plan || licenseInfo.value.plan === 'free') return true;
  const currentMax = licenseInfo.value.constraints?.max_certs || 0;
  const targetMax = plan.constraints?.max_certs || 0;
  return targetMax >= currentMax;
};

const handleBuy = async (plan) => {
  if (!isPlanAvailable(plan)) {
    message.info('您当前已拥有更高级别的授权');
    return;
  }
  const token = localStorage.getItem('token')
  if (!token) {
    message.warning('请先登录账户以进行购买')
    return
  }

  try {
    const res = await axios.post(`${SERVER_BASE}/api/certd-electron/electron/license/create-order`, {
      planId: plan.id,
      amount: plan.price,
      deviceId: machineId.value // Include machineId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data.success) {
      currentOrder.value = {
        ...res.data.data,
        amount: plan.price,
        order_no: res.data.data.orderNo,
        qr_code: res.data.data.payUrl
      }
      showPaymentModal.value = true
      startPolling(res.data.data.orderNo)
    }
  } catch (e) {
    message.error('创建订单失败')
  }
}


const checkPaymentStatus = async (orderId, isManual = false) => {
  if (isManual) checkingPay.value = true
  const token = localStorage.getItem('token')
  
  try {
    const url = `${SERVER_BASE}/api/certd-electron/electron/license/query-order/${orderId}` + (isManual ? '?manual=true' : '')
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data.status === 'paid') {
      orderPaid.value = true
      clearInterval(pollTimer)
      message.success('支付成功，授权已自动升级！')
      setTimeout(() => {
        showPaymentModal.value = false
        handleRefresh() // 强制从云端刷新授权，而不是读本地缓存
      }, 2000)
    } else {
       if (isManual) message.info('订单待支付')
    }
  } catch (e) {
    console.error('Polling error:', e)
  } finally {
    if (isManual) checkingPay.value = false
  }
}

const startPolling = (orderId) => {
  orderPaid.value = false
  pollTimer = setInterval(() => checkPaymentStatus(orderId), 3000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const handleActivate = async () => {
  if (!licenseKey.value) {
    message.warning('请输入授权码')
    return
  }
  
  activating.value = true
  try {
    const res = await window.electron.ipcRenderer.invoke('license:activate', licenseKey.value)
    if (res.valid) { // Note: changed from res.success to res.valid based on Main Process return
      message.success('激活成功！')
      licenseInfo.value = res.license
      licenseKey.value = ''
      showModal.value = false
    } else {
      message.error(res.reason || '激活失败')
    }
  } catch (e) {
    message.error('请求失败: ' + e.message)
  } finally {
    activating.value = false
  }
}

const formatDate = (date) => {
  if (!date) return '永久有效'
  return dayjs(date).format('YYYY-MM-DD')
}

onMounted(() => {
  fetchLicense()
  fetchMachineId()
  fetchPlans()
  // Proactive refresh on mount to ensure sync
  handleRefresh(true)
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.license-status-wrapper {
  display: inline-block;
  margin-right: 16px;
}

.status-tag {
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 500;
  transition: transform 0.2s;
}

.status-tag:hover {
  transform: scale(1.05);
}

.card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.pro-text {
  color: #faad14;
  font-weight: bold;
}

.machine-id-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.machine-id-value code {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #1890ff;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refresh-action {
  text-align: right;
  margin-top: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #8c8c8c;
}

.value {
  color: #262626;
  font-weight: 500;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s;
}

.plan-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f5f5f5;
}

.plan-card:hover:not(.disabled) {
  border-color: #1890ff;
  background: #f0faff;
}

.plan-name {
  display: block;
  font-weight: 500;
  font-size: 15px;
}

.plan-price {
  font-size: 13px;
  color: #ff4d4f;
  font-weight: bold;
}

.activation-section {
  display: flex;
  justify-content: center;
}

.payment-modal-content {
  text-align: center;
  padding: 10px 0;
}

.amount {
  font-size: 16px;
  margin-bottom: 15px;
}

.amount span {
  color: #ff4d4f;
  font-size: 24px;
  font-weight: bold;
}

.qr-code-wrapper {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 15px;
  border: 1px solid #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-code-img {
  width: 100%;
  height: 100%;
}

.qr-placeholder {
  color: #bfbfbf;
  font-size: 12px;
}

.qr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #52c41a;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.payment-tip {
  color: #8c8c8c;
  font-size: 13px;
  margin-bottom: 10px;
}

.order-no {
  font-size: 12px;
  color: #bfbfbf;
}
</style>
