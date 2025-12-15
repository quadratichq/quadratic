# Quadratic API

## Prisma & Migrations

### Create a New Migration
To create a new migration:

```bash
npm run prisma:migrate:create
```

If you created a new migration, but decided you'd like to change it:

1. Delete the newly created directory folder in the `migrations` directory.
1. Make necessary schema changes in `schema.prisma`.
1. Run `npm run prisma:dev:reset`.
1. Run `npm run prisma:migrate:create`.
1. Run `npm run prisma:migrate`.

### Advisory Lock Issues
If you get this message:
```text
Error: P1002

The database server at `0.0.0.0:5432` was reached but timed out.

Please try again.

Please make sure your database server is running at `0.0.0.0:5432`.

Context: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)). Elapsed: 10000ms. See https://pris.ly/d/migrate-advisory-locking for details.
```

Add `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true` before the npm command.

e.g.
```bash
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npm run prisma:migrate
```

## Testing

```bash
npx dotenv -e .env.test jest
```

To test a specific file, use the following command:

```bash
npx dotenv -e .env.test jest crypto
```

