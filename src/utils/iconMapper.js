/**
 * BUBU - Icon Mapper
 * Sistema de mapeo automático de iconos para categorías personalizadas
 */

/**
 * Mapeo de palabras clave a emojis
 * Organizado por temas para facilitar la búsqueda
 */
const iconKeywords = {
    // Comida y bebidas
    'comida|food|almuerzo|cena|desayuno': '🍽️',
    'restaurante|restaurant': '🍴',
    'taco|tacos|mexicana': '🌮',
    'pizza': '🍕',
    'hamburguesa|burger': '🍔',
    'cafe|café|coffee': '☕',
    'bebida|drink|bar': '🍺',
    'cerveza|beer': '🍺',
    'vino|wine': '🍷',
    'postre|dulce|sweet': '🍰',
    'pan|panaderia|bakery': '🥖',
    'fruta|fruit': '🍎',
    'verdura|vegetable': '🥗',
    'helado|ice cream': '🍦',

    // Transporte
    'carro|coche|auto|car': '🚗',
    'uber|taxi|cabify': '🚕',
    'gasolina|gas|combustible': '⛽',
    'transporte|transport': '🚌',
    'metro|subway': '🚇',
    'avion|avión|flight|vuelo': '✈️',
    'bicicleta|bici|bike': '🚲',
    'moto|motorcycle': '🏍️',
    'parking|estacionamiento': '🅿️',

    // Entretenimiento
    'cine|pelicula|película|movie': '🎬',
    'musica|música|music|spotify': '🎵',
    'juego|game|videojuego|gaming': '🎮',
    'concierto|concert': '🎤',
    'fiesta|party': '🎉',
    'teatro|theatre': '🎭',
    'deporte|sport': '⚽',
    'netflix|streaming|tv': '📺',

    // Servicios y hogar
    'luz|electricidad|electric': '💡',
    'agua|water': '💧',
    'internet|wifi': '🌐',
    'telefono|teléfono|phone|celular': '📱',
    'casa|hogar|home|renta|alquiler': '🏠',
    'limpieza|cleaning': '🧹',
    'mueble|furniture': '🛋️',
    'decoracion|decoración': '🖼️',
    'jardin|jardín|garden': '🌱',
    'gas': '🔥',

    // Salud y belleza
    'doctor|médico|medico|hospital': '⚕️',
    'medicina|farmacia|medicamento': '💊',
    'dentista|dental': '🦷',
    'gimnasio|gym|fitness': '🏋️',
    'yoga': '🧘',
    'belleza|beauty|salon|salón': '💄',
    'spa|masaje|massage': '💆',

    // Educación
    'escuela|school|universidad|university': '🎓',
    'libro|book|libreria|librería': '📚',
    'curso|class|clase': '📖',
    'estudio|study': '✏️',

    // Ropa y accesorios
    'ropa|clothes|clothing': '👕',
    'zapato|shoe|calzado': '👟',
    'reloj|watch': '⌚',
    'joyeria|joyería|jewelry': '💍',
    'bolsa|bag': '👜',
    'lentes|gafas|glasses': '👓',

    // Mascotas
    'mascota|pet|perro|dog': '🐶',
    'gato|cat': '🐱',
    'veterinario|vet': '🐾',
    'animal|animales': '🐾',

    // Trabajo y negocios
    'trabajo|work|oficina|office': '💼',
    'reunion|reunión|meeting': '👔',
    'proyecto|project': '📊',
    'negocio|business': '🏢',

    // Finanzas
    'banco|bank': '🏦',
    'ahorro|savings': '💰',
    'inversion|inversión|investment': '📈',
    'prestamo|préstamo|loan': '💳',
    'deuda|debt': '📉',

    // Tecnología
    'computadora|computer|laptop': '💻',
    'software|app|aplicacion|aplicación': '📱',
    'tech|tecnologia|tecnología': '⚙️',
    'impresora|printer': '🖨️',

    // Viajes
    'viaje|travel|vacaciones|vacation': '✈️',
    'hotel': '🏨',
    'equipaje|luggage': '🧳',
    'mapa|map': '🗺️',

    // Regalos y celebraciones
    'regalo|gift|present': '🎁',
    'cumpleaños|birthday': '🎂',
    'boda|wedding': '💒',
    'navidad|christmas': '🎄',

    // Otros
    'subscripcion|suscripción|subscription': '📝',
    'donacion|donación|donation|caridad': '❤️',
    'impuesto|tax': '📄',
    'multa|fine': '⚠️',
    'seguro|insurance': '🛡️',
    'freelance|autonomo|autónomo': '💻',
    'venta|sale|selling': '🤝',
    'nomina|nómina|sueldo|salario': '💰',
    'propina|tip': '💵',
    'lottery|loteria|lotería': '🎰',
};

/**
 * Iconos por defecto según el tipo de categoría
 */
const defaultIcons = {
    expense: '📦',
    income: '💵'
};

/**
 * Selecciona automáticamente el icono más apropiado para una categoría
 * @param {string} categoryName - Nombre de la categoría
 * @param {string} type - Tipo de categoría (income/expense)
 * @returns {string} Emoji seleccionado
 */
export function selectIcon(categoryName, type) {
    if (!categoryName) {
        return defaultIcons[type] || defaultIcons.expense;
    }

    const lowerName = categoryName.toLowerCase().trim();

    // Buscar coincidencias en el mapeo de palabras clave
    for (const [keywords, emoji] of Object.entries(iconKeywords)) {
        const keywordList = keywords.split('|');

        // Verificar coincidencia exacta o parcial
        for (const keyword of keywordList) {
            if (lowerName.includes(keyword) || keyword.includes(lowerName)) {
                return emoji;
            }
        }
    }

    // Si no se encuentra coincidencia, retornar icono por defecto
    return defaultIcons[type] || defaultIcons.expense;
}

/**
 * Selecciona un color automático basado en el tipo
 * @param {string} type - Tipo de categoría (income/expense)
 * @returns {string} Color en formato hexadecimal
 */
export function selectColor(type) {
    // Colores para ingresos (tonos verdes)
    const incomeColors = ['#22C55E', '#14B8A6', '#10B981', '#059669'];

    // Colores para gastos (variados)
    const expenseColors = [
        '#EF4444', // rojo
        '#F59E0B', // naranja
        '#8B5CF6', // morado
        '#3B82F6', // azul
        '#EC4899', // rosa
        '#06B6D4', // cyan
        '#6366F1', // indigo
    ];

    if (type === 'income') {
        // Seleccionar color aleatorio de ingresos
        return incomeColors[Math.floor(Math.random() * incomeColors.length)];
    } else {
        // Seleccionar color aleatorio de gastos
        return expenseColors[Math.floor(Math.random() * expenseColors.length)];
    }
}

export default {
    selectIcon,
    selectColor
};
