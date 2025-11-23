/**
 * BUBU - Indicador de "Escribiendo..."
 */

import React from 'react';
import styles from './TypingIndicator.module.css';

function TypingIndicator() {
    return (
        <div className={styles.typingWrapper}>
            <div className={`${styles.avatar} ${styles.assistant}`}>
                🤖
            </div>
            <div className={styles.typingBubble}>
                <div className={styles.typingDots}>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                </div>
            </div>
        </div>
    );
}

export default TypingIndicator;
