import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY secret is not configured on Supabase Edge Function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, transcript, attendees } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Meeting transcript is empty or missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert executive meeting assistant and scribe.
Analyze the provided meeting transcript and return a structured JSON response strictly adhering to this JSON schema:

{
  "summary": "Concise 3-5 sentence executive summary of the meeting, capturing the core objective and overall outcome.",
  "key_takeaways": [
    "Key decision or insight 1",
    "Key decision or insight 2"
  ],
  "action_points": [
    {
      "task": "Clear actionable task description",
      "assignee": "Name of assigned person or Unassigned",
      "due_date": "YYYY-MM-DD or TBD",
      "status": "pending"
    }
  ],
  "topics": [
    {
      "topic": "Topic Name",
      "discussion": "Key discussion summary for this topic"
    }
  ]
}

Ensure high accuracy, professionalism, and actionable detail. Respond ONLY with valid JSON.`;

    const userPrompt = `Meeting Title: ${title || 'General Meeting'}
Attendees: ${Array.isArray(attendees) ? attendees.join(', ') : (attendees || 'Team Members')}

Transcript:
${transcript}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq Summarization Error:", errText);
      return new Response(
        JSON.stringify({ error: `Groq AI API failed: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const resultText = groqData.choices?.[0]?.message?.content || "{}";

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch {
      parsedResult = {
        summary: resultText,
        key_takeaways: ["See meeting transcript"],
        action_points: [],
        topics: []
      };
    }

    return new Response(
      JSON.stringify(parsedResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Summarize Edge Function Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
