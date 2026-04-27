const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_aqui_123";

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // --- 1. LOGIN DO ADMIN (PAINEL) ---
    if (username === "andretuf2012@gmail.com" && password === "Franco@!19965189") {
        const token = jwt.sign(
            { id: 0, role: 'admin', username: 'Admin' }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        return res.json({ 
            success: true, 
            role: 'admin', 
            token: token, 
            redirect: '/admin' 
        });
    }

    // --- 2. LOGIN DO USUÁRIO / VÍNCULO DO APP ---
    try {
        const [rows] = await db.execute(
            'SELECT * FROM usuarios WHERE username = ? AND password = ?',
            [username, password]
        );

        if (rows.length > 0) {
            const user = rows[0];
            const agora = new Date();
            const expira = new Date(user.expira_em);

            // Verifica se a licença expirou
            if (agora > expira) {
                console.log(`[AUTH] Acesso negado: Usuário ${user.username} com licença vencida.`);
                return res.json({ 
                    success: false, 
                    message: "Sua assinatura expirou. Entre em contato para renovar." 
                });
            }

            // Gerando o token JWT para sessões web
            const token = jwt.sign(
                { id: user.id, username: user.username }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );

            console.log(`[AUTH] Usuário ${user.username} logado/vinculado. ID: ${user.id}`);

            // RETORNO COMPLETO: Agora com o 'id' que o Android exige
            return res.json({ 
                success: true, 
                id: user.id,   // <-- CRÍTICO: O Android lê este campo para salvar o USER_ID
                token: token, 
                redirect: '/painel-monitor/painel/index.html'
            });

        } else {
            // Caso as credenciais estejam erradas
            return res.json({ 
                success: false, 
                message: "Usuário ou senha incorretos." 
            });
        }
    } catch (err) {
        console.error("Erro no Processo de Auth:", err);
        res.status(500).json({ 
            success: false, 
            message: "Erro interno no servidor de dados." 
        });
    }
});

module.exports = router;