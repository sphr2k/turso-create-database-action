import { jest } from '@jest/globals'

export class TursoClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TursoClientError'
  }
}

export const createClient = jest.fn()