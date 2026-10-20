export const STAGES = ['NOVO','CONTATO','RESPONDEU','REUNIAO','PROPOSTA','NEGOCIACAO','FECHADO','PERDIDO'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
export const cents = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : null);
