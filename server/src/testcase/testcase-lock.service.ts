import { Injectable } from '@nestjs/common';

interface LockState {
  readers: number;
  writer: boolean;
  queue: Array<{ write: boolean; resolve: () => void }>;
}

/** Fair, in-process read/write locks keyed by problem slug. */
@Injectable()
export class TestcaseLockService {
  private readonly locks = new Map<string, LockState>();

  withReadLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    return this.withLock(key, false, operation);
  }

  withWriteLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    return this.withLock(key, true, operation);
  }

  private async withLock<T>(
    key: string,
    write: boolean,
    operation: () => Promise<T>,
  ): Promise<T> {
    const state = this.getState(key);
    await this.acquire(state, write);
    try {
      return await operation();
    } finally {
      this.release(key, state, write);
    }
  }

  private getState(key: string): LockState {
    let state = this.locks.get(key);
    if (!state) {
      state = { readers: 0, writer: false, queue: [] };
      this.locks.set(key, state);
    }
    return state;
  }

  private acquire(state: LockState, write: boolean): Promise<void> {
    const writerQueued = state.queue.some((waiter) => waiter.write);
    if (
      write
        ? !state.writer && state.readers === 0
        : !state.writer && !writerQueued
    ) {
      if (write) state.writer = true;
      else state.readers += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => state.queue.push({ write, resolve }));
  }

  private release(key: string, state: LockState, write: boolean): void {
    if (write) state.writer = false;
    else state.readers -= 1;
    this.drain(state);
    if (!state.writer && state.readers === 0 && state.queue.length === 0) {
      this.locks.delete(key);
    }
  }

  private drain(state: LockState): void {
    if (state.writer || state.readers > 0 || state.queue.length === 0) return;
    if (state.queue[0].write) {
      state.writer = true;
      state.queue.shift()!.resolve();
      return;
    }
    while (state.queue[0] && !state.queue[0].write) {
      state.readers += 1;
      state.queue.shift()!.resolve();
    }
  }
}
