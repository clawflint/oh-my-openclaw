export type ModelFamily = 'anthropic' | 'openai' | 'google' | 'unknown';

export function detectModelFamily(model: string): ModelFamily {
  if (model.startsWith('anthropic/') || model.includes('claude')) return 'anthropic';
  if (model.startsWith('openai/') || model.includes('gpt')) return 'openai';
  if (model.startsWith('google/') || model.includes('gemini')) return 'google';
  return 'unknown';
}

const FAMILY_PREFIXES: Record<ModelFamily, string> = {
  anthropic: `[System note: You respond best to structured, mechanics-driven instructions. Follow the format precisely. Use XML tags for structured output when helpful.]`,
  openai: `[System note: You respond best to principle-driven instructions. Focus on the intent behind each instruction. Be thorough and systematic.]`,
  google: `[System note: You are fast and efficient. Keep responses focused and concise. Prioritize speed over exhaustive analysis.]`,
  unknown: '',
};

const FAMILY_SUFFIXES: Record<ModelFamily, string> = {
  anthropic: `\n\nOutput format: Use clear headers and structured sections. Prefer bullet points for lists.`,
  openai: `\n\nApproach: Think step by step. Show your reasoning. Be comprehensive.`,
  google: `\n\nBe concise. Focus on the most important findings first.`,
  unknown: '',
};

export function adaptPromptForModel(prompt: string, model: string): string {
  const family = detectModelFamily(model);
  const prefix = FAMILY_PREFIXES[family];
  const suffix = FAMILY_SUFFIXES[family];
  if (!prefix && !suffix) return prompt;
  return `${prefix}\n\n${prompt}${suffix}`;
}
