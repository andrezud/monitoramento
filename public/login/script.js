// Bloqueia o arrasto da tela no mobile (firmeza total)
document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
}, { passive: false });

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('btn-login');
    const btnText = btn.querySelector('.btn-text');
    
    errorMsg.classList.add('hidden');
    localStorage.removeItem('monitor_token'); 
    btn.disabled = true;
    btnText.innerText = "VERIFICANDO...";

    const payload = {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
    };

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('monitor_token', data.token);
            window.location.href = data.redirect;
        } else {
            errorMsg.innerText = data.message || "Credenciais inválidas.";
            errorMsg.classList.remove('hidden');
            btn.disabled = false;
            btnText.innerText = "ENTRAR";
        }
    } catch (err) {
        console.error("Erro no login:", err);
        errorMsg.innerText = "Servidor offline ou erro de rede.";
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btnText.innerText = "ENTRAR";
    }
});