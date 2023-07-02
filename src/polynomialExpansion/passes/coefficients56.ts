import { Pass } from './pass'

export type Coefficients56Props = {
  invG: number[][]
}

export class Coefficients56 extends Pass<
  Coefficients56Props,
  'correlation14' | 'correlation56'
> {
  protected createFragmentShader() {
    return /* glsl */ `#version 300 es
    
      precision highp float;

      uniform sampler2D correlation14;
      uniform sampler2D correlation56;

      in vec2 texCoord;

      out vec4 result;

      const float a = ${this.props.invG[0][0]};
      const float b = ${this.props.invG[1][1]};
      const float c = ${this.props.invG[3][3]};
      const float d = ${this.props.invG[5][5]};
      const float e = ${this.props.invG[3][0]};

      void main() {
        vec4 values14 = texture(correlation14, texCoord);
        vec2 values56 = texture(correlation56, texCoord).rg;

        result = vec4(
          dot(vec4(e, 0, 0, 0), values14) + dot(vec2(c, 0), values56),
          dot(vec4(0, 0, 0, 0), values14) + dot(vec2(0, d), values56),
          0,
          0
        );
      }
    `
  }
}
