<template>
  <div class="main-layout">
    <a-layout class="layout-container">
      <a-layout-header class="header">
        <div class="header-content">
          <div class="header-left">
            <div class="logo">
              <SafetyCertificateOutlined class="logo-icon" />
              <div class="logo-text-group">
                <h1 class="brand-title"><span class="brand-auto">auto</span><span class="brand-ssl">SSL</span></h1>
                <p class="brand-subtitle">
                  <span>证</span><span>书</span><span>管</span><span>理</span><span>客</span><span>户</span><span>端</span>
                </p>
              </div>
            </div>
          </div>
          <div class="header-right">
            <LicenseStatus />
            <div class="user-info" v-if="currentUser">
              <span class="user-email">{{ currentUser.email }}</span>
              <div class="header-divider"></div>
            </div>
            <a-button type="text" @click="handleLogout" class="logout-btn">
              <template #icon>
                <LogoutOutlined />
              </template>
              退出登录
            </a-button>
          </div>
        </div>
      </a-layout-header>
      
      <a-layout>
        <a-layout-sider width="200" theme="light" class="sider">
          <a-menu
            v-model:selectedKeys="selectedKeys"
            mode="inline"
            @click="handleMenuClick"
            :style="{ height: '100%', borderRight: 0 }"
          >
            <a-menu-item key="dashboard">
              <template #icon>
                <DashboardOutlined />
              </template>
              <span>仪表盘</span>
            </a-menu-item>
            <a-menu-item key="servers">
              <template #icon>
                <DatabaseOutlined />
              </template>
              <span>服务器管理</span>
            </a-menu-item>
            <a-menu-item key="certificates">
              <template #icon>
                <SafetyCertificateOutlined />
              </template>
              <span>证书管理</span>
            </a-menu-item>
            <a-menu-item key="auto-renew">
              <template #icon>
                <SyncOutlined />
              </template>
              <span>自动续期</span>
            </a-menu-item>
            <a-menu-item key="license">
              <template #icon>
                <CrownOutlined />
              </template>
              <span>软件授权</span>
            </a-menu-item>
          </a-menu>
        </a-layout-sider>
        
        <a-layout-content class="content">
          <div class="page-body">
            <slot />
          </div>
          <div class="layout-footer">
            <div class="footer-divider"></div>
            <p class="footer-text">
              <span>天津富贵猫科技有限公司</span>
              <span class="footer-dot">•</span>
              <span class="footer-url">fogomo.com</span>
            </p>
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import LicenseStatus from './LicenseStatus.vue'
import {
  DashboardOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  LogoutOutlined,
  CrownOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const selectedKeys = ref(['dashboard'])
const currentUser = ref(null)

// 从 localStorage 获取当前用户信息
const loadUserInfo = () => {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      currentUser.value = JSON.parse(userStr)
    } catch (e) {
      console.error('Failed to parse user info', e)
    }
  } else if (localStorage.getItem('isLoggedIn') === 'true') {
    // 可能是管理员登录
    currentUser.value = { email: 'admin' }
  }
}

// 根据当前路由设置选中的菜单项
const updateSelectedKeys = () => {
  const path = route.path
  if (path === '/dashboard') {
    selectedKeys.value = ['dashboard']
  } else if (path === '/servers') {
    selectedKeys.value = ['servers']
  } else if (path === '/certificates') {
    selectedKeys.value = ['certificates']
  } else if (path === '/auto-renew') {
    selectedKeys.value = ['auto-renew']
  } else if (path === '/license') {
    selectedKeys.value = ['license']
  }
}

onMounted(() => {
  updateSelectedKeys()
  loadUserInfo()
})

watch(() => route.path, () => {
  updateSelectedKeys()
})

const handleMenuClick = ({ key }) => {
  if (key === 'dashboard') {
    router.push('/dashboard')
  } else if (key === 'servers') {
    router.push('/servers')
  } else if (key === 'certificates') {
    router.push('/certificates')
  } else if (key === 'auto-renew') {
    router.push('/auto-renew')
  } else if (key === 'license') {
    router.push('/license')
  }
}

const handleLogout = async () => {
  await window.electron.ipcRenderer.invoke('user:set-session', null)
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  message.success('已退出登录')
  router.push('/')
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

.layout-container {
  height: 100%;
}

.header {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  padding: 0 24px;
  height: 64px;
  line-height: 64px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
  color: white;
}

.logo-text-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.2;
}

.brand-title {
  color: white;
  margin: 0 !important;
  font-size: 26px !important;
  font-weight: 800 !important;
  letter-spacing: -1px !important;
}

.brand-auto {
  color: #fff;
}

.brand-ssl {
  color: #c6ff00;
  margin-left: 2px;
  font-style: normal;
  text-shadow: 0 0 8px rgba(198, 255, 0, 0.2);
}

.logo-text-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  line-height: 1.1;
}

.brand-subtitle {
  margin: 1px 0 0 0;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-email {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
}

.logout-btn {
  color: white !important;
  font-size: 14px;
  transition: all 0.3s;
  padding: 4px 8px;
}

.logout-btn:hover {
  background: rgba(0, 0, 0, 0.1) !important;
  color: white !important;
}

.sider {
  overflow: auto;
  height: calc(100vh - 64px);
  position: fixed;
  left: 0;
  top: 64px;
  bottom: 0;
  z-index: 100;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  background: #fff;
}

.sider :deep(.ant-menu) {
  border-right: none;
  padding: 16px 0;
}

.sider :deep(.ant-menu-item) {
  margin: 4px 12px;
  border-radius: 6px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s;
}

.sider :deep(.ant-menu-item:hover) {
  background: #e6f7ff;
}

.sider :deep(.ant-menu-item-selected) {
  background: #1890ff !important;
  color: white !important;
}

.sider :deep(.ant-menu-item-selected .anticon) {
  color: white !important;
}

.content {
  margin-left: 200px;
  background: #f0f2f5;
  height: calc(100vh - 64px);
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.page-body {
  flex: 1;
  padding: 24px;
}

.layout-footer {
  padding: 24px;
  text-align: center;
  margin-top: auto;
}

.footer-divider {
  width: 40px;
  height: 2px;
  background: #e2e8f0;
  margin: 0 auto 16px;
  border-radius: 1px;
}

.footer-text {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0.8;
}

.footer-dot {
  font-size: 10px;
  color: #cbd5e0;
}

.footer-url {
  font-family: 'JetBrains Mono', -apple-system, sans-serif;
  letter-spacing: 0.5px;
}
</style>

