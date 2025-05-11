// server.js
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const multer     = require('multer');
const path       = require('path');
const nodemailer = require('nodemailer');

const app = express();

// Enable CORS only on /api routes
app.use('/api', cors());
app.use(bodyParser.json());

// Serve static from public/ (will automatically pick up index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Serve proof uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer for proof uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

let subscriptions = [];

function generateAthleteNumber(id) {
  return `000-0000-${String(id).padStart(5,'0')}`;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/api/webhook', upload.single('proof'), (req, res) => {
  const { name, email, phone, event, kit } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
  }

  const proofUrl = req.file
    ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    : '';

  const id = subscriptions.length + 1;
  const sub = {
    id,
    name,
    email,
    phone_number: phone || '',
    event: event || '',
    kit: kit || '',
    athlete_number: '',
    payment_status: 'pending',
    proof_file_url: proofUrl,
    subscription_code: `SUB${String(id).padStart(6,'0')}`,
    created_at: new Date().toISOString().split('T')[0]
  };

  subscriptions.push(sub);
  console.log('New subscription received:', sub);
  res.json({ message: 'Inscrição recebida.', subscription: sub });
});

app.get('/api/subscriptions', (req, res) => {
  res.json(subscriptions);
});

app.patch('/api/subscriptions/:id', async (req, res) => {
  const id     = +req.params.id;
  const status = req.body.payment_status;
  const sub    = subscriptions.find(s => s.id === id);
  if (!sub) return res.status(404).json({ error: 'Inscrição não encontrada.' });

  sub.payment_status = status;
  if (status === 'verified') {
    sub.athlete_number = generateAthleteNumber(id);
    try {
      await transporter.sendMail({
        from:    process.env.EMAIL_USER,
        to:      sub.email,
        subject: 'Seu número de atleta está disponível!',
        html: `
          <p>Olá ${sub.name},</p>
          <p>Seu pagamento foi <strong>verificado</strong>.</p>
          <p>Seu <strong>Número de Atleta</strong>:<br>
             <code>${sub.athlete_number}</code></p>
          <p>Aproveite o evento!</p>`
      });
      console.log(`E-mail enviado para ${sub.email}`);
    } catch (err) {
      console.error('Erro no e-mail:', err);
    }
  }
  res.json({ message: 'Status atualizado.', subscription: sub });
});

app.get('/api/subscriptions/export', (req, res) => {
  const header = ['Nome','Email','Telefone','Evento','Kit','Nº Atleta','Status'];
  const rows   = subscriptions.map(s => [
    s.name, s.email, s.phone_number, s.event, s.kit,
    s.athlete_number, s.payment_status
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');

  res.setHeader('Content-Disposition','attachment; filename="subs.csv"');
  res.type('text/csv').send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
