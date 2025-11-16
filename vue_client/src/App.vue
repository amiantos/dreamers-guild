<template>
  <div class="app">
    <nav class="navbar">
      <div class="nav-content">
        <h1 class="logo">Aislingeach</h1>
        <div class="nav-links">
          <router-link to="/" class="nav-link">Requests</router-link>
          <router-link to="/library" class="nav-link">Library</router-link>
        </div>
        <div class="nav-actions">
          <button @click="showSettingsModal = true" class="btn-settings" title="Settings">
            ⚙
          </button>
          <button @click="showRequestModal = true" class="btn-new-request">
            <span>+</span> New Request
          </button>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <router-view />
    </main>

    <RequestGeneratorModal
      v-if="showRequestModal"
      @close="showRequestModal = false"
      @submit="handleNewRequest"
    />

    <SettingsModal
      v-if="showSettingsModal"
      @close="showSettingsModal = false"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import RequestGeneratorModal from './components/RequestGeneratorModal.vue'
import SettingsModal from './components/SettingsModal.vue'

export default {
  name: 'App',
  components: {
    RequestGeneratorModal,
    SettingsModal
  },
  setup() {
    const showRequestModal = ref(false)
    const showSettingsModal = ref(false)

    const handleNewRequest = () => {
      showRequestModal.value = false
      // Optionally navigate to requests view
      window.location.href = '/'
    }

    return {
      showRequestModal,
      showSettingsModal,
      handleNewRequest
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: #1a1a1a;
  border-bottom: 1px solid #333;
  padding: 0 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 2rem;
  height: 60px;
}

.logo {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.nav-links {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.nav-link {
  color: #999;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #fff;
  background: #2a2a2a;
}

.nav-link.router-link-active {
  color: #fff;
  background: #2a2a2a;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-settings {
  background: transparent;
  color: #999;
  border: 1px solid #333;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-settings:hover {
  color: #fff;
  background: #2a2a2a;
  border-color: #444;
}

.btn-new-request {
  background: #007AFF;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s;
}

.btn-new-request:hover {
  background: #0051D5;
}

.btn-new-request span {
  font-size: 1.3rem;
  font-weight: 300;
}

.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}
</style>
