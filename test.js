// Uso: node test.js
const assert = require('assert');
const { SETTORI, profittoNetto, operazioni, situazioneProdotti, riepilogoPerSettore } = require('./core.js');
const { unisci } = require('./record.js');

const oss = (data, tipo, prezzo, extra = {}) => ({ data, prodotto: 'lego1', tipo, prezzo, spedizione: 0,
  sito: 'BrickLink', url: 'https://example.com', venduto: true, ...extra });
const prodotti = [{ id: 'lego1', settore: 'lego', nome: 'Set di prova', listino: 100 }];

// Vendita diretta: nessuna commissione né spedizione. 90 venduto - 75 costo = 15
assert.strictEqual(profittoNetto(75, 90, SETTORI.lego), 15);
// Con piattaforma: 300 venduto - 10% commissione - 12 spedizione - 200 costo = 58
assert.strictEqual(profittoNetto(200, 300, SETTORI.nas), 58);

// Sconto del 25% sul listino: si apre, poi si chiude dopo 90 giorni al valore di mercato di quel giorno.
let ops = operazioni({ prodotti, osservazioni: [
  oss('2026-10-01', 'mercato', 90), oss('2026-10-01', 'acquisto', 70, { spedizione: 5 }),
  oss('2026-11-15', 'mercato', 92), oss('2026-12-30', 'mercato', 95),
] });
assert.strictEqual(ops.length, 1);
assert.strictEqual(ops[0].stato, 'chiusa');
assert.strictEqual(ops[0].profittoAtteso, 15);
assert.strictEqual(ops[0].vendereDal, '2026-12-30');
assert.strictEqual(ops[0].profitto, 20); // 95 - 75
assert.deepStrictEqual(riepilogoPerSettore(ops),
  [{ settore: 'LEGO', chiuse: 1, obiettivoRaggiunto: 1, profittoRealizzato: 20, investito: 75, aperte: 0, profittoLatente: 0 }]);

// Chiusa sotto l'obiettivo del 15%: conta come chiusa ma non come obiettivo raggiunto.
ops = operazioni({ prodotti, osservazioni: [
  oss('2026-10-01', 'mercato', 90), oss('2026-10-01', 'acquisto', 75), oss('2026-12-30', 'mercato', 80),
] });
assert.strictEqual(riepilogoPerSettore(ops)[0].obiettivoRaggiunto, 0);

// Sconto del 20%: sotto soglia, nessuna operazione. Senza listino: nessuna operazione.
const pocoSconto = [oss('2026-10-01', 'mercato', 90), oss('2026-10-01', 'acquisto', 80)];
assert.strictEqual(operazioni({ prodotti, osservazioni: pocoSconto }).length, 0);
const senzaListino = [{ id: 'lego1', settore: 'lego', nome: 'Vecchio prodotto' }];
assert.strictEqual(operazioni({ prodotti: senzaListino, osservazioni: [oss('2026-10-01', 'mercato', 90), oss('2026-10-01', 'acquisto', 10)] }).length, 0);

// Settore sospeso: i prodotti già nello storico spariscono da operazioni e situazione.
const nas = { prodotti: [{ id: 'lego1', settore: 'nas', nome: 'NAS', listino: 100 }], osservazioni: [oss('2026-10-01', 'mercato', 90), oss('2026-10-01', 'acquisto', 50)] };
assert.strictEqual(operazioni(nas).length, 0);
assert.strictEqual(situazioneProdotti(nas).length, 0);

// Situazione prodotti: sconto e stima anche senza segnale; senza prezzo di mercato nessun profitto.
const situazione = situazioneProdotti({ prodotti, osservazioni: pocoSconto })[0];
assert.strictEqual(situazione.profitto, 10);
assert.ok(Math.abs(situazione.sconto - 0.2) < 1e-9);
assert.strictEqual(situazioneProdotti({ prodotti, osservazioni: [oss('2026-10-01', 'acquisto', 80)] })[0].profitto, null);

// Salvataggio: dati non validi segnalati; stesso giorno sostituisce; prodotto esistente aggiornato; settore sospeso rifiutato.
const vuoto = { prodotti: [], osservazioni: [] };
assert.strictEqual(unisci(vuoto, { osservazioni: [oss('', 'acquisto', -5, { url: 'javascript:alert(1)' })] }, '2026-10-01').errori.length, 1);
assert.strictEqual(unisci(vuoto, { prodotti: [{ id: 'x', settore: 'lego', nome: 'Senza listino' }] }, '2026-10-01').errori.length, 1);
assert.strictEqual(unisci(vuoto, { prodotti: nas.prodotti }, '2026-10-01').errori.length, 1);
const primo = unisci(vuoto, { prodotti, osservazioni: [oss('', 'mercato', 300)] }, '2026-10-01').dati;
const secondo = unisci(primo, { prodotti: [{ ...prodotti[0], listino: 110 }], osservazioni: [oss('', 'mercato', 310)] }, '2026-10-01').dati;
assert.strictEqual(secondo.osservazioni.length, 1);
assert.strictEqual(secondo.osservazioni[0].prezzo, 310);
assert.strictEqual(secondo.prodotti.length, 1);
assert.strictEqual(secondo.prodotti[0].listino, 110);

console.log('ok');
