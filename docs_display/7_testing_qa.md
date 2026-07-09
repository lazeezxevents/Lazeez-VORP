# 7. Testing & QA Documentation

## Test Types

- Unit Tests: fast, isolated, run on each PR.
- Integration Tests: cover interactions between services and DB.
- End-to-End: scenario tests through API/UI flows.
- Performance: load and stress tests with targets.
- Regression: nightly runs for critical flows.

## Test Coverage & Reporting

- Tooling: coverage reports (e.g., nyc, coverage.py). Minimum acceptable coverage: TODO%.

## Test Data & Environments

- Use deterministic fixtures; anonymized production snapshots for staging when needed.

## Security Testing

- SAST during CI; periodic DAST and pentests.

## Test Run Examples

```
npm run test:unit
npm run test:integration
```
