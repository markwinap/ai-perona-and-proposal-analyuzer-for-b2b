import { PollyClient, SynthesizeSpeechCommand, VoiceId } from "@aws-sdk/client-polly";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

let cachedPollyClient: PollyClient | null = null;

const getPollyClient = () => {
    if (!env.AWS_REGION) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "AWS_REGION is not configured for Polly text-to-speech.",
        });
    }

    if (!cachedPollyClient) {
        cachedPollyClient = new PollyClient({ region: env.AWS_REGION });
    }

    return cachedPollyClient;
};

const synthesizeInputSchema = z.object({
    text: z.string().trim().min(1).max(2800),
    voiceId: z.string().trim().min(2).max(64).optional(),
});

const streamToBuffer = async (stream: unknown): Promise<Buffer> => {
    if (!stream) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No audio stream returned from Polly.",
        });
    }

    if (typeof stream === "string") {
        return Buffer.from(stream);
    }

    if (stream instanceof Uint8Array) {
        return Buffer.from(stream);
    }

    if (typeof (stream as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
        const byteArray = await (stream as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
        return Buffer.from(byteArray);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer | string>) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

export const speechRouter = createTRPCRouter({
    synthesize: publicProcedure.input(synthesizeInputSchema).mutation(async ({ input }) => {
        const client = getPollyClient();
        const requestedVoice = input.voiceId ?? env.AWS_POLLY_VOICE_ID ?? "Matthew";
        const voiceId = requestedVoice in VoiceId ? (requestedVoice as VoiceId) : VoiceId.Matthew;

        try {
            const response = await client.send(
                new SynthesizeSpeechCommand({
                    OutputFormat: "mp3",
                    Text: input.text,
                    TextType: "text",
                    Engine: "neural",
                    VoiceId: voiceId,
                })
            );

            const audioBuffer = await streamToBuffer(response.AudioStream);

            return {
                audioBase64: audioBuffer.toString("base64"),
                contentType: response.ContentType ?? "audio/mpeg",
            };
        } catch {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Polly synthesis failed. Verify AWS credentials, region, and Polly voice configuration.",
            });
        }
    }),
});
