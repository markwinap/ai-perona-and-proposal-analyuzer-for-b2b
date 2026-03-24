import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `persona_analizer_ts_${name}`);

export const communicationTypeEnum = pgEnum("communication_type", [
  "chat",
  "email",
  "meeting",
  "personality",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "in_review",
  "submitted",
  "won",
  "lost",
]);

export const stakeholderRoleEnum = pgEnum("stakeholder_role", [
  "CTO",
  "PO",
  "FUNCTIONAL_TECH_LEAD",
  "TECH_LEAD",
  "OTHER",
]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "azure_openai",
  "google_gemini",
  "ollama",
  "copilot",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);

export const proposalOutcomeEnum = pgEnum("proposal_outcome", [
  "success",
  "failure",
  "pending",
]);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ]
);

export const companies = createTable(
  "company",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 255 }).notNull(),
    industry: d.varchar({ length: 255 }),
    businessIntent: d.text(),
    technologyIntent: d.text(),
    developmentStacks: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    certifications: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    standards: d.text().array().notNull().default(sql`ARRAY[]::text[]`),
    partnerships: d.text().array().notNull().default(sql`ARRAY[]::text[]`),
    referenceArchitectures: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    engineeringGuidelines: d
      .text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("company_name_unique_idx").on(t.name),
    index("company_industry_idx").on(t.industry),
  ]
);

export const personas = createTable(
  "persona",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: d.varchar({ length: 255 }).notNull(),
    email: d.varchar({ length: 255 }),
    jobDescription: d.text(),
    personalitySummary: d.text(),
    personalPreferences: d.text(),
    pastExperiences: d.text(),
    analysis: d.text(),
    aiProvider: d.varchar({ length: 100 }),
    analysisGeneratedAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("persona_company_idx").on(t.companyId),
    index("persona_email_idx").on(t.email),
  ]
);

export const personaCommunications = createTable(
  "persona_communication",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    personaId: d
      .integer()
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    type: communicationTypeEnum().notNull(),
    subject: d.varchar({ length: 255 }),
    content: d.text().notNull(),
    occurredAt: d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()),
    metadata: d
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("persona_communication_persona_idx").on(t.personaId),
    index("persona_communication_company_idx").on(t.companyId),
    index("persona_communication_type_idx").on(t.type),
  ]
);

export const proposals = createTable(
  "proposal",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d
      .integer()
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 255 }).notNull(),
    summary: d.text(),
    intentSignals: d.text(),
    technologyFit: d.text(),
    status: proposalStatusEnum().notNull().default("draft"),
    outcome: proposalOutcomeEnum().notNull().default("pending"),
    outcomeReason: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("proposal_company_idx").on(t.companyId),
    index("proposal_status_idx").on(t.status),
    index("proposal_outcome_idx").on(t.outcome),
  ]
);

export const proposalStakeholders = createTable(
  "proposal_stakeholder",
  (d) => ({
    proposalId: d
      .integer()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    personaId: d
      .integer()
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    role: stakeholderRoleEnum().notNull(),
    influenceLevel: d.integer().notNull().default(3),
    notes: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.proposalId, t.personaId, t.role] }),
    index("proposal_stakeholder_proposal_idx").on(t.proposalId),
    index("proposal_stakeholder_persona_idx").on(t.personaId),
  ]
);

export const proposalEvaluations = createTable(
  "proposal_evaluation",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    proposalId: d
      .integer()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    successSignals: d.text(),
    failureSignals: d.text(),
    successScore: d.integer().notNull().default(50),
    failureRiskScore: d.integer().notNull().default(50),
    recommendation: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("proposal_evaluation_proposal_idx").on(t.proposalId)]
);

export const aiProviderConfigs = createTable(
  "ai_provider_config",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    companyId: d.integer().references(() => companies.id, { onDelete: "cascade" }),
    provider: aiProviderEnum().notNull(),
    modelName: d.varchar({ length: 255 }),
    endpoint: d.varchar({ length: 500 }),
    apiVersion: d.varchar({ length: 100 }),
    options: d
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isDefault: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("ai_provider_company_idx").on(t.companyId),
    index("ai_provider_provider_idx").on(t.provider),
  ]
);

