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
          :scroll="{ x: 960 }"
          class="modern-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'domain'">
              <div class="domain-cell">
                <SafetyCertificateOutlined class="cert-icon" />
                <span class="domain-text">{{ record.domain }}</span>
                <span :class="['domain-status-badge', record.status]">{{ getStatusText(record.status) }}</span>
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
                <a-tag :class="['deploy-state-tag', getDeployState(record).type]">
                  {{ getDeployState(record).text }}
                </a-tag>
              </div>
              <span v-else class="empty-text">未配置</span>
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
                <a-tooltip :title="getRenewTooltip(record)">
                  <a-button
                    type="text"
                    size="small"
                    class="action-btn warning"
                    :loading="renewingId === record.id"
                    @click="handleRenew(record)"
                  >
                    <template #icon><ReloadOutlined /></template>
                    续期
                  </a-button>
                </a-tooltip>
                <a-tooltip :title="getDeployTooltip(record)">
                      <a-button
                        type="text"
                        size="small"
                        :class="['action-btn', getDeployActionClass(record)]"
                        @click="handleDeploy(record)"
                      >
                        <template #icon><CloudUploadOutlined /></template>
                        {{ hasDeployConfig(record) ? '重新部署' : '部署设置' }}
                      </a-button>
                    </a-tooltip>
                <a-tooltip title="查看这张证书最近的部署日志与落地路径">
                  <a-button
                    type="text"
                    size="small"
                    class="action-btn success"
                    @click="handleViewDeployLogs(record)"
                  >
                    <template #icon><InfoCircleOutlined /></template>
                    日志
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑部署配置（目标服务器、证书/私钥落盘路径）">
                  <a-button
                    type="text"
                    size="small"
                    class="action-btn primary"
                    @click="handleEditCert(record)"
                  >
                    <template #icon><EditOutlined /></template>
                    编辑
                  </a-button>
                </a-tooltip>
                <a-popconfirm v-if="canDeleteCert(record)" title="确定要删除该证书吗？" @confirm="handleDelete(record)">
                  <a-button type="text" size="small" danger class="action-btn error">
                    <template #icon><DeleteOutlined /></template>
                    删除
                  </a-button>
                </a-popconfirm>
                <a-tooltip v-else title="生效中的证书不允许删除，只有已过期证书才可以删除">
                  <span>
                    <a-button type="text" size="small" danger class="action-btn disabled" :disabled="true">
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-button>
                  </span>
                </a-tooltip>
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
           <a-select placeholder="选择已验证凭证可自动回填信息" @change="handleProfileSelect" allowClear>
              <a-select-option v-for="p in accessProfiles" :key="p.accessKeyId" :value="p.accessKeyId">
                  {{ p.type }} - {{ p.accessKeyId.substring(0, 6) }}******
              </a-select-option>
           </a-select>
        </a-form-item>

        <a-form-item label="DNS 服务商" name="dnsProviderType">
          <a-select v-model:value="applyForm.dnsProvider.type" placeholder="请选择域名解析服务商" @change="handleDnsProviderChange">
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
            />
          </a-form-item>
          <a-form-item label="SecretKey" :name="['dnsProvider', 'accessKeySecret']" :rules="[{ required: true, message: '请输入 AccessKey Secret' }]">
            <a-input-password 
              v-model:value="applyForm.dnsProvider.accessKeySecret" 
              placeholder="请输入云厂商 AccessKey Secret"
            />
          </a-form-item>
        </template>
        
        <a-form-item label="部署服务器" name="deployServers">
          <div style="width: 100%;">
            <a-alert
              message="建议先配置部署"
              description="配置好服务器和证书目录后，本次申请成功会自动部署；以后点“续期”也会自动部署到这里。"
              type="info"
              show-icon
              style="margin-bottom: 12px;"
            />
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
      :title="progressModalTitle"
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
            <a-step title="部署/完成" />
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
      :title="`部署证书 · ${deployingCert?.domain || ''}`"
      :ok-text="hasDeployConfig(deployingCert) ? '保存并重新部署' : '保存并部署'"
      cancel-text="取消"
      :confirm-loading="loading"
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
            推荐示例：/etc/nginx/ssl/[domain]/public.pem 或 /etc/nginx/ssl/[domain]/ <span style="color: #ff4d4f;">（填目录时会自动写入 public.pem；请确保与 Nginx 配置一致）</span>
          </div>
        </a-form-item>
        <a-form-item label="SSL 私钥路径" name="keyPath">
          <a-input 
            v-model:value="deployConfigForm.keyPath" 
            placeholder="/etc/nginx/ssl/[domain]/private.key"
            @blur="autoCompleteKeyPath"
          />
          <div style="color: #8c8c8c; font-size: 12px; margin-top: 4px;">
            推荐示例：/etc/nginx/ssl/[domain]/private.key 或 /etc/nginx/ssl/[domain]/ <span style="color: #ff4d4f;">（填目录时会自动写入 private.key；请确保与 Nginx 配置一致）</span>
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

    <!-- 编辑证书部署配置对话框 -->
    <a-modal
      v-model:open="editCertModalVisible"
      :title="`编辑部署配置 · ${editingCert?.domain || ''}`"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="editCertSaving"
      @ok="handleEditCertSave"
      @cancel="editCertModalVisible = false"
      width="600px"
      :zIndex="1010"
    >
      <a-alert
        message="修改后会写入该证书的部署配置"
        description="之后点“续期”或下次自动续期时，会按这里的服务器和路径部署。若与线上 Nginx 实际读取的文件名不一致，请勾选下方选项保存后立即部署一次。"
        type="info"
        show-icon
        style="margin-bottom: 16px;"
      />
      <a-form
        ref="editCertFormRef"
        :model="editCertForm"
        :rules="editCertRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="目标服务器" name="serverId">
          <a-select
            v-model:value="editCertForm.serverId"
            placeholder="选择服务器"
            @change="handleEditServerChange"
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
            v-model:value="editCertForm.certPath"
            placeholder="/etc/nginx/ssl/[domain]/www.example.com.pem"
          />
        </a-form-item>
        <a-form-item label="SSL 私钥路径" name="keyPath">
          <a-input
            v-model:value="editCertForm.keyPath"
            placeholder="/etc/nginx/ssl/[domain]/www.example.com.key"
          />
        </a-form-item>
        <a-form-item
          v-if="editSelectedServer && editSelectedServer.privateKey"
          label="私钥密码"
          name="passphrase"
        >
          <a-input-password
            v-model:value="editCertForm.passphrase"
            placeholder="如果私钥有密码短语(Passphrase)，请输入"
          />
        </a-form-item>
        <a-form-item :wrapper-col="{ span: 18, offset: 6 }">
          <a-checkbox v-model:checked="editCertForm.redeploy">
            保存后立即重新部署
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="deployLogModalVisible"
      :title="`部署日志 · ${deployLogCert?.domain || ''}`"
      :footer="null"
      width="860px"
      :zIndex="1015"
    >
      <div class="deploy-log-modal">
        <div class="deploy-log-toolbar">
          <div class="deploy-log-summary">
            最近 {{ filteredDeployLogs.length }} / {{ deployLogs.length }} 条记录
          </div>
          <div class="deploy-log-actions">
            <div class="deploy-log-filters">
              <a-button
                size="small"
                :type="deployLogFilter === 'all' ? 'primary' : 'default'"
                @click="deployLogFilter = 'all'"
              >
                全部
              </a-button>
              <a-button
                size="small"
                :type="deployLogFilter === 'success' ? 'primary' : 'default'"
                @click="deployLogFilter = 'success'"
              >
                成功
              </a-button>
              <a-button
                size="small"
                :type="deployLogFilter === 'error' ? 'primary' : 'default'"
                @click="deployLogFilter = 'error'"
              >
                失败
              </a-button>
            </div>
            <a-select
              v-model:value="deployLogServerFilter"
              size="small"
              style="width: 180px"
              placeholder="筛选服务器"
            >
              <a-select-option value="all">全部服务器</a-select-option>
              <a-select-option
                v-for="serverName in deployLogServerOptions"
                :key="serverName"
                :value="serverName"
              >
                {{ serverName }}
              </a-select-option>
            </a-select>
            <a-button
              size="small"
              :loading="deployLogsLoading"
              @click="handleRefreshDeployLogs"
            >
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
            <a-button
              type="primary"
              size="small"
              :disabled="filteredDeployLogs.length === 0"
              @click="handleCopyDeployLogs"
            >
              <template #icon><CopyOutlined /></template>
              复制日志
            </a-button>
          </div>
        </div>

        <div v-if="deployLogsLoading" class="deploy-log-loading">
          <a-spin size="small" />
          <span>正在加载部署日志...</span>
        </div>

        <div v-else-if="filteredDeployLogs.length === 0" class="deploy-log-empty">
          {{ deployLogs.length === 0
            ? '暂无部署日志。完成一次部署或续期后，这里会展示最终落地路径和错误信息。'
            : '当前筛选条件下没有匹配记录，可以切换状态或服务器筛选继续查看。' }}
        </div>

        <div v-else class="deploy-log-list">
          <div
            v-for="log in filteredDeployLogs"
            :key="log.id"
            class="deploy-log-item"
          >
            <div class="deploy-log-head">
              <div class="deploy-log-meta">
                <a-tag :color="log.status === 'success' ? 'green' : 'red'">
                  {{ log.status === 'success' ? '成功' : '失败' }}
                </a-tag>
                <span class="deploy-log-server">{{ log.serverName }}</span>
                <span class="deploy-log-time">{{ formatDeployLogTime(log.created_at) }}</span>
              </div>
            </div>
            <div class="deploy-log-body">
              <div v-if="log.parsedMessage.summary" class="deploy-log-summary-text">
                {{ log.parsedMessage.summary }}
              </div>
              <div v-if="log.parsedMessage.certPath" class="deploy-log-field">
                <span class="deploy-log-label">CERT</span>
                <div class="deploy-log-field-value">
                  <code class="deploy-log-code">{{ log.parsedMessage.certPath }}</code>
                  <a-button
                    type="text"
                    size="small"
                    class="deploy-log-copy-btn"
                    @click="copyText(log.parsedMessage.certPath, '证书路径已复制')"
                  >
                    <template #icon><CopyOutlined /></template>
                    复制
                  </a-button>
                </div>
              </div>
              <div v-if="log.parsedMessage.keyPath" class="deploy-log-field">
                <span class="deploy-log-label">KEY</span>
                <div class="deploy-log-field-value">
                  <code class="deploy-log-code">{{ log.parsedMessage.keyPath }}</code>
                  <a-button
                    type="text"
                    size="small"
                    class="deploy-log-copy-btn"
                    @click="copyText(log.parsedMessage.keyPath, '私钥路径已复制')"
                  >
                    <template #icon><CopyOutlined /></template>
                    复制
                  </a-button>
                </div>
              </div>
              <div v-if="log.parsedMessage.error" class="deploy-log-field error">
                <span class="deploy-log-label">ERROR</span>
                <div class="deploy-log-field-value">
                  <code class="deploy-log-code">{{ log.parsedMessage.error }}</code>
                  <a-button
                    type="text"
                    size="small"
                    class="deploy-log-copy-btn"
                    @click="copyText(log.parsedMessage.error, '错误信息已复制')"
                  >
                    <template #icon><CopyOutlined /></template>
                    复制
                  </a-button>
                </div>
              </div>
              <pre class="deploy-log-message">{{ log.message }}</pre>
            </div>
          </div>
        </div>
      </div>
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
  ReloadOutlined,
  DeleteOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  EditOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import axios from 'axios'
