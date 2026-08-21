import { Module } from '@nestjs/common';
import { TestcaseLockService } from './testcase-lock.service';
import { TestcaseStoreService } from './testcase-store.service';

@Module({
  providers: [TestcaseLockService, TestcaseStoreService],
  exports: [TestcaseLockService, TestcaseStoreService],
})
export class TestcaseModule {}
