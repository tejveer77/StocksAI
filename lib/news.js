const FINNHUB_API_KEY = "d4j86ppr01queualugtgd4j86ppr01queualugu0";

export async function fetchCompanyNews(symbol) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${today}&token=${FINNHUB_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    return json.slice(0, 10); // last 10 articles
  } catch (err) {
    console.log("News fetch error:", err);
    return [];
  }
}
