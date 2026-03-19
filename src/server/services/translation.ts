import { env } from "~/env";

const stripCodeFences = (value: string) => {
    return value.replace(/^```[a-zA-Z]*\s*/u, "").replace(/```$/u, "").trim();
};

const buildTranslationPrompt = (text: string) => {
    return [
        "Translate the following business analysis into Spanish (Latin America).",
        "Preserve structure, headings, numbering, bullets, and line breaks.",
        "Keep technical terms accurate for a B2B technology and proposal context.",
        "Do not summarize, add commentary, or wrap the response in markdown fences.",
        "",
        text,
    ].join("\n");
};

export async function translateTextToSpanishLatam(text: string) {
    if (!env.GOOGLE_GEMINI_API_KEY) {
        return text;
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
                        text: "You are an expert translator for Latin American Spanish in enterprise technology, solutioning, and proposal analysis contexts.",
                    },
                ],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: buildTranslationPrompt(text) }],
                },
            ],
            generationConfig: {
                temperature: 0.1,
            },
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Translation request failed: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const translatedText = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim();

    if (!translatedText) {
        throw new Error("Translation returned an empty response.");
    }

    return stripCodeFences(translatedText);
}