// frontend/src/components/Login.js
import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch('http://localhost/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Credenciais inválidas.');
            if (data.token) {
                localStorage.setItem('token', data.token);
                onLoginSuccess();
            }
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="auth-form">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
                <button type="submit">Entrar</button>
            </form>
            {error && <p className="error">{error}</p>}
        </div>
    );
}
export default Login;