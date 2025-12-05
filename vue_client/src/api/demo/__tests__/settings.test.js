/**
 * Tests for the settings API (settings.js)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { settingsApi } from '../settings.js'
import { setupLocalStorage, getLocalStorageData, createMockFetch } from './helpers/mocks.js'
import { sampleSettings, sampleHordeUser } from './helpers/fixtures.js'

describe('Settings API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    global.fetch = createMockFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  describe('settingsApi.get', () => {
    it('should return default settings when none stored', async () => {
      const settings = await settingsApi.get()

      expect(settings.horde_api_key).toBe('')
      expect(settings.favorite_loras).toBe('[]')
      expect(settings.favorite_styles).toBe('[]')
      expect(settings.hasApiKey).toBe(false)
      expect(settings.hasPinProtection).toBe(false)
    })

    it('should return stored settings', async () => {
      setupLocalStorage({
        demoSettings: sampleSettings({
          apiKey: 'test-api-key',
          favoriteLoras: '["lora1", "lora2"]'
        })
      })

      const settings = await settingsApi.get()

      expect(settings.horde_api_key).toBe('test-api-key')
      expect(settings.favorite_loras).toBe('["lora1", "lora2"]')
      expect(settings.hasApiKey).toBe(true)
    })

    it('should indicate hasPinProtection status', async () => {
      setupLocalStorage({
        demoSettings: sampleSettings({
          pinEnabled: 1,
          pinHash: 'some-hash'
        })
      })

      const settings = await settingsApi.get()

      expect(settings.hasPinProtection).toBe(true)
    })
  })

  describe('settingsApi.update', () => {
    it('should update API key', async () => {
      const result = await settingsApi.update({ apiKey: 'new-api-key' })

      expect(result.horde_api_key).toBe('new-api-key')
      expect(result.hasApiKey).toBe(true)

      const stored = getLocalStorageData('demoSettings')
      expect(stored.horde_api_key).toBe('new-api-key')
    })

    it('should update favorite styles', async () => {
      const result = await settingsApi.update({
        favoriteStyles: ['style1', 'style2']
      })

      expect(result.favorite_styles).toBe('["style1","style2"]')
    })

    it('should update favorite loras', async () => {
      const result = await settingsApi.update({
        favoriteLoras: ['lora1', 'lora2']
      })

      expect(result.favorite_loras).toBe('["lora1","lora2"]')
    })

    it('should update recent loras', async () => {
      const result = await settingsApi.update({
        recentLoras: ['recent1', 'recent2']
      })

      expect(result.recent_loras).toBe('["recent1","recent2"]')
    })

    it('should update favorite TIs', async () => {
      const result = await settingsApi.update({
        favoriteTis: ['ti1', 'ti2']
      })

      expect(result.favorite_tis).toBe('["ti1","ti2"]')
    })

    it('should update recent TIs', async () => {
      const result = await settingsApi.update({
        recentTis: ['recent1', 'recent2']
      })

      expect(result.recent_tis).toBe('["recent1","recent2"]')
    })

    it('should preserve existing settings when updating', async () => {
      setupLocalStorage({
        demoSettings: sampleSettings({
          apiKey: 'existing-key',
          favoriteLoras: '["existing-lora"]'
        })
      })

      await settingsApi.update({ favoriteStyles: ['new-style'] })

      const stored = getLocalStorageData('demoSettings')
      expect(stored.horde_api_key).toBe('existing-key')
      expect(stored.favorite_loras).toBe('["existing-lora"]')
      expect(stored.favorite_styles).toBe('["new-style"]')
    })
  })

  describe('PIN protection', () => {
    describe('setupHiddenPin', () => {
      it('should setup new PIN with SHA-256 hash', async () => {
        const result = await settingsApi.setupHiddenPin('1234')

        expect(result.success).toBe(true)
        expect(result.hasPinProtection).toBe(true)

        const stored = getLocalStorageData('demoSettings')
        expect(stored.hidden_pin_enabled).toBe(1)
        expect(stored.hidden_pin_hash).toBeTruthy()
        expect(stored.hidden_pin_hash.length).toBe(64) // SHA-256 hex string
      })

      it('should mark as declined when user declines', async () => {
        const result = await settingsApi.setupHiddenPin(null, true)

        expect(result.success).toBe(true)
        expect(result.declined).toBe(true)

        const stored = getLocalStorageData('demoSettings')
        expect(stored.hidden_pin_declined).toBe(true)
      })

      it('should return failure when no PIN provided and not declined', async () => {
        const result = await settingsApi.setupHiddenPin(null, false)

        expect(result.success).toBe(false)
      })
    })

    describe('verifyHiddenPin', () => {
      beforeEach(async () => {
        // Setup a PIN first
        await settingsApi.setupHiddenPin('1234')
      })

      it('should verify correct PIN', async () => {
        const result = await settingsApi.verifyHiddenPin('1234')

        expect(result.valid).toBe(true)
      })

      it('should reject incorrect PIN', async () => {
        const result = await settingsApi.verifyHiddenPin('wrong')

        expect(result.valid).toBe(false)
      })

      it('should return invalid when no PIN is set', async () => {
        localStorage.clear()

        const result = await settingsApi.verifyHiddenPin('1234')

        expect(result.valid).toBe(false)
      })
    })

    describe('changeHiddenPin', () => {
      beforeEach(async () => {
        await settingsApi.setupHiddenPin('1234')
      })

      it('should change PIN with correct current PIN', async () => {
        const result = await settingsApi.changeHiddenPin('1234', '5678')

        expect(result.success).toBe(true)

        // Verify new PIN works
        const verify = await settingsApi.verifyHiddenPin('5678')
        expect(verify.valid).toBe(true)

        // Old PIN should not work
        const verifyOld = await settingsApi.verifyHiddenPin('1234')
        expect(verifyOld.valid).toBe(false)
      })

      it('should reject change with incorrect current PIN', async () => {
        await expect(
          settingsApi.changeHiddenPin('wrong', '5678')
        ).rejects.toThrow('Current PIN is incorrect')
      })

      it('should throw when no PIN is currently set', async () => {
        localStorage.clear()

        await expect(
          settingsApi.changeHiddenPin('1234', '5678')
        ).rejects.toThrow('No PIN is currently set')
      })
    })

    describe('removeHiddenPin', () => {
      beforeEach(async () => {
        await settingsApi.setupHiddenPin('1234')
      })

      it('should remove PIN with correct verification', async () => {
        const result = await settingsApi.removeHiddenPin('1234')

        expect(result.success).toBe(true)
        expect(result.hasPinProtection).toBe(false)

        const stored = getLocalStorageData('demoSettings')
        expect(stored.hidden_pin_hash).toBeNull()
        expect(stored.hidden_pin_enabled).toBe(0)
      })

      it('should reject removal with incorrect PIN', async () => {
        await expect(
          settingsApi.removeHiddenPin('wrong')
        ).rejects.toThrow('PIN is incorrect')
      })

      it('should throw when no PIN is set', async () => {
        localStorage.clear()

        await expect(
          settingsApi.removeHiddenPin('1234')
        ).rejects.toThrow('No PIN is currently set')
      })
    })
  })

  describe('Horde API integration', () => {
    it('should get horde user info', async () => {
      const mockUser = sampleHordeUser({ username: 'testuser', kudos: 5000 })
      global.fetch = createMockFetch({
        responses: {
          '/find_user': {
            ok: true,
            json: async () => mockUser
          }
        }
      })

      const result = await settingsApi.getHordeUser()
      await vi.runAllTimersAsync()

      expect(result.username).toBe('testuser')
      expect(result.kudos).toBe(5000)
    })

    it('should get horde workers', async () => {
      // Use real timers since this may involve rate-limited calls
      vi.useRealTimers()

      const mockUser = sampleHordeUser({ workerIds: [] })
      global.fetch = createMockFetch({
        responses: {
          '/find_user': {
            ok: true,
            json: async () => mockUser
          }
        }
      })

      const result = await settingsApi.getHordeWorkers()

      expect(result).toEqual([])

      vi.useFakeTimers()
    }, 15000)

    it('should update horde worker', async () => {
      // Use real timers since this involves rate-limited API call
      vi.useRealTimers()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'worker-1', name: 'Updated Worker' })
      })

      const result = await settingsApi.updateHordeWorker('worker-1', { name: 'Updated Worker' })

      expect(result.name).toBe('Updated Worker')

      vi.useFakeTimers()
    }, 15000)

    it('should validate shared key', async () => {
      // Use real timers since this involves rate-limited API call
      vi.useRealTimers()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'shared-key-1',
          name: 'Test Key',
          kudos: 100
        })
      })

      const result = await settingsApi.validateSharedKey('shared-key-1')

      expect(result.valid).toBe(true)
      expect(result.id).toBe('shared-key-1')

      vi.useFakeTimers()
    }, 15000)

    it('should get current shared key info', async () => {
      setupLocalStorage({
        demoSettings: sampleSettings({ apiKey: 'shared-key-123' })
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'shared-key-123',
          name: 'My Shared Key',
          kudos: 500
        })
      })

      const result = await settingsApi.getCurrentSharedKeyInfo()

      expect(result.id).toBe('shared-key-123')
      expect(result.name).toBe('My Shared Key')
    })

    it('should return null for getCurrentSharedKeyInfo when no API key', async () => {
      const result = await settingsApi.getCurrentSharedKeyInfo()

      expect(result).toBeNull()
    })

    it('should return null for getCurrentSharedKeyInfo when not a shared key', async () => {
      setupLocalStorage({
        demoSettings: sampleSettings({ apiKey: 'regular-api-key' })
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await settingsApi.getCurrentSharedKeyInfo()

      expect(result).toBeNull()
    })
  })
})
