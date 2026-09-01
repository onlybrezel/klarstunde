# AGENTS.md

Diese Regeln gelten für das gesamte Repository.

## Zweck und Grenzen

Klarstunde ist ein inoffizielles, privates Softwareexperiment für den lokalen Zugriff auf das eigene Schulkonto. Änderungen dürfen keine Verbindung, Freigabe oder Zusammenarbeit mit Schulen, Schulträgern, Telegram oder dem Betreiber von `virtueller-stundenplan.org` behaupten.

- Das Originalportal bleibt die verbindliche Quelle.
- Keine Funktion als „offiziell“, „garantiert“ oder „vollständig sicher“ bezeichnen.
- Keine öffentliche Plattform, Mehrbenutzerlösung oder kommerzielle Nutzung voraussetzen.
- Keine Logos, Texte, Stylesheets oder sonstigen geschützten Bestandteile des Quelldienstes übernehmen.
- Eine technische Kompatibilitätsangabe ist keine Erlaubnis zur Nutzung einer fremden Schnittstelle.

Die ausführliche Einordnung steht in `README.md` und `docs/CONCEPT.md`. Widersprüche zugunsten einer bequemeren Implementierung sind nicht zulässig.

## Technischer Rahmen

- Node.js 24, pnpm, TypeScript im Strict Mode
- React und Vite im Browser
- Express als lokaler Server
- Cheerio ausschließlich zum Parsen der fremden HTML-Antworten
- Vitest für kleine, deterministische Tests
- ESM; Server- und Shared-Imports verwenden in TypeScript die Endung `.js`

Keine neue Abhängigkeit hinzufügen, wenn die Aufgabe mit der Standardbibliothek oder dem vorhandenen Stack klar lösbar ist.

## Architektur

Die Schichten bleiben klein und eindeutig:

```text
src/client/                 Oberfläche und Browserzustand
src/server/index.ts         HTTP-Routen und schlanke Orchestrierung
src/server/vsp/             einziger Zugang zum Quelldienst
src/server/notifications/   Telegram und Stundenplanprüfung
src/shared/                 transportierbare Typen und reine Bezeichnungslogik
```

- Nur `src/server/vsp/` kennt URLs, Cookies und HTML-Aufbau des Quelldienstes.
- Die React-Oberfläche erhält normalisierte Daten und niemals HTML, `PHPSESSID` oder Zugangsdaten.
- Routen validieren Eingaben, delegieren die Arbeit und übersetzen Fehler in knappe Antworten.
- Reine Umwandlungen gehören in kleine Funktionen und werden direkt getestet.
- Keine Repository-, Service-, Factory- oder Interface-Schicht ohne einen aktuellen, konkreten Bedarf.
- Gemeinsame Abstraktionen erst einführen, wenn mindestens zwei echte Anwendungsfälle dieselbe Regel benötigen.

## Stundenplanregeln

Die Darstellung muss die Bedeutung des Originaleintrags erhalten.

- Die Stundennummer aus der ersten Tabellenspalte lesen; niemals aus dem Zeilenindex ableiten. Stunde `0` ist zulässig.
- Parallele Kurse derselben Stunde vollständig erhalten und anzeigen.
- Neue Werte, gestrichene Werte und Hinweise getrennt erfassen.
- `previous.subject`, `previous.teacher` und `previous.room` nicht verwerfen.
- Entfall, Vertretung, Raumwechsel und sonstige Änderungen unterscheidbar anzeigen.
- Der Status eines Leistungsnachweises ist nicht automatisch der Status des Unterrichts.
- Klassenarbeit, Klausur, Leistungsprobe und Test nur anhand des gelieferten Textes einordnen.
- Belegte Fach- und Raumkürzel dürfen über die lokale Installation lesbarer werden. Schulbezogene Zuordnungen gehören nicht als allgemeine Standardwerte in den Quellcode. Das Originalkürzel bleibt sichtbar oder technisch erhalten.
- Unbekannte Kürzel nicht erraten. Unverändert anzeigen und erst nach belegter Zuordnung ergänzen.
- Ferien und freie Tage nicht als normale Unterrichtsstunde mit künstlichen Lehrer- oder Raumangaben darstellen.

Parseränderungen brauchen mindestens einen Test mit einem kleinen nachgebildeten HTML-Ausschnitt für den betroffenen Fall.

## Externer Zugriff

