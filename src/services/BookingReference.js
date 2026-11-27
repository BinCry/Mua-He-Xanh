const { randomBytes } = require('node:crypto');

const BOOKING_REFERENCE_PATTERN = /^BK-[A-F0-9]{12}$/;

function createBookingReference() {
    return `BK-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function isBookingReference(value) {
    return BOOKING_REFERENCE_PATTERN.test(String(value || '').trim());
}

module.exports = {
    BOOKING_REFERENCE_PATTERN,
    createBookingReference,
    isBookingReference
};
