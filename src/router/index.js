import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false, title: '登录' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true, title: '仪表盘' }
  },
  {
    path: '/servers',
    name: 'Servers',
    component: () => import('@/views/Servers.vue'),
    meta: { requiresAuth: true, title: '服务器管理' }
  },
  {
    path: '/certificates',
    name: 'Certificates',
    component: () => import('@/views/Certificates.vue'),
    meta: { requiresAuth: true, title: '证书管理' }
  },
  {
    path: '/auto-renew',
    name: 'AutoRenew',
    component: () => import('@/views/AutoRenew.vue'),
    meta: { requiresAuth: true, title: '自动续期' }
  },
  {
    path: '/license',
    name: 'License',
    component: () => import('@/views/License.vue'),
    meta: { requiresAuth: true, title: '软件授权' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  
  // 如果已登录且访问登录页，重定向到 dashboard
  if (to.path === '/' && isLoggedIn) {
    next('/dashboard')
    return
  }
  
  // 如果需要认证但未登录，重定向到登录页
  if (to.meta.requiresAuth && !isLoggedIn) {
    next('/')
    return
  }
  
  next()
})

export default router