import MainLayout from '@/components/MainLayout.vue'

const API_BASE = 'https://tools.fogomo.com/api'
const APP_CODE = 'certd-electron'
const loading = ref(false)
const certs = ref([])
const servers = ref([])
const applyModalVisible = ref(false)
const deployModalVisible = ref(false)
const deployConfigModalVisible = ref(false)
const deployingCert = ref(null)
const deployServerConfigs = ref([])
const deployLogModalVisible = ref(false)
const deployLogCert = ref(null)
const deployLogs = ref([])
const deployLogsLoading = ref(false)
const deployLogFilter = ref('all')
const deployLogServerFilter = ref('all')
const applyFormRef = ref()
const deployConfigFormRef = ref()
const inlineServerFormRef = ref()
const inlineServerModalVisible = ref(false)
const editingDeployIndex = ref(-1)
// 编辑部署配置
const editCertModalVisible = ref(false)
const editingCert = ref(null)
const editCertSaving = ref(false)
const editCertFormRef = ref()
const helpModalVisible = ref(false)
const helpActiveTab = ref('aliyun')

// 删除验证相关
const verifyModalVisible = ref(false)
const verifyPassword = ref('')
const verifying = ref(false)
const pendingDeleteItem = ref(null)
const renewingId = ref(null)

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

