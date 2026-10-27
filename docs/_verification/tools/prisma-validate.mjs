// Runs `prisma validate` with throwaway connection strings (validation does not connect).
import { spawnSync } from 'node:child_process';
const env = { ...process.env, DATABASE_URL: 'postgresql://u:p@localhost:5432/x', DIRECT_DATABASE_URL: 'postgresql://u:p@localhost:5432/x' };
const r = spawnSync('npx', ['prisma', 'validate', '--schema', 'prisma/schema.prisma'], { env, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
