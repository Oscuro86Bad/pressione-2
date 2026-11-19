# Pressione 2.0

Diario pressorio personale, online e installabile, pensato per chi deve annotare la pressione arteriosa e portare un report ordinato al medico.

- **App online:** https://oscuro86bad.github.io/pressione-2/
- **Repository:** https://github.com/Oscuro86Bad/pressione-2
- **Tipo:** PWA statica (HTML + CSS + JavaScript, nessuna build, nessun framework)
- **Dati:** locali sul dispositivo + sincronizzazione opzionale su Supabase

> Pressione 2.0 è un diario personale. **Non è un dispositivo medico**, non fa diagnosi e non sostituisce il medico. Non modificare mai una terapia in base ai valori registrati.

---

## Indice

- [Cosa sa fare](#cosa-sa-fare)
- [Privacy e salute](#privacy-e-salute)
- [Avvio locale](#avvio-locale)
- [Pubblicazione su GitHub Pages](#pubblicazione-su-github-pages)
- [🔐 Sincronizzazione online (Supabase)](#-sincronizzazione-online-supabase)
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
- **Sincronizzazione facoltativa** su Supabase con account email/password, Row Level Security e coda offline.
- **Backup JSON**, **esportazione CSV**, importazione dei backup della vecchia app Android.
- **PWA**: installabile su Android, iPhone e computer; funziona offline dopo il primo caricamento.

## Privacy e salute

- Le **foto non lasciano il dispositivo**: il testo viene estratto nel browser con Tesseract.js (WebAssembly). Le immagini non vengono salvate, non vengono messe in cache e non vengono inviate a nessun server.
- Senza account, **tutto resta nel `localStorage` del browser**. Se cancelli i dati del sito, perdi il diario: esporta un backup JSON ogni tanto.
- Con Supabase, ogni riga delle tabelle `bp_settings` e `bp_readings` è protetta da **Row Level Security**: un utente autenticato vede e modifica solo le proprie righe. La chiave `anon` è pubblica per progetto e non permette di leggere i dati senza login.
- Non inserire mai la **`service_role` key** nel frontend.
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

## 🔐 Sincronizzazione online (Supabase)

La sincronizzazione è **facoltativa**: l’app funziona anche solo in locale. Per attivarla serve un progetto Supabase gratuito.

### 1. Crea il progetto

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard) e crea un progetto.
2. Scegli una password del database e conservala.
3. Attendi che il progetto sia pronto.

### 2. Prepara il database

1. Apri **SQL Editor** nel progetto Supabase.
2. Apri il file [`supabase/schema.sql`](supabase/schema.sql) del repository (oppure usa il pulsante **Copia lo schema SQL** nella configurazione dell’app).
3. Incolla tutto il contenuto nell’editor e premi **Run**.

Lo schema crea:

| Tabella | Contenuto |
| --- | --- |
| `bp_settings` | una riga per utente: nome, target massima/minima, soglie, data di aggiornamento |
| `bp_readings` | una riga per misurazione: data/ora locale, valori, polso, note, fonte, soft delete |

Entrambe hanno **RLS attiva** e policy `select/insert/update/delete` limitate a `auth.uid() = user_id`.

### 3. Abilita l’accesso con email

1. Vai in **Authentication → Providers** e assicurati che **Email** sia attivo.
2. In **Authentication → URL Configuration** imposta come **Site URL** l’indirizzo dell’app, ad esempio:

   ```text
   https://oscuro86bad.github.io/pressione-2/
   ```

   Se provi in locale, aggiungi anche:

   ```text
   http://localhost:8080/
   ```

3. Aggiungi gli stessi indirizzi tra i **Redirect URLs**.
4. Se non vuoi confermare l’email a ogni registrazione, puoi disattivare **Confirm email** nelle impostazioni di autenticazione. Per un diario personale la conferma email è comunque consigliata.

### 4. Copia URL e chiave pubblica

In **Project Settings → API** copia:

- **Project URL** (es. `https://abcdefgh.supabase.co`)
- **anon public key**

Non usare la `service_role` key.

### 5. Collega l’app

Hai due modi equivalenti:

**A. Dall’app (più semplice)**

1. Apri l’app → **Impostazioni → Sincronizzazione → Attiva la sincronizzazione**.
2. Incolla **Project URL** e **anon public key**.
3. Salva: l’app ricarica e mostra **Accedi / Crea account**.

La configurazione viene salvata nel `localStorage` del dispositivo. Per gli altri dispositivi ripeti l’operazione, oppure usa il metodo B.

**B. Nel file pubblicato (per tutti i dispositivi)**

Modifica [`js/supabase-config.js`](js/supabase-config.js):

```js
window.DP_SUPABASE = {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

Poi fai commit e push: dopo la pubblicazione, ogni dispositivo troverà la configurazione già pronta. La chiave `anon` è pubblica per progetto; la protezione dei dati è affidata alle policy RLS.

### 6. Primo accesso e sincronizzazione

1. Crea un account con la tua email.
2. Se la conferma email è attiva, apri il link ricevuto e poi torna ad accedere.
3. Le misurazioni già presenti sul dispositivo vengono caricate nel tuo account al primo sync.
4. Su un secondo dispositivo, accedi con lo stesso account: il diario viene scaricato e unito.

La sincronizzazione:

- scarica tutte le righe dell’account (paginazione da 1000);
- unisce per `updatedAt`, lasciando vincere la modifica più recente;
- usa cancellazioni “morbide” (`deleted = true`) per propagare le eliminazioni;
- conserva una copia locale per l’uso offline e riprova quando torna la connessione.

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
│   ├── cloud.js           Supabase: auth, sync, merge, RLS errors
│   ├── chart.js           grafico canvas
│   ├── ocr.js             Tesseract.js sul dispositivo
│   ├── supabase-config.js configurazione facoltativa
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
├── supabase/
│   └── schema.sql
└── .github/workflows/deploy.yml
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

**La sincronizzazione dice “Tabelle non trovate”.**
Non hai eseguito `supabase/schema.sql` nel progetto, oppure hai incollato solo una parte. Riesegui tutto il file nel SQL Editor.

**“Permessi del database non corretti”.**
Controlla che RLS sia attiva e che le policy dello schema siano state create. Non disattivare RLS: servono proprio a isolare gli account.

**L’email di conferma non arriva.**
Controlla lo spam e l’indirizzo. Nei progetti gratuiti l’invio email ha limiti; per le prove puoi disattivare **Confirm email** in Supabase.

**La fotocamera non si apre.**
Serve HTTPS (GitHub Pages o localhost) e il permesso fotocamera del browser. Su iPhone puoi usare anche **Galleria**.

**L’OCR legge male.**
Avvicinati al display, evita riflessi e ombre, tieni il telefono parallelo, usa buona luce e ritaglia mentalmente solo il display. Puoi sempre correggere a mano: l’OCR non salva nulla da solo.

**Ho cancellato i dati del browser.**
Senza account non c’è recupero: ripristina un backup JSON. Con account, i dati restano su Supabase e tornano al prossimo accesso.

**Voglio cambiare account.**
Esci dall’account nelle impostazioni. Le misurazioni locali restano; al primo accesso con un altro account l’app chiede di caricarle nel nuovo account. Verifica sempre cosa stai per condividere.

**La stampa esce vuota o tagliata.**
Usa Chrome/Edge, scegli A4, margini predefiniti e attiva “Grafica di sfondo” se vuoi la banda del target. Il report è progettato per A4 verticale.

---

**Pressione 2.0** — un diario semplice, i dati sono tuoi.
