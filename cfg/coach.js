export const SETTINGS = Object.freeze({
    BEHAVIORAL_COACHING: 'Behavioral coaching',
    PROGRESS_BAR: 'Progress bar',
    SUGGESTIONS: 'Suggestions',
    TALK_TIMELINE: 'Talk timeline',
});

export const SETTING_TO_TARGET_ELEMENT_MAP = Object.freeze({
    [SETTINGS.BEHAVIORAL_COACHING]: '#behavioral',
    [SETTINGS.PROGRESS_BAR]: '#progressBarContainer',
    [SETTINGS.SUGGESTIONS]: '#checklist',
    [SETTINGS.TALK_TIMELINE]: '#trellus-summary',
});

export const PROMPT_TYPES = Object.freeze({
    SUMMARY_V2: 'SUMMARY_V2',
    MONOLOG: 'MONOLOG',
    NEXT_STEPS: 'NEXT_STEPS',
    CADENCE_FAST: 'CADENCE_FAST',
    SEQUENCE: 'SEQUENCE',
    OBJECTION_RESPONSE: 'OBJECTION_RESPONSE'
})

export const BEHAVIORAL_PROMPTS = [PROMPT_TYPES.MONOLOG, PROMPT_TYPES.NEXT_STEPS, PROMPT_TYPES.CADENCE_FAST]

export const SETTING_TO_ONLY_DEMO_MODE = Object.freeze({
    [SETTINGS.BEHAVIORAL_COACHING]: false,
    [SETTINGS.PROGRESS_BAR]: true,
    [SETTINGS.SUGGESTIONS]: false,
    [SETTINGS.TALK_TIMELINE]: false,
})

export const PROMPTS_TO_ONLY_DEMO_MODE = Object.freeze({
    SUMMARY: false,
    MONOLOG: false,
    NEXT_STEPS: false,
    CADENCE_FAST: false,
    SEQUENCE: true,
    OBJECTION_RESPONSE: false
})

export const DEMO_MODE = false
