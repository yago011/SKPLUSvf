// ============================================================
//  SK+ PRO v3.0 — Dashboard JS (logica da UI da extensao)
// ============================================================

const $ = (id) => document.getElementById(id);

// ── Elementos
const loginScreen = $("loginScreen");
const mainPanel = $("mainPanel");
const loginKeyInput = $("loginKey");
const loginApiUrlInput = $("loginApiUrl");
const loginError = $("loginError");
const btnLogin = $("btnLogin");
const btnLogout = $("btnLogout");
const userName = $("userName");
const contaSeletor = $("contaSeletor");
const nicknameInput = $("nickname");
const btnMap = $("btnMap");
const btnCancelMap = $("btnCancelMap");
const openAdsContainer = $("openAdsContainer");
const adsPageSelect = $("adsPageSelect");
const btnOpenAdsPage = $("btnOpenAdsPage");
const btnSwap = $("btnSwap");
const btnCancelSwap = $("btnCancelSwap");
const phoneInput = $("phone");
const oldPhoneInput = $("oldPhone");
const taskTwo = $("taskTwo");
const statTotal = $("statTotal");
const statSuccess = $("statSuccess");
const statFailed = $("statFailed");
const statVerified = $("statVerified");
const progressContainer = $("progressContainer");
const progressWave = $("progressWave");
const progressPercent = $("progressPercent");
const progressFill = $("progressFill");
const resultBanner = $("resultBanner");
const logArea = $("logArea");

// Task 3: Verificacao
const verifyNickname = $("verifyNickname");
const verifyNewPhone = $("verifyNewPhone");
const verifyOldPhone = $("verifyOldPhone");
const btnVerify = $("btnVerify");
const statVerifyTotal = $("statVerifyTotal");
const statVerifyNew = $("statVerifyNew");
const statVerifyOld = $("statVerifyOld");
const verifyBanner = $("verifyBanner");
const rescueContainer = $("rescueContainer");
const btnRescueOld = $("btnRescueOld");
const btnAutoRescue = $("btnAutoRescue");

let linksPresos = [];

let currentUser = null;
let currentContas = [];
let apiUrl = "http://localhost:3000";

