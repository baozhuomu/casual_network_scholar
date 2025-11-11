import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini Service 封装
 * 用于与 Google Gemini 模型交互
 * 
 * 需要在 Vercel 环境变量中配置：
 * GEMINI_API_KEY = 你的API Key
 */

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY 未定义，请在 Vercel 设置环境变量。");
}

const genAI = new GoogleGenerativeAI(apiKey);

// 调用 Gemini 生成文本
export async function generateText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("❌ Gemini API 调用失败:", error);
    return "生成失败，请检查 API Key 或网络连接。";
  }
}
