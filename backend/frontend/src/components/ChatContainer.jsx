/**
 * BUBU - Componente Principal del Chat
 */

import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { chatAPI } from '../services/api';
import styles from './ChatContainer.module.css';

function ChatContainer({ userPhone, userName }) {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-scroll al último mensaje
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cargar historial al montar
    useEffect(() => {
        loadHistory();
    }, [userPhone]);

    const loadHistory = async () => {
        try {
            const response = await chatAPI.getHistory(userPhone, 50);
            if (response.success && response.data) {
                const formattedMessages = response.data.map(msg => ({
                    id: msg.id,
                    text: msg.message,
                    sender: msg.role === 'assistant' ? 'assistant' : 'user',
                    timestamp: msg.created_at
                }));
                setMessages(formattedMessages);
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await chatAPI.sendMessage(userPhone, inputValue);

            if (response.success) {
                const botMessage = {
                    id: Date.now() + 1,
                    text: response.data.response,
                    sender: 'assistant',
                    timestamp: new Date().toISOString(),
                    intent: response.data.intent
                };

                setMessages(prev => [...prev, botMessage]);
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);

            const errorMessage = {
                id: Date.now() + 1,
                text: 'Lo siento, hubo un error procesando tu mensaje. ¿Podrías intentarlo de nuevo?',
                sender: 'assistant',
                timestamp: new Date().toISOString(),
                type: 'error'
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar que sea imagen
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen');
            return;
        }

        // Validar tamaño (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es muy grande. Por favor selecciona una imagen menor a 5MB');
            return;
        }

        setSelectedImage(file);

        // Crear preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleInteractiveAction = async (actionData) => {
        // Si es un click de botón, enviar al backend
        if (actionData.type === 'button_click') {
            setIsLoading(true);

            try {
                const response = await chatAPI.sendMessage(userPhone, '', actionData.buttonId);

                if (response.success) {
                    const botMessage = {
                        id: Date.now() + 1,
                        text: response.data.response,
                        sender: 'assistant',
                        timestamp: new Date().toISOString()
                    };

                    setMessages(prev => [...prev, botMessage]);
                }
            } catch (error) {
                console.error('Error procesando acción de botón:', error);

                const errorMessage = {
                    id: Date.now() + 1,
                    text: 'Lo siento, hubo un error procesando tu acción. ¿Podrías intentarlo de nuevo?',
                    sender: 'assistant',
                    timestamp: new Date().toISOString(),
                    type: 'error'
                };

                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsLoading(false);
            }
        } else if (actionData.message) {
            // Fallback: agregar mensaje de confirmación al chat
            const confirmationMessage = {
                id: Date.now(),
                text: actionData.message,
                sender: 'assistant',
                timestamp: new Date().toISOString(),
                type: 'success'
            };

            setMessages(prev => [...prev, confirmationMessage]);
        }
    };

    const handleSendImage = async () => {
        if (!selectedImage || isLoading) return;

        setIsLoading(true);

        // Mostrar imagen en el chat
        const userMessage = {
            id: Date.now(),
            text: '📸 [Imagen de ticket]',
            sender: 'user',
            timestamp: new Date().toISOString(),
            image: imagePreview
        };

        setMessages(prev => [...prev, userMessage]);

        try {
            // Convertir imagen a base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1]; // Remover el prefijo data:image/...;base64,

                try {
                    const response = await chatAPI.sendMessageWithImage(
                        userPhone,
                        base64,
                        selectedImage.type
                    );

                    if (response.success) {
                        const botMessage = {
                            id: Date.now() + 1,
                            text: response.data.response,
                            sender: 'assistant',
                            timestamp: new Date().toISOString()
                        };

                        setMessages(prev => [...prev, botMessage]);
                    }
                } catch (error) {
                    console.error('Error enviando imagen:', error);

                    const errorMessage = {
                        id: Date.now() + 1,
                        text: 'Lo siento, hubo un error procesando la imagen. ¿Podrías intentarlo de nuevo?',
                        sender: 'assistant',
                        timestamp: new Date().toISOString(),
                        type: 'error'
                    };

                    setMessages(prev => [...prev, errorMessage]);
                } finally {
                    setIsLoading(false);
                    handleRemoveImage();
                }
            };

            reader.readAsDataURL(selectedImage);
        } catch (error) {
            console.error('Error leyendo imagen:', error);
            setIsLoading(false);
            handleRemoveImage();
        }
    };

    return (
        <div className={styles.chatContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <div className={styles.logo}>💰</div>
                    <div>
                        <h1 className={styles.title}>BUBU</h1>
                        <p className={styles.subtitle}>Tu asistente de finanzas personales</p>
                    </div>
                </div>
                <div className={styles.userInfo}>
                    <div>{userName || 'Usuario'}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        {userPhone}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className={styles.messagesContainer}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>💬</div>
                        <h2 className={styles.emptyTitle}>¡Hola! Soy BUBU</h2>
                        <p className={styles.emptyText}>
                            Puedo ayudarte a registrar tus gastos e ingresos, y consultar tu estado financiero.
                            Solo escríbeme naturalmente, como le hablarías a un amigo.
                        </p>
                        <p className={styles.emptyText} style={{ marginTop: 'var(--spacing-md)', fontStyle: 'italic' }}>
                            Prueba escribir: "gasté 350 en tacos" o "¿cómo voy este mes?"
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <MessageBubble
                                key={msg.id}
                                message={msg.text}
                                sender={msg.sender}
                                timestamp={msg.timestamp}
                                type={msg.type}
                                userPhone={userPhone}
                                onInteractiveAction={handleInteractiveAction}
                            />
                        ))}
                        {isLoading && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className={styles.inputContainer}>
                {/* Image Preview */}
                {imagePreview && (
                    <div className={styles.imagePreview}>
                        <img src={imagePreview} alt="Preview" className={styles.previewImage} />
                        <button
                            className={styles.removeImageButton}
                            onClick={handleRemoveImage}
                            title="Quitar imagen"
                        >
                            ✕
                        </button>
                        <button
                            className={styles.sendImageButton}
                            onClick={handleSendImage}
                            disabled={isLoading}
                        >
                            📤 Enviar ticket
                        </button>
                    </div>
                )}

                <div className={styles.inputWrapper}>
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                    />

                    {/* Attach button */}
                    <button
                        className={styles.attachButton}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        title="Adjuntar imagen de ticket"
                    >
                        📎
                    </button>

                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Escribe un mensaje o adjunta un ticket..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />
                    <button
                        className={`${styles.sendButton} ${inputValue.trim() ? styles.active : ''}`}
                        onClick={handleSendMessage}
                        disabled={isLoading || !inputValue.trim()}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ChatContainer;
