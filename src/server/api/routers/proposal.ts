import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
    aiPrompts,
    generatedCommunications,
    proposalChatMessages,
    proposalChatSessions,
    proposalEvaluations,
    proposalOutcomeEnum,
    proposals,
    proposalStakeholders,
    proposalStatusEnum,
    stakeholderRoleEnum,
} from "~/server/db/schema";
import {
    analyzeRfpProposalWithAI,
    generateRfpProposalFromRecommendationWithAI,
} from "~/server/services/proposal-analysis";
import {
    buildProposalChatContext,
    generateProposalChatReply,
} from "~/server/services/proposal-chat";
import { DEFAULT_PROMPTS } from "~/server/services/prompt-defaults";
import { translateTextToSpanishLatam } from "~/server/services/translation";

const createMessage = (params: {
  companyName: string;
  proposalTitle: string;
  summary: string | null;
  stakeholderRole: string;
  successSignals: string | null;
  failureSignals: string | null;
  recommendation: string | null;
}) => {
  return [
    `Hello ${params.stakeholderRole},`,
    "",
    `I am reaching out with a proposal update for ${params.companyName}: \"${params.proposalTitle}\".`,
    params.summary ? `Proposal summary: ${params.summary}` : "",
    params.successSignals
      ? `Observed success signals: ${params.successSignals}`
      : "",
    params.failureSignals
      ? `Potential failure risks: ${params.failureSignals}`
      : "",
    params.recommendation
      ? `Recommended next step: ${params.recommendation}`
      : "Recommended next step: align on the implementation roadmap and measurable outcomes.",
    "",
    "I would value your feedback and suggest a short alignment session this week.",
  ]
    .filter(Boolean)
    .join("\n");
};

const loadProposalChatContext = async (
    ctx: { db: typeof import("~/server/db").db },
    proposalId: number
) => {
    const proposal = await ctx.db.query.proposals.findFirst({
        where: eq(proposals.id, proposalId),
        with: {
            company: true,
            stakeholders: {
                with: {
                    persona: true,
                },
            },
        },
    });

    if (!proposal) {
        throw new Error("Proposal not found");
    }

    const defaultContext = buildProposalChatContext({
        proposal: {
            id: proposal.id,
            title: proposal.title,
            summary: proposal.summary,
            intentSignals: proposal.intentSignals,
            technologyFit: proposal.technologyFit,
            status: proposal.status,
            outcome: proposal.outcome,
            outcomeReason: proposal.outcomeReason,
        },
        company: {
            name: proposal.company.name,
            industry: proposal.company.industry,
            businessIntent: proposal.company.businessIntent,
            technologyIntent: proposal.company.technologyIntent,
            developmentStacks: proposal.company.developmentStacks,
            certifications: proposal.company.certifications,
            standards: proposal.company.standards,
            partnerships: proposal.company.partnerships,
            referenceArchitectures: proposal.company.referenceArchitectures,
            engineeringGuidelines: proposal.company.engineeringGuidelines,
        },
        stakeholders: proposal.stakeholders.map((stakeholder) => ({
            fullName: stakeholder.persona.fullName,
            role: stakeholder.role,
            influenceLevel: stakeholder.influenceLevel,
            notes: stakeholder.notes,
            personalitySummary: stakeholder.persona.personalitySummary,
            jobDescription: stakeholder.persona.jobDescription,
        })),
    });

    return {
        proposal,
        defaultContext,
    };
};

const ensureProposalChatSession = async (
    ctx: { db: typeof import("~/server/db").db },
    proposalId: number
) => {
    const { defaultContext } = await loadProposalChatContext(ctx, proposalId);

    const existing = await ctx.db.query.proposalChatSessions.findFirst({
        where: eq(proposalChatSessions.proposalId, proposalId),
    });

    if (existing) {
        if (existing.defaultContext !== defaultContext) {
            const [updated] = await ctx.db
                .update(proposalChatSessions)
                .set({
                    defaultContext,
                    updatedAt: new Date(),
                })
                .where(eq(proposalChatSessions.id, existing.id))
                .returning();

            return updated ?? existing;
        }

        return existing;
    }

    const [created] = await ctx.db
        .insert(proposalChatSessions)
        .values({
            proposalId,
            defaultContext,
        })
        .returning();

    if (!created) {
        throw new Error("Failed to initialize proposal chat session.");
    }

    return created;
};

