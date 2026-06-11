<template>
  <MainLayout>
    <div class="certificates-page">
      <div class="page-header">
        <h2>证书管理</h2>
        <a-space>
          <a-button @click="showApplyModal">申请证书</a-button>
          <a-button type="primary" @click="loadCerts">刷新</a-button>
        </a-space>
      </div>
      
      <div class="page-content">
        <a-table
          :columns="columns"
          :data-source="certs"
          :loading="loading"
          row-key="id"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 条` }"
          class="modern-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'domain'">
              <div class="domain-cell">
                <SafetyCertificateOutlined class="cert-icon" />
                <span class="domain-text">{{ record.domain }}</span>
              </div>
            </template>
            <template v-if="column.key === 'deployedServers'">
              <div v-if="record.deployedServers && record.deployedServers.length > 0" class="server-tags">
                <a-tag 
                  v-for="server in record.deployedServers" 
                  :key="server.id"
                  class="modern-tag blue"
                >
                  <DatabaseOutlined style="margin-right: 4px;" />{{ server.name }}
                </a-tag>
              </div>
              <span v-else class="empty-text">未部署</span>
            </template>
            <template v-if="column.key === 'status'">
              <span :class="['status-dot', record.status]"></span>
              <span :class="['status-text', record.status]">{{ getStatusText(record.status) }}</span>
            </template>
            <template v-if="column.key === 'daysLeft'">
              <div class="days-cell">
                <span class="days-value" :style="{ color: getDaysColor(record.daysLeft) }">
                  {{ record.daysLeft !== null ? record.daysLeft : '-' }}
                </span>
                <span class="days-unit">天</span>
              </div>
            </template>
            <template v-if="column.key === 'expiresTime'">
              <span class="date-text" v-if="record.expiresTime">
                {{ dayjs(record.expiresTime).format('YYYY-MM-DD') }}
              </span>
              <span v-else class="empty-text">-</span>
            </template>
            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-tooltip title="部署到服务器">
                  <a-button type="text" size="small" class="action-btn primary" @click="handleDeploy(record)">
                    <template #icon><CloudUploadOutlined /></template>
                    部署
                  </a-button>
                </a-tooltip>
                <a-tooltip title="一键重新部署" v-if="record.deployedServers && record.deployedServers.length > 0">
                  <a-button type="text" size="small" class="action-btn success" @click="handleRedeploy(record)">
                    <template #icon><RocketOutlined /></template>
                    重推
                  </a-button>
                </a-tooltip>
                <a-tooltip title="域名重新申请">
                  <a-button type="text" size="small" class="action-btn warning" @click="handleRenew(record)">
                    <template #icon><ReloadOutlined /></template>
                    重申
                  </a-button>
                </a-tooltip>
                <a-popconfirm title="确定要删除该证书吗？" @confirm="handleDelete(record)">
                  <a-button type="text" size="small" danger class="action-btn error">
                    <template #icon><DeleteOutlined /></template>
                    删除
                  </a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </div>
    
    <!-- 申请证书对话框 -->
    <a-modal
      v-model:open="applyModalVisible"
      title="申请证书"
      :confirm-loading="loading"
      @ok="handleApply"
      @cancel="handleCancelApply"
      width="600px"
      :zIndex="1000"
    >
      <a-form
        ref="applyFormRef"
        :model="applyForm"
        :rules="applyRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="域名" name="domain">
          <a-input v-model:value="applyForm.domain" placeholder="例如：example.com" />
        </a-form-item>
        

        <a-form-item label="常用凭证" v-if="accessProfiles.length > 0">
           <a-select placeholder="选择历史凭证可自动回填信息" @change="handleProfileSelect" allowClear>
              <a-select-option v-for="p in accessProfiles" :key="p.accessKeyId" :value="p.accessKeyId">
                  {{ p.type }} - {{ p.accessKeyId.substring(0, 6) }}******
              </a-select-option>
           </a-select>
        </a-form-item>

        <a-form-item label="DNS 服务商" name="dnsProviderType">
          <a-select v-model:value="applyForm.dnsProvider.type" placeholder="请选择域名解析服务商">
            <a-select-option value="aliyun">阿里云 (Aliyun)</a-select-option>
            <a-select-option value="tencent">腾讯云 (Tencent)</a-select-option>
            <a-select-option value="huawei">华为云 (Huawei)</a-select-option>
          </a-select>
          <div style="margin-top: 4px; line-height: 1;">
            <a @click="showHelpModal" style="font-size: 12px;">
              <QuestionCircleOutlined /> 如何获取密钥？
            </a>
          </div>
        </a-form-item>

        <template v-if="applyForm.dnsProvider.type">

          <a-form-item label="AccessKey" :name="['dnsProvider', 'accessKeyId']" :rules="[{ required: true, message: '请输入 AccessKey ID' }]">
            <a-input 
              v-model:value="applyForm.dnsProvider.accessKeyId" 
              placeholder="请输入云厂商 AccessKey ID" 
              @blur="saveCurrentProfile"
            />
          </a-form-item>
          <a-form-item label="SecretKey" :name="['dnsProvider', 'accessKeySecret']" :rules="[{ required: true, message: '请输入 AccessKey Secret' }]">
            <a-input-password 
              v-model:value="applyForm.dnsProvider.accessKeySecret" 
              placeholder="请输入云厂商 AccessKey Secret" 
              @blur="saveCurrentProfile"
            />
          </a-form-item>
        </template>
        
        <a-form-item label="部署服务器" name="deployServers">
          <div style="width: 100%;">
            <a-button 
              type="dashed" 
              block 
              @click="showDeployConfigModal"
              style="margin-bottom: 8px;"
            >
              <template #icon>
                <PlusOutlined />
              </template>
              选择部署服务器并配置路径
            </a-button>
            <div v-if="applyForm.deployServers && applyForm.deployServers.length > 0" class="deploy-list">
              <div
                v-for="(item, index) in applyForm.deployServers"
                :key="index"
                class="deploy-item"
                @click="editDeployServer(index)"
                title="点击修改配置"
              >
                <div class="deploy-item-info">
                  <div class="server-name">
                    <a-tag color="blue">{{ getServerName(item.serverId) }}</a-tag>
                  </div>
                  <div class="path-info">
                    <code>{{ item.certPath }}</code>
                  </div>
                </div>
                <div class="deploy-item-action">
                  <a-button type="link" danger size="small" @click.stop="removeDeployServer(index)">
                    <template #icon><CloseOutlined /></template>
                  </a-button>
                </div>
              </div>
            </div>
            <div v-else style="color: #8c8c8c; font-size: 12px; padding: 8px 0;">
              提示：可选择多个服务器，每个服务器可配置不同的证书路径
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 证书申请进度对话框 -->
    <a-modal
      v-model:open="applyProgressVisible"
      title="证书申请流程"
      :footer="null"
      :closable="!isApplying"
      :maskClosable="false"
      width="700px"
      :zIndex="1010"
    >
      <div class="apply-progress-content">
        <div style="padding: 24px 0;">
          <a-steps :current="currentApplyStep" size="small">
            <a-step title="配置保存" />
            <a-step title="DNS验证" />
            <a-step title="证书签发" />
            <a-step title="部署完成" />
          </a-steps>
        </div>

        <div class="progress-logs-container">
          <div v-for="(log, index) in applyLogs" :key="index" :class="['log-item', log.status]">
            <span class="log-time">[{{ log.time }}]</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
          <div v-if="isApplying" class="log-loading">
            <a-spin size="small" /> 正在处理中...
          </div>
        </div>

        <div v-if="!isApplying" style="margin-top: 24px; text-align: right;">
          <a-button type="primary" @click="applyProgressVisible = false">确定</a-button>
        </div>
      </div>
    </a-modal>
    
    <!-- 部署证书对话框 -->
    <a-modal
      v-model:open="deployModalVisible"
      title="部署证书"
      @ok="handleDeployConfirm"
      @cancel="deployModalVisible = false"
      width="900px"
      :zIndex="1000"
    >
      <div style="margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 6px;">
        <strong style="color: #1890ff;">证书域名：</strong>
        <span style="font-family: monospace; color: #333;">{{ deployingCert?.domain }}</span>
      </div>
      <div style="margin-bottom: 16px;">
        <a-button 
          type="dashed" 
          block 
          @click="showDeployConfigModal"
          style="height: 44px; font-size: 14px;"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          添加服务器部署配置
        </a-button>
      </div>
      <a-table
        :columns="deployConfigColumns"
        :data-source="deployServerConfigs"
        :pagination="false"
        size="middle"
        bordered
        :row-class-name="() => 'deploy-table-row'"
      >
          <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'serverName'">
            <a-tag color="blue">{{ record.serverName }}</a-tag>
          </template>
          <template v-else-if="column.key === 'certPath'">
            <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; display: inline-block;">{{ record.certPath }}</code>
          </template>
          <template v-else-if="column.key === 'keyPath'">
            <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all; display: inline-block;">{{ record.keyPath }}</code>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" danger size="small" @click="removeDeployConfig(index)">
              删除
            </a-button>
          </template>
        </template>
      </a-table>
    </a-modal>
    
    <!-- 服务器部署配置对话框 -->
    <a-modal
      v-model:open="deployConfigModalVisible"
      title="配置服务器部署"
      @ok="handleAddDeployConfig"
      @cancel="deployConfigModalVisible = false"
      width="600px"
      :zIndex="1010"
    >
      <a-form
        ref="deployConfigFormRef"
        :model="deployConfigForm"
        :rules="deployConfigRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="选择服务器" name="serverId">
          <a-select 
            v-model:value="deployConfigForm.serverId" 
            placeholder="选择服务器"
            :dropdownRender="renderServerDropdown"
            :open="serverSelectOpen"
            @dropdownVisibleChange="(open) => serverSelectOpen = open"
          >
            <a-select-option
              v-for="server in servers"
              :key="server.id"
              :value="server.id"
            >
              {{ server.name }} ({{ server.host }})
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="SSL 公钥路径" name="certPath">
          <a-input 
            v-model:value="deployConfigForm.certPath" 
            placeholder="/etc/nginx/ssl/[domain]/public.pem"
            @blur="autoCompleteCertPath"
          />
          <div style="color: #8c8c8c; font-size: 12px; margin-top: 4px;">
            推荐示例：/etc/nginx/ssl/[domain]/public.pem <span style="color: #ff4d4f;">（请确保与 Nginx 配置中的证书路径一致）</span>
          </div>
        </a-form-item>
        <a-form-item label="SSL 私钥路径" name="keyPath">
          <a-input 
            v-model:value="deployConfigForm.keyPath" 
            placeholder="/etc/nginx/ssl/[domain]/private.key"
            @blur="autoCompleteKeyPath"
          />
          <div style="color: #8c8c8c; font-size: 12px; margin-top: 4px;">
            推荐示例：/etc/nginx/ssl/[domain]/private.key <span style="color: #ff4d4f;">（请确保与 Nginx 配置中的私钥路径一致）</span>
          </div>
        </a-form-item>
        <a-form-item 
          v-if="selectedServer && selectedServer.privateKey"
          label="私钥密码" 
          name="passphrase"
        >
          <a-input-password 
            v-model:value="deployConfigForm.passphrase" 
            placeholder="如果私钥有密码短语(Passphrase)，请输入" 
          />
        </a-form-item>
      </a-form>
    </a-modal>
    
    <!-- 内嵌添加服务器对话框 -->
    <a-modal
      v-model:open="inlineServerModalVisible"
      title="添加服务器"
      @ok="handleInlineServerSave"
      @cancel="inlineServerModalVisible = false"
      width="600px"
      :maskClosable="false"
      :zIndex="1020"
    >
      <a-form
        ref="inlineServerFormRef"
        :model="inlineServerForm"
        :rules="inlineServerRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="服务器名称" name="name">
          <a-input v-model:value="inlineServerForm.name" placeholder="例如：生产服务器" />
        </a-form-item>
        
        <a-form-item label="主机地址" name="host">
          <a-input v-model:value="inlineServerForm.host" placeholder="例如：192.168.1.100" />
        </a-form-item>
        
        <a-form-item label="端口" name="port">
          <a-input-number v-model:value="inlineServerForm.port" :min="1" :max="65535" style="width: 100%" />
        </a-form-item>
        
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="inlineServerForm.username" placeholder="SSH用户名" />
        </a-form-item>
        
        <a-form-item label="认证方式" name="authType">
          <a-radio-group v-model:value="inlineServerForm.authType">
            <a-radio value="password">密码</a-radio>
            <a-radio value="key">私钥</a-radio>
          </a-radio-group>
        </a-form-item>
        
        <a-form-item v-if="inlineServerForm.authType === 'password'" label="密码" name="password">
          <a-input-password v-model:value="inlineServerForm.password" placeholder="SSH密码" />
        </a-form-item>
        
        <a-form-item v-if="inlineServerForm.authType === 'key'" label="私钥" name="privateKey">
          <a-textarea
            v-model:value="inlineServerForm.privateKey"
            :rows="4"
            placeholder="SSH私钥内容（-----BEGIN PRIVATE KEY-----...）"
          />
        </a-form-item>
        
        <a-form-item label="重载命令" name="reloadCommand">
          <a-textarea
            v-model:value="inlineServerForm.reloadCommand"
            :rows="2"
            placeholder="例如：nginx -s reload 或 systemctl restart nginx"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 如何获取 AccessKey 帮助弹窗 -->
    <a-modal
      v-model:open="helpModalVisible"
      title="如何获取云厂商 AccessKey？"
      :footer="null"
      width="700px"
      :zIndex="1010"
    >
      <div class="help-modal-content">
        <a-tabs v-model:activeKey="helpActiveTab">
          <a-tab-pane key="aliyun" tab="阿里云 (Aliyun)">
            <div class="guide-steps">
              <div class="step">
                <div class="step-num">1</div>
                <div class="step-desc">
                  登录 <a href="https://ram.console.aliyun.com/manage/ak" target="_blank">阿里云 AccessKey 管理控制台</a>
                  <a-tooltip title="复制链接">
                    <a-button type="text" size="small" style="color: #666; vertical-align: middle; margin-left: 4px;" @click="handleCopyLink('https://ram.console.aliyun.com/manage/ak')">
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>。
                </div>
              </div>
              <div class="step">
                <div class="step-num">2</div>
                <div class="step-desc">点击<b>“创建 AccessKey”</b>，通过验证后即可得到 AccessKey ID 和 AccessKey Secret。</div>
              </div>
              <div class="step-note">
                <p><b>💡 安全建议：</b></p>
                <p>推荐创建 RAM 用户（子账号）并仅授予 <code>AliyunDNSFullAccess</code> 权限，以降低主账号泄露风险。</p>
              </div>
            </div>
          </a-tab-pane>
          <a-tab-pane key="tencent" tab="腾讯云 (Tencent)">
            <div class="guide-steps">
              <div class="step">
                <div class="step-num">1</div>
                <div class="step-desc">
                  登录 <a href="https://console.cloud.tencent.com/cam/capi" target="_blank">腾讯云访问秘钥控制台</a>
                  <a-tooltip title="复制链接">
                    <a-button type="text" size="small" style="color: #666; vertical-align: middle; margin-left: 4px;" @click="handleCopyLink('https://console.cloud.tencent.com/cam/capi')">
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>。
                </div>
              </div>
              <div class="step">
                <div class="step-num">2</div>
                <div class="step-desc">点击<b>“新建密钥”</b>，系统会自动生成 SecretId 和 SecretKey。</div>
              </div>
              <div class="step-note">
                <p><b>💡 安全建议：</b></p>
                <p>推荐为子账号分配 <code>QcloudDNSFullAccess</code> 权限用于证书自动化。</p>
              </div>
            </div>
          </a-tab-pane>
          <a-tab-pane key="huawei" tab="华为云 (Huawei)">
            <div class="guide-steps">
              <div class="step">
                <div class="step-num">1</div>
                <div class="step-desc">
                  登录 <a href="https://console.huaweicloud.com/iam/?region=cn-north-4#/mine/credentials" target="_blank">华为云“我的凭证”页面</a>
                  <a-tooltip title="复制链接">
                    <a-button type="text" size="small" style="color: #666; vertical-align: middle; margin-left: 4px;" @click="handleCopyLink('https://console.huaweicloud.com/iam/?region=cn-north-4#/mine/credentials')">
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>。
                </div>
              </div>
              <div class="step">
                <div class="step-num">2</div>
                <div class="step-desc">点击左侧导航栏的<b>“访问密钥”</b>，然后点击<b>“新增访问密钥”</b>。</div>
              </div>
              <div class="step">
                <div class="step-num">3</div>
                <div class="step-desc">华为云会生成一个 <code>credentials.csv</code> 文件供您下载，里面包含 Access Key Id 和 Secret Access Key。</div>
              </div>
              <div class="step-note">
                <p><b>❗ 注意：</b></p>
                <p>华为云的 SecretKey 仅在创建时下载一次，请妥善保存。</p>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- 删除验证弹窗 -->
    <a-modal
      v-model:open="verifyModalVisible"
      title="安全验证"
      :confirm-loading="verifying"
      @ok="handleVerifyAndDelete"
      @cancel="verifyModalVisible = false"
      width="420px"
      :zIndex="1050"
    >
      <div style="margin: 20px 0;">
        <a-alert
          message="高风险操作警告"
          description="该操作将永久删除证书文件及相关记录，无法恢复。请谨慎操作！"
          type="error"
          show-icon
          style="margin-bottom: 20px;"
        />
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b;">待删除证书：</span>
          <span style="font-weight: 700; color: #1e293b;">{{ pendingDeleteItem?.domain }}</span>
        </div>
        <a-input-password
          v-model:value="verifyPassword"
          placeholder="请输入您的登录密码以确认"
          size="large"
          @pressEnter="handleVerifyAndDelete"
          :status="!verifyPassword && verifying ? 'error' : ''"
        >
          <template #prefix><SafetyOutlined style="color: #bfbfbf" /></template>
        </a-input-password>
      </div>
    </a-modal>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, h } from 'vue'
import { 
  message, 
  Modal, 
  Divider, 
  Button, 
  Tooltip as ATooltip, 
  Popconfirm as APopconfirm 
} from 'ant-design-vue'
import { 
  PlusOutlined, 
  FolderOpenOutlined, 
  CloseOutlined, 
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  RocketOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SyncOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  CopyOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import MainLayout from '@/components/MainLayout.vue'

const loading = ref(false)
const certs = ref([])
const servers = ref([])
const filesModalVisible = ref(false)
const applyModalVisible = ref(false)
const isRenewMode = ref(false)
const deployModalVisible = ref(false)
const deployConfigModalVisible = ref(false)
const deployingCert = ref(null)
const deployServerConfigs = ref([])
const applyFormRef = ref()
const deployConfigFormRef = ref()
const inlineServerFormRef = ref()
const inlineServerModalVisible = ref(false)
const editingDeployIndex = ref(-1)
const helpModalVisible = ref(false)
const helpActiveTab = ref('aliyun')

// 删除验证相关
const verifyModalVisible = ref(false)
const verifyPassword = ref('')
const verifying = ref(false)
const pendingDeleteItem = ref(null)

const showHelpModal = () => {
  // 如果已经选择了某个厂商，打开时默认选中该厂商的教程
  if (applyForm.value.dnsProvider.type) {
    helpActiveTab.value = applyForm.value.dnsProvider.type
  }
  helpModalVisible.value = true
}

const inlineServerForm = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  reloadCommand: ''
})

const inlineServerRules = {
  name: [{ required: true, message: '请输入服务器名称' }],
  host: [{ required: true, message: '请输入主机地址' }],
  port: [{ required: true, message: '请输入端口' }],
  username: [{ required: true, message: '请输入用户名' }]
}

const serverSelectOpen = ref(false)

const applyForm = ref({
  domain: '',
  email: '',
  dnsProvider: {
    type: undefined,
    accessKeyId: '',
    accessKeySecret: ''
  },
  deployServers: [] // [{ serverId, certPath, keyPath }]
})

const deployConfigForm = ref({
  serverId: null,
  certPath: '',
  keyPath: '',
  passphrase: ''
})

const deployConfigRules = {
  serverId: [{ required: true, message: '请选择服务器' }],
  certPath: [{ required: true, message: '请输入 SSL 公钥路径' }],
  keyPath: [{ required: true, message: '请输入 SSL 私钥路径' }]
}

const deployConfigColumns = [
  { title: '服务器', key: 'serverName', width: 120 },
  { title: 'SSL 公钥路径', key: 'certPath', ellipsis: true },
  { title: 'SSL 私钥路径', key: 'keyPath', ellipsis: true },
  { title: '操作', key: 'action', width: 80, align: 'center' }
]

const applyRules = {
  domain: [{ required: true, message: '请输入域名' }],
  deployServers: [] // 可选
}

const getServerName = (serverId) => {
  const server = servers.value.find(s => s.id === serverId)
  return server ? server.name : '未知'
}

const availableServers = computed(() => {
  // 排除已选择的服务器
  let selectedIds = []
  if (applyModalVisible.value) {
    selectedIds = applyForm.value.deployServers.map(c => c.serverId)
  } else {
    selectedIds = deployServerConfigs.value.map(c => c.serverId)
  }
  return servers.value.filter(s => !selectedIds.includes(s.id))
})

const selectedServer = computed(() => {
  return servers.value.find(s => s.id === deployConfigForm.value.serverId)
})

const activeDomain = computed(() => {
  if (deployingCert.value) return deployingCert.value.domain
  if (applyModalVisible.value && applyForm.value.domain) return applyForm.value.domain
  return 'domain.com'
})

const showDeployConfigModal = () => {
  editingDeployIndex.value = -1
  deployConfigForm.value = {
    serverId: null,
    certPath: '',
    keyPath: '',
    passphrase: ''
  }
  deployConfigModalVisible.value = true
}

const editDeployServer = (index) => {
  const isApply = applyModalVisible.value
  const list = isApply ? applyForm.value.deployServers : deployServerConfigs.value
  const item = list[index]
  
  editingDeployIndex.value = index
  deployConfigForm.value = {
    serverId: item.serverId,
    certPath: item.certPath,
    keyPath: item.keyPath,
    passphrase: item.passphrase || ''
  }
  deployConfigModalVisible.value = true
}

// 渲染服务器下拉框（带新增按钮）
const renderServerDropdown = ({ menuNode }) => {
  return h('div', [
    menuNode,
    h(Divider, { style: { margin: '4px 0' } }),
    h('div', { style: { padding: '4px 8px' } }, [
      h(Button, {
        type: 'link',
        size: 'small',
        onClick: (e) => {
          e.stopPropagation()
          showInlineServerModal()
        },
        style: { width: '100%', textAlign: 'left' }
      }, () => [h(PlusOutlined), ' 添加新服务器'])
    ])
  ])
}

// 显示内嵌服务器添加弹窗
const showInlineServerModal = () => {
  // 先关闭下拉框
  serverSelectOpen.value = false
  
  inlineServerForm.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    reloadCommand: ''
  }
  inlineServerModalVisible.value = true
}

// 保存内嵌服务器
const handleInlineServerSave = async () => {
  try {
    await inlineServerFormRef.value.validate()
    
    const serverData = {
      id: Date.now().toString(),
      name: inlineServerForm.value.name,
      host: inlineServerForm.value.host,
      port: inlineServerForm.value.port,
      username: inlineServerForm.value.username,
      password: inlineServerForm.value.authType === 'password' ? inlineServerForm.value.password : null,
      privateKey: inlineServerForm.value.authType === 'key' ? inlineServerForm.value.privateKey : null,
      reloadCommand: inlineServerForm.value.reloadCommand
    }
    
    const result = await window.electron.ipcRenderer.invoke('server:save', serverData)
    
    if (result.success) {
      message.success('服务器添加成功')
      inlineServerModalVisible.value = false
      // 刷新服务器列表
      await loadServers()
      // 自动选中新添加的服务器
      deployConfigForm.value.serverId = serverData.id
    } else {
      message.error(result.error || '保存失败')
    }
  } catch (error) {
    console.error('Save inline server error:', error)
  }
}

// 选择路径（文件或目录）
const selectPath = async (field, type = 'directory') => {
  try {
    const title = field === 'certPath' ? '选择证书路径（目录或文件）' : '选择私钥路径（目录或文件）'
    
    const result = await window.electron.ipcRenderer.invoke('dialog:select-path', {
      type, // 改为 directory，允许选择目录
      title
    })
    
    if (result.success && result.path) {
      deployConfigForm.value[field] = result.path
    } else if (!result.canceled) {
      message.error('选择路径失败：' + (result.error || '未知错误'))
    }
  } catch (error) {
    console.error('Select path error:', error)
    message.error('选择路径失败：' + error.message)
  }
}

// 自动补全证书路径
const autoCompleteCertPath = () => {
  if (deployConfigForm.value.certPath && deployConfigForm.value.certPath.endsWith('/')) {
    deployConfigForm.value.certPath += 'public.pem'
  }
}

// 自动补全私钥路径
const autoCompleteKeyPath = () => {
  if (deployConfigForm.value.keyPath && deployConfigForm.value.keyPath.endsWith('/')) {
    deployConfigForm.value.keyPath += 'private.key'
  }
}

const handleAddDeployConfig = async () => {
  try {
    await deployConfigFormRef.value.validate()
    
    const server = servers.value.find(s => s.id === deployConfigForm.value.serverId)
    const config = {
      serverId: deployConfigForm.value.serverId,
      serverName: server ? server.name : '未知',
      certPath: deployConfigForm.value.certPath,
      keyPath: deployConfigForm.value.keyPath,
      passphrase: deployConfigForm.value.passphrase
    }
    
    if (editingDeployIndex.value > -1) {
      // 编辑模式
      if (applyModalVisible.value) {
        applyForm.value.deployServers[editingDeployIndex.value] = config
      } else {
        deployServerConfigs.value[editingDeployIndex.value] = config
      }
    } else {
      // 新增模式
      if (applyModalVisible.value) {
        applyForm.value.deployServers.push(config)
      } else {
        deployServerConfigs.value.push(config)
      }
    }
    
    deployConfigModalVisible.value = false
  } catch (error) {
    console.error('Validate error:', error)
  }
}

const removeDeployConfig = (index) => {
  deployServerConfigs.value.splice(index, 1)
}

const removeDeployServer = (index) => {
  applyForm.value.deployServers.splice(index, 1)
}

const columns = [
  { title: '域名', dataIndex: 'domain', key: 'domain' },
  { title: '部署服务器', key: 'deployedServers', width: 200 },
  { title: '状态', key: 'status', width: 100 },
  { title: '剩余天数', key: 'daysLeft', width: 100 },
  { title: '过期时间', key: 'expiresTime', width: 180 },
  { title: '操作', key: 'action', width: 320 }
]



const accessProfiles = ref([])

onMounted(() => {
  loadCerts()
  loadServers()
  loadProfiles()
})

const loadProfiles = async () => {
    try {
        const res = await window.electron.ipcRenderer.invoke('profile:get-all')
        if (res && Array.isArray(res)) {
            accessProfiles.value = res
        }
    } catch (e) {
        console.error('Load profiles failed:', e)
    }
}

const handleProfileSelect = (val) => {
    if (!val) {
        // 清空时重置 AccessKey
        applyForm.value.dnsProvider.accessKeyId = ''
        applyForm.value.dnsProvider.accessKeySecret = ''
        return
    }
    const profile = accessProfiles.value.find(p => p.accessKeyId === val)
    if (profile) {
        applyForm.value.dnsProvider.accessKeyId = profile.accessKeyId
        applyForm.value.dnsProvider.accessKeySecret = profile.accessKeySecret
        if (profile.type) {
            applyForm.value.dnsProvider.type = profile.type
        }
    }
}

const saveCurrentProfile = async () => {
  const { type, accessKeyId, accessKeySecret } = applyForm.value.dnsProvider
  if (type && accessKeyId && accessKeySecret) {
    try {
      await window.electron.ipcRenderer.invoke('profile:save', {
        type,
        accessKeyId,
        accessKeySecret
      })
      loadProfiles()
    } catch (e) {
      console.error('Auto save profile failed', e)
    }
  }
}

const loadServers = async () => {
  try {
    servers.value = await window.electron.ipcRenderer.invoke('server:get-all')
    console.log('[DEBUG] Loaded servers:', servers.value)
  } catch (error) {
    console.error('[DEBUG] Load servers error:', error)
    message.error('加载服务器列表失败：' + error.message)
  }
}

const loadCerts = async () => {
  loading.value = true
  try {
    const allCerts = await window.electron.ipcRenderer.invoke('cert:get-all')
    const allServers = await window.electron.ipcRenderer.invoke('server:get-all')
    
    // 计算剩余天数和状态
    certs.value = allCerts.map(cert => {
      const now = Date.now()
      let daysLeft = null
      let status = 'valid'
      
      if (cert.expiresTime) {
        daysLeft = Math.floor((cert.expiresTime - now) / (1000 * 60 * 60 * 24))
        if (daysLeft < 0) {
          status = 'expired'
        } else if (daysLeft < 30) {
          status = 'expiring'
        }
      }
      
      // 处理部署的服务器列表
      const deployedServers = cert.deployedServers || []
      
      return {
        ...cert,
        daysLeft,
        status,
        deployedServers
      }
    })
  } catch (error) {
    message.error('加载证书列表失败：' + error.message)
  } finally {
    loading.value = false
  }
}

const getStatusColor = (status) => {
  const colors = {
    valid: 'green',
    expiring: 'orange',
    expired: 'red'
  }
  return colors[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    valid: '有效',
    expiring: '即将过期',
    expired: '已过期'
  }
  return texts[status] || '未知'
}

const getDaysColor = (daysLeft) => {
  if (daysLeft === null) return '#999'
  if (daysLeft < 0) return '#ff4d4f'
  if (daysLeft < 7) return '#ff4d4f'
  if (daysLeft < 30) return '#faad14'
  return '#52c41a'
}

const applyProgressVisible = ref(false)
const currentApplyStep = ref(0)
const applyLogs = ref([])
const isApplying = ref(false)

const addApplyLog = (status, message) => {
  const time = new Date().toLocaleTimeString()
  applyLogs.value.push({ time, status, message })
  // 自动滚动到底部
  nextTick(() => {
    const container = document.querySelector('.progress-logs-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

const showApplyModal = async () => {
  isRenewMode.value = false
  // 优先加载草稿
  try {
    const draft = await window.electron.ipcRenderer.invoke('profile:get-draft')
    if (draft) {
      applyForm.value = draft
    } else {
      applyForm.value = {
        domain: '',
        email: '',
        dnsProvider: {
            type: undefined,
            accessKeyId: '',
            accessKeySecret: ''
        },
        deployServers: []
      }
    }
  } catch (e) {
    console.error('Load draft failed', e)
  }
  
  // 自动填充当前用户邮箱（覆盖草稿可能存在的旧邮箱）
  try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
          const user = JSON.parse(userStr)
          if (user.email) {
              applyForm.value.email = user.email
          }
      }
  } catch (e) {
      console.error('Auto fill email failed:', e)
  }

  applyModalVisible.value = true
}

const handleApply = async () => {
  try {
    await applyFormRef.value.validate()
    
    if (!applyForm.value.dnsProvider.type) {
        message.warning('请选择 DNS 服务商')
        return
    }

    // 1. 初始化进度状态
    applyModalVisible.value = false
    applyProgressVisible.value = true
    currentApplyStep.value = 0
    applyLogs.value = []
    isApplying.value = true

    // 2. 保存草稿
    addApplyLog('processing', '正在保存域名配置到本地...')
    await window.electron.ipcRenderer.invoke('profile:save-draft', JSON.parse(JSON.stringify(applyForm.value)))
    currentApplyStep.value = 1

    // 3. 监听进度
    const removeListener = window.electron.ipcRenderer.on('acme:progress', (data) => {
        const { step, status, message: logMsg } = data
        addApplyLog(status, logMsg)
        
        let targetStep = currentApplyStep.value
        
        // 智能映射步骤，确保不回跳
        if (step === 'init') {
            targetStep = 0
        } else if (step === 'dns-add' || step === 'dns-wait' || step === 'dns-remove') {
            targetStep = 1
        } else if (step === 'acme') {
            // acme 步骤很长，包含验证和签发。
            // 当出现 "Finalizing" 关键词时，说明 DNS 验证已过，进入签发环节（步骤 2）
            if (logMsg.includes('Finalizing') || logMsg.includes('downloading') || logMsg.includes('核发')) {
                targetStep = 2
            } else {
                targetStep = 1 // 还在验证中
            }
        } else if (step === 'success') {
            targetStep = 3
        }

        // 只允许前进，不允许后退
        currentApplyStep.value = Math.max(currentApplyStep.value, targetStep)
    })

    // 4. 开始申请
    const result = await window.electron.ipcRenderer.invoke('acme:apply', {
      domain: applyForm.value.domain,
      email: applyForm.value.email,
      dnsProvider: { ...applyForm.value.dnsProvider }
    })
    
    // 移除进度监听
    if (removeListener) removeListener()
    isApplying.value = false

    if (result.success) {
      // 成功后保存凭证 Profile
      try {
          await window.electron.ipcRenderer.invoke('profile:save', {
              type: applyForm.value.dnsProvider.type,
              accessKeyId: applyForm.value.dnsProvider.accessKeyId,
              accessKeySecret: applyForm.value.dnsProvider.accessKeySecret
          })
          loadProfiles()
      } catch (e) {
          console.error('Save profile failed', e)
      }

      currentApplyStep.value = 3
      addApplyLog('success', '证书申请已完成，已安全存储。')

      const certId = result.data.certId;
      
      // 如果配置了部署服务器，添加部署关联并部署
      if (applyForm.value.deployServers && applyForm.value.deployServers.length > 0) {
        addApplyLog('processing', `检测到 ${applyForm.value.deployServers.length} 个部署任务，正在开始部署...`)
        
        for (const deployConfig of applyForm.value.deployServers) {
          await window.electron.ipcRenderer.invoke('cert:add-deployment', 
            certId, 
            deployConfig.serverId,
            deployConfig.certPath,
            deployConfig.keyPath,
            deployConfig.passphrase
          )
          
          const server = servers.value.find(s => s.id === deployConfig.serverId)
          if (server) {
            try {
              addApplyLog('processing', `正在部署到服务器 [${server.name}]...`)
              await window.electron.ipcRenderer.invoke(
                'deploy:cert', 
                certId,
                deployConfig.serverId,
                deployConfig.certPath,
                deployConfig.keyPath,
                deployConfig.passphrase
              )
                addApplyLog('success', `服务器 [${server.name}] 部署成功`)
              } catch (error) {
                addApplyLog('error', `服务器 [${server.name}] 部署失败: ${error.message}`)
              }
            }
          }
        addApplyLog('success', '所有服务器部署任务已处理。')
      }
      
      message.success('申请并部署流程全部完成')
      loadCerts()
    } else {
      addApplyLog('error', '证书申请流程失败: ' + (result.error || result.data?.message || '未知错误'))
    }
  } catch (error) {
    console.error('Apply cert error:', error)
    isApplying.value = false
    addApplyLog('error', '致命错误: ' + error.message)
  }
}

const handleCancelApply = () => {
  applyModalVisible.value = false
}

const handleDeploy = (cert) => {
  deployingCert.value = cert
  // 加载已部署的配置
  deployServerConfigs.value = (cert.deployedServers || []).map(server => ({
    serverId: server.id,
    serverName: server.name,
    certPath: server.certPath,
    keyPath: server.keyPath,
    passphrase: server.passphrase
  }))
  deployModalVisible.value = true
}

const handleRedeploy = (record) => {
  if (!record.deployedServers || record.deployedServers.length === 0) {
    message.info('该证书尚未配置部署记录')
    return
  }

  Modal.confirm({
    title: '确认重新部署',
    content: h('div', [
      h('p', `即将把证书 ${record.domain} 部署到以下 ${record.deployedServers.length} 个服务器：`),
      h('ul', { style: { maxHeight: '200px', overflowY: 'auto', paddingLeft: '20px' } }, 
        record.deployedServers.map(s => h('li', `${s.name}: ${s.certPath}`))
      ),
      h('p', { style: { marginTop: '10px', color: '#8c8c8c' } }, '注意：如果目录不存在将自动创建')
    ]),
    onOk: async () => {
      const hide = message.loading('正在批量部署证书...', 0)
      try {
        let successCount = 0
        let failCount = 0
        
        for (const server of record.deployedServers) {
          try {
            const res = await window.electron.ipcRenderer.invoke(
              'deploy:cert', 
              record.id, 
              server.id, 
              server.certPath, 
              server.keyPath,
              server.passphrase
            )
            if (res.success) {
              successCount++
            } else {
              failCount++
              console.error(`Result for ${server.name}:`, res)
            }
          } catch (e) {
            failCount++
            console.error(`Deploy to ${server.name} error:`, e)
          }
        }
        
        hide()
        if (failCount === 0) {
          message.success(`成功部署到 ${successCount} 个服务器`)
        } else {
          message.warning(`部署完成：成功 ${successCount} 个，失败 ${failCount} 个`)
        }
        await loadCerts()
      } catch (e) {
        hide()
        message.error('部署遇到严重错误: ' + e.message)
      }
    }
  })
}

const handleDeployConfirm = async () => {
  if (!deployServerConfigs.value || deployServerConfigs.value.length === 0) {
    message.warning('请至少配置一个服务器部署')
    return
  }
  
  try {
    loading.value = true
    
    // 获取当前已部署的服务器ID
    const currentDeployedIds = (deployingCert.value.deployedServers || []).map(s => s.id)
    const newDeployIds = deployServerConfigs.value.map(c => c.serverId)
    
    // 找出需要删除的部署
    const toRemove = currentDeployedIds.filter(id => !newDeployIds.includes(id))
    
    // 移除已取消的部署关联
    for (const serverId of toRemove) {
      await window.electron.ipcRenderer.invoke('cert:remove-deployment', deployingCert.value.id, serverId)
    }
    
    // 执行部署操作
    const deployPromises = []
    
    for (const config of deployServerConfigs.value) {
      const server = servers.value.find(s => s.id === config.serverId)
      if (!server) continue
      
      // 添加或更新部署关联
      await window.electron.ipcRenderer.invoke('cert:add-deployment', 
        deployingCert.value.id, 
        config.serverId,
        config.certPath,
        config.keyPath,
        config.passphrase
      )
      
      // 执行部署
      deployPromises.push(
        window.electron.ipcRenderer.invoke(
          'deploy:cert', 
          deployingCert.value.id,
          config.serverId,
          config.certPath,
          config.keyPath,
          config.passphrase
        ).catch(error => {
          console.error(`部署到 ${server.name} 失败:`, error)
          return { success: false, error: error.message, serverName: server.name }
        })
      )
    }
    
    const results = await Promise.all(deployPromises)
    const successCount = results.filter(r => r && r.success !== false).length
    const failCount = results.length - successCount
    
    if (failCount === 0) {
      message.success(`证书部署成功，已部署到 ${successCount} 个服务器`)
    } else {
      message.warning(`部分部署失败：成功 ${successCount} 个，失败 ${failCount} 个`)
    }
    
    deployModalVisible.value = false
    loadCerts()
  } catch (error) {
    message.error('部署失败：' + error.message)
  } finally {
    loading.value = false
  }
}

const handleRenew = async (cert) => {
  isRenewMode.value = true
  
  // 1. 获取该域名上次申请的配置
  const config = await window.electron.ipcRenderer.invoke('cert:get-config', cert.domain)
  
  // 2. 预填表单
  applyForm.value = {
    domain: cert.domain,
    email: config?.email || '',
    dnsProvider: {
      type: config?.provider,
      accessKeyId: config?.accessKeyId || '',
      accessKeySecret: config?.accessKeySecret || ''
    },
    // 3. 复用部署记录
    deployServers: (cert.deployedServers || []).map(s => ({
      serverId: s.id,
      serverName: s.name,
      certPath: s.certPath,
      keyPath: s.keyPath,
      passphrase: s.passphrase
    }))
  }
  
  applyModalVisible.value = true
}

const handleDelete = (cert) => {
  pendingDeleteItem.value = cert
  verifyPassword.value = ''
  verifyModalVisible.value = true
}

const handleVerifyAndDelete = async () => {
  if (!verifyPassword.value) {
    message.warning('请输入登录密码')
    return
  }
  
  verifying.value = true
  try {
    // 获取当前用户信息
    let username = 'admin'
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        if (user.email) username = user.email
      }
    } catch(e) {}

    // 验证密码
    const isValid = await window.electron.ipcRenderer.invoke('admin:login', username, verifyPassword.value)
    
    if (isValid) {
      // 密码验证通过，执行删除
      const result = await window.electron.ipcRenderer.invoke('cert:delete', pendingDeleteItem.value.id)
      if (result) {
        message.success('验证通过，证书已删除')
        verifyModalVisible.value = false
        loadCerts()
      } else {
        message.error('删除操作失败')
      }
    } else {
      message.error('密码验证失败，无法执行删除')
    }
  } catch (error) {
    console.error(error)
    message.error('系统验证异常: ' + error.message)
  } finally {
    verifying.value = false
  }
}

const handleCopyLink = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    message.success('链接已复制')
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}
</script>

<style scoped>
.certificates-page {
  background: white;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f5f5f5;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: -0.5px;
}

.page-header h2::before {
  content: '';
  width: 4px;
  height: 20px;
  background: linear-gradient(to bottom, #1890ff, #722ed1);
  border-radius: 2px;
}

/* 按钮样式优化 */
:deep(.ant-btn) {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.ant-btn-primary) {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.25);
}

:deep(.ant-btn-primary:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(24, 144, 255, 0.35);
  opacity: 0.9;
}

/* 表格样式美化 */
.modern-table :deep(.ant-table) {
  background: transparent;
}

.modern-table :deep(.ant-table-thead > tr > th) {
  background: #f8faff;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #edf2f7;
  padding: 16px;
}

.modern-table :deep(.ant-table-tbody > tr > td) {
  padding: 16px;
  border-bottom: 1px solid #f0f4f8;
  transition: all 0.2s;
}

.modern-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #fcfdfe !important;
}

/* 单元格内容美化 */
.domain-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cert-icon {
  font-size: 18px;
  color: #1890ff;
}

.domain-text {
  font-weight: 600;
  color: #2d3748;
  font-family: 'Inter', -apple-system, sans-serif;
}

.server-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.modern-tag {
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 13px;
  border: none;
  transition: all 0.3s;
  display: flex;
  align-items: center;
}

.modern-tag.blue {
  background: #ebf8ff;
  color: #2b6cb0;
}

.modern-tag:hover {
  transform: scale(1.05);
}

/* 状态指示器 */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-dot.valid { background-color: #48bb78; box-shadow: 0 0 8px rgba(72, 187, 120, 0.5); }
.status-dot.expiring { background-color: #ed8936; box-shadow: 0 0 8px rgba(237, 137, 54, 0.5); }
.status-dot.expired { background-color: #f56565; box-shadow: 0 0 8px rgba(245, 101, 101, 0.5); }

.status-text {
  font-size: 13px;
  font-weight: 500;
}

.status-text.valid { color: #2f855a; }
.status-text.expiring { color: #c05621; }
.status-text.expired { color: #c53030; }

/* 剩余天数单元格 */
.days-cell {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.days-value {
  font-size: 18px;
  font-weight: 700;
  font-family: 'Monaco', monospace;
}

.days-unit {
  font-size: 12px;
  color: #a0aec0;
  font-weight: 500;
}

.date-text {
  color: #718096;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
}

.empty-text {
  color: #cbd5e0;
  font-style: italic;
  font-size: 13px;
}

/* 操作按钮组 */
.action-buttons {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 4px 8px !important;
  font-size: 13px;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.action-btn.primary { color: #3182ce; }
.action-btn.success { color: #38a169; }
.action-btn.warning { color: #d69e2e; }
.action-btn.error { color: #e53e3e; }

.action-btn.primary:hover { background: #ebf8ff; }
.action-btn.success:hover { background: #f0fff4; }
.action-btn.warning:hover { background: #fffaf0; }
.action-btn.error:hover { background: #fff5f5; }

/* 进度日志样式保持专业感 */
.progress-logs-container {
  background: #1a202c;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 12px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 12px;
  max-height: 350px;
  overflow-y: auto; /* 核心修复：允许滚动 */
  border: 1px solid #2d3748;
}

.deploy-item {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 12px 16px;
  margin-bottom: 8px;
}

 .deploy-item:hover {
  border-color: #4299e1;
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.1);
  background: #f7fafc;
}

/* 帮助弹窗样式 */
.help-modal-content {
  padding: 8px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

.step {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-num {
  width: 28px;
  height: 28px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-desc {
  flex: 1;
  font-size: 14px;
  color: #2d3748;
  line-height: 1.6;
}

.step-desc b {
  color: #1a202c;
  font-weight: 600;
}

.step-desc a {
  color: #1890ff;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: rgba(24, 144, 255, 0.3);
  text-underline-offset: 3px;
}

.step-desc a:hover {
  text-decoration-color: #1890ff;
}

.step-note {
  margin-top: 8px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  padding: 16px;
  font-size: 13px;
  color: #8c6114;
}

.step-note p {
  margin: 0;
  line-height: 1.6;
}

.step-note p:first-child {
  margin-bottom: 6px;
  font-weight: 600;
}
</style>

