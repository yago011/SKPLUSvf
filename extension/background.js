// ============================================================
//  SK+ PRO v3.0 — Service Worker (Motor identico ao v1, auth JWT)
// ============================================================

const TAB_TIMEOUT_MS = 12000;
const INJECT_DELAY_MS = 1500;
const BASE_URL = "https://br.skokka.com";
const ADS_PER_PAGE = 10;
const POLL_INTERVAL_MS = 5000;

// FIX 12 — Mutex persistente via chrome.storage (substitui variável global para MV3 Service Worker efêmero)
async function acquireLock() {
  return new Promise(resolve => {
    chrome.storage.local.get(['sk_processing_lock', 'sk_lock_ts'], (res) => {
      const locked = res.sk_processing_lock === true;
      const lockAge = Date.now() - (res.sk_lock_ts || 0);
      // Lock expira após 10 minutos (failsafe para SW morto no meio da tarefa)
      if (locked && lockAge < 10 * 60 * 1000) {
        resolve(false);  // não conseguiu o lock
      } else {
        chrome.storage.local.set({ sk_processing_lock: true, sk_lock_ts: Date.now() }, () => {
          resolve(true);  // lock adquirido
        });
      }
    });
  });
}

async function releaseLock() {
  return new Promise(resolve => {
    chrome.storage.local.remove(['sk_processing_lock', 'sk_lock_ts'], resolve);
  });
}

// Throttle: controla quando cada rotina periodica rodou pela ultima vez
let pollerActive    = false;
let lastKeepAlivePing = 0;
let lastRecoveryRun   = 0;

// Configuracoes padrao (sobrescritas pelo chrome.storage.local)
let config = {
  apiUrl: "http://localhost:3000",
  jwt: "",
  contaAtiva: ""
};

// Carrega config inicial
chrome.storage.local.get(["sk_api_url", "sk_jwt", "sk_conta_ativa"], (res) => {
  if (res.sk_api_url) config.apiUrl = res.sk_api_url;
  if (res.sk_jwt) config.jwt = res.sk_jwt;
  if (res.sk_conta_ativa) config.contaAtiva = res.sk_conta_ativa;
  console.log("[SK+] Config carregada:", { apiUrl: config.apiUrl, contaAtiva: config.contaAtiva, hasJwt: !!config.jwt });
});

// loadConfig como Promise para evitar race condition no SW efemero (MV3)
function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(["sk_api_url", "sk_jwt", "sk_conta_ativa"], (res) => {
      if (res.sk_api_url) config.apiUrl = res.sk_api_url;
      if (res.sk_jwt) config.jwt = res.sk_jwt;
      if (res.sk_conta_ativa) config.contaAtiva = res.sk_conta_ativa;
      resolve();
    });
  });
}

// Escuta mudancas no storage para atualizar config em tempo real
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sk_api_url) config.apiUrl = changes.sk_api_url.newValue;
  if (changes.sk_jwt) config.jwt = changes.sk_jwt.newValue;
  if (changes.sk_conta_ativa) config.contaAtiva = changes.sk_conta_ativa.newValue;
});

// ── Abrir dashboard em aba ao clicar no icone (sem popup)
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// ── Helper para chamadas de API (JWT em vez de x-api-key)
async function callApi(endpoint, method = 'GET', body = null) {
  try {
    const url = `${config.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (config.jwt) {
      headers['Authorization'] = `Bearer ${config.jwt}`;
    }
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 401) {
      console.warn("[SK+] JWT expirado ou invalido. Limpando sessao.");
      chrome.storage.local.remove(["sk_jwt", "sk_user"]);
      throw new Error("Sessao expirada. Faca login novamente.");
    }
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API ${res.status}: ${errorText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[SK+] API Error ${method} ${endpoint}:`, err.message);
    throw err;
  }
}

// ── Log no servidor apos operacao concluida
async function logToServer(acao, detalhes) {
  try {
    await callApi('/api/logs', 'POST', {
      conta_id: config.contaAtiva,
      acao,
      detalhes: typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)
    });
  } catch (err) {
    console.warn("[SK+] Falha ao enviar log ao servidor:", err.message);
  }
}

// ── Mensagens do dashboard
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "mapAds") {
    handleMapAds(msg.nickname, sendResponse);
    return true;
  }
  if (msg.action === "swapPhone") {
    handleSwapPhone(msg.phone, msg.oldPhone, msg.providedLinks)
      .then(result => sendResponse({ type: "done", ...result }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === "verifyPhone") {
    handleVerifyPhone(msg.newPhone, msg.oldPhone, msg.expectedTotal)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === "silentVerify") {
    handleSilentVerify(msg.nickname, msg.newPhone, msg.oldPhone)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.action === "cancelMapping") {
    chrome.storage.local.set({ sk_mapping_cancelled: true });
    sendResponse({ ok: true });
    return false;
  }
  if (msg.action === "cancelSwap") {
    chrome.storage.local.set({ sk_swap_cancelled: true });
    sendResponse({ ok: true });
    return false;
  }
  if (msg.action === "getConfig") {
    sendResponse({ apiUrl: config.apiUrl, contaAtiva: config.contaAtiva });
    return false;
  }
});

