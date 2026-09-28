# mapbox多模态可视化面试实验室

内容：2D 图像标注、3D 点云标注、BEV 回放、车辆轨迹、高精地图、海量传感器数据的浏览器性能。



## 启动

需要 Node.js 18+。

```bash
npm install
npm run dev
```

浏览器打开终端里的地址（默认 http://localhost:5174 ）。

底图与官方示例相同：

```js
const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [121.4018, 31.1752],
  zoom: 17.4,
});
map.addControl(new maplibregl.NavigationControl());
```

demotiles 是低细节矢量底图，街景尺度主要看我们叠的车道 / 点云 / 轨迹。



## 学习路径

| 程度 | 题 |
|------|----|
| 初级 | A1 A2 B1 B2 |
| 中级 | + C1 C2 C3 D1 D2 E1 |
| 高级 | + F1 |

左侧勾选会记在 localStorage，刷新不丢。



## 目录

- `src/content/catalog.ts`：与题号对齐的右侧短句
- `src/labs/`：一题一演示
- `src/render/useMaplibre.ts`：创建与 `map.remove()`
- `src/map/pointCloudLayer.ts`：TypedArray 点云 Custom Layer
- `src/data/`：合成点云、车道、轨迹、假相机图
- `src/workers/genPoints.worker.ts`：F1 在 Worker 里生成 50 万点



## 脚本

```bash
npm run dev
npm run build
npm run preview
```
