<template>
  <div class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content pin-modal">
      <div class="modal-header">
        <h2>Enter PIN</h2>
        <button class="btn-close" @click="handleCancel">×</button>
      </div>

      <div class="modal-body">
        <p class="help-text">
          Enter your 4-digit PIN to access the hidden gallery.
        </p>

        <div class="pin-section">
          <PinInput
            v-model="pin"
            ref="pinInput"
            @complete="handlePinComplete"
          />
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import PinInput from './PinInput.vue';
import { settingsApi } from '../api/client.js';

const emit = defineEmits(['close', 'verified']);

const pin = ref('');
const error = ref('');
const pinInput = ref(null);

const handlePinComplete = async (value) => {
  error.value = '';

  try {
    const response = await settingsApi.verifyHiddenPin(value);
    if (response.valid) {
      emit('verified');
      emit('close');
    } else {
      error.value = 'Incorrect PIN. Please try again.';
      pin.value = '';
      setTimeout(() => {
        error.value = '';
        pinInput.value?.focus();
      }, 2000);
    }
  } catch (err) {
    console.error('Error verifying PIN:', err);
    error.value = err.response?.data?.error || 'Failed to verify PIN';
    pin.value = '';
    setTimeout(() => {
      error.value = '';
      pinInput.value?.focus();
    }, 2000);
  }
};

const handleCancel = () => {
  emit('close');
};

onMounted(() => {
  pinInput.value?.focus();
});
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #fff;
}

.btn-close {
  background: none;
  border: none;
  font-size: 32px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 24px;
}

.help-text {
  color: #999;
  line-height: 1.5;
  margin-bottom: 32px;
  text-align: center;
}

.pin-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.error-message {
  color: #dc3545;
  margin: 0;
  font-size: 14px;
  text-align: center;
}
</style>
