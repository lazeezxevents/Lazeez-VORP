# Documentation Display (docs_display)

Purpose: Consolidated, developer-focused technical documentation for the product. Use these templates as the authoritative technical source for developers, QA, DevOps, security, and architects.

Structure:

- 1_product_requirements.md
- 2_architecture.md
- 3_api_documentation.md
- 4_data_database.md
- 5_security_compliance.md
- 6_devops_deployment.md
- 7_testing_qa.md
- 8_release_versioning.md
- 9_monitoring_observability.md
- 10_technical_roadmap.md
- code_quality_and_reports.md
- build_and_deployment_reports.md
- openapi.yaml
- diagrams/sequence_diagrams.mmd
- diagrams/er_diagram.mmd

How to use:

- Fill in TODO sections with concrete system values pulled from the codebase or engineering leads.
- Keep `openapi.yaml` updated as the canonical API contract and generate API clients from it.
- Store finalized diagrams as both `.mmd` and exported images in `docs_display/diagrams/`.

Owner: Product / Engineering
