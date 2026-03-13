# openrouter-generate-image-skill

A Claude Code skill for generating images via OpenRouter API, supporting Gemini, FLUX, and other image models.

[中文文档](./README_CN.md)

## Installation

```bash
npx skills add wxul/openrouter-generate-image-skill
```

## Setup

Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys), then configure it using either method below:

### Option 1: Shell Environment Variable

```bash
export OPENROUTER_API_KEY="your-api-key-here"
```

Add it to `~/.zshrc` or `~/.bashrc` to persist across sessions.

### Option 2: Claude Code Settings (Recommended)

Edit `~/.claude/settings.json` and add the `env` field:

```json
{
  "env": {
    "OPENROUTER_API_KEY": "your-api-key-here"
  }
}
```

This keeps the variable scoped to Claude Code without polluting your global shell environment.

## Example

![A cute cat sitting on a windowsill watching the sunset](./generated-images/2026-03-13T02-36-50-a-cute-cat-sitting-on-a-windowsill-watch.png)

## Usage

Once installed, Claude Code will automatically use this skill when you ask it to generate images. Just say things like:

- "Generate an image of a mountain landscape"
- "Create an icon for my app"
- "Make a placeholder background image"

### Parameters

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--prompt` | Yes | - | Image description |
| `--model` | No | `google/gemini-3.1-flash-image-preview` | OpenRouter model ID |
| `--width` | No | 1024 | Image width |
| `--height` | No | 1024 | Image height |
| `--output` | No | auto (timestamp-slug.png) | Output filename |
| `--dir` | No | `./generated-images` | Output directory |
| `--proxy` | No | - | HTTP proxy URL |

### Slash Command

You can also invoke the skill directly in Claude Code using the slash command:

```
/generate-image a minimalist logo of a mountain with a sun
```

### Supported Models

- `google/gemini-3.1-flash-image-preview` (default, recommended)
- `black-forest-labs/flux-1.1-pro`
- `black-forest-labs/flux-schnell`
- Any OpenRouter model that supports image generation

Browse all available image models: [openrouter.ai/models?output_modalities=image](https://openrouter.ai/models?fmt=cards&output_modalities=image)

## License

MIT
