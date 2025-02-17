import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}

if (typeof global !== 'undefined') {
  global.Buffer = Buffer
}

export default Buffer 