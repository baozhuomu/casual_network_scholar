// netlify/functions/gemini-proxy.js
import fetch from "node-fetch";

export const handler = async (event) => {
  try {
    const { prompt } = JSON.parse(event.body || "{}");
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      throw new Error("Missing Gemini API key (API_KEY not set).");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt || "Hello" }] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Gemini proxy error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Unknown error" }),
    };
  }
};
