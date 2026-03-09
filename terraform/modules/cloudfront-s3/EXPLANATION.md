# terraform/modules/cloudfront-s3/

S3 + CloudFront module for the web frontend.

## Files

- **main.tf** -- S3 bucket for static assets, CloudFront distribution with SPA routing function, OAI access policy, and TLS certificate.
- **variables.tf** -- Input variables (domain name, certificate ARN, WAF ACL).
- **outputs.tf** -- Output values (bucket name, CloudFront distribution ID, domain).
