import {
  getHordeUser,
  getHordeWorkers,
  updateHordeWorker,
  getHordeSharedKeys,
  createHordeSharedKey,
  updateHordeSharedKey,
  deleteHordeSharedKey
} from './horde.js'

const SETTINGS_KEY = 'demoSettings'

const DEFAULT_SETTINGS = {
  horde_api_key: '',
  last_used_settings: null,
  favorite_loras: '[]',
  recent_loras: '[]',
  favorite_tis: '[]',
  recent_tis: '[]',
  favorite_styles: '[]',
  hidden_pin_enabled: null,  // null = not configured, 0 = declined, 1 = enabled
  hidden_pin_hash: null,
  hidden_pin_declined: false,
  welcome_modal_dismissed: false
}

function getSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const settingsApi = {
  get() {
    const settings = getSettings()
    return Promise.resolve({
      ...settings,
      hasApiKey: !!settings.horde_api_key,
      hasPinProtection: settings.hidden_pin_enabled === 1
    })
  },

  update(data) {
    const settings = getSettings()

    // Handle key name conversions (component uses camelCase, we store snake_case)
    const normalizedData = { ...data }
    if (normalizedData.apiKey !== undefined) {
      normalizedData.horde_api_key = normalizedData.apiKey
      delete normalizedData.apiKey
    }
    if (normalizedData.favoriteStyles !== undefined) {
      normalizedData.favorite_styles = JSON.stringify(normalizedData.favoriteStyles)
      delete normalizedData.favoriteStyles
    }
    if (normalizedData.favoriteLoras !== undefined) {
      normalizedData.favorite_loras = JSON.stringify(normalizedData.favoriteLoras)
      delete normalizedData.favoriteLoras
    }
    if (normalizedData.recentLoras !== undefined) {
      normalizedData.recent_loras = JSON.stringify(normalizedData.recentLoras)
      delete normalizedData.recentLoras
    }
    if (normalizedData.favoriteTis !== undefined) {
      normalizedData.favorite_tis = JSON.stringify(normalizedData.favoriteTis)
      delete normalizedData.favoriteTis
    }
    if (normalizedData.recentTis !== undefined) {
      normalizedData.recent_tis = JSON.stringify(normalizedData.recentTis)
      delete normalizedData.recentTis
    }

    const updated = { ...settings, ...normalizedData }
    saveSettings(updated)
    return Promise.resolve({
      ...updated,
      hasApiKey: !!updated.horde_api_key,
      hasPinProtection: updated.hidden_pin_enabled === 1
    })
  },

  getHordeUser() {
    return getHordeUser()
  },

  getHordeWorkers() {
    return getHordeWorkers()
  },

  updateHordeWorker(workerId, data) {
    return updateHordeWorker(workerId, data)
  },

  getHordeSharedKeys() {
    return getHordeSharedKeys()
  },

  createHordeSharedKey(data) {
    return createHordeSharedKey(data)
  },

  updateHordeSharedKey(keyId, data) {
    return updateHordeSharedKey(keyId, data)
  },

  deleteHordeSharedKey(keyId) {
    return deleteHordeSharedKey(keyId)
  },

  async setupHiddenPin(pin, declined = false) {
    const settings = getSettings()

    if (declined) {
      settings.hidden_pin_declined = true
      saveSettings(settings)
      return { success: true, declined: true }
    }

    if (pin) {
      const hash = await hashPin(pin)
      settings.hidden_pin_hash = hash
      settings.hidden_pin_enabled = 1
      settings.hidden_pin_declined = false
      saveSettings(settings)
      return { success: true, hasPinProtection: true }
    }

    return { success: false }
  },

  async verifyHiddenPin(pin) {
    const settings = getSettings()
    if (!settings.hidden_pin_hash) {
      return { valid: false }
    }

    const hash = await hashPin(pin)
    const valid = hash === settings.hidden_pin_hash
    return { valid }
  },

  async changeHiddenPin(currentPin, newPin) {
    const settings = getSettings()

    if (!settings.hidden_pin_hash) {
      throw new Error('No PIN is currently set')
    }

    const currentHash = await hashPin(currentPin)
    if (currentHash !== settings.hidden_pin_hash) {
      throw new Error('Current PIN is incorrect')
    }

    const newHash = await hashPin(newPin)
    settings.hidden_pin_hash = newHash
    saveSettings(settings)

    return { success: true }
  },

  async removeHiddenPin(pin) {
    const settings = getSettings()

    if (!settings.hidden_pin_hash) {
      throw new Error('No PIN is currently set')
    }

    const hash = await hashPin(pin)
    if (hash !== settings.hidden_pin_hash) {
      throw new Error('PIN is incorrect')
    }

    settings.hidden_pin_hash = null
    settings.hidden_pin_enabled = 0
    saveSettings(settings)

    return { success: true, hasPinProtection: false }
  }
}
