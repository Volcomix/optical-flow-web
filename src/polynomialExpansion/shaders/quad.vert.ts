export type QuadVertexShaderOptions = Partial<{
  flipY: boolean
}>

export const createQuadVertexShader = (
  options: QuadVertexShaderOptions = {}
) => {
  const position = options.flipY ? 'inPosition * vec2(1, -1)' : 'inPosition'

  return /* glsl */ `#version 300 es
   
    in vec2 inPosition;
    in vec2 inTexCoord;
  
    out vec2 texCoord;
   
    void main() {
      gl_Position = vec4(${position}, 0, 1);
      texCoord = inTexCoord;
    }
  `
}
