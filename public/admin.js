// public/admin.js

// ————————————————
// CONFIGURAÇÃO
// ————————————————
// Build the API base dynamically so it works anywhere:
// Locally it'll resolve to http(s)://localhost:3000/api
// In production it'll resolve to https://<your-backend-domain>/api
const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

let allSubscriptions = [];

document.addEventListener("DOMContentLoaded", () => {
  loadSubscriptions();

  document.getElementById("event-filter")
    .addEventListener("change", filterAndRender);
  document.getElementById("search-input")
    .addEventListener("input", filterAndRender);
  document.getElementById("export-btn")
    .addEventListener("click", () => {
      window.location.href = `${API_BASE}/subscriptions/export`;
    });
});

function loadSubscriptions() {
  fetch(`${API_BASE}/subscriptions`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      allSubscriptions = data;
      filterAndRender();
      updateDashboard(data);
    })
    .catch(err => {
      console.error("Erro ao carregar inscrições:", err);
      alert(
        "Não foi possível carregar inscrições. " +
        `Verifique se o servidor está disponível em ${API_BASE}`
      );
    });
}

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

function updateDashboard(subs) {
  document.getElementById("total-subscriptions").textContent =
    subs.length;
  document.getElementById("pending-payments").textContent =
    subs.filter(s => s.payment_status === "pending").length;
  document.getElementById("verified-payments").textContent =
    subs.filter(s => s.payment_status === "verified").length;

  const kitCounts = {};
  subs.forEach(s => {
    if (s.kit) kitCounts[s.kit] = (kitCounts[s.kit]||0) + 1;
  });
  document.getElementById("kit-breakdown").textContent =
    Object.entries(kitCounts)
          .map(([k,c]) => `${k}: ${c}`)
          .join(" | ") || "Nenhum";
}

function populateSubscriptionsTable(subs) {
  const tbody = document.querySelector("#subscriptions-table tbody");
  tbody.innerHTML = "";

  subs.forEach(s => {
    const icon = s.payment_status === "pending"  ? "⏳"
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
      <td class="actions-btns">${actions}</td>`;
    tbody.appendChild(tr);
  });
}

window.updatePaymentStatus = function(id, status) {
  fetch(`${API_BASE}/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_status: status })
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(() => loadSubscriptions())
  .catch(err => alert("Erro ao atualizar: " + err.message));
};
