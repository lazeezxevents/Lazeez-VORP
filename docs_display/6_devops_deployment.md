# 6. DevOps / Deployment Documentation

## Environments

- Development: local docker-compose
- Staging: mirrors prod, feature branches deployed by CI
- Production: Kubernetes cluster with autoscaling

## CI/CD Pipeline

- Steps:
  1. Lint & static analysis
  2. Unit tests
  3. Build artifacts (containers)
  4. Integration tests in ephemeral environment
  5. Deploy to staging
  6. Promote to production via deployment pipeline

## Build & Deployment Instructions

- Build container image:

```
docker build -t registry.example.com/product/service:TAG .
```

- Deploy: CI handles image push; use helm charts under `infra/helm` (TODO: path)

## Rollback Procedures

- Use previous image tag and trigger deployment rollback via Helm or k8s rollout undo.

## Infrastructure as Code

- Store Terraform modules in `infra/terraform/` with state in remote backend.

## Environment Configuration

- Config via environment variables and secrets manager — list required variables here.
