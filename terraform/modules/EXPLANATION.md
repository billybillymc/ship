# terraform/modules/

Reusable Terraform modules for individual infrastructure components.

## Directories

- **vpc/** -- VPC with public/private subnets, NAT gateway, and routing.
- **aurora/** -- Aurora PostgreSQL database cluster.
- **elastic-beanstalk/** -- Elastic Beanstalk application and environment for the API.
- **cloudfront-s3/** -- S3 bucket with CloudFront CDN for the web frontend.
- **security-groups/** -- Security group definitions for all components.
- **ssm/** -- SSM Parameter Store configuration entries.