// 编辑部署配置表单
const editCertForm = ref({
  serverId: null,
  certPath: '',
  keyPath: '',
  passphrase: '',
  redeploy: true
})

const editCertRules = {
  serverId: [{ required: true, message: '请选择服务器' }],
  certPath: [{ required: true, message: '请输入 SSL 公钥路径' }],
  keyPath: [{ required: true, message: '请输入 SSL 私钥路径' }]
}

const editSelectedServer = computed(() => {
  return servers.value.find(s => s.id === editCertForm.value.serverId)
})

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

const getDeploySuccessMessage = (deployResult, fallbackServerName) => {
  if (deployResult?.message) return deployResult.message
  return `部署成功: ${fallbackServerName}`
}

const normalizeDeployResult = (result, fallbackServerName) => {
  const serverName = result?.serverName || fallbackServerName || '未知服务器'
  if (result?.success === false) {
    return {
      success: false,
      serverName,
      detail: `部署失败: ${serverName}${result?.error ? ` | error=${result.error}` : ''}`
    }
  }

  return {
    success: true,
    serverName,
    detail: getDeploySuccessMessage(result, serverName)
  }
}

const copyText = (text, successText = '内容已复制') => {
  navigator.clipboard.writeText(text).then(() => {
    message.success(successText)
  }).catch(() => {
    message.error('复制失败，请手动复制')
  })
}

