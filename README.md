# Lutarym Calendar Card

Kompakte Agenda-Card für Home Assistant. Kein Icon-Ballast, keine verschenkten
Ränder — nur Datum, Uhrzeit, Termin, eine Zeile pro Event, nach Tag gruppiert.

Gedacht als Ersatz für die Standard-Calendar-Card und für Custom-Cards wie
Atomic Calendar Revive, die für einfache Anwendungsfälle unnötig viel Fläche
für Icons, Rahmen und Fortschrittsbalken verbrauchen.

## Installation über HACS

1. HACS → Frontend → Menü (⋮) → Benutzerdefinierte Repositories
2. Repository-URL eintragen, Kategorie **Lovelace**
3. „Lutarym Calendar Card" installieren
4. Bei Bedarf Browser-Cache leeren (Strg+Shift+R)

## Einrichtung über GUI

Karte hinzufügen → „Lutarym Calendar Card" auswählen → visueller Editor öffnet
sich automatisch. Kalender per Entity-Picker auswählen, optional Label und
Randfarbe je Kalender setzen, „+ Kalender hinzufügen" für weitere. Kein YAML
nötig — der Code-Editor (⋮ → YAML bearbeiten) bleibt trotzdem verfügbar.

## Konfiguration (YAML, optional)

```yaml
type: custom:lutarym-calendar-card
title: "Kalender"
entities:
  - entity: calendar.apple_kalender
    name: "Apple"
    color: "#4a90d9"
  - entity: calendar.arbeit
    name: "Arbeit"
    color: "#e67e22"
days_ahead: 14
max_events: 30
show_past_today: false
refresh_seconds: 60
```

| Option | Typ | Default | Beschreibung |
|---|---|---|---|
| `entities` | Liste | — (Pflicht) | `entity`, optional `name` (Label vor dem Termin) und `color` (Randfarbe) |
| `title` | String | — | Kartentitel, optional |
| `days_ahead` | Zahl | 14 | Wie viele Tage in die Zukunft angezeigt werden |
| `max_events` | Zahl | 30 | Maximale Anzahl angezeigter Termine |
| `show_past_today` | Bool | false | Bereits beendete Termine von heute trotzdem anzeigen |
| `refresh_seconds` | Zahl | 60 | Wie oft die Card die Entity-Daten neu abfragt |
| `language` | String | auto | `de` oder `en`, sonst automatisch aus HA-Spracheinstellung |

## Hinweis zum Datenfluss

Die Card liest Events über die Standard-HA-Calendar-API
(`/api/calendars/<entity>?start=...&end=...`), die von jeder Calendar-Integration
bedient wird — inkl. `lutarym_ics_calendar`. Wie aktuell die zugrunde liegenden
Daten sind, hängt vom Abrufintervall der jeweiligen Integration ab, nicht von
`refresh_seconds` dieser Card — die Card zeigt nur an, was HA bereits kennt.

## Lizenz

MIT
