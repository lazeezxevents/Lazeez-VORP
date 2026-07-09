# 3. API Documentation

## Overview

- Canonical API contract: `openapi.yaml` (update as implementation changes).
- Use semantic versioning for APIs: `/api/v1/...`, `/api/v2/...`.

## Authentication

- OAuth2 / JWT bearer tokens (or API keys for machine-to-machine). Include scopes and role mappings.

## Rate Limits

- Default: TODO requests/min per API key.
- Burst: TODO.

## Error Model

- Standard JSON error: `{ "code": "ERR_CODE", "message": "human message", "details": {...} }`
- HTTP mapping: 4xx client errors, 5xx server errors. List of common codes:
  - 400: Bad Request (validation failed)
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 409: Conflict
  - 429: Too Many Requests
  - 500: Internal Server Error

## Endpoints (examples)

### POST /api/v1/bookings

- Request:

```
{
  "user_id": "uuid",
  "slot_id": "uuid",
  "metadata": { }
}
```

- Response 201:

```
{
  "id": "uuid",
  "status": "confirmed",
  "created_at": "ISO8601"
}
```

## Versioning and Deprecation

- Major version for breaking changes. Maintain compatibility for two versions where feasible.
- Deprecation policy: announce 90 days, provide migration guide.

## Tools & Artifacts

- `openapi.yaml` — machine-readable spec.
- Postman collection / generated clients — keep alongside API CI.
