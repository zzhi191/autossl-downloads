<template>
  <MainLayout>
  <div class="servers-page">
      <div class="page-header">
        <h2>服务器管理</h2>
          <a-button type="primary" @click="showAddModal">添加服务器</a-button>
        </div>
      
      <div class="page-content">
        <a-table
          :columns="columns"
          :data-source="servers"
          :loading="loading"
          row-key="id"
          class="modern-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="server-name-text">{{ record.name }}</span>
            </template>
            <template v-if="column.key === 'host'">
              <code class="host-code">{{ record.host }}</code>
            </template>
            <template v-if="column.key === 'authType'">
              <a-tag :color="record.privateKeyPath ? 'purple' : 'cyan'" class="modern-tag">
                {{ record.privateKeyPath ? '私钥认证' : '密码认证' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="text" size="small" class="action-btn primary" @click="handleEdit(record)">
                  <template #icon><EditOutlined /></template>
                  编辑
                </a-button>
                <a-popconfirm title="确定要删除该服务器吗？" @confirm="handleDelete(record)">
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
    
    <!-- 添加/编辑服务器对话框 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingServer ? '编辑服务器' : '添加服务器'"
      @ok="handleSave"
      @cancel="handleCancel"
      width="600px"
    >
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="服务器名称" name="name">
          <a-input v-model:value="form.name" placeholder="例如：生产服务器" />
        </a-form-item>
        
        <a-form-item label="主机地址" name="host">
          <a-input v-model:value="form.host" placeholder="例如：192.168.1.100" />
        </a-form-item>
        
        <a-form-item label="端口" name="port">
          <a-input-number v-model:value="form.port" :min="1" :max="65535" style="width: 100%" />
        </a-form-item>
        
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="form.username" placeholder="SSH用户名" />
        </a-form-item>
        
        <a-form-item label="认证方式" name="authType">
          <a-radio-group v-model:value="form.authType">
            <a-radio value="password">密码</a-radio>
            <a-radio value="key">私钥</a-radio>
          </a-radio-group>
        </a-form-item>
        
        <a-form-item v-if="form.authType === 'password'" label="密码" name="password">
          <a-input-password v-model:value="form.password" placeholder="SSH密码" />
        </a-form-item>
        
        <a-form-item v-if="form.authType === 'key'" label="本地SSH私钥" name="privateKeyPath">
          <a-input-group compact>
            <a-input
              v-model:value="form.privateKeyPath"
              style="width: calc(100% - 80px)"
              placeholder="~/.ssh/id_rsa"
            />
            <a-button @click="selectPrivateKeyFile">选择文件</a-button>
          </a-input-group>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            这是您本地电脑上用于登录服务器的SSH私钥文件路径
          </div>
        </a-form-item>
        
        <a-form-item v-if="form.authType === 'key'" label="私钥密码" name="keyPassphrase">
          <a-input-password
            v-model:value="form.keyPassphrase"
            placeholder="如果私钥有密码则填写，没有则留空"
          />
        </a-form-item>
        
        <a-form-item label="重载命令" name="reloadCommand">
          <a-textarea
            v-model:value="form.reloadCommand"
            :rows="2"
            placeholder="证书更新后执行的命令"
          />
          <div class="hint-text">
            例如：<code>nginx -s reload</code> 或 <code>systemctl restart nginx</code>
          </div>
        </a-form-item>
        
        <a-form-item label="前置命令" name="preCommand">
          <a-textarea
            v-model:value="form.preCommand"
            :rows="2"
            placeholder="上传证书前执行的命令"
          />
          <div class="hint-text">
            <span>选填，用于在部署前执行特定检查或停止服务</span>
          </div>
        </a-form-item>
      </a-form>
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
          description="该操作将永久删除服务器配置及相关数据，无法恢复。请谨慎操作！"
          type="error"
          show-icon
          style="margin-bottom: 20px;"
        />
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b;">待删除服务器：</span>
          <span style="font-weight: 700; color: #1e293b;">{{ pendingDeleteItem?.name }}</span>
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
import { ref, onMounted } from 'vue'
import { message, Modal, Popconfirm as APopconfirm } from 'ant-design-vue'
import axios from 'axios'
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  SafetyOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue'
import MainLayout from '@/components/MainLayout.vue'

const API_BASE = 'https://tools.fogomo.com/api'
const APP_CODE = 'certd-electron'
const loading = ref(false)
const servers = ref([])
const modalVisible = ref(false)
const editingServer = ref(null)
const formRef = ref()

// 删除验证相关
const verifyModalVisible = ref(false)
const verifyPassword = ref('')
const verifying = ref(false)
const pendingDeleteItem = ref(null)

const getCurrentUserEmail = () => {
  const userStr = localStorage.getItem('user')
  if (!userStr) return ''

  try {
    const user = JSON.parse(userStr)
    return user.email || ''
  } catch (e) {
    return ''
  }
}

const getAuthPayload = (response) => response?.data?.data || response?.data || {}

const verifyRemotePassword = async (password) => {
  const email = getCurrentUserEmail()
  if (!email || email === 'admin') {
    throw new Error('请先使用远程账号登录')
  }

  const res = await axios.post(`${API_BASE}/auth/login`, {
    email,
    pass: password,
    appCode: APP_CODE
  })
  return Boolean(getAuthPayload(res).access_token)
}

const form = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKeyPath: '~/.ssh/id_rsa',
  keyPassphrase: '',
  reloadCommand: '',
  preCommand: ''
})

