# Parafarmacia Padre Pio — Divisione del Lavoro

**Documento operativo — chi fa cosa**

Versione 1.0 — Maggio 2026
Piattaforma: Bibot Core

---

## Scopo del documento

Questo documento prende come riferimento il documento tecnico Bibot "Implementazioni e-commerce" e separa con chiarezza:

- **Cosa fa la Dashboard custom Bibot** (il design Parafarmacia Padre Pio sviluppato lato Bibot Core)
- **Cosa deve configurare lo sviluppatore in GHL** (workflow, custom field, pipeline, template)

L'obiettivo è evitare sovrapposizioni e identificare con precisione il perimetro di ogni attore prima del go-live.

---

## Architettura di riferimento

```
┌─────────────┐    ┌────────────────────────┐    ┌──────────────┐
│   SHOPIFY   │───▶│  ENDPOINT BIBOT CORE   │───▶│     GHL      │
│  (cliente)  │    │  /api/parafarmacia/... │    │ (sub-account)│
└─────────────┘    └────────────────────────┘    └──────────────┘
                              │                          ▲
                              ▼                          │
                       ┌────────────┐                    │
                       │  SUPABASE  │                    │
                       │  (ledger)  │                    │
                       └────────────┘                    │
                              │                          │
                              ▼                          │
                       ┌────────────────────┐            │
                       │   DASHBOARD BIBOT  │────────────┘
                       │      (design)      │
                       └────────────────────┘
```

**Punti chiave:**
- Gli ordini Shopify entrano via webhook nel **nostro endpoint** (non direttamente in GHL come Conca/Spagnoletti/Bagnara)
- Il nostro endpoint **scrive sia in Supabase** (storico per riga) **sia in GHL** (aggregati per contatto come custom field)
- La Dashboard legge da entrambe le fonti
- I workflow GHL si innescano dai tag che il nostro endpoint applica sul contatto

---

# PARTE A — Cosa fa la Dashboard (lato Bibot Core)

Tutto ciò che è qui sotto è **sviluppato dal team Bibot Core** dentro `app/designs/parafarmacia-padre-pio/`. Lo sviluppatore GHL non deve toccarlo.

## A.1 Moduli della Dashboard

| # | Modulo | Funzionalità principali |
|---|---|---|
| 1 | **Dashboard analitica** | KPI Vista d'Insieme · Top Clienti · Clusterizzazione · Funnel Marketplace · Categorie Prodotto |
| 2 | **Contatti** | Lista contatti con filtri smart-list **(sostituiscono le smart list GHL)**, sidebar contatto, messaggistica diretta, CRUD |
| 3 | **Importazioni** | 3 box Amazon / eBay / Store con upload CSV, deduplica, applicazione tag automatica, trigger automazioni |
| 4 | **Ordini** | Archivio ordini Shopify in tempo reale con line items, indirizzi, metodo pagamento |
| 5 | **Campagne** | Editor campagne WhatsApp / SMS, audience, schedulazione |
| 6 | **Recensioni Google** | Generatore QR code per recensioni store fisico, viewer recensioni |
| 7 | **Impostazioni** | Brand, utenti, integrazioni, soglie cluster, tag |

## A.2 Backend e infrastruttura

Costruiti dal team Bibot Core:

- **Endpoint webhook ordini**: `/api/parafarmacia/order-webhook` — riceve ogni ordine Shopify, salva in Supabase, aggiorna custom field GHL, ricalcola cluster, applica tag
- **Endpoint redirect tracciato**: `/api/parafarmacia/r/[token]` — alimenta il funnel marketplace tracciando i click WhatsApp
- **Tabella `parafarmacia_orders`** (Supabase): storico completo di ogni ordine con line items, indirizzi, metodo pagamento, payload raw
- **Tabella `parafarmacia_funnel_events`** (Supabase): eventi del funnel (imported, whatsapp_sent, link_clicked, first_order, second_order)
- **Libreria `lib/parafarmacia/`**: `ghl.ts` (wrapper GHL), `cluster.ts` (computeCluster), `queries.ts` (aggregazioni dashboard)
- **Logica deduplica per telefono** (chiave primaria di matching, come da briefing §2.1)
- **Calcolo automatico cluster** Bronzo / Argento / Oro / Premium ad ogni ordine, con scrittura tag su GHL

## A.3 Segmentazione clienti (al posto delle smart list GHL)

Il documento tecnico §9 elenca 14 smart list da creare. **Tutte queste viste vivono nel Modulo Contatti della Dashboard**, come filtri dinamici già pronti — non serve crearle come smart list native GHL.

