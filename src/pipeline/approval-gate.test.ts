import { describe, it, expect } from 'vitest';
import { shouldRequestApproval, formatApprovalRequest, parseApprovalResponse } from './approval-gate.js';

describe('shouldRequestApproval', () => {
  it('returns false for skip mode', () => {
    expect(shouldRequestApproval('skip', 'build')).toBe(false);
  });
  it('returns false for auto mode', () => {
    expect(shouldRequestApproval('auto', 'build')).toBe(false);
  });
  it('returns true for required mode at build stage', () => {
    expect(shouldRequestApproval('required', 'build')).toBe(true);
  });
  it('returns true for required mode at review stage', () => {
    expect(shouldRequestApproval('required', 'review')).toBe(true);
  });
  it('returns false for required mode at classify stage', () => {
    expect(shouldRequestApproval('required', 'classify')).toBe(false);
  });
});

describe('formatApprovalRequest', () => {
  it('formats request with all fields', () => {
    const r = formatApprovalRequest({ stage: 'plan', nextStage: 'build', summary: 'Add hello endpoint', cost: 0.05 });
    expect(r).toContain('Approval Required');
    expect(r).toContain('plan');
    expect(r).toContain('build');
    expect(r).toContain('$0.0500');
  });
});

describe('parseApprovalResponse', () => {
  it('approves on "approve"', () => { expect(parseApprovalResponse('approve').approved).toBe(true); });
  it('approves on "yes"', () => { expect(parseApprovalResponse('yes').approved).toBe(true); });
  it('approves on "ok"', () => { expect(parseApprovalResponse('ok').approved).toBe(true); });
  it('rejects on other text', () => {
    const r = parseApprovalResponse('no, too expensive');
    expect(r.approved).toBe(false);
    expect(r.reason).toBe('no, too expensive');
  });
});
