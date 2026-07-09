# 9. Monitoring & Observability

## Metrics

- Key metrics: request latency (p50/p95/p99), throughput (requests/sec), error rate, CPU/memory.

## Logging

- Structured JSON logs with fields: timestamp, service, level, request_id, user_id (if applicable), message.

## Tracing

- Distributed tracing with W3C Trace Context; sample spans for user requests and background jobs.

## Alerts & Dashboards

- Threshold-based alerts for error rate spike, high latency, resource exhaustion.
- Dashboards: API health, consumer experience, system health.

## Incident Response

- Playbook: detect -> triage -> mitigate -> root cause -> postmortem.
