# Funktionsstand

Maßstab ist die öffentliche [Hilfeseite des Virtuellen Klassenbuchs](https://www.virtueller-stundenplan.org/page-21/). Dort wird ausdrücklich darauf hingewiesen, dass Schulen nicht jeden Bereich freischalten. Klarstunde kann deshalb nur anzeigen, was das angemeldete Konto tatsächlich erhält.

| Bereich | Stand in Klarstunde | Hinweise |
| --- | --- | --- |
| Eigener Stundenplan | umgesetzt | Tages- und Wochenansicht einschließlich Wochenende, Datumsauswahl, Unterrichtswochen-Navigation des Portals, kompakte und effektive Darstellung, Vergleich mit dem vollständigen Wochenplan der eigenen Klasse; Stunde `0`, parallele Kurse, Entfall, Vertretung, Raumwechsel, Hinweise und alte Werte |
| Leistungsnachweise | umgesetzt | Klassenarbeit, Klausur, Leistungsprobe oder Test werden nur nach dem gelieferten Text bezeichnet |
| Fehlzeiten und Ergebnisse | umgesetzt | Zeitraum, Zeugniszeitraum und Umschaltung auf reine Fehlzeiten |
| Klassenbuch und Hausaufgaben | umgesetzt | Zeitraum sowie angebotene Filter für Kurs, Fach, Raum, Lehrkraft, Wochentag und Stunde |
| Schul- und Klassennachrichten | umgesetzt | gemeinsame Nachrichtenansicht |
| Krankmeldung | Übermittlung implementiert; Erfolgsantwort nicht verifiziert | Zusammenfassung und Bestätigung vor dem Absenden; unklare Antworten werden ausdrücklich als unklar angezeigt. Schutz vor gleichzeitigem und erneutem Absenden desselben unklaren Zeitraums in der Sitzung. Keine schreibende Live-Prüfung. |
| Ausbildungsbetrieb informieren | teilweise | Nach erfolgreicher Krankmeldung kann das lokale Mailprogramm mit einem vorbereiteten Text geöffnet werden. Ein automatisch vom Quelldienst hinterlegter Empfänger war im Testkonto nicht verfügbar und wird nicht erraten. |
| Dateien | umgesetzt | Download über den lokalen Server; Bereichsfilter, wenn mehrere Bereiche angeboten werden |
| Stundenpläne anderer Klassen | umgesetzt | Klassenauswahl und Wochenwechsel |
| Blockpläne | umgesetzt | Schuljahrauswahl und PDF-Download, sofern angeboten |
| Digitaler Schülerausweis | umgesetzt | Kartenansicht mit gelieferten Identitätsfeldern und Foto, Status laut Originalportal, separater unveränderter Prüfcode; zusätzliche Nachweise und Schulanschrift aufklappbar. Demo mit gekennzeichneten Beispieldaten ohne scannbaren Nachweis. |
| Telegram-Hinweise | bestehender Klarstunde-Zusatz außerhalb der Navigation | optionale lokale Prüfung bleibt für bestehende Konfigurationen erhalten; Versand erst nach zwei gleichen aufeinanderfolgenden Änderungsständen |

## Bewusste Grenzen

- Die normale Anmeldung mit Schulkonto ist umgesetzt. Die alternative Office-365-Anmeldung des Originalportals ist nicht integriert, weil deren Anmeldung und Rückleitung nicht ohne eine eigene, abgestimmte OAuth-Integration übernommen werden kann.
- Nicht freigeschaltete Bereiche, leere Auswahlfelder und schulabhängige Bezeichnungen lassen sich nicht allgemein erzwingen.
- Klarstunde liest HTML-Antworten des Quelldienstes. Es gibt für dieses Projekt keine dokumentierte, stabile JSON-API. Änderungen am Originalportal können daher einzelne Funktionen beschädigen.
- Schreibende Live-Prüfungen werden nicht automatisiert ausgeführt. Eine Krankmeldung darf nur nach ausdrücklicher Bestätigung der angemeldeten Person gesendet werden.

Die Tabelle beschreibt den aktuellen Implementierungsstand, keine Zusage dauerhafter Vollständigkeit oder Kompatibilität.
