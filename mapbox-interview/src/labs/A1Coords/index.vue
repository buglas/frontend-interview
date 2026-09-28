<script setup lang="ts">
import { ref } from "vue";
import maplibregl, { type Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { ORIGIN, enuToLngLat } from "@/data/scene";
import { lngLatAltToMercator, meterInMercatorCoordinateUnits } from "@/map/mercator";

const notice = ref(
  "蓝点：路口原点。橙点：车体 ENU 东 20m、北 5m 转到经纬。Custom Layer 还要把经纬变成 Mercator。",
);
// 将ENU坐标转换为经纬度坐标
const p = enuToLngLat(20, 10, 0);
// 将经纬度坐标转换为Mercator坐标
const merc = lngLatAltToMercator(p.lng, p.lat, p.alt);
// 计算Mercator坐标系中的米单位
const meterUnit = meterInMercatorCoordinateUnits(ORIGIN.lat);
let map: Map | null = null;

const setup = (m: Map) => {
  map = m;
  new maplibregl.Marker({ color: "#3d8fd1" }).setLngLat([ORIGIN.lng, ORIGIN.lat]).addTo(m);
  new maplibregl.Marker({ color: "#e3942b" }).setLngLat([p.lng, p.lat]).addTo(m);
};

function wrong() {
  if (!map) return;
  map.flyTo({ center: [365, ORIGIN.lat], zoom: 2, duration: 1200 });
  notice.value =
    "错误示范：把投影东坐标 365000 或「米」直接塞进 setLngLat。点会飞到无效经度。应先 ENU→经纬，Custom Layer 再转 Mercator。";
}

function reset() {
  if (!map) return;
  map.jumpTo({ center: [ORIGIN.lng, ORIGIN.lat], zoom: 17.4, pitch: 0 });
  notice.value = "已回到示意路口。橙点仍是 ENU(20, 5) 的正确落点。";
}
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="17.4">
    <template #toolbar>
      <span>原点 {{ ORIGIN.lng.toFixed(4) }}, {{ ORIGIN.lat.toFixed(4) }}</span>
      <span>Mercator x={{ merc.x.toFixed(6) }}, y={{ merc.y.toFixed(6) }}, z={{ merc.z.toFixed(6) }}</span>
      <span>1m ≈ {{ meterUnit.toExponential(2) }} Mercator</span>
      <button type="button" @click="wrong">错误：米当经度</button>
      <button type="button" @click="reset">复位</button>
    </template>
  </LabMap>
</template>
