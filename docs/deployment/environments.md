# Environment Strategy

## Environments

| Environment | Purpose | Data |
|---|---|---|
| Development | Local feature work | Local or disposable database. |
| Staging | Production-like validation | Isolated staging database/storage/cache. |
| Production | Live schools | Managed database/storage/cache with backups. |

## Required Production Variables

- `APP_ENV=production`
- `MONGO_URL`
- `DB_NAME`
- `SECRET_KEY`
- `ALLOWED_ORIGINS` or `ALLOWED_ORIGIN_REGEX`
- `FRONTEND_URL`

The backend validates these during startup. Development remains backward-compatible with local defaults.

## Secrets

Secrets can be supplied directly through environment variables or mounted secret files:

- `SECRET_KEY_FILE`
- `MONGO_URL_FILE`
- `OPENAI_API_KEY_FILE`
- `STRIPE_API_KEY_FILE`

Use a managed secret store in production, such as cloud secret manager, Kubernetes secrets, Docker secrets, or a vault service.

## Environment Isolation

Staging and production must not share:

- MongoDB databases.
- Object storage buckets.
- Cache instances.
- Payment callback URLs.
- JWT secret keys.
