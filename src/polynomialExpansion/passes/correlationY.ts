import { Kernels } from '../types'

import { Pass } from './pass'

export type CorrelationYPassProps = {
  kernels: Kernels
  height: number
  output: 'pack' | '1_4' | '5_6'
}

export class CorrelationYPass extends Pass<CorrelationYPassProps> {
  private get declaration() {
    if (this.props.output === 'pack') {
      return ['vec4 result1_4 = vec4(0);', 'vec2 result5_6 = vec2(0);']
    } else {
      return ['result = vec4(0);']
    }
  }

  private get correlation() {
    const n = (this.props.kernels.x.length - 1) / 2

    const weights = [
      this.props.kernels.one,
      this.props.kernels.x,
      this.props.kernels.x2,
    ]

    const result = Array.from(
      { length: this.props.kernels.x.length },
      (_, i) => {
        const y = i - n
        const texelHeight = y / this.props.height
        const results = [
          `values = texture(correlation, texCoord + vec2(0, ${texelHeight})).rgb;`,
          `weights = vec3(${weights.map((weight) => weight[i]).join(', ')});`,
        ]
        if (this.props.output === 'pack') {
          results.push('result1_4 += values.xyxz * weights.xxyx;')
          results.push('result5_6 += values.xy * weights.zy;')
        } else if (this.props.output === '1_4') {
          results.push('result += values.xyxz * weights.xxyx;')
        } else if (this.props.output === '5_6') {
          results.push('result.xy += values.xy * weights.zy;')
        }
        return results.join('\n        ')
      }
    )

    if (this.props.output === 'pack') {
      result.push(
        'result = uvec4(packHalf2x16(result1_4.xy), packHalf2x16(result1_4.zw), packHalf2x16(result5_6), 0);'
      )
    }

    return result
  }

  protected createFragmentShader() {
    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D correlation;

      in vec2 texCoord;

      out ${this.props.output === 'pack' ? 'uvec4' : 'vec4'} result;

      void main() {
        vec3 values;
        vec3 weights;
        ${this.declaration.join('\n        ')}

        ${this.correlation.join('\n\n        ')}
      }
    `
  }
}
