import type { CustomLayerInterface } from "maplibre-gl";
import { boxEdges, type Box3 } from "@/data/camera";
import { enuToLngLat } from "@/data/scene";
import { lngLatAltToMercator } from "./mercator";
import { asMatrix, isWebGL2, makeProgram } from "./gl";

const VS2 = `#version 300 es
uniform mat4 u_matrix;
in vec3 a_pos;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
}`;

const FS2 = `#version 300 es
precision mediump float;
uniform vec3 u_color;
out vec4 outColor;
void main() { outColor = vec4(u_color, 1.0); }`;

const VS1 = `
uniform mat4 u_matrix;
attribute vec3 a_pos;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
}`;

const FS1 = `
precision mediump float;
uniform vec3 u_color;
void main() { gl_FragColor = vec4(u_color, 1.0); }`;

export function createBoxLayer(id: string, box: Box3, color = [0.89, 0.58, 0.17]): CustomLayerInterface {
  const verts: number[] = [];
  for (const [a, b] of boxEdges(box)) {
    for (const p of [a, b]) {
      const ll = enuToLngLat(p.e, p.n, p.u);
      const m = lngLatAltToMercator(ll.lng, ll.lat, ll.alt);
      verts.push(m.x, m.y, m.z);
    }
  }
  const data = new Float32Array(verts);
  let gl: WebGLRenderingContext;
  let program: WebGLProgram;
  let buf: WebGLBuffer;
  let uMatrix: WebGLUniformLocation | null;
  let uColor: WebGLUniformLocation | null;
  let aPos: number;

  return {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, context) {
      gl = context;
      program = makeProgram(gl, isWebGL2(gl) ? VS2 : VS1, isWebGL2(gl) ? FS2 : FS1);
      aPos = gl.getAttribLocation(program, "a_pos");
      uMatrix = gl.getUniformLocation(program, "u_matrix");
      uColor = gl.getUniformLocation(program, "u_color");
      buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    },
    render(context, matrix) {
      const g = context;
      g.useProgram(program);
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);
      g.uniformMatrix4fv(uMatrix, false, asMatrix(matrix));
      g.uniform3f(uColor, color[0], color[1], color[2]);
      g.lineWidth(2);
      g.drawArrays(g.LINES, 0, data.length / 3);
    },
    onRemove() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    },
  };
}
