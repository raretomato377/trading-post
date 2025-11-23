import { NextRequest, NextResponse } from 'next/server';

// Primary RPC endpoint - defaults to Celo Mainnet
const PRIMARY_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org';
// Fallback RPC endpoints (add more if needed)
const FALLBACK_RPC_URLS = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://celo-mainnet.infura.io/v3/YOUR_INFURA_KEY', // Replace with your Infura key if using
];

// Retry with exponential backoff for rate limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    // If rate limited (429), retry with exponential backoff
    if (response.status === 429 && attempt < maxRetries - 1) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter 
        ? parseInt(retryAfter) * 1000 
        : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
      
      console.warn(`Rate limited (429), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }

  // If all retries failed, return the last response
  return await fetch(url, options);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('RPC Proxy Request:', {
      method: body.method,
      params: body.params ? `${body.params.length} params` : 'no params',
    });

    // Try primary RPC endpoint with retry logic
    let response = await fetchWithRetry(PRIMARY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // If still rate limited after retries, try fallback endpoints
    if (response.status === 429) {
      console.warn('Primary RPC rate limited, trying fallback endpoints...');
      for (const fallbackUrl of FALLBACK_RPC_URLS) {
        if (fallbackUrl === PRIMARY_RPC_URL) continue; // Skip if same as primary
        
        try {
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          
          if (response.ok) {
            console.log('Fallback RPC succeeded:', fallbackUrl);
            break;
          }
        } catch (err) {
          console.warn('Fallback RPC failed:', fallbackUrl, err);
          continue;
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RPC response error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      // Provide user-friendly error message for rate limits
      if (response.status === 429) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again in a few moments.',
            details: errorText,
            status: 429 
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'RPC request failed',
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Check if RPC returned an error
    if (data.error) {
      console.error('RPC error response:', data.error);
      return NextResponse.json(data, { status: 200 }); // RPC errors still return 200 with error in body
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('RPC proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'RPC request failed',
        message: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}
