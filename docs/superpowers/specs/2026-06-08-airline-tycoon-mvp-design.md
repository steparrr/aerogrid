# Airline Tycoon Realistico - MVP Design

## Obiettivo

Creare un gestionale aereo serio, moderno e giocabile, con simulazione realistica ma leggera. L'MVP deve permettere al giocatore di scegliere un hub, costruire liberamente la propria compagnia, acquistare o prendere in leasing aeromobili, aprire rotte scelte manualmente e valutarne i risultati avanzando il tempo a turni.

La simulazione non rappresenta singoli passeggeri. Lavora con aggregati giornalieri per rotta, segmento, aeroporto e compagnia.

## Decisioni Confermate

- Piattaforma: gioco web locale offline, predisposto per un futuro salvataggio cloud.
- Desktop: esperienza completa di gestione.
- iPhone: consultazione rapida e azioni essenziali, non pianificazione complessa.
- Plancia principale: centro operativo bilanciato con mappa, KPI e performance rotte.
- Modello operativo: libero, senza archetipi obbligatori.
- Nuova partita: scelta hub tra FCO, LHR, JFK, DXB, SIN e GRU.
- Risorse iniziali: solo capitale; nessun aeromobile acquistato automaticamente.
- Route Planner: il giocatore sceglie origine e destinazione; il planner non propone rotte autonomamente.
- Pianificazione: il planner consiglia configurazione, frequenza, giorni, orari, prezzi e classi, ma ogni valore è modificabile.
- Tempo: turni giornalieri, con pulsanti "Avanza 1 giorno" e "Avanza 1 settimana".
- Contratti corporate e tour operator: placeholder chiaro nell'MVP.

## Perimetro MVP

L'MVP comprende:

- 40 aeroporti mondiali distribuiti tra tutti i continenti abitati;
- città collegate agli aeroporti e relativi indicatori economici/turistici;
- domanda passeggeri business, leisure e VFR;
- mercato con aeromobili acquistabili o disponibili in leasing;
- rotte, frequenze, giorni operativi, orari, prezzi e classi;
- simulazione giornaliera di passeggeri, ricavi, costi e profitti;
- 8 compagnie NPC con concorrenza base;
- finanze aziendali e report giornalieri/settimanali;
- salvataggio automatico locale, esportazione e importazione;
- interfaccia responsive con vista mobile ridotta;
- test automatici e pannello debug di sviluppo.

Non comprende ancora:

- contratti corporate o tour operator funzionanti;
- cargo dedicato e flotta freighter operativa;
- alleanze, codeshare, loyalty program o personale dettagliato;
- salvataggi cloud e account;
- simulazione individuale dei passeggeri.

## Esperienza Di Gioco

### Nuova Partita

Il giocatore inserisce il nome della compagnia, sceglie un hub iniziale e riceve il capitale di partenza. Non riceve aeromobili. Deve visitare il mercato e decidere autonomamente cosa acquistare o prendere in leasing.

L'hub influenza tasse, domanda locale, capacità, congestione e opportunità, ma non impone un modello operativo.

### Ciclo Principale

1. Consultare aeroporti e domanda potenziale.
2. Acquistare o prendere in leasing aeromobili.
3. Scegliere manualmente origine e destinazione.
4. Ricevere dal Route Planner una proposta operativa completa.
5. Accettare la proposta rapidamente oppure modificarne ogni parametro.
6. Aprire la rotta.
7. Avanzare di un giorno o una settimana.
8. Analizzare passeggeri, ricavi, costi, profitti e concorrenza.
9. Correggere prezzi, frequenze, schedule o flotta.

### Route Planner

Il Route Planner si attiva solo dopo che il giocatore ha scelto origine e destinazione. Non presenta né apre rotte autonomamente.

Per la rotta selezionata calcola e propone:

- domanda business, leisure e VFR;
- aeromobili compatibili disponibili;
- aeromobile consigliato;
- frequenza settimanale;
- giorni operativi;
- orari di partenza e arrivo;
- configurazione economy/business;
- prezzo medio economy e business;
- capacità, load factor e yield previsti;
- ricavi, costi e profitto stimati;
- principali rischi e motivazioni del consiglio.

La proposta può essere accettata con un'azione rapida. Un pannello avanzato consente di modificare manualmente ogni parametro prima dell'apertura. Il planner deve ricordare le ultime preferenze utili e consentire di duplicare una configurazione, senza rendere ripetitiva l'apertura di rotte simili.

