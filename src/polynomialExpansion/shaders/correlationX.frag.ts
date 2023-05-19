import { Kernels } from '../types'

export const createCorrelationXFragmentShader = (
  kernels: Kernels,
  width: number
) => {
  const n = (kernels.x.length - 1) / 2
  const weights = [kernels.one, kernels.x, kernels.x2]

  const correlation = Array.from({ length: kernels.x.length }, (_, i) => {
    const x = i - n
    return `texture(signal, texCoord + vec2(${x / width}, 0)).r * vec3(${weights
      .map((weight) =>
        weight[i].toLocaleString('en-US', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 20,
        })
      )
      .join(', ')})`
  }).join(' +\n        ')

  return /* glsl */ `#version 300 es
  
    precision highp float;

    uniform sampler2D signal;

    in vec2 texCoord;

    out vec4 result;

    void main() {
      result = vec4(
        ${correlation}
      , 0);
    }
`
}
