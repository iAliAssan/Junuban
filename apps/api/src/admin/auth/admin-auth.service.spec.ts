import { AdminAuthService } from "./admin-auth.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";

jest.mock("argon2", () => ({
  verify: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verify: mockVerify } = jest.requireMock("argon2") as { verify: jest.Mock };

function makeAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "admin-1",
    email: "owner@junuban.dev",
    passwordHash: "hashed-password",
    fullName: "مالک فروشگاه",
    role: "OWNER",
    status: "ACTIVE",
    lastLoginAt: null,
    ...overrides,
  };
}

describe("AdminAuthService", () => {
  function makeService(overrides: { adminUser?: Record<string, unknown> | null } = {}) {
    const redisStore = new Map<string, string>();
    const redisClient = {
      incr: jest.fn(async (key: string) => {
        const next = (Number(redisStore.get(key)) || 0) + 1;
        redisStore.set(key, String(next));
        return next;
      }),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(900),
      del: jest.fn(async (key: string) => {
        redisStore.delete(key);
      }),
    };

    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(overrides.adminUser ?? makeAdmin()),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const service = new AdminAuthService(
      prisma as unknown as PrismaService,
      { client: redisClient } as unknown as RedisService,
    );

    return { service, prisma, redisClient };
  }

  beforeEach(() => {
    mockVerify.mockReset();
  });

  it("logs in successfully with correct credentials for an active admin", async () => {
    mockVerify.mockResolvedValue(true);
    const { service, prisma } = makeService();

    const result = await service.login("owner@junuban.dev", "correct-password");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.admin.email).toBe("owner@junuban.dev");
    }
    expect(prisma.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "admin-1" } }),
    );
  });

  it("rejects an incorrect password without revealing which part was wrong", async () => {
    mockVerify.mockResolvedValue(false);
    const { service } = makeService();

    const result = await service.login("owner@junuban.dev", "wrong-password");

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("still calls argon2 verify (against a dummy hash) when the email doesn't exist", async () => {
    mockVerify.mockResolvedValue(false);
    const { service } = makeService({ adminUser: null });

    const result = await service.login("nobody@junuban.dev", "anything");

    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("rejects a correct password for a disabled admin account", async () => {
    mockVerify.mockResolvedValue(true);
    const { service } = makeService({ adminUser: makeAdmin({ status: "DISABLED" }) });

    const result = await service.login("owner@junuban.dev", "correct-password");

    expect(result).toEqual({ ok: false, reason: "disabled" });
  });

  it("rate-limits after too many attempts for the same email", async () => {
    mockVerify.mockResolvedValue(false);
    const { service } = makeService();

    for (let i = 0; i < 10; i += 1) {
      await service.login("owner@junuban.dev", "wrong-password");
    }
    const result = await service.login("owner@junuban.dev", "wrong-password");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("rate_limited");
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