export const proposalRouter = createTRPCRouter({
    list: publicProcedure.query(async ({ ctx }) => {
        return ctx.db.query.proposals.findMany({
            orderBy: [desc(proposals.createdAt)],
            with: {
                company: true,
                evaluations: true,
                stakeholders: {
                    with: {
                        persona: true,
                    },
                },
            },
        });
    }),

    create: publicProcedure
        .input(
            z.object({
                companyId: z.number().int().positive(),
                title: z.string().min(3),
                summary: z.string().optional(),
                intentSignals: z.string().optional(),
                technologyFit: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [inserted] = await ctx.db
                .insert(proposals)
                .values({
                    companyId: input.companyId,
                    title: input.title,
                    summary: input.summary,
                    intentSignals: input.intentSignals,
                    technologyFit: input.technologyFit,
                })
                .returning();

            return inserted;
        }),

    update: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                title: z.string().min(3),
                summary: z.string().optional(),
                intentSignals: z.string().optional(),
                technologyFit: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [updated] = await ctx.db
                .update(proposals)
                .set({
                    title: input.title,
                    summary: input.summary,
                    intentSignals: input.intentSignals,
                    technologyFit: input.technologyFit,
                    updatedAt: new Date(),
                })
                .where(eq(proposals.id, input.proposalId))
                .returning();

            return updated;
        }),

    updateStatus: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                status: z.enum(proposalStatusEnum.enumValues),
                outcome: z.enum(proposalOutcomeEnum.enumValues),
                outcomeReason: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [updated] = await ctx.db
                .update(proposals)
                .set({
                    status: input.status,
                    outcome: input.outcome,
                    outcomeReason: input.outcomeReason,
                    updatedAt: new Date(),
                })
                .where(eq(proposals.id, input.proposalId))
                .returning();

            return updated;
        }),

    addStakeholder: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                personaId: z.number().int().positive(),
                role: z.enum(stakeholderRoleEnum.enumValues),
                influenceLevel: z.number().int().min(1).max(5).default(3),
                notes: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [inserted] = await ctx.db
                .insert(proposalStakeholders)
                .values({
                    proposalId: input.proposalId,
                    personaId: input.personaId,
                    role: input.role,
                    influenceLevel: input.influenceLevel,
                    notes: input.notes,
                })
                .onConflictDoUpdate({
                    target: [
                        proposalStakeholders.proposalId,
                        proposalStakeholders.personaId,
                        proposalStakeholders.role,
                    ],
                    set: {
                        influenceLevel: input.influenceLevel,
                        notes: input.notes,
                    },
                })
                .returning();

            return inserted;
        }),

    evaluate: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                successSignals: z.string().optional(),
                failureSignals: z.string().optional(),
                successScore: z.number().int().min(0).max(100),
                failureRiskScore: z.number().int().min(0).max(100),
                recommendation: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [inserted] = await ctx.db
                .insert(proposalEvaluations)
                .values({
                    proposalId: input.proposalId,
                    successSignals: input.successSignals,
                    failureSignals: input.failureSignals,
                    successScore: input.successScore,
                    failureRiskScore: input.failureRiskScore,
                    recommendation: input.recommendation,
                })
                .returning();

            return inserted;
        }),

    analyzeRfp: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const proposal = await ctx.db.query.proposals.findFirst({
                where: eq(proposals.id, input.proposalId),
                with: {
                    company: true,
                    stakeholders: {
                        with: {
                            persona: true,
                        },
                    },
                    evaluations: {
                        orderBy: [desc(proposalEvaluations.createdAt)],
                        limit: 3,
                    },
                },
            });

            if (!proposal) {
                throw new Error("Proposal not found");
            }

            const rfpPromptRecord = await ctx.db.query.aiPrompts.findFirst({
                where: eq(aiPrompts.key, "rfp_analysis"),
            });

            const analysis = await analyzeRfpProposalWithAI({
                proposal: {
                    title: proposal.title,
                    summary: proposal.summary,
                    intentSignals: proposal.intentSignals,
                    technologyFit: proposal.technologyFit,
                    status: proposal.status,
                    outcome: proposal.outcome,
                    outcomeReason: proposal.outcomeReason,
                },
                company: {
                    name: proposal.company.name,
                    industry: proposal.company.industry,
                    businessIntent: proposal.company.businessIntent,
                    technologyIntent: proposal.company.technologyIntent,
                    developmentStacks: proposal.company.developmentStacks,
                    certifications: proposal.company.certifications,
                    standards: proposal.company.standards,
                    partnerships: proposal.company.partnerships,
                    referenceArchitectures: proposal.company.referenceArchitectures,
                    engineeringGuidelines: proposal.company.engineeringGuidelines,
                },
                stakeholders: proposal.stakeholders.map((stakeholder) => ({
                    fullName: stakeholder.persona.fullName,
                    role: stakeholder.role,
                    influenceLevel: stakeholder.influenceLevel,
                    notes: stakeholder.notes,
                    personalitySummary: stakeholder.persona.personalitySummary,
                    jobDescription: stakeholder.persona.jobDescription,
                })),
                recentEvaluations: proposal.evaluations.map((evaluation) => ({
                    successSignals: evaluation.successSignals,
                    failureSignals: evaluation.failureSignals,
                    successScore: evaluation.successScore,
                    failureRiskScore: evaluation.failureRiskScore,
                    recommendation: evaluation.recommendation,
                })),
            }, {
                promptTemplate: rfpPromptRecord?.promptTemplate ?? DEFAULT_PROMPTS.rfp_analysis.promptTemplate,
            });

            const [insertedEvaluation] = await ctx.db
                .insert(proposalEvaluations)
                .values({
                    proposalId: proposal.id,
                    successSignals: analysis.successSignals,
                    failureSignals: analysis.failureSignals,
                    successScore: analysis.successScore,
                    failureRiskScore: analysis.failureRiskScore,
                    recommendation: analysis.recommendation,
                })
                .returning();

            return {
                proposalId: proposal.id,
                proposalTitle: proposal.title,
                companyName: proposal.company.name,
                analysis,
                evaluation: insertedEvaluation,
            };
        }),

    generateRfpProposalFromRecommendation: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                evaluationId: z.number().int().positive().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const sourceProposal = await ctx.db.query.proposals.findFirst({
                where: eq(proposals.id, input.proposalId),
                with: {
                    company: true,
                    stakeholders: {
                        with: {
                            persona: true,
                        },
                    },
                    evaluations: {
                        orderBy: [desc(proposalEvaluations.createdAt)],
                        limit: 20,
                    },
                },
            });

            if (!sourceProposal) {
                throw new Error("Proposal not found");
            }

            const selectedEvaluation = input.evaluationId
                ? sourceProposal.evaluations.find((evaluation) => evaluation.id === input.evaluationId) ?? null
                : sourceProposal.evaluations[0] ?? null;

            if (!selectedEvaluation) {
                throw new Error("No evaluation found. Run AI analysis first.");
            }

            if (!selectedEvaluation.recommendation?.trim()) {
                throw new Error("Selected analysis has no recommendation to generate from.");
            }

            const draftPromptRecord = await ctx.db.query.aiPrompts.findFirst({
                where: eq(aiPrompts.key, "proposal_draft"),
            });

            const draft = await generateRfpProposalFromRecommendationWithAI({
                sourceProposal: {
                    title: sourceProposal.title,
                    summary: sourceProposal.summary,
                    intentSignals: sourceProposal.intentSignals,
                    technologyFit: sourceProposal.technologyFit,
                },
                company: {
                    name: sourceProposal.company.name,
                    industry: sourceProposal.company.industry,
                    businessIntent: sourceProposal.company.businessIntent,
                    technologyIntent: sourceProposal.company.technologyIntent,
                    developmentStacks: sourceProposal.company.developmentStacks,
                    certifications: sourceProposal.company.certifications,
                    standards: sourceProposal.company.standards,
                    partnerships: sourceProposal.company.partnerships,
                    referenceArchitectures: sourceProposal.company.referenceArchitectures,
                    engineeringGuidelines: sourceProposal.company.engineeringGuidelines,
                },
                stakeholders: sourceProposal.stakeholders.map((stakeholder) => ({
                    fullName: stakeholder.persona.fullName,
                    role: stakeholder.role,
                    influenceLevel: stakeholder.influenceLevel,
                    notes: stakeholder.notes,
                })),
                evaluation: {
                    recommendation: selectedEvaluation.recommendation,
                    successSignals: selectedEvaluation.successSignals,
                    failureSignals: selectedEvaluation.failureSignals,
                    successScore: selectedEvaluation.successScore,
                    failureRiskScore: selectedEvaluation.failureRiskScore,
                },
            }, {
                promptTemplate: draftPromptRecord?.promptTemplate ?? DEFAULT_PROMPTS.proposal_draft.promptTemplate,
            });

            const [newProposal] = await ctx.db
                .insert(proposals)
                .values({
                    companyId: sourceProposal.companyId,
                    title: draft.title,
                    summary: draft.summary,
                    intentSignals: draft.intentSignals,
                    technologyFit: draft.technologyFit,
                    status: "draft",
                    outcome: "pending",
                })
                .returning();

            if (!newProposal) {
                throw new Error("Failed to create generated proposal draft.");
            }

            if (sourceProposal.stakeholders.length > 0) {
                await ctx.db.insert(proposalStakeholders).values(
                    sourceProposal.stakeholders.map((stakeholder) => ({
                        proposalId: newProposal.id,
                        personaId: stakeholder.personaId,
                        role: stakeholder.role,
                        influenceLevel: stakeholder.influenceLevel,
                        notes: stakeholder.notes,
                    }))
                );
            }

            return {
                proposal: newProposal,
                sourceProposalId: sourceProposal.id,
                sourceEvaluationId: selectedEvaluation.id,
                draft,
            };
        }),

    generateCommunicationTarget: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                stakeholderRole: z.enum(stakeholderRoleEnum.enumValues),
                personaId: z.number().int().positive().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const proposal = await ctx.db.query.proposals.findFirst({
                where: eq(proposals.id, input.proposalId),
                with: {
                    company: true,
                    evaluations: {
                        orderBy: [desc(proposalEvaluations.createdAt)],
                        limit: 1,
                    },
                },
            });

            if (!proposal) {
                throw new Error("Proposal not found");
            }

            const latestEvaluation = proposal.evaluations[0];

            const message = createMessage({
                companyName: proposal.company.name,
                proposalTitle: proposal.title,
                summary: proposal.summary,
                stakeholderRole: input.stakeholderRole,
                successSignals: latestEvaluation?.successSignals ?? null,
                failureSignals: latestEvaluation?.failureSignals ?? null,
                recommendation: latestEvaluation?.recommendation ?? null,
            });

            const [inserted] = await ctx.db
                .insert(generatedCommunications)
                .values({
                    proposalId: input.proposalId,
                    personaId: input.personaId,
                    stakeholderRole: input.stakeholderRole,
                    aiProvider: "google_gemini",
                    promptContext: `status=${proposal.status}; outcome=${proposal.outcome}`,
                    generatedMessage: message,
                })
                .returning();

            return inserted;
        }),

    listGeneratedCommunications: publicProcedure
        .input(
            z
                .object({
                    proposalId: z.number().int().positive().optional(),
                })
                .optional()
        )
        .query(async ({ ctx, input }) => {
            return ctx.db.query.generatedCommunications.findMany({
                where: input?.proposalId
                    ? eq(generatedCommunications.proposalId, input.proposalId)
                    : undefined,
                orderBy: [desc(generatedCommunications.createdAt)],
                with: {
                    proposal: true,
                    persona: true,
                },
            });
        }),

    getChatSession: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
            })
        )
        .query(async ({ ctx, input }) => {
            const session = await ensureProposalChatSession(ctx, input.proposalId);

            const messages = await ctx.db.query.proposalChatMessages.findMany({
                where: eq(proposalChatMessages.sessionId, session.id),
                orderBy: [asc(proposalChatMessages.createdAt)],
            });

            return {
                session,
                messages,
            };
        }),

    sendChatMessage: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                message: z.string().min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const session = await ensureProposalChatSession(ctx, input.proposalId);

            const [userMessage] = await ctx.db
                .insert(proposalChatMessages)
                .values({
                    sessionId: session.id,
                    role: "user",
                    content: input.message,
                })
                .returning();

            if (!userMessage) {
                throw new Error("Failed to persist user chat message.");
            }

            const history = await ctx.db.query.proposalChatMessages.findMany({
                where: eq(proposalChatMessages.sessionId, session.id),
                orderBy: [asc(proposalChatMessages.createdAt)],
            });

            const assistantReply = await generateProposalChatReply({
                defaultContext: session.defaultContext,
                history: history
                    .filter((message) => message.id !== userMessage.id)
                    .map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                userMessage: input.message,
            });

            const [assistantMessage] = await ctx.db
                .insert(proposalChatMessages)
                .values({
                    sessionId: session.id,
                    role: "assistant",
                    content: assistantReply,
                })
                .returning();

            if (!assistantMessage) {
                throw new Error("Failed to persist assistant chat message.");
            }

            await ctx.db
                .update(proposalChatSessions)
                .set({
                    updatedAt: new Date(),
                })
                .where(eq(proposalChatSessions.id, session.id));

            return {
                userMessage,
                assistantMessage,
            };
        }),

    resetChatHistory: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const refreshed = await ensureProposalChatSession(ctx, input.proposalId);

            await ctx.db
                .delete(proposalChatMessages)
                .where(eq(proposalChatMessages.sessionId, refreshed.id));

            await ctx.db
                .update(proposalChatSessions)
                .set({
                    defaultContext: refreshed.defaultContext,
                    updatedAt: new Date(),
                })
                .where(eq(proposalChatSessions.id, refreshed.id));

            return {
                sessionId: refreshed.id,
                defaultContext: refreshed.defaultContext,
                cleared: true,
            };
        }),

    translateAnalysis: publicProcedure
        .input(
            z.object({
                analysis: z.string().min(1),
            })
        )
        .mutation(async ({ input }) => {
            const translatedAnalysis = await translateTextToSpanishLatam(input.analysis);

            return {
                translatedAnalysis,
            };
        }),

    delete: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [deleted] = await ctx.db
                .delete(proposals)
                .where(eq(proposals.id, input.proposalId))
                .returning();

            return deleted;
        }),
});
