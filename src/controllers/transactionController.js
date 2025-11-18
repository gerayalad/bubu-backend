/**
 * BUBU - Transaction Controller
 */

import {
    createTransaction,
    getUserTransactions,
    getFinancialSummary,
    deleteTransaction,
    updateTransaction
} from '../services/transactionService.js';

export async function create(req, res) {
    try {
        const transaction = createTransaction(req.body);

        return res.status(201).json({
            success: true,
            data: transaction
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function list(req, res) {
    try {
        const { user_phone } = req.params;
        const filters = {
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            type: req.query.type,
            category_id: req.query.category_id,
            limit: parseInt(req.query.limit) || 100
        };

        const transactions = getUserTransactions(user_phone, filters);

        return res.json({
            success: true,
            data: transactions
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function getSummary(req, res) {
    try {
        const { user_phone } = req.params;
        const period = {
            startDate: req.query.start_date,
            endDate: req.query.end_date
        };

        const summary = getFinancialSummary(user_phone, period);

        return res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function remove(req, res) {
    try {
        const { id } = req.params;
        const { user_phone } = req.body;

        deleteTransaction(id, user_phone);

        return res.json({
            success: true,
            message: 'Transacción eliminada'
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export async function update(req, res) {
    try {
        const { id } = req.params;
        const { user_phone, ...updates } = req.body;

        const transaction = updateTransaction(id, user_phone, updates);

        return res.json({
            success: true,
            data: transaction
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export default {
    create,
    list,
    getSummary,
    remove,
    update
};