const showDeployResultModal = (title, results) => {
  if (!results || results.length === 0) return

  const normalizedResults = results.map(result => normalizeDeployResult(result))
  const summaryText = normalizedResults.map(item => item.detail).join('\n')

  Modal.info({
    title,
    width: 820,
    okText: '关闭',
    content: () => h('div', { style: 'display:flex; flex-direction:column; gap:12px; margin-top: 8px;' }, [
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px;' }, [
        h('span', { style: 'color:#64748b; font-size:12px;' }, `共 ${normalizedResults.length} 条结果，可直接复制给运维或用于排查。`),
        h(Button, {
          type: 'primary',
          size: 'small',
          onClick: () => copyText(summaryText, '部署结果已复制')
        }, { default: () => '复制结果' })
      ]),
      h('pre', {
        style: 'margin:0; max-height:360px; overflow:auto; padding:12px; border-radius:8px; background:#0f172a; color:#e2e8f0; font-size:12px; line-height:1.6; white-space:pre-wrap; word-break:break-all;'
      }, summaryText)
    ])
  })
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
  { title: '剩余天数', key: 'daysLeft', width: 100 },
  { title: '过期时间', key: 'expiresTime', width: 150 },
  { title: '操作', key: 'action', width: 260 }
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

const handleDnsProviderChange = async (provider) => {
  if (!provider) {
    applyForm.value.dnsProvider.accessKeyId = ''
    applyForm.value.dnsProvider.accessKeySecret = ''
    return
  }

  try {
    const credentials = await window.electron.ipcRenderer.invoke('profile:get-by-provider', provider)
    applyForm.value.dnsProvider.accessKeyId = credentials?.accessKeyId || ''
    applyForm.value.dnsProvider.accessKeySecret = credentials?.accessKeySecret || ''
  } catch (error) {
    console.error('Load DNS provider credentials failed:', error)
    applyForm.value.dnsProvider.accessKeyId = ''
    applyForm.value.dnsProvider.accessKeySecret = ''
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
    
    // 计算剩余天数和状态
    const mappedCerts = allCerts.map(cert => {
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

    const latestDeployLogs = await Promise.all(
      mappedCerts.map(cert => loadLatestDeployLog(cert.id))
    )

    certs.value = mappedCerts.map((cert, index) => ({
      ...cert,
      latestDeployLog: latestDeployLogs[index]
    }))
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
const progressModalTitle = ref('证书申请流程')
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const updateApplyStepFromProgress = (step, logMsg) => {
  let targetStep = currentApplyStep.value

  if (step === 'init') {
    targetStep = 0
  } else if (step === 'dns-add' || step === 'dns-wait' || step === 'dns-remove') {
    targetStep = 1
  } else if (step === 'acme') {
    targetStep = logMsg.includes('Finalizing') || logMsg.includes('downloading') || logMsg.includes('核发')
      ? 2
      : 1
  } else if (step === 'success') {
    targetStep = 2
  } else if (step === 'deploy' || step === 'done') {
    targetStep = 3
  }

  currentApplyStep.value = Math.max(currentApplyStep.value, targetStep)
}

const refreshCertListAfterChange = async (domain, expectedCertId = null, retries = 4) => {
  for (let index = 0; index < retries; index += 1) {
    await loadCerts()

    const matchedCert = certs.value.find(item => {
      if (expectedCertId && item.id === expectedCertId) return true
      return item.domain === domain
    })

    if (matchedCert) {
      return matchedCert
    }

    if (index < retries - 1) {
      await sleep(500)
    }
  }

  return null
}

const hasDeployConfig = (cert) => Array.isArray(cert?.deployedServers) && cert.deployedServers.length > 0
const canDeleteCert = (cert) => cert?.status === 'expired'

const getRenewTooltip = (cert) => {
  if (hasDeployConfig(cert)) {
    return '续期成功后会自动部署到部署配置里的服务器'
  }
  return '续期证书。当前未配置部署，续期后只会更新本地证书'
}

const getDeployTooltip = (cert) => {
  if (hasDeployConfig(cert)) {
    return '已有部署配置，点击可重新部署或修改服务器和目录'
  }
  return '先配置部署服务器和目录。配置后，申请成功和以后续期都会自动部署'
}

const getDeployActionClass = (cert) => {
  if (!hasDeployConfig(cert)) return 'primary'
  return cert?.latestDeployLog && cert.latestDeployLog.status !== 'success' ? 'error' : 'primary'
}

const getDeployState = (cert) => {
  if (!hasDeployConfig(cert)) {
    return { text: '未配置', type: 'empty' }
  }

  const log = cert.latestDeployLog
  if (!log) {
    return { text: '配置未部署', type: 'pending' }
  }

  if (log.status === 'success') {
    return { text: '最近部署成功', type: 'success' }
  }

  return { text: '最近部署失败', type: 'error' }
}

const formatDeployLogTime = (value) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

const getServerNameById = (serverId) => {
  const server = servers.value.find(item => item.id === serverId)
  return server ? server.name : serverId
}

const parseDeployMessage = (messageText) => {
  const raw = String(messageText || '')
  const parts = raw.split(' | ').map(item => item.trim()).filter(Boolean)
  const parsed = {
    summary: parts[0] || raw,
    certPath: '',
    keyPath: '',
    error: ''
  }

  for (const part of parts.slice(1)) {
    if (part.startsWith('cert=')) {
      parsed.certPath = part.slice(5)
    } else if (part.startsWith('key=')) {
      parsed.keyPath = part.slice(4)
    } else if (part.startsWith('error=')) {
      parsed.error = part.slice(6)
    }
  }

  return parsed
}

const buildDeployLogSummary = (logs) => logs.map(log => {
  const statusText = log.status === 'success' ? '成功' : '失败'
  return `[${formatDeployLogTime(log.created_at)}] [${statusText}] [${log.serverName}] ${log.message}`
}).join('\n')

const deployLogServerOptions = computed(() => {
  return Array.from(new Set(deployLogs.value.map(log => log.serverName).filter(Boolean))).sort((a, b) => a.localeCompare(b))
})

const filteredDeployLogs = computed(() => {
  return deployLogs.value.filter(log => {
    const matchesStatus = deployLogFilter.value === 'all' || log.status === deployLogFilter.value
    const matchesServer = deployLogServerFilter.value === 'all' || log.serverName === deployLogServerFilter.value
    return matchesStatus && matchesServer
  })
})

const handleCopyDeployLogs = () => {
  if (filteredDeployLogs.value.length === 0) return
  copyText(buildDeployLogSummary(filteredDeployLogs.value), '部署日志已复制')
}

const loadDeployLogs = async (certId) => {
  deployLogsLoading.value = true

  try {
    const logs = await window.electron.ipcRenderer.invoke('log:deploy', 30, certId)
    deployLogs.value = (logs || []).map(log => ({
      ...log,
      serverName: getServerNameById(log.server_id),
      parsedMessage: parseDeployMessage(log.message)
    }))
  } catch (error) {
    console.error('Load deploy logs failed:', error)
    deployLogs.value = []
    message.error('加载部署日志失败：' + error.message)
  } finally {
    deployLogsLoading.value = false
  }
}

const loadLatestDeployLog = async (certId) => {
  try {
    const logs = await window.electron.ipcRenderer.invoke('log:deploy', 1, certId)
    return Array.isArray(logs) && logs.length > 0 ? logs[0] : null
  } catch (error) {
    console.error('Load latest deploy log failed:', error)
    return null
  }
}

const handleRefreshDeployLogs = async () => {
  if (!deployLogCert.value?.id) return
  await loadDeployLogs(deployLogCert.value.id)
}

const handleViewDeployLogs = async (cert) => {
  deployLogCert.value = cert
  deployLogFilter.value = 'all'
  deployLogServerFilter.value = 'all'
  deployLogModalVisible.value = true
  await loadDeployLogs(cert.id)
}

const confirmApplyWithoutDeploy = () => new Promise((resolve) => {
  Modal.confirm({
    title: '未配置自动部署',
    content: '建议先配置部署服务器和目录。这样本次申请成功后会自动部署，后面点“续期”也会自动部署。现在继续的话，本次只会申请证书，不会自动部署。',
    okText: '继续申请',
    cancelText: '先去配置',
    onOk: () => resolve(true),
    onCancel: () => resolve(false)
  })
})

const showApplyModal = async () => {
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

    if (!applyForm.value.deployServers || applyForm.value.deployServers.length === 0) {
      const shouldContinue = await confirmApplyWithoutDeploy()
      if (!shouldContinue) {
        return
      }
    }

	    // 1. 初始化进度状态
	    applyModalVisible.value = false
	    applyProgressVisible.value = true
	    progressModalTitle.value = `证书申请流程 · ${applyForm.value.domain}`
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
	        updateApplyStepFromProgress(step, logMsg)
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

	      currentApplyStep.value = Math.max(currentApplyStep.value, 2)
	      addApplyLog('success', '证书已签发并安全存储。')

      const certId = result.data.certId;
      
      // 如果配置了部署服务器，添加部署关联并部署
      let deploySuccessCount = 0
      let deployFailCount = 0
      const deployResults = []

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
              const deployResult = await window.electron.ipcRenderer.invoke(
                'deploy:cert', 
                certId,
                deployConfig.serverId,
                deployConfig.certPath,
                deployConfig.keyPath,
                deployConfig.passphrase
              )

              if (deployResult?.success === false) {
                deployFailCount += 1
                deployResults.push({ ...deployResult, serverName: server.name })
                addApplyLog('error', `服务器 [${server.name}] 部署失败: ${deployResult.error || '未知错误'}`)
              } else {
                deploySuccessCount += 1
                deployResults.push({ ...deployResult, serverName: server.name })
                addApplyLog('success', getDeploySuccessMessage(deployResult, server.name))
              }
            } catch (error) {
              deployFailCount += 1
              deployResults.push({ success: false, error: error.message, serverName: server.name })
              addApplyLog('error', `服务器 [${server.name}] 部署失败: ${error.message}`)
            }
          }
        }

	        if (deployFailCount === 0) {
	          addApplyLog('success', `所有服务器部署任务已完成，共成功 ${deploySuccessCount} 个。`)
	        } else {
	          addApplyLog('warning', `服务器部署已结束：成功 ${deploySuccessCount} 个，失败 ${deployFailCount} 个。`)
	        }
	        currentApplyStep.value = 3
	      } else {
	        currentApplyStep.value = 3
	      }
      
      await refreshCertListAfterChange(applyForm.value.domain, certId)

      if (!applyForm.value.deployServers || applyForm.value.deployServers.length === 0) {
        message.success('证书申请完成，已保存到本地证书库')
      } else if (deployFailCount === 0) {
        message.success(`证书申请完成，已部署到 ${deploySuccessCount} 个服务器`)
      } else if (deploySuccessCount === 0) {
        message.warning('证书申请完成，但部署全部失败，请检查服务器配置和部署日志')
      } else {
        message.warning(`证书申请完成，部署部分失败：成功 ${deploySuccessCount} 个，失败 ${deployFailCount} 个`)
      }

      if (deployResults.length > 0) {
        showDeployResultModal('申请后的部署结果', deployResults)
      }
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
        ).then(result => ({
          ...result,
          serverName: server.name
        })).catch(error => {
          console.error(`部署到 ${server.name} 失败:`, error)
          return { success: false, error: error.message, serverName: server.name }
        })
      )
    }
    
    const results = await Promise.all(deployPromises)
    const successCount = results.filter(r => r && r.success !== false).length
    const failCount = results.length - successCount
    const firstSuccess = results.find(r => r && r.success !== false)
    
    if (failCount === 0) {
      if (successCount === 1 && firstSuccess) {
        message.success(getDeploySuccessMessage(firstSuccess, firstSuccess.serverName))
      } else {
        message.success(`证书部署成功，已部署到 ${successCount} 个服务器`)
      }
    } else {
      message.warning(`部分部署失败：成功 ${successCount} 个，失败 ${failCount} 个`)
    }

    showDeployResultModal('证书部署结果', results)
    
    deployModalVisible.value = false
    await loadCerts()
  } catch (error) {
    message.error('部署失败：' + error.message)
  } finally {
    loading.value = false
  }
}

