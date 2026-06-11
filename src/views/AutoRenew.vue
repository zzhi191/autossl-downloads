
<template>
  <MainLayout>
    <div class="auto-renew-container">
      <div class="page-header">
        <div class="header-left">
          <h2>自动续期中心</h2>
          <p class="subtitle">智能监控 · 自动签发 · 远程部署 · 零停机维护</p>
        </div>
        <div class="header-right">
          <a-space>
            <a-button @click="loadLogs" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新日志
            </a-button>
            <a-button type="primary" @click="handleManualCheck" :loading="checking">
              立即执行全局检测
            </a-button>
          </a-space>
        </div>
      </div>

      <!-- 统计卡片 -->
      <a-row :gutter="20" class="stats-row">
        <a-col :span="8">
          <div class="premium-stat-card blue">
            <div class="stat-header">
              <div class="stat-icon-wrapper">
                <SyncOutlined />
              </div>
              <span class="stat-label">服务状态</span>
            </div>
            <div class="stat-content">
              <div class="stat-main-val" :class="{ 'active': licenseLimit?.plan && licenseLimit?.plan !== 'free' }">
                {{ (licenseLimit?.plan && licenseLimit?.plan !== 'free') ? '核心就绪' : '未授权' }}
              </div>
              <div class="stat-sub-val">上次执行：{{ lastRunText }}</div>
            </div>
          </div>
        </a-col>
        <a-col :span="8">
          <div class="premium-stat-card green">
            <div class="stat-header">
              <div class="stat-icon-wrapper">
                <CheckCircleOutlined />
              </div>
              <span class="stat-label">成功记录</span>
            </div>
            <div class="stat-content">
              <div class="stat-main-val">{{ successCount }} <small>次</small></div>
              <div class="stat-sub-val">累计节约人工运维 60+ 小时</div>
            </div>
          </div>
        </a-col>
        <a-col :span="8">
          <div class="premium-stat-card orange">
            <div class="stat-header">
              <div class="stat-icon-wrapper">
                <ClockCircleOutlined />
              </div>
              <span class="stat-label">急需待办</span>
            </div>
            <div class="stat-content">
              <div class="stat-main-val">{{ expiringSoonCount }} <small>个</small></div>
              <div class="stat-sub-val">当前共有 {{ certs.length }} 个证书在托管中</div>
            </div>
          </div>
        </a-col>
      </a-row>

      <div class="main-content-wrapper">
        <a-row :gutter="20">
          <a-col :span="6">
            <div class="side-panel">
              <div class="panel-header">
                <h3><DatabaseOutlined /> 托管服务器</h3>
                <a-tooltip title="测试所有连接">
                  <a-button type="text" size="small" @click="testAllServers" :loading="testingAll">
                    <template #icon><SafetyOutlined /></template>
                  </a-button>
                </a-tooltip>
              </div>
              <div class="server-list">
                <div v-for="item in targetServers" :key="item.id" class="side-server-card">
                  <div class="ssc-top">
                    <span class="name">{{ item.name }}</span>
                    <span :class="['dot', item.testStatus]"></span>
                  </div>
                  <div class="ssc-bottom">{{ item.host }}</div>
                </div>
                <div v-if="targetServers.length === 0" class="empty-server">无活跃部署服务器</div>
              </div>
            </div>
          </a-col>
          <a-col :span="18">
            <div class="log-panel">
              <div class="panel-header">
                <h3><HistoryOutlined /> 自动续期审计日志</h3>
              </div>
              <a-table 
                :columns="columns" 
                :data-source="logs" 
                :loading="loading"
                row-key="id"
                :pagination="{ pageSize: 10, showSizeChanger: false }"
                class="modern-table"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'domain'">
                    <span class="domain-text">{{ record.domain }}</span>
                  </template>
                  <template v-if="column.key === 'status'">
                    <span :class="['status-pill', record.status]">
                      {{ record.status === 'success' ? '成功' : '失败' }}
                    </span>
                  </template>
                  <template v-if="column.key === 'created_at'">
                    <span class="time-text">{{ dayjs(record.created_at).format('MM-DD HH:mm') }}</span>
                  </template>
                </template>
              </a-table>
            </div>
          </a-col>
        </a-row>
      </div>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { 
  SyncOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  SafetyOutlined
} from '@ant-design/icons-vue'
import { Tooltip as ATooltip } from 'ant-design-vue'
import MainLayout from '@/components/MainLayout.vue'
import dayjs from 'dayjs'

const logs = ref([])
const loading = ref(false)
const checking = ref(false)
const testingAll = ref(false)
const certs = ref([])
const targetServers = ref([])
const lastRunTime = ref(null)
const licenseLimit = ref(null)

const normalizeTimestampMs = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null
  return timestamp < 1e12 ? timestamp * 1000 : timestamp
}

const lastRunText = computed(() => {
  if (!lastRunTime.value) return '从未执行'
  return dayjs(lastRunTime.value).format('HH:mm:ss')
})

const columns = [
  { title: '域名', dataIndex: 'domain', key: 'domain' },
  { title: '执行状态', dataIndex: 'status', key: 'status', width: 120, align: 'center' },
  { title: '审计说明', dataIndex: 'message', key: 'message' },
  { title: '触发时间', dataIndex: 'created_at', key: 'created_at', width: 140, align: 'right' }
]