// ── Log visual
function log(msg, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// ── Inicializacao: verifica se ja tem sessao
chrome.storage.local.get(["sk_jwt", "sk_user", "sk_api_url", "sk_conta_ativa",
  "sk_last_map_nickname", "sk_last_map_count", "sk_last_map_time",
  "sk_mapping_in_progress", "sk_ads_page_index"], async (data) => {

  if (data.sk_api_url) apiUrl = data.sk_api_url;
  loginApiUrlInput.value = apiUrl;

  if (data.sk_jwt && data.sk_user) {
    // Valida JWT com /api/auth/me
    try {
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.sk_jwt}` }
      });
      if (res.ok) {
        const user = await res.json();
        currentUser = user;
        showPanel(data);
        return;
      }
    } catch (e) {
      console.warn("[SK+] Falha ao validar JWT:", e.message);
    }
    // JWT invalido — limpa e mostra login
    chrome.storage.local.remove(["sk_jwt", "sk_user"]);
  }

  showLogin();
});

function showLogin() {
  loginScreen.classList.remove("hidden");
  mainPanel.classList.add("hidden");
  loginKeyInput.focus();
}

function showPanel(storageData) {
  loginScreen.classList.add("hidden");
  mainPanel.classList.remove("hidden");
  userName.textContent = currentUser.nome;

  // Carrega contas
  loadContas(storageData?.sk_conta_ativa);

  // Restaura estado do ultimo mapeamento
  if (storageData) {
    if (storageData.sk_mapping_in_progress) {
      btnMap.disabled = true;
      btnMap.textContent = 'Mapeando em background...';
      log('Mapeamento em andamento no background. Aguardando resultado...', 'info');
    } else if (storageData.sk_last_map_count !== undefined && storageData.sk_last_map_nickname) {
      const count = storageData.sk_last_map_count;
      const nickname = storageData.sk_last_map_nickname;
      const when = storageData.sk_last_map_time
        ? new Date(storageData.sk_last_map_time).toLocaleTimeString()
        : '';
      nicknameInput.value = nickname;
      handleMapResult(count, storageData.sk_ads_page_index || 0);
      log(`Restaurado: ultimo mapeamento de "${nickname}" - ${count} anuncios (${when})`, 'info');
    }
  }
}

// ── Login
btnLogin.addEventListener("click", async () => {
  const chave = loginKeyInput.value.trim();
  if (!chave) {
    showLoginError("Digite sua chave de acesso.");
    return;
  }

  const customUrl = loginApiUrlInput.value.trim();
  if (customUrl) apiUrl = customUrl;

  btnLogin.disabled = true;
  btnLogin.textContent = "Entrando...";
  loginError.style.display = "none";

  try {
    const res = await fetch(`${apiUrl}/api/auth/extensao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}`);
    }

    currentUser = data.user;
    currentContas = data.contas || [];

    // Salva no chrome.storage.local
    await chrome.storage.local.set({
      sk_jwt: data.token,
      sk_user: JSON.stringify(data.user),
      sk_api_url: apiUrl,
    });

    showPanel(null);
    log(`Login OK! Bem-vindo, ${data.user.nome}`, 'success');

    // Popula contas
    populateContas(currentContas);

  } catch (err) {
    showLoginError(err.message);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = "block";
}

// ── Logout
btnLogout.addEventListener("click", () => {
  chrome.storage.local.remove([
    "sk_jwt", "sk_user", "sk_conta_ativa",
    "sk_last_map_nickname", "sk_last_map_count", "sk_last_map_time",
    "sk_mapping_in_progress", "editLinks", "nickname"
  ]);
  currentUser = null;
  currentContas = [];
  showLogin();
});

// ── Contas
async function loadContas(activeId) {
  try {
    const data = await chrome.storage.local.get(["sk_jwt"]);
    const res = await fetch(`${apiUrl}/api/contas`, {
      headers: { 'Authorization': `Bearer ${data.sk_jwt}` }
    });
    if (res.ok) {
      currentContas = await res.json();
      populateContas(currentContas, activeId);
      log("Contas carregadas da API.", "success");
    } else {
      log("Erro ao carregar contas.", "error");
    }
  } catch (err) {
    log("Erro ao buscar contas: " + err.message, "error");
  }
}

function populateContas(contas, activeId) {
  contaSeletor.innerHTML = '<option value="">Selecione a conta...</option>';
  contas.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    if (c.id === activeId) opt.selected = true;
    contaSeletor.appendChild(opt);
  });

  // Se tinha conta ativa, restaura
  if (activeId && contas.find(c => c.id === activeId)) {
    contaSeletor.value = activeId;
  }
}

contaSeletor.addEventListener("change", () => {
  chrome.storage.local.set({ sk_conta_ativa: contaSeletor.value });
  log(`Conta ativa alterada para: ${contaSeletor.value || '(nenhuma)'}`, "info");
});

// ── Task 1: Mapear Anuncios
btnMap.addEventListener("click", () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    log("Digite o apelido da modelo.", "error");
    nicknameInput.focus();
    return;
  }
  verifyNickname.value = nickname; // auto-popula task 3

  btnMap.style.display = "none";
  btnCancelMap.style.display = "inline-block";
  btnCancelMap.disabled = false;
  btnCancelMap.textContent = "Parar";
  
  openAdsContainer.style.display = "none";
  chrome.storage.local.set({ sk_ads_page_index: 0 });
  log(`Mapeamento iniciado para: ${nickname}`, "info");

  chrome.runtime.sendMessage({ action: "mapAds", nickname }, (response) => {
    if (chrome.runtime.lastError) {
      log("Aguardando resultado via evento (SW reiniciou durante operacao)...", "info");
      return;
    }
    if (response && response.type === "mapResult") {
      handleMapResult(response.count, 0);
    } else if (response && response.error) {
      log("Erro: " + response.error, "error");
      btnMap.style.display = "inline-block";
      btnCancelMap.style.display = "none";
    }
  });
});

btnCancelMap.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "cancelMapping" });
  btnCancelMap.disabled = true;
  btnCancelMap.textContent = "Parando...";
});

// ── Helper: finaliza UI do mapeamento
function handleMapResult(count, savedPageIndex = 0) {
  btnMap.style.display = "inline-block";
  btnCancelMap.style.display = "none";
  if (count === 0) {
    log(`Mapeamento concluido: nenhum anuncio encontrado. Verifique o apelido e a sessao Skokka.`, "error");
    openAdsContainer.style.display = "none";
  } else {
    log(`Mapeamento concluido: ${count} anuncios encontrados.`, "success");

    adsPageSelect.innerHTML = "";
    const CHUNK_SIZE = 10;
    const totalPages = Math.ceil(count / CHUNK_SIZE);
    for (let i = 0; i < totalPages; i++) {
      const start = i * CHUNK_SIZE + 1;
      const end = Math.min((i + 1) * CHUNK_SIZE, count);
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Lote ${i + 1} (${start} ao ${end})`;
      adsPageSelect.appendChild(opt);
    }

    if (savedPageIndex < totalPages) {
      adsPageSelect.value = savedPageIndex;
    }

    openAdsContainer.style.display = "block";
  }
  statTotal.textContent = count;
  if (count > 0) taskTwo.style.display = "block";
}

