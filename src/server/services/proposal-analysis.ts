import { env } from "~/env";

type RfpAnalysisInput = {
  proposal: {
    title: string;
    summary?: string | null;
    intentSignals?: string | null;
    technologyFit?: string | null;
    status: string;
    outcome: string;
    outcomeReason?: string | null;
  };
  company: {
    name: string;
    industry?: string | null;
    businessIntent?: string | null;
    technologyIntent?: string | null;
    developmentStacks: string[];
    certifications: string[];
    standards: string[];
    partnerships: string[];
    referenceArchitectures: string[];
    engineeringGuidelines: string[];
  };
  stakeholders: Array<{
    fullName: string;
    role: string;
    influenceLevel: number;
    notes?: string | null;
    personalitySummary?: string | null;
    jobDescription?: string | null;
  }>;
  recentEvaluations: Array<{
    successSignals?: string | null;
    failureSignals?: string | null;
    successScore: number;
    failureRiskScore: number;
    recommendation?: string | null;
  }>;
};

type RecommendationProposalInput = {
  sourceProposal: {
    title: string;
    summary?: string | null;
    intentSignals?: string | null;
    technologyFit?: string | null;
  };
  company: {
    name: string;
    industry?: string | null;
    businessIntent?: string | null;
    technologyIntent?: string | null;
    developmentStacks: string[];
    certifications: string[];
    standards: string[];
    partnerships: string[];
    referenceArchitectures: string[];
    engineeringGuidelines: string[];
  };
  stakeholders: Array<{
    fullName: string;
    role: string;
    influenceLevel: number;
    notes?: string | null;
  }>;
  evaluation: {
    recommendation: string;
    successSignals?: string | null;
    failureSignals?: string | null;
    successScore: number;
    failureRiskScore: number;
  };
};

export type RfpAnalysisResult = {
  successSignals: string;
  failureSignals: string;
  successScore: number;
  failureRiskScore: number;
  recommendation: string;
  rawAnalysis: string;
};

export type GeneratedRfpProposalDraft = {
  title: string;
  summary: string;
  intentSignals: string;
  technologyFit: string;
  rationale: string;
  rawDraft: string;
};

const clampScore = (value: unknown, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

const fallbackRfpAnalysis = (input: RfpAnalysisInput): RfpAnalysisResult => {
  const stakeholderSignals = input.stakeholders
    .slice(0, 3)
    .map((stakeholder) => `${stakeholder.role}: ${stakeholder.fullName}`)
    .join(", ");

  const stack = input.company.developmentStacks.length
    ? input.company.developmentStacks.join(", ")
    : "no stack captured";

  const successSignals = [
    `Proposal aligns with company business intent: ${input.company.businessIntent ?? "not specified"}`,
    `Technology alignment appears viable against stack: ${stack}`,
    stakeholderSignals
      ? `Known stakeholders with influence are identified: ${stakeholderSignals}`
      : "Stakeholder mapping is currently limited.",
  ].join(" ");

  const failureSignals = [
    input.company.certifications.length === 0 && input.company.standards.length === 0
      ? "Compliance requirements are underspecified and may block approval."
      : "Compliance requirements are partially captured and should be validated in detail.",
    input.proposal.technologyFit
      ? "Technology fit exists but requires technical proof points in the RFP response."
      : "Technology fit details are thin and can reduce confidence.",
    "No explicit budget/timeline confidence indicators were provided.",
  ].join(" ");

  const recommendation = [
    "Build a role-specific executive summary for top stakeholders.",
    "Map each RFP requirement to architecture decisions and compliance evidence.",
    "Add a phased plan with delivery milestones, risk controls, and measurable outcomes.",
  ].join(" ");

  return {
    successSignals,
    failureSignals,
    successScore: 62,
    failureRiskScore: 38,
    recommendation,
    rawAnalysis: [
      "RFP Analysis (fallback)",
      `Proposal: ${input.proposal.title}`,
      `Company: ${input.company.name}`,
      "",
      `Success signals: ${successSignals}`,
      `Failure signals: ${failureSignals}`,
      `Recommendation: ${recommendation}`,
    ].join("\n"),
  };
};

const extractJsonObject = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
};

const buildPrompt = (input: RfpAnalysisInput) => {
  return `Analyze this RFP proposal context and provide a practical win/loss risk evaluation.

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
${JSON.stringify(input, null, 2)}`;
};

