import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/projects' },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/views/auth/SignInView.vue'),
    meta: { public: true },
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: () => import('@/views/auth/SignUpView.vue'),
    meta: { public: true },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/auth/VerifyEmailView.vue'),
    meta: { public: true },
  },
  {
    path: '/resend-verification',
    name: 'resend-verification',
    component: () => import('@/views/auth/ResendVerificationView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    children: [
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/views/projects/ProjectListView.vue'),
      },
      {
        path: 'projects/:projectId',
        name: 'project-detail',
        component: () => import('@/views/projects/ProjectDetailView.vue'),
      },
      {
        path: 'projects/:projectId/task-items',
        name: 'task-list',
        component: () => import('@/views/tasks/TaskListView.vue'),
      },
      {
        path: 'projects/:projectId/task-items/:taskId',
        name: 'task-detail',
        component: () => import('@/views/tasks/TaskDetailView.vue'),
      },
      {
        path: 'admin/projects/new',
        name: 'project-new',
        component: () => import('@/views/projects/ProjectFormView.vue'),
        meta: { requiredFunction: 'projects.create' },
      },
      {
        path: 'admin/projects/:projectId/edit',
        name: 'project-edit',
        component: () => import('@/views/projects/ProjectFormView.vue'),
      },
      {
        path: 'admin/projects/:projectId/task-items/new',
        name: 'task-new',
        component: () => import('@/views/tasks/TaskFormView.vue'),
        meta: { requiredFunction: 'tasks.create' },
      },
      {
        path: 'admin/projects/:projectId/task-items/:taskId/edit',
        name: 'task-edit',
        component: () => import('@/views/tasks/TaskFormView.vue'),
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/UserListView.vue'),
        meta: { requiredFunction: 'accounts.read' },
      },
      {
        path: 'users/:userId',
        name: 'user-detail',
        component: () => import('@/views/users/UserDetailView.vue'),
        meta: { requiredFunction: 'accounts.read' },
      },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) await auth.restore()
  if (!to.meta.public && !auth.isAuthenticated)
    return { name: 'sign-in', query: { redirect: to.fullPath } }
  if (to.meta.public && auth.isAuthenticated && ['sign-in', 'sign-up'].includes(String(to.name)))
    return { name: 'projects' }
  if (to.meta.requiredFunction && !auth.hasFunction(String(to.meta.requiredFunction))) {
    return { name: 'forbidden' }
  }
  return true
})
