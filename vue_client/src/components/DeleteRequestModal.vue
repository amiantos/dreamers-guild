<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Delete Request</h2>
        <button class="btn-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <p>What would you like to do with the images from this request?</p>

        <div class="option-buttons">
          <button @click="$emit('delete', 'prune')" class="btn btn-prune">
            <div class="btn-title">Prune Images</div>
            <div class="btn-description">Delete non-favorited images</div>
          </button>

          <button @click="$emit('delete', 'keep')" class="btn btn-keep">
            <div class="btn-title">Keep All Images</div>
            <div class="btn-description">Preserve all images from this request</div>
          </button>

          <button @click="$emit('close')" class="btn btn-cancel">
            <div class="btn-title">Cancel</div>
            <div class="btn-description">Don't delete this request</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DeleteRequestModal',
  emits: ['close', 'delete']
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: #1a1a1a;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 1.5rem 0;
  color: #ccc;
  font-size: 1rem;
}

.option-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn {
  padding: 1rem 1.25rem;
  border: 1px solid #333;
  border-radius: 8px;
  background: #0f0f0f;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.btn:hover {
  background: #2a2a2a;
  border-color: #444;
}

.btn-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.btn-description {
  font-size: 0.85rem;
  color: #999;
}

.btn-prune:hover {
  border-color: #ff6b6b;
}

.btn-prune:hover .btn-title {
  color: #ff6b6b;
}

.btn-keep:hover {
  border-color: #007AFF;
}

.btn-keep:hover .btn-title {
  color: #007AFF;
}

.btn-cancel:hover {
  border-color: #666;
}
</style>
