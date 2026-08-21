import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // CLI-only (migrate / db push / studio). Migrations cannot run through the
    // transaction pooler, so this uses the session-mode URL on 5432.
    // The app's runtime connection is configured separately in lib/prisma.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
