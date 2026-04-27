const TOKEN = localStorage.getItem('monitor_token');
if (!TOKEN) window.location.href = '/login/index.html';

window.onload = refreshDashboard;

/**
 * CONTROLE DE MODAIS
 */
function openModal(id) { 
    document.getElementById(id).style.display = "flex"; 
}

function closeModal(id) { 
    document.getElementById(id).style.display = "none"; 
}

// Fecha o modal se clicar na área escura (fora do conteúdo)
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = "none";
    }
}

/**
 * FUNÇÕES DE CARREGAMENTO
 */
async function refreshDashboard() {
    loadStats();
    loadUsuarios();
}

async function fetchAdmin(url, options = {}) {
    const headers = { 
        ...options.headers, 
        'Authorization': `Bearer ${TOKEN}` 
    };
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('monitor_token');
        window.location.href = '/login/index.html';
    }
    return res;
}

async function loadStats() {
    const res = await fetchAdmin('/admin/stats');
    const data = await res.json();
    if (data.success) {
        document.getElementById('count-ativos').innerText = data.ativos;
        document.getElementById('count-expirados').innerText = data.expirados;
    }
}

async function loadUsuarios() {
    const res = await fetchAdmin('/admin/lista-usuarios');
    const data = await res.json();
    const tbody = document.getElementById('tabela-usuarios');
    tbody.innerHTML = '';

    if (data.success) {
        data.usuarios.forEach(user => {
            const dataExp = new Date(user.expira_em);
            const isExpirado = new Date() > dataExp;
            const dataF = dataExp.toLocaleDateString('pt-BR') + ' ' + dataExp.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

            tbody.innerHTML += `
                <tr>
                    <td>
                        <i class="fas fa-circle status-dot ${isExpirado ? 'offline' : 'online'}"></i>
                        <strong>${user.username}</strong>
                    </td>
                    <td style="color: ${isExpirado ? '#f85149' : '#8b949e'}">${dataF}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-act" onclick="renovar(${user.id})" title="Renovar +7 dias"><i class="fas fa-calendar-plus"></i></button>
                            <button class="btn-act btn-del" onclick="deletar(${user.id})" title="Remover"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        });
    }
}

/**
 * AÇÕES: CRIAR USUÁRIO
 */
document.getElementById('adminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    
    const payload = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        whatsapp: document.getElementById('whatsapp').value,
        plano: document.getElementById('plano').value
    };

    try {
        btn.disabled = true;
        btn.innerText = "GERANDO...";
        
        // Como aqui não enviamos arquivo, podemos usar JSON puro
        const res = await fetchAdmin('/admin/criar-usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            closeModal('modalUsuario');
            refreshDashboard();
            e.target.reset(); // Limpa o formulário
        }
    } catch (err) { 
        alert("Erro ao criar usuário"); 
    } finally { 
        btn.disabled = false; 
        btn.innerText = "GERAR ACESSO"; 
    }
});

/**
 * AÇÕES: UPLOAD DE APK (CORRIGIDO)
 */
async function uploadAPKOnly() {
    const fileInput = document.getElementById('apkFile');
    const file = fileInput.files[0];
    
    if (!file) return alert("Selecione um arquivo APK primeiro!");

    const btn = document.getElementById('btn-upload-apk');
    const formData = new FormData();
    
    // IMPORTANTE: Enviamos 'update_only' para o back-end saber que não é um novo usuário
    formData.append('username', 'update_only'); 
    formData.append('apk', file);

    try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> SUBINDO APK...`;
        
        // Para arquivos (FormData), não definimos Content-Type manualmente
        const res = await fetch('/admin/criar-usuario', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            body: formData
        });

        const data = await res.json();
        alert(data.message);
        
        if (data.success) {
            closeModal('modalAPK');
            fileInput.value = ''; // Limpa o campo de arquivo
        }
    } catch (e) { 
        alert("Erro no upload: Verifique se o arquivo excede o limite do servidor."); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = "SUBIR NOVO APK"; 
    }
}

/**
 * AÇÕES: RENOVAR E DELETAR
 */
async function renovar(id) {
    if (!confirm("Deseja adicionar +7 dias a este acesso?")) return;
    const res = await fetchAdmin(`/admin/adicionar-dias/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) refreshDashboard();
}

async function deletar(id) {
    if (!confirm("Tem certeza que deseja remover este usuário permanentemente?")) return;
    const res = await fetchAdmin(`/admin/deletar-usuario/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) refreshDashboard();
}