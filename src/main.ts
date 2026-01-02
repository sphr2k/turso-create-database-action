import * as core from '@actions/core'
import { createClient } from '@tursodatabase/api'

// Helper to check if error is a TursoClientError
// Note: TursoClientError is not exported in the JS bundle, so we check by name
function isTursoClientError(error: unknown): error is Error & { name: string } {
  return (
    error instanceof Error &&
    (error as Error & { name?: string }).name === 'TursoClientError'
  )
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get all inputs
    const organizationName = core.getInput('organization_name', {
      required: true
    })
    const apiToken = core.getInput('api_token', { required: true })
    const existingDatabaseName = core.getInput('existing_database_name', {
      required: true
    })
    const newDatabaseName = core.getInput('new_database_name', {
      required: true
    })
    const groupName = core.getInput('group_name')
    const replace = core.getBooleanInput('replace')
    const createDatabaseToken = core.getBooleanInput('create_database_token')
    const dryRun = core.getBooleanInput('dry_run')

    // Validate that replace can only be used when existing_database_name is provided
    if (replace && !existingDatabaseName) {
      core.setFailed(
        'The replace option can only be used when existing_database_name is provided to prevent accidental database deletion.'
      )
      return
    }

    // Dry-run mode: show what would happen without making API calls
    if (dryRun) {
      core.info('🔍 DRY RUN MODE - No actual API calls will be made')
      core.info('')
      core.info('Planned operations:')
      core.info(`  Organization: ${organizationName}`)
      core.info(`  Source database: ${existingDatabaseName}`)
      core.info(`  Target database: ${newDatabaseName}`)
      if (groupName) {
        core.info(`  Group: ${groupName}`)
      } else {
        core.info(`  Group: (would be fetched from ${existingDatabaseName})`)
      }
      if (replace) {
        core.info(
          `  Replace: Would check if '${newDatabaseName}' exists and delete if found`
        )
      }
      core.info(
        `  Create database: Would create '${newDatabaseName}' seeded from '${existingDatabaseName}'`
      )
      if (createDatabaseToken) {
        core.info(
          `  Create token: Would create authentication token for '${newDatabaseName}'`
        )
      }
      core.info('')
      core.info('✓ Dry-run completed - all inputs validated')
      core.info('⚠️  No outputs will be set in dry-run mode')
      return
    }

    // Initialize Turso client
    const client = createClient({
      org: organizationName,
      token: apiToken
    })

    // Resolve group name if not provided
    let resolvedGroupName = groupName
    if (!resolvedGroupName) {
      core.info(
        `Fetching group information for database: ${existingDatabaseName}`
      )
      try {
        const existingDb = await client.databases.get(existingDatabaseName)
        if (!existingDb.group) {
          core.setFailed('Group name not found in existing database response')
          return
        }
        resolvedGroupName = existingDb.group
        core.info(`Found group: ${resolvedGroupName}`)
      } catch (error) {
        if (isTursoClientError(error)) {
          core.setFailed(`Failed to fetch database: ${error.message}`)
        } else if (error instanceof Error) {
          core.setFailed(`Failed to fetch database: ${error.message}`)
        } else {
          core.setFailed('Failed to fetch database: Unknown error')
        }
        return
      }
    }

    // Check and delete existing database fork if replace is enabled
    if (replace) {
      core.info(`Checking if database fork '${newDatabaseName}' exists...`)
      try {
        await client.databases.get(newDatabaseName)
        // Database exists, proceed with deletion
        core.info(`Database fork '${newDatabaseName}' exists, deleting...`)
        try {
          await client.databases.delete(newDatabaseName)
          core.info(
            `✓ Successfully deleted existing database fork '${newDatabaseName}'`
          )
        } catch (error) {
          if (isTursoClientError(error)) {
            core.setFailed(
              `Failed to delete existing database fork: ${error.message}`
            )
          } else if (error instanceof Error) {
            core.setFailed(
              `Failed to delete existing database fork: ${error.message}`
            )
          } else {
            core.setFailed(
              'Failed to delete existing database fork: Unknown error'
            )
          }
          return
        }
      } catch (error) {
        if (isTursoClientError(error)) {
          // Check if it's a 404 (database doesn't exist)
          const errorMsg = error.message.toLowerCase()
          if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            core.info(
              `Database fork '${newDatabaseName}' does not exist, skipping deletion`
            )
          } else {
            // Non-404 errors indicate a real problem (auth, network, etc.)
            // Fail rather than continue to avoid masking issues
            core.setFailed(
              `Failed to check if database fork exists: ${error.message}`
            )
            return
          }
        } else if (error instanceof Error) {
          core.setFailed(
            `Failed to check if database fork exists: ${error.message}`
          )
          return
        } else {
          core.setFailed(
            'Failed to check if database fork exists: Unknown error'
          )
          return
        }
      }
    }

    // Create database fork
    core.info(
      `Creating database fork '${newDatabaseName}' in group '${resolvedGroupName}' from seed '${existingDatabaseName}'`
    )
    let createdDatabase
    try {
      createdDatabase = await client.databases.create(newDatabaseName, {
        group: resolvedGroupName,
        seed: {
          type: 'database',
          name: existingDatabaseName
        }
      })
    } catch (error) {
      if (isTursoClientError(error)) {
        const errorMsg = error.message
        let failureMessage = `Failed to create database fork: ${errorMsg}`
        if (!replace) {
          failureMessage += ` Database fork '${newDatabaseName}' may already exist. Set 'replace: true' to overwrite it, or use a different name.`
        } else {
          failureMessage += ` Database fork '${newDatabaseName}' still exists after deletion attempt. Please check manually.`
        }
        core.setFailed(failureMessage)
      } else if (error instanceof Error) {
        core.setFailed(`Failed to create database fork: ${error.message}`)
      } else {
        core.setFailed('Failed to create database fork: Unknown error')
      }
      return
    }

    // Handle both lowercase and uppercase hostname property names
    const hostname =
      createdDatabase.hostname ||
      (createdDatabase as { Hostname?: string }).Hostname
    if (!hostname) {
      core.setFailed('Hostname not found in response')
      return
    }

    const databaseUrl = `libsql://${hostname}`

    core.setOutput('hostname', hostname)
    core.setOutput('database_url', databaseUrl)

    // Create database token if requested
    if (createDatabaseToken) {
      core.info(
        `Creating authentication token for database: ${newDatabaseName}`
      )
      try {
        const token = await client.databases.createToken(newDatabaseName)
        if (!token.jwt) {
          core.setFailed('Token not found in response')
          return
        }

        // Mask the token in logs for security
        core.setSecret(token.jwt)

        core.info('Database token created successfully')
        core.setOutput('database_token', token.jwt)
      } catch (error) {
        if (isTursoClientError(error)) {
          core.setFailed(`Failed to create database token: ${error.message}`)
        } else if (error instanceof Error) {
          core.setFailed(`Failed to create database token: ${error.message}`)
        } else {
          core.setFailed('Failed to create database token: Unknown error')
        }
        return
      }
    }

    core.info('✓ Database fork created successfully')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error occurred')
    }
  }
}
