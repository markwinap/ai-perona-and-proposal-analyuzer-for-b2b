export const AI_GENERATION_CONFIG = {
    TEMPERATURE: {
        DETERMINISTIC: 0.1,
        BALANCED: 0.3,
        CREATIVE: 0.7,
    },
    TOP_P: {
        PRECISE: 0.8,
        BALANCED: 0.9,
        DIVERSE: 0.95,
    },
    MAX_OUTPUT_TOKENS: {
        PERSONA_ANALYSIS: 2000,
        RFP_ANALYSIS: 1500,
        PROPOSAL_DRAFT: 3000,
        CHAT_REPLY: 1000,
        MEETING_ANALYSIS: 2000,
    },
    CACHE_TTL_SECONDS: {
        PERSONA_ANALYSIS: 60 * 60 * 24,
        RFP_ANALYSIS: 60 * 60 * 24,
        PROPOSAL_DRAFT: 60 * 60 * 24,
        PROPOSAL_CHAT_REPLY: 60 * 10,
    },
} as const;
