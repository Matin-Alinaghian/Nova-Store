document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const authForms = document.querySelectorAll('.auth-form');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            authForms.forEach(form => form.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');
            try {
                const result = await api.login(username, password);
                localStorage.setItem('user_id', result.user_id);
                localStorage.setItem('username', result.username);
                localStorage.setItem('is_admin', result.is_admin);
                window.location.href = result.is_admin ? '/admin' : '/';
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const errorDiv = document.getElementById('register-error');
            try {
                await api.register(username, email, password);
                if (window.Toast) Toast.show('ثبت نام موفق! اکنون می‌توانید وارد شوید.', 'success');
                document.querySelector('[data-tab="login"]').click();
                registerForm.reset();
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }
});