const successCount = computed(() => logs.value.filter(l => l.status === 'success').length)
const expiringSoonCount = computed(() => {
  const now = Date.now()
  return certs.value.filter(c => {
    const expiresTime = normalizeTimestampMs(c.expiresTime)
    if (!expiresTime) return false
    const daysLeft = (expiresTime - now) / (1000 * 60 * 60 * 24)
    return daysLeft > 0 && daysLeft <= 30
  }).length
})

const loadLogs = async () => {
  loading.value = true
  try {
    logs.value = await window.electron.ipcRenderer.invoke('log:get-apply', 100)
    certs.value = await window.electron.ipcRenderer.invoke('cert:get-all')
    lastRunTime.value = await window.electron.ipcRenderer.invoke('auto-renew:last-run')
    licenseLimit.value = await window.electron.ipcRenderer.invoke('license:get')
    
    // 获取所有参与自动部署的服务器
    const allServers = await window.electron.ipcRenderer.invoke('server:get-all')
    const usedServerIds = new Set()
    certs.value.forEach(cert => {
      (cert.deployedServers || []).forEach(s => usedServerIds.add(s.id))
    })
    targetServers.value = allServers
      .filter(s => usedServerIds.has(s.id))
      .map(s => ({ ...s, testStatus: 'idle' }))
  } catch (e) {
    message.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

const testAllServers = async () => {
  testingAll.value = true
  try {
    for (const server of targetServers.value) {
      server.testStatus = 'testing'
      const res = await window.electron.ipcRenderer.invoke('server:test-connection', server)
      server.testStatus = res.success ? 'success' : 'error'
    }
    message.success('连接测试完成')
  } catch (e) {
    message.error('测试过程中出现错误')
  } finally {
    testingAll.value = false
  }
}

const handleManualCheck = async () => {
  checking.value = true
  try {
    // 首先检查权限
    const license = await window.electron.ipcRenderer.invoke('license:get')
    const isPro = license && license.plan !== 'free';
    if (!isPro) {
      message.warning('自动续期是专业版功能，请先升级授权。')
      return
    }
    
    await window.electron.ipcRenderer.invoke('auto-renew:check')
    message.success('已触发全局续期检测，请关注系统通知。')
    setTimeout(loadLogs, 2000)
  } catch (e) {
    message.error('执行失败: ' + e.message)
  } finally {
    checking.value = false
  }
}

const getStatusBadge = (status) => {
  if (status === 'success') return 'success'
  if (status === 'error') return 'error'
  return 'default'
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(async () => {
  loadLogs()
})
</script>

<style scoped>
.auto-renew-container {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0,0,0,0.02);
}

.header-left h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.subtitle {
  color: #94a3b8;
  margin: 6px 0 0;
  font-size: 14px;
}

.stats-row {
  margin-bottom: 24px;
}

/* 高级统计卡片 */
.premium-stat-card {
  background: white;
  padding: 24px;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.premium-stat-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  background: currentColor;
  opacity: 0.03;
  border-radius: 0 0 0 100%;
}

.premium-stat-card.blue { color: #3182ce; }
.premium-stat-card.blue .stat-icon-wrapper { background: #3182ce; color: white; }

.premium-stat-card.green { color: #38a169; }
.premium-stat-card.green .stat-icon-wrapper { background: #38a169; color: white; }

.premium-stat-card.orange { color: #d69e2e; }
.premium-stat-card.orange .stat-icon-wrapper { background: #d69e2e; color: white; }

.premium-stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.stat-label {
  font-weight: 600;
  color: #64748b;
  font-size: 15px;
}

.stat-main-val {
  font-size: 28px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 4px;
}

.stat-main-val.active {
  color: #38a169;
}

.stat-main-val small {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.stat-sub-val {
  font-size: 12px;
  color: #94a3b8;
}

/* 主内容区 */
.main-content-wrapper {
  margin-top: 8px;
}

.side-panel, .log-panel {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.02);
  min-height: 500px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.side-server-card {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  margin-bottom: 10px;
  border: 1px solid #f1f5f9;
}

.ssc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.ssc-top .name {
  font-weight: 600;
  font-size: 13px;
  color: #334155;
}

.ssc-top .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e0;
}

.ssc-top .dot.success { background: #48bb78; box-shadow: 0 0 6px #48bb78; }
.ssc-top .dot.error { background: #f56565; box-shadow: 0 0 6px #f56565; }

.ssc-bottom {
  font-size: 12px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', monospace;
}

.empty-server {
  text-align: center;
  padding: 40px 0;
  color: #cbd5e0;
  font-size: 13px;
}

/* 表格美化 */
.modern-table :deep(.ant-table) { background: transparent; }
.modern-table :deep(.ant-table-thead > tr > th) {
  background: #f8fbff;
  font-size: 13px;
  color: #64748b;
  border-bottom: 2px solid #edf2f7;
}

.domain-text { font-weight: 600; color: #1e293b; }

.status-pill {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.status-pill.success { background: #f0fff4; color: #38a169; }
.status-pill.error { background: #fff5f5; color: #e53e3e; }

.time-text { color: #94a3b8; font-size: 12px; font-family: monospace; }
</style>
