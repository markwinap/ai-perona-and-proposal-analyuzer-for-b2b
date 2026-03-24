CREATE TYPE "public"."transcription_type" AS ENUM('assembly_ai', 'manual_transcript', 'manual_notes');--> statement-breakpoint
ALTER TABLE "persona_analizer_ts_proposal_meeting" ADD COLUMN "transcriptionType" "transcription_type" DEFAULT 'assembly_ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "persona_analizer_ts_proposal_meeting" ADD COLUMN "manualTranscript" text;--> statement-breakpoint
CREATE INDEX "proposal_meeting_transcription_type_idx" ON "persona_analizer_ts_proposal_meeting" USING btree ("transcriptionType");