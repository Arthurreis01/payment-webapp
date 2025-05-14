// netlify/functions/proxy.js
const fetch = require('node-fetch'); // npm install node-fetch@2

// Replace with your real Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfyXXXXXXXXXXXXXXX/exec';

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let params;
  try {
    params = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    // If your script sometimes returns text/html on error, you may
    // want to do resp.text() and parse JSON only on 200.
    const data = await resp.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
