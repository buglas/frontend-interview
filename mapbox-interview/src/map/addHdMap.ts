import type { Map } from "maplibre-gl";
import { buildHdMap } from "@/data/hdmap";

// 添加高精地图图层
export function addHdMapLayers(map: Map, prefix = "hd") {
  // 构建高精地图数据
  const data = buildHdMap();
  // 添加车道源
  if (!map.getSource(`${prefix}-lanes`)) {
    map.addSource(`${prefix}-lanes`, { type: "geojson", data: data.lanes });
    // 添加路沿源
    map.addSource(`${prefix}-curbs`, { type: "geojson", data: data.curbs });
    // 添加停止线源
    map.addSource(`${prefix}-stop`, { type: "geojson", data: data.stop });
    // 添加路口源
    map.addSource(`${prefix}-junc`, { type: "geojson", data: data.junction });
    // 添加人行横道源
    map.addSource(`${prefix}-cw`, { type: "geojson", data: data.crosswalk });
  }
  // 添加路口图层
  if (!map.getLayer(`${prefix}-junc`)) {
    // 添加路口填充图层
    map.addLayer({
      id: `${prefix}-junc`,
      type: "fill",
      source: `${prefix}-junc`,
      paint: { "fill-color": "#e3942b", "fill-opacity": 0.12 },
    });
    // 添加人行横道填充图层
    map.addLayer({
      id: `${prefix}-cw`,
      type: "fill",
      source: `${prefix}-cw`,
      paint: { "fill-color": "#e8edf4", "fill-opacity": 0.28 },
    });
    // 添加车道线图层
    map.addLayer({
      id: `${prefix}-lanes`,
      type: "line",
      source: `${prefix}-lanes`,
      paint: {
        "line-color": "#f4d35e",
        "line-width": 2,
        "line-dasharray": [2, 1.4],
      },
    });
    // 添加路沿图层
    map.addLayer({
      id: `${prefix}-curbs`,
      type: "line",
      source: `${prefix}-curbs`,
      paint: { "line-color": "#8ecae6", "line-width": 3 },
    });
    // 添加停止线图层
    map.addLayer({
      id: `${prefix}-stop`,
      type: "line",
      source: `${prefix}-stop`,
      paint: { "line-color": "#ef476f", "line-width": 5 },
    });
  }
  return data;
}

export function setHdVisibility(map: Map, prefix: string, layer: string, visible: boolean) {
  const id = `${prefix}-${layer}`;
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
