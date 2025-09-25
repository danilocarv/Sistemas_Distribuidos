// frontend/src/App.js

import React, { useState } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import ShoppingListApp from './ShoppingListApp'; // Importa sua aplicação principal
import './App.css'; 

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [showLogin, setShowLogin] = useState(true);

    const handleLoginSuccess = () => {
        setToken(localStorage.getItem('token'));
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };
    
    if (!token) {
        return (
            <div className="App-auth">
                {showLogin ? (
                    <>
                        <Login onLoginSuccess={handleLoginSuccess} />
                        <p>Não tem uma conta? <button onClick={() => setShowLogin(false)} className="link-button">Registre-se</button></p>
                    </>
                ) : (
                    <>
                        <Register />
                        <p>Já tem uma conta? <button onClick={() => setShowLogin(true)} className="link-button">Faça Login</button></p>
                    </>
                )}
            </div>
        );
    }

    return (
        <ShoppingListApp onLogout={handleLogout} />
    );
}

export default App;