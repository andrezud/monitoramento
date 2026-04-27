const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');

// Configuração do Multer (Memória para até 100MB)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } 
});

const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_aqui_123";

/**
 * MIDDLEWARE: Proteção de Rota
 */
const verificarTokenDados = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "Acesso negado." });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') throw new Error("Não é admin");
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: "Sessão inválida ou expirada." });
    }
};

/**
 * 1. CARREGAR PÁGINA ADMIN
 */
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

/**
 * 2. BUSCAR ESTATÍSTICAS
 */
router.get('/stats', verificarTokenDados, async (req, res) => {
    try {
        const agora = new Date();
        const [ativos] = await db.execute(
            'SELECT COUNT(*) as total FROM usuarios WHERE status = "ativo" AND expira_em > ?', 
            [agora]
        );
        const [expirados] = await db.execute(
            'SELECT COUNT(*) as total FROM usuarios WHERE status = "expirado" OR expira_em <= ?', 
            [agora]
        );

        res.json({ 
            success: true, 
            ativos: ativos[0].total, 
            expirados: expirados[0].total 
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/**
 * 3. LISTAGEM DE USUÁRIOS
 */
router.get('/lista-usuarios', verificarTokenDados, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, username, password, whatsapp, expira_em, status FROM usuarios ORDER BY id DESC'
        );
        res.json({ success: true, usuarios: rows });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/**
 * 4. CRIAR USUÁRIO OU ATUALIZAR APK
 */
router.post('/criar-usuario', verificarTokenDados, upload.single('apk'), async (req, res) => {
    try {
        const { username, password, whatsapp, plano } = req.body;
        const apkFile = req.file;

        // --- SUB-ROTA: ATUALIZAÇÃO DE APK ---
        if (username === 'update_only' && apkFile) {
            // Ajustado para colunas sem acento: 'conteudo' e 'data_upload'
            const queryUpdateApk = `
                UPDATE arquivos_apk 
                SET nome_arquivo = ?, 
                    conteudo = ?, 
                    data_upload = NOW() 
                WHERE id = 1
            `;
            await db.execute(queryUpdateApk, ['calculadora_pro.apk', apkFile.buffer]);
            return res.json({ success: true, message: "APK atualizado com sucesso!" });
        }

        // --- SUB-ROTA: CRIAÇÃO DE USUÁRIO ---
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Preencha usuário e senha." });
        }

        const tempoIntervalo = (plano === '1h') ? '1 HOUR' : (plano === '30d' ? '30 DAY' : '7 DAY');
        
        const queryUser = `
            INSERT INTO usuarios (username, password, whatsapp, expira_em, status) 
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${tempoIntervalo}), 'ativo')
        `;
        
        await db.execute(queryUser, [username, password, whatsapp]);
        res.json({ success: true, message: "Novo acesso liberado com sucesso!" });

    } catch (err) {
        console.error("Erro no processamento:", err);
        res.status(500).json({ success: false, message: "Erro: " + err.message });
    }
});

/**
 * 5. RENOVAR ACESSO (+7 DIAS)
 */
router.post('/adicionar-dias/:id', verificarTokenDados, async (req, res) => {
    const userId = req.params.id;
    try {
        const query = `
            UPDATE usuarios 
            SET expira_em = DATE_ADD(IF(expira_em > NOW(), expira_em, NOW()), INTERVAL 7 DAY),
                status = 'ativo'
            WHERE id = ?`;
        const [result] = await db.execute(query, [userId]);
        res.json({ success: result.affectedRows > 0, message: "Acesso renovado!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 6. DELETAR USUÁRIO
 */
router.delete('/deletar-usuario/:id', verificarTokenDados, async (req, res) => {
    try {
        await db.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;