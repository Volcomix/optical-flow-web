import { Controller, GUI } from 'lil-gui'
import Stats from 'stats.js'
import * as twgl from 'twgl.js'

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

const canvas = document.querySelector('canvas')
if (!canvas) {
  throw new Error('Canvas not found')
}

const { default: polynomialExpansion } = await import('./polynomialExpansion')

let result: PolynomialExpansionResult
const pixelData = new Float32Array(4)

type SignalProps = {
  kernelSize: number
  width: number
  height: number
}

type SignalUniforms = {
  x?: number
  y?: number
}

class Signal extends Pass<SignalProps, 'signal', SignalUniforms> {
  set x(value: number) {
    this.props.uniforms.x = value
  }

  set y(value: number) {
    this.props.uniforms.y = value
  }

  protected createFragmentShader() {
    const n = ((this.props.kernelSize - 1) / 2).toFixed(1)

    const texelWidth = 1 / this.props.width
    const texelHeight = 1 / this.props.height
    const kernelSize = this.props.kernelSize.toFixed(1)

    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D signal;
      uniform float x;
      uniform float y;

      in vec2 texCoord;

      out vec4 result;

      void main() {
        vec2 texelSize = vec2(${texelWidth}, ${texelHeight});
        vec2 signalCoord = vec2(x, y);
        vec2 kernelCoord = vec2(texCoord * ${kernelSize} - ${n});
        result = vec4(texture(signal, (signalCoord + kernelCoord) * texelSize).r);
      }
    `
  }
}

type ProjectionProps = {
  kernelSize: number
}

type ProjectionUniforms = {
  x?: number
  y?: number
}

class Projection extends Pass<
  ProjectionProps,
  'coefficients14' | 'coefficients56',
  ProjectionUniforms
> {
  set x(value: number) {
    this.props.uniforms.x = value
  }

  set y(value: number) {
    this.props.uniforms.y = value
  }

  protected createFragmentShader() {
    const n = ((this.props.kernelSize - 1) / 2).toFixed(1)
    const kernelSize = this.props.kernelSize.toFixed(1)

    return /* glsl */ `#version 300 es

      precision highp float;

      uniform sampler2D coefficients14;
      uniform sampler2D coefficients56;
      uniform int x;
      uniform int y;

      in vec2 texCoord;

      out vec4 result;

      void main() {
        ivec2 signalCoord = ivec2(x, y);
        vec2 kernelCoord = texCoord * ${kernelSize} - ${n};

        result = vec4(
          dot(texelFetch(coefficients14, signalCoord, 0), vec4(
            1,
            kernelCoord.x,
            kernelCoord.y,
            kernelCoord.x * kernelCoord.x
          )) +
          dot(texelFetch(coefficients56, signalCoord, 0).rg, vec2(
            kernelCoord.y * kernelCoord.y,
            kernelCoord.x * kernelCoord.y
          ))
        );
      }
    `
  }
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
  inPosition: [0, -1, 0, 1, -1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0],
  inTexCoord: [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1],
}
const projectionBuffInfo = twgl.createBufferInfoFromArrays(gl, projectionArrays)
let projection: Projection

const readPixel = <P, T extends string>(
  pass: Pass<P, T>,
  controllers: Controller[],
  offset = 0
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

  gl.viewport(0, 0, canvas.width, canvas.height)

  signal.x = config.x
  signal.y = config.y
  signal.render()

  projection.x = config.x
  projection.y = config.y
  projection.render()

  updateMarkedPoint()

  readPixel(result.correlationX, correlX)
  readPixel(result.correlationY14, correlY)
  readPixel(result.correlationY56, correlY, 4)
  readPixel(result.coefficients14, coeffs)
  readPixel(result.coefficients56, coeffs, 4)
}

const computePolynomialExpansion = () => {
  if (!updatesEnabled) {
    return
  }

  result = polynomialExpansion(image, {
    canvas,
    kernelSize: config.kernelSize,
    logShaders: config.logShaders,
  })

  canvas.width = config.kernelSize * 2
  canvas.height = config.kernelSize

  signal = new Signal(gl, signalBuffInfo, {
    kernelSize: config.kernelSize,
    width: image.naturalWidth,
    height: image.naturalHeight,
    uniforms: { signal: result.intensity.texture },
  })

  projection = new Projection(gl, projectionBuffInfo, {
    kernelSize: config.kernelSize,
    uniforms: {
      coefficients14: result.coefficients14.texture,
      coefficients56: result.coefficients56.texture,
    },
  })

  updateDisplay()
}

x.onChange(updateDisplay)
y.onChange(updateDisplay)
kernelSize.onChange(computePolynomialExpansion)
logShaders.onChange(computePolynomialExpansion)
reset.onChange(computePolynomialExpansion)

computePolynomialExpansion()
