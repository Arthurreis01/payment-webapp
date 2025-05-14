// server.js
const express = require('express');
const path    = require('path');

const app = express();

// Serve all files in public/ (index.html, admin.js, admin.css, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Static server running on http://localhost:${PORT}`);
});