export const generatedCommunications = createTable(
  "generated_communication",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    proposalId: d
      .integer()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    personaId: d.integer().references(() => personas.id, { onDelete: "set null" }),
    stakeholderRole: stakeholderRoleEnum().notNull(),
    aiProvider: aiProviderEnum().notNull(),
    promptContext: d.text(),
    generatedMessage: d.text().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("generated_communication_proposal_idx").on(t.proposalId),
    index("generated_communication_persona_idx").on(t.personaId),
  ]
);

export const proposalChatSessions = createTable(
  "proposal_chat_session",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    proposalId: d
      .integer()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    defaultContext: d.text().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    uniqueIndex("proposal_chat_session_proposal_unique_idx").on(t.proposalId),
    index("proposal_chat_session_proposal_idx").on(t.proposalId),
  ]
);

export const proposalChatMessages = createTable(
  "proposal_chat_message",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    sessionId: d
      .integer()
      .notNull()
      .references(() => proposalChatSessions.id, { onDelete: "cascade" }),
    role: chatMessageRoleEnum().notNull(),
    content: d.text().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("proposal_chat_message_session_idx").on(t.sessionId),
    index("proposal_chat_message_role_idx").on(t.role),
  ]
);

export const transcriptionTypeEnum = pgEnum("transcription_type", [
  "assembly_ai",
  "manual_transcript",
  "manual_notes",
]);

export const proposalMeetings = createTable(
  "proposal_meeting",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    proposalId: d
      .integer()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 255 }).notNull(),
    description: d.text(),
    audioUrl: d.varchar({ length: 500 }),
    assemblyAiTranscriptId: d.varchar({ length: 255 }),
    transcriptionType: transcriptionTypeEnum().notNull().default("assembly_ai"),
    manualTranscript: d.text(),
    transcriptJson: d
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    summary: d.text(),
    summaryGeneratedAt: d.timestamp({ withTimezone: true }),
    meetingAnalysis: d.text(),
    analysisGeneratedAt: d.timestamp({ withTimezone: true }),
    nextSteps: d.text(),
    nextStepsGeneratedAt: d.timestamp({ withTimezone: true }),
    recordingDate: d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("proposal_meeting_proposal_idx").on(t.proposalId),
    index("proposal_meeting_assembly_ai_idx").on(t.assemblyAiTranscriptId),
    index("proposal_meeting_transcription_type_idx").on(t.transcriptionType),
  ]
);

export const proposalMeetingSpeakers = createTable(
  "proposal_meeting_speaker",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    meetingId: d
      .integer()
      .notNull()
      .references(() => proposalMeetings.id, { onDelete: "cascade" }),
    speakerId: d.integer().notNull(),
    speakerLabel: d.varchar({ length: 50 }).notNull(),
    speakerName: d.varchar({ length: 255 }),
    linkedStakeholderId: d.integer().references(() => personas.id, { onDelete: "set null" }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("proposal_meeting_speaker_meeting_idx").on(t.meetingId),
    index("proposal_meeting_speaker_stakeholder_idx").on(t.linkedStakeholderId),
    uniqueIndex("proposal_meeting_speaker_unique_idx").on(t.meetingId, t.speakerId),
  ]
);

export const proposalMeetingTranscripts = createTable(
  "proposal_meeting_transcript",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    meetingId: d
      .integer()
      .notNull()
      .references(() => proposalMeetings.id, { onDelete: "cascade" }),
    speakerId: d.integer().notNull(),
    speakerLabel: d.varchar({ length: 50 }).notNull(),
    text: d.text().notNull(),
    confidence: d.real(),
    startTime: d.real(),
    endTime: d.real(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("proposal_meeting_transcript_meeting_idx").on(t.meetingId),
    index("proposal_meeting_transcript_speaker_idx").on(t.speakerId),
  ]
);

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  createdBy: one(users, { fields: [posts.createdById], references: [users.id] }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  personas: many(personas),
  proposals: many(proposals),
  communications: many(personaCommunications),
  aiProviderConfigs: many(aiProviderConfigs),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  company: one(companies, { fields: [personas.companyId], references: [companies.id] }),
  communications: many(personaCommunications),
  stakeholderLinks: many(proposalStakeholders),
  generatedCommunications: many(generatedCommunications),
}));

