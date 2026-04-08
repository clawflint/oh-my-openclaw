export type ApprovalMode = 'required' | 'auto' | 'skip';

export interface ApprovalRequest {
  stage: string;
  nextStage: string;
  summary: string;
  cost: number;
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
}

export function shouldRequestApproval(mode: ApprovalMode, stage: string): boolean {
  if (mode === 'skip') return false;
  if (mode === 'auto') return false;
  // 'required' — ask before build and review stages
  return stage === 'build' || stage === 'review';
}

export function formatApprovalRequest(request: ApprovalRequest): string {
  return [
    `🔒 Approval Required: ${request.stage} → ${request.nextStage}`,
    `Summary: ${request.summary}`,
    `Cost so far: $${request.cost.toFixed(4)}`,
    `Reply "approve" to continue or "reject" to stop.`,
  ].join('\n');
}

export function parseApprovalResponse(response: string): ApprovalDecision {
  const lower = response.trim().toLowerCase();
  if (lower === 'approve' || lower === 'yes' || lower === 'ok' || lower === 'continue') {
    return { approved: true };
  }
  return { approved: false, reason: response };
}
