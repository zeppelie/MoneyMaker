# MoneyMaker

Simulazione di compravendita di set LEGO da collezione in uscita di produzione (settore NAS sospeso): una routine giornaliera di Claude rileva i prezzi, la pagina segnala i set scontati di almeno il 25% sul listino e simula la rivendita diretta dopo 90 giorni, con obiettivo di margine del 15%. Nessun acquisto reale.

## Come funziona

- `ROUTINE.md`: istruzioni che la sessione giornaliera di Claude segue per rilevare i prezzi.
- `record.js`: valida le rilevazioni e le salva in `data.js`.
- `core.js`: calcolo di profitto netto e operazioni simulate (commissioni e soglie per settore in cima al file).
- `index.html`: la pagina, statica, che legge `data.js` a ogni apertura.
- `test.js`: verifica della logica (`node test.js`).

## Installazione sull'host

Requisiti: Git, Node.js, app desktop di Claude aperta e PC non in sospensione.

```bash
git clone https://github.com/<utente>/MoneyMaker.git
```

Poi apri una sessione di Claude nella cartella clonata e incolla i due messaggi qui sotto, uno alla volta.

### 1. Sito dietro Caddy

> Questo progetto è un sito statico: `index.html` legge `data.js` e `core.js` dalla stessa cartella. Guarda la mia configurazione di Caddy esistente e aggiungi un sito che serve questa cartella con `file_server`, senza toccare gli altri siti. Mostrami la modifica prima di applicarla, poi ricarica Caddy e verifica che la pagina si apra.

### 2. Routine giornaliera

> Crea un'attività pianificata ogni giorno alle 08:00 che esegue le istruzioni nel file `ROUTINE.md` di questa cartella. Poi eseguila subito una volta per collaudo e dimmi quali prodotti ha rilevato e quali ha saltato.

Alla prima esecuzione approva l'accesso del browser a BrickLink, BrickEconomy e Subito.

## Aggiornamenti

`data.js` viene modificato ogni giorno dalla routine sull'host: non committarlo da lì, è lo storico locale della simulazione.
