# Pressione 2.0

Diario pressorio personale, online e installabile, pensato per chi deve annotare la pressione arteriosa e portare un report ordinato al medico.

- **App online:** https://oscuro86bad.github.io/pressione-2/
- **Repository:** https://github.com/Oscuro86Bad/pressione-2
- **Tipo:** PWA statica (HTML + CSS + JavaScript, nessuna build, nessun framework)
- **Dati:** locali sul dispositivo + sincronizzazione opzionale con un repository GitHub privato

> Pressione 2.0 è un diario personale. **Non è un dispositivo medico**, non fa diagnosi e non sostituisce il medico. Non modificare mai una terapia in base ai valori registrati.

---

## Indice

- [Cosa sa fare](#cosa-sa-fare)
- [Privacy e salute](#privacy-e-salute)
- [Avvio locale](#avvio-locale)
- [Pubblicazione su GitHub Pages](#pubblicazione-su-github-pages)
- [🔐 Sincronizzazione con GitHub privato](#-sincronizzazione-con-github-privato)
- [Foto del misuratore e OCR](#foto-del-misuratore-e-ocr)
- [Report per il medico](#report-per-il-medico)
- [Backup, esportazione e importazione](#backup-esportazione-e-importazione)
- [Uso offline e installazione](#uso-offline-e-installazione)
- [Test](#test)
- [Struttura del progetto](#struttura-del-progetto)
- [Problemi frequenti](#problemi-frequenti)

---

## Cosa sa fare

- **Inserimento a mano** di massima, minima, pulsazioni, data e ora.
- **Lettura dalla foto del display** del misuratore con OCR eseguito sul dispositivo: nessuna foto viene salvata o caricata.
- **Controllo dei valori prima del salvataggio**: l’OCR propone i numeri, l’utente li corregge e conferma.
- **Categoria automatica**: nella norma, sopra il target personale, molto alta, sotto la soglia bassa.
- **Target personale** (predefinito 135/85 mmHg, quello consigliato per le misurazioni a casa) e soglie di attenzione per pressione bassa e pulsazioni.
- **Diario** con ricerca, filtri per periodo e categoria, raggruppamento per giorno, note, braccio, posizione e battito irregolare.
- **Grafico** dell’andamento con banda del target.
- **Report per il medico** con medie, percentuale nel target, medie mattina/sera, grafico, riepilogo giornaliero e dettaglio di ogni misurazione. Stampa o salvataggio in PDF con il comando Stampa del browser.
- **Sincronizzazione facoltativa** con un repository GitHub **privato**: un solo file JSON, token limitato al repository e coda offline.
- **Backup JSON**, **esportazione CSV**, importazione dei backup della vecchia app Android.
- **PWA**: installabile su Android, iPhone e computer; funziona offline dopo il primo caricamento.

## Privacy e salute

- Le **foto non lasciano il dispositivo**: il testo viene estratto nel browser con Tesseract.js (WebAssembly). Le immagini non vengono salvate, non vengono messe in cache e non vengono inviate a nessun server.
- Senza sincronizzazione, **tutto resta nel `localStorage` del browser**. Se cancelli i dati del sito, perdi il diario: esporta un backup JSON ogni tanto.
- Con la sincronizzazione, il diario viene salvato in **un repository GitHub privato** che scegli tu. L’app rifiuta di scrivere su repository pubblici: i dati di salute non devono mai essere visibili ad altri.
- L’accesso a GitHub usa un **token fine-grained** limitato a quel solo repository, con permesso **Contents: Read and write**. Il token resta nel `localStorage` del dispositivo e non viene mai pubblicato nel codice.
- L’app non mostra pubblicità e non raccoglie statistiche d’uso.
- L’app **non è un dispositivo medico**. In caso di valori molto elevati (ad esempio 180/120 mmHg) o sintomi importanti (mal di testa forte, dolore al petto, difficoltà a respirare, disturbi alla vista) contatta subito il medico o i servizi di emergenza.

## Avvio locale

Non serve Node, Python o Docker. Basta PowerShell (Windows) e un browser moderno.

```powershell
cd "C:\Users\Rudi\Downloads\Pressione 2.0"
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
```

Poi apri **http://localhost:8080/**.

> Aprire `index.html` con doppio clic (`file://`) non è consigliato: service worker, OCR da CDN e sincronizzazione richiedono `http://` o `https://`. Il server locale serve proprio a questo.

Il server è solo per lo sviluppo: non pubblica nulla su internet.

## Pubblicazione su GitHub Pages

Il sito è **già online** su **https://oscuro86bad.github.io/pressione-2/**.

La pubblicazione usa GitHub Pages con origine dal branch `main` (cartella principale):

1. Su GitHub: **Settings → Pages → Build and deployment**.
2. **Source: Deploy from a branch**.
3. **Branch: `main`** e cartella **`/ (root)`**.

Ogni push su `main` aggiorna l’app online in circa un minuto. Per pubblicare una modifica:

```powershell
cd "C:\Users\Rudi\Downloads\Pressione 2.0"
git add .
git commit -m "Descrizione della modifica"
git push
```

> Se in futuro vuoi passare a GitHub Actions, aggiungi un workflow in `.github/workflows/` e imposta **Source: GitHub Actions**. Il token GitHub deve avere anche lo scope `workflow` (`gh auth refresh -h github.com -s workflow`).

## 🔐 Sincronizzazione con GitHub privato

La sincronizzazione è **facoltativa**: l’app funziona anche solo in locale. Serve un account GitHub (lo stesso su cui è pubblicata l’app va benissimo) e due cose: un **repository privato** per il diario e un **token** che dia accesso solo a quel repository.

Il diario è un unico file JSON (`diario.json`). Nessun altro servizio, nessun database da gestire: i dati restano nel tuo account GitHub.

### 1. Crea il repository privato

1. Apri [github.com/new](https://github.com/new).
2. Nome: **`pressione-dati`** (o quello che preferisci).
3. Visibilità: **Private**. Non renderlo pubblico: conterrà dati di salute.
4. Spunta **Add a README file** (serve a creare subito il branch `main`).
5. Premi **Create repository**.

> Se il repository esiste già, va bene lo stesso: deve solo essere privato e avere almeno un commit (il file README).

### 2. Crea il token limitato

1. Vai su [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. **Token name:** ad esempio `Pressione 2.0`.
3. **Expiration:** scegli una scadenza (90 giorni o più).
4. **Repository access:** **Only select repositories** → seleziona **solo** `pressione-dati`.
5. **Repository permissions → Contents:** **Read and write**. Non serve altro.
6. Premi **Generate token** e copia il token (`github_pat_…`): GitHub lo mostra una sola volta.

### 3. Collega l’app

1. Apri l’app → **Impostazioni → Sincronizzazione → Collega GitHub**.
2. Incolla il **token**.
3. Lascia vuoto **Proprietario** se vuoi: l’app lo ricava dal token.
4. Controlla **Repository** (`pressione-dati`), **Branch** (`main`) e **File** (`diario.json`).
5. Premi **Collega e sincronizza**.

L’app verifica il token, controlla che il repository sia **privato** e che il branch esista, poi crea `diario.json` al primo sync. Se il repository è pubblico, il collegamento viene rifiutato.

La configurazione (token compreso) viene salvata solo nel `localStorage` di quel dispositivo. Per collegare un secondo dispositivo ripeti il passaggio 3 con lo stesso token: il diario viene scaricato e unito.

### 4. Come funziona la sincronizzazione

- Il diario locale e quello remoto vengono **uniti per `updatedAt`**: vince la modifica più recente.
- Le eliminazioni viaggiano come cancellazioni “morbide” (`deleted: true`), così non ricompaiono dagli altri dispositivi.
- Se due dispositivi scrivono quasi insieme, l’app rilegge il file e riprova (fino a 3 tentativi).
- Le modifiche fatte offline restano sul dispositivo e vengono inviate appena torni online.
- Il token non viene mai messo in cache dal service worker né scritto nel repository.

### Sicurezza e revoca

- Il repository **deve essere privato**: l’app non scrive dati di salute altrove.
- Il token è **fine-grained** e limitato a un solo repository con permesso **Contents: Read and write**.
- Per revocare l’accesso: cancella il token da **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**. L’app smette subito di funzionare online finché non ne colleghi uno nuovo.
- **Scollega** nelle impostazioni dimentica il token da quel dispositivo senza cancellare il file su GitHub. **Elimina dati da GitHub** cancella anche il file remoto.

## Foto del misuratore e OCR

1. Tocca **Nuova misurazione → Scatta foto** (o **Foto del display** dalla pagina Oggi).
2. Inquadra il display con buona luce, senza riflessi, il più possibile parallelo.
3. L’app elabora la foto **nel browser** con Tesseract.js e il dizionario italiano.
4. I valori proposti (massima, minima, pulsazioni, eventuale battito irregolare) vengono inseriti nel modulo.
5. **Controlla sempre i numeri** e correggi se serve, poi salva.

L’OCR riconosce etichette italiane e inglesi (`SYS`, `DIA`, `PUL`, `MASSIMA`, `MINIMA`, `PULSE`, `BPM`…), il formato `120/80`, i display con etichette su una riga e numeri sotto, e alcuni errori tipici (`O` → `0`, `I` → `1`, `S` → `5`, `B` → `8`). Non è infallibile: la conferma manuale è obbligatoria.

La prima lettura scarica il motore OCR e il dizionario italiano da jsDelivr (circa qualche MB). Dopo la prima volta il browser li conserva e l’app funziona anche offline.

## Report per il medico

Nella sezione **Report**:

- scegli il periodo (7, 14, 30, 90 giorni, tutto o intervallo personalizzato);
- controlla medie, minimo/massimo, percentuale nel target, medie mattina/sera e battito irregolare;
- usa **Stampa / PDF** e nella finestra di stampa scegli **Salva come PDF**;
- oppure **Copia riepilogo** per incollare un testo sintetico in un messaggio o in una cartella clinica.

Il report stampato contiene intestazione con nome e periodo, riepilogo, grafico, tabella giornaliera, dettaglio cronologico, nota sul metodo e avvertenza medica. Gli intervalli personalizzati lunghi possono produrre più pagine.

## Backup, esportazione e importazione

In **Impostazioni → Dati e backup**:

- **Backup JSON**: file completo con profilo, impostazioni e misurazioni. Conservalo in un posto sicuro.
- **Esporta CSV**: tabella con data, ora, massima, minima, pulsazioni, battito irregolare, braccio, posizione e note. Il CSV usa `;` come separatore e include il BOM per Excel italiano.
- **Importa backup**: accetta il JSON di Pressione 2.0, un array di misurazioni e i backup della vecchia app Android **Pressione** (`misurazioni` + eventuale `impostazioni`). Le misurazioni duplicate vengono unite per `id`/data e non create due volte.

Le foto non sono mai incluse nei backup perché non vengono mai salvate.

## Uso offline e installazione

- Dopo la prima apertura online, il service worker salva l’interfaccia e i moduli principali.
- I dati inseriti offline restano sul dispositivo e vengono sincronizzati al ritorno della connessione.
- **Android/Chrome:** menu ⋮ → **Installa app** (o **Aggiungi alla schermata Home**).
- **iPhone/Safari:** pulsante **Condividi** → **Aggiungi alla schermata Home**.
- **Computer/Chrome o Edge:** icona di installazione nella barra degli indirizzi.

L’app mostra una barra quando sei offline e uno stato della sincronizzazione nella barra in alto.

## Test

Apri **`test.html`** dal sito pubblicato o dal server locale:

```text
http://localhost:8080/test.html
```

I test coprono il parser OCR (layout diversi, errori `O/0`, date e orari da ignorare, battito irregolare), la validazione dei valori, le categorie, le statistiche, il merge delle misurazioni, l’importazione Android, il CSV e l’archivio locale. Non richiedono internet e non toccano i dati reali: usano una chiave `localStorage` separata.

## Struttura del progetto

```text
.
├── index.html
├── manifest.webmanifest
├── sw.js
├── test.html
├── css/
│   └── style.css
├── js/
│   ├── config.js          costanti, target, testi
│   ├── format.js          date locali, escape, CSV, download
│   ├── ocr-parse.js       interpretazione del testo OCR
│   ├── stats.js           categorie, validazione, statistiche, report
│   ├── store.js           localStorage, CRUD, backup, import
│   ├── cloud.js           GitHub: token, API Contents, sync, merge
│   ├── chart.js           grafico canvas
│   ├── ocr.js             Tesseract.js sul dispositivo
│   ├── app.js             avvio, routing, azioni
│   └── ui/
│       ├── common.js      shell, toast, modali, icone
│       ├── onboarding.js  prima apertura
│       ├── auth.js        accesso e configurazione
│       ├── entry.js       nuova/modifica misurazione + OCR
│       ├── dashboard.js   pagina Oggi
│       ├── diary.js       diario
│       ├── report.js      report e stampa
│       └── settings.js    impostazioni
├── icons/
├── scripts/
│   ├── make-icon.ps1      rigenera le icone PNG
│   └── serve.ps1          server statico locale
└── .nojekyll
```

### Note per lo sviluppo

- Non c’è build: i file vengono serviti così come sono.
- L’ordine degli script in `index.html` è importante (`config` → `format` → `ocr-parse` → `stats` → `store` → `cloud` → `chart` → `ocr` → UI → `app`).
- Dopo aver modificato CSS/JS, aggiorna:
  - il parametro `?v=` in `index.html`;
  - `SW_VERSION` in `sw.js`.
- Le icone PNG si rigenerano con:

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/make-icon.ps1
  ```

## Problemi frequenti

**La sincronizzazione dice “Repository, branch o file non trovati”.**
Controlla proprietario, nome del repository e branch. Il branch deve esistere: crea il repository con un file README se è vuoto. Il file `diario.json` viene creato automaticamente al primo sync.

**“Il repository è pubblico.”**
L’app rifiuta di salvare dati di salute in un repository pubblico. Vai su **Settings → General → Danger Zone → Change visibility → Make private**.

**“GitHub ha negato l’accesso.”**
Il token non ha il permesso **Contents: Read and write** sul repository, oppure è scaduto. Creane uno nuovo con **Only select repositories** e ricollega il diario.

**Il token è stato revocato o è scaduto.**
L’app mostra un errore di sincronizzazione. Crea un nuovo token e reinseriscilo in **Impostazioni → Sincronizzazione → Modifica**.

**La fotocamera non si apre.**
Serve HTTPS (GitHub Pages o localhost) e il permesso fotocamera del browser. Su iPhone puoi usare anche **Galleria**.

**L’OCR legge male.**
Avvicinati al display, evita riflessi e ombre, tieni il telefono parallelo, usa buona luce e ritaglia mentalmente solo il display. Puoi sempre correggere a mano: l’OCR non salva nulla da solo.

**Ho cancellato i dati del browser.**
Senza sincronizzazione non c’è recupero: ripristina un backup JSON. Con GitHub collegato, il diario è nel repository privato e torna al prossimo sync (o importando il file `diario.json` come backup).

**Voglio cambiare repository o token.**
In **Impostazioni → Sincronizzazione → Modifica** puoi cambiare repository, branch, file o token. Con **Scollega** il token viene dimenticato dal dispositivo; le misurazioni locali restano e il file su GitHub non viene toccato.

**La stampa esce vuota o tagliata.**
Usa Chrome/Edge, scegli A4, margini predefiniti e attiva “Grafica di sfondo” se vuoi la banda del target. Il report è progettato per A4 verticale.

---

**Pressione 2.0** — un diario semplice, i dati sono tuoi.
