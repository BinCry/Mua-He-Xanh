# Production deployment

## Platform

Self-hosted Node.js application managed by PM2 on the production VPS.

## Release procedure

1. Push the tested `main` branch to GitHub.
2. On the VPS, run `git pull --ff-only`, install locked dependencies with `npm ci`, then restart and save the PM2 process.
3. Run the relevant database/media migration only after a successful dry-run and with a rollback manifest stored outside the public directory.
4. Verify `/api/health`, `/api/ready`, core public routes and PM2 status after restart.

## Rollback

Deploy the prior tested commit with a fast-forward-safe checkout procedure, restart PM2, and use the migration manifest only when database media restoration is required.
