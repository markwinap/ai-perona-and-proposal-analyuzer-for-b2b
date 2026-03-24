import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
    aiPrompts,
    generatedCommunications,
    proposalChatMessages,
    proposalChatSessions,
    proposalEvaluations,
    proposalMeetings,
    proposalMeetingSpeakers,
    proposalMeetingTranscripts,
    proposalOutcomeEnum,
    proposals,
    proposalStakeholders,
    proposalStatusEnum,
    stakeholderRoleEnum,
    transcriptionTypeEnum,
} from "~/server/db/schema";
import {
    analyzeRfpProposalWithAI,
    generateRfpProposalFromRecommendationWithAI,
} from "~/server/services/proposal-analysis";
import {
    buildProposalChatContext,
    generateProposalChatReply,
} from "~/server/services/proposal-chat";
import {
    extractSpeakerSegments,
    generateMeetingAnalysis,
    generateMeetingNextSteps,
    generateMeetingSummary,
    uploadAudioToAssemblyAI,
    waitForAssemblyAITranscript,
    getAssemblyAIRealtimeToken,
    mergeSpeakerSegments,
} from "~/server/services/meeting-notes";
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

    updateGeneratedCommunication: publicProcedure
        .input(
            z.object({
                generatedCommunicationId: z.number().int().positive(),
                generatedMessage: z.string().trim().min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [updated] = await ctx.db
                .update(generatedCommunications)
                .set({
                    generatedMessage: input.generatedMessage,
                })
                .where(eq(generatedCommunications.id, input.generatedCommunicationId))
                .returning();

            if (!updated) {
                throw new Error("Generated communication not found");
            }

            return updated;
        }),

    duplicateGeneratedCommunication: publicProcedure
        .input(
            z.object({
                generatedCommunicationId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.query.generatedCommunications.findFirst({
                where: eq(generatedCommunications.id, input.generatedCommunicationId),
            });

            if (!existing) {
                throw new Error("Generated communication not found");
            }

            const [duplicated] = await ctx.db
                .insert(generatedCommunications)
                .values({
                    proposalId: existing.proposalId,
                    personaId: existing.personaId,
                    stakeholderRole: existing.stakeholderRole,
                    aiProvider: existing.aiProvider,
                    promptContext: existing.promptContext,
                    generatedMessage: existing.generatedMessage,
                })
                .returning();

            return duplicated;
        }),

    deleteGeneratedCommunication: publicProcedure
        .input(
            z.object({
                generatedCommunicationId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [deleted] = await ctx.db
                .delete(generatedCommunications)
                .where(eq(generatedCommunications.id, input.generatedCommunicationId))
                .returning();

            if (!deleted) {
                throw new Error("Generated communication not found");
            }

            return deleted;
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

    createMeetingNote: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                title: z.string().min(1),
                description: z.string().optional(),
                transcriptionType: z.enum(transcriptionTypeEnum.enumValues).default("manual_notes"),
                audioUrl: z.string().url().optional(),
                manualTranscript: z.string().optional(),
                recordingDate: z.date().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Validate input based on transcription type
            if (input.transcriptionType === "assembly_ai" && !input.audioUrl) {
                throw new Error("Audio URL is required for AssemblyAI transcription");
            }
            if (input.transcriptionType === "manual_transcript" && !input.manualTranscript) {
                throw new Error("Transcript text is required for manual transcription");
            }

            // Create the meeting note
            const [meeting] = await ctx.db
                .insert(proposalMeetings)
                .values({
                    proposalId: input.proposalId,
                    title: input.title,
                    description: input.description,
                    audioUrl: input.audioUrl,
                    transcriptionType: input.transcriptionType,
                    manualTranscript: input.manualTranscript,
                    recordingDate: input.recordingDate ?? new Date(),
                })
                .returning();

            if (!meeting) {
                throw new Error("Failed to create meeting note");
            }

            // Handle AssemblyAI transcription
            if (input.transcriptionType === "assembly_ai" && input.audioUrl) {
                try {
                    const transcriptId = await uploadAudioToAssemblyAI(input.audioUrl);
                    const updated = await ctx.db
                        .update(proposalMeetings)
                        .set({ assemblyAiTranscriptId: transcriptId })
                        .where(eq(proposalMeetings.id, meeting.id))
                        .returning();

                    return updated[0];
                } catch (error) {
                    console.error("AssemblyAI upload failed:", error);
                    return meeting;
                }
            }

            // For manual transcription, process it immediately
            if (input.transcriptionType === "manual_transcript" && input.manualTranscript) {
                return meeting;
            }

            return meeting;
        }),

    getMeetingNotes: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
            }).optional()
        )
        .query(async ({ ctx, input }) => {
            if (!input?.proposalId) {
                return [];
            }

            const meetings = await ctx.db.query.proposalMeetings.findMany({
                where: eq(proposalMeetings.proposalId, input.proposalId),
                with: {
                    speakers: {
                        with: {
                            linkedStakeholder: true,
                        },
                    },
                    transcripts: true,
                },
                orderBy: [desc(proposalMeetings.recordingDate)],
            });

            return meetings;
        }),

    deleteMeetingNote: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const [deleted] = await ctx.db
                .delete(proposalMeetings)
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            if (!deleted) {
                throw new Error("Meeting note not found");
            }

            return deleted;
        }),

    processMeetingTranscription: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
                manualSegments: z.array(
                    z.object({
                        speakerId: z.number().int().nonnegative(),
                        speakerLabel: z.string(),
                        text: z.string(),
                    })
                ).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const meeting = await ctx.db.query.proposalMeetings.findFirst({
                where: eq(proposalMeetings.id, input.meetingId),
            });

            if (!meeting) {
                throw new Error("Meeting not found");
            }

            // Handle AssemblyAI transcription
            if (meeting.transcriptionType === "assembly_ai") {
                if (!meeting.assemblyAiTranscriptId) {
                    throw new Error("Meeting not found or transcription not started");
                }

                // Wait for transcription to complete and get results
                const transcript = await waitForAssemblyAITranscript(meeting.assemblyAiTranscriptId);

                // Extract speaker segments
                const segments = extractSpeakerSegments(transcript);

                // Store speakers
                const speakers = new Map<number, boolean>();
                for (const segment of segments) {
                    if (!speakers.has(segment.speakerId)) {
                        await ctx.db.insert(proposalMeetingSpeakers).values({
                            meetingId: input.meetingId,
                            speakerId: segment.speakerId,
                            speakerLabel: segment.speakerLabel,
                        });
                        speakers.set(segment.speakerId, true);
                    }

                    // Store transcript segments
                    await ctx.db.insert(proposalMeetingTranscripts).values({
                        meetingId: input.meetingId,
                        speakerId: segment.speakerId,
                        speakerLabel: segment.speakerLabel,
                        text: segment.text,
                        confidence: segment.confidence,
                        startTime: segment.startTime,
                        endTime: segment.endTime,
                    });
                }

                // Update meeting with transcript JSON
                const updated = await ctx.db
                    .update(proposalMeetings)
                    .set({
                        transcriptJson: {
                            speakers: Array.from(speakers.keys()),
                            segments,
                        } as never,
                    })
                    .where(eq(proposalMeetings.id, input.meetingId))
                    .returning();

                return updated[0];
            }

            // Handle manual transcription or manual notes
            if (input.manualSegments && input.manualSegments.length > 0) {
                const speakers = new Map<number, boolean>();

                for (const segment of input.manualSegments) {
                    if (!speakers.has(segment.speakerId)) {
                        await ctx.db.insert(proposalMeetingSpeakers).values({
                            meetingId: input.meetingId,
                            speakerId: segment.speakerId,
                            speakerLabel: segment.speakerLabel,
                        });
                        speakers.set(segment.speakerId, true);
                    }

                    // Store transcript segments
                    await ctx.db.insert(proposalMeetingTranscripts).values({
                        meetingId: input.meetingId,
                        speakerId: segment.speakerId,
                        speakerLabel: segment.speakerLabel,
                        text: segment.text,
                    });
                }

                // Update meeting with transcript JSON
                const updated = await ctx.db
                    .update(proposalMeetings)
                    .set({
                        transcriptJson: {
                            speakers: Array.from(speakers.keys()),
                            segments: input.manualSegments,
                        } as never,
                    })
                    .where(eq(proposalMeetings.id, input.meetingId))
                    .returning();

                return updated[0];
            }

            throw new Error("No manual segments provided for manual transcription");
        }),

    linkSpeakerToStakeholder: publicProcedure
        .input(
            z.object({
                speakerId: z.number().int().nonnegative(),
                personaId: z.number().int().positive(),
                meetingId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.db
                .update(proposalMeetingSpeakers)
                .set({
                    linkedStakeholderId: input.personaId,
                })
                .where(
                    and(
                        eq(proposalMeetingSpeakers.meetingId, input.meetingId),
                        eq(proposalMeetingSpeakers.speakerId, input.speakerId)
                    )
                )
                .returning();

            return updated[0];
        }),

    renameMeetingSpeaker: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
                speakerId: z.number().int().nonnegative(),
                speakerLabel: z.string().min(1).max(50),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const normalizedSpeakerLabel = input.speakerLabel.trim();
            if (!normalizedSpeakerLabel) {
                throw new Error("Speaker label is required");
            }

            const updatedSpeakers = await ctx.db
                .update(proposalMeetingSpeakers)
                .set({
                    speakerLabel: normalizedSpeakerLabel,
                })
                .where(
                    and(
                        eq(proposalMeetingSpeakers.meetingId, input.meetingId),
                        eq(proposalMeetingSpeakers.speakerId, input.speakerId)
                    )
                )
                .returning();

            if (!updatedSpeakers[0]) {
                throw new Error("Speaker not found");
            }

            const updatedTranscripts = await ctx.db
                .update(proposalMeetingTranscripts)
                .set({
                    speakerLabel: normalizedSpeakerLabel,
                })
                .where(
                    and(
                        eq(proposalMeetingTranscripts.meetingId, input.meetingId),
                        eq(proposalMeetingTranscripts.speakerId, input.speakerId)
                    )
                )
                .returning();

            return {
                speaker: updatedSpeakers[0],
                updatedTranscriptCount: updatedTranscripts.length,
            };
        }),

    generateMeetingNotesSummary: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const meeting = await ctx.db.query.proposalMeetings.findFirst({
                where: eq(proposalMeetings.id, input.meetingId),
                with: {
                    transcripts: true,
                },
            });

            if (!meeting) {
                throw new Error("Meeting not found");
            }

            // Merge all transcript segments into a single text
            const fullTranscript = meeting.transcripts
                .map((t) => `${t.speakerLabel}: ${t.text}`)
                .join("\n\n");

            // Generate summary
            const summary = await generateMeetingSummary(fullTranscript);

            // Update meeting with summary
            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    summary,
                    summaryGeneratedAt: new Date(),
                })
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            return updated[0];
        }),

    updateMeetingSummary: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
                summary: z.string().min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const nextSummary = input.summary.trim();
            if (!nextSummary) {
                throw new Error("Summary cannot be empty");
            }

            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    summary: nextSummary,
                    summaryGeneratedAt: new Date(),
                })
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            if (!updated[0]) {
                throw new Error("Meeting not found");
            }

            return updated[0];
        }),

    generateMeetingSummaryAnalysis: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const meeting = await ctx.db.query.proposalMeetings.findFirst({
                where: eq(proposalMeetings.id, input.meetingId),
                with: {
                    proposal: {
                        with: {
                            company: true,
                            stakeholders: {
                                with: {
                                    persona: true,
                                },
                            },
                        },
                    },
                    transcripts: true,
                },
            });

            if (!meeting) {
                throw new Error("Meeting not found");
            }

            const mergedTranscript = meeting.transcripts
                .map((segment) => `${segment.speakerLabel}: ${segment.text}`)
                .join("\n\n");

            const meetingSummary = (meeting.summary ?? "").trim();
            const effectiveSummary = meetingSummary.length > 0 ? meetingSummary : mergedTranscript;

            if (!effectiveSummary.trim()) {
                throw new Error("Cannot generate analysis without a meeting summary or transcript");
            }

            const proposalContext = [
                `Proposal Title: ${meeting.proposal.title}`,
                `Company: ${meeting.proposal.company.name}`,
                `Proposal Summary: ${meeting.proposal.summary ?? "N/A"}`,
                `Intent Signals: ${meeting.proposal.intentSignals ?? "N/A"}`,
                `Technology Fit: ${meeting.proposal.technologyFit ?? "N/A"}`,
                `Status: ${meeting.proposal.status}`,
                `Outcome: ${meeting.proposal.outcome}`,
            ].join("\n");

            const stakeholderContext = meeting.proposal.stakeholders.length > 0
                ? meeting.proposal.stakeholders
                    .map((stakeholder) => [
                        `Name: ${stakeholder.persona.fullName}`,
                        `Role: ${stakeholder.role}`,
                        `Influence: ${stakeholder.influenceLevel}`,
                        `Notes: ${stakeholder.notes ?? "N/A"}`,
                        `Personality: ${stakeholder.persona.personalitySummary ?? "N/A"}`,
                    ].join(" | "))
                    .join("\n")
                : "No stakeholders linked to this proposal.";

            const analysis = await generateMeetingAnalysis({
                meetingSummary: effectiveSummary,
                proposalContext,
                stakeholderContext,
            });

            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    meetingAnalysis: analysis,
                    analysisGeneratedAt: new Date(),
                })
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            if (!updated[0]) {
                throw new Error("Meeting not found");
            }

            return updated[0];
        }),

    updateMeetingSummaryAnalysis: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
                meetingAnalysis: z.string().min(1),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const nextAnalysis = input.meetingAnalysis.trim();
            if (!nextAnalysis) {
                throw new Error("Analysis cannot be empty");
            }

            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    meetingAnalysis: nextAnalysis,
                    analysisGeneratedAt: new Date(),
                })
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            if (!updated[0]) {
                throw new Error("Meeting not found");
            }

            return updated[0];
        }),

    generateMeetingNotesNextSteps: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const meeting = await ctx.db.query.proposalMeetings.findFirst({
                where: eq(proposalMeetings.id, input.meetingId),
                with: {
                    proposal: {
                        with: {
                            company: true,
                            stakeholders: true,
                        },
                    },
                    transcripts: true,
                },
            });

            if (!meeting) {
                throw new Error("Meeting not found");
            }

            // Merge all transcript segments
            const fullTranscript = meeting.transcripts
                .map((t) => `${t.speakerLabel}: ${t.text}`)
                .join("\n\n");

            // Build proposal context
            const proposalContext = `
Proposal: ${meeting.proposal.title}
Company: ${meeting.proposal.company.name}
Summary: ${meeting.proposal.summary || "N/A"}
Intent Signals: ${meeting.proposal.intentSignals || "N/A"}
Technology Fit: ${meeting.proposal.technologyFit || "N/A"}
Stakeholders: ${meeting.proposal.stakeholders.length}
            `.trim();

            // Generate next steps
            const nextSteps = await generateMeetingNextSteps(fullTranscript, proposalContext);

            // Update meeting with next steps
            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    nextSteps,
                    nextStepsGeneratedAt: new Date(),
                })
                .where(eq(proposalMeetings.id, input.meetingId))
                .returning();

            return updated[0];
        }),

    getRealtimeStreamingToken: publicProcedure.query(async () => {
        try {
            const { token, wsUrl } = await getAssemblyAIRealtimeToken();
            return {
                token,
                wsUrl,
                error: null as string | null,
            };
        } catch (error) {
            return {
                token: null,
                wsUrl: null,
                error: `Failed to get streaming token: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }),

    createStreamingMeetingNote: publicProcedure
        .input(
            z.object({
                proposalId: z.number().int().positive(),
                title: z.string().min(1),
                description: z.string().optional(),
                recordingDate: z.date().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Create meeting note for streaming transcription
            const [meeting] = await ctx.db
                .insert(proposalMeetings)
                .values({
                    proposalId: input.proposalId,
                    title: input.title,
                    description: input.description,
                    transcriptionType: "assembly_ai",
                    recordingDate: input.recordingDate ?? new Date(),
                })
                .returning();

            return meeting;
        }),

    completeStreamingTranscription: publicProcedure
        .input(
            z.object({
                meetingId: z.number().int().positive(),
                transcript: z.string(),
                speakers: z.array(
                    z.object({
                        speakerId: z.number(),
                        speakerLabel: z.string(),
                    })
                ),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const meetingId = input.meetingId;
            const transcript = input.transcript;
            const speakers = input.speakers;

            // Insert speakers
            for (const speaker of speakers) {
                await ctx.db
                    .insert(proposalMeetingSpeakers)
                    .values({
                        meetingId,
                        speakerId: speaker.speakerId,
                        speakerLabel: speaker.speakerLabel,
                    })
                    .onConflictDoNothing();
            }

            // Store the transcript
            const segments = transcript
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                    const match = line.match(/^(.+?):\s*(.+)$/);
                    if (match) {
                        const speakerLabel = match[1]?.trim() ?? "Speaker 0";
                        const text = match[2]?.trim() ?? "";
                        const speaker = speakers.find((s) => s.speakerLabel === speakerLabel);
                        return {
                            speakerId: speaker?.speakerId ?? 0,
                            speakerLabel,
                            text,
                        };
                    }
                    return {
                        speakerId: speakers[0]?.speakerId ?? 1,
                        speakerLabel: speakers[0]?.speakerLabel ?? "Speaker 1",
                        text: line.trim(),
                    };
                })
                .filter((segment) => segment.text.length > 0);

            for (const segment of segments) {
                await ctx.db.insert(proposalMeetingTranscripts).values({
                    meetingId,
                    speakerId: segment.speakerId,
                    speakerLabel: segment.speakerLabel,
                    text: segment.text,
                });
            }

            // Update meeting status
            const updated = await ctx.db
                .update(proposalMeetings)
                .set({
                    transcriptJson: {
                        speakers: speakers.map((s) => s.speakerId),
                        segments,
                    } as never,
                })
                .where(eq(proposalMeetings.id, meetingId))
                .returning();

            return updated[0];
        }),
});

