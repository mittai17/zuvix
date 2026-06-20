// Voice agent endpoint — processes voice input and returns spoken response
import { getLLMClient, getModelName, resolveProvider, createChatCompletion } from './llm';
import { memoryEngine } from './memory/vector';

interface VoiceRequest {
  text: string;
  platform?: string;
  sessionId?: string;
}

interface VoiceResponse {
  response: string;
  processingTime: number;
  platform?: string;
}

class VoiceAgent {
  async process(req: VoiceRequest): Promise<VoiceResponse> {
    const start = Date.now();
    const sessionId = req.sessionId || 'voice:default';
    const platform = req.platform || 'unknown';

    try {
      const llmClient = getLLMClient();
      const model = getModelName();

      // Get recent context
      const history = await memoryEngine.getRecentMemory(sessionId, 5);
      const contextStr = history.length > 0
        ? `Recent context:\n${history.join('\n')}`
        : '';

      // Platform-specific system prompt
      const platformHints: Record<string, string> = {
        ios: 'Respond concisely. Use natural speech. The user is likely on iPhone.',
        android: 'Respond concisely. Use natural speech. The user is likely on an Android device.',
        windows: 'Respond concisely. Use natural speech. The user is on Windows.',
        mac: 'Respond concisely. Use natural speech. The user is on macOS.',
        linux: 'Respond concisely. Use natural speech. The user is on Linux.',
      };

      const systemPrompt = `You are JARVIS, an AI assistant. Respond to voice commands naturally and concisely.
Be brief — speak as if in conversation. Use natural language, not lists or markdown.
${platformHints[platform] || ''}
${contextStr}`;

      const result = await createChatCompletion(llmClient, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.text },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }, resolveProvider());

      const response = result.choices[0]?.message?.content || 'I understand.';

      // Save to memory
      await memoryEngine.saveMemory(sessionId, `[User] ${req.text}`, 'user');
      await memoryEngine.saveMemory(sessionId, `[JARVIS] ${response}`, 'assistant');

      return {
        response,
        processingTime: Date.now() - start,
        platform,
      };
    } catch (err: any) {
      return {
        response: 'Sorry, I encountered an error processing your request.',
        processingTime: Date.now() - start,
        platform,
      };
    }
  }
}

export const voiceAgent = new VoiceAgent();
