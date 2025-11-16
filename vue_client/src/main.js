import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import RequestsView from './views/RequestsView.vue'
import LibraryView from './views/LibraryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'requests',
      component: RequestsView
    },
    {
      path: '/library',
      name: 'library',
      component: LibraryView
    },
    {
      path: '/library/request/:id',
      name: 'library-request',
      component: LibraryView,
      props: true
    },
    {
      path: '/library/search',
      name: 'library-search',
      component: LibraryView,
      props: route => ({ keywords: route.query.q })
    },
    {
      path: '/library/image/:imageId',
      name: 'library-image',
      component: LibraryView,
      props: true
    }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')