// ── Abrir lotes de anuncios
adsPageSelect.addEventListener("change", () => {
  chrome.storage.local.set({ sk_ads_page_index: adsPageSelect.value });
});

btnOpenAdsPage.addEventListener("click", () => {
  chrome.storage.local.get(["editLinks"], (data) => {
    const rawLinks = data.editLinks || [];
    if (rawLinks.length === 0) {
      log("Nenhum anuncio mapeado para abrir.", "error");
      return;
    }

    const pageIndex = parseInt(adsPageSelect.value, 10);
    const CHUNK_SIZE = 10;
    const chunk = rawLinks.slice(pageIndex * CHUNK_SIZE, pageIndex * CHUNK_SIZE + CHUNK_SIZE);

    log(`Abrindo Lote ${pageIndex + 1} (${chunk.length} anuncios)...`, "info");

    const urls = chunk.map(u => u.replace("/u/post-manage/", "/u/post-update/"));
    urls.forEach(url => {
      chrome.tabs.create({ url, active: false });
    });

    log(`Lote ${pageIndex + 1} aberto com sucesso!`, "success");

    if (pageIndex + 1 < adsPageSelect.options.length) {
      adsPageSelect.value = pageIndex + 1;
    }
    chrome.storage.local.set({ sk_ads_page_index: adsPageSelect.value });
  });
});

// ── Task 2: Trocar Numeros
btnSwap.addEventListener("click", () => {
  const phone = phoneInput.value.trim();
  const oldPhone = oldPhoneInput.value.trim();
  if (!phone) {
    log("Digite o novo numero de telefone.", "error");
    phoneInput.focus();
    return;
  }
  if (!oldPhone) {
    log("Digite o numero antigo para verificacao.", "error");
    oldPhoneInput.focus();
    return;
  }
  verifyNewPhone.value = phone; // auto-popula task 3
  verifyOldPhone.value = oldPhone; // auto-popula task 3

  btnSwap.style.display = "none";
  btnCancelSwap.style.display = "inline-block";
  btnCancelSwap.disabled = false;
  btnCancelSwap.textContent = "Parar";

  taskTwo.scrollIntoView({ behavior: 'smooth' });
  progressContainer.classList.add("active");
  resultBanner.classList.remove("show");
  statSuccess.textContent = "0";
  statFailed.textContent = "0";
  statVerified.textContent = "-";
  progressFill.style.width = "0%";
  progressPercent.textContent = "0%";
  progressWave.textContent = "Iniciando Motor...";
  log(`Iniciando troca: ${oldPhone} -> ${phone}`, "info");

  chrome.runtime.sendMessage({ action: "swapPhone", phone, oldPhone });
});

