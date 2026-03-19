import { env } from "~/env";

type PersonaAnalysisInput = {
  fullName: string;
  companyName: string;
  jobDescription?: string | null;
  personalitySummary?: string | null;
  personalPreferences?: string | null;
  pastExperiences?: string | null;
  communications: Array<{
    type: string;
    subject?: string | null;
    content: string;
    occurredAt?: Date | null;
  }>;
  companySignals: {
    businessIntent?: string | null;
    technologyIntent?: string | null;
    developmentStacks: string[];
    certifications: string[];
    standards: string[];
    partnerships: string[];
    referenceArchitectures: string[];
    engineeringGuidelines: string[];
  };
  proposalHistory: Array<{
    title: string;
    outcome: string;
    status: string;
    summary?: string | null;
    intentSignals?: string | null;
    technologyFit?: string | null;
    outcomeReason?: string | null;
  }>;
};

type StructuredPersonaAnalysis = {
  personaInsights: string[];
  proposalTargetingStrategy: string[];
  relationshipStrengtheningTactics: string[];
  stakeholderCommunicationGuidance: string[];
  watchoutsAndFailureRisks: string[];
  next3Actions: string[];
};

const formatList = (values: string[]) =>
  values.length > 0 ? values.join(", ") : "none provided";

const fallbackAnalysis = (input: PersonaAnalysisInput) => {
  const recentComms = input.communications.slice(0, 4);
  const communicationThemes = recentComms
    .map((entry) => entry.content)
    .join("\n")
    .slice(0, 900);

  return [
    `Persona: ${input.fullName} @ ${input.companyName}`,
    "",
    "Relationship Strategy",
    `- Align to job focus: ${input.jobDescription ?? "not specified"}`,
    `- Personality cue: ${input.personalitySummary ?? "not specified"}`,
    `- Communication preferences: ${input.personalPreferences ?? "not specified"}`,
    "",
    "Proposal Targeting",
    `- Business intent: ${input.companySignals.businessIntent ?? "not specified"}`,
    `- Technology intent: ${input.companySignals.technologyIntent ?? "not specified"}`,
    `- Stack alignment: ${formatList(input.companySignals.developmentStacks)}`,
    `- Standards/compliance: ${formatList(input.companySignals.certifications)}; ${formatList(
      input.companySignals.standards
    )}`,
    "",
    "Recent Communication Themes",
    communicationThemes || "No communication records available.",
    "",
    "Outcome-Informed Guidance",
    "- Reuse narrative from successful proposals and avoid patterns from failed ones.",
    "- Start outreach with a concise executive summary, then include a phased delivery path.",
    "- Include compliance and reference architecture alignment in every proposal narrative.",
  ].join("\n");
};

const normalizeLines = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const lines = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);

  return lines.length > 0 ? lines : fallback;
};

const extractJsonObject = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
};

const formatSection = (title: string, lines: string[]) => {
  return [title, ...lines.map((line) => `- ${line}`), ""].join("\n");
};

const renderStructuredAnalysis = (analysis: StructuredPersonaAnalysis) => {
  return [
    formatSection("1) Persona Insights", analysis.personaInsights),
    formatSection(
      "2) Proposal Targeting Strategy",
      analysis.proposalTargetingStrategy
    ),
    formatSection(
      "3) Relationship Strengthening Tactics",
      analysis.relationshipStrengtheningTactics
    ),
    formatSection(
      "4) Stakeholder Communication Guidance",
      analysis.stakeholderCommunicationGuidance
    ),
    formatSection(
      "5) Watch-outs and Failure Risks",
      analysis.watchoutsAndFailureRisks
    ),
    formatSection("6) Next 3 Actions", analysis.next3Actions.slice(0, 3)),
  ].join("\n");
};

const parseStructuredAnalysis = (raw: string): StructuredPersonaAnalysis | null => {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      personaInsights?: unknown;
      proposalTargetingStrategy?: unknown;
      relationshipStrengtheningTactics?: unknown;
      stakeholderCommunicationGuidance?: unknown;
      watchoutsAndFailureRisks?: unknown;
      next3Actions?: unknown;
    };

    return {
      personaInsights: normalizeLines(parsed.personaInsights, [
        "Role context and behavioral traits are partially captured.",
      ]),
      proposalTargetingStrategy: normalizeLines(parsed.proposalTargetingStrategy, [
        "Map proposal messaging to business and technology intent.",
      ]),
      relationshipStrengtheningTactics: normalizeLines(
        parsed.relationshipStrengtheningTactics,
        ["Use concise, evidence-backed follow-ups with clear decision asks."]
      ),
      stakeholderCommunicationGuidance: normalizeLines(
        parsed.stakeholderCommunicationGuidance,
        ["Tailor communication depth and tone by stakeholder influence."]
      ),
      watchoutsAndFailureRisks: normalizeLines(parsed.watchoutsAndFailureRisks, [
        "Validate compliance and architecture constraints early.",
      ]),
      next3Actions: normalizeLines(parsed.next3Actions, [
        "Confirm success criteria with key stakeholders.",
        "Align proposal scope to prioritized pain points.",
        "Schedule a decision-focused follow-up.",
      ]),
    };
  } catch {
    return null;
  }
};

const buildPrompt = (input: PersonaAnalysisInput) => {
  const historySummary = {
    won: input.proposalHistory.filter((proposal) => proposal.outcome === "success")
      .length,
    lost: input.proposalHistory.filter((proposal) => proposal.outcome === "failure")
      .length,
    pending: input.proposalHistory.filter((proposal) => proposal.outcome === "pending")
      .length,
  };

  return `Analyze the persona and return JSON only with this exact schema:
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
${JSON.stringify(historySummary, null, 2)}

FULL_DATA:
${JSON.stringify(input, null, 2)}`;
};

export async function analyzePersonaWithAI(input: PersonaAnalysisInput) {
  if (!env.GOOGLE_GEMINI_API_KEY) {
    return `${fallbackAnalysis(input)}\n\n[AI runtime note] Set GOOGLE_GEMINI_API_KEY (and optionally GOOGLE_GEMINI_MODEL) in .env to enable model-driven analysis.`;
  }

  const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are a senior B2B persona and proposal strategist. Produce evidence-based, practical recommendations. Return JSON only and do not include markdown code fences.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI analysis request failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawContent = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!rawContent) {
    throw new Error("AI analysis returned an empty response.");
  }

  const structured = parseStructuredAnalysis(rawContent);
  if (!structured) {
    return rawContent;
  }

  return renderStructuredAnalysis(structured);
}
