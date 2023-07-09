import { Controller, GUI } from 'lil-gui'
import Stats from 'stats.js'
import * as twgl from 'twgl.js'

import type PolynomialExpansionClass from '../polynomialExpansion'
import ShaderPass from '../utils/shaderPass'

import Projection from './shaders/projection'
import Renormalize from './shaders/renormalize'
import Signal from './shaders/signal'

import './demo.css'

const stats = new Stats()
stats.showPanel(1)
document.body.appendChild(stats.dom)

const gui = new GUI()

let updatesEnabled = true

const config = {
  x: 585,
  y: 387,
  kernelSize: 11,
  sigma: 1.5,
  precision: 16 as 16 | 32,
  logShaders: false,
  correlX: new Array<number>(3).fill(0),
  correlY: new Array<number>(6).fill(0),
  coeffs: new Array<number>(6).fill(0),
  reset: () => {
    updatesEnabled = false
    gui.reset()
    updatesEnabled = true
  },
}

const addControllers = (parent: GUI, title: string, array: number[]) => {
  const folder = parent.addFolder(title)
  return Array.from({ length: array.length }, (_, i) =>
    folder.add(array, `${i}`).disable(),
  )
}

const kernSizes = Array.from({ length: 49 }, (_, i) => i * 2 + 3)

const x = gui.add(config, 'x', 0).step(1)
const y = gui.add(config, 'y', 0).step(1)
const kernelSize = gui.add(config, 'kernelSize', kernSizes).name('kernel size')
const sigma = gui.add(config, 'sigma')
const precision = gui.add(config, 'precision', { '16 bits': 16, '32 bits': 32 })
const logShaders = gui.add(config, 'logShaders').name('log shaders')
const reset = gui.add(config, 'reset')
const correlFolder = gui.addFolder('Separable correlation')
const correlX = addControllers(correlFolder, 'x direction', config.correlX)
const correlY = addControllers(correlFolder, 'y direction', config.correlY)
const coeffs = addControllers(gui, 'Resulting coefficients', config.coeffs)

const image = document.querySelector('img')
if (!image) {
  throw new Error('Image not found')
}

x.max(image.naturalWidth)
y.max(image.naturalHeight)

const markedPoint = document.querySelector<HTMLDivElement>('.marked-point')
if (!markedPoint) {
  throw new Error('Marked point not found')
}

let imageWidth: number
let imageHeight: number
let imageScale: number
let imageMarginHori: number
let imageMarginVert: number

const updateMarkedPoint = () => {
  markedPoint.style.top = `${imageMarginVert + config.y * imageScale}px`
  markedPoint.style.left = `${imageMarginHori + config.x * imageScale}px`
  markedPoint.style.width = `${config.kernelSize * imageScale}px`
  markedPoint.style.height = `${config.kernelSize * imageScale}px`
}

new ResizeObserver((entries) => {
  for (const entry of entries) {
    const [contentBoxSize] = entry.contentBoxSize
    imageWidth = contentBoxSize.inlineSize
    imageHeight = contentBoxSize.blockSize

    const aspectRatio = imageWidth / imageHeight
    const naturalAspectRatio = image.naturalWidth / image.naturalHeight

    if (aspectRatio < naturalAspectRatio) {
      imageScale = imageWidth / image.naturalWidth
      imageMarginVert = (imageHeight - image.naturalHeight * imageScale) / 2
      imageMarginHori = 0
    } else {
      imageScale = imageHeight / image.naturalHeight
      imageMarginVert = 0
      imageMarginHori = (imageWidth - image.naturalWidth * imageScale) / 2
    }

    updateMarkedPoint()
  }
}).observe(image)

const handleImageMouseMove = (event: MouseEvent) => {
  if (
    !(event.buttons & 1) ||
    event.clientX < imageMarginHori ||
    event.clientX > imageWidth - imageMarginHori ||
    event.clientY < imageMarginVert ||
    event.clientY > imageHeight - imageMarginVert
  ) {
    return
  }

  x.setValue(Math.round((event.clientX - imageMarginHori) / imageScale))
  y.setValue(Math.round((event.clientY - imageMarginVert) / imageScale))
}

