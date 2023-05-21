import * as twgl from 'twgl.js'

const debugSeparatorLength = 80

export type PassOptions = Partial<{
  flipY: boolean
  frameBuffer: twgl.AttachmentOptions
  uniforms: { [key: string]: unknown }
}>

export abstract class Pass<O extends PassOptions = PassOptions> {
  private programInfo: twgl.ProgramInfo
  private frameBufferInfo: twgl.FramebufferInfo | null

  constructor(
    private gl: WebGL2RenderingContext,
    private bufferInfo: twgl.BufferInfo,
    protected options: O,
    properties: { [key: string]: unknown } = {}
  ) {
    Object.assign(this, properties)

    const vertexShader = this.createVertexShader()
    const fragmentShader = this.createFragmentShader()

    // TODO Debug only if config set
    console.log('='.repeat(debugSeparatorLength))
    console.log(this.constructor.name)
    console.log('-'.repeat(debugSeparatorLength))
    console.log(vertexShader)
    console.log('-'.repeat(debugSeparatorLength))
    console.log(fragmentShader)

    this.programInfo = twgl.createProgramInfo(gl, [
      vertexShader,
      fragmentShader,
    ])

    if (options.frameBuffer) {
      this.frameBufferInfo = twgl.createFramebufferInfo(gl, [
        options.frameBuffer,
      ])
    } else {
      this.frameBufferInfo = null
    }
  }

  private createVertexShader() {
    const position = this.options.flipY
      ? 'inPosition * vec2(1, -1)'
      : 'inPosition'

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

  protected abstract createFragmentShader(): string

  render() {
    this.gl.bindFramebuffer(
      this.gl.FRAMEBUFFER,
      this.frameBufferInfo?.framebuffer ?? null
    )
    this.gl.useProgram(this.programInfo.program)
    twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo)
    if (this.options.uniforms) {
      twgl.setUniforms(this.programInfo, this.options.uniforms)
    }
    twgl.drawBufferInfo(this.gl, this.bufferInfo)
  }

  get attachment() {
    return this.frameBufferInfo?.attachments[0]
  }
}
