<script setup lang="ts">
import { ref } from "vue";
import { useMaplibre, type LabMapSetup, type MapOptions } from "@/render/useMaplibre";

const props = defineProps<{
  setup: LabMapSetup;
  notice?: string;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}>();

const el = ref<HTMLElement | null>(null);
useMaplibre(el, (map) => props.setup(map), {
  zoom: props.zoom,
  pitch: props.pitch,
  bearing: props.bearing,
} satisfies MapOptions);
</script>

<template>
  <div class="lab-stage">
    <div class="lab-main">
      <div ref="el" class="map-host" />
      <div v-if="$slots.toolbar" class="lab-toolbar">
        <slot name="toolbar" />
      </div>
      <div v-if="notice" class="lab-notice">{{ notice }}</div>
      <div v-if="$slots.overlay" class="lab-overlay">
        <slot name="overlay" />
      </div>
    </div>
    <div v-if="$slots.aux" class="lab-aux">
      <slot name="aux" />
    </div>
  </div>
</template>
