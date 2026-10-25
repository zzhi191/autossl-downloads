<template>
  <MainLayout>
    <div class="dashboard-content">
      <div class="premium-stats-grid">
        <a-row :gutter="[24, 24]">
          <a-col :xs="24" :sm="12" :md="6">
            <div class="premium-card blue">
              <div class="card-bg-icon"><DatabaseOutlined /></div>
              <div class="card-body">
                <div class="card-label">服务器总数</div>
                <div class="card-value">{{ serverCount }}</div>
                <div class="card-footer">活跃节点实时监控中</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="premium-card green">
              <div class="card-bg-icon"><SafetyCertificateOutlined /></div>
              <div class="card-body">
                <div class="card-label">数字证书总数</div>
                <div class="card-value">{{ certCount }}</div>
                <div class="card-footer">全量本地数据库安全托管</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="premium-card orange">
              <div class="card-bg-icon"><ClockCircleOutlined /></div>
              <div class="card-body">
                <div class="card-label">即将过期</div>
                <div class="card-value">{{ expiringCount }}</div>
                <div class="card-footer">将在 30 天内触发自动续期</div>
              </div>
            </div>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <div class="premium-card red">
              <div class="card-bg-icon"><ExclamationCircleOutlined /></div>
              <div class="card-body">
                <div class="card-label">致命异常/已过期</div>
                <div class="card-value">{{ expiredCount }}</div>
                <div class="card-footer">需立即处理的证书节点</div>
              </div>
            </div>
          </a-col>
        </a-row>
      </div>
      
      <div class="expiring-panel">
        <div class="panel-header">
          <div class="header-main">
            <div class="indicator"></div>
            <h3>待执行任务公示</h3>
          </div>
          <p class="header-desc">列出当前已进入 30 天维护窗口 Hendrick 的数字资产</p>
        </div>
        <a-table
          :columns="columns"
          :data-source="expiringCerts"
          :pagination="false"
          size="middle"
          class="modern-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'domain'">
              <span class="domain-text">{{ record.domain }}</span>
            </template>
            <template v-if="column.key === 'serverName'">
              <div class="server-tags">
                <a-tag v-for="tag in (record.serverName || '').split(',')" :key="tag" class="mini-tag">
                  {{ tag.trim() }}
                </a-tag>
              </div>
            </template>
            <template v-if="column.key === 'daysLeft'">
              <div class="days-indicator">
                <span class="val" :class="{ 'warning': record.daysLeft < 7 }">{{ record.daysLeft }}</span>
                <span class="unit">天后过期</span>
              </div>
            </template>
            <template v-if="column.key === 'action'">
              <a-button
                type="primary"
                size="small"
                shape="round"
                class="renew-btn"
                :loading="renewingId === record.id"
                @click="handleRenew(record)"
              >
                立即续期
              </a-button>
            </template>
          </template>
        </a-table>
        <div v-if="expiringCerts.length === 0" class="empty-state">
           <CheckCircleOutlined class="check-icon" />
           <p>当前所有证书状态健康，无需人工干预</p>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  DatabaseOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons-vue'
import MainLayout from '@/components/MainLayout.vue'

const serverCount = ref(0)
const certCount = ref(0)
const expiringCount = ref(0)
const expiredCount = ref(0)
const expiringCerts = ref([])
const renewingId = ref(null)

