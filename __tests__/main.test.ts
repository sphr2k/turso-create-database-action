/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as tursoApi from '../__fixtures__/turso-api.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@tursodatabase/api', () => tursoApi)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  let mockClient: {
    databases: {
      get: jest.Mock
      create: jest.Mock
      delete: jest.Mock
      createToken: jest.Mock
    }
  }

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks()

    // Set default action inputs
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: 'default',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      const inputs: Record<string, boolean> = {
        replace: false,
        create_database_token: false,
        dry_run: false
      }
      return inputs[name] || false
    })

    // Create mock client
    mockClient = {
      databases: {
        get: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        createToken: jest.fn()
      }
    }

    // Mock createClient to return our mock client
    tursoApi.createClient.mockReturnValue(mockClient as any)

    // Set up default successful responses
    ;(mockClient.databases.create as any).mockResolvedValue({
      hostname: 'test-hostname.turso.io',
      group: 'default'
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Creates a database fork successfully', async () => {
    await run()

    // Verify client was created with correct parameters
    expect(tursoApi.createClient).toHaveBeenCalledWith({
      org: 'test-org',
      token: 'test-token'
    })

    // Verify database was created
    expect(mockClient.databases.create).toHaveBeenCalledWith('new-db', {
      group: 'default',
      seed: {
        type: 'database',
        name: 'existing-db'
      }
    })

    // Verify outputs were set
    expect(core.setOutput).toHaveBeenCalledWith(
      'hostname',
      'test-hostname.turso.io'
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'database_url',
      'libsql://test-hostname.turso.io'
    )
  })

  it('Handles errors gracefully', async () => {
    // Mock a failed database creation
    ;(mockClient.databases.create as any).mockRejectedValue(
      new tursoApi.TursoClientError('Database not found')
    )

    await run()

    // Verify that the action was marked as failed
    expect(core.setFailed).toHaveBeenCalled()
  })

  it('Runs in dry-run mode without making API calls', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: 'default',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'true'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'dry_run'
    })

    await run()

    // Verify no API calls were made
    expect(tursoApi.createClient).not.toHaveBeenCalled()
    expect(mockClient.databases.create).not.toHaveBeenCalled()

    // Verify dry-run messages were logged
    expect(core.info).toHaveBeenCalledWith(
      '🔍 DRY RUN MODE - No actual API calls will be made'
    )
    expect(core.info).toHaveBeenCalledWith(
      '✓ Dry-run completed - all inputs validated'
    )

    // Verify no outputs were set
    expect(core.setOutput).not.toHaveBeenCalled()
  })

  it('Shows group resolution message in dry-run when group not provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '', // Not provided
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'true'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'dry_run'
    })

    await run()

    expect(core.info).toHaveBeenCalledWith(
      '  Group: (would be fetched from existing-db)'
    )
  })

  it('Shows replace operation in dry-run mode', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: 'default',
        replace: 'true',
        create_database_token: 'false',
        dry_run: 'true'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'dry_run' || name === 'replace'
    })

    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("Replace: Would check if 'new-db' exists")
    )
  })

  it('Shows token creation in dry-run mode', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: 'default',
        replace: 'false',
        create_database_token: 'true',
        dry_run: 'true'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'dry_run' || name === 'create_database_token'
    })

    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Create token: Would create authentication token')
    )
  })

  it('Fetches group name when not provided', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '', // Not provided
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'fetched-group'
    })

    await run()

    // Verify group was fetched
    expect(mockClient.databases.get).toHaveBeenCalledWith('existing-db')
    expect(core.info).toHaveBeenCalledWith(
      'Fetching group information for database: existing-db'
    )
    expect(core.info).toHaveBeenCalledWith('Found group: fetched-group')

    // Verify database was created with fetched group
    expect(mockClient.databases.create).toHaveBeenCalledWith('new-db', {
      group: 'fetched-group',
      seed: {
        type: 'database',
        name: 'existing-db'
      }
    })
  })

  it('Handles error when fetching group name', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })
    ;(mockClient.databases.get as any).mockRejectedValue(
      new tursoApi.TursoClientError('Database not found')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to fetch database: Database not found'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles Error instance when fetching group name', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })
    ;(mockClient.databases.get as any).mockRejectedValue(
      new Error('Network error')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to fetch database: Network error'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles missing group in database response', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      // No group property
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Group name not found in existing database response'
    )
  })

  it('Deletes existing database when replace is enabled', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })

    // Mock that database exists
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'default'
    })
    ;(mockClient.databases.delete as any).mockResolvedValue(undefined)

    await run()

    // Verify database was checked and deleted
    expect(mockClient.databases.get).toHaveBeenCalledWith('new-db')
    expect(mockClient.databases.delete).toHaveBeenCalledWith('new-db')
    expect(core.info).toHaveBeenCalledWith(
      "✓ Successfully deleted existing database fork 'new-db'"
    )

    // Verify database was then created
    expect(mockClient.databases.create).toHaveBeenCalled()
  })

  it('Skips deletion when database does not exist (404)', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })

    // Mock 404 error
    ;(mockClient.databases.get as any).mockRejectedValue(
      new tursoApi.TursoClientError('404 Not Found')
    )

    await run()

    // Verify deletion was not attempted
    expect(mockClient.databases.delete).not.toHaveBeenCalled()
    expect(core.info).toHaveBeenCalledWith(
      "Database fork 'new-db' does not exist, skipping deletion"
    )

    // Verify database was still created
    expect(mockClient.databases.create).toHaveBeenCalled()
  })

  it('Fails when error checking database existence (non-404)', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })

    // Mock non-404 error
    ;(mockClient.databases.get as any).mockRejectedValue(
      new tursoApi.TursoClientError('Server error')
    )

    await run()

    // Verify action failed and creation did not proceed
    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to check if database fork exists: Server error'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Fails when Error instance checking database existence', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })

    // Mock Error instance (not TursoClientError)
    ;(mockClient.databases.get as any).mockRejectedValue(
      new Error('Network timeout')
    )

    await run()

    // Verify action failed and creation did not proceed
    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to check if database fork exists: Network timeout'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles error when deleting existing database', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'default'
    })
    ;(mockClient.databases.delete as any).mockRejectedValue(
      new tursoApi.TursoClientError('Delete failed')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to delete existing database fork: Delete failed'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles Error instance when deleting existing database', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'default'
    })
    ;(mockClient.databases.delete as any).mockRejectedValue(
      new Error('Delete network error')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to delete existing database fork: Delete network error'
    )
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles database creation error with replace=false', async () => {
    ;(mockClient.databases.create as any).mockRejectedValue(
      new tursoApi.TursoClientError('Database already exists')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      "Failed to create database fork: Database already exists Database fork 'new-db' may already exist. Set 'replace: true' to overwrite it, or use a different name."
    )
  })

  it('Handles Error instance when creating database', async () => {
    ;(mockClient.databases.create as any).mockRejectedValue(
      new Error('Network error during creation')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to create database fork: Network error during creation'
    )
  })

  it('Handles database creation error with replace=true', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'default'
    })
    ;(mockClient.databases.delete as any).mockResolvedValue(undefined)
    ;(mockClient.databases.create as any).mockRejectedValue(
      new tursoApi.TursoClientError('Creation failed')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      "Failed to create database fork: Creation failed Database fork 'new-db' still exists after deletion attempt. Please check manually."
    )
  })

  it('Handles missing hostname in response', async () => {
    ;(mockClient.databases.create as any).mockResolvedValue({
      // No hostname
      group: 'default'
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Hostname not found in response'
    )
    expect(core.setOutput).not.toHaveBeenCalled()
  })

  it('Handles uppercase Hostname in response', async () => {
    ;(mockClient.databases.create as any).mockResolvedValue({
      Hostname: 'test-hostname.turso.io', // Uppercase H
      group: 'default'
    })

    await run()

    // Verify outputs were set using the uppercase Hostname
    expect(core.setOutput).toHaveBeenCalledWith(
      'hostname',
      'test-hostname.turso.io'
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'database_url',
      'libsql://test-hostname.turso.io'
    )
  })

  it('Creates database token when requested', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'create_database_token'
    })
    ;(mockClient.databases.createToken as any).mockResolvedValue({
      jwt: 'test-jwt-token'
    })

    await run()

    expect(mockClient.databases.createToken).toHaveBeenCalledWith('new-db')
    expect(core.setSecret).toHaveBeenCalledWith('test-jwt-token')
    expect(core.setOutput).toHaveBeenCalledWith(
      'database_token',
      'test-jwt-token'
    )
    expect(core.info).toHaveBeenCalledWith(
      'Database token created successfully'
    )
  })

  it('Handles error when creating database token', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'create_database_token'
    })
    ;(mockClient.databases.createToken as any).mockRejectedValue(
      new tursoApi.TursoClientError('Token creation failed')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to create database token: Token creation failed'
    )
  })

  it('Handles Error instance when creating database token', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'create_database_token'
    })
    ;(mockClient.databases.createToken as any).mockRejectedValue(
      new Error('Token network error')
    )

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to create database token: Token network error'
    )
  })

  it('Handles missing token in response', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'create_database_token'
    })
    ;(mockClient.databases.createToken as any).mockResolvedValue({
      // No jwt property
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Token not found in response')
  })

  it('Validates replace requires existing_database_name', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: '', // Missing
        new_database_name: 'new-db',
        group_name: 'default',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })

    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'The replace option can only be used when existing_database_name is provided to prevent accidental database deletion.'
    )
    expect(tursoApi.createClient).not.toHaveBeenCalled()
  })

  it('Handles top-level error', async () => {
    core.getInput.mockImplementation(() => {
      throw new Error('Input error')
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Input error')
  })

  it('Handles top-level unknown error', async () => {
    core.getInput.mockImplementation(() => {
      throw 'String error' // Not an Error instance
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Unknown error occurred')
  })

  it('Handles unknown error type', async () => {
    ;(mockClient.databases.create as any).mockRejectedValue('Unknown error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to create database fork: Unknown error'
    )
  })

  it('Handles non-Error error when checking database existence', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })
    ;(mockClient.databases.get as any).mockRejectedValue('String error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to check if database fork exists: Unknown error'
    )
    // Should not continue with creation
    expect(mockClient.databases.create).not.toHaveBeenCalled()
  })

  it('Handles non-Error error when deleting database', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'replace'
    })
    ;(mockClient.databases.get as any).mockResolvedValue({
      group: 'default'
    })
    ;(mockClient.databases.delete as any).mockRejectedValue('String error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to delete existing database fork: Unknown error'
    )
  })

  it('Handles non-Error error when creating token', async () => {
    core.getBooleanInput.mockImplementation((name: string) => {
      return name === 'create_database_token'
    })
    ;(mockClient.databases.createToken as any).mockRejectedValue('String error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to create database token: Unknown error'
    )
  })

  it('Handles non-Error error when fetching group', async () => {
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        organization_name: 'test-org',
        api_token: 'test-token',
        existing_database_name: 'existing-db',
        new_database_name: 'new-db',
        group_name: '',
        replace: 'false',
        create_database_token: 'false',
        dry_run: 'false'
      }
      return inputs[name] || ''
    })
    ;(mockClient.databases.get as any).mockRejectedValue('String error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to fetch database: Unknown error'
    )
  })
})
