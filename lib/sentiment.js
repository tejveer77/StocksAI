const GROQ_API_KEY = "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";

export async function analyzeNewsSentiment(symbol, newsArticles) {
  try {
    const headlines = newsArticles.slice(0, 5).map(n => n.headline);

    const body = {
      model: "llama-3.1-8b-instant",
      temperature: 0.2, 
      messages: [
        {
          role: "system",
          content: `
You are a strict JSON generator. 
You MUST answer ONLY valid JSON.
NO explanation. NO natural text. NO comments.
If data is missing, estimate based on tone of headlines.
JSON schema must be exactly:

{
  "sentiment": number between 0 and 1,
  "impact": "positive" | "negative" | "neutral",
  "risk": "low" | "medium" | "high",
  "summary": "string"
}
`
        },
        {
          role: "user",
          content: `
Analyze these headlines for ${symbol} and score sentiment:

${JSON.stringify(headlines)}
`
        }
      ]
    };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    let raw = json?.choices?.[0]?.message?.content || "{}";

    
    raw = raw
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.log("AI returned bad JSON. RAW:", raw);
      throw new Error("Bad JSON from AI");
    }

    return parsed;
  } catch (err) {
    console.log("AI SENTIMENT ERROR:", err);
    return null; 
  }
}
