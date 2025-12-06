const Anthropic = require('@anthropic-ai/sdk');

// Initialize the Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Make sure to set your API key as an environment variable
});

async function main() {
  try {
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude! Tell me a short joke.',
        },
      ],
    });

    console.log('Claude says:', message.content[0].text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();


