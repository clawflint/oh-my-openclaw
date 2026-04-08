export const AI_SLOP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\/\/\s*TODO:?\s*implement/i, label: 'TODO implement placeholder' },
  { pattern: /\/\/\s*Add\s+(your|actual|real)\s+/i, label: 'Add your/actual placeholder' },
  { pattern: /\/\/\s*\.\.\.\s*(rest|more|remaining|other)/i, label: 'Ellipsis placeholder' },
  { pattern: /\/\/\s*Handle\s+(error|edge|other)\s+cases?\s*here/i, label: 'Handle cases placeholder' },
  { pattern: /\/\/\s*Implementation\s+(goes|left)\s+/i, label: 'Implementation placeholder' },
  { pattern: /throw\s+new\s+Error\(\s*['"]Not\s+implemented/i, label: 'Not implemented throw' },
  { pattern: /\/\/\s*Replace\s+with\s+(actual|real|your)/i, label: 'Replace with actual' },
  { pattern: /\/\/\s*Placeholder/i, label: 'Placeholder comment' },
  { pattern: /\/\/\s*Stub/i, label: 'Stub comment' },
  { pattern: /console\.log\(\s*['"]TODO/i, label: 'Console TODO' },
  { pattern: /\/\/\s*HACK:?\s/i, label: 'HACK comment' },
];

export interface SlopDetection {
  pattern: string;
  label: string;
  line: string;
  lineNumber: number;
}

export function detectAiSlop(text: string): SlopDetection[] {
  const detections: SlopDetection[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, label } of AI_SLOP_PATTERNS) {
      if (pattern.test(lines[i])) {
        detections.push({ pattern: pattern.source, label, line: lines[i].trim(), lineNumber: i + 1 });
      }
    }
  }
  return detections;
}

export interface CommentCheckerContext {
  toolName: string;
  result: string;
  metadata?: Record<string, unknown>;
}

export function commentCheckerHandler(context: CommentCheckerContext): string | undefined {
  if (!['write', 'edit'].includes(context.toolName)) return undefined;
  const detections = detectAiSlop(context.result);
  if (detections.length === 0) return undefined;
  const report = detections.map(d => `  Line ${d.lineNumber}: ${d.label} — "${d.line}"`).join('\n');
  return `⚠️ AI slop detected in ${context.toolName} result (${detections.length} issues):\n${report}\nYou MUST fix these before proceeding. Remove placeholders and implement real code.`;
}