## Schermate

### Nuova Partita

- nome compagnia;
- selezione hub;
- capitale iniziale e breve riepilogo delle caratteristiche dell'hub;
- avvio immediato della partita.

### Centro Operativo

- mappa mondiale con hub e rotte attive;
- data corrente, liquidità e notifiche;
- passeggeri, ricavi, costi, profitto e load factor;
- rotte migliori e peggiori;
- pulsanti "Avanza 1 giorno" e "Avanza 1 settimana";
- accesso alle principali aree gestionali.

### Mercato Aeromobili

- modelli nuovi e usati;
- opzioni acquisto e leasing;
- costo, rateo mensile, capacità, range, consumo, età e affidabilità;
- compatibilità generale e raggio operativo visualizzato sulla mappa;
- conferma chiara dell'impatto sulla liquidità.

### Route Planner

- selezione manuale origine/destinazione;
- proposta automatica modificabile;
- modalità rapida e pannello avanzato;
- previsione economica e avvisi di compatibilità;
- apertura della rotta.

### Rotte

- elenco e filtri;
- frequenze, prezzi, aereo assegnato, load factor e profitto;
- confronto con concorrenza;
- modifica, sospensione o chiusura.

### Flotta

- aeromobili posseduti e in leasing;
- utilizzo, rotte assegnate, costi, affidabilità e redditività;
- problemi di range, pista, capacità o sovrautilizzo.

### Aeroporti E Domanda

- tabella dei 40 aeroporti con filtri;
- dettaglio aeroporto;
- esplorazione manuale della domanda tra due aeroporti;
- segmenti, yield previsto, stagionalità e concorrenza.

### Finanze

- liquidità;
- ricavi, costi e profitto giornalieri e settimanali;
- CASK, RASK, margine operativo e break-even load factor;
- migliori e peggiori rotte;
- composizione ricavi e costi.

### Contratti

Placeholder non interattivo con messaggio: "Feature prevista nel blocco successivo".

### Simulation Debug

Visibile solo in sviluppo:

- stato partita;
- ultimo turno;
- domanda generata;
- mosse NPC;
- errori e avvisi;
- ultimo report finanziario.

## Architettura

Il progetto sarà un'app React + TypeScript costruita con Vite. Sarà completamente eseguibile in locale e utilizzerà asset inclusi nel progetto, senza dipendere da servizi remoti per il gameplay.

### Dati Statici

Contengono città, aeroporti, modelli aeromobili, compagnie NPC e parametri di bilanciamento. I seed sono separati dallo stato della partita e validati all'avvio.

### Stato Partita

È la fonte unica per data, compagnia giocatore, liquidità, flotta, rotte, NPC, report, notifiche e impostazioni. Le modifiche passano attraverso azioni esplicite e verificabili.

### Motore Di Simulazione

È separato dall'interfaccia e composto da moduli puri:

- domanda passeggeri;
- assegnazione passeggeri e concorrenza;
- operazioni rotte e compatibilità;
- ricavi e costi;
- comportamento NPC;
- report e avanzamento tempo.

### Persistenza

Lo stato viene salvato localmente dopo ogni turno e decisione importante. Il salvataggio include una versione di schema per consentire future migrazioni. Esportazione e importazione usano un file JSON validato prima del caricamento.

### Interfaccia

La UI legge lo stato e invia azioni al livello di gioco. Non contiene formule economiche o logica di simulazione. La mappa usa dati geografici locali e resta fruibile offline.

## Modello Dati Principale

### City

Identità, paese, continente, popolazione, PIL pro capite, tourism score, business score, diaspora score, coordinate e aeroporti vicini.

### Airport

IATA, ICAO, città, coordinate, dimensione, pista, capacità slot/terminal, tasse, congestione, curfew, hub potential e gateway score.

### AircraftModel E Aircraft

Il modello contiene capacità, range, consumo, velocità, requisiti pista, turnaround e costi base. L'istanza contiene proprietà/leasing, età, affidabilità, configurazione, assegnazioni e utilizzo.

### Route

Compagnia, origine, destinazione, frequenze, giorni, orari, aereo, classi, prezzi, stato e storico performance.

### Demand Estimate

Domanda giornaliera business, leisure e VFR, yield previsto, stagionalità e fattori esplicativi.

### Finance Reports

Ricavi e costi per categoria, cash flow, margine, CASK, RASK, break-even load factor e risultati per rotta.

## Simulazione Giornaliera

Ogni turno esegue in ordine:

