# api/.platform/

AWS Elastic Beanstalk platform configuration files. These customize the underlying platform (Nginx, etc.) beyond what `.ebextensions` provides.

## Directories

- **nginx/conf.d/** -- Custom Nginx configuration snippets (WebSocket proxy support).
