export function encodeMessage(msg) {
    return JSON.stringify(msg, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}
export function decodeClientMessage(data) {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=protocol.js.map