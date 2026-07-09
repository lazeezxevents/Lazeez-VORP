# 8. Release & Versioning Documentation

## Versioning Strategy

- Semantic Versioning: MAJOR.MINOR.PATCH.

## Release Process

- Create release candidate branch, run full CI, smoke tests, then tag and publish.

## Changelog

- Maintain changelog.md or rely on Git-based generation (conventional commits).

## Migration & Backward Compatibility

- Document DB migrations and data migrations in `infra/migrations` and migration guides.
