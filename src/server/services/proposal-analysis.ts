import { env } from "~/env";
import { AI_GENERATION_CONFIG } from "./ai-config";
import {
  summarizeProposalDraftPromptContext,
  summarizeRfpPromptContext,
} from "./context-summarizer";
import { applyTemplate, DEFAULT_PROMPTS } from "./prompt-defaults";
import { withResponseCache } from "./response-cache";

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

const buildPrompt = (input: RfpAnalysisInput, template?: string | null) => {
  const summarizedContext = summarizeRfpPromptContext(input);
  const activeTemplate = template ?? DEFAULT_PROMPTS.rfp_analysis.promptTemplate;
  return applyTemplate(activeTemplate, {
    CONTEXT: JSON.stringify(summarizedContext, null, 2),
  });
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

const buildProposalDraftPrompt = (input: RecommendationProposalInput, template?: string | null) => {
  const summarizedContext = summarizeProposalDraftPromptContext(input);
  const activeTemplate = template ?? DEFAULT_PROMPTS.proposal_draft.promptTemplate;
  return applyTemplate(activeTemplate, {
    CONTEXT: JSON.stringify(summarizedContext, null, 2),
  });
};

export async function analyzeRfpProposalWithAI(
  input: RfpAnalysisInput,
  promptOverride?: { promptTemplate?: string | null }
): Promise<RfpAnalysisResult> {
  const apiKey = env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackRfpAnalysis(input);
  }

  return withResponseCache({
    service: "rfp-analysis",
    input: {
      input,
      promptOverride,
      model: env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    ttlSeconds: AI_GENERATION_CONFIG.CACHE_TTL_SECONDS.RFP_ANALYSIS,
    compute: async () => {
      const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(input, promptOverride?.promptTemplate) }],
            },
          ],
          generationConfig: {
            temperature: AI_GENERATION_CONFIG.TEMPERATURE.DETERMINISTIC,
            topP: AI_GENERATION_CONFIG.TOP_P.PRECISE,
            maxOutputTokens: AI_GENERATION_CONFIG.MAX_OUTPUT_TOKENS.RFP_ANALYSIS,
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
    },
  });
}

export async function generateRfpProposalFromRecommendationWithAI(
  input: RecommendationProposalInput,
  promptOverride?: { promptTemplate?: string | null }
): Promise<GeneratedRfpProposalDraft> {
  const apiKey = env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackGeneratedProposalDraft(input);
  }

  return withResponseCache({
    service: "proposal-draft",
    input: {
      input,
      promptOverride,
      model: env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    ttlSeconds: AI_GENERATION_CONFIG.CACHE_TTL_SECONDS.PROPOSAL_DRAFT,
    compute: async () => {
      const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildProposalDraftPrompt(input, promptOverride?.promptTemplate) }],
            },
          ],
          generationConfig: {
            temperature: AI_GENERATION_CONFIG.TEMPERATURE.CREATIVE,
            topP: AI_GENERATION_CONFIG.TOP_P.DIVERSE,
            maxOutputTokens:
              AI_GENERATION_CONFIG.MAX_OUTPUT_TOKENS.PROPOSAL_DRAFT,
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
    },
  });
}