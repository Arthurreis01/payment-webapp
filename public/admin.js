// public/admin.js

// ————————— Configuração —————————
const SHEET_ID        = '1xI2dMCOD_01txYBhfxYihpG5sup80PwZ3JriHsw68pE';
const SHEET_NAME      = 'Form Responses 1';
const GSHEET_JSON_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
  `/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&headers=1`;
// Sua URL do Apps Script Web App (deploy como “anônimo”)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfy…/exec';

let allSubscriptions = [];

document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions();

  document.getElementById('event-filter')
    .addEventListener('change', filterAndRender);
  document.getElementById('search-input')
    .addEventListener('input', filterAndRender);

  document.getElementById('export-btn')
    .addEventListener('click', () => {
      window.location.href =
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
        `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    });

  document.getElementById('send-email-btn')
    .addEventListener('click', () => {
      const email = prompt('Para qual e-mail enviar a lista de atletas?');
      if (email) sendAthleteList(email);
    });
});

function loadSubscriptions() {
  fetch(GSHEET_JSON_URL)
    .then(r => r.text())
    .then(text => {
      const start = text.indexOf('{');
      const end   = text.lastIndexOf('}');
      const data  = JSON.parse(text.slice(start, end + 1));

      const cols = data.table.cols.map(c => c.label || c.id);
      const rows = data.table.rows.map(r => r.c.map(cell => cell ? cell.v : ''));

      allSubscriptions = rows.map((row, idx) => {
        const obj = {};
        cols.forEach((col,i) => obj[col] = row[i] || '');
        return {
          id:             idx + 1,
          timestamp:      obj['Carimbo de data/hora'],
          date:           obj['Carimbo de data/hora']?.split(' ')[0] || '',
          name:           obj['Nome completo'],
          email:          obj['Email'],
          phone_number:   obj['Telefone'],
          event:          obj['Evento'],
          kit:            obj['Kit'],
          category:       obj['Categoria'],
          proof_file_url: obj['Comprovante de pagamento'],
          athlete_number: obj['Número de Atleta']   || '',
          payment_status: obj['Status']             || 'pending'
        };
      });

      populateEventFilter(allSubscriptions);
      filterAndRender();
      updateDashboard(allSubscriptions);
    })
    .catch(err => {
      console.error('Erro ao carregar planilha:', err);
      alert('Não foi possível carregar dados da planilha.');
    });
}

// Popula o <select> de eventos com os valores únicos do sheet
function populateEventFilter(subs) {
  const sel = document.getElementById('event-filter');
  sel.innerHTML = ''; 
  const events = Array.from(new Set(subs.map(s => s.event))).filter(e => e);
  const allOpt = new Option('Todos', 'all');
  sel.appendChild(allOpt);
  events.forEach(ev => {
    sel.appendChild(new Option(ev, ev));
  });
}

function filterAndRender() {
  const evFilter = document.getElementById('event-filter').value;
  const q        = document.getElementById('search-input').value.toLowerCase();
  let filtered   = allSubscriptions;

  if (evFilter !== 'all') filtered = filtered.filter(s => s.event === evFilter);
  if (q) filtered = filtered.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.athlete_number || '').toLowerCase().includes(q)
  );

  populateSubscriptionsTable(filtered);
}

function updateDashboard(subs) {
  document.getElementById('total-subscriptions').textContent =
    subs.length;
  document.getElementById('pending-payments').textContent =
    subs.filter(s => s.payment_status === 'pending').length;
  document.getElementById('verified-payments').textContent =
    subs.filter(s => s.payment_status === 'verified').length;

  const counts = {};
  subs.forEach(s => {
    if (s.kit) counts[s.kit] = (counts[s.kit]||0) + 1;
  });
  document.getElementById('kit-breakdown').textContent =
    Object.entries(counts).map(([k,c]) => `${k}: ${c}`).join(' | ') || 'Nenhum';
}

function populateSubscriptionsTable(subs) {
  const tbody = document.querySelector('#subscriptions-table tbody');
  tbody.innerHTML = '';

  subs.forEach(s => {
    const icon = s.payment_status === 'pending'  ? '⏳'
               : s.payment_status === 'verified' ? '✅'
               : '❌';
    const proofLink = s.proof_file_url
      ? `<a href="${s.proof_file_url}" target="_blank">Ver</a>`
      : '-';
    const actions = s.payment_status === 'pending'
      ? `<button onclick="updatePaymentStatus(${s.id},'verified')">Aprovar</button>
         <button onclick="updatePaymentStatus(${s.id},'rejected')">Rejeitar</button>`
      : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${s.timestamp}</td>
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>${s.phone_number}</td>
      <td>${s.event}</td>
      <td>${s.kit}</td>
      <td>${s.category}</td>
      <td>${proofLink}</td>
      <td>${icon} ${s.payment_status}</td>
      <td>${s.athlete_number || '-'}</td>
      <td class="actions-btns">${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.updatePaymentStatus = (rowId, status) => {
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'updateStatus', row:rowId, status })
  })
  .then(r=>r.json())
  .then(j=>{
    if (j.success) loadSubscriptions();
    else throw new Error(j.error||'Erro desconhecido');
  })
  .catch(err=>alert('Falha: '+err.message));
};

function sendAthleteList(destEmail) {
  fetch(APPS_SCRIPT_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'sendEmail', email:destEmail })
  })
  .then(r=>r.json())
  .then(j=>{
    if (j.success) alert('Email enviado com sucesso!');
    else throw new Error(j.error||'Erro no envio');
  })
  .catch(err=>alert('Falha ao enviar email: '+err.message));
}
