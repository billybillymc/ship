# terraform/bootstrap/

One-time bootstrap configuration for the Terraform state backend (S3 bucket + DynamoDB lock table).

## Files

- **main.tf** -- Creates the S3 bucket for Terraform state and DynamoDB table for state locking.
