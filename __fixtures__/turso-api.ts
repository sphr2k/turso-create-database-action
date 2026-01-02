import { jest } from '@jest/globals'

// TursoClientError class for testing
// Note: The actual package doesn't export this in the JS bundle,
// but we use it in tests and check by name in the actual code
export class TursoClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TursoClientError'
  }
}

export const createClient = jest.fn()
