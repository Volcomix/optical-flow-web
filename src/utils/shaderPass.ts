import * as twgl from 'twgl.js'

const debugSeparatorLength = 80

export type ShaderPassProps<
  T extends string,
  U extends Record<string, unknown>,
> = {
  uniforms: U extends Record<string, never>
    ? Record<T, WebGLTexture>
    : U & Record<T, WebGLTexture>
  frameBuffer?: {
    attachment: twgl.AttachmentOptions
    width: number
    height: number
  }
}

abstract class ShaderPass<
  P,
  T extends string,
  U extends Record<string, unknown> = Record<string, never>,
> {
  static logShaders = false

  private programInfo: twgl.ProgramInfo
  private frameBufferInfo: twgl.FramebufferInfo | null

  constructor(
    private gl: WebGL2RenderingContext,
    private bufferInfo: twgl.BufferInfo,
    protected props: ShaderPassProps<T, U> & P,
  ) {
    const vertexShader = this.createVertexShader()
    const fragmentShader = this.createFragmentShader()

    if (ShaderPass.logShaders) {
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
      this.frameBufferInfo = twgl.createFramebufferInfo(
        gl,
        [props.frameBuffer.attachment],
        props.frameBuffer.width,
        props.frameBuffer.height,
      )
    } else {
      this.frameBufferInfo = null
    }
  }

  private createVertexShader() {
    const position = this.props.frameBuffer
      ? 'inPosition'
      : 'inPosition * vec2(1, -1)'

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
      this.frameBufferInfo?.framebuffer ?? null,
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
      this.frameBufferInfo?.framebuffer ?? null,
    )
    this.gl.readPixels(x, y, 1, 1, this.gl.RGBA, this.gl.FLOAT, dstData)
  }

  get texture() {
    return this.frameBufferInfo?.attachments[0] as WebGLTexture
  }
}

export default ShaderPass
