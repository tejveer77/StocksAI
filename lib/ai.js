// lib/ai.js


const GROQ_API_KEY =
  "";

// Helper to safely format history
function formatHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "[]";
  }
  try {
    const last10 = history.slice(-10).map((p) => p?.y ?? null);
    return JSON.stringify(last10);
  } catch (e) {
    console.log("History format error:", e);
    return "[]";
  }
}

export async function aiPredict(symbol, quote, fundamentals, history) {
  try {
 
    if (!symbol || !quote || typeof quote.current !== "number") {
      console.log("aiPredict blocked: missing symbol or quote");
      return null;
    }

    const safeChangePct =
      typeof quote.changePct === "number" ? quote.changePct : 0;
    const safeFundamentals = fundamentals || {};
    const safeHistoryStr = formatHistory(history);

    const body = {
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a financial forecasting AI. Respond ONLY with valid JSON.",
        },
        {
          role: "user",
          content: `
Predict the next-day stock price for ${symbol}.
Use the following data:

Latest Price: ${quote.current}
Change %: ${safeChangePct}
Fundamentals: ${JSON.stringify(safeFundamentals)}
Last 10 prices: ${safeHistoryStr}

Return ONLY this JSON (no extra text):

{
  "predicted": number,
  "confidence": number,  // 0-1
  "trend": "UP" | "DOWN" | "FLAT"
}
          `.trim(),
        },
      ],
      temperature: 0.3,
    };

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      }
    );

    const json = await res.json();

    if (!json || !json.choices || !json.choices[0]?.message?.content) {
      console.log("Groq API unexpected response:", json);
      return null;
    }

    const msg = json.choices[0].message.content.trim();

   
    const cleaned = msg
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.log("JSON parse error from Groq:", e, cleaned);
      return null;
    }

    
    if (
      typeof parsed.predicted !== "number" ||
      typeof parsed.confidence !== "number" ||
      !["UP", "DOWN", "FLAT"].includes(parsed.trend)
    ) {
      console.log("Groq JSON missing fields:", parsed);
      return null;
    }

    return parsed;
  } catch (err) {
    console.log("AI prediction error:", err);
    return null;
  }
}
