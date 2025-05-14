// server.js
const express = require('express');
const path    = require('path');
const fetch   = require('node-fetch');   // 👉 npm install node-fetch@2
const app     = express();

// 1) Proxy para o Apps Script (deve vir ANTES do express.static)
app.use('/script', express.json(), async (req, res) => {
  try {
    const resp = await fetch(
      'https://script.google.com/macros/s/AKfy…/exec',  // sua URL real
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('Erro no proxy /script:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2) Então, sua pasta pública
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
