import { BadRequestException } from "@nestjs/common";
import { SubmissionService } from "./submission.service";

describe("SubmissionService result idempotency", () => {
  const prisma = {
    submission: { updateMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    submissionTestCase: { createMany: jest.fn() },
    problemTag: { findMany: jest.fn() },
  };
  const gateway = { notifySubmissionUpdate: jest.fn() };
  const service = Object.create(SubmissionService.prototype) as SubmissionService;
  (service as any).prisma = prisma;
  (service as any).submissionGateway = gateway;

  beforeEach(() => jest.clearAllMocks());

  it("persists and broadcasts the first terminal callback", async () => {
    prisma.submission.updateMany.mockResolvedValue({ count: 1 });
    prisma.submission.findUnique.mockResolvedValue({
      id: 10,
      userId: 7,
      problemId: 2,
      status: "WA",
      problem: { id: 2 },
    });
    prisma.submissionTestCase.createMany.mockResolvedValue({ count: 1 });

    await service.updateResult(10, {
      status: "WA",
      timeUsed: 20,
      memoryUsed: 100,
      testcases: [{ index: 1, status: "WA", timeUsed: 20, memoryUsed: 100 }],
    });

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10, status: { in: ["PENDING", "JUDGING"] } },
    }));
    expect(prisma.submissionTestCase.createMany).toHaveBeenCalledTimes(1);
    expect(gateway.notifySubmissionUpdate).toHaveBeenCalledTimes(1);
  });

  it("treats a repeated callback as success without duplicating side effects", async () => {
    prisma.submission.updateMany.mockResolvedValue({ count: 0 });
    prisma.submission.findUnique.mockResolvedValue({
      id: 10,
      status: "WA",
      problem: { id: 2 },
    });

    await expect(service.updateResult(10, {
      status: "WA",
      timeUsed: 20,
      memoryUsed: 100,
      testcases: [{ index: 1, status: "WA", timeUsed: 20, memoryUsed: 100 }],
    })).resolves.toMatchObject({ id: 10, status: "WA" });

    expect(prisma.submissionTestCase.createMany).not.toHaveBeenCalled();
    expect(gateway.notifySubmissionUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-terminal callback states", async () => {
    await expect(service.updateResult(10, {
      status: "JUDGING",
      timeUsed: 0,
      memoryUsed: 0,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
  });
});
