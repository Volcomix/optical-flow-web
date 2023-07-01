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
polynomialExpansion(image, { canvas })