async function handleVerifyPhone(newPhone, oldPhone, expectedTotal) {
  let oldPhoneCheck = { count: 0, links: [] };
  if (oldPhone) oldPhoneCheck = await fetchPaginatedAds(oldPhone);
  
  const newPhoneCheck = await fetchPaginatedAds(newPhone);
  
  const velhosReais = oldPhoneCheck.links.filter(u => !newPhoneCheck.links.includes(u));
  
  return {
    antigoRestantes: velhosReais.length,
    novoConfirmados: newPhoneCheck.count,
    sucessoAbsoluto: velhosReais.length === 0 && newPhoneCheck.count >= expectedTotal,
    linksVelhos: velhosReais,
    linksNovos: newPhoneCheck.links
  };
}

async function handleSilentVerify(nickname, newPhone, oldPhone) {
  const modelCheck = await fetchPaginatedAds(nickname);
  let oldPhoneCheck = { count: 0, links: [] };
  if (oldPhone) oldPhoneCheck = await fetchPaginatedAds(oldPhone);
  const newPhoneCheck = await fetchPaginatedAds(newPhone);
  
  // O SEGREDO DO RESGATE PERFEITO: Diferenca entre o que existe pro Mapeamento e o que existe no Novo!
  const missingLinks = modelCheck.links.filter(u => !newPhoneCheck.links.includes(u));
  
  console.log("[SK+] [VERIFY DEBUG] modelCheck.links (amostra):", modelCheck.links.slice(0, 3));
  console.log("[SK+] [VERIFY DEBUG] newPhoneCheck.links (amostra):", newPhoneCheck.links.slice(0, 3));
  
  // Limpa o cache maluco da Skokka: se o link já existe no NOVO, não deve ser considerado preso no VELHO!
  const velhosReais = oldPhoneCheck.links.filter(u => !newPhoneCheck.links.includes(u));
  
  return {
    modeloEsperados: modelCheck.count,
    antigoRestantes: velhosReais.length,
    novoConfirmados: newPhoneCheck.count,
    linksVelhos: velhosReais,
    missingLinks: missingLinks
  };
}

// ============================================================
//  TASK 1 — SCRAPER SILENCIOSO (Mapeamento Manual via Dashboard)
// ============================================================

async function handleMapAds(nickname, sendResponse) {
  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    const errMsg = { error: "Extensao ocupada. Aguarde a tarefa atual terminar." };
    sendToDashboard({ type: "mapError", error: errMsg.error });
    sendResponse(errMsg);
    return;
  }
  await chrome.storage.local.set({
    sk_mapping_in_progress: true,
    sk_mapping_nickname: nickname,
  });
  console.log("[SK+] [MAP] Iniciando mapeamento manual:", nickname);

  try {
    sendToDashboard({ type: "mapProgress", page: 1, total: 0 });
    const page1 = await fetchMappingPage(nickname, 1);

    if (page1 === null) {
      throw new Error("Falha ao acessar pag. 1 — sessao Skokka expirada?");
    }
    if (page1.length === 0) {
      await chrome.storage.local.set({
        sk_mapping_in_progress: false,
        sk_last_map_nickname: nickname,
        sk_last_map_count: 0,
        sk_last_map_time: Date.now(),
      });
      const resultMsg = { type: "mapResult", count: 0, links: [] };
      sendToDashboard(resultMsg);
      sendResponse(resultMsg);
      return;
    }

    let allLinks = [...page1];
    console.log(`[SK+] [MAP] Pag. 1: ${page1.length} links`);
    await chrome.storage.local.set({ sk_mapping_cancelled: false });
    sendToDashboard({ type: "mapProgress", page: 1, total: allLinks.length });
    
    if (page1.length >= ADS_PER_PAGE) {
      const BATCH = 3;
      let nextPage = 2;
      let hasMore = true;

      while (hasMore) {
        const batch = Array.from({ length: BATCH }, (_, i) => nextPage + i);
        const results = await Promise.all(batch.map(p => fetchMappingPage(nickname, p)));

        for (let i = 0; i < results.length; i++) {
          const pageLinks = results[i];
          const pageNum = batch[i];
          if (!pageLinks || pageLinks.length === 0) { hasMore = false; break; }
          allLinks = allLinks.concat(pageLinks);
          console.log(`[SK+] [MAP] Pag. ${pageNum}: ${pageLinks.length} links (total: ${allLinks.length})`);
          sendToDashboard({ type: "mapProgress", page: pageNum, total: allLinks.length });
          if (pageLinks.length < ADS_PER_PAGE) { hasMore = false; break; }
        }
        if (hasMore) nextPage += BATCH;
      }
    }

    const editLinks = [...new Set(allLinks)];
    await chrome.storage.local.set({ editLinks, nickname });
    console.log(`[SK+] [MAP] Concluido: ${editLinks.length} links unicos para "${nickname}"`);

    await chrome.storage.local.set({
      sk_mapping_in_progress: false,
      sk_last_map_nickname: nickname,
      sk_last_map_count: editLinks.length,
      sk_last_map_time: Date.now(),
    });

    // Salva cache na API
    if (config.contaAtiva) {
      try {
        await callApi('/api/modelos', 'POST', {
          modelo: nickname,
          conta_id: config.contaAtiva,
          quantidade_anuncios: editLinks.length,
          links_edicao: editLinks,
        });
      } catch (e) {
        console.warn("[SK+] Falha ao salvar cache na API:", e.message);
      }
    }

    // Log no servidor
    await logToServer('mapeamento', {
      modelo: nickname,
      anuncios: editLinks.length,
      conta_id: config.contaAtiva
    });

    const resultMsg = { type: "mapResult", count: editLinks.length, links: editLinks };
    sendToDashboard(resultMsg);
    sendResponse(resultMsg);
  } catch (err) {
    console.error("[SK+] [MAP] Erro:", err.message);
    await chrome.storage.local.set({ sk_mapping_in_progress: false });
    const errMsg = { error: err.message };
    sendToDashboard({ type: "mapError", error: err.message });
    sendResponse(errMsg);
  } finally {
    await releaseLock();
  }
}

