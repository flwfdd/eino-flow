import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'flow',
      component:  () => import('../views/Flow.vue'),
    },
  ],
})

export default router