1. validazione dello stato corrente;
2. calcolo della domanda per le rotte attive;
3. distribuzione passeggeri tra giocatore e NPC;
4. verifica operabilità di rotte e aeromobili;
5. calcolo ricavi;
6. calcolo costi;
7. aggiornamento liquidità e performance;
8. semplici decisioni NPC su prezzi e frequenze;
9. generazione di notifiche e report;
10. avanzamento data e salvataggio automatico.

"Avanza 1 settimana" esegue sette turni giornalieri consecutivi. Il gioco resta fermo finché il giocatore non sceglie di avanzare. In caso di errore critico durante una settimana, l'avanzamento si interrompe e mostra il giorno raggiunto.

## Domanda E Concorrenza

La domanda non è casuale pura. Deriva da popolazione, ricchezza, business score, tourism score, diaspora score, distanza, stagionalità, accessibilità, prezzi, frequenza e qualità aeroportuale.

I passeggeri vengono distribuiti tra compagnie in base a:

- prezzo;
- frequenza;
- tempo e qualità del servizio;
- reputazione;
- disponibilità posti;
- presenza di alternative concorrenti.

Gli NPC usano strategie semplici e trasparenti. Possono modificare prezzi o frequenze entro limiti ragionevoli, senza barare né conoscere decisioni future del giocatore.

## Economia E Bilanciamento

Ricavi MVP:

- biglietti economy;
- biglietti business;
- ancillari;
- cargo belly semplificato.

Costi MVP:

- carburante;
- acquisto o leasing;
- manutenzione;
- equipaggio;
- tasse aeroportuali;
- handling e navigazione;
- costi amministrativi semplificati.

Le rotte lunghe richiedono aeromobili adatti. Le rotte business premiano frequenza e servizio; quelle leisure sono più sensibili al prezzo. Il bilanciamento deve permettere profitti ragionevoli con buone decisioni, ma penalizzare capacità eccessiva, prezzi sbagliati, aeromobili inadatti e leasing troppo onerosi.

## Error Handling

- Bloccare l'apertura di rotte impossibili per range, pista o indisponibilità aeromobile.
- Mostrare avvisi prima di operazioni rischiose ma valide.
- Impedire numeri `NaN`, infiniti o valori economici incoerenti.
- Validare seed e salvataggi prima dell'uso.
- Conservare l'ultimo salvataggio valido se un'importazione fallisce.
- Mostrare messaggi comprensibili e azioni correttive.
- Registrare gli errori tecnici nel pannello debug di sviluppo.

## Strategia Mobile

Su iPhone saranno disponibili:

- KPI e notifiche;
- consultazione rotte, flotta e finanze;
- avanzamento di un giorno o una settimana;
- modifica rapida prezzi;
- sospensione o riattivazione rotte.

Il mercato aeromobili, il Route Planner avanzato e le analisi comparative complete saranno ottimizzati per desktop. Su mobile resteranno consultabili, ma le operazioni complesse inviteranno a usare la vista desktop.

## Test E Controllo Qualità

Test automatici minimi:

- distanza tra aeroporti;
- calcolo domanda e assenza di valori negativi;
- compatibilità rotta/aeromobile/aeroporto;
- costo operativo;
- ricavo e profitto;
- acquisto e leasing;
- assegnazione aeromobile;
- avanzamento di un giorno;
- avanzamento di una settimana;
- mosse NPC entro limiti;
- salvataggio, esportazione e importazione;
- protezione da salvataggi corrotti.

Prima della consegna devono passare:

- build;
- typecheck;
- lint;
- test;
- verifica manuale desktop;
- verifica mobile della vista compatta;
- ciclo completo: nuova partita, acquisizione aereo, apertura rotta, avanzamento tempo e lettura dei risultati.

## Criteri Di Accettazione MVP

L'MVP è completo quando il giocatore può:

1. creare una compagnia e scegliere un hub;
2. iniziare con solo capitale;
3. acquistare o prendere in leasing un aeromobile;
4. consultare almeno 40 aeroporti;
5. scegliere manualmente una rotta;
6. ricevere e modificare la proposta del Route Planner;
7. aprire la rotta con un aeromobile compatibile;
8. avanzare di un giorno o una settimana;
9. vedere passeggeri, ricavi, costi e profitto;
10. osservare concorrenza NPC di base;
11. salvare automaticamente, esportare e importare la partita;
12. usare il centro operativo su desktop e controllare la compagnia da iPhone.
