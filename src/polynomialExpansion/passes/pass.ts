import * as twgl from 'twgl.js'

const debugSeparatorLength = 80

export type PassProps = {
  frameBuffer?: twgl.AttachmentOptions
  uniforms?: { [key: string]: unknown }
}

export abstract class Pass<P> {
  static logShaders = false

  private programInfo: twgl.ProgramInfo
  private frameBufferInfo: twgl.FramebufferInfo | null

  constructor(
    private gl: WebGL2RenderingContext,
    private bufferInfo: twgl.BufferInfo,
    protected props: PassProps & P
  ) {
    const vertexShader = this.createVertexShader()
    const fragmentShader = this.createFragmentShader()

    if (Pass.logShaders) {
      console.log('='.repeat(debugSeparatorLength))
      console.log(this.constructor.name)
      console.log('-'.repeat(debugSeparatorLength))
      console.log(vertexShader)
      console.log('-'.repeat(debugSeparatorLength))
      console.log(fragmentShader)
    }

    this.programInfo = twgl.createProgramInfo(gl, [
      vertexShader,
      fragmentShader,
    ])

    if (props.frameBuffer) {
      this.frameBufferInfo = twgl.createFramebufferInfo(gl, [props.frameBuffer])
    } else {
      this.frameBufferInfo = null
    }
  }

  private createVertexShader() {
    return /* glsl */ `#version 300 es
     
      in vec2 inPosition;
      in vec2 inTexCoord;
    
      out vec2 texCoord;
     
      void main() {
        gl_Position = vec4(inPosition, 0, 1);
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
    if (this.props.uniforms) {
      twgl.setUniforms(this.programInfo, this.props.uniforms)
    }
    twgl.drawBufferInfo(this.gl, this.bufferInfo)
  }

  readPixel(x: number, y: number, dstData: ArrayBufferView | null) {
    this.gl.bindFramebuffer(
      this.gl.FRAMEBUFFER,
      this.frameBufferInfo?.framebuffer ?? null
    )
    this.gl.readPixels(x, y, 1, 1, this.gl.RGBA, this.gl.FLOAT, dstData)
  }

  get texture() {
    return this.frameBufferInfo?.attachments[0] as WebGLTexture
  }
}
