import * as twgl from 'twgl.js'

import { Kernels } from '../types'

import { Pass, PassOptions } from './pass'

export class CorrelationXPass extends Pass {
  constructor(
    gl: WebGL2RenderingContext,
    bufferInfo: twgl.BufferInfo,
    private kernels: Kernels,
    private width: number,
    signal: WebGLTexture,
    options: PassOptions = {}
  ) {
    super(
      gl,
      bufferInfo,
      { ...options, uniforms: { signal, ...options.uniforms } },
      { kernels, width }
    )
  }

  protected createFragmentShader() {
    const n = (this.kernels.x.length - 1) / 2
    const weights = [this.kernels.one, this.kernels.x, this.kernels.x2]

    const correlation = Array.from(
      { length: this.kernels.x.length },
      (_, i) => {
        const x = i - n
        const texelWidth = x / this.width
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
