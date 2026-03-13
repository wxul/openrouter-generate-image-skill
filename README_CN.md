# openrouter-generate-image-skill

一个 Claude Code 技能插件，通过 OpenRouter API 生成图片，支持 Gemini、FLUX 等多种图像模型。

[English](./README.md)

## 安装

```bash
npx skills add wxul/openrouter-generate-image-skill
```

## 配置

前往 [openrouter.ai/keys](https://openrouter.ai/keys) 获取 API Key，然后通过以下任一方式配置环境变量：

### 方式一：Shell 环境变量

```bash
export OPENROUTER_API_KEY="your-api-key-here"
```

可以将其添加到 `~/.zshrc` 或 `~/.bashrc` 中以持久生效。

### 方式二：Claude Code Settings（推荐）

编辑 `~/.claude/settings.json`，在 `env` 字段中添加：

```json
{
  "env": {
    "OPENROUTER_API_KEY": "your-api-key-here"
  }
}
```

这种方式的好处是环境变量仅对 Claude Code 生效，不会污染全局 Shell 环境。

## 示例

![一只可爱的猫咪坐在窗台上看日落](./generated-images/2026-03-13T02-36-50-a-cute-cat-sitting-on-a-windowsill-watch.png)

## 使用

安装后，当你让 Claude Code 生成图片时，它会自动调用此技能。例如：

- "生成一张山脉风景图"
- "给我的应用创建一个图标"
- "做一张占位背景图"

### 参数

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--prompt` | 是 | - | 图片描述 |
| `--model` | 否 | `google/gemini-3.1-flash-image-preview` | OpenRouter 模型 ID |
| `--width` | 否 | 1024 | 图片宽度 |
| `--height` | 否 | 1024 | 图片高度 |
| `--output` | 否 | 自动生成（时间戳-描述.png） | 输出文件名 |
| `--dir` | 否 | `./generated-images` | 输出目录 |
| `--proxy` | 否 | - | HTTP 代理地址 |

### 命令式调用

你也可以在 Claude Code 中通过斜杠命令直接调用：

```
/generate-image 一座山的极简 logo，扁平设计，蓝橙配色
```

### 支持的模型

- `google/gemini-3.1-flash-image-preview`（默认，推荐）
- `black-forest-labs/flux-1.1-pro`
- `black-forest-labs/flux-schnell`
- 任何 OpenRouter 支持的图像生成模型

查看所有可用的生图模型：[openrouter.ai/models?output_modalities=image](https://openrouter.ai/models?fmt=cards&output_modalities=image)

## 许可证

MIT
