import { Kernels } from '../types'

import { Pass } from './pass'

export type CorrelationXProps = {
  kernels: Kernels
  width: number
}

export class CorrelationX extends Pass<CorrelationXProps, 'signal'> {
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
        const x = i - n
        const texelWidth = x / this.props.width
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
