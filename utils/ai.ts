import { StylingOptions, Palette, FontPair } from '../types';
import { ThinkingLevel, Modality } from '@google/genai';

export const VISUAL_STYLES: Record<string, Palette> = {
  "Flat Design": { background: "#F5F7FA", primary: "#2D5BFF", secondary: "#6B7B8D", accent: "#FF6B35", text: "#1A1A2E" },
  "Isometric": { background: "#FFFFFF", primary: "#4A90D9", secondary: "#50C878", accent: "#FF6F61", text: "#2C3E50" },
  "Line Art": { background: "#FFFFFF", primary: "#1A1A1A", secondary: "#888888", accent: "#E63946", text: "#1A1A1A" },
  "Retro / Mid-Century": { background: "#F4ECD8", primary: "#C75B12", secondary: "#5B8C5A", accent: "#D4A03C", text: "#3B2F2F" },
  "Risograph / Duotone": { background: "#FAF3E8", primary: "#E63946", secondary: "#1D3557", accent: "#E63946", text: "#1D3557" },
  "Neon / Dark Mode": { background: "#0D0D0D", primary: "#00F0FF", secondary: "#BF00FF", accent: "#39FF14", text: "#FFFFFF" },
  "Paper Cutout": { background: "#FFF8F0", primary: "#E07A5F", secondary: "#81B29A", accent: "#F2CC8F", text: "#3D405B" },
  "Pop Art": { background: "#FFFFFF", primary: "#FF0040", secondary: "#0066FF", accent: "#FFDE00", text: "#1A1A1A" },
  "Watercolour": { background: "#FFFFFF", primary: "#7FB3D8", secondary: "#D4A0C0", accent: "#A8D5A2", text: "#4A4A4A" },
  "Blueprint": { background: "#0B3D91", primary: "#FFFFFF", secondary: "#87CEEB", accent: "#FFD700", text: "#FFFFFF" },
  "Doodle Art": { background: "#FFFFFF", primary: "#222222", secondary: "#555555", accent: "#FF6B35", text: "#222222" },
  "Geometric Gradient": { background: "#F0F0F5", primary: "#6C5CE7", secondary: "#00CEC9", accent: "#FD79A8", text: "#2D3436" },
  "Corporate Memphis": { background: "#FAF0E6", primary: "#1877F2", secondary: "#F4845F", accent: "#FFC947", text: "#14213D" }
};

export const STYLE_FONTS: Record<string, FontPair> = {
  "Flat Design":          { primary: "Montserrat",       secondary: "Open Sans" },
  "Isometric":            { primary: "Bebas Neue",       secondary: "Roboto" },
  "Line Art":             { primary: "Raleway",          secondary: "Lato" },
  "Retro / Mid-Century":  { primary: "Futura",           secondary: "Helvetica" },
  "Risograph / Duotone":  { primary: "Oswald",           secondary: "Source Sans Pro" },
  "Neon / Dark Mode":     { primary: "Orbitron",         secondary: "Rajdhani" },
  "Paper Cutout":         { primary: "Quicksand",        secondary: "Nunito" },
  "Pop Art":              { primary: "Impact",           secondary: "Arial Black" },
  "Watercolour":          { primary: "Playfair Display", secondary: "Lora" },
  "Blueprint":            { primary: "DIN Condensed",    secondary: "Courier New" },
  "Doodle Art":           { primary: "Pacifico",         secondary: "Comic Sans MS" },
  "Geometric Gradient":   { primary: "Poppins",          secondary: "Inter" },
  "Corporate Memphis":    { primary: "Work Sans",        secondary: "Rubik" },
};

export const DEFAULT_STYLING: StylingOptions = {
  levelOfDetail: 'Standard',
  style: 'Flat Design',
  palette: VISUAL_STYLES['Flat Design'],
  fonts: STYLE_FONTS['Flat Design'],
  aspectRatio: '16:9',
  resolution: '1K'
};

// ─────────────────────────────────────────────────────────────────
// Gemini 3 API Config Constants
// IMPORTANT: Gemini 3 docs mandate temperature=1.0 (the default).
// Setting <1.0 causes looping/degraded performance on reasoning tasks.
// DO NOT add temperature overrides without reading the Gemini 3 migration guide.
// ─────────────────────────────────────────────────────────────────

/** Config for Gemini Flash text-only calls: low thinking + text-only output */
export const FLASH_TEXT_CONFIG = {
  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  responseModalities: [Modality.TEXT],
};

/** Config for Gemini Pro Image calls: must include responseModalities to ensure image output */
export const PRO_IMAGE_CONFIG = {
  responseModalities: [Modality.TEXT, Modality.IMAGE],
};

/** Compare two StylingOptions for style-anchoring mismatch (style, aspectRatio, palette — NOT resolution/fonts/level) */
export function detectSettingsMismatch(current: StylingOptions, reference: StylingOptions): boolean {
  if (current.style !== reference.style) return true;
  if (current.aspectRatio !== reference.aspectRatio) return true;
  const keys: (keyof Palette)[] = ['background', 'primary', 'secondary', 'accent', 'text'];
  return keys.some(k => current.palette[k] !== reference.palette[k]);
}

export const withRetry = async <T,>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || '';
      const status = err.status || err.httpStatusCode || 0;
      const isRetryable =
        status === 429 || status === 500 || status === 503 ||
        msg.includes('429') || msg.includes('500') || msg.includes('503') ||
        msg.includes('overloaded') || msg.includes('unavailable') ||
        msg.includes('resource_exhausted') || msg.includes('rate limit') ||
        msg.includes('rate_limit') || msg.includes('too many requests') ||
        msg.includes('internal server error');
      if (isRetryable) {
        retries++;
        if (retries >= maxRetries) throw err;
        const delay = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Maximum retries reached");
};

