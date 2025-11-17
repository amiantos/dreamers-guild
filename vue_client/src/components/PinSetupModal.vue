<template>
  <div class="modal-overlay" @click.self="handleBackdropClick">
    <div class="modal-content pin-modal">
      <div class="modal-header">
        <h2>Protect Your Hidden Gallery</h2>
      </div>

      <div class="modal-body">
        <p class="help-text">
          Set a 4-digit PIN to protect your hidden images from accidental viewing.
          You'll be asked to enter this PIN when accessing hidden content.
        </p>

        <div class="pin-section">
          <label>{{ confirmMode ? 'Confirm PIN' : 'Enter 4-Digit PIN' }}</label>
          <PinInput
            v-model="pin"
            ref="pinInput"
            @complete="handlePinComplete"
          />
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>

        <div class="button-group">
          <button @click="handleDecline" class="btn btn-secondary" :disabled="loading">
            No Thanks
          </button>
          <button
            v-if="!confirmMode"
            @click="handleContinue"
            class="btn btn-primary"
            :disabled="pin.length !== 4 || loading"
          >
            {{ loading ? 'Setting...' : 'Continue' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PinInput from './PinInput.vue';
import { settingsApi } from '../api/client.js';

const emit = defineEmits(['close', 'setup-complete']);

const pin = ref('');
const firstPin = ref('');
const confirmMode = ref(false);
const error = ref('');
const loading = ref(false);
const pinInput = ref(null);

const handlePinComplete = async (value) => {
  if (confirmMode.value) {
    // Confirming PIN
    if (value === firstPin.value) {
      await setupPin(value);
    } else {
      error.value = 'PINs do not match. Please try again.';
      setTimeout(() => {
        confirmMode.value = false;
        firstPin.value = '';
        pin.value = '';
        error.value = '';
        pinInput.value?.focus();
      }, 2000);
    }
  }
};

const handleContinue = () => {
  if (pin.value.length !== 4) return;

  firstPin.value = pin.value;
  confirmMode.value = true;
  pin.value = '';
  error.value = '';

  setTimeout(() => {
    pinInput.value?.focus();
  }, 100);
};

const setupPin = async (pinValue) => {
  loading.value = true;
  error.value = '';

  try {
    const response = await settingsApi.setupHiddenPin(pinValue);
    if (response.success) {
      emit('setup-complete', { hasPin: true });
      emit('close');
    } else {
      error.value = 'Failed to setup PIN. Please try again.';
    }
  } catch (err) {
    console.error('Error setting up PIN:', err);
    error.value = err.response?.data?.error || 'Failed to setup PIN';
  } finally {
    loading.value = false;
  }
};

const handleDecline = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await settingsApi.setupHiddenPin(null, true);
    if (response.success) {
      emit('setup-complete', { hasPin: false });
      emit('close');
    } else {
      error.value = 'Failed to save preference. Please try again.';
    }
  } catch (err) {
    console.error('Error declining PIN:', err);
    error.value = err.response?.data?.error || 'Failed to save preference';
  } finally {
    loading.value = false;
  }
};

const handleBackdropClick = () => {
  // Don't allow closing by clicking backdrop during setup
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-content {
  background-color: #1a1a1a;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.pin-modal {
  max-width: 450px;
}

.modal-header {
  padding: 24px 24px 0;
  border-bottom: none;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #fff;
}

.modal-body {
  padding: 24px;
}

.help-text {
  color: #999;
  line-height: 1.5;
  margin-bottom: 32px;
}

.pin-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.pin-section label {
  font-weight: 500;
  color: #fff;
  font-size: 16px;
}

.error-message {
  color: #dc3545;
  margin: 0;
  font-size: 14px;
  text-align: center;
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}
</style>
