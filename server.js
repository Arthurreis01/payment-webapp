// server.js
const express = require('express');
const path    = require('path');
const fetch   = require('node-fetch');     // npm install node-fetch@2

const app = express();

// allow JSON bodies
app.use(express.json());

// serve your static dashboard
app.use(express.static(path.join(__dirname, 'public')));

// proxy to Apps Script Web App to bypass CORS
app.post('/script', async (req, res) => {
  try {
    const response = await fetch(
      'https://script.google.com/macros/s/AKfy…/exec',  // your real Apps Script URL
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