// Extrai links de gerenciamento do HTML server-rendered
function extractPostManageLinks(html) {
  const links = [];
  const pattern = /href="(\/u\/post-manage\/[a-zA-Z0-9]+[^"]*)"/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    let url = m[1].split("?")[0];
    if (!url.endsWith("/")) url += "/";
    const full = BASE_URL + url;
    if (!links.includes(full)) links.push(full);
  }
  return links;
}

// Fetch de uma unica pagina de listagem para um modelo
async function fetchMappingPage(modelo, page) {
  let url = `${BASE_URL}/u/account/ads/?q=${encodeURIComponent(modelo)}&type=all`;
  if (page > 1) url += `&p=${page}`;
  try {
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) return null;
    const html = await resp.text();
    return extractPostManageLinks(html);
  } catch (e) {
    console.error(`[SK+] [MAP] Erro pag. ${page}:`, e.message);
    return null;
  }
}

// Fetch total ads count by query (phone or nickname) with complete pagination
async function fetchPaginatedAds(query) {
  try {
    let allLinks = [];
    let page = 1;
    let hasMore = true;
    const ADS_PER_PAGE = 10;
    
    while (hasMore) {
      sendToDashboard({ type: "verifyProgress", message: `Consultando base Skokka para '${query}' (Página ${page})...` });
      
      let url = `${BASE_URL}/u/account/ads/?q=${encodeURIComponent(query)}&type=all`;
      if (page > 1) url += `&p=${page}`;
      
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) break;
      
      const html = await resp.text();
      const links = extractPostManageLinks(html);
      
      if (links.length === 0) break;
      
      allLinks = allLinks.concat(links);
      
      // If we got exactly ADS_PER_PAGE, there MIGHT be a next page
      if (links.length === ADS_PER_PAGE) {
        page++;
      } else {
        hasMore = false; // less than 10 means last page
      }
    }
    
    const uniqueLinks = [...new Set(allLinks)];
    return { count: uniqueLinks.length, links: uniqueLinks };
  } catch (e) {
    console.error(`[SK+] [VERIFY] Erro ao buscar paginado ${query}:`, e.message);
    return { count: 0, links: [] };
  }
}

// ============================================================
//  TASK 2 — MOTOR DE VELOCIDADE (ONDAS DE ABAS)
// ============================================================

