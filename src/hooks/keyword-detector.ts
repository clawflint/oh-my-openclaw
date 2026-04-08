export interface MessageContext {
  body: string;
  bodyForAgent?: string;
  from?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

export interface KeywordDetection {
  keyword: string;
  mode: string;
  args: string;
}

const KEYWORDS: Record<string, string> = {
  '/run': 'run',
  '/plan': 'plan',
  '/ultrawork': 'ultrawork',
  '/omoc': 'omoc',
  '/loop': 'loop',
  '/status': 'status',
};

export function detectKeywords(body: string): KeywordDetection | null {
  const trimmed = body.trim();
  for (const [keyword, mode] of Object.entries(KEYWORDS)) {
    if (trimmed.startsWith(keyword)) {
      const args = trimmed.slice(keyword.length).trim();
      return { keyword, mode, args };
    }
  }
  return null;
}

export function keywordDetectorHandler(context: MessageContext): void {
  const detection = detectKeywords(context.body);
  if (detection) {
    if (!context.metadata) context.metadata = {};
    context.metadata.omocKeyword = detection.keyword;
    context.metadata.omocMode = detection.mode;
    context.metadata.omocArgs = detection.args;
  }
}
