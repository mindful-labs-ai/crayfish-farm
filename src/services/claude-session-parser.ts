import { readFileSync, existsSync } from 'node:fs';
import type { ParsedSession } from '../core/types.js';

interface ContentPart {
  type: string;
  text?: string;
}

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AssistantMessage {
  usage?: MessageUsage;
  content?: string | ContentPart[];
}

interface JsonlLine {
  type?: string;
  timestamp?: string | number;
  message?: AssistantMessage;
}

function extractTextFromContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('');
}

export function parseJsonlFile(filePath: string): ParsedSession {
  const empty: ParsedSession = {
    totalTokens: 0,
    lastExchange: '',
    lastAssistantTimestamp: 0,
    lineCount: 0,
  };

  if (!existsSync(filePath)) {
    return empty;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return empty;
  }

  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  let totalTokens = 0;
  let lastExchange = '';
  let lastAssistantTimestamp = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as JsonlLine;

      if (parsed.type === 'assistant' && parsed.message) {
        const usage = parsed.message.usage;
        if (usage) {
          totalTokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        }

        if (parsed.message.content) {
          lastExchange = extractTextFromContent(parsed.message.content);
        }

        if (parsed.timestamp) {
          if (typeof parsed.timestamp === 'string') {
            const ts = Date.parse(parsed.timestamp);
            if (!isNaN(ts)) {
              lastAssistantTimestamp = ts;
            }
          } else if (typeof parsed.timestamp === 'number') {
            lastAssistantTimestamp = parsed.timestamp;
          }
        }
      }
    } catch {
      // skip malformed lines silently
    }
  }

  return {
    totalTokens,
    lastExchange,
    lastAssistantTimestamp,
    lineCount: lines.length,
  };
}
