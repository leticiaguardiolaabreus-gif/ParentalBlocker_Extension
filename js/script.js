const statusLabel = document.getElementById('status-label');
const toggleSwitch = document.getElementById('toggle-switch');
const lastBlockInfo = document.getElementById('last-block-info');
const homeView = document.getElementById('home-view');
const managementView = document.getElementById('management-view');
const attentionModal = document.getElementById('attention-modal');
const attentionMessage = document.getElementById('attention-message');
const passwordInput = document.getElementById('password-input');
const confirmLoginBtn = document.getElementById('confirm-login-btn');
const updateWordsBtnHome = document.getElementById('update-words-btn-home');
const wordsContainer = document.getElementById('blocked-words-container');
const addWordInput = document.getElementById('add-word-input');
const saveWordsBtn = document.getElementById('save-words-btn');
const homeBtn = document.getElementById('home-btn');
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmDeleteYesBtn = confirmDeleteModal.querySelector('.yes-btn');
const confirmDeleteNoBtn = confirmDeleteModal.querySelector('.no-btn');

// Elementos de Auditoria
const logEntriesContainer = document.getElementById('log-entries-container'); // Mantido
const clearLogsBtn = document.getElementById('clear-logs-btn'); // Mantido

// Variáveis de toggle de logs removidas
// let logsAreDetailed = false; // Removido


let blockedWords = [];
let isExtensionActive = false;
const CORRECT_PASSWORD = "1234";
let wordToDelete = null;
let pendingAction = null; // Ação: ACTIVATE, DEACTIVATE, MANAGE


// ====================================================
// FUNÇÕES DE ARMAZENAMENTO E AUDITORIA
// ====================================================

function loadState() {
  return new Promise(resolve => {
    // Definimos valores padrão para todas as chaves
    chrome.storage.local.get({
        blockedWords: [], // Lista vazia por padrão para novos usuários
        extensionStatus: 'inactive',
        lastBlockTimestamp: null,
        security_logs: []
    }, (items) => {
        blockedWords = items.blockedWords;
        isExtensionActive = items.extensionStatus === 'active';
        const storedLastBlock = items.lastBlockTimestamp;
        lastBlockInfo.textContent = storedLastBlock ? `Último Bloqueio: ${storedLastBlock}` : `Último Bloqueio: Nunca`;
        resolve();
    });
  });
}

function saveState() {
  chrome.storage.local.set({blockedWords: blockedWords});
}

// --- LOGAR TENTATIVAS INCORRETAS ---
function logFailedAttempt() {
  const logKey = 'security_logs';
  const now = new Date();

  const newLogEntry = {
    timestamp: now.toISOString(),
    attempt_status: 'incorreta',
    display_time: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR')
  };

  chrome.storage.local.get(logKey, (data) => {
    let logs = data[logKey] || [];

    logs.push(newLogEntry);

    // Limitar o array de logs para os 100 mais recentes
    if (logs.length > 100) {
      logs = logs.slice(logs.length - 100);
    }

    chrome.storage.local.set({ [logKey]: logs });
    console.log('Log de tentativa de senha incorreta salvo.');
  });
}

// --- RENDERIZAR OS LOGS DE SEGURANÇA NA TELA (AGORA SÓ MOSTRA A CONTAGEM) ---
function renderSecurityLogs() {
  const logKey = 'security_logs';
  logEntriesContainer.innerHTML = ''; // Limpa antes de renderizar

  chrome.storage.local.get(logKey, (data) => {
    const logs = data[logKey] || [];
    const attemptCount = logs.length; // Pega o total de tentativas

    if (attemptCount === 0) {
      logEntriesContainer.innerHTML = '<p style="color: #999;">Nenhuma tentativa de senha incorreta registrada.</p>';
      return;
    }

    // Exibe a contagem total com o estilo desejado
    logEntriesContainer.innerHTML = `<p style="color: #f8f9fa; font-size: 1.1em; font-weight: bold; margin: 0;">${attemptCount} tentativa(s) de senha incorreta.</p>`;
  });
}

