/**
 * Production-safe admin bootstrap.
 *
 * Unlike `prisma/seed.ts` (which creates placeholder demo/dev catalog
 * data and a hardcoded dev-only admin password — never run that
 * against production), this script does exactly one thing: ensure a
 * single OWNER admin account exists, using credentials supplied via
 * environment variables. It is deliberately safe to run against
 * production and safe to run more than once.
 *
 * Required environment variables:
 *   ADMIN_EMAIL     — the owner account's email
 *   ADMIN_PASSWORD  — the owner account's initial password (plaintext,
 *                      read once here, hashed with Argon2id, never
 *                      logged, never stored anywhere in plaintext)
 *
 * Idempotency: if an AdminUser with this email already exists, this
 * script does nothing and exits successfully — it never overwrites an
 * existing password or duplicates the account. This means it is safe
 * to include in a deploy pipeline and run on every deploy: the first
 * run creates the OWNER, every run after that is a no-op.
 *
 * To rotate the password for an existing account, do that through the
 * admin panel (or a deliberate one-off script) — not by re-running
 * this bootstrap, which intentionally will not touch an existing row.
 *
 * Run with: npm run prisma:seed:admin -w apps/api
 * (or set ADMIN_EMAIL/ADMIN_PASSWORD in the deploy environment and run
 * this as a one-time post-migration step against production)
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must both be set in the environment. " +
        "Nothing was created. (This is a fail-safe, not an error to work around by " +
        "hardcoding credentials here.)",
    );
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(
      `Admin account already exists for ${normalizedEmail} (id: ${existing.id}) — no changes made. ` +
        "This script never overwrites an existing account.",
    );
    return;
  }

  const passwordHash = await hash(password);

  const created = await prisma.adminUser.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      fullName: "مالک فروشگاه",
      role: "OWNER",
    },
  });

  // Never log the password itself — only confirm the account was created.
  // eslint-disable-next-line no-console
  console.log(`OWNER admin account created: ${created.email} (id: ${created.id}).`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Admin bootstrap failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
