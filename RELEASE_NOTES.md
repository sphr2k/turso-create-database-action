# Release Notes

## Version 1.0.0 (Initial Release)

### Features

- **Create database forks (clones)** from existing databases
- **Automatic group name resolution** from existing databases when not provided
- **Optional database replacement** - delete and recreate existing databases
  with `replace: true`
- **Optional database authentication token creation** for secure access
- **Dry-run mode** for validation without making API calls
- **Comprehensive error handling** with clear, actionable error messages

### Error Handling

The action includes robust error handling with the following features:

- **Combined error messages**: Error details and helpful guidance are combined
  into single, clear messages
- **Fast failure on real errors**: Non-404 errors (authentication failures,
  network issues, etc.) when checking database existence cause immediate failure
  to prevent masking real problems
- **Defensive property handling**: Supports both lowercase `hostname` and
  uppercase `Hostname` property names in API responses for maximum compatibility

```typescript
// Error messages include both error details and guidance
core.setFailed(
  `Failed to create database fork: ${errorMsg} Database fork '${name}' may already exist. Set 'replace: true' to overwrite it, or use a different name.`
)

// Handles both hostname property formats
const hostname = createdDatabase.hostname || (createdDatabase as any).Hostname
```

### Testing

- **100% code coverage** with comprehensive unit tests
- Tests cover all success paths and error scenarios
- All error handling branches are thoroughly tested
- Tests use proper mocking with fixtures for maintainability

### Usage

See the [README.md](README.md) for detailed usage examples and configuration
options.
