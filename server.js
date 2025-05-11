// server.js
const express     = require('express');
const cors        = require('cors');
const bodyParser  = require('body-parser');
const multer      = require('multer');
const path        = require('path');
const nodemailer  = require('nodemailer');

const app = express();

// Habilita CORS apenas para rotas /api
app.use('/api', cors());

// Parse JSON bodies
app.use(bodyParser.json());

// Serve front-end estático (admin.html, admin.js, admin.css)
app.use(express.static(path.join(__dirname, 'public')));

// Se quiser que a raiz sirva diretamente o admin.html:
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve uploads de comprovantes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do Multer para upload de arquivos (proof)
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Armazenamento em memória (substituir por DB real em produção)
let subscriptions = [];

/** Gera número de atleta: 000-0000-xxxxx */
function generateAthleteNumber(id) {
  const seq = String(id).padStart(5, '0');
  return `000-0000-${seq}`;
}

// Configuração do Nodemailer (exemplo Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // seu Gmail
    pass: process.env.EMAIL_PASS    // sua app-senha
  }
});

/**
 * 1) Webhook: recebe nova inscrição + opcional comprovante
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
    athlete_number: '',             // será preenchido ao verificar
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
 * 2) Lista todas as inscrições
 */
app.get('/api/subscriptions', (req, res) => {
  res.json(subscriptions);
});

/**
 * 3) Atualiza status de pagamento → gera número de atleta + envia e-mail
 */
app.patch('/api/subscriptions/:id', async (req, res) => {
  const id     = parseInt(req.params.id, 10);
  const status = req.body.payment_status;
  const sub    = subscriptions.find(s => s.id === id);

  if (!sub) {
    return res.status(404).json({ error: 'Inscrição não encontrada.' });
  }
  sub.payment_status = status;

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
    }
  }

  return res.json({ message: 'Status atualizado.', subscription: sub });
});

/**
 * 4) Exporta CSV das inscrições
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

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
