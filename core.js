// Logica di dominio pura: nessun accesso a file, rete o DOM.
// Caricata sia dalla pagina (index.html) sia da Node (record.js, test.js).
(function (root) {
  // ponytail: parametri fissi per settore. Vendita diretta a mano: nessuna commissione né spedizione;
  // alzarli se si passa a una piattaforma.
  const SETTORI = {
    lego: { nome: 'LEGO', commissione: 0, spedizioneVendita: 0, margineMinimo: 0.15, scontoMinimoListino: 0.25, giorniVendita: 90, scontoAnnunci: 0.15 },
    nas: { nome: 'NAS', sospeso: true, commissione: 0.10, spedizioneVendita: 12, margineMinimo: 0.15, scontoMinimoListino: 0.25, giorniVendita: 14, scontoAnnunci: 0.15 },
  };
  const TIPI = ['acquisto', 'mercato'];
  const MS_GIORNO = 86400000;

  const giorniTra = (da, a) => Math.round((Date.parse(a) - Date.parse(da)) / MS_GIORNO);
  const aggiungiGiorni = (data, giorni) => new Date(Date.parse(data) + giorni * MS_GIORNO).toISOString().slice(0, 10);
  const arrotonda = (euro) => Math.round(euro * 100) / 100;
  const costoTotale = (acquisto) => arrotonda(acquisto.prezzo + acquisto.spedizione);
  const scontoSulListino = (prodotto, costo) => 1 - costo / prodotto.listino;
  const prodottiAttivi = (dati) => dati.prodotti.filter((p) => !SETTORI[p.settore].sospeso);

  // Un prezzo di annuncio non è un prezzo di venduto: senza venduto reale si applica uno sconto prudenziale.
  function valoreMercato(osservazione, settore) {
    return osservazione.venduto ? osservazione.prezzo : osservazione.prezzo * (1 - settore.scontoAnnunci);
  }

  function profittoNetto(costoAcquisto, valoreVendita, settore) {
    return arrotonda(valoreVendita * (1 - settore.commissione) - settore.spedizioneVendita - costoAcquisto);
  }

  function validaProdotto(prodotto) {
    if (!prodotto || typeof prodotto.id !== 'string' || !prodotto.id) return 'prodotto senza id';
    if (!SETTORI[prodotto.settore]) return `prodotto ${prodotto.id}: settore sconosciuto "${prodotto.settore}"`;
    if (SETTORI[prodotto.settore].sospeso) return `prodotto ${prodotto.id}: settore sospeso`;
    if (typeof prodotto.nome !== 'string' || !prodotto.nome) return `prodotto ${prodotto.id}: nome mancante`;
    if (!(Number.isFinite(prodotto.listino) && prodotto.listino > 0)) return `prodotto ${prodotto.id}: listino non valido`;
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
  // Si compra quando il prezzo scende abbastanza sotto il listino; si vende a giorniVendita dall'acquisto,
  // per misurare se a quella data il margine obiettivo c'è davvero.
  // ponytail: una sola operazione aperta per prodotto e uscita solo a scadenza; aggiungere un'uscita
  // anticipata a obiettivo raggiunto se serve.
  function operazioniProdotto(prodotto, osservazioni) {
    const settore = SETTORI[prodotto.settore];
    const storico = osservazioni
      .filter((o) => o.prodotto === prodotto.id)
      .sort((a, b) => a.data.localeCompare(b.data) || b.tipo.localeCompare(a.tipo)); // stesso giorno: mercato prima di acquisto
    const operazioni = [];
    let mercato = null;
    let aperta = null;
    const esito = (op) => {
      const profitto = profittoNetto(op.costo, valoreMercato(mercato, settore), settore);
      return { profitto, margine: profitto / op.costo, prezzoStimato: !mercato.venduto, sitoVendita: mercato.sito, urlVendita: mercato.url };
    };

    for (const o of storico) {
      if (o.tipo === 'mercato') mercato = o;
      if (aperta && giorniTra(aperta.dataAcquisto, o.data) >= settore.giorniVendita) {
        operazioni.push({ ...aperta, ...esito(aperta), stato: 'chiusa', dataVendita: o.data });
        aperta = null;
      }
      if (o.tipo === 'acquisto' && !aperta && mercato) {
        const costo = costoTotale(o);
        const sconto = scontoSulListino(prodotto, costo);
        if (sconto >= settore.scontoMinimoListino) {
          aperta = { prodotto: prodotto.id, nome: prodotto.nome, settore: prodotto.settore, dataAcquisto: o.data, costo, sconto,
            sitoAcquisto: o.sito, urlAcquisto: o.url, vendereDal: aggiungiGiorni(o.data, settore.giorniVendita),
            profittoAtteso: profittoNetto(costo, valoreMercato(mercato, settore), settore) };
        }
      }
    }
    if (aperta) operazioni.push({ ...aperta, ...esito(aperta), stato: 'aperta' });
    return operazioni;
  }

  function operazioni(dati) {
    return prodottiAttivi(dati).flatMap((p) => operazioniProdotto(p, dati.osservazioni));
  }

  // Ultimi prezzi rilevati per ogni prodotto, anche quando non c'è nessun affare: mostra che la raccolta funziona.
  function situazioneProdotti(dati) {
    return prodottiAttivi(dati).map((p) => {
      const ultima = (tipo) => dati.osservazioni
        .filter((o) => o.prodotto === p.id && o.tipo === tipo)
        .sort((a, b) => a.data.localeCompare(b.data)).pop() || null;
      const acquisto = ultima('acquisto');
      const mercato = ultima('mercato');
      const settore = SETTORI[p.settore];
      const costo = acquisto ? costoTotale(acquisto) : null;
      const profitto = acquisto && mercato ? profittoNetto(costo, valoreMercato(mercato, settore), settore) : null;
      return { nome: p.nome, settore: settore.nome, listino: p.listino, acquisto, mercato, costo,
        sconto: acquisto ? scontoSulListino(p, costo) : null, scontoMinimo: settore.scontoMinimoListino,
        profitto, margine: profitto === null ? null : profitto / costo };
    });
  }

  function riepilogoPerSettore(tutte) {
    return Object.entries(SETTORI).filter(([, settore]) => !settore.sospeso).map(([id, settore]) => {
      const sue = tutte.filter((op) => op.settore === id);
      const chiuse = sue.filter((op) => op.stato === 'chiusa');
      const aperte = sue.filter((op) => op.stato === 'aperta');
      const somma = (lista, campo) => arrotonda(lista.reduce((totale, op) => totale + op[campo], 0));
      return { settore: settore.nome, chiuse: chiuse.length, obiettivoRaggiunto: chiuse.filter((op) => op.margine >= settore.margineMinimo).length,
        profittoRealizzato: somma(chiuse, 'profitto'), investito: somma(chiuse, 'costo'),
        aperte: aperte.length, profittoLatente: somma(aperte, 'profitto') };
    });
  }

  const api = { SETTORI, valoreMercato, profittoNetto, validaProdotto, validaOsservazione, operazioni, situazioneProdotti, riepilogoPerSettore };
  if (typeof module !== 'undefined') module.exports = api;
  else root.MM_CORE = api;
})(this);