btnCancelSwap.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "cancelSwap" });
  btnCancelSwap.disabled = true;
  btnCancelSwap.textContent = "Parando...";
});

// ── Task 3: Verificacao
btnVerify.addEventListener("click", () => {
  const nickname = verifyNickname.value.trim();
  const newPhone = verifyNewPhone.value.trim();
  const oldPhone = verifyOldPhone.value.trim();

  if (!nickname || !newPhone) {
    log("Nome da modelo e numero novo sao obrigatorios para verificacao.", "error");
    return;
  }

  btnVerify.disabled = true;
  btnVerify.textContent = "Pesquisando...";
  verifyBanner.style.display = "none";
  rescueContainer.style.display = "none";
  statVerifyTotal.textContent = "...";
  statVerifyNew.textContent = "...";
  statVerifyOld.textContent = "...";
  log(`Verificando integridade para ${nickname}...`, "info");

  chrome.runtime.sendMessage({ action: "silentVerify", nickname, newPhone, oldPhone }, (response) => {
    btnVerify.disabled = false;
    btnVerify.textContent = "Checar Integridade";

    if (chrome.runtime.lastError || response.error) {
      log("Erro na verificacao: " + (chrome.runtime.lastError?.message || response.error), "error");
      return;
    }

    statVerifyTotal.textContent = response.modeloEsperados;
    statVerifyNew.textContent = response.novoConfirmados;

    const velhos = response.linksVelhos || [];
    const perdidos = response.missingLinks || [];
    linksPresos = [...new Set([...velhos, ...perdidos])];
    
    statVerifyOld.textContent = linksPresos.length;

    if (linksPresos.length > 0) {
      verifyBanner.textContent = `Aviso: Faltam ${linksPresos.length} anuncios (Presos no antigo ou não atualizados).`;
      verifyBanner.className = "result-banner error show";
      verifyBanner.style.display = "block";
      
      // Ajuste de cores para chamar atencao mas manter coerencia
      if (response.novoConfirmados < response.modeloEsperados) {
        verifyBanner.style.background = "rgba(245, 158, 11, 0.1)";
        verifyBanner.style.borderColor = "rgba(245, 158, 11, 0.2)";
        verifyBanner.style.color = "#fbbf24";
      }
      
      // Exibe botao de time de resgate
      rescueContainer.querySelector('p').textContent = `Foram encontrados ${linksPresos.length} anúncios perdidos na rede. Clique no botão abaixo para intervir.`;
      rescueContainer.style.display = "block";
      log(`Verificacao: ${linksPresos.length} anuncios precisam de resgate.`, "error");
    } else {
      verifyBanner.textContent = `✅ Tudo perfeito! O numero ${newPhone} tem 100% dos anuncios.`;
      verifyBanner.className = "result-banner success-banner show";
      verifyBanner.style.display = "block";
      log("Verificacao 100% confirmada com sucesso.", "success");
    }
  });
});

btnRescueOld.addEventListener("click", () => {
  if (linksPresos.length === 0) return;
  log(`Acionando Time de Resgate: abrindo ${linksPresos.length} abas de edicao...`, "info");
  const urls = linksPresos.map(u => u.replace("/u/post-manage/", "/u/post-update/"));
  urls.forEach(url => {
    chrome.tabs.create({ url, active: false });
  });
});