// ─────────────────────────────────────────────────────────────────
// Claude API (Anthropic) — used for all text intelligence
// Supports prompt caching via cache_control on system + message blocks.
// ─────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const CLAUDE_MAX_TOKENS = 64000;

// Minimum tokens for Sonnet caching (1,024 tokens ≈ ~4,000 chars)
const CACHE_MIN_CHARS = 4000;

interface ClaudeContentBlock {
  type: string;
  text?: string;
  source?: { type: string; media_type: string; data: string };
  cache_control?: { type: 'ephemeral' };
}

interface ClaudeSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/** A message in a multi-turn conversation for the Claude messages API */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

/** System block with optional caching */
export interface SystemBlock {
  text: string;
  cache?: boolean;
}

export interface CallClaudeOptions {
  document?: { base64: string; mediaType: string };
  system?: string;
  maxTokens?: number;
  /** Structured system blocks with per-block cache control (overrides `system` string) */
  systemBlocks?: SystemBlock[];
  /** Multi-turn messages array (overrides single-prompt `prompt` arg). Last user message auto-gets cache_control. */
  messages?: ClaudeMessage[];
  /** AbortSignal for cancelling the request */
  signal?: AbortSignal;
}

/**
 * Call Claude API directly via fetch (browser-compatible, no Node.js SDK needed).
 * Supports text-only, document analysis (PDF/DOCX), general-purpose prompting,
 * and prompt caching via `systemBlocks` and `messages` options.
 *
 * @param prompt  - The text prompt to send (ignored when `options.messages` is provided)
 * @param options - Optional: document, system prompt, max tokens, caching controls
 *
 * Backward compatible: `callClaude(prompt, { base64, mediaType })` still works.
 */
export async function callClaude(
  prompt: string,
  options?: CallClaudeOptions | { base64: string; mediaType: string }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  // Normalize legacy 2-arg calls: callClaude(prompt, { base64, mediaType })
  let document: { base64: string; mediaType: string } | undefined;
  let system: string | undefined;
  let maxTokens = CLAUDE_MAX_TOKENS;
  let systemBlocks: SystemBlock[] | undefined;
  let messages: ClaudeMessage[] | undefined;
  let signal: AbortSignal | undefined;

  if (options && 'base64' in options && 'mediaType' in options) {
    // Legacy format: direct document object
    document = options as { base64: string; mediaType: string };
  } else if (options) {
    const opts = options as CallClaudeOptions;
    document = opts.document;
    system = opts.system;
    maxTokens = opts.maxTokens ?? CLAUDE_MAX_TOKENS;
    systemBlocks = opts.systemBlocks;
    messages = opts.messages;
    signal = opts.signal;
  }

  // ── Build system prompt ──
  let systemPayload: string | ClaudeSystemBlock[] | undefined;

  if (systemBlocks && systemBlocks.length > 0) {
    // Structured system blocks with per-block cache control
    systemPayload = systemBlocks.map(block => {
      const b: ClaudeSystemBlock = { type: 'text', text: block.text };
      if (block.cache && block.text.length >= CACHE_MIN_CHARS) {
        b.cache_control = { type: 'ephemeral' };
      }
      return b;
    });
  } else if (system) {
    // Plain string system prompt — auto-cache if large enough
    if (system.length >= CACHE_MIN_CHARS) {
      systemPayload = [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }];
    } else {
      systemPayload = system;
    }
  }

  // ── Build messages ──
  let messagesPayload: Array<{ role: string; content: string | ClaudeContentBlock[] }>;

  if (messages && messages.length > 0) {
    // Multi-turn messages — add cache_control to last user message
    messagesPayload = messages.map((msg, i) => {
      // Find if this is the last user message
      const isLastUser = msg.role === 'user' &&
        !messages!.slice(i + 1).some(m => m.role === 'user');

      if (isLastUser && typeof msg.content === 'string') {
        // Wrap string content to add cache_control
        return {
          role: msg.role,
          content: [{
            type: 'text',
            text: msg.content,
            cache_control: { type: 'ephemeral' as const },
          }],
        };
      } else if (isLastUser && Array.isArray(msg.content)) {
        // Add cache_control to the last block in the content array
        const blocks = [...msg.content];
        const lastBlock = { ...blocks[blocks.length - 1] };
        lastBlock.cache_control = { type: 'ephemeral' };
        blocks[blocks.length - 1] = lastBlock;
        return { role: msg.role, content: blocks };
      }
      return msg;
    });
  } else {
    // Single-prompt fallback (original behavior)
    const content: ClaudeContentBlock[] = [];
    if (document) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: document.mediaType, data: document.base64 },
      });
    }
    content.push({ type: 'text', text: prompt });
    messagesPayload = [{ role: 'user', content }];
  }

  const body: Record<string, any> = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: messagesPayload,
  };

  if (systemPayload) {
    body.system = systemPayload;
  }

  const response = await withRetry(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Claude API error ${res.status}: ${errorBody}`);
    }

    return await res.json() as ClaudeResponse;
  });

  // Log cache performance
  const { cache_creation_input_tokens, cache_read_input_tokens, input_tokens } = response.usage;
  if (cache_creation_input_tokens || cache_read_input_tokens) {
    console.debug(
      `[Claude] cache_read: ${cache_read_input_tokens ?? 0}, cache_write: ${cache_creation_input_tokens ?? 0}, uncached: ${input_tokens}`
    );
  }

  // Extract text from response
  const textBlocks = response.content.filter(b => b.type === 'text');
  return textBlocks.map(b => b.text).join('\n') || '';
}