image.onmousedown = handleImageMouseMove
image.onmousemove = handleImageMouseMove

const { default: PolynomialExpansion } = await import('../polynomialExpansion')

const canvas = document.querySelector('canvas')
if (!canvas) {
  throw new Error('Canvas not found')
}

const gl = canvas.getContext('webgl2')
if (!gl) {
  throw new Error('WebGL 2 is not available')
}

const signalArrays = {
  inPosition: [-1, -1, 0, 0, -1, 0, -1, 1, 0, -1, 1, 0, 0, -1, 0, 0, 1, 0],
  inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
}
const signalBuffInfo = twgl.createBufferInfoFromArrays(gl, signalArrays)
let signal: Signal

const projectionArrays = {
  inPosition: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
}
const projectionBuffInfo = twgl.createBufferInfoFromArrays(gl, projectionArrays)
let projection: Projection

const renormArrays = {
  inPosition: [0, -1, 0, 1, -1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0],
  inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
}
const renormBufferInfo = twgl.createBufferInfoFromArrays(gl, renormArrays)
let renormalize: Renormalize

let polynomialExpansion: PolynomialExpansionClass
const pixelData = new Float32Array(4)

const readPixel = <P, T extends string>(
  pass: ShaderPass<P, T>,
  controllers: Controller[],
  offset = 0,
) => {
  pass.readPixel(config.x, config.y, pixelData)
  const n = Math.min(4, controllers.length - offset)
  for (let i = 0; i < n; i++) {
    controllers[i + offset].setValue(pixelData[i] * 255)
  }
}

const updateDisplay = () => {
  if (!updatesEnabled) {
    return
  }

  gl.viewport(0, 0, config.kernelSize, config.kernelSize)

  projection.x = config.x
  projection.y = config.y
  projection.render()

  gl.viewport(0, 0, canvas.width, canvas.height)

  signal.x = config.x
  signal.y = config.y
  signal.render()

  gl.bindTexture(gl.TEXTURE_2D, projection.texture)
  gl.generateMipmap(gl.TEXTURE_2D)

  renormalize.render()

  updateMarkedPoint()

  readPixel(polynomialExpansion.correlationX, correlX)
  readPixel(polynomialExpansion.correlationY14, correlY)
  readPixel(polynomialExpansion.correlationY56, correlY, 4)
  readPixel(polynomialExpansion.coefficients14, coeffs)
  readPixel(polynomialExpansion.coefficients56, coeffs, 4)
}

const computePolynomialExpansion = () => {
  if (!updatesEnabled) {
    return
  }

  canvas.width = config.kernelSize * 2
  canvas.height = config.kernelSize

  polynomialExpansion = new PolynomialExpansion(image, {
    canvas,
    width: image.naturalWidth,
    height: image.naturalHeight,
    kernelSize: config.kernelSize,
    sigma: config.sigma,
    precision: config.precision,
    logShaders: config.logShaders,
  })

  signal = new Signal(gl, signalBuffInfo, {
    kernelSize: config.kernelSize,
    width: image.naturalWidth,
    height: image.naturalHeight,
    uniforms: { signal: polynomialExpansion.intensity.texture },
  })

  projection = new Projection(gl, projectionBuffInfo, {
    kernelSize: config.kernelSize,
    uniforms: {
      coefficients14: polynomialExpansion.coefficients14.texture,
      coefficients56: polynomialExpansion.coefficients56.texture,
    },
    frameBuffer: {
      attachment: { internalFormat: gl.RG32F, min: gl.NEAREST_MIPMAP_NEAREST },
      width: config.kernelSize,
      height: config.kernelSize,
    },
  })

  renormalize = new Renormalize(gl, renormBufferInfo, {
    uniforms: { projection: projection.texture },
  })

  stats.begin()
  polynomialExpansion.update()
  stats.end()
  updateDisplay()
}

x.onChange(updateDisplay)
y.onChange(updateDisplay)
kernelSize.onChange(() => sigma.setValue(0.15 * (config.kernelSize - 1)))
sigma.onChange(computePolynomialExpansion)
precision.onChange(computePolynomialExpansion)
logShaders.onChange(computePolynomialExpansion)
reset.onChange(computePolynomialExpansion)

computePolynomialExpansion()
