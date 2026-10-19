# Produkt- und Architekturkonzept

## Name

**Klarstunde** ist kurz, deutsch, gut aussprechbar und beschreibt das Produkt ohne den Namen des Fremddienstes zu übernehmen.

- Produktname: `Klarstunde`
- Git-Repository: `klarstunde`
- mögliche Beschreibung: `Lokale Schüleransicht für den Virtuellen Stundenplan`

Vor einer öffentlichen oder geschäftlichen Nutzung sollte eine Markenrecherche beim DPMA und EUIPO erfolgen. Eine normale Websuche ersetzt sie nicht.

## Produktidee

Der Stundenplan ist die Startansicht. Schüler sehen zuerst, was heute und in dieser Woche stattfindet. Seltenere Funktionen bleiben erreichbar, drängen sich aber nicht in den Vordergrund.

### Prioritäten in der Oberfläche

1. aktuelle Stunde, nächste Stunde und Änderungen
2. Wochen- und Tagesansicht
3. Klausuren und Nachrichten
4. Fehlzeiten und Krankmeldung
5. Dateien, fremde Klassenpläne, Blockpläne und Schülerausweis

### Funktionsumfang des Quelldienstes

Die öffentliche Hilfeseite nennt:

- eigenen Stundenplan
- Fehlzeiten
- geplante Klausuren
- Stundenplan anderer Klassen
- freigegebene Dateien
- Krankmeldung und optionale Nachricht an den Ausbildungsbetrieb
- Schul- und Klassennachrichten
- digitalen Schülerausweis, falls freigeschaltet
- Blockpläne, falls von der Schule genutzt

Nicht jede Schule schaltet jeden Bereich frei und Kürzel sind nicht schulübergreifend einheitlich. Klarstunde sollte Fähigkeiten daher nach der Anmeldung erkennen und nur tatsächlich verfügbare Bereiche zeigen. Bezeichnungen einer Schule gehören in die lokale Konfiguration, nicht in den allgemeinen Quellcode.

## Empfohlene Architektur

### Entscheidung: lokale Web-App mit Backend-for-Frontend

```text
Browser
  │ eigenes HttpOnly-Cookie
  ▼
lokaler Node-Server
  ├── Sitzung im Arbeitsspeicher
  ├── normalisierte JSON-Antworten
  └── VSP-Adapter: Login, HTTP-Aufrufe, HTML-Parser
          │ PHPSESSID
          ▼
virtueller-stundenplan.org
```

Ein reines Browser-Frontend wäre ungeeignet: CORS kann Aufrufe blockieren und die fremde Sitzungs-ID wäre für JavaScript erreichbar. Ein lokaler Proxy hält diese Details aus der Oberfläche heraus.

### Warum kein großes Framework oder Microservices?

- ein Prozess und ein Paket reichen für den lokalen Betrieb
- React/Vite liefert eine schnelle, responsive Oberfläche
- Express stellt nur wenige lokale Endpunkte bereit
- Cheerio kapselt das unvermeidbare HTML-Parsing
- keine Datenbank, solange keine dauerhafte Speicherung benötigt wird
- kein generisches Repository-, Service- oder Port-Geflecht

Der externe Dienst ist eine echte Änderungsschnittstelle. Deshalb besitzt er genau einen Adapter. Für interne, reine Berechnungen sind keine Interfaces nötig.

### Lokale API

