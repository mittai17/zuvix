const { OpenAI } = require('openai');
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "sk-or-...",
  baseURL: "https://openrouter.ai/api/v1"
});
client.chat.completions.create({
  model: "google/gemini-2.5-flash",
  messages: [{role: "user", content: "hi"}]
}).then(console.log).catch(console.error);