async function handleSwapPhone(phone, oldPhone, providedLinks = null) {
  let rawLinks = [];
  if (providedLinks) {
    rawLinks = providedLinks;
  } else {
    const data = await chrome.storage.local.get(["editLinks"]);
    rawLinks = data.editLinks || [];
  }
  const links = rawLinks.map((u) => u.replace("/u/post-manage/", "/u/post-update/"));

  if (links.length === 0) {
    console.warn("[SK+] Nenhum link mapeado.");
    return { success: 0, retried: 0, permanentFails: 0 };
  }

  const CHUNK = 6;
  const totalChunks = Math.ceil(links.length / CHUNK);
  let completed = 0;
  let failed = 0;
  let verificacoes = 0; // contador de modais de verificação detectados
  const reserveQueue = [];

  console.log(`[SK+] ======================================`);
  console.log(`[SK+] MOTOR INICIADO`);
  console.log(`[SK+] Total: ${links.length} | Lotes: ${totalChunks} x ${CHUNK}`);
  console.log(`[SK+] Telefone: ${phone}`);
  console.log(`[SK+] ======================================`);

  await chrome.storage.local.set({ sk_swap_cancelled: false });

  for (let i = 0; i < links.length; i += CHUNK) {
    const checkCancel = await chrome.storage.local.get("sk_swap_cancelled");
    if (checkCancel.sk_swap_cancelled) {
      console.warn("[SK+] Troca cancelada pelo usuario na Fila Principal.");
      sendToDashboard({ type: "done", success: completed, retried: 0, permanentFails: failed, verificacoes, verificacaoSeguranca: null });
      return { success: completed, retried: 0, permanentFails: failed, verificacoes, verificacaoSeguranca: null };
    }

    const chunk = links.slice(i, i + CHUNK);
    const chunkNum = Math.floor(i / CHUNK) + 1;

    console.log(`[SK+] ---- LOTE ${chunkNum}/${totalChunks} ---- (${chunk.length} abas)`);

    const results = await Promise.allSettled(
      chunk.map((url, idx) => processTab(url, phone, chunkNum, idx + 1))
    );

    results.forEach((r, idx) => {
      const url = chunk[idx];
      const res = r.status === "fulfilled" ? r.value : { success: false, hadModal: false };
      if (res.success) {
        completed++;
        if (res.hadModal) {
          verificacoes++;
          const label = `Verificação necessária #${verificacoes}`;
          console.warn(`[SK+] [MODAL] ${label} — ${url}`);
          sendToDashboard({ type: "verificacao", count: verificacoes, url, label });
        }
      } else {
        failed++;
        reserveQueue.push(url);
        const reason = r.status === "rejected" ? r.reason?.message : JSON.stringify(res);
        console.warn(`[SK+] [Lote ${chunkNum}] RESERVA <- ${url} (${reason})`);
      }
    });

    console.log(`[SK+] ---- LOTE ${chunkNum} CONCLUIDO ---- OK: ${completed} | Verificações: ${verificacoes} | Reserva: ${reserveQueue.length}`);

    sendToDashboard({
      type: "waveProgress",
      currentWave: chunkNum,
      totalWaves: totalChunks,
      completed,
      failed,
      verificacoes,
      total: links.length,
    });

    if (i + CHUNK < links.length) await sleep(1500);
  }

  // ── FILA DE RESERVA
  let retried = 0;
  let permanentFails = 0;

  if (reserveQueue.length > 0) {
    console.log(`[SK+] ======================================`);
    console.log(`[SK+] FILA DE RESERVA: ${reserveQueue.length} links`);
    console.log(`[SK+] ======================================`);

    sendToDashboard({ type: "retryStart", count: reserveQueue.length });
    await sleep(2000);

    const retryChunks = Math.ceil(reserveQueue.length / CHUNK);
    for (let i = 0; i < reserveQueue.length; i += CHUNK) {
      const checkCancel = await chrome.storage.local.get("sk_swap_cancelled");
      if (checkCancel.sk_swap_cancelled) {
        console.warn("[SK+] Troca cancelada pelo usuario na Reserva.");
        break;
      }

      const chunk = reserveQueue.slice(i, i + CHUNK);
      const chunkNum = Math.floor(i / CHUNK) + 1;

      console.log(`[SK+] ---- RESERVA LOTE ${chunkNum}/${retryChunks} ---- (${chunk.length} abas)`);

      const results = await Promise.allSettled(
        chunk.map((url, idx) => processTab(url, phone, `R${chunkNum}`, idx + 1))
      );

      results.forEach((r, idx) => {
        const res = r.status === "fulfilled" ? r.value : { success: false, hadModal: false };
        if (res.success) {
          retried++;
          completed++;
          if (res.hadModal) {
            verificacoes++;
            const label = `Verificação necessária #${verificacoes}`;
            console.warn(`[SK+] [MODAL] ${label} (reserva) — ${chunk[idx]}`);
            sendToDashboard({ type: "verificacao", count: verificacoes, url: chunk[idx], label });
          }
          console.log(`[SK+] RESERVA OK: ${chunk[idx]}`);
        } else {
          permanentFails++;
          console.error(`[SK+] FALHA PERMANENTE: ${chunk[idx]}`);
        }
      });
      
      // Envia progresso da repescagem para o dashboard
      sendToDashboard({
        type: "waveProgress",
        currentWave: `Reserva ${chunkNum}`,
        totalWaves: retryChunks,
        completed,
        failed: permanentFails,
        verificacoes,
        total: links.length,
      });

      if (i + CHUNK < reserveQueue.length) await sleep(1500);
    }
  }

  console.log(`[SK+] MOTOR FINALIZADO | OK: ${completed} | Falhas: ${permanentFails}`);
  sendToDashboard({ type: "verificando", message: "Concluindo relatórios finais..." });

  const verificacaoSeguranca = {
    antigoRestantes: 0,
    novoConfirmados: completed,
    sucessoAbsoluto: completed >= links.length
  };

  // Log no servidor apos swap concluido
  await logToServer('troca_numeros', {
    modelo: (await chrome.storage.local.get(["nickname"])).nickname || 'desconhecido',
    anuncios: links.length,
    sucesso: completed,
    falhas: permanentFails,
    recuperados: retried,
    verificacoes,
    numero_novo: phone,
    numero_antigo: oldPhone,
    conta_id: config.contaAtiva,
    verificacaoSeguranca // log security payload
  });

  sendToDashboard({ type: "done", success: completed, retried, permanentFails, verificacoes, verificacaoSeguranca });

  return { success: completed, retried, permanentFails, verificacoes, verificacaoSeguranca };
}