// 打开编辑部署配置弹窗：默认定位到证书当前绑定的服务器，其次取第一个部署记录
const handleEditCert = (cert) => {
  editingCert.value = cert
  const deployments = cert.deployedServers || []
  const initial = deployments.find(d => d.id === cert.serverId) || deployments[0] || null

  editCertForm.value = {
    serverId: initial?.id || cert.serverId || null,
    certPath: initial?.certPath || '',
    keyPath: initial?.keyPath || '',
    passphrase: initial?.passphrase || '',
    redeploy: true
  }
  editCertModalVisible.value = true
}

// 切换服务器时：若该证书已有此服务器的部署记录，则回填其路径
const handleEditServerChange = (serverId) => {
  const deployment = (editingCert.value?.deployedServers || []).find(d => d.id === serverId)
  if (deployment) {
    editCertForm.value.certPath = deployment.certPath
    editCertForm.value.keyPath = deployment.keyPath
    editCertForm.value.passphrase = deployment.passphrase || ''
  }
}

// 保存部署配置；可选保存后复用既有部署链路重新部署一次
const handleEditCertSave = async () => {
  if (!editingCert.value) return

  try {
    await editCertFormRef.value.validate()
  } catch (error) {
    return
  }

  const { serverId, certPath, keyPath, passphrase, redeploy } = editCertForm.value
  const server = servers.value.find(s => s.id === serverId)

  editCertSaving.value = true
  try {
    const saveResult = await window.electron.ipcRenderer.invoke(
      'cert:update-deployment',
      editingCert.value.id,
      serverId,
      certPath,
      keyPath,
      passphrase
    )

    if (!saveResult?.success) {
      message.error(saveResult?.error || '保存部署配置失败')
      return
    }

    if (redeploy) {
      try {
        const deployResult = await window.electron.ipcRenderer.invoke(
          'deploy:cert',
          editingCert.value.id,
          serverId,
          certPath,
          keyPath,
          passphrase
        )
        showDeployResultModal('证书部署结果', [{ ...deployResult, serverName: server?.name }])
        if (deployResult?.success === false) {
          message.warning('部署配置已保存，但重新部署失败：' + (deployResult.error || '未知错误'))
        } else {
          message.success(getDeploySuccessMessage(deployResult, server?.name || '服务器'))
        }
      } catch (deployError) {
        message.warning('部署配置已保存，但重新部署失败：' + deployError.message)
      }
    } else {
      message.success('部署配置已保存')
    }

    editCertModalVisible.value = false
    await loadCerts()
  } finally {
    editCertSaving.value = false
  }
}

