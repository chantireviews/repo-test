import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom environment
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;
