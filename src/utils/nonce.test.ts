import { getNonce } from './nonce';

describe('getNonce', () => {
    it('should return a string', () => {
        const nonce = getNonce();
        expect(typeof nonce).toBe('string');
    });

    it('should return a string of exactly 32 characters', () => {
        const nonce = getNonce();
        expect(nonce.length).toBe(32);
    });

    it('should return a string containing only alphanumeric characters', () => {
        const nonce = getNonce();
        const alphanumericRegex = /^[A-Za-z0-9]+$/;
        expect(alphanumericRegex.test(nonce)).toBe(true);
    });

    it('should return unique values on subsequent calls', () => {
        const nonce1 = getNonce();
        const nonce2 = getNonce();
        expect(nonce1).not.toBe(nonce2);
    });
});
