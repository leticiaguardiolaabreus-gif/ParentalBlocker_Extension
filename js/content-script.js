// VARIÁVEIS GLOBAIS
let blockedWords = [];
let isExtensionActive = false;

// Função auxiliar para criar a Regex (usada apenas para verificar a presença, não para substituição)
function createWordPresenceRegex(words) {
  // Escapa caracteres especiais de regex e junta as palavras com OR
  const escapedWords = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regexString = escapedWords.join("|");
  // Usamos 'i' (case-insensitive)
  return new RegExp(regexString, "i");
}

// ====================================================
// FUNÇÃO DE BLOQUEIO TOTAL
// ====================================================

function blockPage() {
  // Título da página de bloqueio
  const blockTitle = "Conteúdo Bloqueado por ParentalBlock";

  // Conteúdo HTML da página de bloqueio
  const blockHtml = `
        <div style="
            text-align: center;
            padding-top: 50px;
            font-family: Arial, sans-serif;
            background-color: #f8f9fa;
            color: #212529;
            height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        ">
            <h1 style="color: #dc3545; font-size: 2.5em; margin-bottom: 20px;">
                ❌ ACESSO BLOQUEADO ❌
            </h1>
            <p style="font-size: 1.2em; margin-bottom: 30px;">
                Esta página contém conteúdo classificado como impróprio.
            </p>
            <div style="
                background-color: #ffdddd;
                border: 1px solid #dc3545;
                padding: 15px;
                border-radius: 8px;
                max-width: 80%;
            ">
                <p style="color: #dc3545; font-weight: bold; margin: 0;">
                    A palavra-chave foi identificada e o conteúdo foi ocultado.
                </p>
            </div>
            <p style="margin-top: 30px; font-size: 0.9em; color: #6c757d;">
                Para gerenciar o bloqueio, use o ícone da extensão.
            </p>
        </div>
    `;

  // Bloqueia o conteúdo
  document.documentElement.innerHTML = blockHtml;
  document.title = blockTitle;

  // Impede o carregamento de recursos externos e scripts
  window.stop();
}

// Função principal de verificação (Substitui censorWords)
function checkAndBlock() {
  if (!isExtensionActive || blockedWords.length === 0) {
    return;
  }

  // 1. Cria a Regex para verificação de presença
  const regex = createWordPresenceRegex(blockedWords);

  // 2. Verifica a presença da palavra no corpo da página (document.body.innerText)
  // O innerText é bom porque pega o texto visível.
  if (document.body && document.body.innerText) {
    if (regex.test(document.body.innerText)) {
      // Se a palavra for encontrada, bloqueia imediatamente
      blockPage();
      return;
    }
  }

  // 3. Verifica o campo de pesquisa (se a palavra estiver apenas lá)
  const searchInput = document.querySelector('input[name="q"]');
  if (searchInput && searchInput.value && regex.test(searchInput.value)) {
    blockPage();
    return;
  }
}

// ====================================================
// FUNÇÕES DE COMUNICAÇÃO (CHROME STORAGE)
// ====================================================

function loadStateFromStorage() {
  // Carregamos o estado e já chamamos a verificação
  chrome.storage.local.get(['blockedWords', 'extensionStatus'], (items) => {
    blockedWords = items.blockedWords || [];
    isExtensionActive = items.extensionStatus === 'active';
    checkAndBlock();
  });
}

// Listener para mudanças no Chrome Storage (Notificação em tempo real do Popup)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    let shouldCheck = false;

    if (changes.blockedWords) {
      blockedWords = changes.blockedWords.newValue || [];
      shouldCheck = true;
    }

    if (changes.extensionStatus) {
      isExtensionActive = changes.extensionStatus.newValue === 'active';
      shouldCheck = true;
    }

    if (shouldCheck) {
      // Se o estado mudar (palavras ou status), verificamos o bloqueio
      checkAndBlock();
    }
  }
});


// ====================================================
// INICIALIZAÇÃO DO CONTENT SCRIPT
// ====================================================

// 1. Carrega o estado inicial do storage e verifica o bloqueio
loadStateFromStorage();

// 2. Cria um MutationObserver para verificar novos conteúdos carregados dinamicamente
// Se um resultado for carregado via AJAX, isso acionará a verificação.
const observer = new MutationObserver(function(mutations) {
  let shouldCheck = false;

  mutations.forEach(function(mutation) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      shouldCheck = true;
    }
  });

  if (shouldCheck) {
    checkAndBlock();
  }
});

// Configura o observer para monitorar mudanças no corpo do documento
document.addEventListener('DOMContentLoaded', () => {
  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  } catch (e) {
    // Ignora o erro se o body não estiver pronto ou se a página já foi bloqueada
  }
});
