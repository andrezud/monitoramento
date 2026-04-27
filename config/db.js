const mysql = require('mysql2');
require('dotenv').config(); // Garante que as variáveis do .env sejam lidas

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'sagas_monitor_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Testa a conexão ao iniciar o servidor
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erro ao conectar no MariaDB:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados MariaDB!');
        connection.release();
    }
});

module.exports = pool.promise();