// Uso: node test.js
const assert = require('assert');
const { SETTORI, profittoNetto, operazioni, situazioneProdotti, riepilogoPerSettore } = require('./core.js');
const { unisci } = require('./record.js');

const oss = (data, tipo, prezzo, extra = {}) => ({ data, prodotto: 'nas1', tipo, prezzo, spedizione: 0,
  sito: 'Subito', url: 'https://example.com', venduto: true, ...extra });
const prodotti = [{ id: 'nas1', settore: 'nas', nome: 'NAS di prova' }];

// 300 venduto - 10% commissione - 12 spedizione - 200 costo = 58
assert.strictEqual(profittoNetto(200, 300, SETTORI.nas), 58);

// Affare: si apre, poi si chiude dopo 14 giorni al valore di mercato di quel giorno.
let ops = operazioni({ prodotti, osservazioni: [
  oss('2026-10-01', 'mercato', 300), oss('2026-10-01', 'acquisto', 190, { spedizione: 10 }),
  oss('2026-10-15', 'mercato', 280),
] });
assert.strictEqual(ops.length, 1);
assert.strictEqual(ops[0].stato, 'chiusa');
assert.strictEqual(ops[0].vendereDal, '2026-10-15');
assert.strictEqual(ops[0].profitto, 40); // 280*0.9 - 12 - 200
assert.deepStrictEqual(riepilogoPerSettore(ops)[1],
  { settore: 'NAS', chiuse: 1, vincenti: 1, profittoRealizzato: 40, investito: 200, aperte: 0, profittoLatente: 0 });

// Margine sotto il 15%: nessuna operazione.
assert.strictEqual(operazioni({ prodotti, osservazioni: [oss('2026-10-01', 'mercato', 300), oss('2026-10-01', 'acquisto', 240)] }).length, 0);

// Situazione prodotti: stima anche senza affare; senza prezzo di mercato nessuna stima.
const situazione = situazioneProdotti({ prodotti, osservazioni: [oss('2026-10-01', 'mercato', 300), oss('2026-10-02', 'acquisto', 240)] })[0];
assert.strictEqual(situazione.stima.profitto, 18); // 300*0.9 - 12 - 240
assert.strictEqual(situazioneProdotti({ prodotti, osservazioni: [oss('2026-10-01', 'acquisto', 240)] })[0].stima, null);

// Prezzo da annunci (non venduto): lo sconto prudenziale del 15% annulla l'affare apparente.
assert.strictEqual(operazioni({ prodotti, osservazioni: [
  oss('2026-10-01', 'mercato', 300, { venduto: false }), oss('2026-10-01', 'acquisto', 200),
] }).length, 0);

// Dati non validi: errori segnalati e niente aggiunto; stesso giorno: sostituzione, non duplicato.
const vuoto = { prodotti: [], osservazioni: [] };
assert.strictEqual(unisci(vuoto, { osservazioni: [oss('', 'acquisto', -5, { url: 'javascript:alert(1)' })] }, '2026-10-01').errori.length, 1);
const primo = unisci(vuoto, { prodotti, osservazioni: [oss('', 'mercato', 300)] }, '2026-10-01').dati;
const secondo = unisci(primo, { osservazioni: [oss('', 'mercato', 310)] }, '2026-10-01').dati;
assert.strictEqual(secondo.osservazioni.length, 1);
assert.strictEqual(secondo.osservazioni[0].prezzo, 310);

console.log('ok');
