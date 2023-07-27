# Optical Flow Web

🚧 **Work In Progress** 🚧

Fast implementation of Gunnar Farnebäck optical flow, running in web browsers and fully accelerated in WebGL (for now) and WebGPU (will come next).

This project aim at implementing flexible APIs to:

- compute the dense polynomial expansion of pixels (to be used for any other need than optical flow calculation)
- compute the dense optical flow (displacement estimation) of the pixels between 2 images (e.g. 2 video frames)
- take as argument any kind of image source including GPU textures to avoid unnecessary CPU/GPU transfer
- provide the results in several ways including GPU textures to avoid unnecessary CPU/GPU transfer
- provide the most lightweight processing that could be plugged to neural networks running in web browsers on GPU