const fallbackGeneratedProposalDraft = (
  input: RecommendationProposalInput
): GeneratedRfpProposalDraft => {
  const title = `${input.sourceProposal.title} - Recommendation-Led Revision`;

  const summary = [
    `Generated from AI recommendation for ${input.company.name}.`,
    `Primary recommendation: ${input.evaluation.recommendation}`,
    input.sourceProposal.summary
      ? `Source summary context: ${input.sourceProposal.summary}`
      : "Source summary was limited; proposal scope has been reframed around clear outcomes.",
  ].join(" ");

  const intentSignals = [
    input.evaluation.successSignals ?? "Prior analysis highlighted positive intent for transformation.",
    input.company.businessIntent
      ? `Business intent alignment: ${input.company.businessIntent}`
      : "Business intent should be validated with executive stakeholders.",
    input.evaluation.failureSignals
      ? `Addressed risk signals: ${input.evaluation.failureSignals}`
      : "Risk controls were added based on prior evaluation context.",
  ].join(" ");

  const technologyFit = [
    input.sourceProposal.technologyFit
      ? `Technology fit baseline: ${input.sourceProposal.technologyFit}`
      : "Technology fit baseline was expanded from sparse source details.",
    input.company.developmentStacks.length > 0
      ? `Known stack: ${input.company.developmentStacks.join(", ")}.`
      : "Customer stack details should be confirmed during discovery.",
    input.company.certifications.length > 0 || input.company.standards.length > 0
      ? `Compliance references: ${[
        ...input.company.certifications,
        ...input.company.standards,
      ].join(", ")}.`
      : "Compliance evidence and architecture controls should be included in the next draft.",
  ].join(" ");

  const rationale = [
    "This draft proposal was generated from the latest AI recommendation.",
    `Latest analysis scores: success ${input.evaluation.successScore}, risk ${input.evaluation.failureRiskScore}.`,
    "The objective is to improve win probability by aligning narrative, risks, and technical evidence.",
  ].join(" ");

  const rawDraft = [
    "Generated proposal draft (fallback)",
    `Title: ${title}`,
    `Summary: ${summary}`,
    `Intent signals: ${intentSignals}`,
    `Technology fit: ${technologyFit}`,
    `Rationale: ${rationale}`,
  ].join("\n");

  return {
    title,
    summary,
    intentSignals,
    technologyFit,
    rationale,
    rawDraft,
  };
};

const buildProposalDraftPrompt = (input: RecommendationProposalInput) => {
  return `You are an expert enterprise solutions consultant preparing a high-quality RFP proposal draft based on an AI-generated recommendation.

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
${JSON.stringify(input, null, 2)}
`;
};

export async function analyzeRfpProposalWithAI(
  input: RfpAnalysisInput
): Promise<RfpAnalysisResult> {
  if (!env.GOOGLE_GEMINI_API_KEY) {
    return fallbackRfpAnalysis(input);
  }

  const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`RFP AI analysis request failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawAnalysis = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!rawAnalysis) {
    return fallbackRfpAnalysis(input);
  }

  const jsonText = extractJsonObject(rawAnalysis);
  if (!jsonText) {
    return {
      ...fallbackRfpAnalysis(input),
      rawAnalysis,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      successSignals?: unknown;
      failureSignals?: unknown;
      successScore?: unknown;
      failureRiskScore?: unknown;
      recommendation?: unknown;
    };

    return {
      successSignals:
        typeof parsed.successSignals === "string"
          ? parsed.successSignals
          : "No explicit success signals returned.",
      failureSignals:
        typeof parsed.failureSignals === "string"
          ? parsed.failureSignals
          : "No explicit failure signals returned.",
      successScore: clampScore(parsed.successScore, 60),
      failureRiskScore: clampScore(parsed.failureRiskScore, 40),
      recommendation:
        typeof parsed.recommendation === "string"
          ? parsed.recommendation
          : "No recommendation returned.",
      rawAnalysis,
    };
  } catch {
    return {
      ...fallbackRfpAnalysis(input),
      rawAnalysis,
    };
  }
}

export async function generateRfpProposalFromRecommendationWithAI(
  input: RecommendationProposalInput
): Promise<GeneratedRfpProposalDraft> {
  if (!env.GOOGLE_GEMINI_API_KEY) {
    return fallbackGeneratedProposalDraft(input);
  }

  const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildProposalDraftPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Proposal draft generation failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawDraft = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!rawDraft) {
    return fallbackGeneratedProposalDraft(input);
  }

  const jsonText = extractJsonObject(rawDraft);
  if (!jsonText) {
    return {
      ...fallbackGeneratedProposalDraft(input),
      rawDraft,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      title?: unknown;
      summary?: unknown;
      intentSignals?: unknown;
      technologyFit?: unknown;
      rationale?: unknown;
    };

    const fallback = fallbackGeneratedProposalDraft(input);

    return {
      title: typeof parsed.title === "string" && parsed.title.trim().length > 3
        ? parsed.title.trim()
        : fallback.title,
      summary: typeof parsed.summary === "string" && parsed.summary.trim().length > 3
        ? parsed.summary.trim()
        : fallback.summary,
      intentSignals:
        typeof parsed.intentSignals === "string" && parsed.intentSignals.trim().length > 3
          ? parsed.intentSignals.trim()
          : fallback.intentSignals,
      technologyFit:
        typeof parsed.technologyFit === "string" && parsed.technologyFit.trim().length > 3
          ? parsed.technologyFit.trim()
          : fallback.technologyFit,
      rationale:
        typeof parsed.rationale === "string" && parsed.rationale.trim().length > 3
          ? parsed.rationale.trim()
          : fallback.rationale,
      rawDraft,
    };
  } catch {
    return {
      ...fallbackGeneratedProposalDraft(input),
      rawDraft,
    };
  }
}