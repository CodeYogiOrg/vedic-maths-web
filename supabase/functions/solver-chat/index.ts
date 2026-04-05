import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a friendly and expert Vedic Math teacher who helps students understand math concepts.

Rules:
- Explain things clearly in simple language
- If the student asks in Hindi, respond in Hindi. If in English, respond in English.
- Use examples and analogies to make things easy to understand
- Encourage the student and be supportive
- Focus on both traditional and Vedic Math methods
- Keep responses concise but thorough`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Convert messages to Gemini format
    const contents = (messages as { role: string; content: string }[]).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.role === "user" && messages.indexOf(msg) === 0
        ? `${SYSTEM_PROMPT}\n\n${msg.content}`
        : msg.content }],
    }));

    const MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];
    let content = "";

    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) break;
      } else {
        const err = await response.text();
        console.error(`${model} error ${response.status}: ${err}`);
        if (response.status === 404) throw new Error(`Model not found: ${model}`);
        if (response.status !== 429) throw new Error(`Gemini error ${response.status}`);
        // 429 → try next model
      }
    }

    if (!content) throw new Error("All Gemini models rate-limited");

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("solver-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
