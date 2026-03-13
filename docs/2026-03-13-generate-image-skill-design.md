# OpenRouter Generate Image Skill Design

## Overview

A Claude Code skill + standalone TS script for generating images via OpenRouter API. Supports multiple models (default: `google/gemini-3-pro-image-preview`), saves images locally, and outputs paths for agent or human use.

## Architecture

```
openrouter-generate-image-skill/skills/generate-image
├── generate-image.ts          # Core script: CLI parsing, API call, save image
├── skill.md                   # Skill definition for Claude Code
```

## CLI Interface

```bash
npx tsx generate-image.ts \
  --prompt "a cat in space" \
  --model "google/gemini-3-pro-image-preview" \
  --width 1024 --height 1024 \
  --output "cat.png" \
  --dir "./generated-images" \
  --proxy "http://127.0.0.1:7890"
```

## Parameters

| Param | Required | Default |
|-------|----------|---------|
| --prompt | Yes | - |
| --model | No | google/gemini-3-pro-image-preview |
| --width | No | 1024 |
| --height | No | 1024 |
| --output | No | Auto (timestamp + prompt slug) |
| --dir | No | ./generated-images |
| --proxy | No | - |

## Flow

1. Parse CLI args
2. Read `OPENROUTER_API_KEY` from env
3. Call OpenRouter `/api/v1/chat/completions` with image generation request
4. Extract base64 image from response (handles multiple response formats)
5. Save to local file, output path to stdout

## Error Handling

- Missing API key → stderr message + exit 1
- API error → stderr with error details + exit 1
- Network/proxy error → stderr + exit 1
