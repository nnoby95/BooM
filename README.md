# Claude SDK Setup

## Installation Complete! ✓

The Anthropic Claude SDK has been installed successfully.

## Getting Started

### 1. Set up your API Key

You'll need an Anthropic API key. Set it as an environment variable:

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="your-api-key-here"
```

**Or create a `.env` file:**
```
ANTHROPIC_API_KEY=your-api-key-here
```

### 2. Run the Example

```bash
node example.js
```

## Available Models

- `claude-3-5-sonnet-20241022` - Most capable model
- `claude-3-5-haiku-20241022` - Fast and efficient
- `claude-3-opus-20240229` - Previous flagship model

## Basic Usage

```javascript
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Your message here' }
  ],
});

console.log(message.content[0].text);
```

## Documentation

For more details, visit: https://docs.anthropic.com/


