import { env } from "~/env";

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;
const ASSEMBLY_AI_URL = "https://api.assemblyai.com/v2";
const ASSEMBLY_AI_STREAMING_WS_URL_V2 = "wss://api.assemblyai.com/v2/realtime/ws";
const ASSEMBLY_AI_STREAMING_TOKEN_URL_V3 = "https://streaming.assemblyai.com/v3/token";
const ASSEMBLY_AI_STREAMING_WS_URL_V3 = "wss://streaming.assemblyai.com/v3/ws";

async function generateTextWithAI(params: {
    prompt: string;
    systemPrompt?: string;
}): Promise<string> {
    if (!env.GOOGLE_GEMINI_API_KEY) {
        throw new Error("Google Gemini API key not configured");
    }

    const model = env.GOOGLE_GEMINI_MODEL ?? "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

    const systemInstruction = params.systemPrompt || "You are a helpful AI assistant.";

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemInstruction }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: params.prompt }],
                },
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
            },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`AI generation failed: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const result = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim();

    if (!result) {
        throw new Error("No response from AI service");
    }

    return result;
}

export interface AssemblyAISpeaker {
    confidence: number;
    end: number;
    speaker: number;
    start: number;
    text: string;
}

export interface AssemblyAITranscriptResponse {
    id: string;
    status: "queued" | "processing" | "completed" | "error";
    text: string;
    words: Array<{
        confidence: number;
        end: number;
        start: number;
        text: string;
    }>;
    utterances?: AssemblyAISpeaker[];
}

export async function uploadAudioToAssemblyAI(audioUrl: string): Promise<string> {
    if (!ASSEMBLY_AI_API_KEY) {
        throw new Error("AssemblyAI API key not configured");
    }

    const response = await fetch(`${ASSEMBLY_AI_URL}/transcript`, {
        method: "POST",
        headers: {
            authorization: ASSEMBLY_AI_API_KEY,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            audio_url: audioUrl,
            speaker_labels: true, // Enable speaker diarization
            language_code: "en",
        }),
    });

    if (!response.ok) {
        throw new Error(`AssemblyAI upload failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
}

export async function getAssemblyAIRealtimeToken(): Promise<{ token: string; wsUrl: string }> {
    if (!ASSEMBLY_AI_API_KEY) {
        throw new Error("AssemblyAI API key not configured");
    }

    // Prefer the current Universal Streaming (v3) token endpoint.
    const v3Urls = [
        `${ASSEMBLY_AI_STREAMING_TOKEN_URL_V3}?expires_in_seconds=60&max_session_duration_seconds=60`,
        `${ASSEMBLY_AI_STREAMING_TOKEN_URL_V3}?expires_in_seconds=60`,
        `${ASSEMBLY_AI_STREAMING_TOKEN_URL_V3}?expires_in=60`,
    ];

    for (const url of v3Urls) {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                authorization: ASSEMBLY_AI_API_KEY,
            },
        });

        if (response.ok) {
            const data = (await response.json()) as { token?: string; temp_token?: string };
            const token = data.token ?? data.temp_token;
            if (token) {
                return { token, wsUrl: ASSEMBLY_AI_STREAMING_WS_URL_V3 };
            }
        }
    }

    // Fallback to legacy realtime token endpoint for older accounts.
    const legacyResponse = await fetch(`${ASSEMBLY_AI_URL}/realtime/token`, {
        method: "POST",
        headers: {
            authorization: ASSEMBLY_AI_API_KEY,
            "content-type": "application/json",
        },
        body: JSON.stringify({ expires_in: 60 }),
    });

    if (!legacyResponse.ok) {
        throw new Error(`Failed to get real-time token: ${legacyResponse.statusText}`);
    }

    const legacyData = (await legacyResponse.json()) as { token?: string; temp_token?: string };
    const legacyToken = legacyData.token ?? legacyData.temp_token;
    if (!legacyToken) {
        throw new Error("Failed to get real-time token: empty token response");
    }

    return { token: legacyToken, wsUrl: ASSEMBLY_AI_STREAMING_WS_URL_V2 };
}

