import { describe, expect, it } from 'vitest';

// TEMPORARY PROOF FIXTURE - never merged, branch deleted straight after.
//
// This file sits outside lib/ on purpose. The previous vitest include glob was
// `lib/**/*.test.ts`, which would not have collected it at all: the unit-test
// step would have exited 0 and the check would have gone green with a failing
// test in the tree. With the unscoped include it is collected, so the job must
// go red - and this run is a pull_request event, the trigger a required status
// check actually evaluates.
describe('CI gate proof (outside lib/)', () => {
  it('is collected by the widened include glob and fails the job', () => {
    expect('collected outside lib/').toBe('never collected');
  });
});
