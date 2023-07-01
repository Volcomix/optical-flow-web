import { inv } from 'mathjs'
import * as twgl from 'twgl.js'

import gaussian from '../gaussian'

import { Coefficients14Pass } from './passes/coefficients14'
import { Coefficients56Pass } from './passes/coefficients56'
import { CorrelationXPass } from './passes/correlationX'
import { CorrelationY14Pass } from './passes/correlationY14'
import { CorrelationY56Pass } from './passes/correlationY56'
import { IntensityPass } from './passes/intensity'
import { Kernels } from './types'

export type PolynomialExpansionOptions = {
  canvas?: HTMLCanvasElement

  /** @default 11 */
  kernelSize?: number

  /** @default 0.15 * (kernelSize - 1) */
  sigma?: number
}

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

  const intensityPass = new IntensityPass(gl, bufferInfo, {
    lumaTransformRec: 601,
    uniforms: { signal: textures.signal },
    frameBuffer: { internalFormat: gl.R8 },
  })
  const correlationXPass = new CorrelationXPass(gl, bufferInfo, {
    kernels,
    width: canvas.width,
    uniforms: { signal: intensityPass.texture },
    frameBuffer: { internalFormat: gl.RGBA32F },
  })
  const correlationY14Pass = new CorrelationY14Pass(gl, bufferInfo, {
    kernels,
    height: canvas.height,
    uniforms: { correlation: correlationXPass.texture },
    frameBuffer: { internalFormat: gl.RGBA32F },
  })
  const correlationY56Pass = new CorrelationY56Pass(gl, bufferInfo, {
    kernels,
    height: canvas.height,
    uniforms: { correlation: correlationXPass.texture },
    frameBuffer: { internalFormat: gl.RGBA32F },
  })
  const coefficients14Pass = new Coefficients14Pass(gl, bufferInfo, {
    invG,
    uniforms: {
      correlation14: correlationY14Pass.texture,
      correlation56: correlationY56Pass.texture,
    },
    frameBuffer: { internalFormat: gl.RGBA32F },
  })
  const coefficients56Pass = new Coefficients56Pass(gl, bufferInfo, {
    invG,
    uniforms: {
      correlation14: correlationY14Pass.texture,
      correlation56: correlationY56Pass.texture,
    },
    frameBuffer: { internalFormat: gl.RGBA32F },
  })

  // Render
  gl.viewport(0, 0, canvas.width, canvas.height)

  intensityPass.render()
  correlationXPass.render()
  correlationY14Pass.render()
  correlationY56Pass.render()
  coefficients14Pass.render()
  coefficients56Pass.render()

  return {
    intensityPass,
    correlationXPass,
    correlationY14Pass,
    correlationY56Pass,
    coefficients14Pass,
    coefficients56Pass,
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
