import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    const contentType = req.headers.get("content-type") || "";
    let audioBlob: Blob;
    let fileName = "audio.webm";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No audio file provided in form-data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      audioBlob = file;
      fileName = file.name || "audio.webm";
    } else {
      const body = await req.json();
      if (!body.audioBase64) {
        return new Response(
          JSON.stringify({ error: "audioBase64 is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const mimeMatch = body.audioBase64.match(/^data:(audio\/[a-zA-Z0-9]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "audio/webm";
      const base64Data = body.audioBase64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, "");

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      audioBlob = new Blob([bytes], { type: mimeType });
    }

    const groqFormData = new FormData();
    groqFormData.append("file", audioBlob, fileName);
    groqFormData.append("model", "whisper-large-v3");
    groqFormData.append("response_format", "verbose_json");
    groqFormData.append("temperature", "0.0");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq Whisper API Error:", errText);
      return new Response(
        JSON.stringify({ error: `Groq Whisper API failed: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();

    return new Response(
      JSON.stringify({
        transcript: groqData.text || "",
        segments: groqData.segments || [],
        duration: groqData.duration || 0,
        language: groqData.language || "english",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Transcribe Edge Function Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
