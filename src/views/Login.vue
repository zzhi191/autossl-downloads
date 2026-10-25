<template>
  <div class="login-container">
    <!-- 背景动画装饰 -->
    <div class="background-decor">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
      <div class="glass-overlay"></div>
    </div>

    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <div class="logo-area">
            <div class="logo-shield">
              <SafetyCertificateFilled />
            </div>
            <div class="brand-info">
              <h1 class="brand-title">
                <span class="auto">Auto</span><span class="ssl">SSL</span>
              </h1>
              <p class="brand-tagline">下一代数字证书全自动管理平台</p>
            </div>
          </div>
        </div>

        <a-tabs v-model:activeKey="activeTab" class="premium-tabs" centered>
          <a-tab-pane key="login" tab="账号登录">
            <a-form
              :model="loginForm"
              :rules="loginRules"
              @finish="handleLogin"
              class="premium-form"
              layout="vertical"
            >
              <a-form-item name="username">
                <div class="form-label">登录邮箱</div>
                <a-input
                  v-model:value="loginForm.username"
                  placeholder="请输入您的注册邮箱"
                  size="large"
                  class="glass-input"
                >
                  <template #prefix
                    ><UserOutlined class="input-icon"
                  /></template>
                </a-input>
              </a-form-item>

              <a-form-item name="password">
                <div class="password-label-row">
                  <div class="form-label">访问密码</div>
                  <a-button
                    type="link"
                    class="forgot-link"
                    @click="openForgotPassword"
                  >
                    忘记密码
                  </a-button>
                </div>
                <a-input-password
                  v-model:value="loginForm.password"
                  placeholder="请输入您的密码"
                  size="large"
                  class="glass-input"
                >
                  <template #prefix
                    ><LockOutlined class="input-icon"
                  /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item class="submit-area">
                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  block
                  :loading="loading"
                  class="glass-btn primary shadow-grow"
                >
                  进入管理看板
                </a-button>
              </a-form-item>
            </a-form>
          </a-tab-pane>

          <a-tab-pane key="register" tab="申请开通">
            <a-form
              :model="registerForm"
              :rules="registerRules"
              @finish="handleRegister"
              class="premium-form"
              layout="vertical"
            >
              <a-form-item name="email">
                <div class="form-label">电子邮箱</div>
                <a-input
                  v-model:value="registerForm.email"
                  placeholder="接收授权信息的邮箱"
                  size="large"
                  class="glass-input"
                >
                  <template #prefix
                    ><MailOutlined class="input-icon"
                  /></template>
                </a-input>
              </a-form-item>

              <a-form-item name="code">
                <div class="form-label">安全验证码</div>
                <a-input
                  v-model:value="registerForm.code"
                  placeholder="6 位数字验证码"
                  size="large"
                  class="glass-input"
                >
                  <template #prefix
                    ><SafetyOutlined class="input-icon"
                  /></template>
                  <template #suffix>
                    <a-button
                      type="link"
                      :disabled="countdown > 0"
                      @click.stop="sendCode"
                      class="code-btn"
                    >
                      {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
                    </a-button>
                  </template>
                </a-input>
              </a-form-item>

              <a-form-item name="password">
                <div class="form-label">设置密码</div>
                <a-input-password
                  v-model:value="registerForm.password"
                  placeholder="至少 6 位安全字符"
                  size="large"
                  class="glass-input"
                >
                  <template #prefix
                    ><LockOutlined class="input-icon"
                  /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item class="submit-area">
                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  block
                  :loading="loading"
                  class="glass-btn secondary shadow-grow"
                >
                  立即申请账号
                </a-button>
              </a-form-item>
            </a-form>
          </a-tab-pane>
        </a-tabs>

        <div class="login-footer">
          <p class="copyright">
            © {{ new Date().getFullYear() }} fogomo Technology. All SSL assets
            secured.
          </p>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="forgotModalVisible"
      title="重置密码"
      :footer="null"
      :width="420"
      centered
      destroy-on-close
      class="forgot-modal"
    >
      <a-form
        :model="forgotForm"
        :rules="forgotRules"
        @finish="handleResetPassword"
        layout="vertical"
        class="forgot-form"
      >
        <a-form-item name="email">
          <div class="modal-form-label">注册邮箱</div>
          <a-input
            v-model:value="forgotForm.email"
            placeholder="请输入您的注册邮箱"
            size="large"
          >
            <template #prefix><MailOutlined class="input-icon" /></template>
          </a-input>
        </a-form-item>

        <a-form-item name="code">
          <div class="modal-form-label">验证码</div>
          <a-input
            v-model:value="forgotForm.code"
            placeholder="6 位数字验证码"
            size="large"
          >
            <template #prefix><SafetyOutlined class="input-icon" /></template>
            <template #suffix>
              <a-button
                type="link"
                :disabled="resetCountdown > 0"
                @click.stop="sendResetCode"
                class="reset-code-btn"
              >
                {{ resetCountdown > 0 ? `${resetCountdown}s` : "获取验证码" }}
              </a-button>
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="password">
          <div class="modal-form-label">新密码</div>
          <a-input-password
            v-model:value="forgotForm.password"
            placeholder="至少 6 位安全字符"
            size="large"
          >
            <template #prefix><LockOutlined class="input-icon" /></template>
          </a-input-password>
        </a-form-item>

        <a-button
          type="primary"
          html-type="submit"
          size="large"
          block
          :loading="resetLoading"
        >
          重置密码
        </a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, nextTick, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateFilled,
  MailOutlined,
  SafetyOutlined,
} from "@ant-design/icons-vue";
import axios from "axios";

