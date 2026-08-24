import { BadRequestException } from "@nestjs/common";
import AdmZip = require("adm-zip");
import { ProblemImportExportService } from "./problem-import-export.service";
import { MAX_TESTCASE_FILE_BYTES } from "../testcase/testcase.types";

describe("ProblemImportExportService archive validation", () => {
  const prisma = {
    problem: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue("D:/tmp/etloj-problems-test") };
  const service = new ProblemImportExportService(prisma as any, config as any);

  beforeEach(() => jest.clearAllMocks());

  it("rejects a crafted traversal entry before touching the database", async () => {
    const safeName = "p/testcases/AA/BB/x";
    const maliciousName = "p/testcases/../../x";
    expect(safeName).toHaveLength(maliciousName.length);

    const zip = new AdmZip();
    zip.addFile(safeName, Buffer.from("payload"));
    const buffer = zip.toBuffer();
    const safeBytes = Buffer.from(safeName);
    for (let offset = buffer.indexOf(safeBytes); offset >= 0; offset = buffer.indexOf(safeBytes, offset + maliciousName.length)) {
      Buffer.from(maliciousName).copy(buffer, offset);
    }

    await expect(service.importProblems(buffer)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.problem.findUnique).not.toHaveBeenCalled();
  });

  it("accepts only the documented flat problem package layout", () => {
    const entries = [
      { entryName: "P1000/problem.json", isDirectory: false, header: { size: 100 } },
      { entryName: "P1000/problem.md", isDirectory: false, header: { size: 200 } },
      { entryName: "P1000/testcases/1.in", isDirectory: false, header: { size: 10 } },
      { entryName: "P1000/testcases/1.out", isDirectory: false, header: { size: 10 } },
    ];

    expect(() => (service as any).validateArchiveEntries(entries)).not.toThrow();
  });

  it("rejects oversized uncompressed entries without inflating them", () => {
    const entries = [{
      entryName: "P1000/testcases/1.in",
      isDirectory: false,
      header: { size: MAX_TESTCASE_FILE_BYTES + 1 },
    }];

    expect(() => (service as any).validateArchiveEntries(entries)).toThrow(BadRequestException);
  });
});