// --- LIMPAR OS LOGS (Mantida, mas garantindo a chamada de renderização) ---
function clearSecurityLogs() {
    if (confirm("Tem certeza que deseja apagar todos os logs de segurança?")) {
        chrome.storage.local.remove('security_logs', () => {
            renderSecurityLogs(); // Zera a contagem na tela
            alert('Logs de segurança apagados.');
        });
    }
}


// ====================================================
// FUNÇÕES DE GERENCIAMENTO DE INTERFACE
// ====================================================

function navigateTo(view) {
  homeView.classList.add('hidden');
  managementView.classList.add('hidden');
  attentionModal.classList.add('hidden');
  confirmDeleteModal.classList.add('hidden');
  passwordInput.value = '';
  pendingAction = null;

  if (view === 'home') {
    homeView.classList.remove('hidden');
    updateWordsBtnHome.textContent = isExtensionActive ? 'Gerenciar palavras' : 'Atualizar palavras';
  } else if (view === 'management') {
    managementView.classList.remove('hidden');
    renderBlockedWords();
    renderSecurityLogs(); // Chama a renderização dos logs ao entrar na view
  }
}


function toggleExtension(newState) {
  isExtensionActive = newState;
  const status = newState ? 'active' : 'inactive';

  chrome.storage.local.set({extensionStatus: status}, () => {
    statusLabel.textContent = newState ? 'Ativado' : 'Desativado';
    statusLabel.style.color = newState ? 'var(--toggle-on)' : 'var(--toggle-off)';
    toggleSwitch.checked = newState;

    if (!newState) {
      navigateTo('home');
    }
  });
}

function showAttentionModal(message, isLoginPrompt = false) {
  attentionModal.classList.remove('hidden');
  attentionMessage.textContent = message;

  const loginGroup = attentionModal.querySelector('.login-input-modal-group');

  if (isLoginPrompt) {
    attentionModal.querySelector('h3').textContent = "SENHA DE ACESSO:";

    let titleColor = '#dc3545'; // Padrão vermelho para ações protegidas
    if (pendingAction === 'DEACTIVATE') {
      titleColor = '#357ebd'; // Azul para desativação
    }
    attentionModal.querySelector('h3').style.color = titleColor;
    attentionModal.style.border = 'none';
    loginGroup.style.display = 'flex';
    passwordInput.focus();
  } else {
    attentionModal.querySelector('h3').textContent = 'ATENÇÃO!';
    attentionModal.querySelector('h3').style.color = '#6c757d';
    attentionModal.style.border = 'none';
    loginGroup.style.display = 'none';
  }
}

function renderBlockedWords() {
  wordsContainer.innerHTML = '';

  if (blockedWords.length === 0) {
    wordsContainer.innerHTML = '<span style="color: #ccc; font-size: 0.9em;">Nenhuma palavra bloqueada.</span>';
    return;
  }

  blockedWords.forEach(word => {
    const tag = document.createElement('div');
    tag.classList.add('word-tag');
    tag.innerHTML = `
            <span>${word}</span>
            <button class="delete-btn" data-word="${word}">x</button>
        `;
    wordsContainer.appendChild(tag);
  });
}

function updateLastBlockTime() {
  const now = new Date();
  const formattedTime = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) + ' às ' + now.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit'
  });

  chrome.storage.local.set({lastBlockTimestamp: formattedTime});
  lastBlockInfo.textContent = `Último Bloqueio: ${formattedTime}`;
}

// ====================================================
// FUNÇÕES DE LÓGICA DO CONTROLE (EVENTOS)
// ====================================================

function handleLoginAttempt() {
  const enteredPassword = passwordInput.value;

  if (enteredPassword === CORRECT_PASSWORD) {
    // Senha correta: AÇÃO NORMAL
    attentionModal.classList.add('hidden');
    passwordInput.value = '';

    // AÇÕES PENDENTES
    if (pendingAction === 'ACTIVATE' || pendingAction === 'MANAGE') {
      toggleExtension(true);
      navigateTo('management');
    } else if (pendingAction === 'DEACTIVATE') {
      toggleExtension(false);
      navigateTo('home');
    }

  } else {
    // Senha incorreta:

    logFailedAttempt();

    // Atualiza a visualização da contagem de logs
    renderSecurityLogs();

    let actionText = 'acessar';
    if (pendingAction === 'DEACTIVATE') actionText = 'desativar';
    if (pendingAction === 'ACTIVATE') actionText = 'ativar';

    showAttentionModal(`Senha incorreta. Tente novamente para ${actionText}.`, true);
    passwordInput.value = '';
    passwordInput.focus();
  }
}

