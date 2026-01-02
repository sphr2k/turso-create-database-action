# Create Turso Database Action

A GitHub Action to automatically create and clone a
[Turso database](https://turso.tech) fork from an existing database.

## Features

- Create database forks (clones) from existing databases
- Automatically resolve group names from existing databases
- Optional database replacement (delete and recreate)
- Optional database authentication token creation
- Full error handling with clear error messages

## Usage

### Basic Example

```yaml
name: Create Database for Branch
on:
  push:
    branches:
      - main

jobs:
  create_database:
    name: 'Create Database Fork'
    runs-on: ubuntu-latest
    steps:
      - name: Create Database Fork
        id: create-db
        uses: tursodatabase/create-database-action@v1
        with:
          organization_name: ${{ secrets.TURSO_ORGANIZATION_NAME }}
          api_token: ${{ secrets.TURSO_API_TOKEN }}
          existing_database_name: ${{ secrets.TURSO_DATABASE_NAME }}
          new_database_name: ${{ env.NEW_DATABASE_NAME }}

      - name: Use Database Credentials
        run: |
          echo "Database URL: ${{ steps.create-db.outputs.database_url }}"
          echo "Hostname: ${{ steps.create-db.outputs.hostname }}"
```

### With Token Creation

```yaml
steps:
  - name: Create Database Fork
    id: create-db
    uses: tursodatabase/create-database-action@v1
    with:
      organization_name: ${{ secrets.TURSO_ORGANIZATION_NAME }}
      api_token: ${{ secrets.TURSO_API_TOKEN }}
      existing_database_name: ${{ secrets.TURSO_DATABASE_NAME }}
      new_database_name: ${{ env.NEW_DATABASE_NAME }}
      create_database_token: true

  - name: Use Database Token
    run: |
      # Token is automatically masked in logs
      echo "Token: ${{ steps.create-db.outputs.database_token }}"
```

### With Replace Option

```yaml
steps:
  - name: Create Database Fork
    id: create-db
    uses: tursodatabase/create-database-action@v1
    with:
      organization_name: ${{ secrets.TURSO_ORGANIZATION_NAME }}
      api_token: ${{ secrets.TURSO_API_TOKEN }}
      existing_database_name: ${{ secrets.TURSO_DATABASE_NAME }}
      new_database_name: ${{ env.NEW_DATABASE_NAME }}
      replace: true # Delete and recreate if it exists
```

## Inputs

| Input                    | Description                                                                     | Required | Default                              |
| ------------------------ | ------------------------------------------------------------------------------- | -------- | ------------------------------------ |
| `organization_name`      | The name of the organization or account                                         | Yes      | -                                    |
| `api_token`              | The API key with access to the organization                                     | Yes      | -                                    |
| `existing_database_name` | The name of the existing database to fork from                                  | Yes      | -                                    |
| `new_database_name`      | The name for the new database fork                                              | Yes      | -                                    |
| `group_name`             | The group name the database should be created in                                | No       | Auto-detected from existing database |
| `create_database_token`  | Whether to create and output a database authentication token                    | No       | `false`                              |
| `replace`                | Whether to replace (delete and recreate) the database fork if it already exists | No       | `false`                              |

## Outputs

| Output           | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `hostname`       | The database hostname without protocol                                        |
| `database_url`   | The full database URL (libsql://hostname)                                     |
| `database_token` | The database authentication token (only set if `create_database_token: true`) |

## Development

This action is built with TypeScript and uses `pnpm` for package management.

### Prerequisites

- Node.js 24.x or later
- pnpm (install with `npm install -g pnpm` or use corepack)

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the action:

   ```bash
   pnpm run package
   ```

3. Run tests:

   ```bash
   pnpm test
   ```

4. Run all checks (format, lint, test, build):

   ```bash
   pnpm run all
   ```

### Local Testing

You can test the action locally using `@github/local-action`:

```bash
pnpm exec @github/local-action . src/main.ts .env
```

Create a `.env` file with your test inputs:

```env
INPUT_ORGANIZATION_NAME=your-org
INPUT_API_TOKEN=your-token
INPUT_EXISTING_DATABASE_NAME=existing-db
INPUT_NEW_DATABASE_NAME=new-db
INPUT_REPLACE=false
INPUT_CREATE_DATABASE_TOKEN=false
```

## Building

The action uses Rollup to bundle TypeScript into a single JavaScript file. The
built files are in the `dist/` directory and must be committed to the repository
for the action to work.

```bash
pnpm run package
```

This will:

- Clean the `dist/` directory
- Compile TypeScript
- Bundle all dependencies
- Generate source maps

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
