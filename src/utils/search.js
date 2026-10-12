// Search terms are normalized consistently in browser-facing controllers and
// PostgreSQL predicates. This avoids a different result merely because a
// visitor types "lang mai vang" instead of "Làng Mai Vàng".
const VIETNAMESE_SQL_SOURCE = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VIETNAMESE_SQL_TARGET = 'a'.repeat(17) + 'e'.repeat(11) + 'i'.repeat(5) + 'o'.repeat(17) + 'u'.repeat(11) + 'y'.repeat(5) + 'd';

function normalizeSearchText(value, maxLength = 100) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .slice(0, maxLength);
}

// Columns are hard-coded by controllers, never derived from request input.
function sqlNormalized(column) {
    return `translate(lower(coalesce(${column}, '')), '${VIETNAMESE_SQL_SOURCE}', '${VIETNAMESE_SQL_TARGET}')`;
}

function searchPattern(value, maxLength = 100) {
    const normalized = normalizeSearchText(value, maxLength);
    // `%`, `_` and `\\` are SQL LIKE control characters. Treat them as
    // literal text so a visitor cannot accidentally turn a normal search
    // into a broad wildcard query.
    return normalized ? `%${normalized.replace(/[\\%_]/g, '\\$&')}%` : null;
}

function searchTokens(value, maxTokens = 8) {
    return normalizeSearchText(value)
        .split(' ')
        .filter(Boolean)
        .slice(0, maxTokens);
}

// Builds an AND-of-words / OR-of-approved-columns predicate. Searching
// "mai lang" therefore finds "Làng mai vàng" even when the words are
// reversed, partly typed, differently cased or split between a title and its
// destination. `columns` comes only from source code; never from a request.
function buildTokenSearchClause(columns, value, startIndex = 1) {
    if (!Array.isArray(columns) || columns.length === 0 ||
        columns.some(column => typeof column !== 'string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?$/i.test(column))) {
        throw new TypeError('Search columns must be an approved SQL identifier list');
    }
    if (!Number.isSafeInteger(startIndex) || startIndex < 1) {
        throw new TypeError('Search parameter index must be a positive integer');
    }

    const tokens = searchTokens(value);
    const params = [];
    const clauses = tokens.map((token, offset) => {
        const parameter = `$${startIndex + offset}`;
        params.push(searchPattern(token));
        return `(${columns.map(column => `${sqlNormalized(column)} LIKE ${parameter} ESCAPE '\\'`).join(' OR ')})`;
    });

    return {
        clause: clauses.join(' AND '),
        params,
        nextIndex: startIndex + params.length
    };
}

module.exports = { normalizeSearchText, searchPattern, searchTokens, sqlNormalized, buildTokenSearchClause };
