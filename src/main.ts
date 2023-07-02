import { Controller, GUI } from 'lil-gui'
import Stats from 'stats.js'

import { PolynomialExpansionResult } from './polynomialExpansion'
import { Pass } from './polynomialExpansion/passes/pass'

import './style.css'

const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const gui = new GUI()

let updatesEnabled = true

const config = {
  x: 585,
  y: 387,
  kernelSize: 11,
  logShaders: true,
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
    folder.add(array, `${i}`).disable()
  )
}

const kernSizes = Array.from({ length: 49 }, (_, i) => i * 2 + 3)

const x = gui.add(config, 'x', 0).step(1)
const y = gui.add(config, 'y', 0).step(1)
const kernelSize = gui.add(config, 'kernelSize', kernSizes).name('kernel size')
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
  markedPoint.style.width = `${config.kernelSize}px`
  markedPoint.style.height = `${config.kernelSize}px`
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

const canvas = document.querySelector('canvas')
if (!canvas) {
  throw new Error('Canvas not found')
}

const { default: polynomialExpansion } = await import('./polynomialExpansion')

let result: PolynomialExpansionResult
const pixelData = new Float32Array(4)

const readPixel = (pass: Pass, controllers: Controller[], offset = 0) => {
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
  updateMarkedPoint()
  readPixel(result.correlationXPass, correlX)
  readPixel(result.correlationY14Pass, correlY)
  readPixel(result.correlationY56Pass, correlY, 4)
  readPixel(result.coefficients14Pass, coeffs)
  readPixel(result.coefficients56Pass, coeffs, 4)
}

const computePolynomialExpansion = () => {
  if (!updatesEnabled) {
    return
  }
  result = polynomialExpansion(image, {
    kernelSize: config.kernelSize,
    logShaders: config.logShaders,
  })
  updateDisplay()
}

x.onChange(updateDisplay)
y.onChange(updateDisplay)
kernelSize.onChange(computePolynomialExpansion)
logShaders.onChange(computePolynomialExpansion)
reset.onChange(computePolynomialExpansion)

computePolynomialExpansion()
