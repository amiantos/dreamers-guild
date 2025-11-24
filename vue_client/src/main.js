import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import LibraryView from './views/LibraryView.vue'
import SettingsView from './views/SettingsView.vue'
import WorkersView from './views/WorkersView.vue'
import './assets/colors.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: LibraryView
    },
    {
      path: '/image/:imageId',
      name: 'library-image',
      component: LibraryView,
      props: true
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView
    },
    {
      path: '/settings/workers',
      name: 'workers',
      component: WorkersView
    }
  ]
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
