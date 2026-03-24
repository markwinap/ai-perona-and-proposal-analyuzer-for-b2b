import { env } from "~/env";

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
}): string => {
  const contextPreview = params.defaultContext.split("\n").slice(0, 6).join("\n");
  return [
    "I can help shape this proposal conversation from the selected context.",
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
  if (!env.GOOGLE_GEMINI_API_KEY) {
    return fallbackReply({
      defaultContext: params.defaultContext,
      userMessage: params.userMessage,
    });
  }

  const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

  const contents = params.history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: params.userMessage }],
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              "You are a senior B2B proposal conversation assistant.",
              "Use only the provided proposal/company/stakeholder context and conversation history.",
              "Give practical, concise guidance and clearly state assumptions.",
              "Do not return markdown code fences.",
              "",
              "DEFAULT CONTEXT:",
              params.defaultContext,
            ].join("\n"),
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Proposal chat request failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!raw) {
    return fallbackReply({
      defaultContext: params.defaultContext,
      userMessage: params.userMessage,
    });
  }

  return raw;
}