export async function getTranscriptFromAssemblyAI(
    transcriptId: string
): Promise<AssemblyAITranscriptResponse> {
    if (!ASSEMBLY_AI_API_KEY) {
        throw new Error("AssemblyAI API key not configured");
    }

    const response = await fetch(`${ASSEMBLY_AI_URL}/transcript/${transcriptId}`, {
        headers: {
            authorization: ASSEMBLY_AI_API_KEY,
        },
    });

    if (!response.ok) {
        throw new Error(`AssemblyAI get transcript failed: ${response.statusText}`);
    }

    const data = (await response.json()) as AssemblyAITranscriptResponse;

    if (data.status === "error") {
        throw new Error(`AssemblyAI transcription failed: ${data.text}`);
    }

    return data;
}

export async function waitForAssemblyAITranscript(
    transcriptId: string,
    maxWaitTime: number = 600000 // 10 minutes
): Promise<AssemblyAITranscriptResponse> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < maxWaitTime) {
        const transcript = await getTranscriptFromAssemblyAI(transcriptId);

        if (transcript.status === "completed") {
            return transcript;
        }

        if (transcript.status === "error") {
            throw new Error(`Transcription failed: ${transcript.text}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("Transcription timed out");
}

export interface SpeakerSegment {
    speakerId: number;
    speakerLabel: string;
    text: string;
    confidence: number;
    startTime: number;
    endTime: number;
}

export function extractSpeakerSegments(
    transcript: AssemblyAITranscriptResponse
): SpeakerSegment[] {
    const speakers = new Set<number>();
    const segments: SpeakerSegment[] = [];

    if (transcript.utterances) {
        transcript.utterances.forEach((utterance) => {
            speakers.add(utterance.speaker);
            segments.push({
                speakerId: utterance.speaker,
                speakerLabel: `Speaker ${utterance.speaker}`,
                text: utterance.text,
                confidence: utterance.confidence,
                startTime: utterance.start,
                endTime: utterance.end,
            });
        });
    }

    return segments;
}

export async function generateMeetingSummary(transcript: string): Promise<string> {
    const prompt = `
You are a professional meeting summarizer. Analyze the following meeting transcript and provide a concise summary that includes:
1. Key discussion points
2. Decisions made
3. Action items
4. Participants' concerns or concerns raised

Meeting Transcript:
${transcript}

Please provide a professional summary that captures the essence of the meeting.
  `.trim();

    const summary = await generateTextWithAI({
        prompt,
        systemPrompt:
            "You are an expert meeting summarizer. Create clear, concise meeting summaries highlighting key decisions and action items.",
    });

    return summary;
}

export async function generateMeetingNextSteps(
    transcript: string,
    proposalContext: string
): Promise<string> {
    const prompt = `
Based on the following meeting transcript and proposal context, identify concrete next steps and recommended actions:

Proposal Context:
${proposalContext}

Meeting Transcript:
${transcript}

Please provide:
1. Immediate next steps (within 24-48 hours)
2. Follow-up actions needed
3. Key stakeholders who should be involved
4. Timeline recommendations
5. Risk mitigation strategies
  `.trim();

    const nextSteps = await generateTextWithAI({
        prompt,
        systemPrompt:
            "You are a strategic business advisor. Provide actionable next steps based on meeting discussions and proposal context.",
    });

    return nextSteps;
}

export async function generateMeetingAnalysis(params: {
    meetingSummary: string;
    proposalContext: string;
    stakeholderContext: string;
}): Promise<string> {
    const prompt = `
You are a strategic B2B proposal analyst.

Using the meeting summary, proposal context, and stakeholder context below, produce a practical analysis that includes:
1. Stakeholder alignment assessment
2. Commercial and delivery risks
3. Technical fit and implementation concerns
4. Buying signals and blockers
5. Recommended strategy adjustments for the proposal

Meeting Summary:
${params.meetingSummary}

Proposal Context:
${params.proposalContext}

Stakeholder Context:
${params.stakeholderContext}
  `.trim();

    const analysis = await generateTextWithAI({
        prompt,
        systemPrompt:
            "You are an expert enterprise proposal strategist. Produce concise, actionable, and business-relevant analysis.",
    });

    return analysis;
}

export function mergeSpeakerSegments(segments: SpeakerSegment[]): string {
    return segments
        .map(
            (segment) =>
                `Speaker ${segment.speakerId}: ${segment.text}`
        )
        .join("\n\n");
}
