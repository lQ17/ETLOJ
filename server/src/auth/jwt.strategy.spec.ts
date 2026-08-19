import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy account state", () => {
  const config = { get: jest.fn().mockReturnValue("test-jwt-secret") };
  const prisma = { user: { findUnique: jest.fn() } };
  const strategy = new JwtStrategy(config as any, prisma as any);
  const payload = { sub: 7, username: "stale-name", role: "ADMIN" };

  beforeEach(() => jest.clearAllMocks());

  it("returns the current database identity and role", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      username: "current-name",
      role: "USER",
      status: "APPROVED",
      isActive: true,
    });

    await expect(strategy.validate(payload)).resolves.toMatchObject({
      username: "current-name",
      role: "USER",
    });
  });

  it.each([
    ["missing", null],
    ["disabled", { id: 7, username: "u", role: "ADMIN", status: "APPROVED", isActive: false }],
    ["pending", { id: 7, username: "u", role: "USER", status: "PENDING", isActive: true }],
    ["rejected", { id: 7, username: "u", role: "USER", status: "REJECTED", isActive: true }],
  ])("rejects a %s account even when the token is valid", async (_label, user) => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
