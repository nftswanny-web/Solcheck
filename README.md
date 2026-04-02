# SolCheck — Solana Token Analyzer

Analizza qualsiasi token Solana con dati da 4 fonti:
RugCheck, Jupiter, GMGN.ai, Meteora

---

## 🚀 DEPLOY SU VERCEL (5 minuti)

### PASSO 1 — GitHub
1. Vai su https://github.com
2. Se non hai un account, clicca **Sign up** e creane uno
3. Dopo il login, clicca il **+** in alto a destra → **New repository**
4. Nome: **solcheck**
5. Lascia **Public** selezionato
6. Clicca **Create repository**

### PASSO 2 — Carica i file
1. Nella pagina del nuovo repo vuoto, vedrai un link blu **"uploading an existing file"** — cliccalo
2. Apri la cartella ZIP che hai scaricato sul tuo PC
3. Trascina TUTTI questi file/cartelle nella pagina GitHub:
   - 📁 `api/` (con dentro `gmgn.js`)
   - 📁 `public/` (con dentro `index.html`)
   - 📄 `package.json`
   - 📄 `vercel.json`
4. In basso, clicca **Commit changes**

⚠️ **IMPORTANTE**: le cartelle devono mantenere la struttura!
Se GitHub non ti fa trascinare cartelle, carica i file uno alla volta:
- Prima crea la cartella `api` cliccando **Add file → Create new file**, scrivi `api/gmgn.js` come nome e incolla il contenuto
- Poi fai lo stesso con `public/index.html`
- Poi carica `package.json` e `vercel.json` nella root

### PASSO 3 — Vercel
1. Vai su https://vercel.com
2. Clicca **Sign Up**
3. Scegli **Continue with GitHub**
4. Autorizza Vercel ad accedere al tuo GitHub
5. Clicca **Add New** → **Project**
6. Trova **solcheck** nella lista e clicca **Import**
7. **NON toccare nessuna impostazione**
8. Clicca **Deploy**

### PASSO 4 — Fatto! 🎉
Dopo 30-60 secondi, Vercel ti mostra il tuo URL:
**https://solcheck-xxxx.vercel.app**

Aprilo e il tuo analyzer è pronto!

---

## 📋 Come si usa

1. Incolla il **Contract Address** (CA) di un token Solana
2. Premi **Analizza**
3. L'app interroga 4 API in parallelo:
   - 🛡️ **RugCheck** → Score di rischio
   - 🪐 **Jupiter** → Organic Score, verifiche
   - 🧠 **GMGN** → Market Cap, Fees, Holders, Bundlers, KOL
   - 💧 **Meteora** → Pool DLMM con TVL, fees, bin step
4. I risultati escono con semaforo 🟢🟡🔴

### ⚙️ Personalizzare i Range
Clicca l'icona ⚙️ per aprire le impostazioni.
Puoi cambiare i valori di soglia per ogni parametro.
Esempio: se vuoi che "Top Holders %" sia verde sotto il 10% invece di 15%, cambia il valore.

---

## 📁 Struttura file
```
solcheck/
├── api/
│   └── gmgn.js          ← Proxy serverless per GMGN
├── public/
│   └── index.html        ← L'intera app
├── package.json
├── vercel.json
└── README.md
```
