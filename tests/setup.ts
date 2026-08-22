import { beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true })
