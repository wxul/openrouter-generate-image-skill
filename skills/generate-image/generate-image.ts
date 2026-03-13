#!/usr/bin/env npx tsx

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  prompt: string;
  model: string;
  width: number;
  height: number;
  output: string;
  dir: string;
  proxy?: string;
}

interface OpenRouterChoice {
  message: {
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
          // Gemini-style inline_data
          inline_data?: { mime_type: string; data: string };
        }>;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message: string; code?: number };
}

// ---------------------------------------------------------------------------
// CLI argument parsing (zero dependencies)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      map.set(args[i].slice(2), args[i + 1]);
      i++;
    }
  }

  const prompt = map.get("prompt");
  if (!prompt) {
    console.error("Error: --prompt is required");
    process.exit(1);
  }

  const slug = prompt
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const defaultOutput = `${timestamp}-${slug}.png`;

  return {
    prompt,
    model: map.get("model") ?? "google/gemini-3-pro-image-preview",
    width: parseInt(map.get("width") ?? "1024", 10),
    height: parseInt(map.get("height") ?? "1024", 10),
    output: map.get("output") ?? defaultOutput,
    dir: map.get("dir") ?? "./generated-images",
    proxy: map.get("proxy"),
  };
}

// ---------------------------------------------------------------------------
// Fetch with optional proxy
// ---------------------------------------------------------------------------

async function fetchWithProxy(
  url: string,
  init: RequestInit,
  proxy?: string
): Promise<Response> {
  if (proxy) {
    // Use undici ProxyAgent (bundled with Node 18+)
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");
    const agent = new ProxyAgent(proxy);
    return undiciFetch(url, {
      ...init,
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
  }
  return fetch(url, init);
}

// ---------------------------------------------------------------------------
// Extract image data from various response formats
// ---------------------------------------------------------------------------

function extractImageBase64(data: OpenRouterResponse): string {
  // Format 1: choices[].message.content as multipart array (Gemini, etc.)
  if (data.choices?.length) {
    const content = data.choices[0].message.content;

    if (Array.isArray(content)) {
      for (const part of content) {
        // image_url with data URI
        if (part.type === "image_url" && part.image_url?.url) {
          const match = part.image_url.url.match(
            /^data:image\/[^;]+;base64,(.+)$/
          );
          if (match) return match[1];
        }
        // inline_data (Gemini native format)
        if (part.inline_data?.data) {
          return part.inline_data.data;
        }
      }
    }

    // Content is a string containing base64
    if (typeof content === "string") {
      // Try to extract base64 from markdown image or data URI
      const dataUriMatch = content.match(
        /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/
      );
      if (dataUriMatch) return dataUriMatch[1];

      // If it looks like raw base64
      if (/^[A-Za-z0-9+/=]{100,}$/.test(content.trim())) {
        return content.trim();
      }
    }
  }

  // Format 2: data[].b64_json (DALL-E / FLUX style)
  if (data.data?.length) {
    const item = data.data[0];
    if (item.b64_json) return item.b64_json;
  }

  throw new Error(
    `Could not extract image from response. Response keys: ${JSON.stringify(Object.keys(data))}\n` +
      `Full response: ${JSON.stringify(data).slice(0, 500)}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: OPENROUTER_API_KEY environment variable is not set.\n\n" +
        "Option 1: Export it in your shell:\n" +
        '  export OPENROUTER_API_KEY="your-key-here"\n\n' +
        "Option 2: Add it to ~/.claude/settings.json:\n" +
        '  { "env": { "OPENROUTER_API_KEY": "your-key-here" } }\n\n' +
        "Get your key at https://openrouter.ai/keys"
    );
    process.exit(1);
  }

  // Build request body
  const body: Record<string, unknown> = {
    model: args.model,
    messages: [
      {
        role: "user",
        content: args.prompt,
      },
    ],
  };

  // Some models support image size via provider params or model-specific fields
  if (args.width || args.height) {
    body.generation_config = {
      response_modalities: ["TEXT", "IMAGE"],
    };
  }

  console.error(`Generating image with ${args.model}...`);
  console.error(`Prompt: "${args.prompt}"`);
  console.error(`Size: ${args.width}x${args.height}`);

  const baseUrl = (
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
  ).replace(/\/+$/, "");

  const response = await fetchWithProxy(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    args.proxy
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API error (${response.status}): ${errorText}`);
    process.exit(1);
  }

  const data = (await response.json()) as OpenRouterResponse;

  if (data.error) {
    console.error(`API error: ${data.error.message}`);
    process.exit(1);
  }

  // Extract base64 image
  const base64 = extractImageBase64(data);
  const imageBuffer = Buffer.from(base64, "base64");

  // Ensure output directory exists
  const outputDir = resolve(args.dir);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  const outputPath = join(outputDir, args.output);
  writeFileSync(outputPath, imageBuffer);

  // Output path to stdout (for agent consumption)
  console.log(outputPath);
  console.error(`Image saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
