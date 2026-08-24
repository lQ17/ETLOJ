import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { TestcaseLockService } from './testcase-lock.service';
import {
  TestcaseDeleteResult,
  TestcaseMetadata,
  TestcaseMutationResult,
  TestcaseReadResult,
  TestcaseScanResult,
  TestcaseStoreError,
  TestcaseTextPair,
  MAX_TESTCASE_FILE_BYTES,
} from './testcase.types';

const TESTCASE_FILE = /^([1-9]\d*)\.(in|out)$/;
const HARD_MAX_COUNT = 10_000;

@Injectable()
export class TestcaseStoreService implements OnModuleInit {
  private readonly logger = new Logger(TestcaseStoreService.name);
  private readonly problemsDir: string;
  readonly maxFileBytes: number;
  readonly defaultChunkChars: number;
  readonly maxChunkChars: number;
  readonly maxCount: number;

  constructor(
    config: ConfigService,
    private readonly locks: TestcaseLockService,
  ) {
    this.problemsDir = path.resolve(
      config.get<string>('PROBLEMS_DIR') ||
        path.resolve(__dirname, '../../../problems'),
    );
    this.maxFileBytes = this.readBoundedInteger(
      config.get<string>('MCP_TESTCASE_MAX_FILE_BYTES'),
      MAX_TESTCASE_FILE_BYTES,
      MAX_TESTCASE_FILE_BYTES,
    );
    this.maxChunkChars = this.readBoundedInteger(
      config.get<string>('MCP_TESTCASE_READ_MAX_CHARS'),
      65_536,
      65_536,
    );
    this.defaultChunkChars = this.readBoundedInteger(
      config.get<string>('MCP_TESTCASE_READ_CHUNK_CHARS'),
      Math.min(32_768, this.maxChunkChars),
      this.maxChunkChars,
    );
    this.maxCount = this.readBoundedInteger(
      config.get<string>('MCP_TESTCASE_MAX_COUNT'),
      1_000,
      HARD_MAX_COUNT,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const problems = await readdir(this.problemsDir, { withFileTypes: true });
      for (const problem of problems) {
        if (!problem.isDirectory()) continue;
        const entries = await readdir(
          path.join(this.problemsDir, problem.name),
          {
            withFileTypes: true,
          },
        );
        for (const entry of entries) {
          if (
            entry.name.startsWith('.testcases-staging-') ||
            entry.name.startsWith('.testcases-backup-')
          ) {
            this.logger.error(
              `Unresolved testcase transaction artifact for problem=${problem.name} name=${entry.name}`,
            );
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to inspect testcase transaction artifacts.');
      }
    }
  }

  scan(slug: string): Promise<TestcaseScanResult> {
    const safeSlug = this.validateSlug(slug);
    return this.locks.withReadLock(safeSlug, () =>
      this.scanDirectory(this.testcasesDir(safeSlug)),
    );
  }

  readAll(slug: string): Promise<TestcaseTextPair[]> {
    const safeSlug = this.validateSlug(slug);
    return this.locks.withReadLock(safeSlug, async () => {
      const directory = this.testcasesDir(safeSlug);
      const scan = await this.scanDirectory(directory);
      this.assertValid(scan);
      return Promise.all(
        scan.items.map(async ({ index }) => ({
          input: await readFile(path.join(directory, `${index}.in`), 'utf8'),
          expectedOutput: await readFile(
            path.join(directory, `${index}.out`),
            'utf8',
          ),
        })),
      );
    });
  }

  readChunk(
    slug: string,
    index: number,
    inputOffset = 0,
    outputOffset = 0,
    maxCharsPerField = this.defaultChunkChars,
  ): Promise<TestcaseReadResult> {
    const safeSlug = this.validateSlug(slug);
    this.assertPositiveIndex(index);
    if (
      !Number.isSafeInteger(inputOffset) ||
      inputOffset < 0 ||
      !Number.isSafeInteger(outputOffset) ||
      outputOffset < 0 ||
      !Number.isSafeInteger(maxCharsPerField) ||
      maxCharsPerField < 1 ||
      maxCharsPerField > this.maxChunkChars
    ) {
      throw new TestcaseStoreError(
        'INVALID_ARGUMENT',
        'Invalid testcase read range.',
      );
    }
    return this.locks.withReadLock(safeSlug, async () => {
      const directory = this.testcasesDir(safeSlug);
      const scan = await this.scanDirectory(directory);
      const metadata = scan.items.find((item) => item.index === index);
      if (!metadata) {
        throw new TestcaseStoreError(
          'TESTCASE_NOT_FOUND',
          'Testcase not found.',
        );
      }
      const [input, output] = await Promise.all([
        readFile(path.join(directory, `${index}.in`), 'utf8'),
        readFile(path.join(directory, `${index}.out`), 'utf8'),
      ]);
      return {
        index,
        revision: scan.revision,
        input: this.chunk(
          input,
          inputOffset,
          maxCharsPerField,
          metadata.inputSha256,
        ),
        expectedOutput: this.chunk(
          output,
          outputOffset,
          maxCharsPerField,
          metadata.outputSha256,
        ),
      };
    });
  }

  replaceAll(
    slug: string,
    testcases: TestcaseTextPair[],
  ): Promise<TestcaseMutationResult> {
    const safeSlug = this.validateSlug(slug);
    this.validatePayload(testcases);
    return this.locks.withWriteLock(safeSlug, async () => {
      const before = await this.scanDirectory(this.testcasesDir(safeSlug));
      this.assertValid(before);
      const after = await this.commit(safeSlug, testcases);
      return {
        testcaseCount: after.testcaseCount,
        previousRevision: before.revision,
        revision: after.revision,
      };
    });
  }

  append(
    slug: string,
    testcase: TestcaseTextPair,
    expectedRevision: string,
  ): Promise<TestcaseMutationResult & { addedIndex: number }> {
    const safeSlug = this.validateSlug(slug);
    this.validatePayload([testcase]);
    return this.locks.withWriteLock(safeSlug, async () => {
      const directory = this.testcasesDir(safeSlug);
      const before = await this.scanDirectory(directory);
      this.assertValid(before);
      this.assertRevision(before, expectedRevision);
      if (before.testcaseCount >= this.maxCount) {
        throw new TestcaseStoreError(
          'TESTCASE_LIMIT_EXCEEDED',
          'Testcase count limit exceeded.',
        );
      }
      const existing = await this.readAllUnlocked(directory, before);
      const addedIndex = existing.length + 1;
      const after = await this.commit(safeSlug, [...existing, testcase]);
      return {
        addedIndex,
        testcaseCount: after.testcaseCount,
        previousRevision: before.revision,
        revision: after.revision,
      };
    });
  }

  deleteAndRenumber(
    slug: string,
    index: number,
    expectedRevision: string,
  ): Promise<TestcaseDeleteResult> {
    const safeSlug = this.validateSlug(slug);
    this.assertPositiveIndex(index);
    return this.locks.withWriteLock(safeSlug, async () => {
      const directory = this.testcasesDir(safeSlug);
      const before = await this.scanDirectory(directory);
      this.assertValid(before);
      this.assertRevision(before, expectedRevision);
      if (!before.items.some((item) => item.index === index)) {
        throw new TestcaseStoreError(
          'TESTCASE_NOT_FOUND',
          'Testcase not found.',
        );
      }
      const existing = await this.readAllUnlocked(directory, before);
      const renumbered = before.items
        .filter((item) => item.index > index)
        .map((item) => ({ from: item.index, to: item.index - 1 }));
      const after = await this.commit(
        safeSlug,
        existing.filter((_, position) => position !== index - 1),
      );
      return {
        testcaseCount: after.testcaseCount,
        previousRevision: before.revision,
        revision: after.revision,
        renumbered,
      };
    });
  }

  private async scanDirectory(directory: string): Promise<TestcaseScanResult> {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.buildScan([], [], false);
      }
      throw error;
    }

    const byIndex = new Map<number, { input?: string; output?: string }>();
    let unsafeEntry = false;
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isFile()) {
        unsafeEntry = true;
        continue;
      }
      const match = TESTCASE_FILE.exec(entry.name);
      if (!match) continue;
      const index = Number(match[1]);
      if (!Number.isSafeInteger(index)) {
        unsafeEntry = true;
        continue;
      }
      const pair = byIndex.get(index) || {};
      if (match[2] === 'in') pair.input = entry.name;
      else pair.output = entry.name;
      byIndex.set(index, pair);
    }

    const anomalies: Array<{ index: number; missing: 'input' | 'output' }> = [];
    const items: TestcaseMetadata[] = [];
    const revisionParts: string[] = [];
    for (const index of [...byIndex.keys()].sort((a, b) => a - b)) {
      const pair = byIndex.get(index)!;
      if (!pair.input) anomalies.push({ index, missing: 'input' });
      if (!pair.output) anomalies.push({ index, missing: 'output' });
      const [input, output] = await Promise.all([
        pair.input
          ? this.readRegularFile(path.join(directory, pair.input))
          : null,
        pair.output
          ? this.readRegularFile(path.join(directory, pair.output))
          : null,
      ]);
      if ((pair.input && !input) || (pair.output && !output)) {
        unsafeEntry = true;
        continue;
      }
      revisionParts.push(
        `${index}:in:${input ? `${input.content.length}:${input.sha256}` : 'missing'}:out:${output ? `${output.content.length}:${output.sha256}` : 'missing'}`,
      );
      if (!input || !output) continue;
      items.push({
        index,
        inputBytes: input.content.length,
        outputBytes: output.content.length,
        inputSha256: input.sha256,
        outputSha256: output.sha256,
      });
    }
    if (items.some((item, position) => item.index !== position + 1)) {
      unsafeEntry = true;
    }
    return this.buildScan(
      items,
      anomalies,
      unsafeEntry,
      revisionParts.join('\n'),
    );
  }

  private buildScan(
    items: TestcaseMetadata[],
    anomalies: Array<{ index: number; missing: 'input' | 'output' }>,
    unsafeEntry: boolean,
    revisionSourceOverride?: string,
  ): TestcaseScanResult {
    const revisionSource =
      revisionSourceOverride ??
      items
        .map(
          (item) =>
            `${item.index}:in:${item.inputBytes}:${item.inputSha256}:out:${item.outputBytes}:${item.outputSha256}`,
        )
        .join('\n');
    return {
      testcaseCount: items.length,
      revision: this.sha256(Buffer.from(revisionSource, 'utf8')),
      valid: anomalies.length === 0 && !unsafeEntry,
      anomalies,
      items,
    };
  }

  private async commit(
    slug: string,
    testcases: TestcaseTextPair[],
  ): Promise<TestcaseScanResult> {
    const problemDirectory = this.problemDir(slug);
    const testcaseDirectory = this.testcasesDir(slug);
    const transactionId = randomUUID();
    const staging = path.join(
      problemDirectory,
      `.testcases-staging-${transactionId}`,
    );
    const backup = path.join(
      problemDirectory,
      `.testcases-backup-${transactionId}`,
    );
    let movedOriginal = false;
    let installed = false;
    await mkdir(problemDirectory, { recursive: true });
    await mkdir(staging);
    try {
      await Promise.all(
        testcases.flatMap((testcase, position) => {
          const index = position + 1;
          return [
            writeFile(
              path.join(staging, `${index}.in`),
              testcase.input,
              'utf8',
            ),
            writeFile(
              path.join(staging, `${index}.out`),
              testcase.expectedOutput,
              'utf8',
            ),
          ];
        }),
      );
      const stagedScan = await this.scanDirectory(staging);
      if (!stagedScan.valid || stagedScan.testcaseCount !== testcases.length) {
        throw new Error('Staged testcase verification failed.');
      }
      try {
        await this.renameDirectory(testcaseDirectory, backup);
        movedOriginal = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      try {
        await this.renameDirectory(staging, testcaseDirectory);
        installed = true;
      } catch (error) {
        if (movedOriginal)
          await this.renameDirectory(backup, testcaseDirectory);
        movedOriginal = false;
        throw error;
      }
      const committed = await this.scanDirectory(testcaseDirectory);
      if (!committed.valid || committed.revision !== stagedScan.revision) {
        throw new Error('Committed testcase verification failed.');
      }
      if (movedOriginal) {
        try {
          await rm(backup, { recursive: true, force: true });
          movedOriginal = false;
        } catch {
          this.logger.error(
            `Failed to remove testcase backup for problem=${slug}.`,
          );
        }
      }
      return committed;
    } catch (error) {
      if (installed && movedOriginal) {
        const failed = `${staging}-failed`;
        try {
          await this.renameDirectory(testcaseDirectory, failed);
          await this.renameDirectory(backup, testcaseDirectory);
          movedOriginal = false;
          await rm(failed, { recursive: true, force: true });
        } catch {
          this.logger.error(
            `Failed to restore testcase backup for problem=${slug}.`,
          );
        }
      } else if (installed) {
        await rm(testcaseDirectory, { recursive: true, force: true }).catch(
          () => undefined,
        );
      }
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  private async readAllUnlocked(
    directory: string,
    scan: TestcaseScanResult,
  ): Promise<TestcaseTextPair[]> {
    return Promise.all(
      scan.items.map(async ({ index }) => ({
        input: await readFile(path.join(directory, `${index}.in`), 'utf8'),
        expectedOutput: await readFile(
          path.join(directory, `${index}.out`),
          'utf8',
        ),
      })),
    );
  }

  private async readRegularFile(
    filePath: string,
  ): Promise<{ content: Buffer; sha256: string } | null> {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const content = await readFile(filePath);
    return { content, sha256: this.sha256(content) };
  }

  protected renameDirectory(from: string, to: string): Promise<void> {
    return rename(from, to);
  }

  private chunk(content: string, offset: number, size: number, sha256: string) {
    if (offset > content.length) {
      throw new TestcaseStoreError(
        'INVALID_ARGUMENT',
        'Offset exceeds testcase length.',
      );
    }
    const value = content.slice(offset, offset + size);
    const end = offset + value.length;
    return {
      content: value,
      offset,
      nextOffset: end < content.length ? end : null,
      totalChars: content.length,
      totalBytes: Buffer.byteLength(content, 'utf8'),
      sha256,
      complete: offset === 0 && end === content.length,
    };
  }

  private validatePayload(testcases: TestcaseTextPair[]): void {
    if (!Array.isArray(testcases) || testcases.length > this.maxCount) {
      throw new TestcaseStoreError(
        'TESTCASE_LIMIT_EXCEEDED',
        'Testcase count limit exceeded.',
      );
    }
    for (const testcase of testcases) {
      if (
        typeof testcase?.input !== 'string' ||
        typeof testcase?.expectedOutput !== 'string'
      ) {
        throw new TestcaseStoreError(
          'INVALID_ARGUMENT',
          'Invalid testcase content.',
        );
      }
      if (
        Buffer.byteLength(testcase.input, 'utf8') > this.maxFileBytes ||
        Buffer.byteLength(testcase.expectedOutput, 'utf8') > this.maxFileBytes
      ) {
        throw new TestcaseStoreError(
          'PAYLOAD_TOO_LARGE',
          'Testcase file is too large.',
        );
      }
    }
  }

  private assertValid(scan: TestcaseScanResult): void {
    if (!scan.valid) {
      throw new TestcaseStoreError(
        'TESTCASE_SET_INVALID',
        'Testcase set is incomplete or unsafe.',
      );
    }
  }

  private assertRevision(scan: TestcaseScanResult, expected: string): void {
    if (!/^[a-f0-9]{64}$/.test(expected) || scan.revision !== expected) {
      throw new TestcaseStoreError(
        'REVISION_CONFLICT',
        'Testcase revision conflict.',
      );
    }
  }

  private assertPositiveIndex(index: number): void {
    if (!Number.isSafeInteger(index) || index < 1) {
      throw new TestcaseStoreError(
        'INVALID_ARGUMENT',
        'Invalid testcase index.',
      );
    }
  }

  private validateSlug(slug: string): string {
    if (
      !slug ||
      slug.length > 200 ||
      slug.includes('..') ||
      /[\\/\0]/.test(slug)
    ) {
      throw new TestcaseStoreError(
        'INVALID_ARGUMENT',
        'Invalid problem identifier.',
      );
    }
    const resolved = path.resolve(this.problemsDir, slug);
    if (path.dirname(resolved) !== this.problemsDir) {
      throw new TestcaseStoreError(
        'INVALID_ARGUMENT',
        'Invalid problem identifier.',
      );
    }
    return slug;
  }

  private problemDir(slug: string): string {
    return path.join(this.problemsDir, slug);
  }

  private testcasesDir(slug: string): string {
    return path.join(this.problemDir(slug), 'testcases');
  }

  private sha256(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private readBoundedInteger(
    value: string | undefined,
    fallback: number,
    max: number,
  ): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0
      ? Math.min(parsed, max)
      : fallback;
  }
}
