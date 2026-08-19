import { SubmissionGateway } from "./submission.gateway";

describe("SubmissionGateway authorization", () => {
  const jwt = {
    sign: jest.fn().mockReturnValue("ticket"),
    verifyAsync: jest.fn(),
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    submission: { findUnique: jest.fn() },
  };
  const gateway = new SubmissionGateway(jwt as any, prisma as any);

  const client = () => ({
    close: jest.fn(),
    send: jest.fn(),
    readyState: 1,
  }) as any;

  beforeEach(() => jest.clearAllMocks());

  it("rejects connections without a ticket", async () => {
    const socket = client();
    await gateway.handleConnection(socket, { url: "/ws/submissions" } as any);
    expect(socket.close).toHaveBeenCalledWith(1008, "Unauthorized");
  });

  it("allows an owner to subscribe to their own submission", async () => {
    const socket = client();
    jwt.verifyAsync.mockResolvedValue({ sub: 7, purpose: "submission-ws" });
    prisma.user.findUnique.mockResolvedValue({
      id: 7, role: "USER", status: "APPROVED", isActive: true,
    });
    prisma.submission.findUnique.mockResolvedValue({ userId: 7 });

    await gateway.handleConnection(socket, { url: "/ws/submissions?ticket=ok" } as any);
    await gateway.handleSubscribe(socket, { submissionId: 12 });

    expect((gateway as any).clientsMap.get(12).has(socket)).toBe(true);
  });

  it("refuses subscriptions to another user's submission", async () => {
    const socket = client();
    jwt.verifyAsync.mockResolvedValue({ sub: 7, purpose: "submission-ws" });
    prisma.user.findUnique.mockResolvedValue({
      id: 7, role: "USER", status: "APPROVED", isActive: true,
    });
    prisma.submission.findUnique.mockResolvedValue({ userId: 8 });

    await gateway.handleConnection(socket, { url: "/ws/submissions?ticket=ok" } as any);
    await gateway.handleSubscribe(socket, { submissionId: 13 });

    expect((gateway as any).clientsMap.has(13)).toBe(false);
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining("Forbidden"));
  });
});
