import { SubmissionService } from "./submission.service";

describe("SubmissionService submission filters", () => {
  const prisma = {
    submission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = Object.create(SubmissionService.prototype) as SubmissionService;
  (service as any).prisma = prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.submission.findMany.mockResolvedValue([]);
    prisma.submission.count.mockResolvedValue(0);
  });

  it("filters submissions by the visible problem slug", async () => {
    await service.findAll({ problemSlug: "P1041" });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { problem: { slug: "P1041" } } }),
    );
    expect(prisma.submission.count).toHaveBeenCalledWith({
      where: { problem: { slug: "P1041" } },
    });
  });

  it("combines problem slug and title filters", async () => {
    await service.findAll({ problemSlug: "P1041", keyword: "排序" });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          problem: {
            slug: "P1041",
            title: { contains: "排序" },
          },
        },
      }),
    );
  });

  it("keeps the legacy database id filter compatible", async () => {
    await service.findAll({ problemId: 9 });

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { problemId: 9 } }),
    );
  });
});