const columns = [
  { title: '域名', dataIndex: 'domain', key: 'domain' },
  { title: '服务器', dataIndex: 'serverName', key: 'serverName' },
  { title: '剩余天数', key: 'daysLeft' },
  { title: '操作', key: 'action' }
]

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    const servers = await window.electron.ipcRenderer.invoke('server:get-all')
    const certs = await window.electron.ipcRenderer.invoke('cert:get-all')
    const expiring = await window.electron.ipcRenderer.invoke('cert:get-expiring', 30)
    
    serverCount.value = servers.length
    certCount.value = certs.length
    
    const now = Date.now()
    expiringCount.value = certs.filter(c => {
      if (!c.expiresTime) return false
      const daysLeft = Math.floor((c.expiresTime - now) / (1000 * 60 * 60 * 24))
      return daysLeft > 0 && daysLeft <= 30
    }).length
    
    expiredCount.value = certs.filter(c => {
      if (!c.expiresTime) return false
      return c.expiresTime < now
    }).length
    
    // 处理即将过期的证书列表
    expiringCerts.value = expiring.map(cert => {
      const daysLeft = Math.floor((cert.expiresTime - Date.now()) / (1000 * 60 * 60 * 24))
      // 获取部署的服务器名称列表
      const serverNames = (cert.deployedServers || []).map(s => s.name).join(', ') || '未部署'
      return {
        ...cert,
        serverName: serverNames,
        daysLeft
      }
    })
  } catch (error) {
    message.error('加载数据失败：' + error.message)
  }
}

const handleRenew = async (cert) => {
  renewingId.value = cert.id
  try {
    const result = await window.electron.ipcRenderer.invoke('auto-renew:renew-cert', cert.id)
    message.success(result?.message || `${cert.domain} 已触发立即续期`)
    await loadData()
  } catch (error) {
    message.error('立即续期失败：' + error.message)
  } finally {
    renewingId.value = null
  }
}
</script>

<style scoped>
.dashboard-content {
  padding: 0;
}

.premium-stats-grid {
  margin-bottom: 32px;
}

/* 高端统计卡片 */
.premium-card {
  position: relative;
  background: white;
  border-radius: 20px;
  padding: 24px;
  height: 160px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.02);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.premium-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.card-bg-icon {
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 100px;
  opacity: 0.05;
  transform: rotate(-15deg);
}

.premium-card.blue { background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%); color: #1890ff; }
.premium-card.green { background: linear-gradient(135deg, #ffffff 0%, #f6ffed 100%); color: #52c41a; }
.premium-card.orange { background: linear-gradient(135deg, #ffffff 0%, #fff7e6 100%); color: #fa8c16; }
.premium-card.red { background: linear-gradient(135deg, #ffffff 0%, #fff1f0 100%); color: #ff4d4f; }

.premium-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: currentColor;
}

.card-label {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
}

.card-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 12px;
  color: #1e293b;
  font-family: 'Inter', -apple-system, sans-serif;
}

.card-footer {
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 任务面板美化 */
.expiring-panel {
  background: white;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0,0,0,0.02);
}

.panel-header {
  margin-bottom: 24px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.indicator {
  width: 4px;
  height: 18px;
  background: #1890ff;
  border-radius: 2px;
}

.header-main h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.header-desc {
  margin: 0;
  font-size: 14px;
  color: #94a3b8;
  padding-left: 16px;
}

/* 表格定制 */
.modern-table :deep(.ant-table) { background: transparent; }
.modern-table :deep(.ant-table-thead > tr > th) {
  background: #f8fbff;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 2px solid #edf2f7;
}

.domain-text { font-weight: 600; color: #1e293b; font-family: 'Inter', sans-serif; }

.server-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.mini-tag { border-radius: 4px; font-size: 11px; color: #3182ce; background: #ebf8ff; border: none; }

.days-indicator { display: flex; align-items: baseline; gap: 4px; }
.days-indicator .val { font-size: 18px; font-weight: 800; color: #4a5568; font-family: monospace; }
.days-indicator .val.warning { color: #e53e3e; text-shadow: 0 0 10px rgba(229, 62, 62, 0.1); }
.days-indicator .unit { font-size: 11px; color: #94a3b8; font-weight: 500; }

.renew-btn {
   background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
   border: none;
   box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
   height: 28px;
   font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #94a3b8;
}

.empty-state .check-icon {
  font-size: 48px;
  color: #48bb78;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p { font-size: 15px; font-weight: 500; }
</style>
