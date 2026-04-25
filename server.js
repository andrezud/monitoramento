const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

wss.on('connection', (ws, req) => {
    // Pegamos o IP real (o Cloudflare envia no header x-forwarded-for)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`🔌 Nova conexão estabelecida | Origem: ${ip}`);

    ws.on('message', (data) => {
        // Importante: Verificamos se o dado é buffer (áudio) ou string (comando)
        const isBuffer = Buffer.isBuffer(data);
        const message = !isBuffer ? data.toString().trim() : null;

        if (message === "START" || message === "STOP_SERVICE") {
            console.log(`🎮 Comando recebido: ${message}`);
            
            // Traduzimos os comandos para o MonitorService.kt
            const commandToSend = (message === "START") ? "START" : "STOP_RECORDING";

            wss.clients.forEach((client) => {
                // Enviamos para todos, EXCETO para quem mandou o comando (o painel)
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(commandToSend); 
                }
            });
        } else if (isBuffer) {
            // Se for áudio binário, replicamos para os outros (painel de escuta)
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('❌ Conexão encerrada');
    });

    ws.on('error', (error) => {
        console.error(`⚠️ Erro no WebSocket: ${error.message}`);
    });
});

// O Cloudflare vai redirecionar o tráfego para a porta 3000
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Global Ativo`);
    console.log(`🔗 Domínio: https://agendapro.dev.br`);
    console.log(`📡 Porta Local: ${PORT}`);
});