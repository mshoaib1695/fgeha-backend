# FGEHA RCP — Backend API

NestJS API for the **FGEHA Resident Request Portal**: users, auth, request types, resident requests, and daily bulletin. Used by the admin panel (fgeha-admin) and the mobile app (fgeha-app).

## Features

- **Auth** — JWT login; registration with admin approval
- **Users** — CRUD, roles (admin/user), sub-sectors, approval workflow
- **Request types** — Configurable request categories
- **Requests** — Residents submit requests (with optional photo/location); status workflow (pending → in progress → done)
- **Daily bulletin** — Upload and serve today’s bulletin (e.g. PDF/CSV)
- **Swagger** — API docs at `/api` when the server is running

## Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8 (or compatible) — create an empty database for the app

## Setup

1. **Install dependencies**
   ```bash
   cd geha-backend
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env` (in this folder or in `src/`)
   - Set database credentials (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`)
   - Set a strong `JWT_SECRET` in production
   - Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first admin (created on first run if no admin exists)

3. **Create the database**
   ```sql
   CREATE DATABASE fgeha_rcp;
   ```
   (Use the same name as `DB_DATABASE` in `.env`.)

4. **Run the API**
   ```bash
   npm run start:dev
   ```
   Server runs at `http://localhost:8080` (or the port in `PORT`). Swagger at `http://localhost:8080/api`.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run start` | Start once |
| `npm run start:dev` | Start in watch mode (recommended for dev) |
| `npm run start:prod` | Production (run after `npm run build`) |
| `npm run build` | Build for production |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | Lint and fix |

## Environment variables

| Variable | Description | Default |
|----------|-------------|--------|
| `PORT` | HTTP port | 3000 (use 8080 for admin/mobile) |
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USERNAME` | MySQL user | root |
| `DB_PASSWORD` | MySQL password | — |
| `DB_DATABASE` | Database name | nest_crud |
| `JWT_SECRET` | Secret for signing JWTs | (dev default; set in prod) |
| `JWT_EXPIRES_IN` | Token expiry | 7d |
| `ADMIN_EMAIL` | First admin email (bootstrap) | admin@example.com |
| `ADMIN_PASSWORD` | First admin password (bootstrap) | Admin123! |
| `NODE_ENV` | production / development | — |

See `.env.example` for a full template.

## Project structure

```
geha-backend/
├── src/
│   ├── main.ts           # Bootstrap, CORS, Swagger, static routes
│   ├── app.module.ts     # Config, TypeORM, feature modules
│   ├── auth/             # JWT + local strategies, guards, roles
│   ├── users/            # Users CRUD, entities, first-admin bootstrap
│   ├── request-types/    # Request type CRUD
│   ├── requests/         # Resident requests CRUD and status
│   └── daily-bulletin/   # Daily bulletin upload and today endpoint
├── test/                 # E2E tests
├── .env.example          # Env template (copy to .env)
└── package.json
```

## Static files

- **ID card images** — served from `/idcards` (folder `idcards/` at project root; create it if needed)
- **Daily bulletin files** — served from `/daily-files` (folder `daily-files/`; create it if needed)

Both folders are in `.gitignore`; create them and add files as needed.

## Tech stack

- **NestJS** 11, **TypeScript**
- **TypeORM** + **MySQL**
- **Passport** (JWT, local), **bcrypt**, **class-validator**
- **Swagger** (OpenAPI)

## Pushing this project to a Git repo

From the **repository root** (e.g. `FGEHA-RCP`):

1. **Ensure backend is ready to commit**
   - `.env` is not committed (in `.gitignore`); `.env.example` is committed.
   - Commit backend files:
     ```bash
     cd d:\FGEHA-RCP
     git add geha-backend/
     git status   # confirm only intended files
     git commit -m "feat: add FGEHA RCP backend (NestJS)"
     ```

2. **Add remote and push** (first time)
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
   Or with SSH: `git@github.com:YOUR_USERNAME/YOUR_REPO.git`

3. **Later pushes**
   ```bash
   git add .
   git commit -m "your message"
   git push
   ```

If the repo already has a different history (e.g. created with a README on GitHub), either:

- **Replace remote history:**  
  `git pull origin main --rebase` then `git push`, or  
  `git push -u origin main --force` (only if you’re sure no one else depends on the remote branch).

- **Push backend (and rest) as a subfolder:**  
  Your repo can contain `geha-backend/`, `fgeha-admin/`, `fgeha-app/` together. Then from repo root:
  ```bash
  git add .
  git commit -m "feat: add FGEHA RCP backend, admin, and mobile app"
  git push
  ```
