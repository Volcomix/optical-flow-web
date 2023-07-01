import { GUI } from 'lil-gui'
import Stats from 'stats.js'

const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const gui = new GUI()
gui.add(document, 'title')

const image = document.querySelector('img')
if (!image) {
  throw new Error('Image not found')
}

const canvas = document.querySelector('canvas')
if (!canvas) {
  throw new Error('Canvas not found')
}

const { default: polynomialExpansion } = await import('./polynomialExpansion')
const result = polynomialExpansion(image)

const debugPoint = {
  x: 585,
  y: 387,
}

const log = (message: string, values: number[]) => {
  console.log(
    message,
    values.map((v) => Number((v * 255).toFixed(3)))
  )
}

const pixelData = new Float32Array(4)

result.correlationXPass.readPixel(debugPoint.x, debugPoint.y, pixelData)
log('Separable correlation - x direction', [...pixelData.slice(0, -1)])

result.correlationY14Pass.readPixel(debugPoint.x, debugPoint.y, pixelData)
const correlationY = [...pixelData]
result.correlationY56Pass.readPixel(debugPoint.x, debugPoint.y, pixelData)
correlationY.push(...pixelData.slice(0, 2))
log('Separable correlation - y direction', correlationY)

result.coefficients14Pass.readPixel(debugPoint.x, debugPoint.y, pixelData)
const coefficients = [...pixelData]
result.coefficients56Pass.readPixel(debugPoint.x, debugPoint.y, pixelData)
coefficients.push(...pixelData.slice(0, 2))
log('Resulting coefficients', coefficients)
