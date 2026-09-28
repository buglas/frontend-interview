<script setup lang="ts">
import { ref } from "vue";
import maplibregl, { type Map, type MapMouseEvent } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { generateCloud, buildEnuGrid, pickNearest } from "@/data/pointCloud";
import { createPointCloudLayer } from "@/map/pointCloudLayer";
import { addHdMapLayers } from "@/map/addHdMap";
import { lngLatToEnu, enuToLngLat } from "@/data/scene";

// 生成点云数据
const cloud = generateCloud(80_000);
// 构建ENU网格
const grid = buildEnuGrid(cloud);
// 提示信息
const notice = ref("点击路面：网格只搜邻域。对比按钮会扫全部点，看耗时差。");
// 最后一次操作的结果
const last = ref("");
// 地图实例
let map: Map | null = null;
// 标记点实例
let marker: maplibregl.Marker | null = null;

const setup = (m: Map) => {
  map = m;
  // 添加高清地图图层
  addHdMapLayers(m, "c3");
  // 添加点云图层
  m.addLayer(
    createPointCloudLayer({
      id: "c3-cloud",
      mercator: cloud.mercator,
      color: cloud.color,
      count: cloud.count,
      pointSize: 2,
    }),
  );
  m.getCanvas().style.cursor = "crosshair";
  // 点击事件
  const onClick = (ev: MapMouseEvent) => {
    // 拾取点,false表示使用网格邻域
    pick(ev.lngLat.lng, ev.lngLat.lat, false);
  };
  m.on("click", onClick);
  return () => m.off("click", onClick);
};

function mark(e: number, n: number, u: number) {
  const ll = enuToLngLat(e, n, u);
  if (!map) return;
  if (!marker) marker = new maplibregl.Marker({ color: "#e3942b" }).setLngLat([ll.lng, ll.lat]).addTo(map);
  else marker.setLngLat([ll.lng, ll.lat]);
}

function pick(lng: number, lat: number, naive: boolean) {
  // 转换为ENU坐标
  const { e, n } = lngLatToEnu(lng, lat);
  // 开始时间,performance 性能
  const t0 = performance.now();
  // 命中点
  let hit: { index: number; dist: number } | null = null;
  if (naive) {
    // 全量扫描
    // 最佳距离
    let best = -1;
    // 最佳距离平方
    let bestD = 1.5 * 1.5;
    // 遍历点云数据
    for (let i = 0; i < cloud.count; i++) {
      // 计算距离
      const de = cloud.enu[i * 3] - e;
      // 计算距离
      const dn = cloud.enu[i * 3 + 1] - n;
      // 计算距离平方
      const d = de * de + dn * dn;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) hit = { index: best, dist: Math.sqrt(bestD) };
  } else {
    // 网格邻域
    hit = pickNearest(cloud, grid, e, n, 1.5);
  }
  const ms = (performance.now() - t0).toFixed(2);
  if (!hit) {
    last.value = `${naive ? "全量" : "网格"} ${ms} ms，半径 1.5m 内无点`;
    notice.value = last.value;
    return;
  }
  const u = cloud.enu[hit.index * 3 + 2];
  mark(cloud.enu[hit.index * 3], cloud.enu[hit.index * 3 + 1], u);
  last.value = `${naive ? "全量扫描" : "网格邻域"} ${ms} ms · 点 #${hit.index} · ${hit.dist.toFixed(2)} m`;
  notice.value = last.value;
}
// 中心点全量扫描
function naiveAtCenter() {
  if (!map) return;
  const c = map.getCenter();
  pick(c.lng, c.lat, true);
}
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="18" :pitch="45">
    <template #toolbar>
      <span>点击拾取（网格）</span>
      <button type="button" @click="naiveAtCenter">对比：中心点全量扫描</button>
      <span>{{ cloud.count.toLocaleString() }} 点</span>
    </template>
  </LabMap>
</template>
