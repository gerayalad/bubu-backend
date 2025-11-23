/**
 * BUBU - Componente Principal de la Aplicación
 */

import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import ChatContainer from './components/ChatContainer';
import './styles/global.css';

function App() {
    const [user, setUser] = useState(null);

    // Persistir usuario en localStorage
    useEffect(() => {
        const savedUser = localStorage.getItem('bubu_user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (error) {
                console.error('Error al cargar usuario:', error);
                localStorage.removeItem('bubu_user');
            }
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('bubu_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('bubu_user');
    };

    return (
        <>
            {!user ? (
                <LoginScreen onLogin={handleLogin} />
            ) : (
                <ChatContainer
                    userPhone={user.phone}
                    userName={user.name || user.alias}
                />
            )}
        </>
    );
}

export default App;