export const personaCommunicationsRelations = relations(
  personaCommunications,
  ({ one }) => ({
    persona: one(personas, {
      fields: [personaCommunications.personaId],
      references: [personas.id],
    }),
    company: one(companies, {
      fields: [personaCommunications.companyId],
      references: [companies.id],
    }),
  })
);

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  company: one(companies, { fields: [proposals.companyId], references: [companies.id] }),
  stakeholders: many(proposalStakeholders),
  evaluations: many(proposalEvaluations),
  generatedCommunications: many(generatedCommunications),
  chatSessions: many(proposalChatSessions),
  meetings: many(proposalMeetings),
}));

export const proposalStakeholdersRelations = relations(
  proposalStakeholders,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalStakeholders.proposalId],
      references: [proposals.id],
    }),
    persona: one(personas, {
      fields: [proposalStakeholders.personaId],
      references: [personas.id],
    }),
  })
);

export const proposalEvaluationsRelations = relations(
  proposalEvaluations,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalEvaluations.proposalId],
      references: [proposals.id],
    }),
  })
);

export const aiProviderConfigsRelations = relations(aiProviderConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [aiProviderConfigs.companyId],
    references: [companies.id],
  }),
}));

export const generatedCommunicationsRelations = relations(
  generatedCommunications,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [generatedCommunications.proposalId],
      references: [proposals.id],
    }),
    persona: one(personas, {
      fields: [generatedCommunications.personaId],
      references: [personas.id],
    }),
  })
);

export const proposalChatSessionsRelations = relations(
  proposalChatSessions,
  ({ one, many }) => ({
    proposal: one(proposals, {
      fields: [proposalChatSessions.proposalId],
      references: [proposals.id],
    }),
    messages: many(proposalChatMessages),
  })
);

export const proposalChatMessagesRelations = relations(
  proposalChatMessages,
  ({ one }) => ({
    session: one(proposalChatSessions, {
      fields: [proposalChatMessages.sessionId],
      references: [proposalChatSessions.id],
    }),
  })
);

export const proposalMeetingsRelations = relations(
  proposalMeetings,
  ({ one, many }) => ({
    proposal: one(proposals, {
      fields: [proposalMeetings.proposalId],
      references: [proposals.id],
    }),
    speakers: many(proposalMeetingSpeakers),
    transcripts: many(proposalMeetingTranscripts),
  })
);

export const proposalMeetingSpeakersRelations = relations(
  proposalMeetingSpeakers,
  ({ one }) => ({
    meeting: one(proposalMeetings, {
      fields: [proposalMeetingSpeakers.meetingId],
      references: [proposalMeetings.id],
    }),
    linkedStakeholder: one(personas, {
      fields: [proposalMeetingSpeakers.linkedStakeholderId],
      references: [personas.id],
    }),
  })
);

export const proposalMeetingTranscriptsRelations = relations(
  proposalMeetingTranscripts,
  ({ one }) => ({
    meeting: one(proposalMeetings, {
      fields: [proposalMeetingTranscripts.meetingId],
      references: [proposalMeetings.id],
    }),
  })
);

export const aiPrompts = createTable(
  "ai_prompt",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    key: d.varchar({ length: 100 }).notNull(),
    name: d.varchar({ length: 255 }).notNull(),
    description: d.text(),
    systemInstruction: d.text(),
    promptTemplate: d.text().notNull(),
    isActive: d.boolean().notNull().default(true),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [uniqueIndex("ai_prompt_key_unique_idx").on(t.key)]
);

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ]
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)]
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);
