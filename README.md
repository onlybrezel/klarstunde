# Klarstunde

Klarstunde ist eine inoffizielle, lokal laufende Schüleransicht für ein eigenes Konto bei `virtueller-stundenplan.org`.

> [!IMPORTANT]
> Dieses Repository ist ein privates Softwareexperiment. Es ist kein offizieller Client, kein Angebot einer Schule und kein Ersatz für das Originalportal. Für verbindliche Angaben zu Unterricht, Vertretungen, Fehlzeiten, Prüfungen und Krankmeldungen gilt ausschließlich der jeweilige Schuldienst.

## Abgrenzung

Klarstunde ist ein eigenständiges Projekt. Es besteht keine geschäftliche, organisatorische oder sonstige Verbindung zu

- dem Betreiber von `virtueller-stundenplan.org`,
- einer bestimmten Schule oder einem Schulträger,
- Schulträgern, Ausbildungsbetrieben oder Telegram.

Die genannten Namen und Internetadressen beschreiben nur die technische Kompatibilität. Sie bedeuten weder eine Zusammenarbeit noch eine Empfehlung oder Freigabe. Marken, Logos, Inhalte, Datenbanken und Dienste bleiben Eigentum der jeweiligen Rechteinhaber.

Fragen und Fehler zu Klarstunde gehören nicht an Schulen oder den Betreiber des Originalportals.

## Gedachter Einsatz

Das Projekt ist für eine einzelne Person gedacht, die auf dem eigenen Rechner mit dem eigenen, rechtmäßig erhaltenen Schulkonto arbeitet. Es soll nicht

- öffentlich gehostet,
- als Dienst für andere angeboten,
- mit fremden oder gemeinsam genutzten Konten betrieben,
- zur massenhaften Abfrage oder Sammlung von Schuldaten eingesetzt,
- zur Umgehung von Zugangskontrollen verwendet werden.

Vor einer Veröffentlichung, Weitergabe oder Nutzung durch mehrere Personen müssen die Erlaubnis des Dienstbetreibers, die Vorgaben der Schule und die rechtlichen Pflichten getrennt geprüft werden. Ein Hinweis in dieser README ersetzt keine Erlaubnis.

## Experimenteller Stand

Der Quelldienst stellt für dieses Projekt keine dokumentierte öffentliche JSON-API bereit. Klarstunde liest die für das angemeldete Konto ausgelieferten HTML-Seiten und bereitet sie neu auf. Schon eine kleine Änderung am Originalportal kann deshalb einzelne Bereiche beschädigen oder Werte falsch zuordnen.

Insbesondere gilt:

- Anzeigen können unvollständig, verspätet oder falsch sein.
- Eine erfolgreiche technische Übermittlung beweist nicht, dass eine Krankmeldung angenommen oder bearbeitet wurde.
- Benachrichtigungen können ausbleiben oder zu spät eintreffen.
- Vor Unterrichtsbeginn und vor wichtigen Terminen sollte der Eintrag im Originalportal geprüft werden.
- Es gibt keine Zusage für Verfügbarkeit, Richtigkeit, Support oder dauerhafte Kompatibilität.

## Funktionen

- persönlicher Wochenstundenplan
- Vertretungen, Raumwechsel, Entfall und parallele Kurse
- Klassenarbeiten, Klausuren und andere Leistungsnachweise
- Fehlzeiten, Anwesenheiten und eingetragene Ergebnisse
- Zeitraum-, Zeugnis-, Fach-, Raum-, Lehrkraft- und Stundenfilter, soweit vom Konto angeboten
- Klassenbuch, Unterrichtsinhalte und Hausaufgaben
- Schul- und Klassennachrichten
- Krankmeldung mit Bestätigung
- freigegebene Dateien
- Klassen- und Blockpläne
- digitaler Schülerausweis, sofern freigeschaltet
- optionale Telegram-Hinweise bei bestätigten Stundenplanänderungen
- Demo-Modus ohne Schulkonto

Nicht jede Schule schaltet dieselben Funktionen frei. Getestet sind nur die Bereiche, die im verwendeten Testkonto sichtbar waren.

Eine genaue Gegenüberstellung mit den öffentlich beschriebenen Funktionen des Quelldienstes steht in [`docs/FUNCTIONS.md`](docs/FUNCTIONS.md). Sie nennt auch die beiden bewussten Grenzen: Office-365-Anmeldung und der nicht verifizierte automatische Versand an einen hinterlegten Ausbildungsbetrieb.

## Lokal starten

Voraussetzungen: Node.js 24 und pnpm.

```bash
pnpm install
pnpm dev
```

Danach laufen die Oberfläche unter `http://127.0.0.1:5173` und der lokale Server unter `http://127.0.0.1:4173`.

Produktionsbuild:

```bash
pnpm build
pnpm start
```

Der Server bindet standardmäßig nur an `127.0.0.1`. Diese Voreinstellung sollte für den privaten Betrieb unverändert bleiben.

## Anmeldung

Ohne weitere Konfiguration meldet man sich in der Oberfläche an. Klarstunde übergibt E-Mail-Adresse und Passwort an den Originaldienst und hält dessen Sitzungs-ID im Arbeitsspeicher. Der Browser erhält ein eigenes HttpOnly-Cookie.

Für einen persönlichen Einzelplatz kann eine lokale `.env` verwendet werden:

```dotenv
VSP_AUTO_LOGIN_EMAIL=name@schule.de
VSP_AUTO_LOGIN_PASSWORD=dein-passwort
```

Die `.env` ist von Git ausgeschlossen. Trotzdem liegt das Passwort dann unverschlüsselt auf dem Rechner. Die Datei muss nur für das eigene Benutzerkonto lesbar sein. Automatische Anmeldung gehört nicht auf gemeinsam genutzte Geräte, Server, Backups oder öffentliche Entwicklungsumgebungen.

Zugangsdaten gehören nie in Issues, Screenshots, Chatverläufe, Commits oder Build-Artefakte. Ein versehentlich veröffentlichtes Passwort sollte sofort beim Originaldienst geändert werden.

### Kürzel je Schule

Fach-, Raum- und Lehrkraftkürzel werden von den Schulen unterschiedlich vergeben. Klarstunde enthält deshalb keine fest eingebaute Liste für eine bestimmte Schule. Unbekannte Werte erscheinen unverändert. Eindeutige Bezeichnungen können für die eigene Installation ergänzt werden:

```dotenv
VSP_SUBJECT_LABELS={"E":"Englisch","PO":"Politik"}
VSP_ROOM_LABELS={"A101_PC_24":"A 101 · PC-Raum"}
```

Die Schlüssel müssen exakt den gelieferten Kürzeln entsprechen. Die Beispiele sind keine allgemeingültigen Zuordnungen.

## Telegram-Hinweise

Die automatische Prüfung benötigt das fest hinterlegte Schulkonto und einen eigenen Telegram-Bot:

1. In Telegram `@BotFather` öffnen und mit `/newbot` einen Bot anlegen.
2. Dem neuen Bot eine Nachricht schicken.
3. Über `https://api.telegram.org/bot<TOKEN>/getUpdates` die eigene `message.chat.id` ablesen.
4. Die lokale `.env` ergänzen:

```dotenv
TELEGRAM_BOT_TOKEN=123456:abc
TELEGRAM_CHAT_ID=123456789
TIMETABLE_WATCH_ENABLED=true
TIMETABLE_WATCH_INTERVAL_MINUTES=15
TIMETABLE_WATCH_DAYS=14
```

Eine erkannte Änderung muss bei zwei aufeinanderfolgenden Abrufen gleich sein, bevor Klarstunde eine Nachricht sendet. Wochenenden werden im überwachten Zeitraum übersprungen. Das Mindestintervall beträgt fünf Minuten.

Der Bot-Token ist ein Passwort. Bei aktivierten Hinweisen gehen Datum, Stunde, Fach, Lehrkraft, Raum und Prüfungsangaben an Telegram. Wer das nicht möchte, lässt die Funktion ausgeschaltet.

Der zuletzt bestätigte Plan liegt lokal in `.data/timetable-watch.json`. Die Datei ist von Git ausgeschlossen, enthält aber personenbezogene Schuldaten und sollte weder synchronisiert noch weitergegeben werden.

## Kein öffentlicher Betrieb

`PREVIEW_PASSWORD` ist lediglich eine zusätzliche Schranke für einen kurzen, beaufsichtigten Test. Es macht aus Klarstunde keinen für das Internet geeigneten Dienst. Die Anwendung besitzt derzeit unter anderem keine Mehrbenutzertrennung, keine Rechteverwaltung, kein Rate-Limit für Anmeldeversuche und kein Verfahren für einen dauerhaften sicheren Betrieb.

Bei einem vorgeschalteten HTTPS-Zugang muss zusätzlich `COOKIE_SECURE=true` gesetzt werden. Bei einem reinen HTTP-Aufruf bleibt die Option aus, da der Browser das Sitzungscookie sonst nicht zurücksendet.

Insbesondere ein Server mit automatischer Anmeldung darf nicht über eine öffentliche IP, Portfreigabe oder einen dauerhaften Tunnel erreichbar sein. Für einen kurzen Test verwendete Tunnel und Zugangsdaten sollten anschließend beendet beziehungsweise gewechselt werden.

## Daten und Datenschutz

Klarstunde enthält keine Analyse-, Werbe- oder Tracking-Skripte. Im normalen lokalen Betrieb gilt:

- Passwort und fremde Sitzungs-ID werden nicht an die React-Oberfläche ausgegeben.
- Sitzungen liegen im Arbeitsspeicher und enden spätestens nach Ablauf oder Neustart.
- Nur der Telegram-Vergleichsstand wird optional dauerhaft gespeichert.
- Krankmeldungen und Fehlzeiten können Rückschlüsse auf die Gesundheit zulassen und verdienen besonderen Schutz.
- Die App lädt Schuldaten nur für die jeweils aufgerufenen Bereiche und Zeiträume.

Die DSGVO nimmt rein persönliche oder familiäre Tätigkeiten unter bestimmten Voraussetzungen aus ihrem Anwendungsbereich aus. Das ist kein pauschaler Freibrief. Spätestens bei öffentlichem Hosting, gemeinsamer Nutzung oder Verarbeitung für andere Personen kann diese Einordnung entfallen. Gesundheitsdaten unterliegen außerdem einem besonderen Schutz. Siehe [DSGVO, insbesondere Erwägungsgrund 18 und Art. 2](https://eur-lex.europa.eu/legal-content/DE/TXT/PDF/?uri=OJ%3AL%3A2016%3A119%3AFULL) sowie die [Hinweise der BfDI zu Gesundheitsdaten](https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DokumenteBfDI/Reden_Gastbeitr%C3%A4ge/2021/Datenschutz-Infektionsbekaempfung.pdf?__blob=publicationFile&v=3).

## Schonender Zugriff

Klarstunde darf nur mit einem Konto verwendet werden, für das die nutzende Person zugriffsberechtigt ist. Die automatische Prüfung ist bewusst begrenzt und ruft Tage nacheinander ab. Kürzere Intervalle, parallele Massenabrufe, das Sammeln fremder Klassen- oder Personendaten und der Aufbau eines eigenen Datenbestands sind nicht vorgesehen.

Auch wiederholte Entnahmen kleiner Teile einer Datenbank können rechtlich relevant werden, wenn sie einer normalen Nutzung zuwiderlaufen oder berechtigte Interessen beeinträchtigen. Siehe [§ 87b UrhG](https://www.gesetze-im-internet.de/urhg/__87b.html). Ob die Vorschrift im Einzelfall greift, wird hier nicht bewertet.

## Projekt prüfen

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Live-Zugangsdaten und unveränderte HTML-Seiten mit personenbezogenen Daten gehören nicht in Tests. Parser-Tests verwenden kleine, nachgebildete Ausschnitte.

## Projektstruktur

```text
src/
├── client/             React-Oberfläche
│   └── components/     zusammenhängende Ansichten
├── server/             lokaler Server und Sitzungen
│   ├── notifications/  optionale Telegram-Prüfung
│   └── vsp/            Adapter und HTML-Parser
└── shared/             gemeinsame Datentypen und Bezeichnungen
```

Der fremde HTML-Aufbau bleibt im Verzeichnis `server/vsp`. Änderungen am Originalportal sollen dadurch nicht über die gesamte Anwendung verteilt werden. Architekturdetails stehen in [`docs/CONCEPT.md`](docs/CONCEPT.md), der geprüfte Funktionsstand in [`docs/FUNCTIONS.md`](docs/FUNCTIONS.md).

## Lizenz und fremde Rechte

Der selbst geschriebene Klarstunde-Code steht unter der [MIT-Lizenz](LICENSE). Sie enthält einen Haftungs- und Gewährleistungsausschluss.

Die MIT-Lizenz erlaubt allerdings auch Weitergabe, Veränderung und kommerzielle Nutzung. „Für den privaten Gebrauch gedacht“ beschreibt daher den vorgesehenen und getesteten Einsatz, ist aber keine zusätzliche Lizenzbedingung. Eine Lizenz mit einem Verbot kommerzieller Nutzung wäre nach der [Open Source Definition](https://opensource.org/osd) keine Open-Source-Lizenz.

Die MIT-Lizenz erteilt keine Rechte an

- Namen, Marken oder Logos Dritter,
- Quellcode und Gestaltung des Originalportals,
- Schul- und Personendaten,
- Datenbanken, Texten oder Dateien des Quelldienstes,
- Zugängen oder technischen Schnittstellen Dritter.

## Rechtlicher Hinweis

Diese README beschreibt technische Vorsichtsmaßnahmen und die beabsichtigte Nutzung. Sie ist keine Rechtsberatung und kann weder Nutzungsbedingungen noch gesetzliche Pflichten oder eine notwendige Zustimmung ersetzen. Wer das Projekt veröffentlicht, für andere betreibt oder geschäftlich nutzt, sollte den konkreten Fall vorher mit dem Dienstbetreiber und fachkundiger rechtlicher Beratung klären.