const router = useRouter();
const loading = ref(false);
const resetLoading = ref(false);
const activeTab = ref("login");
const countdown = ref(0);
const resetCountdown = ref(0);
const forgotModalVisible = ref(false);
let timer = null;
let resetTimer = null;

const loginForm = ref({
  username: "",
  password: "",
});

const registerForm = ref({
  email: "",
  code: "",
  password: "",
});

const forgotForm = ref({
  email: "",
  code: "",
  password: "",
});

const loginRules = {
  username: [
    { required: true, message: "请输入邮箱" },
    { type: "email", message: "请输入正确的邮箱格式" },
  ],
  password: [{ required: true, message: "请输入密码" }],
};

const registerRules = {
  email: [{ required: true, type: "email", message: "请输入有效的邮箱地址" }],
  code: [{ required: true, message: "请输入验证码" }],
  password: [{ required: true, min: 6, message: "密码至少 6 位" }],
};

const forgotRules = {
  email: [{ required: true, type: "email", message: "请输入有效的邮箱地址" }],
  code: [{ required: true, message: "请输入验证码" }],
  password: [{ required: true, min: 6, message: "密码至少 6 位" }],
};

const API_BASE = "https://tools.fogomo.com/api";
const APP_CODE = "certd-electron";

const clearStoredSession = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("token");
};

const getAuthPayload = (response) =>
  response?.data?.data || response?.data || {};

const guideUnregisteredAccount = async () => {
  try {
    const checkRes = await axios.post(`${API_BASE}/auth/check-email`, {
      email: loginForm.value.username,
      appCode: APP_CODE,
    });

    if (checkRes.data?.data?.registered === false) {
      registerForm.value.email = loginForm.value.username;
      registerForm.value.password = "";
      message.warning("账号未注册，请先申请开通");
      activeTab.value = "register";
      return true;
    }
  } catch (e) {
    // 保持原登录错误提示，避免检查接口异常掩盖真实登录失败。
  }

  return false;
};

const sendCode = async () => {
  if (!registerForm.value.email) return message.warning("请先输入邮箱");
  try {
    await axios.post(`${API_BASE}/auth/send-code`, {
      email: registerForm.value.email,
      appCode: APP_CODE,
    });
    message.success("验证码已发送至您的邮箱，请注意查收");
    startCountdown();
  } catch (e) {
    message.error(e.response?.data?.message || "验证码发送失败，请重试");
  }
};

const openForgotPassword = () => {
  forgotForm.value.email = loginForm.value.username;
  forgotForm.value.code = "";
  forgotForm.value.password = "";
  forgotModalVisible.value = true;
};

