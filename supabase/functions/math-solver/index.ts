import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert math teacher who specializes in both traditional school methods and Vedic Mathematics.

IMPORTANT: First check if the input contains a math problem (equation, calculation, word problem, or numbers to compute).

If NO math problem is found, respond ONLY with this exact JSON:
{"error": "no_question"}

If a math problem IS found:
1. Identify the math problem clearly.
2. Solve using the TRADITIONAL school method step by step.
3. Solve using a VEDIC MATH shortcut/sutra step by step. Name the Vedic sutra.
4. Estimate time each method takes.

Respond ONLY in this exact JSON format — no markdown, no code blocks:
{
  "problem": "47 × 53",
  "traditional": {
    "steps": ["step 1", "step 2", "final answer"],
    "time": "45 seconds",
    "explanation_hi": "Hindi explanation",
    "explanation_en": "English explanation"
  },
  "vedic": {
    "method": "Vedic Sutra Name",
    "steps": ["step 1", "step 2", "final answer"],
    "time": "12 seconds",
    "explanation_hi": "Hindi explanation",
    "explanation_en": "English explanation"
  },
  "speedup": "3.75x",
  "difficulty": "Easy"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, textProblem } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    if (!imageBase64 && !textProblem) {
      return new Response(JSON.stringify({ error: "No input provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Gemini request body
    let parts: unknown[];

    if (imageBase64) {
      // Strip the data URL prefix to get raw base64
      const base64Data = imageBase64.startsWith("data:")
        ? imageBase64.split(",")[1]
        : imageBase64;

      parts = [
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Data,
          },
        },
        { text: `${SYSTEM_PROMPT}\n\nLook at this image. If you see a math problem, solve it and return JSON. If no math problem, return {"error": "no_question"}.` },
      ];
    } else {
      parts = [
        { text: `${SYSTEM_PROMPT}\n\nSolve: ${textProblem}. Return JSON only.` },
      ];
    }

    const MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];
    let content = "";

    for (const model of MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content) break;
      } else {
        const errText = await response.text();
        console.error(`${model} error ${response.status}: ${errText}`);
        if (response.status === 404) throw new Error(`Model not found: ${model}`);
        if (response.status !== 429) throw new Error(`Gemini error ${response.status}`);
      }
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      parsed = { error: "Could not parse AI response" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("math-solver error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
