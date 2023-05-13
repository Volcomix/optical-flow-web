const gaussian = (kernelSize: number, sigma = 0.15 * (kernelSize - 1)) => {
  const result: number[] = []
  const n = (kernelSize - 1) / 2
  for (let i = -n; i <= n; i++) {
    result.push(Math.exp((-0.5 * i ** 2) / sigma ** 2))
  }
  return result
}

export default gaussian
