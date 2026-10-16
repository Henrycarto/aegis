const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
}

interface AIFlag {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detail: string;
}

interface AIResult {
  risk_score: number;
  verdict: "SAFE" | "SUSPICIOUS" | "DANGEROUS";
  red_flags: AIFlag[];
  summary: string;
}

const SYSTEM_PROMPT = `You are Aegis, an expert phishing and social engineering detection AI. Analyze the email provided and return a JSON assessment.

Look for:
- Domain impersonation / typosquatting (lookalike domains mimicking trusted brands)
- Suspicious sender patterns (free email for business claims, mismatched reply-to)
- Link safety (URL shorteners, IP addresses, redirect tricks, mismatched domains)
- Urgency / pressure tactics (deadlines, "act now", time-sensitive threats)
- Financial requests (wire transfers, gift cards, crypto, invoice pressure)
- Authority claims (impersonating executives, legal/compliance intimidation)
- Investment scams (fake term sheets, unsolicited funding offers, portal lures)
- Credential theft (login prompts, password resets, account compromise scares)
- Generic greetings / impersonal language
- Too-good-to-be-true offers (lottery, prizes, inheritance)
- Sender mismatches (links go to different domain than sender)
- Unusual writing style, grammatical errors, or translation artifacts
- Emotional manipulation or fear tactics

Return ONLY valid JSON with this exact structure:
{
  "risk_score": <number 0-100>,
  "verdict": "<SAFE|SUSPICIOUS|DANGEROUS>",
  "summary": "<one or two sentence plain-language summary of what's going on>",
  "red_flags": [
    {
      "category": "<short category name>",
      "severity": "<low|medium|high|critical>",
      "description": "<short headline of the issue>",
      "detail": "<detailed explanation of why this is suspicious>"
    }
  ]
}

Scoring guidelines:
- 0-24: SAFE (no significant concerns)
- 25-59: SUSPICIOUS (some concerning elements)
- 60-100: DANGEROUS (clear phishing or social engineering)

Be thorough but precise. Only flag real issues. If the email is legitimate, say so clearly.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { sender_email, sender_name, subject, body } = (await req.json()) as EmailPayload;

    if (!sender_email && !subject && !body) {
      return new Response(
        JSON.stringify({ error: "Missing email content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI analysis is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailText = [
      `From: ${sender_name ? `"${sender_name}" ` : ""}<${sender_email || "unknown"}>`,
      `Subject: ${subject || "(no subject)"}`,
      "",
      body || "(no body)",
    ].join("\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: emailText }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "AI returned no analysis. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiResult: AIResult;
    try {
      aiResult = JSON.parse(rawText) as AIResult;
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: "AI returned malformed analysis." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      aiResult = JSON.parse(jsonMatch[0]) as AIResult;
    }

    if (typeof aiResult.risk_score !== "number") aiResult.risk_score = 0;
    if (!["SAFE", "SUSPICIOUS", "DANGEROUS"].includes(aiResult.verdict)) {
      aiResult.verdict = aiResult.risk_score >= 60 ? "DANGEROUS" : aiResult.risk_score >= 25 ? "SUSPICIOUS" : "SAFE";
    }
    if (!Array.isArray(aiResult.red_flags)) aiResult.red_flags = [];
    if (typeof aiResult.summary !== "string") aiResult.summary = "Analysis complete.";

    return new Response(
      JSON.stringify(aiResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong during analysis." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
