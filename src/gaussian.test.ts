import { expect, test } from 'vitest'

import gaussian from './gaussian'

test('gaussian', () => {
  expect(gaussian(11, 1.5)).toMatchSnapshot()
})

test('default sigma', () => {
  expect(gaussian(11)).toEqual(gaussian(11, 1.5))
})
