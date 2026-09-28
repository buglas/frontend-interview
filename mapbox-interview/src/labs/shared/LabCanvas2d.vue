<script setup lang="ts">
defineProps<{
  notice?: string;
}>();
</script>

<template>
  <div class="lab-stage">
    <div class="lab-main">
      <slot />
      <div v-if="$slots.toolbar" class="lab-toolbar">
        <slot name="toolbar" />
      </div>
      <div v-if="notice" class="lab-notice">{{ notice }}</div>
    </div>
  </div>
</template>
