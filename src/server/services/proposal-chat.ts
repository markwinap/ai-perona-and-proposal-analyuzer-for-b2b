import { env } from "~/env";
import { AI_GENERATION_CONFIG } from "./ai-config";
import { SYSTEM_INSTRUCTIONS } from "./prompt-fragments";
import { getCachedValue, setCachedValue } from "./response-cache";

type ChatRole = "user" | "assistant";

type ProposalChatContext = {
  proposal: {
    id: number;
    title: string;
    summary: string | null;
    intentSignals: string | null;
    technologyFit: string | null;
    status: string;
    outcome: string;
    outcomeReason: string | null;
  };
  company: {
    name: string;
    industry: string | null;
    businessIntent: string | null;
    technologyIntent: string | null;
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
    notes: string | null;
    personalitySummary: string | null;
    jobDescription: string | null;
  }>;
};

type ChatMessage = {
  role: ChatRole;
  content: string;
};

const formatList = (values: string[]) =>
  values.length > 0 ? values.join(", ") : "none provided";

export const buildProposalChatContext = (context: ProposalChatContext) => {
  const stakeholderLines = context.stakeholders.length
    ? context.stakeholders
        .map(
          (stakeholder) =>
            `- ${stakeholder.fullName} (${stakeholder.role}, influence ${stakeholder.influenceLevel}/5)${
              stakeholder.notes ? ` | notes: ${stakeholder.notes}` : ""
            }${
              stakeholder.personalitySummary
                ? ` | personality: ${stakeholder.personalitySummary}`
                : ""
            }${stakeholder.jobDescription ? ` | job: ${stakeholder.jobDescription}` : ""}`
        )
        .join("\n")
    : "- none linked";

  return [
    `Proposal #${context.proposal.id}: ${context.proposal.title}`,
    `Proposal summary: ${context.proposal.summary ?? "not provided"}`,
    `Intent signals: ${context.proposal.intentSignals ?? "not provided"}`,
    `Technology fit: ${context.proposal.technologyFit ?? "not provided"}`,
    `Status: ${context.proposal.status}`,
    `Outcome: ${context.proposal.outcome}`,
    `Outcome reason: ${context.proposal.outcomeReason ?? "not provided"}`,
    "",
    `Target company: ${context.company.name}`,
    `Industry: ${context.company.industry ?? "not provided"}`,
    `Business intent: ${context.company.businessIntent ?? "not provided"}`,
    `Technology intent: ${context.company.technologyIntent ?? "not provided"}`,
    `Development stacks: ${formatList(context.company.developmentStacks)}`,
    `Certifications: ${formatList(context.company.certifications)}`,
    `Standards: ${formatList(context.company.standards)}`,
    `Partnerships: ${formatList(context.company.partnerships)}`,
    `Reference architectures: ${formatList(context.company.referenceArchitectures)}`,
    `Engineering guidelines: ${formatList(context.company.engineeringGuidelines)}`,
    "",
    "Stakeholders:",
    stakeholderLines,
  ].join("\n");
};

const fallbackReply = (params: {
  defaultContext: string;
  userMessage: string;
  serviceBusy?: boolean;
}): string => {
  const contextPreview = params.defaultContext.split("\n").slice(0, 6).join("\n");
  return [
    params.serviceBusy
      ? "The AI service is temporarily busy, so I generated a fallback response from local context."
      : "I can help shape this proposal conversation from the selected context.",
    "",
    "Context snapshot:",
    contextPreview,
    "",
    `You asked: ${params.userMessage}`,
    "",
    "Suggested next step:",
    "- Confirm stakeholder priorities and map the response to business intent, risk constraints, and measurable outcomes.",
  ].join("\n");
};

export async function generateProposalChatReply(params: {
  defaultContext: string;
  history: ChatMessage[];
  userMessage: string;
}): Promise<string> {
  const apiKey = env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackReply({
      defaultContext: params.defaultContext,
      userMessage: params.userMessage,
    });
  }

  const cacheInput = {
    defaultContext: params.defaultContext,
    history: params.history,
    userMessage: params.userMessage,
    model: env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash",
  };

  const cached = getCachedValue<string>("proposal-chat-reply", cacheInput);
  if (cached !== null) {
    return cached;
  }

  const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = params.history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: params.userMessage }],
  });

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text: [
            SYSTEM_INSTRUCTIONS.B2B_PROPOSAL_CHAT_ASSISTANT,
            "",
            "DEFAULT CONTEXT:",
            params.defaultContext,
          ].join("\n"),
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: AI_GENERATION_CONFIG.TEMPERATURE.BALANCED,
      topP: AI_GENERATION_CONFIG.TOP_P.BALANCED,
      maxOutputTokens: AI_GENERATION_CONFIG.MAX_OUTPUT_TOKENS.CHAT_REPLY,
    },
  });

  const retryableStatusCodes = new Set([429, 500, 502, 503, 504]);
  const maxAttempts = 3;
  let lastStatus: number | null = null;
  let rawText: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };

        rawText = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("\n")
          .trim() ?? null;
        break;
      }

      lastStatus = response.status;
      if (!retryableStatusCodes.has(response.status) || attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    } catch {
      if (attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    }
  }

  if (!rawText) {
    return fallbackReply({
      defaultContext: params.defaultContext,
      userMessage: params.userMessage,
      serviceBusy: lastStatus === 429 || lastStatus === 503,
    });
  }

  setCachedValue(
    "proposal-chat-reply",
    cacheInput,
    rawText,
    AI_GENERATION_CONFIG.CACHE_TTL_SECONDS.PROPOSAL_CHAT_REPLY
  );

  return rawText;
}
