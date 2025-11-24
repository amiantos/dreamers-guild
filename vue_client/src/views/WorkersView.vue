<template>
  <div class="workers-view">
    <div class="workers-container">
      <div class="workers-header">
        <h1>Manage Workers</h1>
        <button @click="goBack" class="btn-back">
          <i class="fa-solid fa-arrow-left"></i> Back to Settings
        </button>
      </div>

      <p class="help-text">
        Manage your AI Horde workers. Note: It can take up to 5 minutes before changes are reflected.
      </p>

      <div v-if="loading" class="loading">Loading workers...</div>

      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-else-if="workers.length === 0" class="no-workers">
        <p>No workers found for your account.</p>
      </div>

      <div v-else class="workers-list">
        <div v-for="worker in sortedWorkers" :key="worker.id" class="worker-card">
          <div class="worker-header">
            <div class="worker-title">
              <h3 class="worker-name">{{ worker.name }}</h3>
              <span class="status-badge" :class="{
                'status-online': worker.online && !worker.maintenance_mode,
                'status-paused': worker.maintenance_mode,
                'status-offline': !worker.online
              }">
                {{ worker.maintenance_mode ? 'Paused' : (worker.online ? 'Online' : 'Offline') }}
              </span>
            </div>
            <button
              @click="toggleMaintenanceMode(worker)"
              class="btn-toggle"
              :disabled="updatingWorker === worker.id"
            >
              <i class="fa-solid" :class="worker.maintenance_mode ? 'fa-play' : 'fa-pause'"></i>
              {{ updatingWorker === worker.id ? 'Updating...' : (worker.maintenance_mode ? 'Resume' : 'Pause') }}
            </button>
          </div>

          <div class="worker-id">ID: {{ worker.id }}</div>

          <div class="worker-stats">
            <div class="stat-box">
              <div class="stat-label">Requests Fulfilled</div>
              <div class="stat-value">{{ worker.requests_fulfilled?.toLocaleString() || 0 }}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Uptime</div>
              <div class="stat-value">{{ formatUptime(worker.uptime) }}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Performance</div>
              <div class="stat-value">{{ worker.performance || 'N/A' }}</div>
            </div>
            <div class="stat-box" v-if="worker.kudos_rewards">
              <div class="stat-label">Kudos Earned</div>
              <div class="stat-value">{{ Math.round(worker.kudos_rewards).toLocaleString() }}</div>
            </div>
          </div>

          <div class="worker-info" v-if="worker.info">
            <div class="info-label">Info:</div>
            <div class="info-text">{{ worker.info }}</div>
          </div>

          <div class="worker-details">
            <div class="detail-row">
              <span class="detail-label">Bridge Agent:</span>
              <span class="detail-value">{{ worker.bridge_agent || 'Unknown' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Threads:</span>
              <span class="detail-value">{{ worker.threads }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Max Pixels:</span>
              <span class="detail-value">{{ worker.max_pixels?.toLocaleString() }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Team:</span>
              <span class="detail-value">{{ worker.team?.name || 'None' }}</span>
            </div>
          </div>

          <div class="worker-capabilities">
            <span class="capability-badge" v-if="worker.trusted">Trusted</span>
            <span class="capability-badge" v-if="worker.nsfw">NSFW</span>
            <span class="capability-badge" v-if="worker.img2img">Img2Img</span>
            <span class="capability-badge" v-if="worker.painting">Inpainting</span>
            <span class="capability-badge" v-if="worker['post-processing']">Post-Processing</span>
            <span class="capability-badge" v-if="worker.lora">LoRA</span>
          </div>

          <div class="worker-models" v-if="worker.models && worker.models.length > 0">
            <div class="models-label">Models ({{ worker.models.length }}):</div>
            <div class="models-list">
              <span v-for="model in worker.models.slice(0, 5)" :key="model" class="model-tag">
                {{ model }}
              </span>
              <span v-if="worker.models.length > 5" class="model-tag">
                +{{ worker.models.length - 5 }} more
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { settingsApi } from '../api/client.js'

export default {
  name: 'WorkersView',
  setup() {
    const router = useRouter()
    const workers = ref([])
    const loading = ref(false)
    const error = ref(null)
    const updatingWorker = ref(null)

    const goBack = () => {
      router.push('/settings')
    }

    const loadWorkers = async () => {
      try {
        loading.value = true
        error.value = null
        const response = await settingsApi.getHordeWorkers()
        workers.value = response
      } catch (err) {
        console.error('Error loading workers:', err)
        error.value = 'Failed to load workers. Please check your API key and try again.'
      } finally {
        loading.value = false
      }
    }

    const sortedWorkers = computed(() => {
      return [...workers.value].sort((a, b) => {
        // Online workers first
        if (a.online && !b.online) return -1
        if (!a.online && b.online) return 1
        // Then by requests fulfilled
        return (b.requests_fulfilled || 0) - (a.requests_fulfilled || 0)
      })
    })

    const toggleMaintenanceMode = async (worker) => {
      try {
        updatingWorker.value = worker.id
        const newMaintenanceMode = !worker.maintenance_mode

        await settingsApi.updateHordeWorker(worker.id, {
          maintenance: newMaintenanceMode
        })

        // Update local state
        worker.maintenance_mode = newMaintenanceMode

        alert(`Worker ${newMaintenanceMode ? 'paused' : 'resumed'} successfully!`)
      } catch (err) {
        console.error('Error updating worker:', err)
        alert('Failed to update worker. Please try again.')
      } finally {
        updatingWorker.value = null
      }
    }

    const formatUptime = (seconds) => {
      if (!seconds) return '0h'
      const hours = Math.floor(seconds / 3600)
      const days = Math.floor(hours / 24)
      if (days > 0) {
        return `${days}d ${hours % 24}h`
      }
      return `${hours}h`
    }

    onMounted(() => {
      loadWorkers()
    })

    return {
      workers,
      loading,
      error,
      updatingWorker,
      sortedWorkers,
      goBack,
      toggleMaintenanceMode,
      formatUptime
    }
  }
}
</script>

<style scoped>
.workers-view {
  min-height: 100vh;
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.workers-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.workers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #333;
}

.workers-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}

.btn-back {
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid #333;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-back:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.help-text {
  margin-bottom: 2rem;
  font-size: 0.95rem;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}

.loading {
  padding: 3rem;
  text-align: center;
  color: var(--color-text-tertiary);
}

.error-message {
  padding: 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 6px;
  color: var(--color-danger-ios);
  margin-bottom: 1rem;
}

.no-workers {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-tertiary);
}

.workers-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.worker-card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #333;
}

.worker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.worker-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.worker-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-online {
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
}

.status-paused {
  background: rgba(255, 149, 0, 0.2);
  color: #ff9500;
}

.status-offline {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-tertiary);
}

.btn-toggle {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.btn-toggle:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.worker-id {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-bottom: 1rem;
}

.worker-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-box {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 0.75rem;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.worker-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.info-label {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.info-text {
  font-size: 0.95rem;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.worker-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.detail-label {
  font-size: 0.9rem;
  color: var(--color-text-tertiary);
}

.detail-value {
  font-size: 0.9rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.worker-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.capability-badge {
  padding: 0.375rem 0.75rem;
  background: rgba(88, 114, 151, 0.2);
  color: #587297;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.worker-models {
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.models-label {
  font-size: 0.9rem;
  color: var(--color-text-tertiary);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.model-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-tertiary);
  border-radius: 6px;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .workers-container {
    padding: 1rem;
  }

  .workers-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .workers-header h1 {
    font-size: 1.5rem;
  }

  .worker-card {
    padding: 1rem;
  }

  .worker-header {
    flex-direction: column;
  }

  .worker-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .worker-details {
    grid-template-columns: 1fr;
  }
}
</style>
