// server.js
const express     = require('express');
const cors        = require('cors');
const bodyParser  = require('body-parser');
const multer      = require('multer');
const path        = require('path');
const nodemailer  = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// serve uploaded proofs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer config for file uploads (proof)
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// In-memory store (swap for DB in production)
let subscriptions = [];

/**
 * HELPERS
 */

// Generate athlete number: 000-0000-xxxxx
function generateAthleteNumber(id) {
  const seq = String(id).padStart(5, '0');
  return `000-0000-${seq}`;
}

// Nodemailer transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // your Gmail address
    pass: process.env.EMAIL_PASS    // your Gmail app-password
  }
});

/**
 * 1) Webhook: new subscription + optional proof file
 */
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
    athlete_number: '',             // will be set on verification
    payment_status: 'pending',
    proof_file_url: proofUrl,
    subscription_code: `SUB${String(id).padStart(6, '0')}`,
    created_at: new Date().toISOString().split('T')[0]
  };

  subscriptions.push(sub);
  console.log('New subscription received:', sub);
  return res.json({ message: 'Inscrição recebida.', subscription: sub });
});

/**
 * 2) List subscriptions
 */
app.get('/api/subscriptions', (req, res) => {
  res.json(subscriptions);
});

/**
 * 3) Update payment status → generate athlete number + send email
 */
app.patch('/api/subscriptions/:id', async (req, res) => {
  const id     = parseInt(req.params.id, 10);
  const status = req.body.payment_status;
  const sub    = subscriptions.find(s => s.id === id);

  if (!sub) {
    return res.status(404).json({ error: 'Inscrição não encontrada.' });
  }
  sub.payment_status = status;

  // on verification, generate number & send email
  if (status === 'verified') {
    sub.athlete_number = generateAthleteNumber(id);

    const mailOpts = {
      from:    process.env.EMAIL_USER,
      to:      sub.email,
      subject: 'Seu número de atleta está disponível!',
      html: `
        <p>Olá ${sub.name},</p>
        <p>Seu pagamento foi <strong>verificado</strong> com sucesso.</p>
        <p>Seu <strong>Número de Atleta</strong> é:<br>
           <code>${sub.athlete_number}</code>
        </p>
        <p>Aproveite o evento!</p>
      `
    };

    try {
      await transporter.sendMail(mailOpts);
      console.log(`E-mail enviado para ${sub.email}`);
    } catch (err) {
      console.error('Erro ao enviar e-mail:', err);
      // you may want to unset athlete_number on failure, up to you
    }
  }

  return res.json({ message: 'Status atualizado.', subscription: sub });
});

/**
 * 4) Optional: export CSV
 */
app.get('/api/subscriptions/export', (req, res) => {
  const header = ['Nome','Email','Telefone','Evento','Kit','Nº Atleta','Status'];
  const rows = subscriptions.map(s => [
    s.name, s.email, s.phone_number, s.event, s.kit,
    s.athlete_number, s.payment_status
  ]);

  const csv = [header, ...rows]
    .map(r => r.join(','))
    .join('\n');

  res.setHeader('Content-Disposition','attachment; filename="subs.csv"');
  res.type('text/csv').send(csv);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
