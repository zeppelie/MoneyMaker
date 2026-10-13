// Logica di dominio pura: nessun accesso a file, rete o DOM.
// Caricata sia dalla pagina (index.html) sia da Node (record.js, test.js).
(function (root) {
  // ponytail: tariffe stimate e fisse per settore; calibrarle sulle commissioni reali del canale di vendita.
  const SETTORI = {
    lego: { nome: 'LEGO', commissione: 0.12, spedizioneVendita: 8, margineMinimo: 0.15, giorniVendita: 30, scontoAnnunci: 0.15 },
    nas: { nome: 'NAS', commissione: 0.10, spedizioneVendita: 12, margineMinimo: 0.15, giorniVendita: 14, scontoAnnunci: 0.15 },
  };
  const TIPI = ['acquisto', 'mercato'];
  const MS_GIORNO = 86400000;

  const giorniTra = (da, a) => Math.round((Date.parse(a) - Date.parse(da)) / MS_GIORNO);
  const aggiungiGiorni = (data, giorni) => new Date(Date.parse(data) + giorni * MS_GIORNO).toISOString().slice(0, 10);
  const arrotonda = (euro) => Math.round(euro * 100) / 100;

  // Un prezzo di annuncio non è un prezzo di venduto: senza venduto reale si applica uno sconto prudenziale.
  function valoreMercato(osservazione, settore) {
    return osservazione.venduto ? osservazione.prezzo : osservazione.prezzo * (1 - settore.scontoAnnunci);
  }

  function profittoNetto(costoAcquisto, valoreVendita, settore) {
    return arrotonda(valoreVendita * (1 - settore.commissione) - settore.spedizioneVendita - costoAcquisto);
  }

  function stimaAffare(acquisto, mercato, settore) {
    const costo = arrotonda(acquisto.prezzo + acquisto.spedizione);
    const profitto = profittoNetto(costo, valoreMercato(mercato, settore), settore);
    return { costo, profitto, margine: profitto / costo };
  }

  function validaProdotto(prodotto) {
    if (!prodotto || typeof prodotto.id !== 'string' || !prodotto.id) return 'prodotto senza id';
    if (!SETTORI[prodotto.settore]) return `prodotto ${prodotto.id}: settore sconosciuto "${prodotto.settore}"`;
    if (typeof prodotto.nome !== 'string' || !prodotto.nome) return `prodotto ${prodotto.id}: nome mancante`;
    return null;
  }

  function validaOsservazione(osservazione, idProdotti) {
    const o = osservazione || {};
    if (!idProdotti.has(o.prodotto)) return `osservazione: prodotto sconosciuto "${o.prodotto}"`;
    if (!TIPI.includes(o.tipo)) return `${o.prodotto}: tipo deve essere acquisto o mercato`;
    if (!(Number.isFinite(o.prezzo) && o.prezzo > 0)) return `${o.prodotto}: prezzo non valido`;
    if (!(Number.isFinite(o.spedizione) && o.spedizione >= 0)) return `${o.prodotto}: spedizione non valida`;
    if (typeof o.sito !== 'string' || !o.sito) return `${o.prodotto}: sito mancante`;
    if (typeof o.url !== 'string' || !/^https?:\/\//.test(o.url)) return `${o.prodotto}: url deve iniziare con http(s)://`;
    if (typeof o.venduto !== 'boolean') return `${o.prodotto}: venduto deve essere true o false`;
    return null;
  }

  // Ricostruisce il portafoglio simulato dallo storico: nessuno stato salvato, solo osservazioni.
  // ponytail: una sola operazione aperta per prodotto e vendita sempre a giorniVendita dall'acquisto;
  // servono regole di uscita vere (obiettivo di prezzo, stop) se il mese di prova va bene.
  function operazioniProdotto(prodotto, osservazioni) {
    const settore = SETTORI[prodotto.settore];
    const storico = osservazioni
      .filter((o) => o.prodotto === prodotto.id)
      .sort((a, b) => a.data.localeCompare(b.data) || b.tipo.localeCompare(a.tipo)); // stesso giorno: mercato prima di acquisto
    const operazioni = [];
    let mercato = null;
    let aperta = null;

    for (const o of storico) {
      if (o.tipo === 'mercato') mercato = o;
      if (aperta && mercato && giorniTra(aperta.dataAcquisto, o.data) >= settore.giorniVendita) {
        operazioni.push({ ...aperta, stato: 'chiusa', dataVendita: o.data, sitoVendita: mercato.sito,
          profitto: profittoNetto(aperta.costo, valoreMercato(mercato, settore), settore) });
        aperta = null;
      }
      if (o.tipo === 'acquisto' && !aperta && mercato) {
        const { costo, profitto: atteso, margine } = stimaAffare(o, mercato, settore);
        if (margine >= settore.margineMinimo) {
          aperta = { prodotto: prodotto.id, nome: prodotto.nome, settore: prodotto.settore, dataAcquisto: o.data, costo,
            sitoAcquisto: o.sito, urlAcquisto: o.url, vendereDal: aggiungiGiorni(o.data, settore.giorniVendita),
            sitoVendita: mercato.sito, urlVendita: mercato.url, prezzoStimato: !mercato.venduto, profittoAtteso: atteso };
        }
      }
    }
    if (aperta) {
      operazioni.push({ ...aperta, stato: 'aperta', profitto: profittoNetto(aperta.costo, valoreMercato(mercato, settore), settore) });
    }
    return operazioni;
  }

  function operazioni(dati) {
    return dati.prodotti.flatMap((p) => operazioniProdotto(p, dati.osservazioni));
  }

  // Ultimi prezzi rilevati per ogni prodotto, anche quando non c'è nessun affare: mostra che la raccolta funziona.
  function situazioneProdotti(dati) {
    return dati.prodotti.map((p) => {
      const ultima = (tipo) => dati.osservazioni
        .filter((o) => o.prodotto === p.id && o.tipo === tipo)
        .sort((a, b) => a.data.localeCompare(b.data)).pop() || null;
      const acquisto = ultima('acquisto');
      const mercato = ultima('mercato');
      const settore = SETTORI[p.settore];
      return { nome: p.nome, settore: settore.nome, acquisto, mercato, margineMinimo: settore.margineMinimo,
        stima: acquisto && mercato ? stimaAffare(acquisto, mercato, settore) : null };
    });
  }

  function riepilogoPerSettore(tutte) {
    return Object.entries(SETTORI).map(([id, settore]) => {
      const sue = tutte.filter((op) => op.settore === id);
      const chiuse = sue.filter((op) => op.stato === 'chiusa');
      const aperte = sue.filter((op) => op.stato === 'aperta');
      const somma = (lista, campo) => arrotonda(lista.reduce((totale, op) => totale + op[campo], 0));
      return { settore: settore.nome, chiuse: chiuse.length, vincenti: chiuse.filter((op) => op.profitto > 0).length,
        profittoRealizzato: somma(chiuse, 'profitto'), investito: somma(chiuse, 'costo'),
        aperte: aperte.length, profittoLatente: somma(aperte, 'profitto') };
    });
  }

  const api = { SETTORI, valoreMercato, profittoNetto, validaProdotto, validaOsservazione, operazioni, situazioneProdotti, riepilogoPerSettore };
  if (typeof module !== 'undefined') module.exports = api;
  else root.MM_CORE = api;
})(this);
