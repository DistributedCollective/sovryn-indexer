# Sovryn Indexer

## Requirements

- [Docker](https://www.docker.com/)
- [Node v20+](https://nodejs.org/) (optional, included in docker image)
- [pnpm](https://pnpm.io/) (optional, included in docker image)

## Development

```bash
cp .env.example .env
pnpm install
pnpm docker:dev
```

### Migrations

`pnpm studio` - serves web interface for drizzle studio on https://local.drizzle.studio

`pnpm migrate:generate` - creates migration file from changes found in schema files.

`pnpm migrate` - runs migrations

`pnpm db:push` - pushes schema changes to the database

`pnpm db:seed` - seeds the database with initial data (/src/database/seed.ts file)

`pnpm db:reset` - deletes all data and tables from the database

### Docker

Build image

`docker build -t sovryn/indexer .`

Run image

`docker run -p 8000:8000 -it sovryn/indexer`

## API Usage

Refer to the [API documentation](docs/README.md) for more information on how to use the API.

## Testing with real data

Dump your production database contents to a file:

If your testing database is empty, dump the entire database (I recommend using this):

```bash
pg_dump --no-owner --no-privileges --no-publications --no-subscriptions --no-tablespaces -Fc -v -d "<postgres connection string>" -f database.bak
```

Otherwise, only dump the data:

```bash
pg_dump --no-owner --no-privileges --no-publications --no-subscriptions --no-tablespaces --data-only --column-inserts -Fc -v -d "<postgres connection string>" -f database.bak
```

Restore the database contents to your local database:

```bash
pg_restore --no-owner -v -d "postgresql://postgres:secret@127.0.0.1:5432/db" database.bak
```
