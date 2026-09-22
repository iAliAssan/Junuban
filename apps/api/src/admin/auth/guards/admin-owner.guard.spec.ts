import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { AdminOwnerGuard } from "./admin-owner.guard";

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("AdminOwnerGuard", () => {
  it("allows an OWNER-role request through", () => {
    const guard = new AdminOwnerGuard();
    const context = makeContext({ adminRole: "OWNER" });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a STAFF-role request, even with a valid admin session", () => {
    const guard = new AdminOwnerGuard();
    const context = makeContext({ adminRole: "STAFF" });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
