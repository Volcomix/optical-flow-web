import { Kernels } from '../types'

export const createCorrelationYFragmentShader = (
  kernels: Kernels,
  height: number
) => {
  const n = (kernels.x.length - 1) / 2
  const weights = [kernels.one, kernels.x, kernels.x2]

  const correlation = Array.from({ length: kernels.x.length }, (_, i) => {
    const y = i - n
    const texelHeight = y / height
    return `values = texture(correlation, texCoord + vec2(0, ${texelHeight})).rgb;
      weights = vec3(${weights.map((weight) => weight[i]).join(', ')});
      result1_4 += values.xyxz * weights.xxyx;
      result5_6 += values.xy * weights.zy;`
  }).join('\n\n      ')

  return /* glsl */ `#version 300 es

    precision highp float;

    uniform sampler2D correlation;

    in vec2 texCoord;

    out uvec4 result;

    void main() {
      vec3 values;
      vec3 weights;
      vec4 result1_4 = vec4(0);
      vec2 result5_6 = vec2(0);

      ${correlation}

      result = uvec4(packHalf2x16(result1_4.xy), packHalf2x16(result1_4.zw), packHalf2x16(result5_6), 0);
    }
  `
}