| Vista (filtro) | Criterio nel Modulo Contatti |
|---|---|
| Carrelli abbandonati recenti | Tag `cart_abandoned` + ultimi 7gg |
| Carrelli abbandonati attivi | Tag `cart_abandoned` + ultimi 14gg |
| Carrelli non recuperati | Tag `non_recuperato_14d` |
| Lead senza acquisto | `data_primo_ordine` vuoto |
| Clienti primo ordine | `numero_ordini = 1` |
| Clienti ricorrenti | `numero_ordini ≥ 2` |
| Clienti VIP | Tag `cluster-premium` |
| Clienti inattivi 60/90/120gg | `data_ultimo_ordine` > soglia |
| Interesse categoria X | Tag `categoria-*` |
| Codice sconto inviato non convertito | `ultimo_codice_sconto_inviato` valorizzato + nessun ordine dopo |

I filtri sono salvabili come "viste preferite" dal titolare/team direttamente nella Dashboard.

**Nota workflow GHL:** i workflow GHL che hanno bisogno di triggerare su queste condizioni (es. win-back per inattivi 60gg) usano **condizioni su custom field** direttamente (es. *"se data_ultimo_ordine > 60 giorni fa"*), senza bisogno di una smart list GHL intermedia.

## A.4 Dati alimentati automaticamente sui contatti GHL

Ad ogni ordine, l'endpoint Bibot Core **scrive su questi custom field GHL** (in upsert):

| Campo GHL | Tipo | Aggiornato automaticamente |
|---|---|---|
| `numero_ordini` | Numero | Sì, incrementato ad ogni ordine |
| `spesa_totale` | Valuta | Sì, somma cumulativa |
| `aov` | Numero | Sì, ricalcolato (spesa_totale / numero_ordini) |
| `data_primo_ordine` | Data | Sì, settato al primo ordine |
| `data_ultimo_ordine` | Data | Sì, sovrascritto ad ogni ordine |
| `nome_prodotto` | Testo | Sì, ultimo prodotto acquistato |
| `id_ordine` | Testo | Sì, ID ultimo ordine Shopify |
| Tag cluster (`cluster-bronzo` ecc.) | Tag | Sì, ricalcolato e aggiornato |
| Tag origine (`cliente-online`) | Tag | Sì, applicato al primo ordine sul sito |

---

# PARTE B — Cosa deve fare lo sviluppatore in GHL

Tutto ciò che è qui sotto è **da configurare manualmente nel sub-account GHL di Padre Pio** dallo sviluppatore. La Dashboard non lo fa.

## B.1 Custom Field aggiuntivi da creare in GHL

Oltre ai campi che il nostro webhook scrive (Parte A.3), per supportare tutte le automazioni del documento servono questi campi aggiuntivi:

| Campo | Tipo GHL | Uso | Chi lo scrive |
|---|---|---|---|
| `consenso_email_marketing` | Boolean | Opt-in email | Form Shopify + opt-out workflow |
| `consenso_whatsapp_marketing` | Boolean | Opt-in WhatsApp | Form Shopify + STOP keyword |
| `utm_source` | Testo | Attribuzione campagna | Frontend Shopify (vedi Parte C) |
| `utm_medium` | Testo | Attribuzione campagna | Frontend Shopify |
| `utm_campaign` | Testo | Attribuzione campagna | Frontend Shopify |
| `categoria_ultimo_acquisto` | Dropdown | Cross-sell, segmentazione | Webhook ordine (estesione da fare nel nostro codice) |
| `categorie_acquistate` | Tag list | Segmentazione categoria | Webhook ordine (estensione) |
| `ultimo_carrello_abbandonato` | Data | Trigger recupero | Webhook `checkouts/abandon` (vedi B.5) |
| `valore_ultimo_carrello` | Numero | Priorità recupero | Webhook checkouts |
| `link_ultimo_checkout` | URL | Link diretto al carrello | Webhook checkouts |
| `stato_cliente` | Dropdown | Stato customer journey | Workflow GHL |
| `ultimo_codice_sconto_inviato` | Testo | Controllo pressione sconti | Workflow GHL |
| `consumabile` | Boolean | Flag per riacquisto automatico | Webhook ordine (in base alla categoria) |
| `ciclo_riacquisto_giorni` | Numero | Intervallo reminder consumabili | Configurazione manuale per prodotto |

**Valore del dropdown `stato_cliente`:**
`Prospect` · `Lead caldo` · `Carrello abbandonato` · `Primo ordine` · `Cliente ricorrente` · `VIP` · `Inattivo` · `Non recuperato`

