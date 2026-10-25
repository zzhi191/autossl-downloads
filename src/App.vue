<template>
  <router-view v-if="appReady" />
  <div v-else class="app-bootstrap">
    <div class="bootstrap-card">
      <div class="bootstrap-title">AutoSSL 正在启动</div>
      <div class="bootstrap-subtitle">正在恢复登录状态并校验授权信息...</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const appReady = ref(false)

const hasElectronApi = () => Boolean(window.electron?.ipcRenderer)

const clearStoredSession = () => {
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('user')
  localStorage.removeItem('token')
}

const isLocalAdminSession = (user) => {
  return user?.id === 'admin' || user?.email === 'admin' || user?.mode === 'local'
}

const setUserSession = async (user) => {
  await window.electron.ipcRenderer.invoke('user:set-session', user)
  localStorage.setItem('isLoggedIn', 'true')
  localStorage.setItem('user', JSON.stringify(user))
}

const restoreSession = async () => {
  if (!hasElectronApi()) return

  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  const userStr = localStorage.getItem('user')

  if (isLoggedIn && userStr) {
    try {
      const user = JSON.parse(userStr)
      if (isLocalAdminSession(user)) {
        clearStoredSession()
        await window.electron.ipcRenderer.invoke('user:set-session', null)
        return
      }
      await setUserSession(user)
      return
    } catch (e) {
      console.error('Recover session error:', e)
    }
  }
}

onMounted(async () => {
  try {
    await restoreSession()
    if (hasElectronApi()) {
      await window.electron.ipcRenderer.invoke('license:init')
    }
  } catch (e) {
    console.error('App bootstrap error:', e)
  } finally {
    appReady.value = true
  }
})
</script>

<style scoped>
.app-bootstrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f7fafc 0%, #edf2f7 100%);
}

.bootstrap-card {
  padding: 24px 32px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
  text-align: center;
}

.bootstrap-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.bootstrap-subtitle {
  margin-top: 8px;
  font-size: 14px;
  color: #64748b;
}
</style>
