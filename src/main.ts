import { GUI } from 'lil-gui'
import Stats from 'stats.js'

const config = {
  x: 585,
  y: 387,
  correlationX: new Array(3).fill(0),
  correlationY: new Array(6).fill(0),
  coefficients: new Array(6).fill(0),
}

const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const gui = new GUI()

const xController = gui.add(config, 'x', 0).step(1)
const yController = gui.add(config, 'y', 0).step(1)

const separableCorrelationFolder = gui.addFolder('Separable correlation')
const correlationXFolder = separableCorrelationFolder.addFolder('x direction')
const correlationXControllers = Array.from({ length: 3 }, (_, i) =>
  correlationXFolder.add(config.correlationX, `${i}`).disable()
)
const correlationYFolder = separableCorrelationFolder.addFolder('y direction')
const correlationYControllers = Array.from({ length: 6 }, (_, i) =>
  correlationYFolder.add(config.correlationY, `${i}`).disable()
)

const coefficientsFolder = gui.addFolder('Resulting coefficients')
const coefficientsControllers = Array.from({ length: 6 }, (_, i) =>
  coefficientsFolder.add(config.coefficients, `${i}`).disable()
)

const image = document.querySelector('img')
if (!image) {
  throw new Error('Image not found')
}

xController.max(image.naturalWidth)
yController.max(image.naturalHeight)

const canvas = document.querySelector('canvas')
if (!canvas) {
  throw new Error('Canvas not found')
}

const { default: polynomialExpansion } = await import('./polynomialExpansion')
const result = polynomialExpansion(image)

const pixelData = new Float32Array(4)

const readPixel = () => {
  result.correlationXPass.readPixel(config.x, config.y, pixelData)
  for (let i = 0; i < 3; i++) {
    correlationXControllers[i].setValue(pixelData[i] * 255)
  }
  result.correlationY14Pass.readPixel(config.x, config.y, pixelData)
  for (let i = 0; i < 4; i++) {
    correlationYControllers[i].setValue(pixelData[i] * 255)
  }
  result.correlationY56Pass.readPixel(config.x, config.y, pixelData)
  for (let i = 0; i < 2; i++) {
    correlationYControllers[i + 4].setValue(pixelData[i] * 255)
  }
  result.coefficients14Pass.readPixel(config.x, config.y, pixelData)
  for (let i = 0; i < 4; i++) {
    coefficientsControllers[i].setValue(pixelData[i] * 255)
  }
  result.coefficients56Pass.readPixel(config.x, config.y, pixelData)
  for (let i = 0; i < 2; i++) {
    coefficientsControllers[i + 4].setValue(pixelData[i] * 255)
  }
}

xController.onChange(readPixel)
yController.onChange(readPixel)
readPixel()
