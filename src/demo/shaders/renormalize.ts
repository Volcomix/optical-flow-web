import ShaderPass from '../../utils/shaderPass'

class Renormalize extends ShaderPass<unknown, 'projection'> {
  protected createFragmentShader() {
    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D projection;

      in vec2 texCoord;

      out vec4 result;

      // https://gist.github.com/mikhailov-work/0d177465a8151eb6ede1768d51d476c7
      
      // Copyright 2019 Google LLC.
      // SPDX-License-Identifier: Apache-2.0

      // Polynomial approximation in GLSL for the Turbo colormap
      // Original LUT: https://gist.github.com/mikhailov-work/ee72ba4191942acecc03fe6da94fc73f

      // Authors:
      //   Colormap Design: Anton Mikhailov (mikhailov@google.com)
      //   GLSL Approximation: Ruofei Du (ruofei@google.com)

      vec3 TurboColormap(in float x) {
        const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
        const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
        const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
        const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
        const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
        const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);
        
        x = clamp(x, 0.0, 1.0);
        vec4 v4 = vec4( 1.0, x, x * x, x * x * x);
        vec2 v2 = v4.zw * v4.z;
        return vec3(
          dot(v4, kRedVec4)   + dot(v2, kRedVec2),
          dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
          dot(v4, kBlueVec4)  + dot(v2, kBlueVec2)
        );
      }

      void main() {
        float p = texture(projection, texCoord).r;
        vec4 E = textureLod(projection, texCoord, 6.0);
        float stdDev = sqrt(E.g - E.r * E.r);
        float left = min(0.0, E.r - stdDev * 3.0);
        float right = max(1.0, E.r + stdDev * 3.0);
        result = vec4(TurboColormap(p / (right - left) - left), 1);
      }
    `
  }
}

export default Renormalize