// ── Helper: detecta e descarta o modal de classificação de nudez (se presente)
async function dismissModalIfPresent(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Detecta o modal específico de classificação de nudez do Skokka
        const modalTitle = document.querySelector('[data-testid="lightbox-nudity-classification-title"]');
        const classificationTitle = Array.from(document.querySelectorAll('h2, h3, div')).find(el => el.textContent.includes('Aumente a visibilidade') || el.textContent.includes('foto Segura'));
        const modalContent = document.querySelector('.modal-content');
        
        if (!modalTitle && !classificationTitle && !modalContent) return { modalFound: false };

        // O botão CONTINUAR pode recarregar a página ou submeter um formulário paralelo
        const buttons = Array.from(document.querySelectorAll('button'));
        const continuarBtn = buttons.find(b => b.textContent.trim().toUpperCase() === 'CONTINUAR');
        
        if (continuarBtn) {
          continuarBtn.click();
          return { modalFound: true, action: 'continuar' };
        }

        // Tenta botão com data-dismiss="modal" se não achou "CONTINUAR" texto puro
        const dismissButtons = Array.from(document.querySelectorAll('button[data-dismiss="modal"]'));
        const dismissContinuar = dismissButtons.find(b => b.textContent.trim().toUpperCase().includes('CONTINUAR'));
        if (dismissContinuar) {
          dismissContinuar.click();
          return { modalFound: true, action: 'continuar-dismiss' };
        }

        // Falha no Continuar, tenta o X de fechar modal
        const closeBtn = document.querySelector('button.modal-close[data-dismiss="modal"]');
        if (closeBtn) {
          closeBtn.click();
          return { modalFound: true, action: 'fechar-x' };
        }

        return { modalFound: true, action: 'sem-botao' };
      },
    });

    const info = result?.[0]?.result;
    if (info?.modalFound) {
      console.log(`[SK+] [MODAL] Verificação detectada (ação: ${info.action}) — aguardando fechar...`);
      await sleep(1000);
      return true; // modal encontrado e descartado
    }
    return false;
  } catch (e) {
    // Silencioso — a tab pode ter navegado e o contexto do script não existe mais
    return false;
  }
}

async function processTab(url, phone, waveId, tabIdx) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ active: false, url });
    const loaded = await waitForTabComplete(tab.id, TAB_TIMEOUT_MS);
    if (!loaded) {
      await chrome.tabs.reload(tab.id);
      await waitForTabComplete(tab.id, TAB_TIMEOUT_MS);
    }
    await sleep(INJECT_DELAY_MS);

    // ── STEP 1: Preenche e submete o formulário de troca de número
    const phoneClean = phone.replace(/\D/g, "");
    const phoneIntl = phoneClean.startsWith("55") ? `+${phoneClean}` : `+55${phoneClean}`;

    const injectResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (p, pi) => {
        try {
          const form = document.querySelector("form");
          if (!form) return { error: "SEM_FORM" };
          const setVal = (n, v) => {
            const el = form.querySelector(`[name='${n}']`);
            if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
          };
          setVal("telephone", p);
          setVal("telephone_national", pi);
          setVal("telephone_international", pi);
          setVal("telephone_international_prefix", "+55");
          const stepEl = form.querySelector("[name='current_step']");
          if (stepEl) stepEl.value = "0";
          form.submit();
          return { success: true };
        } catch (e) { return { error: e.message }; }
      },
      args: [phone, phoneIntl],
    });

    const formSubmitted = injectResult?.[0]?.result?.success;
    if (!formSubmitted) {
      await closeTab(tab.id);
      return false;
    }

    // ── STEP 2: Aguarda a navegação pós-submit (página resultante do Skokka)
    // O modal de verificação aparece NESTA página resultante, não na página do form
    await waitForTabComplete(tab.id, TAB_TIMEOUT_MS);
    await sleep(800); // aguarda renderização do DOM pós-navegação

    // ── STEP 3: Descarta o modal de classificação (aparece em alguns anúncios)
    const hadModal = await dismissModalIfPresent(tab.id);

    // ── STEP 4: Aguarda estabilizar e fecha a aba
    await sleep(1000);
    await closeTab(tab.id);
    return { success: true, hadModal };

  } catch (err) {
    if (tab?.id) await closeTab(tab.id);
    return { success: false, hadModal: false };
  }
}


