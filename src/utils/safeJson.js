/**
 * Serialize data embedded in an inline <script> safely.
 *
 * EJS's escaped tag is not suitable for JavaScript object literals and its
 * raw tag alone leaves `</script>` available to stored user content.  JSON
 * Unicode escapes preserve the parsed value while preventing HTML parsing
 * from terminating or altering the surrounding script block.
 */
function safeJsonForScript(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

module.exports = { safeJsonForScript };
