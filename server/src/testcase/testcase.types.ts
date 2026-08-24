export type TestcaseErrorCode =
  | 'TESTCASE_NOT_FOUND'
  | 'TESTCASE_SET_INVALID'
  | 'REVISION_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'TESTCASE_LIMIT_EXCEEDED'
  | 'INVALID_ARGUMENT';

export const MAX_TESTCASE_FILE_BYTES = 30 * 1024 * 1024;

export class TestcaseStoreError extends Error {
  constructor(
    readonly code: TestcaseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TestcaseStoreError';
  }
}

export interface TestcaseAnomaly {
  index: number;
  missing: 'input' | 'output';
}

export interface TestcaseMetadata {
  index: number;
  inputBytes: number;
  outputBytes: number;
  inputSha256: string;
  outputSha256: string;
}

export interface TestcaseScanResult {
  testcaseCount: number;
  revision: string;
  valid: boolean;
  anomalies: TestcaseAnomaly[];
  items: TestcaseMetadata[];
}

export interface TestcaseTextPair {
  input: string;
  expectedOutput: string;
}

export interface TestcaseChunk {
  content: string;
  offset: number;
  nextOffset: number | null;
  totalChars: number;
  totalBytes: number;
  sha256: string;
  complete: boolean;
}

export interface TestcaseReadResult {
  index: number;
  revision: string;
  input: TestcaseChunk;
  expectedOutput: TestcaseChunk;
}

export interface TestcaseMutationResult {
  testcaseCount: number;
  previousRevision: string;
  revision: string;
}

export interface TestcaseDeleteResult extends TestcaseMutationResult {
  renumbered: Array<{ from: number; to: number }>;
}
