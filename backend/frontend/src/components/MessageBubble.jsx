/**
 * BUBU - Componente de Burbuja de Mensaje
 */

import React from 'react';
import styles from './MessageBubble.module.css';
import { TransactionList } from './TransactionList';

function MessageBubble({ message, sender, timestamp, type = 'normal', userPhone, onInteractiveAction }) {
    const isUser = sender === 'user';

    // Detectar si el mensaje es una lista interactiva o botones
    const isInteractiveList = typeof message === 'object' && message?.type === 'interactive_list';
    const isInteractiveButtons = typeof message === 'object' && message?.type === 'interactive_buttons';
    const isInteractive = isInteractiveList || isInteractiveButtons;

    const formatTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleButtonClick = (buttonId) => {
        if (onInteractiveAction) {
            onInteractiveAction({ type: 'button_click', buttonId });
        }
    };

    return (
        <div className={`${styles.messageWrapper} ${isUser ? styles.user : styles.assistant}`}>
            {!isUser && (
                <div className={`${styles.avatar} ${styles.assistant}`}>
                    🤖
                </div>
            )}

            <div>
                <div className={`${styles.bubble} ${isUser ? styles.user : styles.assistant} ${styles[type]} ${isInteractive ? styles.interactive : ''}`}>
                    {isInteractiveList ? (
                        <TransactionList
                            data={message}
                            userPhone={userPhone}
                            onActionComplete={onInteractiveAction}
                        />
                    ) : isInteractiveButtons ? (
                        <div className={styles.interactiveButtons}>
                            <div className={styles.buttonBody}>
                                {message.body}
                            </div>
                            <div className={styles.buttonGroup}>
                                {message.buttons.map(button => (
                                    <button
                                        key={button.id}
                                        className={styles.actionButton}
                                        onClick={() => handleButtonClick(button.id)}
                                    >
                                        {button.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        message
                    )}
                </div>
                {timestamp && (
                    <div className={styles.metadata}>
                        {formatTime(timestamp)}
                    </div>
                )}
            </div>

            {isUser && (
                <div className={`${styles.avatar} ${styles.user}`}>
                    👤
                </div>
            )}
        </div>
    );
}

export default MessageBubble;