// ============================================================
//  POLLING DE TAREFAS
// ============================================================

async function recoverStaleTasks() {
  const now = Date.now();
  if (now - lastRecoveryRun < 5 * 60 * 1000) return;
  lastRecoveryRun = now;

  try {
    const tasks = await callApi(`/api/tarefas?status=processando&conta_id=${config.contaAtiva}&limit=10`);
    if (!tasks || !tasks.length) return;
    const STALE_MS = 3 * 60 * 1000;
    for (const task of tasks) {
      const rawDate = task.updated_at || task.created_at;
      // SQLite returns "YYYY-MM-DD HH:MM:SS" (in UTC but without Z)
      // We must append Z so JS parses it as UTC instead of local time
      const utcDateStr = rawDate.endsWith('Z') ? rawDate : rawDate.replace(' ', 'T') + 'Z';
      const ageMs = Date.now() - new Date(utcDateStr).getTime();
      
      if (ageMs > STALE_MS) {
        await callApi(`/api/tarefas/${task.id}/status`, 'PATCH', { status: 'pendente' });
        console.warn(`[SK+] Task ${task.id.substring(0, 8)} resetada -> pendente (travada ${Math.round(ageMs/60000)}min)`);
      }
    }
  } catch (err) {
    // silencioso
  }
}

async function pollTaskQueue() {
  await loadConfig();

  if (!config.contaAtiva || !config.jwt) return;

  await recoverStaleTasks();

  try {
    const task = await callApi(`/api/tarefas/pending?conta_id=${config.contaAtiva}`);
    if (!task) return;

    const lockAcquired = await acquireLock();
    if (!lockAcquired) return;
    console.log(`[SK+] Processando tarefa: ${task.tipo} | ${task.modelo}`);

    try {
      let resultado = null;
      if (task.tipo === "mapeamento") {
        resultado = await processMapping(task);
      } else if (task.tipo === "trocar") {
        resultado = await processSwap(task);
      }
      await callApi(`/api/tarefas/${task.id}/status`, 'PATCH', { status: 'concluida', resultado });

    } catch (err) {
      console.error(`[SK+] Erro na tarefa ${task.id}:`, err.message);
      await callApi(`/api/tarefas/${task.id}/status`, 'PATCH', {
        status: 'erro',
        resultado: { error: err.message },
      });
    }
  } catch (err) {
    if (!String(err.message).includes('404')) {
      console.error('[SK+] [POLL] Erro no polling:', err.message);
    }
  } finally {
    await releaseLock();
  }
}

// ── Funcoes de Apoio
function formatarTempo(ms) {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
}

async function buscarPorNumero(numero) {
  let allLinks = [];
  let page = 1;
  while (true) {
    const pageLinks = await fetchMappingPage(numero, page);
    if (!pageLinks || pageLinks.length === 0) break;
    allLinks = allLinks.concat(pageLinks);
    if (pageLinks.length < ADS_PER_PAGE) break;
    page++;
  }
  return [...new Set(allLinks)];
}

async function processMapping(task) {
  const page1 = await fetchMappingPage(task.modelo, 1);
  if (page1 === null) throw new Error("Falha ao acessar pag. 1 — sessao Skokka expirada?");

  let allLinks = [...page1];
  console.log(`[SK+] [MAP] Pag. 1: ${page1.length} links`);

  if (task.id) callApi(`/api/tarefas/${task.id}/status`, 'PATCH', {
    status: 'processando',
    resultado: { fase: `Mapeando pag. 1`, anuncios_ate_agora: allLinks.length }
  }).catch(() => {});

  if (page1.length >= ADS_PER_PAGE) {
    const BATCH = 3;
    let nextPage = 2;
    let hasMore = true;

    while (hasMore) {
      const batch = Array.from({ length: BATCH }, (_, i) => nextPage + i);
      const results = await Promise.all(batch.map(p => fetchMappingPage(task.modelo, p)));

      for (let i = 0; i < results.length; i++) {
        const pageLinks = results[i];
        const pageNum = batch[i];
        if (!pageLinks || pageLinks.length === 0) { hasMore = false; break; }
        allLinks = allLinks.concat(pageLinks);
        console.log(`[SK+] [MAP] Pag. ${pageNum}: ${pageLinks.length} links (total: ${allLinks.length})`);

        if (task.id) callApi(`/api/tarefas/${task.id}/status`, 'PATCH', {
          status: 'processando',
          resultado: { fase: `Mapeando pag. ${pageNum}`, anuncios_ate_agora: allLinks.length }
        }).catch(() => {});

        if (pageLinks.length < ADS_PER_PAGE) { hasMore = false; break; }
      }
      if (hasMore) nextPage += BATCH;
    }
  }

  const editLinks = [...new Set(allLinks)];
  let numeroAtual = "N/A";

  if (editLinks.length > 0) {
    try {
      const editUrl = editLinks[0].replace("/u/post-manage/", "/u/post-update/");
      const resp = await fetch(editUrl, { credentials: "include" });
      if (resp.ok) {
        const html = await resp.text();
        const match = html.match(/"national\\?":\s*\\?"(\d{10,13})\\?"/i)
          || html.match(/"contact\\?":\s*\\?"(\d{10,13})\\?"/i)
          || html.match(/"whatsapp":\s*"(\d{10,13})"/i);
        if (match?.[1]) {
          numeroAtual = match[1];
          if (numeroAtual.startsWith("55") && numeroAtual.length > 11) {
            numeroAtual = numeroAtual.substring(2);
          }
        }
      }
    } catch (e) {
      console.warn("[SK+] [MAP] Erro ao extrair telefone:", e.message);
    }
  }

  // Salva cache do modelo na API
  await callApi('/api/modelos', 'POST', {
    modelo: task.modelo,
    conta_id: task.conta_id || config.contaAtiva || "principal",
    quantidade_anuncios: editLinks.length,
    numero_atual: numeroAtual,
    links_edicao: editLinks,
  });

  await chrome.storage.local.set({ editLinks, nickname: task.modelo });
  console.log(`[SK+] [MAP] Mapeamento concluido: ${task.modelo} | ${editLinks.length} links | tel: ${numeroAtual}`);

  return { anuncios: editLinks.length, numero_atual: numeroAtual };
}