Die Browseroberfläche spricht nur diese stabilen Endpunkte an:

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/session` | lokalen Anmeldestatus lesen |
| `POST` | `/api/session` | beim Quelldienst anmelden |
| `DELETE` | `/api/session` | lokale Sitzung löschen |
| `GET` | `/api/timetable?start=YYYY-MM-DD` | normalisierte Schulwoche laden |
| `GET` | `/api/timetable/teaching-date?start=YYYY-MM-DD&direction=next` | Unterrichtswochen-Navigation des Portals ausführen; auch `previous` |
| `GET` | `/api/attendance` | Fehlzeiten, Ergebnisse und angebotene Filter laden |
| `GET` | `/api/homework` | Klassenbuch, Hausaufgaben und angebotene Filter laden |
| `GET` | `/api/messages` | Schul- und Klassennachrichten laden |
| `GET` | `/api/classes`, `/api/class-timetable` | Klassen und deren Wochenplan laden |
| `GET` | `/api/block-plans` | Blockplan für ein Schuljahr laden |
| `GET` | `/api/files`, `/api/files/open` | Dateiliste laden und freigegebene Datei öffnen |
| `GET` | `/api/student-card` | freigegebene Schülerausweisdaten laden |
| `POST` | `/api/sick-notes` | bestätigte Krankmeldung übermitteln |
| `GET`, `POST` | `/api/notifications/status`, `/api/notifications/test` | lokale Telegram-Konfiguration prüfen |

Die Endpunkte geben normalisierte Daten statt fremdem HTML aus. Weitere Bereiche kommen erst hinzu, wenn ihr echtes Verhalten mit einem berechtigten Testkonto geprüft wurde. Die App erfindet keine nicht belegten Fremd-APIs.

`/api/timetable` unterstützt `view=day`, `effective=1`, `compare=1` und `refresh=1`. Die Wochenansicht umfasst Montag bis Sonntag. Der Klassenplan wird einmal pro Vergleich als vollständige Woche geladen und nach Tagen und Stunden normalisiert. `/api/class-timetable` liefert ebenfalls normalisierte Stundenplandaten statt allgemeiner Tabellen. Die Parser prüfen die Kalenderdaten der Klassenspalten. Ein sitzungsgebundener Speicher-Cache gilt höchstens 30 Sekunden; manuelles Neuladen umgeht ihn. Gleichzeitige identische Anfragen teilen sich einen Abruf, und die Portalzugriffe einer Sitzung werden serialisiert. Antworten tragen `Cache-Control: no-store`.

Für Krankmeldungen ist keine positive Erfolgsantwort durch einen schreibenden Live-Test belegt. Deshalb wird nach einer nicht eindeutig bestätigten Übermittlung keine Erfolgsmeldung behauptet. Der Nutzer wird auf die Prüfung im Originalportal verwiesen; doppelte Übermittlungen werden in der lokalen Sitzung begrenzt.

## Ausbauplan

### Phase 1 – belastbarer Stundenplan

- Parser mit anonymisierten HTML-Fixtures mehrerer Schulen absichern
- alte und neue Werte für Vertretungen sauber unterscheiden
- Doppelsstunden und parallele Unterrichtseinträge darstellen
- Tagesansicht und aktuelle Stunde ergänzen
- Office-365-Anmeldung klären; sie lässt sich nicht sicher über ein einfaches Passwortformular nachbilden

### Phase 2 – lesende Bereiche – umgesetzt

- Klausuren
- Fehlzeiten
- Nachrichten
- Dateien
- Klassen- und Blockpläne

Diese Bereiche sind über einen gemeinsamen, eng begrenzten Tabellenparser und eigene Oberflächen angebunden.

### Phase 3 – schreibende und sensible Bereiche – umgesetzt mit Grenze

- Krankmeldung mit Bestätigungsdialog: umgesetzt
- Schülerausweis: umgesetzt
- Mail an den Ausbildungsbetrieb: lokales Mailprogramm mit vorbereitetem Text; ein automatisch hinterlegter Empfänger war im Testkonto nicht verifizierbar

Vor der Umsetzung müssen Formularfelder, CSRF-Schutz, Bestätigungsabläufe, Fehlerfälle und Datenschutz mit dem Betreiber oder einer Testschule geklärt werden. Für Krankmeldungen braucht es eine deutliche Zusammenfassung vor dem Absenden und Schutz vor Doppelübermittlungen.

### Phase 4 – installierbar und optional im Heimnetz

- PWA-Manifest und Offline-Hülle
- Docker-Image
- optionaler LAN-Betrieb mit HTTPS und Nutzertrennung
- verschlüsselte dauerhafte Sitzungen nur auf ausdrücklichen Wunsch

Der Standard bleibt `127.0.0.1`. Beim Binden an `0.0.0.0` reichen die aktuellen In-Memory-Sitzungen allein nicht für einen gemeinsam genutzten Server.

Für eine persönliche Installation kann optional ein festes Konto über lokale Umgebungsvariablen gesetzt werden. Die Zugangsdaten bleiben auf dem Server und werden nicht an die Browseroberfläche geliefert. Auf gemeinsam genutzten oder öffentlich erreichbaren Installationen ist diese Betriebsart nur mit einem zusätzlichen Zugangsschutz vertretbar.

## Rechtliche Einordnung

Die Lizenz des veröffentlichten Quellcodes und die Rechte zum Zugriff auf den fremden Dienst sind getrennt zu beurteilen. Die MIT-Lizenz dieses Projekts erteilt keine Nutzungsrechte am Originalportal, an dessen Daten oder an fremden Marken und Inhalten.

### Quellcode und Kontozugriff

- Eigener Quellcode kann unter einer passenden eigenen Lizenz veröffentlicht werden, soweit daran die erforderlichen Rechte bestehen.
- Bei übernommenem Fremdcode gelten dessen Lizenz und die jeweiligen Pflichten; die Lizenz von Klarstunde ersetzt sie nicht.
- Ein berechtigtes Konto belegt nicht automatisch, dass automatisierte Abrufe oder alternative Clients erlaubt sind. Dafür sind die geltenden Bedingungen und die konkrete Nutzung getrennt zu prüfen.

Klarstunde übernimmt derzeit keinen Quellcode des Flutter-Projekts; es wurde nur zur Schnittstellenanalyse betrachtet.

### Was vor Live-Betrieb oder einem Betrieb für andere zu klären ist

1. **Erlaubnis und Nutzungsbedingungen:** Die geltenden Vorgaben des Dienstbetreibers und der Schule prüfen. Bei Unklarheit die Nutzung durch alternative Clients und automatisierte HTML-Abrufe vorab abstimmen und die Klärung dokumentieren. Diese Implementierung nutzt keine für Klarstunde zugesicherte API; eine Freigabe wird nicht behauptet.
2. **Marken:** Name, Logo und Gestaltung des Fremddienstes nicht übernehmen. „Klarstunde“ vor größerer Veröffentlichung als Marke prüfen.
3. **Urheber- und Datenbankrechte:** Keine Bilder, Texte, CSS- oder HTML-Bestandteile des Fremddienstes kopieren. Nur die für das eigene Konto ausgelieferten Fakten verarbeiten.
4. **Datenschutz:** Lokaler Betrieb allein garantiert weder Datenschutzkonformität noch die Anwendbarkeit der Haushaltsausnahme. Bei Verarbeitung für andere Personen sind Anwendungsbereich, Verantwortlichkeit, Rechtsgrundlagen und erforderliche Datenschutzinformationen, Löschregeln und Schutzmaßnahmen zu prüfen. Gesundheitsangaben verdienen besonderen Schutz.
5. **Minderjährige:** Konten und Daten von Schülern verdienen besonders zurückhaltende Voreinstellungen. Keine Analyse-, Werbe- oder Drittanbieter-Skripte.
6. **Schreibende Aktionen:** Krankmeldungen oder betriebliche E-Mails erst nach Abstimmung und belastbaren Tests anbieten.
7. **Haftung und Aktualität:** Ein Parser kann nach Änderungen der Quellwebsite falsche oder leere Daten liefern. Die Oberfläche muss Ausfälle sichtbar machen und darf veraltete Daten nicht als aktuell ausgeben.

Das ist eine technische Risikoeinschätzung, keine Rechtsberatung. Für einen öffentlichen Betrieb in Deutschland sollte ein fachkundiger Jurist die konkrete Nutzung prüfen.

Die Haftungsausschlüsse der MIT-Lizenz gelten nur im rechtlich zulässigen Umfang. Zwingende gesetzliche Ansprüche bleiben unberührt; weder die README noch die Bezeichnung als privates Experiment gewährleisten Haftungsfreiheit. Die maßgeblichen Hinweise und gesetzlichen Quellen stehen in der [README](../README.md#lizenz-und-fremde-rechte).

## Qualitätsregeln

- manuelle Passwörter nicht dauerhaft speichern oder protokollieren; die optionale, selbst angelegte `.env` ist eine ausdrücklich dokumentierte Ausnahme mit Klartextspeicherung
- keine fremde Sitzungs-ID im Browser
- keine still geschluckten Parserfehler
- anonymisierte HTML-Fixtures statt Live-Konten in Tests
- Datums- und Stundenplanregeln zentral halten
- Features nur nach realer Prüfung des Quelldiensts veröffentlichen
- Quellwebsite schonend abrufen: parallele Wochenabfrage begrenzen und später kurzzeitig cachen


## Lokaler Start und Bedienungsprüfung

`start.cmd` unter Windows und `start.sh` unter Linux verwenden gemeinsam `scripts/start.mjs`. Der Starter prüft Node.js 24, Abhängigkeiten, lokale Bindung und Portverfügbarkeit. Er verwendet einen vorhandenen aktuellen Build oder baut lokal neu und öffnet anschließend den Standardbrowser. Ohne grafische Sitzung ist ein Start mit `--no-open` möglich. Er beendet keine fremden Prozesse und installiert keine Abhängigkeiten automatisch.

Die vier Anzeigeoptionen des persönlichen Stundenplans werden über eine feste Liste mit Formatversion im Local Storage gespeichert. Konten, Datum, Schuldaten und Ausweisinhalte gehören nicht in diesen Speicher. Die Rückkehr zur vorherigen Ansicht nach Sitzungsablauf verwendet zusätzlich nur den Zustand des geöffneten Tabs. „Ansicht zurücksetzen“ entfernt den gespeicherten Eintrag.

Gemeinsame Komponenten unterscheiden Ladezustand, fehlende Auswahl, leere Ergebnisse, ausdrücklich erkannte fehlende Freigabe und Ladefehler. Der optionale kopierbare Fehlerbericht enthält ausschließlich Version, Bereich und Fehlerkategorie aus festen Wertelisten. Es erfolgt kein automatischer Versand.

Die Playwright-Prüfung wird lokal über `pnpm test:ui` ausgeführt. Eine separate Vorschau ohne Backend-Proxy, vollständig nachgebildete API-Antworten und das Blockieren externer Browser-Anfragen trennen sie von echten Schulkonten. Desktop sowie zwei Mobilbreiten werden geprüft. `pnpm check` enthält die übrigen lokalen Prüfungen einschließlich Startertests; es gibt keine GitHub Actions.
