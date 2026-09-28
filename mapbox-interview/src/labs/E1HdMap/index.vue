<script setup lang="ts">
import { reactive, ref } from "vue";
import type { Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { addHdMapLayers, setHdVisibility } from "@/map/addHdMap";

const notice = ref("高精地图是带语义的矢量：车道虚线、路沿、停止线、路口面、斑马线。不是一张卫星图。");
const vis = reactive({
  lanes: true,
  curbs: true,
  stop: true,
  junc: true,
  cw: true,
});
let map: Map | null = null;

const setup = (m: Map) => {
  map = m;
  addHdMapLayers(m, "e1");
};

function toggle(layer: keyof typeof vis) {
  vis[layer] = !vis[layer];
  if (map) setHdVisibility(map, "e1", layer, vis[layer]);
}
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="17.8" :pitch="0">
    <template #toolbar>
      <button type="button" :class="{ active: vis.lanes }" @click="toggle('lanes')">车道</button>
      <button type="button" :class="{ active: vis.curbs }" @click="toggle('curbs')">路沿</button>
      <button type="button" :class="{ active: vis.stop }" @click="toggle('stop')">停止线</button>
      <button type="button" :class="{ active: vis.junc }" @click="toggle('junc')">路口</button>
      <button type="button" :class="{ active: vis.cw }" @click="toggle('cw')">斑马线</button>
    </template>
  </LabMap>
</template>
