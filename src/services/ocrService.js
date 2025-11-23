/**
 * BUBU - OCR Service
 * Servicio para extraer información de tickets usando OpenAI Vision
 */

import openai from '../config/openai.js';

/**
 * Extrae información de un ticket usando OpenAI Vision
 * @param {string} imageBase64 - Imagen en formato base64
 * @param {string} mimeType - Tipo MIME de la imagen (default: image/jpeg)
 * @returns {Promise<Object>} - Datos extraídos del ticket
 */
export async function extractReceiptData(imageBase64, mimeType = 'image/jpeg') {
    try {
        console.log('🔍 Analizando ticket con OpenAI Vision...');

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Analiza este ticket de compra y extrae la siguiente información en formato JSON:

{
  "amount": <monto total en número>,
  "merchant": "<nombre del comercio>",
  "category": "<Comida|Transporte|Entretenimiento|Servicios|Salud|Educación|Ropa|Hogar|Otros Gastos>",
  "date": "<fecha en formato YYYY-MM-DD si está visible, null si no>",
  "description": "<descripción breve del gasto>",
  "confidence": <0-100, qué tan seguro estás de los datos extraídos>
}

IMPORTANTE - MONTO A EXTRAER:
- SIEMPRE usa el campo "TOTAL" del ticket (es el monto final a pagar)
- Si el ticket tiene PROPINA o PROP., el TOTAL ya incluye la propina
- NO uses el campo "MONTO" o "SUBTOTAL" - estos NO incluyen la propina
- En tickets de tarjeta (Citibanamex, etc.), busca la línea que dice "TOTAL $" y usa ese valor
- Si solo hay un monto visible, usa ese
- Si no puedes leer el monto claramente, pon null
- El monto debe ser solo el número, sin símbolo de moneda

CATEGORÍAS:
- La categoría debe ser UNA de las listadas arriba (elige la más apropiada)
- Si es una gasolinera (Pemex, Shell, BP, Mobil, etc.), usa "Transporte"
- Si es un restaurante o supermercado (Oxxo, 7-Eleven, Soriana, Walmart, etc.), usa "Comida"
- Si es farmacia (Guadalajara, del Ahorro, Benavides) o doctor, usa "Salud"
- Si es tienda de ropa (Zara, H&M, Coppel), usa "Ropa"
- Si es luz, agua, gas, internet, celular, usa "Servicios"

OTROS CAMPOS:
- description debe ser descriptivo, ej: "Compra en Soriana" o "Gasolina en Pemex"
- confidence debe reflejar qué tan claro puedes leer el ticket (borroso = baja, nítido = alta)

Responde SOLO con el JSON, sin texto adicional.`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                                detail: 'high' // Usar alta resolución para mejor OCR
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500,
            temperature: 0.2 // Baja temperatura para respuestas más consistentes
        });

        const content = response.choices[0].message.content;
        console.log('📄 Respuesta de OpenAI:', content);

        // Intentar parsear como JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('❌ No se pudo extraer JSON de la respuesta');
            return {
                success: false,
                error: 'No se pudo parsear la respuesta de OpenAI',
                rawResponse: content
            };
        }

        const data = JSON.parse(jsonMatch[0]);

        // Validar que tengamos los campos esperados
        if (!data.hasOwnProperty('amount')) {
            console.error('❌ Respuesta de OpenAI no tiene campo "amount"');
            return {
                success: false,
                error: 'Formato de respuesta inválido',
                rawResponse: content
            };
        }

        console.log('✅ Datos extraídos:', {
            amount: data.amount,
            category: data.category,
            confidence: data.confidence
        });

        return {
            success: true,
            data,
            rawResponse: content
        };

    } catch (error) {
        console.error('❌ Error en OCR:', error);

        if (error.name === 'SyntaxError') {
            return {
                success: false,
                error: 'Error parseando JSON de OpenAI',
                rawResponse: error.message
            };
        }

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Valida si los datos extraídos son suficientes para crear una transacción
 * @param {Object} data - Datos extraídos del OCR
 * @returns {Object} - { isValid, missingFields }
 */
export function validateReceiptData(data) {
    const missingFields = [];

    if (!data.amount || data.amount === null) {
        missingFields.push('amount');
    }

    if (!data.category) {
        missingFields.push('category');
    }

    return {
        isValid: missingFields.length === 0,
        missingFields,
        needsConfirmation: data.confidence < 70
    };
}

export default {
    extractReceiptData,
    validateReceiptData
};
