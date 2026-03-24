export type PromptKey = "persona_analysis" | "rfp_analysis" | "proposal_draft";

export type DefaultPrompt = {
  key: PromptKey;
  name: string;
  description: string;
  systemInstruction?: string;
  promptTemplate: string;
};

export const DEFAULT_PROMPTS: Record<PromptKey, DefaultPrompt> = {
  persona_analysis: {
    key: "persona_analysis",
    name: "Persona Analysis",
    description:
      "Analyzes a stakeholder persona and generates actionable insights, proposal targeting strategies, relationship tactics, and next best actions.",
    systemInstruction:
      "You are a senior B2B persona and proposal strategist. Produce evidence-based, practical recommendations. Return JSON only and do not include markdown code fences.",
    promptTemplate: `Analyze the persona and return JSON only with this exact schema:
{
  "personaInsights": ["..."],
  "proposalTargetingStrategy": ["..."],
  "relationshipStrengtheningTactics": ["..."],
  "stakeholderCommunicationGuidance": ["..."],
  "watchoutsAndFailureRisks": ["..."],
  "next3Actions": ["...", "...", "..."]
}

Rules:
- Every array should include 3-5 concise, actionable items.
- Ground recommendations in provided evidence.
- Factor in proposal outcome trends and communication behavior.
- Avoid generic advice.

PROPOSAL_HISTORY_SUMMARY:
{{HISTORY_SUMMARY}}

FULL_DATA:
{{FULL_DATA}}`,
  },

  rfp_analysis: {
    key: "rfp_analysis",
    name: "RFP Proposal Analysis",
    description:
      "Evaluates an RFP proposal context and returns win/loss risk signals, scores, and a concrete recommendation.",
    promptTemplate: `Analyze this RFP proposal context and provide a practical win/loss risk evaluation.

Return JSON only in this exact shape:
{
  "successSignals": "string",
  "failureSignals": "string",
  "successScore": 0,
  "failureRiskScore": 0,
  "recommendation": "string"
}

Rules:
- successScore and failureRiskScore must be integers from 0 to 100.
- Use only the provided context.
- Be concrete and concise.

CONTEXT:
{{CONTEXT}}`,
  },

  proposal_draft: {
    key: "proposal_draft",
    name: "Proposal Draft Generator",
    description:
      "Generates an executive-ready proposal draft from an AI recommendation, including title, summary, intent signals, technology fit, and rationale.",
    promptTemplate: `You are an expert enterprise solutions consultant preparing a high-quality RFP proposal draft based on an AI-generated recommendation.

Your goal is to produce a concise, executive-ready proposal that is actionable, outcome-driven, and clearly justified.

Return JSON only in this exact shape:
{
  "title": "string",
  "summary": "string",
  "intentSignals": "string",
  "technologyFit": "string",
  "rationale": "string"
}

DETAILED INSTRUCTIONS:

- title:
  - Make it specific, outcome-focused, and business-oriented.
  - Clearly reflect the value or transformation (not generic wording).

- summary:
  - 3–5 sentences max.
  - Clearly describe the proposed solution, expected business impact, and timeline or scope if implied.
  - Include measurable outcomes (e.g., % cost reduction, efficiency gain, revenue impact) when possible.

- intentSignals:
  - Identify key signals from the context that justify why this proposal is relevant now.
  - Reference business needs, pain points, constraints, or strategic priorities.
  - Avoid generic statements—tie directly to the input.

- technologyFit:
  - Explain why the recommended technology or approach is appropriate.
  - Include:
    - Compatibility with current systems (if mentioned)
    - Scalability and flexibility
    - Implementation complexity level (low/medium/high)
  - Highlight any assumptions clearly if data is incomplete.

- rationale:
  - Provide a structured justification including:
    - Business value (ROI, efficiency, risk reduction, growth)
    - Key trade-offs or alternatives (if implied)
    - Risks and mitigation strategies
  - Include at least 2 concrete risks and how they would be mitigated.
  - Keep it practical and decision-oriented.

GLOBAL RULES:
- Be concise but complete—no fluff.
- Prioritize clarity over technical jargon.
- Use only the context provided below—do not invent facts.
- If data is missing, make conservative assumptions and state them briefly.
- Avoid repetition across fields.
- Write in a tone suitable for senior management.

CONTEXT:
{{CONTEXT}}`,
  },
};

export const applyTemplate = (
  template: string,
  vars: Record<string, string>
): string => {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value),
    template
  );
};
