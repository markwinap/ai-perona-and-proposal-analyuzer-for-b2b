ALTER TABLE "persona_analizer_ts_persona" ADD COLUMN IF NOT EXISTS "analysis" text;
ALTER TABLE "persona_analizer_ts_persona" ADD COLUMN IF NOT EXISTS "aiProvider" varchar(100);
ALTER TABLE "persona_analizer_ts_persona" ADD COLUMN IF NOT EXISTS "analysisGeneratedAt" timestamp with time zone;
