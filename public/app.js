(function () {
  "use strict";

  let leads = [];
  let sortCol = "nome";
  let sortDir = 1;

  const $ = (id) => document.getElementById(id);

  const STATUSES = ["novo", "contatado", "respondido", "fechou", "descartado"];

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error("Erro na requisição");
    return res.json();
  }

  async function load() {
    leads = await fetchJSON("/api/leads");
    populateSelects();
    render();
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function populateSelects() {
    const cidades = unique(leads.map((l) => l.cidade));
    const bairros = unique(leads.map((l) => l.bairro));
    const categorias = unique(leads.map((l) => l.categoria));

    fillSelect($("fCidade"), cidades);
    fillSelect($("fBairro"), bairros);
    fillSelect($("fCategoria"), categorias);
  }

  function fillSelect(sel, values) {
    const current = sel.value;
    sel.innerHTML = `<option value="">${sel.options[0].text}</option>`;
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
    if (current) sel.value = current;
  }

  function getFilter() {
    return {
      cidade: $("fCidade").value,
      bairro: $("fBairro").value,
      categoria: $("fCategoria").value,
      status: $("fStatus").value,
      avaliacaoMin: $("fAvaliacaoMin").value,
      comTelefone: $("fComTelefone").checked,
      comSite: $("fComSite").checked,
      semTelefone: $("fSemTelefone").checked,
      semSite: $("fSemSite").checked,
      comEmail: $("fComEmail").checked,
      semEmail: $("fSemEmail").checked,
      q: $("fBusca").value.trim(),
    };
  }

  function applyFilter() {
    const f = getFilter();
    return leads.filter((l) => {
      if (f.cidade && l.cidade !== f.cidade) return false;
      if (f.bairro && l.bairro !== f.bairro) return false;
      if (f.categoria && l.categoria !== f.categoria) return false;
      if (f.status && l.status !== f.status) return false;
      if (f.avaliacaoMin && l.avaliacao < parseFloat(f.avaliacaoMin)) return false;
      if (f.comTelefone && !l.telefone) return false;
      if (f.comSite && !l.site) return false;
      if (f.semTelefone && l.telefone) return false;
      if (f.semSite && l.site) return false;
      if (f.comEmail && !l.email) return false;
      if (f.semEmail && l.email) return false;
      if (f.q && !(`${l.nome} ${l.email}`.toLowerCase().includes(f.q.toLowerCase()))) return false;
      return true;
    });
  }

  function renderKPIs(filtered) {
    const total = filtered.length;
    const comTelefone = filtered.filter((l) => l.telefone).length;
    const comSite = filtered.filter((l) => l.site).length;
    const semTelefone = total - comTelefone;
    const comAvaliacao = filtered.filter((l) => l.avaliacao > 0);
    const media = comAvaliacao.length
      ? (comAvaliacao.reduce((s, l) => s + l.avaliacao, 0) / comAvaliacao.length).toFixed(2)
      : "—";
    const cidades = new Set(filtered.map((l) => l.cidade)).size;

    const kpis = [
      { value: total, label: "Total de Leads" },
      { value: cidades, label: "Cidades" },
      { value: comTelefone, label: "Com Telefone" },
      { value: comSite, label: "Com Site" },
      { value: semTelefone, label: "Sem Telefone" },
      { value: media, label: "Média de Avaliação" },
    ];

    $("kpis").innerHTML = kpis
      .map((k) => `<div class="kpi"><div class="value">${k.value}</div><div class="label">${k.label}</div></div>`)
      .join("");
  }

  function countBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
      const k = keyFn(item) || "(sem valor)";
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderBarChart(canvasId, data, color) {
    const canvas = $(canvasId);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const top = data.slice(0, 12);
    const max = Math.max(1, ...top.map((d) => d[1]));
    const padL = 10, padR = 10, padT = 10, padB = 30;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const barW = Math.min(28, (chartW / top.length) * 0.6);

    top.forEach((d, i) => {
      const x = padL + (chartW / top.length) * i + (chartW / top.length - barW) / 2;
      const bh = (d[1] / max) * chartH;
      const y = padT + chartH - bh;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, bh);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d[1], x + barW / 2, y - 4);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px sans-serif";
      const label = d[0].length > 16 ? d[0].slice(0, 15) + "…" : d[0];
      ctx.fillText(label, x + barW / 2, h - 8);
    });
  }

  function renderCharts(filtered) {
    renderBarChart("chartCategoria", countBy(filtered, (l) => l.categoria), "#38bdf8");
    renderBarChart("chartCidade", countBy(filtered, (l) => l.cidade), "#a78bfa");
    renderBarChart("chartAvaliacao", countBy(filtered, (l) => (l.avaliacao ? l.avaliacao.toFixed(1) : "sem avaliação")), "#4ade80");
  }

  function waLink(phone) {
    const digits = String(phone).replace(/\D/g, "");
    if (!digits) return null;
    return `https://wa.me/55${digits}?text=${encodeURIComponent("Olá! Encontrei seu contato no Google e gostaria de mais informações.")}`;
  }

  function statusBadge(status) {
    return `<span class="badge ${status}">${status}</span>`;
  }

  function renderTable(filtered) {
    const tbody = $("tbody");
    const rows = [...filtered].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
      return String(va || "").localeCompare(String(vb || ""), "pt-BR") * sortDir;
    });

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty">Nenhum lead encontrado com os filtros atuais.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((l) => {
      const wa = waLink(l.telefone);
      const mapsUrl = l.link_maps || `https://www.google.com/maps/search/${encodeURIComponent(l.nome)}`;
      return `<tr data-id="${l.id}">
        <td class="nome">${escapeHtml(l.nome)}</td>
        <td>${escapeHtml(l.categoria)}</td>
        <td>${escapeHtml(l.cidade)}</td>
        <td class="dim">${escapeHtml(l.bairro)}</td>
        <td>${l.avaliacao ? "★ " + l.avaliacao.toFixed(1) : "—"}</td>
        <td>${l.num_avaliacoes || "—"}</td>
        <td>${l.telefone ? escapeHtml(l.telefone) : '<span class="dim">—</span>'}</td>
        <td>${l.email ? `<a href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a>` : '<span class="dim">—</span>'}</td>
        <td>${l.site ? `<a href="${escapeHtml(l.site)}" target="_blank" rel="noopener">site</a>` : '<span class="dim">—</span>'}</td>
        <td>
          <select class="status-select" data-id="${l.id}">
            ${STATUSES.map((s) => `<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </td>
        <td><input class="nota-input" type="text" value="${escapeHtml(l.nota || "")}" data-id="${l.id}" placeholder="Anotação..." /></td>
        <td class="actions">
          ${wa ? `<a class="whats" href="${wa}" target="_blank" rel="noopener" title="WhatsApp">Whats</a>` : ""}
          <a class="maps" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" title="Abrir no Google Maps">Maps</a>
        </td>
      </tr>`;
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render() {
    const filtered = applyFilter();
    renderKPIs(filtered);
    renderCharts(filtered);
    renderTable(filtered);
    $("resultCount").textContent = `${filtered.length} de ${leads.length} leads`;
  }

  async function saveStatus(id, status, nota) {
    await fetchJSON("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, nota }),
    });
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function wireEvents() {
    const filterEls = ["fCidade", "fBairro", "fCategoria", "fStatus", "fAvaliacaoMin", "fComTelefone", "fComSite", "fSemTelefone", "fSemSite", "fComEmail", "fSemEmail"];
    for (const id of filterEls) $(id).addEventListener("change", render);
    $("fBusca").addEventListener("input", debounce(render, 250));

    document.querySelectorAll("thead th[data-col]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortCol === col) sortDir *= -1;
        else { sortCol = col; sortDir = 1; }
        render();
      });
    });

    $("tbody").addEventListener("change", async (e) => {
      const t = e.target;
      if (t.classList.contains("status-select")) {
        const id = t.dataset.id;
        const lead = leads.find((l) => l.id === id);
        if (lead) {
          lead.status = t.value;
          await saveStatus(id, t.value, lead.nota || "");
        }
      }
    });

    $("tbody").addEventListener("change", debounce(async (e) => {
      const t = e.target;
      if (t.classList.contains("nota-input")) {
        const id = t.dataset.id;
        const lead = leads.find((l) => l.id === id);
        if (lead) {
          lead.nota = t.value;
          await saveStatus(id, lead.status, t.value);
        }
      }
    }, 600));

    $("btnReload").addEventListener("click", async () => {
      $("btnReload").textContent = "Carregando...";
      await load();
      $("btnReload").textContent = "Recarregar";
    });

    $("btnExport").addEventListener("click", async () => {
      const filter = getFilter();
      const url = "/api/export?filter=" + encodeURIComponent(JSON.stringify(filter));
      window.location.href = url;
    });

    window.addEventListener("resize", debounce(render, 200));
  }

  load().catch((e) => {
    $("tbody").innerHTML = `<tr><td colspan="11" class="empty">Falha ao carregar dados: ${e.message}</td></tr>`;
  });
  wireEvents();
})();