const sendResetCode = async () => {
  if (!forgotForm.value.email) return message.warning("请先输入邮箱");
  try {
    await axios.post(`${API_BASE}/auth/send-reset-code`, {
      email: forgotForm.value.email,
      appCode: APP_CODE,
    });
    message.success("验证码已发送至您的邮箱，请注意查收");
    startResetCountdown();
  } catch (e) {
    message.error(e.response?.data?.message || "验证码发送失败，请重试");
  }
};

const startCountdown = () => {
  countdown.value = 60;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) clearInterval(timer);
  }, 1000);
};

const startResetCountdown = () => {
  resetCountdown.value = 60;
  resetTimer = setInterval(() => {
    resetCountdown.value--;
    if (resetCountdown.value <= 0) clearInterval(resetTimer);
  }, 1000);
};

const handleRegister = async () => {
  loading.value = true;
  try {
    let machineId = "";
    if (window.electron?.ipcRenderer) {
      const info = await window.electron.ipcRenderer.invoke(
        "license:get-machine-id",
      );
      if (info) machineId = info;
    }

    await axios.post(`${API_BASE}/auth/register`, {
      ...registerForm.value,
      machineId,
      appCode: APP_CODE,
    });
    message.success("开通申请已通过，请登录您的账号");
    activeTab.value = "login";
    loginForm.value.username = registerForm.value.email;
    loginForm.value.password = "";
  } catch (error) {
    message.error(error.response?.data?.message || "注册申请失败");
  } finally {
    loading.value = false;
  }
};

const handleResetPassword = async () => {
  resetLoading.value = true;
  try {
    await axios.post(`${API_BASE}/auth/reset-password`, {
      ...forgotForm.value,
      appCode: APP_CODE,
    });
    message.success("密码已重置，请使用新密码登录");
    loginForm.value.username = forgotForm.value.email;
    loginForm.value.password = "";
    forgotModalVisible.value = false;
  } catch (error) {
    message.error(error.response?.data?.message || "密码重置失败");
  } finally {
    resetLoading.value = false;
  }
};

const handleLogin = async () => {
  // 强制检查是否为邮箱格式（双重保险）
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(loginForm.value.username)) {
    return message.error("请使用注册邮箱登录");
  }

  clearStoredSession();
  loading.value = true;
  try {
    let remoteUser = null;
    let token = null;

    try {
      const remoteRes = await axios.post(`${API_BASE}/auth/login`, {
        email: loginForm.value.username,
        pass: loginForm.value.password,
        appCode: APP_CODE,
      });
      const authPayload = getAuthPayload(remoteRes);
      if (authPayload.access_token) {
        remoteUser = authPayload.user;
        token = authPayload.access_token;
      }
    } catch (e) {
      if (await guideUnregisteredAccount()) return;
    }

    if (remoteUser) {
      await window.electron.ipcRenderer.invoke("user:set-session", remoteUser);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(remoteUser));
      window.dispatchEvent(new Event("cloud-auth-changed"));
      message.success("登录成功，欢迎回来");
      await nextTick();
      router.replace("/dashboard");
      return;
    }

    throw new Error("账户名或密码错误");
  } catch (error) {
    message.error(
      "凭据验证失败：" +
        (error.response?.data?.message || error.message || "服务暂时不可用"),
    );
  } finally {
    loading.value = false;
  }
};

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (resetTimer) clearInterval(resetTimer);
});
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0f172a;
  position: relative;
  overflow: hidden;
  font-family:
    "Inter",
    -apple-system,
    sans-serif;
}

/* 动态背景装饰 */
.background-decor {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.blob {
  position: absolute;
  width: 500px;
  height: 500px;
  background: linear-gradient(
    135deg,
    rgba(24, 144, 255, 0.2) 0%,
    rgba(198, 255, 0, 0.1) 100%
  );
  filter: blur(80px);
  border-radius: 50%;
  animation: float 20s infinite alternate;
}

.blob-1 {
  top: -100px;
  left: -100px;
}
.blob-2 {
  bottom: -100px;
  right: -100px;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.2) 0%,
    rgba(168, 85, 247, 0.1) 100%
  );
}
.blob-3 {
  top: 40%;
  left: 30%;
  width: 300px;
  height: 300px;
  background: rgba(24, 144, 255, 0.15);
  animation-duration: 15s;
}

