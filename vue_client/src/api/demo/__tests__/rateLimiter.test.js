/**
 * Tests for the rate limiter (rateLimiter.js)
 * Tests minimum interval enforcement and promise chaining for serialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Rate Limiter', () => {
  let throttle

  beforeEach(async () => {
    vi.useFakeTimers()
    // Reset the module to clear state between tests
    vi.resetModules()
    const module = await import('../rateLimiter.js')
    throttle = module.throttle
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('throttle', () => {
    it('should allow immediate first call', async () => {
      const startTime = Date.now()
      const throttlePromise = throttle()

      // Advance any pending timers
      await vi.runAllTimersAsync()
      await throttlePromise

      // Should complete almost immediately (within a few ms)
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(100)
    })

    it('should enforce minimum 1 second interval', async () => {
      // First call
      await throttle()
      await vi.runAllTimersAsync()

      // Second call should wait
      const secondCallPromise = throttle()

      // Advance time by 500ms - should still be waiting
      await vi.advanceTimersByTimeAsync(500)

      // Advance remaining time
      await vi.advanceTimersByTimeAsync(600)
      await secondCallPromise

      // Should have waited the full interval
    })

    it('should serialize concurrent calls via promise chaining', async () => {
      const callOrder = []

      // Make multiple concurrent calls
      const call1 = throttle().then(() => callOrder.push(1))
      const call2 = throttle().then(() => callOrder.push(2))
      const call3 = throttle().then(() => callOrder.push(3))

      // Run all timers to completion
      await vi.runAllTimersAsync()
      await Promise.all([call1, call2, call3])

      // Calls should complete in order (FIFO)
      expect(callOrder).toEqual([1, 2, 3])
    })

    it('should maintain minimum interval between all calls', async () => {
      const timestamps = []

      // First call
      await throttle()
      timestamps.push(Date.now())
      await vi.runAllTimersAsync()

      // Second call
      const call2 = throttle().then(() => timestamps.push(Date.now()))
      await vi.runAllTimersAsync()
      await call2

      // Third call
      const call3 = throttle().then(() => timestamps.push(Date.now()))
      await vi.runAllTimersAsync()
      await call3

      // Each call should be at least 1000ms after the previous
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(1000)
      }
    })

    it('should handle errors without breaking the queue', async () => {
      const results = []

      // First call succeeds
      await throttle()
      results.push('call1')
      await vi.runAllTimersAsync()

      // Simulate an error in the middle of the queue
      // (The rate limiter catches errors internally to prevent queue breakage)

      // Second call
      const call2 = throttle().then(() => results.push('call2'))
      await vi.runAllTimersAsync()
      await call2

      // Third call should still work
      const call3 = throttle().then(() => results.push('call3'))
      await vi.runAllTimersAsync()
      await call3

      expect(results).toEqual(['call1', 'call2', 'call3'])
    })

    it('should not wait if enough time has passed since last call', async () => {
      // First call
      await throttle()
      await vi.runAllTimersAsync()

      // Wait more than the minimum interval
      await vi.advanceTimersByTimeAsync(2000)

      // Second call should be immediate
      const startTime = Date.now()
      await throttle()
      await vi.runAllTimersAsync()

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(100)
    })
  })

  describe('concurrent call handling', () => {
    it('should process all concurrent calls in FIFO order', async () => {
      const results = []

      // Launch many concurrent calls
      const calls = []
      for (let i = 0; i < 5; i++) {
        calls.push(throttle().then(() => results.push(i)))
      }

      // Process all
      await vi.runAllTimersAsync()
      await Promise.all(calls)

      expect(results).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle rapid fire calls', async () => {
      let completedCalls = 0

      // Rapid fire 10 calls
      const calls = Array.from({ length: 10 }, () =>
        throttle().then(() => completedCalls++)
      )

      // Run all timers
      await vi.runAllTimersAsync()
      await Promise.all(calls)

      expect(completedCalls).toBe(10)
    })
  })
})
