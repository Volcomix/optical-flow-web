import { Kernels } from '../types'

// TODO Factorize float formatting and refactor to improve readability
// TODO Rename variables (result1, result2, v, k)
export const createCorrelationYFragmentShader = (
  kernels: Kernels,
  height: number
) => {
  const n = (kernels.x.length - 1) / 2
  const weights = [kernels.one, kernels.x, kernels.x2]

  const correlation = Array.from({ length: kernels.x.length }, (_, i) => {
    const y = i - n
    return `v = texture(correlation, texCoord + vec2(0, ${y / height})).rgb;
      k = vec3(${weights
        .map((weight) =>
          weight[i].toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 20,
          })
        )
        .join(', ')});
      result1 += v.xyxz * k.xxyx;
      result2 += v.xy * k.zy;`
  }).join('\n\n      ')

  return /* glsl */ `#version 300 es

    precision highp float;

    uniform sampler2D correlation;

    in vec2 texCoord;

    out uvec4 result;

    void main() {
      vec3 v;
      vec3 k;
      vec4 result1 = vec4(0);
      vec2 result2 = vec2(0);

      ${correlation}

      result = uvec4(packHalf2x16(result1.xy), packHalf2x16(result1.zw), packHalf2x16(result2), 0);
    }
  `
}
