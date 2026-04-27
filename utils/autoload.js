const fs = require('fs');
const path = require('path');

/**
 * Autoload de Rotas - Organização Dinâmica
 * @param {Express} app - Instância do servidor Express
 */
function loadRoutes(app, folder = 'routes') {
    const routesPath = path.join(__dirname, '..', folder);

    if (!fs.existsSync(routesPath)) {
        console.error(`❌ [AUTOLOAD] Pasta "${folder}" não encontrada.`);
        return;
    }

    fs.readdirSync(routesPath).forEach(file => {
        // Aceita apenas .js e ignora arquivos ocultos ou de teste
        if (file.endsWith('.js') && !file.startsWith('_')) {
            try {
                const route = require(path.join(routesPath, file));
                const routeName = file.split('.')[0];

                // Define o prefixo (index.js vira raiz, outros viram o nome do arquivo)
                const prefix = routeName === 'index' ? '/' : `/${routeName}`;

                app.use(prefix, route);

                console.log(`🚀 [ROTA] Ativa: ${prefix}`);
            } catch (error) {
                console.error(`⚠️ [AUTOLOAD] Erro ao carregar ${file}:`, error.message);
            }
        }
    });
}

module.exports = { loadRoutes };