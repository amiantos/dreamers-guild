import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import LibraryView from './views/LibraryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: LibraryView
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: LibraryView
    },
    {
      path: '/hidden',
      name: 'hidden',
      component: LibraryView
    },
    {
      path: '/image/:imageId',
      name: 'library-image',
      component: LibraryView,
      props: true
    }
  ]
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
