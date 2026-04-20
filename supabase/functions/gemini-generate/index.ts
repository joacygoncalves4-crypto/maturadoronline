import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { geminiApiToken, prompt } = await req.json();

    if (!geminiApiToken) {
      throw new Error("Gemini API Token is required");
    }

    // Use gemini-2.0-flash (current stable model)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 100 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini] API error (${response.status}):`, errorText.slice(0, 300));
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const message = result.candidates?.[0]?.content?.parts?.[0]?.text || "E aí, tudo certo?";

    console.log(`[Gemini] Generated: ${message}`);

    return new Response(JSON.stringify({ message: message.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Gemini] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, message: "E aí, tudo certo?" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
