import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = 'sk-d718d2aee15c40fcbffdfb37bc99be04';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// Set response timeout to 30 seconds
export const maxDuration = 30;

// Configure the runtime to use edge for better streaming support
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages,
        stream: true,
        max_tokens: 4000, // Limit token length to ensure completion
      }),
    });

    // Ensure the response is ok
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get response from DeepSeek');
    }

    // Create a TransformStream to process the response
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          // Convert the chunk to text
          const text = new TextDecoder().decode(chunk);
          // Split the text into lines
          const lines = text.split('\n');

          for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;
            
            // Remove the "data: " prefix if it exists
            const data = line.startsWith('data: ') ? line.slice(6) : line;
            
            // Skip [DONE] messages
            if (data === '[DONE]') continue;

            try {
              // Parse and re-stringify to ensure valid JSON
              const parsed = JSON.parse(data);
              controller.enqueue(JSON.stringify(parsed) + '\n');
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        } catch (e) {
          console.error('Error in transform:', e);
          controller.error(e);
        }
      },
    });

    const stream = response.body?.pipeThrough(transformStream);
    
    if (!stream) {
      throw new Error('No response stream available');
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
} 