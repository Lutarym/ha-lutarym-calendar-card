# Electricity Overview by Lutarym

Lovelace Custom Card for Home Assistant — yearly consumption from
meter-reading differences (Jan 1st to today), previous-year comparison,
electricity cost including base fee, optional linear year-end forecast.
The previous year's consumption is calculated automatically from the
entity statistics, but can also be overridden manually. The card and its
editor are fully bilingual (German/English), following `hass.language`
automatically.

## Installation via HACS

1. HACS → Frontend → **⋮** → Custom repositories
2. Enter this repository's URL, category **Dashboard**
3. Install "Strom-Übersicht by Lutarym"
4. Reload Home Assistant (clear browser cache if needed)

## Manual installation

Copy `lutarym-electricity-overview-card.js` to `config/www/`:

```yaml
resources:
  - url: /local/lutarym-electricity-overview-card.js
    type: module
```

## Usage

Add via **Edit Dashboard → Add Card → "Strom-Übersicht by Lutarym"** —
opens the visual configuration form directly. In the editor, the price
per kWh is entered in **cents** (German convention) and converted
internally to Euro.

```yaml
type: custom:lutarym-electricity-overview-card
energy_entity: sensor.house_energy         # REQUIRED
price_per_kwh: 0.32                         # REQUIRED (EUR/kWh; editor shows cents/kWh)
base_fee_yearly: 150                        # optional: yearly base fee (takes precedence over monthly)
base_fee_monthly: 12.5                      # optional: alternatively monthly
base_fee_mode: accrued                      # "accrued" = prorated by day (default) | "full"
currency: EUR                               # optional (default: EUR)
show_forecast: false                        # optional: year-end forecast
previous_year_kwh: 4200                     # optional: manual override for previous year
title: Electricity Overview                  # optional
```

## License

Private / personal use.
