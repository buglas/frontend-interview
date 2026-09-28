import {
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type Ref,
} from "vue";
import maplibregl, { type Map } from "maplibre-gl";
import { ORIGIN } from "@/data/scene";

export type LabMapSetup = (
  map: Map,
) => void | (() => void) | Promise<void | (() => void)>;

export type MapOptions = {
  zoom?: number;
  pitch?: number;
  bearing?: number;
  center?: [number, number];
};

/** 与官方 demotiles 示例同一套：无需 token */
export const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

export function useMaplibre(
  container: Ref<HTMLElement | null | undefined>,
  setup?: LabMapSetup,
  options: MapOptions = {},
) {
  const mapRef = shallowRef<Map | null>(null);
  let cleanup: (() => void) | void;
  let cancelled = false;

  onMounted(async () => {
    const el = container.value;
    if (!el) return;
    //创建MapLibre地图实例
    const map = new maplibregl.Map({
      container: el, //容器元素
      style: MAP_STYLE, //地图样式
      center: options.center ?? [ORIGIN.lng, ORIGIN.lat], //中心点坐标
      zoom: options.zoom ?? 17.4, //缩放级别
      pitch: options.pitch ?? 0, //倾斜角度
      bearing: options.bearing ?? 0, //旋转角度
      antialias: true, //抗锯齿
      attributionControl: false,
      fadeDuration: 0, //淡入淡出效果时间
    });
    mapRef.value = map;
    //添加导航控制器,右上角,
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    await map.once("load");
    if (cancelled) {
      map.remove();
      return;
    }
    if (setup) cleanup = await setup(map);
  });

  onBeforeUnmount(() => {
    cancelled = true;
    try {
      cleanup?.();
    } catch (e) {
      console.warn("lab map cleanup", e);
    }
    const m = mapRef.value;
    if (m) {
      m.remove();
    }
    mapRef.value = null;
  });

  return { map: mapRef };
}
