const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// A chave secreta deve ser a mesma definida no seu server.js
const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_aqui_123";

/**
 * 1. ROTA: BUSCAR DADOS DO PERFIL (Sua original)
 */
router.get('/meu-acesso', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Acesso negado." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const query = 'SELECT id, username, expira_em, status FROM usuarios WHERE id = ?';
        const [rows] = await db.execute(query, [userId]);

        if (rows.length > 0) {
            const usuario = rows[0];
            const agora = new Date();
            const expira = new Date(usuario.expira_em);
            const isExpirado = expira < agora;

            return res.json({
                success: true,
                expirado: isExpirado,
                id: usuario.id,
                username: usuario.username,
                status: usuario.status,
                expira_em: usuario.expira_em,
                message: isExpirado ? "Sua licença expirou." : "Acesso autorizado."
            });
        } else {
            return res.status(404).json({ success: false, message: "Usuário não encontrado." });
        }
    } catch (err) {
        return res.status(403).json({ success: false, message: "Sessão inválida." });
    }
});

/**
 * 2. ROTA NOVA: BUSCAR HISTÓRICO DE NOTIFICAÇÕES DO BANCO
 * Puxa as últimas 50 mensagens salvas para o usuário logado
 */
router.get('/historico-notificacoes', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // Puxa as notificações vinculadas ao ID do usuário
        const [rows] = await db.execute(
            'SELECT id, app_origem, titulo, mensagem, data_recebimento FROM logs_notificacoes WHERE dispositivo_id = ? ORDER BY data_recebimento DESC LIMIT 50',
            [userId]
        );

        res.json({ success: true, notificacoes: rows });
    } catch (err) {
        console.error("Erro ao buscar histórico:", err.message);
        res.status(403).json({ success: false, message: "Erro de autenticação." });
    }
});

/**
 * 3. ROTA NOVA: DELETAR NOTIFICAÇÃO ESPECÍFICA
 */
router.delete('/notificacao/:id', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false });

    try {
        // Valida se quem está deletando é um usuário válido
        jwt.verify(token, JWT_SECRET);
        
        const notifId = req.params.id;
        const [result] = await db.execute('DELETE FROM logs_notificacoes WHERE id = ?', [notifId]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Notificação removida." });
        } else {
            res.status(404).json({ success: false, message: "Registro não encontrado." });
        }
    } catch (err) {
        res.status(403).json({ success: false });
    }
});

/**
 * 4. ROTA: VERIFICAR USERNAME (Sua original)
 */
router.get('/verificar/:username', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id FROM usuarios WHERE username = ?', [req.params.username]);
        res.json({ exists: rows.length > 0 });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;