@keyframes float {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(100px, 50px) scale(1.1);
  }
}

.glass-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 50%,
    transparent 0%,
    rgba(15, 23, 42, 0.4) 100%
  );
  backdrop-filter: contrast(120%) brightness(80%);
}

.login-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  padding: 20px;
}

.login-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 48px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo-shield {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #1890ff 0%, #00d2ff 100%);
  border-radius: 22px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: white;
  box-shadow:
    0 10px 25px rgba(24, 144, 255, 0.4),
    inset 0 0 15px rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
}

.logo-shield::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transform: rotate(45deg);
  animation: shine 3s infinite;
}

@keyframes shine {
  0% {
    left: -150%;
  }
  100% {
    left: 150%;
  }
}

.brand-title {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -1.5px;
  margin: 0;
  line-height: 1;
  font-family: "Outfit", "Inter", sans-serif;
}

.brand-title .auto {
  color: #ffffff;
}

.brand-title .ssl {
  background: linear-gradient(135deg, #1890ff 0%, #c6ff00 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-left: 2px;
}

.brand-tagline {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0;
  font-weight: 500;
}

/* 选项卡美化 */
:deep(.premium-tabs.ant-tabs) {
  border: none;
}
:deep(.premium-tabs .ant-tabs-nav::before) {
  border: none;
}
:deep(.premium-tabs .ant-tabs-tab) {
  color: rgba(255, 255, 255, 0.5) !important;
  font-size: 16px;
  font-weight: 600;
  padding: 12px 24px;
}
:deep(.premium-tabs .ant-tabs-tab-active) {
  color: white !important;
}
:deep(.premium-tabs .ant-tabs-ink-bar) {
  background: #1890ff;
  height: 3px;
  border-radius: 3px;
}

/* 表单美化 */
.premium-form {
  margin-top: 32px;
}

.form-label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.password-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.password-label-row .form-label {
  margin-bottom: 0;
}

.forgot-link {
  height: auto;
  padding: 0;
  color: #c6ff00 !important;
  font-size: 12px;
  font-weight: 700;
}

.glass-input {
  background: rgba(0, 0, 0, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  color: white !important;
  padding: 10px 16px !important;
  transition: all 0.3s;
}

.glass-input:hover,
.glass-input-focused {
  border-color: rgba(24, 144, 255, 0.5) !important;
  background: rgba(0, 0, 0, 0.3) !important;
}

:deep(.glass-input .ant-input) {
  background: transparent !important;
  color: white !important;
}

:deep(.glass-input .ant-input::placeholder) {
  color: rgba(255, 255, 255, 0.2);
}

.input-icon {
  color: #1890ff;
  margin-right: 8px;
}

.code-btn {
  font-weight: 600;
  color: #c6ff00 !important;
}

.code-btn:disabled,
.reset-code-btn:disabled {
  color: rgba(198, 255, 0, 0.3) !important;
}

.reset-code-btn {
  font-weight: 600;
}

.forgot-form {
  padding-top: 8px;
}

.modal-form-label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.72);
  margin-bottom: 8px;
}

/* 按钮美化 */
.glass-btn {
  height: 54px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 800;
  border: none;
  transition: all 0.3s;
}

.glass-btn.primary {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: white;
}

.glass-btn.secondary {
  background: linear-gradient(135deg, #c6ff00 0%, #10b981 100%);
  color: #0f172a;
}

.shadow-grow:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(24, 144, 255, 0.4);
}

.secondary.shadow-grow:hover {
  box-shadow: 0 10px 25px -5px rgba(198, 255, 0, 0.3);
}

.login-footer {
  margin-top: 40px;
  text-align: center;
}

.copyright {
  color: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 适配不同屏幕 */
@media (max-height: 700px) {
  .login-card {
    padding: 32px;
  }
  .login-header {
    margin-bottom: 24px;
  }
  .logo-shield {
    width: 56px;
    height: 56px;
    font-size: 28px;
    margin-bottom: 16px;
  }
  .brand-title {
    font-size: 30px;
  }
}

@media (max-width: 520px) {
  .login-card {
    padding: 32px 24px;
  }
}
</style>
