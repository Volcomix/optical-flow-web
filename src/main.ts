import { GUI } from 'lil-gui'
import Stats from 'stats.js'

import './style.css'

const stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const gui = new GUI()
gui.add(document, 'title')
