document.getElementById('btnDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

document.getElementById('btnVerify').addEventListener('click', () => {
  const newPhone = document.getElementById('newPhone').value.trim();
  const oldPhone = document.getElementById('oldPhone').value.trim();
  const expectedTotal = parseInt(document.getElementById('expectedTotal').value, 10) || 0;
  
  const resultDiv = document.getElementById('result');

  if (!newPhone) {
    resultDiv.style.display = 'block';
    resultDiv.className = 'res-error';
    resultDiv.textContent = 'O Número Novo é obrigatório para a verificação!';
    return;
  }

  const btn = document.getElementById('btnVerify');
  btn.disabled = true;
  btn.textContent = 'Verificando na Skokka...';
  resultDiv.style.display = 'block';
  resultDiv.className = '';
  resultDiv.textContent = 'Buscando os anúncios...\nIsso pode levar alguns segundos.';

  chrome.runtime.sendMessage({
    action: "verifyPhone",
    newPhone,
    oldPhone,
    expectedTotal
  }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Verificar Skokka Agora';

    if (chrome.runtime.lastError) {
      resultDiv.className = 'res-error';
      resultDiv.textContent = `Erro de comunicação: ${chrome.runtime.lastError.message}`;
      return;
    }
    
    if (response.error) {
      resultDiv.className = 'res-error';
      resultDiv.textContent = `Falha: ${response.error}`;
      return;
    }

    let msg = ``;
    if (oldPhone) {
      msg += `Número Antigo (${oldPhone}):\nEncontrados: ${response.antigoRestantes} anúncios.\n\n`;
    }
    msg += `Número Novo (${newPhone}):\nEncontrados: ${response.novoConfirmados} anúncios.\n`;

    if (oldPhone && response.antigoRestantes > 0) {
       resultDiv.className = 'res-warning';
       msg += `\n⚠ AVISO: Ainda existem anúncios presos com o número antigo!`;
    } else if (response.novoConfirmados === 0) {
       resultDiv.className = 'res-warning';
       msg += `\n⚠ AVISO: Nenhum anúncio encontrado no número novo. A troca falhou ou a Skokka está atrasada.`;
    } else {
       resultDiv.className = 'res-success';
       msg += `\n✅ OK: Verificação concluída.`;
    }

    resultDiv.textContent = msg;
  });
});
