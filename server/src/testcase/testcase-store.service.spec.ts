import { ConfigService } from '@nestjs/config';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TestcaseLockService } from './testcase-lock.service';
import { TestcaseStoreService } from './testcase-store.service';
import {
  MAX_TESTCASE_FILE_BYTES,
  TestcaseStoreError,
} from './testcase.types';

describe('TestcaseStoreService', () => {
  let root: string;
  let service: TestcaseStoreService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'etloj-testcases-'));
    service = new TestcaseStoreService(
      {
        get: jest.fn((key: string) =>
          key === 'PROBLEMS_DIR' ? root : undefined,
        ),
      } as unknown as ConfigService,
      new TestcaseLockService(),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('uses a 30MB default and hard maximum for each testcase file', () => {
    expect(service.maxFileBytes).toBe(MAX_TESTCASE_FILE_BYTES);
  });

  it('rejects testcase files larger than 30MB', async () => {
    expect(() =>
      service.replaceAll('p', [
        {
          input: 'a'.repeat(MAX_TESTCASE_FILE_BYTES + 1),
          expectedOutput: '',
        },
      ]),
    ).toThrow(
      expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }),
    );
  });

  it('scans empty and numerically ordered complete testcases', async () => {
    expect(await service.scan('p')).toEqual(
      expect.objectContaining({ testcaseCount: 0, valid: true, items: [] }),
    );
    const directory = await testcaseDirectory('p');
    for (const index of [10, 2, 1]) {
      await writeFile(path.join(directory, `${index}.in`), `输入${index}`);
      await writeFile(path.join(directory, `${index}.out`), `输出${index}`);
    }

    const result = await service.scan('p');
    expect(result.items.map((item) => item.index)).toEqual([1, 2, 10]);
    expect(result.testcaseCount).toBe(3);
    expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reports missing pairs and refuses to mutate an invalid set', async () => {
    const directory = await testcaseDirectory('p');
    await writeFile(path.join(directory, '1.in'), 'secret');
    const result = await service.scan('p');
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        anomalies: [{ index: 1, missing: 'output' }],
      }),
    );
    await expect(
      service.replaceAll('p', [{ input: 'a', expectedOutput: 'b' }]),
    ).rejects.toMatchObject({ code: 'TESTCASE_SET_INVALID' });
    expect(await readFile(path.join(directory, '1.in'), 'utf8')).toBe('secret');
  });

  it('ignores illegal names and rejects matching symbolic links', async () => {
    const directory = await testcaseDirectory('p');
    await writeFile(path.join(directory, '01.in'), 'ignored');
    await writeFile(path.join(directory, 'notes.txt'), 'ignored');
    await writeFile(path.join(directory, 'source'), 'secret');
    try {
      await symlink(
        path.join(directory, 'source'),
        path.join(directory, '1.in'),
      );
    } catch {
      return; // Windows may not allow symlinks in an unprivileged test process.
    }
    await writeFile(path.join(directory, '1.out'), 'answer');
    expect(await service.scan('p')).toEqual(
      expect.objectContaining({ valid: false, testcaseCount: 0 }),
    );
  });

  it('reads UTF-8 chunks that losslessly reconstruct both fields', async () => {
    await service.replaceAll('p', [
      { input: '甲乙🙂丙丁', expectedOutput: '答案\n第二行' },
    ]);
    const first = await service.readChunk('p', 1, 0, 0, 3);
    const second = await service.readChunk(
      'p',
      1,
      first.input.nextOffset!,
      first.expectedOutput.nextOffset!,
      100,
    );
    expect(first.input.content + second.input.content).toBe('甲乙🙂丙丁');
    expect(first.expectedOutput.content + second.expectedOutput.content).toBe(
      '答案\n第二行',
    );
    expect(first.input.totalBytes).toBe(Buffer.byteLength('甲乙🙂丙丁'));
  });

  it('appends, checks revisions, and deletes with stable renumbering', async () => {
    const initial = await service.replaceAll('p', [
      { input: 'one', expectedOutput: '1' },
      { input: 'two', expectedOutput: '2' },
      { input: 'three', expectedOutput: '3' },
    ]);
    await expect(
      service.append(
        'p',
        { input: 'four', expectedOutput: '4' },
        '0'.repeat(64),
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    const appended = await service.append(
      'p',
      { input: 'four', expectedOutput: '4' },
      initial.revision,
    );
    expect(appended.addedIndex).toBe(4);
    const deleted = await service.deleteAndRenumber('p', 2, appended.revision);
    expect(deleted.renumbered).toEqual([
      { from: 3, to: 2 },
      { from: 4, to: 3 },
    ]);
    expect(await service.readAll('p')).toEqual([
      { input: 'one', expectedOutput: '1' },
      { input: 'three', expectedOutput: '3' },
      { input: 'four', expectedOutput: '4' },
    ]);
  });

  it('serializes same-problem writes without losing updates', async () => {
    const initial = await service.replaceAll('p', []);
    const results = await Promise.allSettled([
      service.append(
        'p',
        { input: 'a', expectedOutput: 'a' },
        initial.revision,
      ),
      service.append(
        'p',
        { input: 'b', expectedOutput: 'b' },
        initial.revision,
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    const reason = (rejected as PromiseRejectedResult).reason as unknown;
    expect(reason).toBeInstanceOf(TestcaseStoreError);
    expect((reason as TestcaseStoreError).code).toBe('REVISION_CONFLICT');
    expect(await service.readAll('p')).toHaveLength(1);
  });

  it('restores the original directory when the atomic exchange fails', async () => {
    class FailingExchangeStore extends TestcaseStoreService {
      private renameCalls = 0;

      protected override renameDirectory(
        from: string,
        to: string,
      ): Promise<void> {
        this.renameCalls += 1;
        if (this.renameCalls === 3) {
          const error = new Error(
            'simulated exchange failure',
          ) as NodeJS.ErrnoException;
          error.code = 'EACCES';
          return Promise.reject(error);
        }
        return super.renameDirectory(from, to);
      }
    }
    const failingService = new FailingExchangeStore(
      {
        get: (key: string) => (key === 'PROBLEMS_DIR' ? root : undefined),
      } as ConfigService,
      new TestcaseLockService(),
    );
    await failingService.replaceAll('p', [
      { input: 'original', expectedOutput: 'old' },
    ]);
    await expect(
      failingService.replaceAll('p', [
        { input: 'replacement', expectedOutput: 'new' },
      ]),
    ).rejects.toThrow('simulated exchange failure');

    expect(await failingService.readAll('p')).toEqual([
      { input: 'original', expectedOutput: 'old' },
    ]);
    expect(await readdir(path.join(root, 'p'))).toEqual(['testcases']);
  });

  async function testcaseDirectory(slug: string): Promise<string> {
    const directory = path.join(root, slug, 'testcases');
    await mkdir(directory, { recursive: true });
    return directory;
  }
});
