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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY secret is not configured on Supabase Edge Function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipientEmail, meeting, attachments } = await req.json();

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!meeting) {
      return new Response(
        JSON.stringify({ error: "Meeting details are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = meeting.title || "Meeting Summary";
    const dateStr = meeting.created_at ? new Date(meeting.created_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) : new Date().toLocaleDateString();

    const takeawaysHtml = (meeting.key_takeaways || [])
      .map((t: string) => `<li style="margin-bottom: 6px; color: #334155;">${t}</li>`)
      .join("");

    const actionPointsHtml = (meeting.action_points || [])
      .map((ap: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-size: 14px; color: #1e293b;">${ap.task || ap}</td>
          <td style="padding: 10px; font-size: 14px; color: #64748b;">${ap.assignee || 'Unassigned'}</td>
          <td style="padding: 10px; font-size: 14px; color: #64748b;">${ap.due_date || 'TBD'}</td>
        </tr>
      `).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
          .container { max-width: 650px; background: #ffffff; margin: 0 auto; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0; color: #1e1b4b; font-size: 24px; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 14px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 16px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
          .summary-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 6px; font-size: 15px; line-height: 1.6; color: #14532d; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 13px; color: #475569; text-transform: uppercase; }
          .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎙️ ${title}</h1>
            <p>Meeting Date: ${dateStr} • Duration: ${Math.round((meeting.duration_seconds || 0) / 60)} mins</p>
          </div>

          <div class="section">
            <div class="section-title">📌 Executive Summary</div>
            <div class="summary-box">${meeting.summary || 'No summary available.'}</div>
          </div>

          ${takeawaysHtml ? `
          <div class="section">
            <div class="section-title">💡 Key Takeaways</div>
            <ul style="padding-left: 20px; margin: 0;">${takeawaysHtml}</ul>
          </div>
          ` : ''}

          ${actionPointsHtml ? `
          <div class="section">
            <div class="section-title">✅ Action Items</div>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${actionPointsHtml}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            Generated automatically by <strong>MeetingAssistant</strong> • Powered by Supabase & Groq AI
          </div>
        </div>
      </body>
      </html>
    `;

    const resendBody: any = {
      from: "MeetingAssistant <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `📊 Meeting Summary: ${title} (${dateStr})`,
      html: emailHtml,
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      resendBody.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.contentBase64,
      }));
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend API Error:", errText);
      return new Response(
        JSON.stringify({ error: `Resend Email API failed: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Send Meeting Report Edge Function Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
