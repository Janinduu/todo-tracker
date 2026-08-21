import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL / DATABASE_URL not set. Fill in .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const MEMBERS = ["Thanveer", "Prathapa", "Janindu"];

async function main() {
  // Idempotent: safe to re-run without duplicating anyone.
  for (const name of MEMBERS) {
    const existing = await prisma.teamMember.findFirst({ where: { name } });
    if (existing) {
      console.log(`- ${name} already exists, skipping`);
      continue;
    }
    await prisma.teamMember.create({ data: { name } });
    console.log(`+ created ${name}`);
  }

  const memberCount = await prisma.teamMember.count();
  const periodCount = await prisma.period.count();
  console.log(`\nteam members: ${memberCount}, periods: ${periodCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