## B.2 Tag taxonomy da preparare in GHL

I tag operativi che i workflow useranno come trigger ed exit. Vanno **creati esplicitamente** nel pannello tag GHL (anche solo applicandoli una prima volta a un contatto di test):

**Stato carrello / recupero:**
- `cart_abandoned` (applicato dal workflow recupero quando parte)
- `cart_recovered` (applicato al completamento ordine)
- `non_recuperato_14d` (applicato dopo regola anti-spam 14 giorni)

**Lead / acquisizione:**
- `lead_newsletter` · `lead_caldo` · `lead_ads`
- `amazon` · `ebay` · `store` (applicati dal Modulo Importazioni)
- `cliente-online` (applicato dal webhook al primo ordine sito)

**Stato cliente:**
- `primo-ordine` · `cliente-ricorrente` · `vip` · `inattivo` · `non-recuperato`

**Cluster (gestiti automaticamente dal webhook):**
- `cluster-bronzo` · `cluster-argento` · `cluster-oro` · `cluster-premium`

**Categoria prodotto (opzionali, applicati dal webhook):**
- `categoria-integratori` · `categoria-farmaceutici` · `categoria-cosmesi` · ecc.

## B.3 Workflow GHL da configurare

Questi sono i workflow nativi di GHL. Lo sviluppatore li costruisce nell'editor workflow del sub-account.

### Workflow 1 — Welcome post-import Amazon
- **Trigger**: tag `amazon` applicato (dal Modulo Importazioni)
- **Sequenza**: WhatsApp soft-push verso il sito → +24h reminder → +72h codice sconto first-buy → +7gg ultimo touch
- **Exit condition**: tag `cliente-online` applicato (significa che ha acquistato)
- **Filtro**: `consenso_whatsapp_marketing = true`

### Workflow 2 — Welcome post-import eBay
Stessa logica di Workflow 1, copy differente.

### Workflow 3 — Welcome post-import Store
- **Trigger**: tag `store`
- **Canale principale**: SMS (clienti store fisico spesso non hanno WhatsApp Business attivo)
- **Sequenza**: SMS welcome → +3gg promo riservata clienti store → +7gg invito a registrarsi al sito

### Workflow 4 — Carrello abbandonato (multi-step)
- **Trigger**: tag `cart_abandoned` (applicato dal webhook checkouts/abandon, vedi B.5)
- **Sequenza** (come da §8 del doc):
  - +30/60 min — Email reminder con link checkout
  - +4h — WhatsApp breve e diretto (solo se consenso WhatsApp)
  - +24h — Email con benefit, rassicurazioni, recensioni
  - +48h — Email/WhatsApp con codice sconto leggero (solo cliente idoneo)
  - +72h — Email ultimo promemoria
  - +7gg — Email soft con contenuto di valore
  - +14gg — Uscita workflow + tag `non_recuperato_14d`
- **Exit condition**: ordine completato (tag `cart_recovered`)
- **Regola critica**: i codici sconto **solo dal secondo o terzo touchpoint**, mai subito (anti-abuso)

### Workflow 5 — Primo ordine
- **Trigger**: `numero_ordini` passa da 0 a 1
- **Sequenza**: conferma ordine → tracking → +7gg richiesta recensione → +14gg nudge secondo acquisto
- **Output**: aggiornamento `stato_cliente = "Primo ordine"`

### Workflow 6 — Post ordine standard
- **Trigger**: ogni `order.paid` (tutti gli ordini)
- **Azioni**: aggiornamento campi, task customer care, tracking spedizione

### Workflow 7 — Secondo ordine / cross-sell
- **Trigger**: `numero_ordini` passa a 2, oppure tag categoria + tempo idoneo
- **Sequenza**: messaggio cross-sell con prodotto complementare basato su `categoria_ultimo_acquisto`

### Workflow 8 — Win-back inattivi
- **Trigger**: `data_ultimo_ordine` > 60 giorni fa (smart list)
- **Sequenza progressiva**: 60gg promo soft → 90gg promo media → 120gg ultimo tentativo con codice sconto importante
- **Exit**: ordine completato → tag `cluster-*` aggiornato

### Workflow 9 — Anti-spam 14 giorni
- **Trigger**: tag `cart_abandoned` presente da >14 giorni senza acquisto
- **Azioni**:
  - Rimuove `cart_abandoned`
  - Applica `non_recuperato_14d`
  - Sposta `stato_cliente` in "Non recuperato" o "Lead non convertito"
  - Esclude da codici sconto per 30 giorni
  - Inserisce in nurturing soft (max 1-2 comunicazioni/mese)

