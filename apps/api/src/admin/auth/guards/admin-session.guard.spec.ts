import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { AdminSessionGuard } from "./admin-session.guard";
import type { AdminSessionService } from "../session/admin-session.service";
import type { PrismaService } from "../../../prisma/prisma.service";

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("AdminSessionGuard", () => {
  function makeGuard(opts: {
    session: Record<string, unknown> | null;
    admin: Record<string, unknown> | null;
  }) {
    const sessions = {
      cookieName: "junuban_admin_session",
      validate: jest.fn().mockResolvedValue(opts.session),
    };
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(opts.admin),
      },
    };
    const guard = new AdminSessionGuard(
      sessions as unknown as AdminSessionService,
      prisma as unknown as PrismaService,
    );
    return { guard };
  }

  it("throws when no admin session cookie is present", async () => {
    const { guard } = makeGuard({ session: null, admin: null });
    const context = makeContext({ cookies: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws when the session token doesn't validate", async () => {
    const { guard } = makeGuard({ session: null, admin: null });
    const context = makeContext({ cookies: { junuban_admin_session: "bad-token" } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws when the admin account has been disabled since the session was issued", async () => {
    const { guard } = makeGuard({
      session: { adminId: "admin-1" },
      admin: { id: "admin-1", role: "STAFF", status: "DISABLED" },
    });
    const context = makeContext({ cookies: { junuban_admin_session: "valid-token" } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches adminId and adminRole and allows the request through for an active admin", async () => {
    const { guard } = makeGuard({
      session: { adminId: "admin-1" },
      admin: { id: "admin-1", role: "OWNER", status: "ACTIVE" },
    });
    const request: Record<string, unknown> = { cookies: { junuban_admin_session: "valid-token" } };
    const context = makeContext(request);

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(request.adminId).toBe("admin-1");
    expect(request.adminRole).toBe("OWNER");
  });
});
