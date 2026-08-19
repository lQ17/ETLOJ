import { NotFoundException } from "@nestjs/common";
import { SolutionStatus } from "@prisma/client";
import { SolutionService } from "./solution.service";

describe("SolutionService visibility", () => {
  const prisma = {
    solution: {
      findUnique: jest.fn(),
    },
  };
  const service = new SolutionService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it("allows anonymous users to read approved solutions", async () => {
    prisma.solution.findUnique.mockResolvedValue({
      id: 1,
      authorId: 7,
      status: SolutionStatus.APPROVED,
      content: "approved",
    });

    await expect(service.findOneVisibleTo(1)).resolves.toMatchObject({ id: 1 });
  });

  it("hides pending solutions from anonymous and unrelated users", async () => {
    prisma.solution.findUnique.mockResolvedValue({
      id: 2,
      authorId: 7,
      status: SolutionStatus.PENDING,
      content: "draft",
    });

    await expect(service.findOneVisibleTo(2)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findOneVisibleTo(2, { id: 8, role: "USER" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows the author and reviewers to read unapproved solutions", async () => {
    prisma.solution.findUnique.mockResolvedValue({
      id: 3,
      authorId: 7,
      status: SolutionStatus.REJECTED,
      content: "revise me",
    });

    await expect(
      service.findOneVisibleTo(3, { id: 7, role: "USER" }),
    ).resolves.toMatchObject({ id: 3 });
    await expect(
      service.findOneVisibleTo(3, { id: 9, role: "TEACHER" }),
    ).resolves.toMatchObject({ id: 3 });
  });
});
