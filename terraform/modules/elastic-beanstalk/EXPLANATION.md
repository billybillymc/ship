# terraform/modules/elastic-beanstalk/

Elastic Beanstalk module for the API server.

## Files

- **main.tf** -- EB application and environment with Docker platform, auto-scaling, load balancer, environment variables, and health checks.
- **variables.tf** -- Input variables (instance type, scaling limits, environment name, VPC config).
- **outputs.tf** -- Output values (environment URL, CNAME, application name).
