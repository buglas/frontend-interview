<script setup lang="ts">
import { ref } from "vue";
import type { Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { generateCloud } from "@/data/pointCloud";
import { createPointCloudLayer } from "@/map/pointCloudLayer";
import { addHdMapLayers } from "@/map/addHdMap";

const cloud = generateCloud(60_000);
const notice = ref(
  `当前 ${cloud.count.toLocaleString()} 点，Float32Array + gl.POINTS。不要逐点 Mesh，不要 GeoJSON。`,
);

const setup = (map: Map) => {
  addHdMapLayers(map, "c1");
  map.addLayer(
    createPointCloudLayer({
      id: "c1-cloud",
      mercator: cloud.mercator,
      color: cloud.color,
      count: cloud.count,
      pointSize: 2.1,
    }),
  );
};
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="17.8" :pitch="55">
    <template #toolbar>
      <span>TypedArray xyz + rgb · CustomLayerInterface · renderingMode=3d</span>
    </template>
  </LabMap>
</template>
