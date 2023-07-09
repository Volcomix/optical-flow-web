import { ShaderPass } from '../../utils/shaderPass'

export type ProjectionProps = {
  kernelSize: number
}

export type ProjectionUniforms = {
  x?: number
  y?: number
}

export class Projection extends ShaderPass<
  ProjectionProps,
  'coefficients14' | 'coefficients56',
  ProjectionUniforms
> {
  set x(value: number) {
    this.props.uniforms.x = value
  }

  set y(value: number) {
    this.props.uniforms.y = value
  }

  protected createFragmentShader() {
    const n = ((this.props.kernelSize - 1) / 2).toFixed(1)
    const kernelSize = this.props.kernelSize.toFixed(1)

    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D coefficients14;
      uniform sampler2D coefficients56;
      uniform int x;
      uniform int y;

      in vec2 texCoord;

      out vec2 result;

      void main() {
        ivec2 signalCoord = ivec2(x, y);
        vec2 kernelCoord = texCoord * ${kernelSize} - ${n};

        float projection = 
          dot(texelFetch(coefficients14, signalCoord, 0), vec4(
            1,
            kernelCoord.x,
            kernelCoord.y,
            kernelCoord.x * kernelCoord.x
          )) +
          dot(texelFetch(coefficients56, signalCoord, 0).rg, vec2(
            kernelCoord.y * kernelCoord.y,
            kernelCoord.x * kernelCoord.y
          ));
        
        result = vec2(projection, projection * projection);
      }
    `
  }
}
