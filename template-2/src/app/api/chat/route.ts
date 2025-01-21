import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = 'sk-d718d2aee15c40fcbffdfb37bc99be04';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// Set response timeout to 30 seconds
export const maxDuration = 30;

// Configure the runtime to use edge for better streaming support
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get response from DeepSeek');
    }

    if (!response.body) {
      throw new Error('No response body available');
    }

    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let buffer = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining data in the buffer
              if (buffer) {
                try {
                  const parsed = JSON.parse(buffer);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                } catch (e) {
                  console.error('Error parsing final buffer:', e);
                }
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            const text = decoder.decode(value);
            buffer += text;

            // Split on newlines, keeping any remainder in the buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last partial line in the buffer

            for (const line of lines) {
              if (!line.trim()) continue;

              let data = line;
              if (line.startsWith('data: ')) {
                data = line.slice(6);
              }

              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
        } catch (e) {
          console.error('Stream error:', e);
          controller.error(e);
        }
      },

      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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