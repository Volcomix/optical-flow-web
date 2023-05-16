import * as twgl from 'twgl.js'

import gaussian from '../gaussian'

// TODO Extract shaders in dedicated files
const vertexShader = /* glsl */ `#version 300 es
 
  in vec2 inPosition;
  in vec2 inTexCoord;

  out vec2 texCoord;
 
  void main() {
    gl_Position = vec4(inPosition, 0, 1);
    texCoord = inTexCoord;
  }
`

const intensityFragmentShader = /* glsl */ `#version 300 es

  precision highp float;

  uniform sampler2D signal;

  in vec2 texCoord;

  out float result;

  void main() {
    result = dot(texture(signal, texCoord), vec4(0.2126, 0.7152, 0.0722, 0));
  }
`

const createFragmentShader = (kernels: Kernels, width: number) => {
  const n = (kernels.x.length - 1) / 2
  const weights = [kernels.one, kernels.x, kernels.x2]

  const correlation = Array.from({ length: kernels.x.length }, (_, i) => {
    const x = i - n
    return `result.rgb += texture(signal, texCoord + vec2(${
      x / width
    }, 0)).r * vec3(${weights
      .map((weight) =>
        weight[i].toLocaleString('en-US', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 20,
        })
      )
      .join(', ')});`
  }).join('\n      ')

  return /* glsl */ `#version 300 es

    precision highp float;

    uniform sampler2D signal;

    in vec2 texCoord;

    out vec4 result;

    void main() {
      result = vec4(0);
      ${correlation}
    }
  `
}

export type PolynomialExpansionOptions = Partial<{
  canvas: HTMLCanvasElement
  kernelSize: number
  sigma: number
}>

// TODO Handle GPU resources disposal
// TODO Optimize convolution with linear sampling
const polynomialExpansion = (
  signal: HTMLImageElement,
  options: PolynomialExpansionOptions = {}
) => {
  let canvas: HTMLCanvasElement | OffscreenCanvas
  if (options.canvas) {
    canvas = options.canvas
    canvas.width = signal.naturalWidth
    canvas.height = signal.naturalHeight
  } else {
    canvas = new OffscreenCanvas(signal.naturalWidth, signal.naturalHeight)
  }

  const gl = canvas.getContext('webgl2')
  if (!gl) {
    throw new Error('WebGL 2 is not available')
  }
  twgl.addExtensionsToContext(gl)

  const applicability = gaussian(options.kernelSize ?? 11, options.sigma)
  const kernels = precomputeKernels(applicability)
  const fragmentShader = createFragmentShader(kernels, canvas.width)
  console.log(fragmentShader)

  const intensityProgramInfo = twgl.createProgramInfo(gl, [
    vertexShader,
    intensityFragmentShader,
  ])
  const programInfo = twgl.createProgramInfo(gl, [vertexShader, fragmentShader])

  const arrays = {
    inPosition: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
  }
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

  const textures = twgl.createTextures(gl, {
    signal: { src: signal },
  })

  const intensityFrameBufferInfo = twgl.createFramebufferInfo(gl, [
    { internalFormat: gl.R16F, type: gl.HALF_FLOAT },
  ])
  const frameBufferInfo = twgl.createFramebufferInfo(gl, [
    { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT },
  ])

  const result = new Float32Array(4)

  // Render
  gl.viewport(0, 0, canvas.width, canvas.height)

  gl.bindFramebuffer(gl.FRAMEBUFFER, intensityFrameBufferInfo.framebuffer)
  gl.useProgram(intensityProgramInfo.program)
  twgl.setBuffersAndAttributes(gl, intensityProgramInfo, bufferInfo)
  twgl.setUniforms(intensityProgramInfo, {
    signal: textures.signal,
  })
  twgl.drawBufferInfo(gl, bufferInfo)

  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBufferInfo.framebuffer)
  gl.useProgram(programInfo.program)
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
  twgl.setUniforms(programInfo, {
    signal: intensityFrameBufferInfo.attachments[0],
  })
  twgl.drawBufferInfo(gl, bufferInfo)

  gl.readPixels(585, 387, 1, 1, gl.RGBA, gl.FLOAT, result)
  console.log([...result.slice(0, -1).map((v) => v * 255)])
}

const precomputeG = (applicability: number[]) => {
  let a = 0
  let b = 0
  let c = 0
  let d = 0

  const n = (applicability.length - 1) / 2

  for (let x = -n; x <= n; x++) {
    for (let y = -n; y <= n; y++) {
      const weight = applicability[x + n] * applicability[y + n]
      a += weight // (a · b1, b1) where 'a' is the applicability and b1 = 1
      b += weight * x * x // (a · b2, b2) where b2 = x
      c += weight * x * x * x * x // (a · b4, b4) where b4 = x²
      d += weight * x * y * x * y // (a · b6, b6) where b6 = xy
    }
  }

  return [
    [a, 0, 0, b, b, 0], // 1
    [0, b, 0, 0, 0, 0], // x
    [0, 0, b, 0, 0, 0], // y
    [b, 0, 0, c, d, 0], // x²
    [b, 0, 0, d, c, 0], // y²
    [0, 0, 0, 0, 0, d], // xy
    //1 x  y  x² y² xy
  ]
}

type Kernels = {
  one: number[]
  x: number[]
  x2: number[]
}

const precomputeKernels = (applicability: number[]) => {
  const kernels: Kernels = { one: [], x: [], x2: [] }
  const n = (applicability.length - 1) / 2
  for (let x = -n; x <= n; x++) {
    const weight = applicability[x + n]
    kernels.one.push(weight)
    kernels.x.push(weight * x)
    kernels.x2.push(weight * x * x)
  }
  return kernels
}

export default polynomialExpansion

if (import.meta.vitest) {
  const { describe, expect, test } = import.meta.vitest

  describe('precomputeG', () => {
    test('simple applicability', () => {
      expect(precomputeG([1, 2, 1])).toEqual([
        [16, 0, 0, 8, 8, 0],
        [0, 8, 0, 0, 0, 0],
        [0, 0, 8, 0, 0, 0],
        [8, 0, 0, 8, 4, 0],
        [8, 0, 0, 4, 8, 0],
        [0, 0, 0, 0, 0, 4],
      ])
    })

    test('larger gaussian', () => {
      expect(precomputeG(gaussian(11))).toMatchSnapshot()
    })
  })

  describe('precomputeKernels', () => {
    test('simple applicability', () => {
      expect(precomputeKernels([1, 2, 1])).toEqual({
        one: [1, 2, 1],
        x: [-1, 0, 1],
        x2: [1, 0, 1],
      })
    })

    test('larger gaussian', () => {
      expect(precomputeKernels(gaussian(11))).toMatchSnapshot()
    })
  })
}
