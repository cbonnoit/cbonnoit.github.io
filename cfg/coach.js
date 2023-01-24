export const PROMPT_TYPES = Object.freeze({
    SUMMARY_V2: 'SUMMARY_V2',
    MONOLOG: 'MONOLOG',
    NEXT_STEPS: 'NEXT_STEPS',
    CADENCE_FAST: 'CADENCE_FAST',
    SEQUENCE: 'SEQUENCE',
    OBJECTION_RESPONSE: 'OBJECTION_RESPONSE',
    TRIGGER: 'TRIGGER',
    BUYING_INTENT: 'BUYING_INTENT',
    TEXT_SUMMARY_PENDING: 'TEXT_SUMMARY_PENDING',
    TEXT_SUMMARY_ERROR: 'TEXT_SUMMARY_ERROR',
    TEXT_SUMMARY: 'TEXT_SUMMARY',
    COACHING_END: 'COACHING_END'
})

export const BEHAVIORAL_PROMPTS = [
  PROMPT_TYPES.MONOLOG, 
  PROMPT_TYPES.NEXT_STEPS,
  PROMPT_TYPES.CADENCE_FAST,
]

export const BEHAVIORAL_PROMPTS_TO_IMAGE = Object.freeze({
    [PROMPT_TYPES.MONOLOG]: '/images/monologue.png',
    [PROMPT_TYPES.CADENCE_FAST]: '/images/slow_down.png'
})
