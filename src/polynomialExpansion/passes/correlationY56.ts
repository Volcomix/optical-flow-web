import { Kernels } from '../types'

import { Pass } from './pass'

export type CorrelationY56PassProps = {
  kernels: Kernels
  height: number
}

export class CorrelationY56Pass extends Pass<
  CorrelationY56PassProps,
  'correlation'
> {
  protected createFragmentShader() {
    const n = (this.props.kernels.x.length - 1) / 2

    const weights = [
      this.props.kernels.one,
      this.props.kernels.x,
      this.props.kernels.x2,
    ]

    const correlation = Array.from(
      { length: this.props.kernels.x.length },
      (_, i) => {
        const y = i - n
        const texelHeight = y / this.props.height
        return [
          `values = texture(correlation, texCoord + vec2(0, ${texelHeight})).rgb;`,
          `weights = vec3(${weights.map((weight) => weight[i]).join(', ')});`,
          `result.xy += values.xy * weights.zy;`,
        ].join('\n        ')
      }
    ).join('\n\n        ')

    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D correlation;

      in vec2 texCoord;

      out vec4 result;

      void main() {
        vec3 values;
        vec3 weights;
        result = vec4(0);

        ${correlation}
      }
    `
  }
}
