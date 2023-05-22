import { Kernels } from '../types'

import { Pass, PassOptions } from './pass'

// FIXME Kernels and width aren't really options
export type CorrelationXPassOptions = PassOptions & {
  kernels: Kernels
  width: number
}

export class CorrelationXPass extends Pass<CorrelationXPassOptions> {
  protected createFragmentShader() {
    const n = (this.options.kernels.x.length - 1) / 2

    const weights = [
      this.options.kernels.one,
      this.options.kernels.x,
      this.options.kernels.x2,
    ]

    const correlation = Array.from(
      { length: this.options.kernels.x.length },
      (_, i) => {
        const x = i - n
        const texelWidth = x / this.options.width
        return `texture(signal, texCoord + vec2(${texelWidth}, 0)).r * vec3(${weights
          .map((weight) => weight[i])
          .join(', ')})`
      }
    ).join(' +\n          ')

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
}
