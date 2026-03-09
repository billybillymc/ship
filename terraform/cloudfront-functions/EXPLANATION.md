# terraform/cloudfront-functions/

CloudFront Functions deployed at the edge for request manipulation.

## Files

- **spa-routing.js** -- Rewrites requests for SPA client-side routes to `/index.html` so React Router handles them, while passing through static asset requests.