### Workflow 10 — Riacquisto consumabili
- **Trigger**: ordine completato + `consumabile = true`
- **Delay**: `ciclo_riacquisto_giorni` (20/30/45/60/90 in base al prodotto)
- **Azione**: WhatsApp reminder riacquisto con link diretto al prodotto

### Workflow 11 — VIP / loyalty
- **Trigger**: tag `cluster-premium` applicato (gestito automaticamente dal webhook)
- **Sequenza**: welcome VIP → comunicazione esclusiva → benefit/omaggio → anteprime offerte
- **Frequenza**: bassa, comunicazioni di alto valore

### Workflow 12 — Richiesta recensione store fisico
- **Trigger**: ordine da store (tag `store` + nuovo ordine) + 3 giorni
- **Canale**: SMS dedicato con QR/link Google Reviews
- **Filtro**: cliente con consenso, non già recensito

## B.4 Pipeline GHL da configurare

Tre pipeline native (entità GHL, non viste della Dashboard):

### Pipeline 1 — Customer Journey
**Stage:**
`Nuovo lead` → `Interessato` → `Checkout iniziato` → `Carrello abbandonato` → `Primo ordine` → `Cliente attivo` → `Cliente ricorrente` → `VIP` → `Inattivo` → `Non recuperato`

Le opportunity si muovono automaticamente tramite workflow.

### Pipeline 2 — Customer Care / Post ordine
**Stage:**
`Ordine ricevuto` → `In lavorazione` → `Spedito` → `Consegnato` → `Richiesta assistenza` → `Reso/Rimborso` → `Risolto`

Mosse tramite eventi Shopify (`order.fulfilled`, `order.delivered`, ecc.) e task manuali del team.

### Pipeline 3 — Preordine / Lancio (opzionale, solo se previsto da Padre Pio)
**Stage:**
`Interessato` → `Lista attesa` → `Preordine aperto` → `Preordine completato` → `Non convertito` → `Follow-up lancio`

## B.5 Webhook Shopify aggiuntivi (oltre a `orders/paid`)

Per coprire tutto il customer journey, lo sviluppatore deve configurare nel pannello Shopify Admin questi webhook addizionali (le destinazioni e gli endpoint vengono forniti dal team Bibot Core):

| Evento Shopify | Endpoint Bibot | Cosa fa |
|---|---|---|
| `orders/paid` | `/api/parafarmacia/order-webhook` | ✅ Già descritto in Parte A.3 |
| `checkouts/create` | `/api/parafarmacia/checkout-webhook` | Marca contatto come "checkout iniziato", crea opportunity nello stage corrispondente |
| `checkouts/update` | `/api/parafarmacia/checkout-webhook` | Aggiorna valore carrello e link checkout sul contatto |
| `orders/cancelled` | `/api/parafarmacia/order-webhook` | Aggiorna stato ordine in Supabase, eventuale task customer care |
| `refunds/create` | `/api/parafarmacia/refund-webhook` | Aggiorna `parafarmacia_orders`, decrementa aggregati su GHL |
| `orders/fulfilled` | `/api/parafarmacia/fulfillment-webhook` | Trigger post-ordine tracking, sposta opportunity in pipeline Post ordine |

**Nota:** Shopify non emette nativamente un evento "checkout abandoned". Lo gestiamo con un job lato Bibot Core che ogni 30 minuti scansiona i checkout in Supabase senza `order_id` associato e applica il tag `cart_abandoned` se sono passati >X minuti dal `checkouts/create`.

## B.6 Template messaggi da creare in GHL

I testi dei messaggi sono **template GHL**, non file nel design. Lo sviluppatore li crea nel pannello GHL (sezione Templates) usando i testi forniti dal cliente (vedi briefing §5 punto 6).

Template minimi richiesti:

**Email:**
- Welcome post-import (3 varianti: Amazon/eBay/Store)
- Carrello abbandonato — Step 1 (reminder)
- Carrello abbandonato — Step 2 (benefit/rassicurazioni)
- Carrello abbandonato — Step 3 (codice sconto)
- Carrello abbandonato — Step 4 (ultimo promemoria)
- Conferma ordine
- Tracking spedizione
- Richiesta recensione
- Codice sconto manuale
- Win-back 60/90/120
- Newsletter mensile

**WhatsApp:**
- Welcome post-import (3 varianti)
- Carrello abbandonato (1 messaggio diretto)
- Richiesta recensione
- Codice sconto VIP
- Riacquisto consumabili

**SMS:**
- Welcome post-import Store
- Richiesta recensione store fisico
- Codice sconto store

