import { inv } from 'mathjs'
import * as twgl from 'twgl.js'

import gaussian from '../gaussian'
import ShaderPass from '../utils/shaderPass'

import Coefficients14 from './shaders/coefficients14'
import Coefficients56 from './shaders/coefficients56'
import CorrelationX from './shaders/correlationX'
import CorrelationY14 from './shaders/correlationY14'
import CorrelationY56 from './shaders/correlationY56'
import Intensity, { LumaTransformRec } from './shaders/intensity'
import { Kernels } from './types'

export type Precision = 16 | 32
export type IntensityPrecision = 8 | 16 | 32

export type IntensityOptions = {
  /** @default 709 */
  lumaTransformRec?: LumaTransformRec

  /** @default PolynomialExpansionOptions.precision */
  precision?: IntensityPrecision
}

export type PolynomialExpansionWithCanvasOptions = {
  canvas: HTMLCanvasElement | OffscreenCanvas

  /** @default canvas.width */
  width?: number

  /** @default canvas.height */
  height?: number
} & PolynomialExpansionCommonOptions

export type PolynomialExpansionWithoutCanvasOptions = {
  width: number
  height: number
} & PolynomialExpansionCommonOptions

// TODO Option to remove intermediate passes
export type PolynomialExpansionCommonOptions = {
  /** @default 11 */
  kernelSize?: number

  /** @default 0.15 * (kernelSize - 1) */
  sigma?: number

  /** @default 16 */
  precision?: Precision

  /**
   * Set to `true` (default) or define the IntensityOptions to let
   * this class compute the intensity from a colored RGB(A) signal.
   * Set to `false` if the signal is already made of gray intensity pixels.
   * @default true
   */
  intensity?: boolean | IntensityOptions // TODO Use it

  /** @default false */
  logShaders?: boolean
}

export type PolynomialExpansionOptions =
  | PolynomialExpansionWithCanvasOptions
  | PolynomialExpansionWithoutCanvasOptions

class PolynomialExpansion {
  intensity: Intensity
  correlationX: CorrelationX
  correlationY14: CorrelationY14
  correlationY56: CorrelationY56
  coefficients14: Coefficients14
  coefficients56: Coefficients56

  private gl: WebGL2RenderingContext
  private width: number
  private height: number

  constructor(
    signal: TexImageSource | ArrayBufferView,
    options: PolynomialExpansionOptions,
  ) {
    let canvas: HTMLCanvasElement | OffscreenCanvas
    if ('canvas' in options) {
      canvas = options.canvas
      this.width = options.width ?? canvas.width
      this.height = options.height ?? canvas.height
    } else {
      canvas = new OffscreenCanvas(options.width, options.height)
      this.width = options.width
      this.height = options.height
    }

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL 2 is not available')
    }
    this.gl = gl
    twgl.addExtensionsToContext(gl)

    const applicability = gaussian(options.kernelSize ?? 11, options.sigma)
    const invG = inv(precomputeG(applicability))
    const kernels = precomputeKernels(applicability)

    const arrays = {
      inPosition: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
      inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
    }
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

    const textures = twgl.createTextures(gl, {
      signal: { src: signal },
    })

    ShaderPass.logShaders = options.logShaders ?? false

    let intensityPrecision: IntensityPrecision = options.precision ?? 16
    if (typeof options.intensity === 'object' && options.intensity.precision) {
      intensityPrecision = options.intensity.precision
    }

    const frameBufferSize = {
      width: this.width,
      height: this.height,
    }
    const frameBufferRGBA = {
      attachment: {
        internalFormat: options.precision === 32 ? gl.RGBA32F : gl.RGBA16F,
      },
      ...frameBufferSize,
    }
    const frameBufferRG = {
      attachment: {
        internalFormat: options.precision === 32 ? gl.RG32F : gl.RG16F,
      },
      ...frameBufferSize,
    }

    this.intensity = new Intensity(gl, bufferInfo, {
      lumaTransformRec:
        typeof options.intensity === 'object'
          ? options.intensity.lumaTransformRec
          : undefined,
      uniforms: { signal: textures.signal },
      frameBuffer: {
        attachment: {
          internalFormat:
            intensityPrecision === 32
              ? gl.R32F
              : intensityPrecision === 16
              ? gl.R16F
              : gl.R8,
        },
        ...frameBufferSize,
      },
    })
    this.correlationX = new CorrelationX(gl, bufferInfo, {
      kernels,
      width: this.width,
      uniforms: { signal: this.intensity.texture },
      frameBuffer: frameBufferRGBA,
    })
    this.correlationY14 = new CorrelationY14(gl, bufferInfo, {
      kernels,
      height: this.height,
      uniforms: { correlation: this.correlationX.texture },
      frameBuffer: frameBufferRGBA,
    })
    this.correlationY56 = new CorrelationY56(gl, bufferInfo, {
      kernels,
      height: this.height,
      uniforms: { correlation: this.correlationX.texture },
      frameBuffer: frameBufferRG,
    })
    this.coefficients14 = new Coefficients14(gl, bufferInfo, {
      invG,
      uniforms: {
        correlation14: this.correlationY14.texture,
        correlation56: this.correlationY56.texture,
      },
      frameBuffer: frameBufferRGBA,
    })
    this.coefficients56 = new Coefficients56(gl, bufferInfo, {
      invG,
      uniforms: {
        correlation14: this.correlationY14.texture,
        correlation56: this.correlationY56.texture,
      },
      frameBuffer: frameBufferRG,
    })
  }

  update() {
    this.gl.viewport(0, 0, this.width, this.height)

    this.intensity.render()
    this.correlationX.render()
    this.correlationY14.render()
    this.correlationY56.render()
    this.coefficients14.render()
    this.coefficients56.render()
  }
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

export default PolynomialExpansion

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
