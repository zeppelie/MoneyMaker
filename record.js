// Uso: node record.js <rilevazioni.json>
// Il file contiene { "prodotti": [{id, settore, nome}], "osservazioni": [{prodotto, tipo, prezzo, spedizione, sito, url, venduto}] }.
// I dati arrivano dal web tramite la routine: si valida tutto e, al primo errore, non si scrive niente.
const fs = require('fs');
const path = require('path');
const { validaProdotto, validaOsservazione } = require('./core.js');

const FILE_DATI = path.join(__dirname, 'data.js');
const PREFISSO = 'window.MM_DATI = ';

function unisci(dati, nuovo, oggi) {
  const errori = [];
  const prodotti = [...dati.prodotti];
  for (const p of nuovo.prodotti || []) {
    const errore = validaProdotto(p);
    if (errore) errori.push(errore);
    else if (!prodotti.some((esistente) => esistente.id === p.id)) prodotti.push({ id: p.id, settore: p.settore, nome: p.nome });
  }
  const idProdotti = new Set(prodotti.map((p) => p.id));
  let osservazioni = [...dati.osservazioni];
  for (const o of nuovo.osservazioni || []) {
    const errore = validaOsservazione(o, idProdotti);
    if (errore) { errori.push(errore); continue; }
    // Rilanciare la routine nello stesso giorno sostituisce la rilevazione, non la duplica.
    osservazioni = osservazioni.filter((v) => !(v.data === oggi && v.prodotto === o.prodotto && v.tipo === o.tipo));
    osservazioni.push({ data: oggi, prodotto: o.prodotto, tipo: o.tipo, prezzo: o.prezzo, spedizione: o.spedizione,
      sito: o.sito, url: o.url, venduto: o.venduto });
  }
  return { errori, dati: { prodotti, osservazioni } };
}

if (require.main === module) {
  const dati = JSON.parse(fs.readFileSync(FILE_DATI, 'utf8').slice(PREFISSO.length).replace(/;\s*$/, ''));
  const nuovo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oggi = new Date().toLocaleDateString('sv'); // AAAA-MM-GG in ora locale
  const esito = unisci(dati, nuovo, oggi);
  if (esito.errori.length) {
    console.error('Niente salvato. Errori:\n- ' + esito.errori.join('\n- '));
    process.exit(1);
  }
  fs.writeFileSync(FILE_DATI, PREFISSO + JSON.stringify(esito.dati) + ';\n');
  console.log(`Salvato: ${esito.dati.prodotti.length} prodotti, ${esito.dati.osservazioni.length} osservazioni totali.`);
}

module.exports = { unisci };
