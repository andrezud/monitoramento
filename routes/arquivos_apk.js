const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * ROTA PÚBLICA: Download do APK diretamente do banco de dados
 * URL: /download-apk
 */
router.get('/download-apk', async (req, res) => {
    try {
        // Busca o último APK inserido (ou o de ID 1)
        const [rows] = await db.execute(
            'SELECT nome_arquivo, conteudo FROM arquivos_apk ORDER BY atualizado_em DESC LIMIT 1'
        );

        if (rows.length === 0) {
            return res.status(404).send("Nenhum APK encontrado no servidor.");
        }

        const arquivo = rows[0];

        // Configura o navegador para entender que é um aplicativo Android
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        
        // Define o nome do arquivo que aparecerá no celular do cliente
        res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome_arquivo}"`);

        // Envia o binário (Buffer) salvo no banco
        res.send(arquivo.conteudo);

    } catch (err) {
        console.error("Erro ao extrair APK do banco:", err);
        res.status(500).send("Erro interno ao processar download.");
    }
});

/**
 * ROTA PRIVADA (Opcional): Verificar se existe APK no banco
 */
router.get('/admin/check-apk', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, nome_arquivo, atualizado_em FROM arquivos_apk LIMIT 1');
        res.json({ success: true, info: rows[0] || "Nenhum arquivo" });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;