async function processSwap(task) {
  const startTime = Date.now();
  console.log(`[SK+] [SWAP] Modelo: ${task.modelo} | Novo: ${task.numero_novo}`);

  const contaId = task.conta_id || config.contaAtiva || "principal";

  let cacheEntry = null;
  try {
    cacheEntry = await callApi(`/api/modelos/${encodeURIComponent(task.modelo)}?conta_id=${contaId}`);
  } catch { cacheEntry = null; }

  if (!cacheEntry?.links_edicao?.length) {
    console.log("[SK+] [SWAP] Cache vazio. Mapeando primeiro...");
    await processMapping({ ...task, tipo: "mapeamento" });
    try {
      cacheEntry = await callApi(`/api/modelos/${encodeURIComponent(task.modelo)}?conta_id=${contaId}`);
    } catch { cacheEntry = null; }
    if (!cacheEntry?.links_edicao?.length) {
      throw new Error("Nenhum anuncio encontrado apos mapeamento");
    }
  }

  const linksOriginais = cacheEntry.links_edicao;
  const oldPhone = cacheEntry.numero_atual || task.numero_antigo || "";

  console.log(`[SK+] [SWAP] ${linksOriginais.length} links | Antigo: ${oldPhone} | Novo: ${task.numero_novo}`);

  await callApi('/api/modelos', 'POST', {
    modelo: task.modelo,
    conta_id: contaId,
    numero_atual: task.numero_novo,
    links_edicao: linksOriginais,
  });

  await chrome.storage.local.set({ editLinks: linksOriginais, nickname: task.modelo });

  console.log("[SK+] [SWAP] Disparando onda principal...");
  await handleSwapPhone(task.numero_novo, oldPhone);

  const tempoInjecao = formatarTempo(Date.now() - startTime);
  console.log(`[SK+] [SWAP] Injecao concluida em ${tempoInjecao}. Iniciando verificacao dupla...`);

  // ── Verificacao dupla (ate 3 tentativas)
  const MAX_RETRIES = 3;
  let totalRecuperados = 0;
  let pendentesFinais = 0;

  for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
    console.log(`[SK+] [SWAP] Aguardando 5s antes da verificacao ${tentativa}/${MAX_RETRIES}...`);
    await new Promise(r => setTimeout(r, 5000));

    const pendentes = await buscarPorNumero(oldPhone);

    if (pendentes.length === 0) {
      console.log(`[SK+] [SWAP] Verificacao ${tentativa}: ZERO pendentes!`);
      pendentesFinais = 0;
      break;
    }

    console.log(`[SK+] [SWAP] Verificacao ${tentativa}: ${pendentes.length} pendentes. Retrabalhando...`);
    const pendentesUpdate = pendentes.map(u => u.replace("/u/post-manage/", "/u/post-update/"));

    for (let i = 0; i < pendentesUpdate.length; i += 6) {
      const lote = pendentesUpdate.slice(i, i + 6);
      const loteNum = Math.floor(i / 6) + 1;
      console.log(`[SK+] [SWAP] Retrabalho lote ${loteNum} (${lote.length} abas)`);
      await Promise.allSettled(
        lote.map((url, idx) => processTab(url, task.numero_novo, `RT${tentativa}-${loteNum}`, idx + 1))
      );
      await sleep(1500);
    }

    totalRecuperados += pendentes.length;
    pendentesFinais = pendentes.length;
  }

  // ── Checksum final
  console.log("[SK+] ====================================");
  console.log("[SK+] FORCA TAREFA — Checksum final");
  console.log("[SK+] ====================================");

  await new Promise(r => setTimeout(r, 5000));
  const linksComNovoNumero = await buscarPorNumero(task.numero_novo);
  const setNovo = new Set(linksComNovoNumero.map(l => l.split("?")[0].replace(/\/$/, "")));
  const linksPerdidos = linksOriginais.filter(l => !setNovo.has(l.split("?")[0].replace(/\/$/, "")));

  console.log(`[SK+] [FORCA] Originais: ${linksOriginais.length} | Com novo numero: ${linksComNovoNumero.length} | Perdidos: ${linksPerdidos.length}`);

  let forcaRecuperados = 0;

  if (linksPerdidos.length > 0) {
    console.log(`[SK+] [FORCA] Retrabalhando ${linksPerdidos.length} links perdidos (lotes de 3)...`);
    const xperdidosUpdate = linksPerdidos.map(u => u.replace("/u/post-manage/", "/u/post-update/"));

    for (let i = 0; i < xperdidosUpdate.length; i += 3) {
      const lote = xperdidosUpdate.slice(i, i + 3);
      const loteNum = Math.floor(i / 3) + 1;
      const results = await Promise.allSettled(
        lote.map((url, idx) => processTab(url, task.numero_novo, `FT${loteNum}`, idx + 1))
      );
      results.forEach(r => { if (r.status === "fulfilled" && r.value === true) forcaRecuperados++; });
      await sleep(2000);
    }

    console.log(`[SK+] [FORCA] Recuperados: ${forcaRecuperados}/${linksPerdidos.length}`);
  } else {
    console.log("[SK+] [FORCA] Nenhum link perdido. Checksum 100% OK!");
  }

  const tempoTotal = formatarTempo(Date.now() - startTime);
  const pendentesRestantes = Math.max(0, linksPerdidos.length - forcaRecuperados);

  const resultado = {
    anuncios: linksOriginais.length,
    numero_novo: task.numero_novo,
    numero_antigo: oldPhone,
    tempo_injecao: tempoInjecao,
    tempo_total: tempoTotal,
    recuperados_verificacao: totalRecuperados,
    perdidos_detectados: linksPerdidos.length,
    recuperados_forca: forcaRecuperados,
    pendentes_restantes: pendentesRestantes,
    ...(pendentesRestantes > 0 && { alerta: `${pendentesRestantes} anuncios nao foram trocados apos todas as tentativas` }),
  };

  console.log(`[SK+] ====================================`);
  console.log(`[SK+] SWAP FINALIZADO: ${task.modelo}`);
  console.log(`[SK+] Anuncios: ${resultado.anuncios} | Pendentes: ${pendentesRestantes}`);
  console.log(`[SK+] ====================================`);

  return resultado;
}