btnAutoRescue.addEventListener("click", () => {
  if (linksPresos.length === 0) return;
  const newPhone = verifyNewPhone.value.trim();
  const oldPhone = verifyOldPhone.value.trim();
  
  log(`Acionando Troca Automática (Resgate) para ${linksPresos.length} anúncios...`, "info");
  
  // Limpa/Prepara UI do Task 2 para receber os logs
  taskTwo.scrollIntoView({ behavior: 'smooth' });
  btnSwap.style.display = "none";
  btnCancelSwap.style.display = "inline-block";
  btnCancelSwap.disabled = false;
  btnCancelSwap.textContent = "Parar";
  
  progressContainer.classList.add("active");
  resultBanner.classList.remove("show");
  statTotal.textContent = linksPresos.length;
  statSuccess.textContent = "0";
  statFailed.textContent = "0";
  statVerified.textContent = "-";
  progressFill.style.width = "0%";
  progressPercent.textContent = "0%";
  progressWave.textContent = "Iniciando Resgate Automático...";
  
  chrome.runtime.sendMessage({ action: "swapPhone", phone: newPhone, oldPhone: oldPhone, providedLinks: linksPresos });
});

// ── Escuta eventos do background.js
chrome.runtime.onMessage.addListener((msg) => {
  // Progresso do mapeamento
  if (msg.type === "mapProgress") {
    btnCancelMap.textContent = `Parar (Pag. ${msg.page})`;
    log(`Pag. ${msg.page}: ${msg.total} anuncios encontrados ate agora`, "info");
    return;
  }

  // Resultado final do mapeamento via evento
  if (msg.type === "mapResult") {
    btnMap.style.display = "inline-block";
    btnCancelMap.style.display = "none";
    handleMapResult(msg.count, 0);
    return;
  }
  if (msg.type === "mapError") {
    btnMap.style.display = "inline-block";
    btnCancelMap.style.display = "none";
    log("Erro no mapeamento: " + msg.error, "error");
    return;
  }

  // Progresso das ondas de troca
  if (msg.type === "waveProgress") {
    const pct = msg.total > 0 ? Math.round((msg.completed / msg.total) * 100) : 0;
    progressFill.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
    progressWave.textContent = `Onda ${msg.currentWave}/${msg.totalWaves} - ${msg.completed}/${msg.total}`;
    statSuccess.textContent = msg.completed;
    statFailed.textContent = msg.failed;
    log(`Onda ${msg.currentWave}/${msg.totalWaves}: ${msg.completed} OK, ${msg.failed} falhas (${pct}%)`, "info");
  }

  if (msg.type === "retryStart") {
    progressWave.textContent = `Iniciando repescagem (reserva: ${msg.count} links)`;
    log(`Fila de reserva: ${msg.count} links falharam - retentando...`, "info");
  }

  if (msg.type === "verifyProgress") {
    log(msg.message, "info");
  }

  if (msg.type === "verificando") {
    progressFill.style.width = "95%";
    progressPercent.textContent = "95%";
    progressWave.textContent = msg.message;
    log(msg.message, "info");
  }

  // Conclusao da troca
  if (msg.type === "done") {
    btnSwap.style.display = "inline-block";
    btnCancelSwap.style.display = "none";
    progressFill.style.width = "100%";
    progressPercent.textContent = "100%";

    const ok      = msg.success || 0;
    const falhas  = msg.permanentFails || 0;
    const retried = msg.retried || 0;

    if (falhas === 0) {
      resultBanner.textContent = `✅ Concluido! ${ok} anuncios trocados${retried > 0 ? ` (${retried} recuperados)` : ""}.`;
      resultBanner.className = "result-banner success-banner show";
      log(`Finalizado: ${ok} OK, ${retried} recuperados da reserva. ZERO falhas.`, "success");
    } else {
      resultBanner.textContent = `${ok} OK - ${falhas} falhas permanentes.`;
      resultBanner.className = "result-banner error show";
      log(`Finalizado: ${ok} OK, ${falhas} falhas permanentes.`, "error");
    }
  }
});
