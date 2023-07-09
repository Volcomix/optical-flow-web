import { ShaderPass } from '../../utils/shaderPass'

export type SignalProps = {
  kernelSize: number
  width: number
  height: number
}

export type SignalUniforms = {
  x?: number
  y?: number
}

export class Signal extends ShaderPass<SignalProps, 'signal', SignalUniforms> {
  set x(value: number) {
    this.props.uniforms.x = value
  }

  set y(value: number) {
    this.props.uniforms.y = value
  }

  protected createFragmentShader() {
    const n = ((this.props.kernelSize - 1) / 2).toFixed(1)

    const texelWidth = 1 / this.props.width
    const texelHeight = 1 / this.props.height
    const kernelSize = this.props.kernelSize.toFixed(1)

    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D signal;
      uniform float x;
      uniform float y;

      in vec2 texCoord;

      out vec4 result;

      void main() {
        vec2 texelSize = vec2(${texelWidth}, ${texelHeight});
        vec2 signalCoord = vec2(x, y);
        vec2 kernelCoord = vec2(texCoord * ${kernelSize} - ${n});
        result = vec4(texture(signal, (signalCoord + kernelCoord) * texelSize).r);
      }
    `
  }
}