// ── Funcoes de Apoio
function waitForTabComplete(tabId, timeout) {
  return new Promise((r) => {
    const l = (id, info) => { if (id === tabId && info.status === "complete") { chrome.tabs.onUpdated.removeListener(l); r(true); } };
    chrome.tabs.onUpdated.addListener(l);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(l); r(false); }, timeout);
  });
}
async function closeTab(id) { try { await chrome.tabs.remove(id); } catch (e) { } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function sendToDashboard(msg) { chrome.runtime.sendMessage(msg).catch(() => { }); }

// ============================================================
//  KEEP-ALIVE SKOKKA + AGENDAMENTO INTELIGENTE
// ============================================================

async function keepSkokkaAlive() {
  try {
    const resp = await fetch(`${BASE_URL}/u/account/ads/`, {
      credentials: "include",
      method: 'HEAD'
    });
    console.log(`[SK+] Keep-alive Skokka: ${resp.status} ${resp.ok ? 'OK' : 'WARN'}`);
  } catch (err) {
    console.warn("[SK+] Keep-alive Skokka falhou:", err.message);
  }
}

async function startPollingLoop() {
  if (pollerActive) return;
  pollerActive = true;
  console.log('[SK+] Loop de polling continuo iniciado (6s/ciclo).');

  await keepSkokkaAlive();
  lastKeepAlivePing = Date.now();

  while (pollerActive) {
    try {
      const now = Date.now();
      if (now - lastKeepAlivePing >= 60000) {
        await keepSkokkaAlive();
        lastKeepAlivePing = Date.now();
      }
      await pollTaskQueue();
    } catch (e) {
      console.error('[SK+] Erro no loop de polling:', e.message);
    }
    await sleep(6000);
  }
}

// Alarm de backup (1 min)
chrome.alarms.get("sk_poll", (alarm) => {
  if (!alarm) {
    chrome.alarms.create("sk_poll", { periodInMinutes: 1 });
    console.log("[SK+] Alarm 'sk_poll' criado (1min backup).");
  }
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sk_poll") {
    console.log("[SK+] Alarm backup disparado.");
    startPollingLoop();
  }
});

// Inicia o loop imediatamente ao carregar o SW
startPollingLoop();

console.log("[SK+] Service Worker (v3.0 SaaS) carregado.");
