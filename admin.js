// admin.js

// ————————————————
// CONFIGURAÇÃO
// ————————————————
const API_BASE      = "http://localhost:3000/api";
const USE_FAKE_DATA = false;    // nunca usaremos fake data agora

let allSubscriptions = [];

// ————————————————
// PONTO DE ENTRADA
// ————————————————
document.addEventListener("DOMContentLoaded", () => {
  loadSubscriptions();

  // filtros e busca
  document.getElementById("event-filter")
    .addEventListener("change", filterAndRender);
  document.getElementById("search-input")
    .addEventListener("input", filterAndRender);

  // exportar CSV usando nossa rota /export
  document.getElementById("export-btn")
    .addEventListener("click", () => {
      window.location.href = `${API_BASE}/subscriptions/export`;
    });
});

// ————————————————
// CARREGA INSCRIÇÕES DA API
// ————————————————
function loadSubscriptions() {
  fetch(`${API_BASE}/subscriptions`)
    .then(res => res.json())
    .then(data => {
      allSubscriptions = data;
      filterAndRender();
      updateDashboard(data);
    })
    .catch(err => console.error("Erro ao carregar inscrições:", err));
}

// ————————————————
// FILTRA E RENDERIZA
// ————————————————
function filterAndRender() {
  const eventFilter = document.getElementById("event-filter").value;
  const searchQuery = document.getElementById("search-input").value.toLowerCase();

  let filtered = allSubscriptions;
  if (eventFilter !== "all") {
    filtered = filtered.filter(s => s.event === eventFilter);
  }
  if (searchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(searchQuery) ||
      (s.athlete_number || "").toLowerCase().includes(searchQuery)
    );
  }

  populateSubscriptionsTable(filtered);
}

// ————————————————
// ATUALIZA OS CARDS DE MÉTRICAS
// ————————————————
function updateDashboard(subs) {
  const total    = subs.length;
  const pending  = subs.filter(s => s.payment_status === "pending").length;
  const verified = subs.filter(s => s.payment_status === "verified").length;

  document.getElementById("total-subscriptions").textContent  = total;
  document.getElementById("pending-payments").textContent    = pending;
  document.getElementById("verified-payments").textContent   = verified;

  const kitCounts = {};
  subs.forEach(s => {
    if (s.kit) kitCounts[s.kit] = (kitCounts[s.kit]||0) + 1;
  });
  const breakdown = Object.entries(kitCounts)
    .map(([k,c]) => `${k}: ${c}`)
    .join(" | ");
  document.getElementById("kit-breakdown")
    .textContent = breakdown || "Nenhum";
}

// ————————————————
// POPULA A TABELA DE INSCRIÇÕES
// ————————————————
function populateSubscriptionsTable(subs) {
  const tbody = document.querySelector("#subscriptions-table tbody");
  tbody.innerHTML = "";

  subs.forEach(s => {
    let icon = s.payment_status === "pending"  ? "⏳"
             : s.payment_status === "verified" ? "✅"
             : "❌";

    const proofLink = s.proof_file_url
      ? `<a href="${s.proof_file_url}" target="_blank">Ver</a>`
      : "-";

    const actions = s.payment_status === "pending"
      ? `<button onclick="updatePaymentStatus(${s.id}, 'verified')">Aprovar</button>
         <button onclick="updatePaymentStatus(${s.id}, 'rejected')">Rejeitar</button>`
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>${s.phone_number}</td>
      <td>${s.event}</td>
      <td>${s.kit}</td>
      <td>${s.athlete_number || "-"}</td>
      <td>${icon} ${s.payment_status}</td>
      <td>${proofLink}</td>
      <td class="actions-btns">${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ————————————————
// ATUALIZA STATUS via PATCH na API
// ————————————————
window.updatePaymentStatus = function(id, status) {
  fetch(`${API_BASE}/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_status: status })
  })
  .then(res => res.json())
  .then(() => loadSubscriptions())
  .catch(err => alert("Erro ao atualizar: " + err.message));
};
