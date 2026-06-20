import { getLLMClient, getModelName, resolveProvider, createChatCompletion } from './llm';

interface VisionRequest {
  image: string;        // base64 or URL
  prompt?: string;
  detail?: 'low' | 'high' | 'auto';
}

interface VisionResult {
  success: boolean;
  description?: string;
  analysis?: string;
  objects?: string[];
  text?: string;
  error?: string;
  model: string;
  processingTime: number;
}

class VisionModule {
  /**
   * Analyze an image using an LLM with vision capability (gpt-4o, claude-3, etc.)
   */
  async analyze(request: VisionRequest): Promise<VisionResult> {
    const start = Date.now();
    const prompt = request.prompt || 'Describe this image in detail. What do you see?';
    const detail = request.detail || 'auto';

    try {
      const llmClient = getLLMClient();
      const model = getModelName();

      let imageContent: any;
      if (request.image.startsWith('http://') || request.image.startsWith('https://')) {
        imageContent = { type: 'image_url', image_url: { url: request.image, detail } };
      } else {
        // Assume base64 — strip data URI prefix if present
        const base64 = request.image.replace(/^data:image\/\w+;base64,/, '');
        const mime = request.image.startsWith('data:') 
          ? request.image.split(';')[0].split(':')[1] 
          : 'image/png';
        imageContent = { 
          type: 'image_url', 
          image_url: { 
            url: `data:${mime};base64,${base64}`, 
            detail 
          } 
        };
      }

      const result = await createChatCompletion(llmClient, {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              imageContent,
            ],
          } as any,
        ],
        max_tokens: 1000,
      }, resolveProvider());

      const content = result.choices[0]?.message?.content || '';
      const processingTime = Date.now() - start;

      // Extract structured info
      const objects = this.extractObjectNames(content);
      const extractedText = this.extractText(content);

      return {
        success: true,
        description: content.substring(0, 500),
        analysis: content,
        objects,
        text: extractedText,
        model,
        processingTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        model: getModelName(),
        processingTime: Date.now() - start,
      };
    }
  }

  private extractObjectNames(text: string): string[] {
    const common = [
      'person', 'people', 'dog', 'cat', 'car', 'tree', 'building', 'phone',
      'laptop', 'book', 'table', 'chair', 'bottle', 'food', 'screen', 'document',
    ];
    const found: string[] = [];
    const lower = text.toLowerCase();
    for (const obj of common) {
      if (lower.includes(obj)) found.push(obj);
    }
    return found;
  }

  private extractText(text: string): string | undefined {
    // Try to find quoted text or code blocks that might represent extracted text
    const codeBlock = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlock) return codeBlock[1].trim();
    const quotes = text.match(/"([^"]{10,})"/g);
    if (quotes) return quotes.map((q: string) => q.replace(/"/g, '')).join('\n');
    return undefined;
  }
}

export const vision = new VisionModule();
