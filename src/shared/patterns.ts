/**
 * Shared regex patterns for detecting incomplete work.
 * Used by todo-enforcer and ralph-loop to avoid duplication.
 */
export const INCOMPLETE_WORK_PATTERNS = [
  /TODO[:\s]/i,
  /FIXME[:\s]/i,
  /\[ \]/,
  /not yet implemented/i,
  /placeholder/i,
  /will implement later/i,
  /needs implementation/i,
  /stub/i,
  /incomplete/i,
];