const handleRenew = async (cert) => {
  const hasDeployments = cert.deployedServers && cert.deployedServers.length > 0

  Modal.confirm({
    title: '确认续期',
    content: hasDeployments
      ? `将为 ${cert.domain} 重新签发证书。续期成功后会自动部署到部署配置里的服务器。`
      : `将为 ${cert.domain} 重新签发证书。当前还没配置部署，所以这次只会更新本地证书。`,
    okText: '开始续期',
    cancelText: '取消',
	    onOk: async () => {
	      renewingId.value = cert.id
	      progressModalTitle.value = `证书续期流程 · ${cert.domain}`
	      applyProgressVisible.value = true
	      currentApplyStep.value = 0
	      applyLogs.value = []
	      isApplying.value = true
	      addApplyLog('processing', `正在为 ${cert.domain} 准备续期...`)
	
	      const removeListener = window.electron.ipcRenderer.on('auto-renew:progress', (data) => {
	        const { step, status, message: logMsg } = data
	        addApplyLog(status || 'processing', logMsg)
	        updateApplyStepFromProgress(step, logMsg)
	      })
	
	      try {
	        const result = await window.electron.ipcRenderer.invoke('auto-renew:renew-cert', cert.id)
	        currentApplyStep.value = 3
	        addApplyLog('success', result?.message || `${cert.domain} 续期完成。`)
	        await refreshCertListAfterChange(cert.domain, cert.id)
	        message.success(result?.message || `${cert.domain} 续期成功`)
	      } catch (error) {
	        addApplyLog('error', '续期失败：' + error.message)
	        message.error('续期失败：' + error.message)
	      } finally {
	        if (removeListener) removeListener()
	        isApplying.value = false
	        renewingId.value = null
	      }
	    }
  })
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
    const isValid = await verifyRemotePassword(verifyPassword.value)
    
    if (isValid) {
      // 密码验证通过，执行删除
      const result = await window.electron.ipcRenderer.invoke('cert:delete', pendingDeleteItem.value.id)
      if (result?.success) {
        message.success('验证通过，证书已删除')
        verifyModalVisible.value = false
        await loadCerts()
      } else {
        message.error(result?.error || '删除操作失败')
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
  copyText(url, '链接已复制')
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 72px;
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

.deploy-state-tag {
  border: none;
  border-radius: 6px;
  font-size: 12px;
  padding: 2px 8px;
}

.deploy-state-tag.success {
  background: #f0fff4;
  color: #2f855a;
}

.deploy-state-tag.error {
  background: #fff5f5;
  color: #c53030;
}

.deploy-state-tag.pending {
  background: #fffaf0;
  color: #c05621;
}

.modern-tag:hover {
  transform: scale(1.05);
}

/* 状态角标（贴域名右上角） */
.domain-status-badge {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 500;
  white-space: nowrap;
}

.domain-status-badge.valid { color: #2f855a; background: #f0fff4; border: 1px solid #c6f6d5; }
.domain-status-badge.expiring { color: #c05621; background: #fffaf0; border: 1px solid #feebc8; }
.domain-status-badge.expired { color: #c53030; background: #fff5f5; border: 1px solid #fed7d7; }

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
  flex-wrap: wrap;
  gap: 2px 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 6px;
  padding: 2px 6px !important;
  font-size: 13px;
  white-space: nowrap;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.action-btn.primary { color: #3182ce; }
.action-btn.success { color: #38a169; }
.action-btn.warning { color: #d69e2e; }
.action-btn.error { color: #e53e3e; }

.action-btn.primary:hover { background: #ebf8ff; }
.action-btn.muted { color: #8ca0bf; }
.action-btn.muted:hover { background: #f5f8fc; color: #5f7391; }
.action-btn.success:hover { background: #f0fff4; }
.action-btn.warning:hover { background: #fffaf0; }
.action-btn.error:hover { background: #fff5f5; }
.action-btn.disabled,
.action-btn.disabled:hover {
  color: #c4ccda !important;
  background: transparent !important;
  cursor: not-allowed;
}

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

.deploy-log-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deploy-log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.deploy-log-summary {
  color: #64748b;
  font-size: 12px;
}

.deploy-log-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.deploy-log-filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.deploy-log-loading,
.deploy-log-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  color: #64748b;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

.deploy-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 420px;
  overflow-y: auto;
}

.deploy-log-item {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 14px 16px;
}

.deploy-log-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deploy-log-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.deploy-log-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.deploy-log-server {
  color: #1e293b;
  font-weight: 600;
}

.deploy-log-time {
  color: #94a3b8;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
}

.deploy-log-summary-text {
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
}

.deploy-log-field {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.deploy-log-field-value {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.deploy-log-field.error .deploy-log-code {
  background: #fff1f2;
  color: #be123c;
  border-color: #fecdd3;
}

.deploy-log-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.deploy-log-code {
  display: block;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  font-family: 'Fira Code', 'Menlo', monospace;
  flex: 1;
}

.deploy-log-copy-btn {
  color: #2563eb;
  border-radius: 8px;
  background: #eff6ff;
  flex-shrink: 0;
}

.deploy-log-copy-btn:hover {
  background: #dbeafe;
}

.deploy-log-message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  font-family: 'Fira Code', 'Menlo', monospace;
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