## B.7 Gestione consensi (punto aperto del documento)

Il documento §14 lascia esplicitamente aperta la domanda: *"come gestiamo i consensi? come vengono salvati?"*

**Implementazione proposta (da concordare):**

| Fase | Dove | Chi |
|---|---|---|
| **Capture** | Checkout Shopify (checkbox obbligatorio) + form Bibot di newsletter | Shopify dev / Bibot frontend |
| **Storage** | Custom field `consenso_email_marketing` e `consenso_whatsapp_marketing` (Boolean) sul contatto GHL | Webhook Bibot Core (li scrive nel payload) |
| **Enforcement** | Filtro all'inizio di ogni workflow GHL: "Se consenso = false, skip" | Sviluppatore GHL |
| **Revoca email** | Link unsubscribe in fondo a ogni email → workflow GHL che setta consenso a false | Sviluppatore GHL |
| **Revoca WhatsApp** | Parola chiave "STOP" → workflow GHL che setta consenso a false | Sviluppatore GHL |
| **Audit** | Custom field `consenso_data_ultimo_update` per timeline | Sviluppatore GHL |

---

# Checklist operativa pre go-live

## Lato Bibot Core (~4 settimane)

- [ ] Migrazione Supabase: `parafarmacia_orders` + `parafarmacia_funnel_events`
- [ ] Endpoint `/api/parafarmacia/order-webhook`
- [ ] Endpoint `/api/parafarmacia/checkout-webhook`
- [ ] Endpoint `/api/parafarmacia/refund-webhook`
- [ ] Endpoint `/api/parafarmacia/fulfillment-webhook`
- [ ] Endpoint `/api/parafarmacia/r/[token]` (redirect tracciato)
- [ ] Libreria `lib/parafarmacia/` (ghl, cluster, queries, funnel)
- [ ] Job scheduler abbandono carrelli (ogni 30 min)
- [ ] Design: shell + tema brand cliente
- [ ] Modulo 1 — Dashboard analitica
- [ ] Modulo 2 — Contatti (con filtri smart-list integrati)
- [ ] Modulo 3 — Importazioni
- [ ] Modulo 4 — Ordini
- [ ] Modulo 5 — Campagne
- [ ] Modulo 6 — Recensioni Google
- [ ] Modulo 7 — Impostazioni

## Lato sviluppatore GHL (~3-4 giorni)

- [ ] Creazione 14 custom field aggiuntivi (Parte B.1)
- [ ] Creazione tag taxonomy (Parte B.2)
- [ ] Workflow 1 — Welcome Amazon
- [ ] Workflow 2 — Welcome eBay
- [ ] Workflow 3 — Welcome Store
- [ ] Workflow 4 — Carrello abbandonato (multi-step)
- [ ] Workflow 5 — Primo ordine
- [ ] Workflow 6 — Post ordine standard
- [ ] Workflow 7 — Secondo ordine / cross-sell
- [ ] Workflow 8 — Win-back inattivi
- [ ] Workflow 9 — Anti-spam 14 giorni
- [ ] Workflow 10 — Riacquisto consumabili
- [ ] Workflow 11 — VIP / loyalty
- [ ] Workflow 12 — Richiesta recensione store
- [ ] Pipeline 1 — Customer Journey
- [ ] Pipeline 2 — Customer Care / Post ordine
- [ ] Pipeline 3 — Preordine / Lancio (se prevista)
- [ ] Template email (11+)
- [ ] Template WhatsApp (5+)
- [ ] Template SMS (3+)
- [ ] Configurazione consensi e enforcement nei workflow

## Da fornire al team (cliente)

Dal briefing §5:

- [ ] Accesso Shopify (utente collaboratore)
- [ ] Conferma numeri WhatsApp (Business + standard)
- [ ] Lista utenti con accesso (titolare + Stefano)
- [ ] Branding (logo, colori)
- [ ] Bozze testi messaggi (welcome, recensione, riacquisto, sconto)
- [ ] Accesso Google Business Profile

---

# Riepilogo

| Area | Effort | Owner |
|---|---|---|
| **Sviluppo Dashboard Bibot Core** | ~4 settimane | Team Bibot Core |
| **Configurazione GHL** | ~3-4 giorni | Sviluppatore GHL |
| **Formazione cliente** | ~1 ora | Team Bibot Core + cliente |

**Totale go-live**: ~4 settimane dalla firma del contratto.

---

*Documento operativo — versione 1.0 — Maggio 2026*
*Bibot Core — Implementazione Parafarmacia Padre Pio*
