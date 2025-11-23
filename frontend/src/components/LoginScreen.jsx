/**
 * BUBU - Pantalla de Login (Captura de Teléfono)
 */

import React, { useState } from 'react';
import { userAPI } from '../services/api';
import styles from './LoginScreen.module.css';

function LoginScreen({ onLogin }) {
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validar formato (10 dígitos)
        if (!/^\d{10}$/.test(phone)) {
            setError('El número debe tener exactamente 10 dígitos');
            return;
        }

        setIsLoading(true);

        try {
            const response = await userAPI.getOrCreate(phone);

            if (response.success) {
                onLogin(response.data);
            }
        } catch (err) {
            console.error('Error al iniciar sesión:', err);
            setError('Hubo un error al conectar. Verifica que el servidor esté corriendo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
        setPhone(value);
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>💰</div>
                <h1 className={styles.title}>BUBU</h1>
                <p className={styles.subtitle}>Tu asistente de finanzas personales</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Número de teléfono</label>
                        <input
                            type="tel"
                            className={styles.input}
                            placeholder="5512345678"
                            value={phone}
                            onChange={handlePhoneChange}
                            maxLength={10}
                            autoFocus
                        />
                        <small className={styles.hint}>
                            10 dígitos sin espacios ni guiones
                        </small>
                    </div>

                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={styles.button}
                        disabled={isLoading || phone.length !== 10}
                    >
                        {isLoading ? 'Conectando...' : 'Comenzar'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p className={styles.footerText}>
                        Registra tus gastos e ingresos de forma conversacional
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LoginScreen;
