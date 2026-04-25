require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configurações via .env
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'agendapro.dev.br';

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws, req) => {
    // Identifica o IP real através do túnel Cloudflare
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`🔌 Conectado: ${ip}`);

    ws.on('message', (data) => {
        const isBuffer = Buffer.isBuffer(data);
        const message = !isBuffer ? data.toString().trim() : null;

        // Lógica de Comandos
        if (message === "START" || message === "STOP_SERVICE") {
            console.log(`🎮 Comando: ${message}`);
            const command = (message === "START") ? "START" : "STOP_RECORDING";

            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(command);
                }
            });
        } 
        // Lógica de Áudio (Binário)
        else if (isBuffer) {
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        }
    });

    ws.on('close', () => console.log('❌ Desconectado'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Monitor rodando em https://${DOMAIN}`);
});