function handleAddWord() {
  const word = addWordInput.value.trim().toLowerCase();
  if (word === "") { alert("Digite uma palavra válida."); return; }
  if (!blockedWords.includes(word)) {
    blockedWords.push(word);
    saveState();
    renderBlockedWords();
    addWordInput.value = '';
    updateLastBlockTime();
    alert("Palavra adicionada e lista atualizada!");
  } else {
    alert(`A palavra "${word}" já está na lista.`);
  }
}

function showConfirmDeleteModal(word) {
  wordToDelete = word;
  confirmDeleteModal.querySelector('p').textContent = `Deseja excluir a palavra "${word}"?`;
  confirmDeleteModal.classList.remove('hidden');
}

function removeWord(wordToRemove) {
  blockedWords = blockedWords.filter(word => word !== wordToRemove);
  saveState();
  renderBlockedWords();
  updateLastBlockTime();
}

// ====================================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ====================================================

document.addEventListener('DOMContentLoaded', () => {
  loadState().then(() => {
    toggleExtension(isExtensionActive);
    toggleSwitch.checked = isExtensionActive;
    navigateTo('home');
  });
});

// 1. EVENTOS GERAIS DE CONTROLE (Switch)
toggleSwitch.addEventListener('change', () => {

  if (toggleSwitch.checked) {
    // TENTANDO ATIVAR: EXIGE SENHA
    if (!isExtensionActive) {
      toggleSwitch.checked = false; // Reverte para OFF
      pendingAction = 'ACTIVATE';
      showAttentionModal("Digite sua senha para ATIVAR a extensão:", true);
    } else {
      toggleExtension(true);
    }
  } else {
    // TENTANDO DESATIVAR: EXIGE SENHA
    if (isExtensionActive) {
      toggleSwitch.checked = true; // Reverte para ON
      pendingAction = 'DEACTIVATE';
      showAttentionModal("Digite sua senha para DESATIVAR a extensão:", true);
    } else {
      toggleExtension(false);
    }
  }
});


// 2. EVENTOS DA TELA HOME (BOTÃO ÚNICO)
updateWordsBtnHome.addEventListener('click', () => {
  pendingAction = 'MANAGE';

  if (isExtensionActive) {
    showAttentionModal("Digite sua senha para GERENCIAR as palavras:", true);
  } else {
    showAttentionModal("Digite sua senha para GERENCIAR as palavras (Irá ATIVAR a extensão):", true);
  }
});


// 3. EVENTOS DO MODAL DE LOGIN
confirmLoginBtn.addEventListener('click', handleLoginAttempt);

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLoginAttempt();
  }
});


// 4. EVENTOS DA TELA DE GERENCIAMENTO
homeBtn.addEventListener('click', () => {
  navigateTo('home');
});

saveWordsBtn.addEventListener('click', handleAddWord);
addWordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleAddWord();
  }
});

wordsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const word = e.target.getAttribute('data-word');
    showConfirmDeleteModal(word);
  }
});

confirmDeleteYesBtn.addEventListener('click', () => {
  if (wordToDelete) { removeWord(wordToDelete); }
  confirmDeleteModal.classList.add('hidden');
  wordToDelete = null;
});

confirmDeleteNoBtn.addEventListener('click', () => {
  confirmDeleteModal.classList.add('hidden');
  wordToDelete = null;
});

// 5. EVENTOS DE AUDITORIA (Mantidos, mas sem o toggleLogViewBtn)
clearLogsBtn.addEventListener('click', clearSecurityLogs);
// toggleLogViewBtn.addEventListener('click', toggleDetailedLogs); // Removido
