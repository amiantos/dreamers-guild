<template>
  <div class="inspector-grid">
    <template v-for="item in items" :key="item.label">
      <span class="inspector-label">{{ item.label }}</span>
      <span class="inspector-value" :class="item.class">{{ item.value }}</span>
    </template>
  </div>
</template>

<script>
export default {
  name: 'InspectorGrid',
  props: {
    items: {
      type: Array,
      required: true,
      validator: (value) => {
        return value.every(item =>
          typeof item.label === 'string' &&
          item.value !== undefined
        )
      }
    }
  }
}
</script>

<style scoped>
.inspector-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.inspector-label {
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.inspector-value {
  color: var(--color-text-primary);
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  text-align: right;
  word-break: break-word;
}

.inspector-value.highlight {
  color: var(--color-primary);
}

.inspector-value.success {
  color: var(--color-success);
}

.inspector-value.muted {
  color: var(--color-text-tertiary);
}
</style>