const rules = {
  name: [{ required: true, message: '请输入服务器名称' }],
  host: [{ required: true, message: '请输入主机地址' }],
  port: [{ required: true, message: '请输入端口' }],
  username: [{ required: true, message: '请输入用户名' }],
  password: [
    {
      validator: (rule, value) => {
        if (form.value.authType === 'password' && !value) {
          return Promise.reject('请输入密码')
        }
        return Promise.resolve()
      }
    }
  ],
  privateKeyPath: [
    {
      validator: (rule, value) => {
        if (form.value.authType === 'key' && !value) {
          return Promise.reject('请选择私钥文件路径')
        }
        return Promise.resolve()
      }
    }
  ]
}

const columns = [
  { title: '服务器名称', dataIndex: 'name', key: 'name' },
  { title: '主机地址', dataIndex: 'host', key: 'host' },
  { title: '端口', dataIndex: 'port', key: 'port', width: 100 },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '认证方式', key: 'authType', width: 120 },
  { title: '操作', key: 'action', width: 180 }
]

onMounted(() => {
  loadServers()
})

const loadServers = async () => {
  loading.value = true
  try {
    servers.value = await window.electron.ipcRenderer.invoke('server:get-all')
  } catch (error) {
    message.error('加载服务器列表失败：' + error.message)
  } finally {
    loading.value = false
  }
}

const showAddModal = () => {
  editingServer.value = null
  form.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKeyPath: '~/.ssh/id_rsa',
    keyPassphrase: '',
    reloadCommand: '',
    preCommand: ''
  }
  modalVisible.value = true
}

const selectPrivateKeyFile = async () => {
  try {
    const result = await window.electron.ipcRenderer.invoke('dialog:open-file', {
      title: '选择SSH私钥文件',
      defaultPath: '~/.ssh',
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'showHiddenFiles']
    })
    if (result && result.length > 0) {
      form.value.privateKeyPath = result[0]
    }
  } catch (error) {
    console.error('Select file error:', error)
  }
}

const handleEdit = (server) => {
  editingServer.value = server
  form.value = {
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authType: server.privateKeyPath ? 'key' : 'password',
    password: server.password || '',
    privateKeyPath: server.privateKeyPath || '~/.ssh/id_rsa',
    keyPassphrase: server.keyPassphrase || '',
    reloadCommand: server.reloadCommand || '',
    preCommand: server.preCommand || ''
  }
  modalVisible.value = true
}

const handleSave = async () => {
  try {
    await formRef.value.validate()
    
    const serverData = {
      id: editingServer?.value?.id || Date.now().toString(),
      name: form.value.name,
      host: form.value.host,
      port: form.value.port,
      username: form.value.username,
      password: form.value.authType === 'password' ? form.value.password : null,
      privateKeyPath: form.value.authType === 'key' ? form.value.privateKeyPath : null,
      keyPassphrase: form.value.authType === 'key' ? form.value.keyPassphrase : null,
      reloadCommand: form.value.reloadCommand,
      preCommand: form.value.preCommand
    }
    
    const result = await window.electron.ipcRenderer.invoke('server:save', serverData)
    
    if (result.success) {
      message.success(editingServer.value ? '更新成功' : '添加成功')
      modalVisible.value = false
      loadServers()
    } else {
      message.error(result.error || '保存失败')
    }
  } catch (error) {
    console.error('Save server error:', error)
  }
}

const handleCancel = () => {
  modalVisible.value = false
  editingServer.value = null
}

const handleDelete = (server) => {
  pendingDeleteItem.value = server
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
    const isValid = await verifyRemotePassword(verifyPassword.value)
    
    if (isValid) {
      // 密码验证通过，执行删除
      const result = await window.electron.ipcRenderer.invoke('server:delete', pendingDeleteItem.value.id)
      if (result) {
        message.success('验证通过，服务器已删除')
        verifyModalVisible.value = false
        loadServers()
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
</script>

<style scoped>
.servers-page {
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

.server-name-text {
  font-weight: 600;
  color: #2d3748;
}

.host-code {
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  color: #475569;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
}

.modern-tag {
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  border: none;
}

/* 操作按钮组 */
.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 4px 8px !important;
  font-size: 13px;
}

.action-btn.primary { color: #3182ce; }
.action-btn.error { color: #e53e3e; }

.action-btn.primary:hover { background: #ebf8ff; }
.action-btn.error:hover { background: #fff5f5; }

.hint-text {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid #e2e8f0;
}

.hint-text code {
  color: #1e293b;
  font-weight: 600;
  background: transparent;
  padding: 0;
}
</style>
