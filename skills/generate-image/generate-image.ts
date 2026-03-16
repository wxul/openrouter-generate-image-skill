#!/usr/bin/env npx tsx

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";

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
    content?: string;
    images?: Array<{ image_url: { url: string } }>;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
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
    model: map.get("model") ?? "google/gemini-3.1-flash-image-preview",
    width: parseInt(map.get("width") ?? "1024", 10),
    height: parseInt(map.get("height") ?? "1024", 10),
    output: map.get("output") ?? defaultOutput,
    dir: map.get("dir") ?? "./generated-images",
    proxy: map.get("proxy"),
  };
}

// ---------------------------------------------------------------------------
// Fetch with optional proxy (zero dependencies)
// ---------------------------------------------------------------------------

function readBody(res: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on("data", (c: Buffer) => chunks.push(c));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    res.on("error", reject);
  });
}

async function fetchViaProxy(
  targetUrl: string,
  init: { method: string; headers: Record<string, string>; body: string },
  proxyUrl: string
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  const target = new URL(targetUrl);
  const proxy = new URL(proxyUrl);

  // CONNECT tunnel for HTTPS through proxy
  return new Promise((resolveOuter, rejectOuter) => {
    const connectReq = httpRequest({
      host: proxy.hostname,
      port: parseInt(proxy.port || "80", 10),
      method: "CONNECT",
      path: `${target.hostname}:${target.port || "443"}`,
    });

    connectReq.on("connect", (_res, socket) => {
      const req = httpsRequest(
        {
          hostname: target.hostname,
          port: target.port || 443,
          path: target.pathname + target.search,
          method: init.method,
          headers: init.headers,
          socket,
          agent: false as unknown as undefined,
        },
        (res) => {
          const textFn = () => readBody(res);
          resolveOuter({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            text: textFn,
            json: () => textFn().then(JSON.parse),
          });
        }
      );
      req.on("error", rejectOuter);
      req.write(init.body);
      req.end();
    });

    connectReq.on("error", rejectOuter);
    connectReq.end();
  });
}

async function fetchWithProxy(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
  proxy?: string
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  if (proxy) {
    return fetchViaProxy(url, init, proxy);
  }
  return fetch(url, init);
}

// ---------------------------------------------------------------------------
// Aspect ratio helper
// ---------------------------------------------------------------------------

function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.6) return "16:9";
  if (ratio > 1.2) return "4:3";
  if (ratio < 0.625) return "9:16";
  if (ratio < 0.833) return "3:4";
  return "1:1";
}

// ---------------------------------------------------------------------------
// Extract image data from response
// ---------------------------------------------------------------------------

function extractImageBase64(data: OpenRouterResponse): string {
  const images = data.choices?.[0]?.message?.images;
  if (!images || images.length === 0) {
    throw new Error(
      `No images returned in response.\n` +
        `Full response: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  const dataUrl = images[0].image_url.url;
  const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Could not parse base64 image data");
  }

  return base64Match[1];
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
  const aspectRatio = getAspectRatio(args.width, args.height);
  const body: Record<string, unknown> = {
    model: args.model,
    messages: [
      {
        role: "user",
        content: args.prompt,
      },
    ],
    modalities: ["image", "text"],
    image_config: {
      aspect_ratio: aspectRatio,
    },
  };

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
