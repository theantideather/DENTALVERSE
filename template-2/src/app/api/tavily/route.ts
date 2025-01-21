import { NextResponse } from 'next/server';

const TAVILY_API_KEY = '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';
const TAVILY_API_URL = 'https://api.tavily.com/search';

export async function POST(req: Request) {
  try {
    const { query, includeImages, includeImageDescriptions } = await req.json();

    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': TAVILY_API_KEY,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
        include_images: includeImages ?? false,
        include_image_descriptions: includeImageDescriptions ?? false,
        get_raw_content: false,
        api_key: TAVILY_API_KEY,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Tavily API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(errorData.message || `API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Ensure we have results
    if (!data || (!Array.isArray(data.results) && !data.answer)) {
      console.error('Invalid Tavily API response:', data);
      throw new Error('Invalid response format from search API');
    }

    // If we have an answer but no results, create a result from the answer
    if (data.answer && (!data.results || data.results.length === 0)) {
      data.results = [{
        content: data.answer,
        url: "Generated from Tavily's answer",
        title: "Direct Answer"
      }];
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Tavily API Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch search results',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 