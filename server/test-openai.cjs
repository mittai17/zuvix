const { OpenAI } = require('openai');
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-...",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
client.chat.completions.create({
  model: "gemini-2.5-pro",
  messages: [{role: "user", content: "hi"}]
}).then(console.log).catch(console.error);
