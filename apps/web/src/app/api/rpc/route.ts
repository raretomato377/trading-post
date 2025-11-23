import { NextRequest, NextResponse } from 'next/server';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://11142220.rpc.thirdweb.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('RPC Proxy Request:', {
      method: body.method,
      params: body.params ? `${body.params.length} params` : 'no params',
    });

    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RPC response error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
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
