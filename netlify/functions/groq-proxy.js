// netlify/functions/groq-proxy.js

exports.handler = async function(event, context) {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST requests (or GET for test/status)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const path = event.queryStringParameters.path || 'chat/completions';
  const targetUrl = `https://api.groq.com/openai/v1/${path}`;

  // Get the Groq API key (first check environment, then check if client provided one)
  let groqApiKey = process.env.GROQ_API_KEY;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const providedKey = authHeader.replace('Bearer ', '').trim();
    if (providedKey && providedKey !== 'undefined' && providedKey !== 'null' && providedKey.length > 15) {
      groqApiKey = providedKey;
    }
  }

  if (!groqApiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'GROQ_API_KEY is not configured on the server.' })
    };
  }

  const reqHeaders = {
    'Authorization': `Bearer ${groqApiKey}`,
  };

  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (contentType) {
    reqHeaders['Content-Type'] = contentType;
  }

  // Parse body (handling base64 encoding if needed)
  let requestBody = event.body;
  if (event.isBase64Encoded && requestBody) {
    requestBody = Buffer.from(requestBody, 'base64');
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: requestBody
    });

    const responseText = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json'
      },
      body: responseText
    };
  } catch (error) {
    console.error('Groq Proxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Internal Server Error: ${error.message}` })
    };
  }
};
