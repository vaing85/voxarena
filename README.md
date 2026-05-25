cdnpm# VoxArena API

Node + Express + Prisma (PostgreSQL). Deploy on **Railway** with root directory **`services/api`** so **`nixpacks.toml`** is used.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (`tsx watch`) |
| `npm run build` | `tsc` (run `npm install` first so `prepare` runs `prisma generate`) |
| `npm start` | Production: `node dist/index.js` |
| `npm run db:push` | `prisma db push` |
| `npm run db:seed` | Seed demo song, demo player, **VoxArena Bot** (solo vs bot) |
| `npm run db:studio` | Prisma Studio |

Env: copy `.env.example` → `.env`. See [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) and [../../docs/GETTING_STARTED.md](../../docs/GETTING_STARTED.md).
