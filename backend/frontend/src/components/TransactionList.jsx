/**
 * BUBU - Transaction List Component
 * Componente interactivo para mostrar lista de transacciones con botones de editar/eliminar
 */

import React, { useState } from 'react';
import styles from './TransactionList.module.css';

export function TransactionList({ data, userPhone, onActionComplete }) {
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [newAmount, setNewAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDeleteClick = (transaction) => {
        setConfirmDelete(transaction);
    };

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return;

        setIsProcessing(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_URL}/transactions/${confirmDelete.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_phone: userPhone
                })
            });

            if (response.ok) {
                setConfirmDelete(null);
                if (onActionComplete) {
                    onActionComplete({
                        type: 'delete',
                        transaction: confirmDelete,
                        message: `✅ Transacción eliminada: $${confirmDelete.amount} - ${confirmDelete.description}`
                    });
                }
            } else {
                alert('Error al eliminar la transacción');
            }
        } catch (error) {
            console.error('Error eliminando transacción:', error);
            alert('Error al eliminar la transacción');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditClick = (transaction) => {
        setEditingTransaction(transaction);
        setNewAmount(transaction.amount.toString());
    };

    const handleConfirmEdit = async () => {
        if (!editingTransaction || !newAmount) return;

        const parsedAmount = parseFloat(newAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Por favor ingresa un monto válido');
            return;
        }

        setIsProcessing(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${API_URL}/transactions/${editingTransaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_phone: userPhone,
                    amount: parsedAmount
                })
            });

            if (response.ok) {
                const data = await response.json();
                setEditingTransaction(null);
                setNewAmount('');
                if (onActionComplete) {
                    onActionComplete({
                        type: 'edit',
                        transaction: data.data,
                        oldAmount: editingTransaction.amount,
                        newAmount: parsedAmount,
                        message: `✅ Monto actualizado: $${editingTransaction.amount} → $${parsedAmount}`
                    });
                }
            } else {
                alert('Error al actualizar la transacción');
            }
        } catch (error) {
            console.error('Error editando transacción:', error);
            alert('Error al actualizar la transacción');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className={styles.transactionList}>
            {data.header && <p className={styles.header}>{data.header}</p>}
            {data.body && <p className={styles.body}>{data.body}</p>}

            <div className={styles.transactions}>
                {data.transactions.map((transaction) => (
                    <div key={transaction.id} className={styles.transactionItem}>
                        <div className={styles.transactionInfo}>
                            <span className={styles.emoji}>{transaction.emoji}</span>
                            <div className={styles.details}>
                                <span className={styles.amount}>${transaction.amount}</span>
                                <span className={styles.description}>{transaction.description}</span>
                                <span className={styles.category}>({transaction.category})</span>
                                <span className={styles.date}>{transaction.date}</span>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button
                                className={styles.editButton}
                                onClick={() => handleEditClick(transaction)}
                                disabled={isProcessing}
                            >
                                ✏️
                            </button>
                            <button
                                className={styles.deleteButton}
                                onClick={() => handleDeleteClick(transaction)}
                                disabled={isProcessing}
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de confirmación de eliminación */}
            {confirmDelete && (
                <div className={styles.modal} onClick={() => !isProcessing && setConfirmDelete(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>¿Eliminar transacción?</h3>
                        <p className={styles.modalTransaction}>
                            {confirmDelete.emoji} ${confirmDelete.amount} - {confirmDelete.description}
                        </p>
                        <p className={styles.modalCategory}>{confirmDelete.category} • {confirmDelete.date}</p>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setConfirmDelete(null)}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmDeleteButton}
                                onClick={handleConfirmDelete}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de edición */}
            {editingTransaction && (
                <div className={styles.modal} onClick={() => !isProcessing && setEditingTransaction(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Editar monto</h3>
                        <p className={styles.modalTransaction}>
                            {editingTransaction.emoji} {editingTransaction.description}
                        </p>
                        <p className={styles.modalCategory}>{editingTransaction.category} • {editingTransaction.date}</p>
                        <div className={styles.inputGroup}>
                            <label>Nuevo monto:</label>
                            <input
                                type="number"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                className={styles.input}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                autoFocus
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleConfirmEdit();
                                    }
                                }}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setEditingTransaction(null)}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={handleConfirmEdit}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
