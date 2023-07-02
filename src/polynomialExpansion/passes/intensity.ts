import { Pass } from './pass'

export type LumaTransformRec = 709 | 601

export type IntensityProps = {
  lumaTransformRec?: LumaTransformRec
}

export class Intensity extends Pass<IntensityProps, 'signal'> {
  protected createFragmentShader() {
    const coeffs = (
      this.props.lumaTransformRec === 601
        ? [0.299, 0.587, 0.114]
        : [0.2126, 0.7152, 0.0722]
    ).join(', ')

    return /* glsl */ `#version 300 es
    
      precision highp float;
    
      uniform sampler2D signal;
    
      in vec2 texCoord;
    
      out float result;
    
      void main() {
        result = dot(texture(signal, texCoord), vec4(${coeffs}, 0));
      }
    `
  }
}
