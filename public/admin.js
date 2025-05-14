// public/admin.js

// ————————— Configuração —————————
const SHEET_ID        = '1xI2dMCOD_01txYBhfxYihpG5sup80PwZ3JriHsw68pE';
const SHEET_NAME      = 'Form Responses 1';
const GSHEET_JSON_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
  `/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&headers=1`;

// Proxy local para Apps Script (evita CORS)
const APPS_SCRIPT_URL = '/script';

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
    .then(res => res.text())
    .then(text => {
      const start = text.indexOf('{');
      const end   = text.lastIndexOf('}');
      const data  = JSON.parse(text.slice(start, end + 1));

      const cols     = data.table.cols.map(c => c.label || c.id);
      const proofIdx = cols.indexOf('Comprovante de pagamento');

      allSubscriptions = data.table.rows.map((rowEntry, idx) => {
        const obj = {};
        rowEntry.c.forEach((cell, i) => {
          obj[cols[i]] = cell && cell.v ? cell.v : '';
        });

        let proofUrl = '';
        const cellObj = rowEntry.c[proofIdx];
        if (cellObj) {
          if (cellObj.f) {
            const m = cellObj.f.match(/href="([^"]+)"/);
            if (m) proofUrl = m[1];
          } else if (cellObj.v) {
            proofUrl = cellObj.v;
          }
        }

        return {
          id:               idx + 1,
          timestamp:        obj['Carimbo de data/hora'],
          date:             obj['Carimbo de data/hora']?.split(' ')[0] || '',
          name:             obj['Nome completo'],
          email:            obj['Email'],
          phone_number:     obj['Telefone'],
          event:            obj['Evento'],
          kit:              obj['Kit'],
          category:         obj['Categoria'],
          proof_file_url:   proofUrl,
          athlete_number:   obj['Número de Atleta'] || '',
          payment_status:   obj['Status']             || 'pending'
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

function populateEventFilter(subs) {
  const sel = document.getElementById('event-filter');
  sel.innerHTML = '';
  sel.appendChild(new Option('Todos', 'all'));
  Array.from(new Set(subs.map(s => s.event)))
    .filter(e => e)
    .forEach(ev => sel.appendChild(new Option(ev, ev)));
}

function filterAndRender() {
  const evFilter = document.getElementById('event-filter').value;
  const query    = document.getElementById('search-input').value.toLowerCase();

  let filtered = allSubscriptions;
  if (evFilter !== 'all') {
    filtered = filtered.filter(s => s.event === evFilter);
  }
  if (query) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.athlete_number.toLowerCase().includes(query)
    );
  }

  populateSubscriptionsTable(filtered);
}

function updateDashboard(subs) {
  document.getElementById('total-subscriptions').textContent =
    subs.length;
  document.getElementById('pending-payments').textContent =
    subs.filter(s => s.payment_status === 'pending').length;
  document.getElementById('verified-payments').textContent =
    subs.filter(s => s.payment_status === 'verified').length;

  const kitCounts = {};
  subs.forEach(s => {
    if (s.kit) kitCounts[s.kit] = (kitCounts[s.kit] || 0) + 1;
  });
  document.getElementById('kit-breakdown').textContent =
    Object.entries(kitCounts)
      .map(([k, c]) => `${k}: ${c}`)
      .join(' | ') || 'Nenhum';
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
    const emailBtn = `<button onclick="sendAthleteEmail(${s.id})">✉️</button>`;
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
      <td>${emailBtn}</td>
      <td class="actions-btns">${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Replace your old updatePaymentStatus with this:
window.updatePaymentStatus = function(rowId, status) {
  fetch('/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action:'updateStatus', row:rowId, status })
  })
  .then(async res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      console.error('Resposta do /script (não é JSON):', text);
      throw new Error('Resposta inesperada do servidor ao atualizar.');
    }
    if (!data.success) throw new Error(data.error || 'Erro desconhecido');
    loadSubscriptions();
  })
  .catch(err => alert('Falha ao atualizar: ' + err.message));
};

// Replace your old sendAthleteEmail with this:
window.sendAthleteEmail = function(rowId) {
  fetch('/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action:'sendSingleEmail', row:rowId })
  })
  .then(async res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      console.error('Resposta do /script (não é JSON):', text);
      throw new Error('Resposta inesperada do servidor ao enviar e-mail.');
    }
    if (!data.success) throw new Error(data.error || 'Erro desconhecido');
    alert('E-mail enviado com sucesso ao atleta!');
  })
  .catch(err => alert('Falha ao enviar e-mail: ' + err.message));
};

function sendAthleteList(destEmail) {
  fetch(APPS_SCRIPT_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'sendEmail', email:destEmail })
  })
  .then(r => r.json())
  .then(j => {
    if (j.success) alert('Email enviado com sucesso!');
    else throw new Error(j.error || 'Erro no envio');
  })
  .catch(err => alert('Falha ao enviar email: '+err.message));
}
