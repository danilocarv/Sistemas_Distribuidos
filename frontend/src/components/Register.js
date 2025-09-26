// frontend/src/components/Register.js
import React, { useState } from 'react';

function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const response = await fetch('http://localhost/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao registrar.');
            setMessage('Usuário registrado com sucesso! Agora você pode fazer o login.');
        } catch (error) {
            setMessage(error.message);
        }
    };

    return (
        <div className="auth-form">
            <h2>Registrar</h2>
            <form onSubmit={handleSubmit}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
                <button type="submit">Registrar</button>
            </form>
            {message && <p className="message">{message}</p>}
        </div>
    );
}
export default Register;