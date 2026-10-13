// Valore di mercato delle carte collezionabili sigillate dai file pubblici giornalieri di Cardmarket (nessuno scraping).
// Uso: node cardmarket.js                          rileva il mercato di tutti i prodotti tcg seguiti
//      node cardmarket.js cerca <gioco> <testo>    elenca i prodotti sigillati del catalogo (gioco: pokemon, magic, yugioh)
// Id prodotto: tcg-<gioco>-<idProduct Cardmarket>, es. tcg-pokemon-271440.
const { leggiDati, registra } = require('./record.js');

const GIOCHI = { magic: { id: 1, percorso: 'Magic' }, yugioh: { id: 3, percorso: 'YuGiOh' }, pokemon: { id: 6, percorso: 'Pokemon' } };
const BASE = 'https://downloads.s3.cardmarket.com/productCatalog/';

async function scarica(percorso) {
  const risposta = await fetch(BASE + percorso);
  if (!risposta.ok) throw new Error(`${percorso}: HTTP ${risposta.status}`);
  return risposta.json();
}
const scaricaPrezzi = async (gioco) => (await scarica(`priceGuide/price_guide_${GIOCHI[gioco].id}.json`)).priceGuides;

// Media del venduto a 7 giorni; se manca, il "trend" di Cardmarket (sempre basato sulle vendite).
const prezzoVenduto = (riga) => (riga && (riga.avg7 ?? riga.trend)) || null;

// prezziPerGioco: { pokemon: [righe della price guide], ... }. Restituisce le osservazioni e gli id senza prezzo.
function osservazioniMercato(prodotti, prezziPerGioco) {
  const osservazioni = [];
  const senzaPrezzo = [];
  for (const prodotto of prodotti) {
    const [, gioco, idProduct] = prodotto.id.split('-');
    const prezzo = prezzoVenduto((prezziPerGioco[gioco] || []).find((riga) => String(riga.idProduct) === idProduct));
    if (!prezzo) { senzaPrezzo.push(prodotto.id); continue; }
    osservazioni.push({ prodotto: prodotto.id, tipo: 'mercato', prezzo, spedizione: 0, sito: 'Cardmarket', venduto: true,
      url: `https://www.cardmarket.com/it/${GIOCHI[gioco].percorso}/Products?idProduct=${idProduct}` });
  }
  return { osservazioni, senzaPrezzo };
}

async function rileva() {
  const prodotti = leggiDati().prodotti.filter((p) => p.settore === 'tcg');
  const giochi = [...new Set(prodotti.map((p) => p.id.split('-')[1]))].filter((gioco) => GIOCHI[gioco]);
  const prezziPerGioco = {};
  for (const gioco of giochi) prezziPerGioco[gioco] = await scaricaPrezzi(gioco);
  const { osservazioni, senzaPrezzo } = osservazioniMercato(prodotti, prezziPerGioco);
  if (senzaPrezzo.length) console.log('Senza prezzo su Cardmarket: ' + senzaPrezzo.join(', '));
  registra({ osservazioni });
}

async function cerca(gioco, testo) {
  if (!GIOCHI[gioco] || !testo) throw new Error('Uso: node cardmarket.js cerca <pokemon|magic|yugioh> <testo>');
  const catalogo = (await scarica(`productList/products_nonsingles_${GIOCHI[gioco].id}.json`)).products;
  const prezzi = new Map((await scaricaPrezzi(gioco)).map((riga) => [riga.idProduct, riga]));
  catalogo
    .filter((p) => p.name.toLowerCase().includes(testo.toLowerCase()))
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, 30)
    .forEach((p) => {
      const riga = prezzi.get(p.idProduct) || {};
      console.log(`tcg-${gioco}-${p.idProduct} | ${p.name} | ${p.categoryName} | aggiunto ${p.dateAdded.slice(0, 10)} | venduto 7gg ${riga.avg7 ?? '-'} | 30gg ${riga.avg30 ?? '-'} | trend ${riga.trend ?? '-'}`);
    });
}

if (require.main === module) {
  const [comando, gioco, ...testo] = process.argv.slice(2);
  (comando === 'cerca' ? cerca(gioco, testo.join(' ')) : rileva()).catch((errore) => { console.error(errore.message); process.exit(1); });
}

module.exports = { osservazioniMercato };