- Nur mit einem Konto arbeiten, für das der Nutzer selbst zugriffsberechtigt ist.
- So wenig Seiten wie nötig abrufen; keine parallelen Massenabfragen.
- Live-Abfragen nur durchführen, wenn sie zur ausdrücklich gewünschten Prüfung nötig sind.
- Keine unveränderten Live-Seiten, Schülerdaten oder Antworten des Quelldienstes als Fixture speichern.
- Keine fremden Klassen- oder Personendaten sammeln.
- Schreibende Aktionen wie Krankmeldungen nur auf ausdrückliche Anforderung und nach sichtbarer Bestätigung auslösen.
- Parserfehler nicht durch erfundene Daten oder stilles Zurückfallen auf veraltete Werte verdecken.

Der Stundenplan-Watcher ruft Tage nacheinander ab. Das Mindestintervall bleibt bei fünf Minuten. Eine Benachrichtigung wird erst nach zwei gleichen aufeinanderfolgenden Änderungsständen versendet. Schutzmechanismen nicht zur Beschleunigung entfernen.

## Zugangsdaten und personenbezogene Daten

- Niemals Passwörter, Bot-Tokens, Chat-IDs, Cookies oder Sitzungs-IDs ausgeben, protokollieren oder committen.
- Secrets nur aus lokalen Umgebungsvariablen beziehungsweise `.env` lesen.
- Keine Secrets in Browser-Bundles, Fehlermeldungen, Screenshots, Testreports oder URLs des eigenen Dienstes übernehmen.
- `.env`, `.data/`, temporäre HTML-Dateien und persönliche Screenshots bleiben außerhalb von Git.
- Persistierte Dateien mit Schuldaten restriktiv anlegen; derzeit gilt Modus `0600`.
- Fehlzeiten, Krankmeldungen und mögliche Gesundheitsangaben besonders zurückhaltend behandeln.
- Telegram nur nach ausdrücklicher Aktivierung verwenden. In der Oberfläche klar nennen, welche Unterrichtsdaten übertragen werden.

Klarstunde bindet standardmäßig an `127.0.0.1`. Kein Wechsel auf `0.0.0.0`, keine Portfreigabe und kein öffentlicher Tunnel ohne ausdrücklichen Auftrag. Ein temporärer Tunnel benötigt HTTPS und einen zusätzlichen Zugangsschutz und wird nach dem Test wieder beendet.

## UI und Texte

Alle sichtbaren Texte sind knappes, normales Deutsch.

- Kein generischer KI-Ton, keine Werbesprache und keine Assistentenfloskeln.
- Keine technischen Rechtfertigungen im Sichttext.
- Keine erfundenen Erklärungen zu Funktionen des Originalportals.
- Wichtige Zustände zuerst: Fach, Änderung, Zeit, Lehrkraft, Raum, Prüfung.
- Originalkürzel visuell nachgeordnet darstellen, ausgeschriebene Bedeutung zuerst.
- Fehler sagen, was fehlgeschlagen ist und was der Nutzer als Nächstes tun kann.
- Keine Farbe als einziges Unterscheidungsmerkmal verwenden.
- Tastaturfokus, ausreichende Kontraste, verständliche Labels und mobile Nutzung erhalten.
- Vorhandene Abstände, Typografie, Farben und Komponenten weiterverwenden statt neue Stilwelten einzuführen.

Rechtliche Hinweise bleiben sachlich. Sie dürfen keine Sicherheit oder Haftungsfreiheit versprechen, die das Projekt nicht leisten kann.

## Tests und Abschlusskontrolle

Während der Entwicklung zuerst den kleinsten passenden Test ausführen. Vor Abschluss einer Codeänderung müssen diese Befehle erfolgreich sein:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Zusätzlich gilt:

- Parser: regulärer Eintrag, Stunde `0`, parallele Einträge und betroffene Änderungsform testen.
- Schreibende Route: Validierung und Fehlerfall berücksichtigen.
- Benachrichtigung: keine echten Telegram-Nachrichten aus automatischen Tests senden.
- UI-Änderung: Desktop- und Mobilbreite prüfen; persönliche Daten dürfen nicht in Screenshots verbleiben.
- Dokumentation anpassen, wenn sich Konfiguration, Datenschutzwirkung oder Betriebsweise ändert.

Ein erfolgreicher Build ersetzt keine fachliche Prüfung der Stundenplanbedeutung.

## Arbeitsweise

- Bestehenden Datenfluss vor dem Ändern vollständig lesen.
- Kleine, zusammenhängende Patches bevorzugen.
- Keine nebenbei vorgenommenen Großumbauten.
- Keine Fehler mit `any`, pauschalen `catch`-Blöcken oder deaktivierten Lint-Regeln verstecken.
- Keine generierten Dateien in `dist/` bearbeiten.
- Bestehende Nutzeränderungen nicht überschreiben oder zurücksetzen.
- Bei Unsicherheit über ein Kürzel oder Fremdverhalten den belegten Rohwert erhalten und die offene Frage dokumentieren.
