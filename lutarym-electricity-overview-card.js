/**
 * lutarym-electricity-overview-card.js
 * Lovelace Custom Card for Home Assistant — yearly electricity overview
 *
 * Logic: meter reading(today) - meter reading(Jan 1st) = yearly consumption.
 *        If there is no reading on Jan 1st (e.g. sensor added later), 0 is
 *        assumed as the starting value, i.e. the first known reading is
 *        also the consumption since installation.
 *
 * INSTALLATION
 *   1. Copy the file to /config/www/lutarym-electricity-overview-card.js
 *   2. Settings > Dashboards > Resources > Add resource:
 *        URL:  /local/lutarym-electricity-overview-card.js
 *        Type: JavaScript Module
 *   3. Clear your browser cache (Ctrl+F5)
 *
 * CONFIGURATION
 *   type: custom:lutarym-electricity-overview-card
 *   energy_entity: sensor.house_energy         # REQUIRED
 *   price_per_kwh: 0.32                         # REQUIRED (EUR/kWh; visual editor accepts cents/kWh)
 *   base_fee_yearly: 150                        # optional: yearly base fee (currency units)
 *   base_fee_monthly: 12.5                      # optional: alternatively monthly
 *   base_fee_mode: accrued                      # "accrued" = prorated by day (default)
 *                                               # "full"    = full yearly base fee
 *   currency: EUR                               # optional (default: EUR)
 *   show_forecast: false                        # optional: linear year-end forecast
 *   previous_year_kwh: 4200                     # optional: manual override for previous year
 *   title: Electricity Overview                  # optional
 */

// ── Simple i18n helper (falls back to English) ─────────────────────────

const I18N = {
  en: {
    defaultTitle: 'Electricity Overview',
    noStatsYet: 'No statistics data available yet.',
    wsError: 'WebSocket error: {msg}',
    loadingData: 'Loading data',
    costLabel: 'Electricity cost {year} so far',
    energyLabel: 'Energy ({kwh} kWh × {price} {currency})',
    baseFeeYear: 'Base fee (year)',
    baseFeeAccrued: 'Base fee (prorated)',
    consumptionLabel: 'Consumption {year}',
    partialYearNote: 'Sensor not present since Jan 1st, consumption since installation.',
    previousYearLabel: 'Previous year {year}',
    less: 'less',
    more: 'more',
    noDataForYear: 'No data for {year}',
    forecastLabel: 'Year-end forecast (linear)',
    editorTitleLabel: 'Title',
    editorEnergyEntity: 'Energy entity (required)',
    editorPrice: 'Price per kWh (required)',
    editorPriceHint: 'Enter in cents per kWh (ct/kWh) — stored internally in Euro.',
    editorBaseFeeYearly: 'Yearly base fee',
    editorBaseFeeMonthly: 'Monthly base fee (alternative)',
    editorBaseFeeHint: 'Fill in only one of the two — yearly takes precedence if both are set.',
    editorBaseFeeMode: 'Base fee mode',
    modeAccrued: 'Prorated by day',
    modeFull: 'Full yearly fee',
    editorCurrency: 'Currency',
    editorPreviousYear: 'Manual previous-year value (kWh)',
    editorPreviousYearHint: 'The previous year\u2019s consumption is calculated automatically from the entity statistics (Jan 1\u2013Dec 31 of the previous year), as long as data is available for that period. Leave empty for automatic calculation — only override manually if historical data is missing or incomplete.',
    editorShowForecast: 'Show year-end forecast',
    cardName: 'Electricity Overview by Lutarym',
    cardDescription: 'Yearly consumption from meter-reading differences, previous-year comparison, cost including base fee.',
    energyEntityMissing: '"energy_entity" is required.',
    priceMissing: '"price_per_kwh" is required.',
  },
  de: {
    defaultTitle: 'Stromübersicht',
    noStatsYet: 'Noch keine Statistikdaten vorhanden.',
    wsError: 'WebSocket-Fehler: {msg}',
    loadingData: 'Lade Daten',
    costLabel: 'Stromkosten {year} bisher',
    energyLabel: 'Energie ({kwh} kWh × {price} {currency})',
    baseFeeYear: 'Grundgebühr (Jahr)',
    baseFeeAccrued: 'Grundgebühr (anteilig)',
    consumptionLabel: 'Verbrauch {year}',
    partialYearNote: 'Sensor nicht seit 1.1. vorhanden, Verbrauch ab Einbau.',
    previousYearLabel: 'Vorjahr {year}',
    less: 'weniger',
    more: 'mehr',
    noDataForYear: 'Keine Daten für {year}',
    forecastLabel: 'Prognose Jahresende (linear)',
    editorTitleLabel: 'Titel',
    editorEnergyEntity: 'Energie-Entity (Pflicht)',
    editorPrice: 'Preis pro kWh (Pflicht)',
    editorPriceHint: 'Eingabe in Cent pro kWh (ct/kWh) — wird intern in Euro gespeichert.',
    editorBaseFeeYearly: 'Grundgebühr jährlich',
    editorBaseFeeMonthly: 'Grundgebühr monatlich (Alternative)',
    editorBaseFeeHint: 'Nur eines von beidem ausfüllen — jährlich hat Vorrang, falls beide gesetzt sind.',
    editorBaseFeeMode: 'Grundgebühr-Modus',
    modeAccrued: 'Tagesanteilig',
    modeFull: 'Volle Jahresgebühr',
    editorCurrency: 'Währung',
    editorPreviousYear: 'Manueller Vorjahreswert (kWh)',
    editorPreviousYearHint: 'Der Vorjahresverbrauch wird automatisch aus der Entity-Statistik berechnet (1.1.–31.12. Vorjahr), sofern für den Zeitraum Daten vorhanden sind. Leer lassen für automatische Berechnung — nur bei fehlenden/unvollständigen historischen Daten manuell überschreiben.',
    editorShowForecast: 'Hochrechnung Jahresende anzeigen',
    cardName: 'Strom-Übersicht by Lutarym',
    cardDescription: 'Jahresverbrauch per Zählerstand-Differenz, Vorjahresvergleich, Kosten inkl. Grundgebühr.',
    energyEntityMissing: 'Pflichtfeld "energy_entity" fehlt.',
    priceMissing: 'Pflichtfeld "price_per_kwh" fehlt.',
  },
};

function lutarymLang(hass) {
  const raw = (hass && hass.language) || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en';
  return raw.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function t(hass, key, vars) {
  const dict = I18N[lutarymLang(hass)] || I18N.en;
  let str = dict[key] ?? I18N.en[key] ?? key;
  if (vars) Object.keys(vars).forEach(k => { str = str.replace(`{${k}}`, vars[k]); });
  return str;
}

// ── Main card ────────────────────────────────────────────────────────────

class LutarymElectricityOverviewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass    = null;
    this._config  = null;
    this._el      = null;
    this._data    = null;
    this._loading = false;
    this._interval = null;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) this._load();
    else this._render();
  }

  setConfig(config) {
    if (!config || !config.energy_entity)
      throw new Error(t(this._hass, 'energyEntityMissing'));
    if (config.price_per_kwh === undefined || config.price_per_kwh === null)
      throw new Error(t(this._hass, 'priceMissing'));
    this._config = config;
    this._data   = null;
    this._build();
    this._render();
    if (this._hass) this._load();
  }

  getCardSize() { return 4; }

  static getConfigElement() {
    return document.createElement('lutarym-electricity-overview-card-editor');
  }

  connectedCallback() {
    if (this._hass && this._config && !this._data) this._load();
    this._interval = window.setInterval(() => this._load(), 15 * 60 * 1000);
  }

  disconnectedCallback() {
    if (this._interval) { window.clearInterval(this._interval); this._interval = null; }
  }

  // ---- Load data ----------------------------------------------------

  async _load() {
    if (!this._hass || !this._config) return;
    if (this._loading) return;
    this._loading = true;

    const entity  = this._config.energy_entity;
    const now     = new Date();
    const year    = now.getFullYear();

    // Year boundaries
    const jan1Cur  = new Date(year,     0, 1, 0, 0, 0, 0);  // Jan 1st this year
    const jan1Prev = new Date(year - 1, 0, 1, 0, 0, 0, 0);  // Jan 1st previous year
    const jan1Next = new Date(year + 1, 0, 1, 0, 0, 0, 0);  // Jan 1st next year (end of previous-year window)

    try {
      // Load one large block: full previous year + current year up to now.
      // Period "day" returns the sum reading at the end of each day.
      const result = await this._hass.callWS({
        type:          'recorder/statistics_during_period',
        start_time:    jan1Prev.toISOString(),
        end_time:      now.toISOString(),
        statistic_ids: [entity],
        period:        'day',
        types:         ['sum'],
      });

      const points = (result && result[entity]) ? result[entity] : [];

      // Helper: find the next sum value from a given point in time onward.
      // Returns { sum, t } of the earliest point >= t, or null.
      const firstSumFrom = (t) => {
        let best = null;
        for (const p of points) {
          if (typeof p.sum !== 'number') continue;
          const pt = new Date(p.start).getTime();
          if (pt >= t && (best === null || pt < best.t)) best = { sum: p.sum, t: pt };
        }
        return best;
      };

      // Find the last sum value at or before a given point in time
      // (INCLUSIVE - used for "now", where landing exactly on the boundary
      // point itself is fine/expected).
      const lastSumBefore = (t) => {
        let best = null;
        for (const p of points) {
          if (typeof p.sum !== 'number') continue;
          const pt = new Date(p.start).getTime();
          if (pt <= t && (best === null || pt > best.t)) best = { sum: p.sum, t: pt };
        }
        return best;
      };

      // Same, but STRICTLY before t (excludes a bucket whose start equals t
      // exactly). Needed for year-boundary lookups: a day-bucket starting
      // exactly at Jan 1st 00:00 is Jan 1st's OWN consumption, not "the
      // value as of the end of the previous year" - using the inclusive
      // version here would silently subtract part of Jan 1st's usage from
      // the year total (the bug that produced a too-low reading here).
      const lastSumStrictlyBefore = (t) => lastSumBefore(t - 1);

      // Current meter reading = last known point
      const latestPoint = lastSumBefore(now.getTime());
      if (!latestPoint) {
        this._data = { error: t(this._hass, 'noStatsYet') };
        return;
      }
      const sumNow = latestPoint.sum;

      // Meter reading on Jan 1st of this year: last point STRICTLY before
      // jan1Cur. If none exists (sensor installed after Jan 1st), starting
      // value = 0.
      const startCurPoint = lastSumStrictlyBefore(jan1Cur.getTime());
      const sumStartCur   = startCurPoint ? startCurPoint.sum : 0;

      const current = sumNow - sumStartCur;

      // Previous year: meter readings STRICTLY before Jan 1st previous year
      // and STRICTLY before Jan 1st this year.
      // If no point exists before Jan 1st previous year (sensor not yet present), previous = null.
      const startPrevPoint = lastSumStrictlyBefore(jan1Prev.getTime());
      const endPrevPoint   = lastSumStrictlyBefore(jan1Cur.getTime());
      let previous = null;
      if (startPrevPoint && endPrevPoint && endPrevPoint.sum > startPrevPoint.sum) {
        previous = endPrevPoint.sum - startPrevPoint.sum;
      }

      // A manual previous-year value from config takes precedence
      const manualPrev = (this._config.previous_year_kwh != null)
        ? Number(this._config.previous_year_kwh) : null;

      this._data = { current: Math.max(0, current), previous: manualPrev ?? previous };

    } catch (e) {
      this._data = { error: t(this._hass, 'wsError', { msg: e.message }) };
    } finally {
      this._loading = false;
      this._render();
    }
  }

  // ---- Helper calculations ---------------------------------------------------

  _yearFraction() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end   = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    return (now - start) / (end - start);
  }

  _fmt(v, minD, maxD) {
    return Number(v).toLocaleString(undefined, {
      minimumFractionDigits: minD,
      maximumFractionDigits: maxD ?? minD,
    });
  }

  // ---- Build DOM ---------------------------------------------------

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px 18px; box-sizing: border-box; }
        .title {
          font-size: .95rem; font-weight: 500; letter-spacing: .03em;
          text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 14px;
        }
        .hero-value {
          font-size: 2.4rem; font-weight: 600; line-height: 1.05;
          color: var(--primary-text-color); font-variant-numeric: tabular-nums;
        }
        .hero-label { font-size: .8rem; color: var(--secondary-text-color); margin-top: 3px; }
        .breakdown  { margin-top: 14px; }
        .row {
          display: flex; justify-content: space-between; align-items: baseline;
          gap: 12px; padding: 3px 0; font-size: .9rem;
        }
        .row .label { color: var(--secondary-text-color); }
        .row .value { color: var(--primary-text-color); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .divider { height: 1px; background: var(--divider-color, rgba(128,128,128,.2)); margin: 14px 0; }
        .consumption-block { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
        .col.right { text-align: right; }
        .sub-label  { font-size: .75rem; color: var(--secondary-text-color); margin-bottom: 2px; }
        .cons-value { font-size: 1.55rem; font-weight: 600; color: var(--primary-text-color); font-variant-numeric: tabular-nums; line-height: 1.1; }
        .cons-value.secondary { font-size: 1.05rem; font-weight: 500; color: var(--secondary-text-color); }
        .compare-row { margin-top: 8px; }
        .compare { font-size: .9rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .compare.down { color: var(--success-color, #2e7d32); }
        .compare.up   { color: var(--error-color, #c62828); }
        .note { font-size: .75rem; color: var(--secondary-text-color); margin-top: 6px; font-style: italic; }
        .forecast-row {
          display: flex; justify-content: space-between; align-items: baseline;
          gap: 12px; margin-top: 12px; padding-top: 12px;
          border-top: 1px solid var(--divider-color, rgba(128,128,128,.2)); font-size: .85rem;
        }
        .forecast-row .label { color: var(--secondary-text-color); }
        .forecast-row .value { color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
      </style>
      <ha-card>
        <div class="title"      id="title"></div>
        <div class="hero-value" id="cost-total"></div>
        <div class="hero-label" id="cost-label"></div>
        <div class="breakdown">
          <div class="row">
            <span class="label" id="energy-label"></span>
            <span class="value" id="cost-energy"></span>
          </div>
          <div class="row" id="row-base">
            <span class="label" id="base-label"></span>
            <span class="value" id="cost-base"></span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="consumption-block">
          <div class="col">
            <div class="sub-label"  id="cons-label"></div>
            <div class="cons-value" id="cons-current"></div>
          </div>
          <div class="col right" id="prev-wrap">
            <div class="sub-label"           id="prev-label"></div>
            <div class="cons-value secondary" id="cons-prev"></div>
          </div>
        </div>
        <div class="compare-row" id="row-compare">
          <span class="compare" id="compare"></span>
        </div>
        <div class="note" id="note-partial"></div>
        <div class="forecast-row" id="row-forecast">
          <span class="label" id="forecast-label"></span>
          <span class="value" id="forecast"></span>
        </div>
      </ha-card>`;

    const $ = id => this.shadowRoot.getElementById(id);
    this._el = {
      title: $('title'), costTotal: $('cost-total'), costLabel: $('cost-label'),
      energyLabel: $('energy-label'), costEnergy: $('cost-energy'),
      rowBase: $('row-base'), baseLabel: $('base-label'), costBase: $('cost-base'),
      consLabel: $('cons-label'), consCurrent: $('cons-current'),
      prevWrap: $('prev-wrap'), prevLabel: $('prev-label'), consPrev: $('cons-prev'),
      rowCompare: $('row-compare'), compare: $('compare'),
      notePartial: $('note-partial'),
      rowForecast: $('row-forecast'), forecastLabel: $('forecast-label'), forecast: $('forecast'),
    };
  }

  // ---- Render --------------------------------------------------------

  _render() {
    if (!this._el || !this._config) return;
    const el       = this._el;
    const cfg      = this._config;
    const hass     = this._hass;
    const data     = this._data;
    const currency = cfg.currency || 'EUR';
    const year     = new Date().getFullYear();

    el.title.textContent = cfg.title || t(hass, 'defaultTitle');

    if (!data) {
      el.costTotal.textContent    = '…';
      el.costLabel.textContent    = t(hass, 'loadingData');
      el.costEnergy.textContent   = '';
      el.rowBase.style.display    = 'none';
      el.consCurrent.textContent  = '…';
      el.prevWrap.style.display   = 'none';
      el.rowCompare.style.display = 'none';
      el.notePartial.textContent  = '';
      el.rowForecast.style.display = 'none';
      return;
    }
    if (data.error) {
      el.costTotal.textContent    = '!';
      el.costLabel.textContent    = data.error;
      el.costEnergy.textContent   = '';
      el.rowBase.style.display    = 'none';
      el.consCurrent.textContent  = '';
      el.prevWrap.style.display   = 'none';
      el.rowCompare.style.display = 'none';
      el.notePartial.textContent  = '';
      el.rowForecast.style.display = 'none';
      return;
    }

    const { current, previous, partialYear } = data;
    const price    = Number(cfg.price_per_kwh);
    const fraction = this._yearFraction();

    let baseFeeYearly = 0;
    if      (cfg.base_fee_yearly  != null) baseFeeYearly = Number(cfg.base_fee_yearly);
    else if (cfg.base_fee_monthly != null) baseFeeYearly = Number(cfg.base_fee_monthly) * 12;
    const baseFee = (cfg.base_fee_mode === 'full') ? baseFeeYearly : baseFeeYearly * fraction;

    const energyCost = current * price;
    const totalCost  = energyCost + baseFee;

    el.costTotal.textContent  = this._fmt(totalCost, 2) + ' ' + currency;
    el.costLabel.textContent  = t(hass, 'costLabel', { year });

    el.energyLabel.textContent = t(hass, 'energyLabel', {
      kwh: this._fmt(current, 0, 1),
      price: this._fmt(price, 2, 4),
      currency,
    });
    el.costEnergy.textContent = this._fmt(energyCost, 2) + ' ' + currency;

    if (baseFeeYearly > 0) {
      el.rowBase.style.display = '';
      el.baseLabel.textContent = (cfg.base_fee_mode === 'full') ? t(hass, 'baseFeeYear') : t(hass, 'baseFeeAccrued');
      el.costBase.textContent  = this._fmt(baseFee, 2) + ' ' + currency;
    } else {
      el.rowBase.style.display = 'none';
    }

    el.consLabel.textContent   = t(hass, 'consumptionLabel', { year });
    el.consCurrent.textContent = this._fmt(current, 0, 1) + ' kWh';

    // Note when the sensor was only added during the year
    el.notePartial.textContent = partialYear ? t(hass, 'partialYearNote') : '';

    el.prevWrap.style.display = '';
    el.prevLabel.textContent  = t(hass, 'previousYearLabel', { year: year - 1 });
    if (previous !== null && previous > 0) {
      el.consPrev.textContent     = this._fmt(previous, 0, 1) + ' kWh';
      const diff = current - previous;
      const pct  = (diff / previous) * 100;
      const less = diff < 0;
      el.compare.className   = 'compare ' + (less ? 'down' : 'up');
      el.compare.textContent = (less ? '▼' : '▲') + ' '
        + this._fmt(Math.abs(pct), 1) + ' % ' + (less ? t(hass, 'less') : t(hass, 'more'))
        + ' (' + this._fmt(Math.abs(diff), 0, 1) + ' kWh)';
      el.rowCompare.style.display = '';
    } else {
      el.consPrev.textContent     = '–';
      el.compare.className        = 'compare';
      el.compare.textContent      = t(hass, 'noDataForYear', { year: year - 1 });
      el.rowCompare.style.display = '';
    }

    el.forecastLabel.textContent = t(hass, 'forecastLabel');
    if (cfg.show_forecast && fraction > 0) {
      el.forecast.textContent      = this._fmt(current / fraction, 0, 1) + ' kWh';
      el.rowForecast.style.display = '';
    } else {
      el.rowForecast.style.display = 'none';
    }
  }
}

LutarymElectricityOverviewCard.getStubConfig = () => ({
  title: 'Electricity Overview',
  energy_entity: 'sensor.house_energy',
  price_per_kwh: 0.32,
  base_fee_yearly: 150,
});

// ── Visual config editor ────────────────────────────────────────────────

class LutarymElectricityOverviewCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll('ha-selector').forEach(sel => { sel.hass = hass; });
  }

  _fireChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _onChange(field, value, isNumber) {
    if (value === '' || value == null) {
      delete this._config[field];
    } else {
      this._config[field] = isNumber ? Number(value) : value;
    }
    this._fireChanged();
  }

  _textRow(label, field, value, placeholder) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const l = document.createElement('label');
    l.textContent = label;
    wrap.appendChild(l);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value ?? '';
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('change', ev => this._onChange(field, ev.target.value));
    wrap.appendChild(input);
    return wrap;
  }

  _numberRow(label, field, value, placeholder, step) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const l = document.createElement('label');
    l.textContent = label;
    wrap.appendChild(l);
    const input = document.createElement('input');
    input.type = 'number';
    if (step) input.step = step;
    if (value != null) input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('change', ev => this._onChange(field, ev.target.value, true));
    wrap.appendChild(input);
    return wrap;
  }

  _entityRow(label, field, value) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const l = document.createElement('label');
    l.textContent = label;
    wrap.appendChild(l);
    const selector = document.createElement('ha-selector');
    selector.hass = this._hass;
    selector.selector = { entity: {} };
    selector.value = value ?? '';
    selector.addEventListener('value-changed', ev => {
      ev.stopPropagation();
      this._onChange(field, ev.detail.value);
    });
    wrap.appendChild(selector);
    return wrap;
  }

  _selectRow(label, field, value, options) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    const l = document.createElement('label');
    l.textContent = label;
    wrap.appendChild(l);
    const select = document.createElement('select');
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', ev => this._onChange(field, ev.target.value));
    wrap.appendChild(select);
    return wrap;
  }

  _checkboxRow(label, field, value) {
    const wrap = document.createElement('div');
    wrap.className = 'row checkbox-row';
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!value;
    input.addEventListener('change', ev => this._onChange(field, ev.target.checked ? true : null));
    wrap.appendChild(input);
    wrap.appendChild(l);
    return wrap;
  }

  _priceRow(label, field, valueEuro, placeholderCt, hintText) {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    if (valueEuro != null && valueEuro !== '') {
      input.value = +(Number(valueEuro) * 100).toFixed(4); // Euro -> cents for display
    }
    if (placeholderCt) input.placeholder = placeholderCt;
    input.addEventListener('change', ev => {
      const ct = ev.target.value;
      if (ct === '') {
        delete this._config[field];
      } else {
        this._config[field] = Number(ct) / 100; // cents -> Euro for storage
      }
      this._fireChanged();
    });
    wrap.appendChild(input);
    if (hintText) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = hintText;
      wrap.appendChild(hint);
    }
    return wrap;
  }

  _render() {
    if (!this._config) return;
    const cfg = this._config;
    const hass = this._hass;

    this.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
        .row { display: flex; flex-direction: column; gap: 4px; }
        .row label { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        .row input[type="text"], .row input[type="number"], .row select {
          padding: 8px 10px; border: 1px solid var(--divider-color, #ccc);
          border-radius: 6px; background: var(--card-background-color, #fff);
          color: var(--primary-text-color); font-size: 14px; box-sizing: border-box;
        }
        .checkbox-row { flex-direction: row; align-items: center; gap: 8px; }
        .checkbox-row label { font-weight: 400; }
        .hint { font-size: 11px; color: var(--secondary-text-color); margin-top: -8px; }
      </style>
      <div class="form"></div>
    `;
    const form = this.querySelector('.form');

    form.appendChild(this._textRow(t(hass, 'editorTitleLabel'), 'title', cfg.title, t(hass, 'defaultTitle')));
    form.appendChild(this._entityRow(t(hass, 'editorEnergyEntity'), 'energy_entity', cfg.energy_entity));
    form.appendChild(this._priceRow(t(hass, 'editorPrice'), 'price_per_kwh', cfg.price_per_kwh, '32.50', t(hass, 'editorPriceHint')));
    form.appendChild(this._numberRow(t(hass, 'editorBaseFeeYearly'), 'base_fee_yearly', cfg.base_fee_yearly, 'e.g. 150', '0.01'));
    form.appendChild(this._numberRow(t(hass, 'editorBaseFeeMonthly'), 'base_fee_monthly', cfg.base_fee_monthly, 'e.g. 12.50', '0.01'));
    {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = t(hass, 'editorBaseFeeHint');
      form.appendChild(hint);
    }
    form.appendChild(this._selectRow(t(hass, 'editorBaseFeeMode'), 'base_fee_mode', cfg.base_fee_mode || 'accrued', [
      { value: 'accrued', label: t(hass, 'modeAccrued') },
      { value: 'full', label: t(hass, 'modeFull') },
    ]));
    form.appendChild(this._textRow(t(hass, 'editorCurrency'), 'currency', cfg.currency, 'EUR'));
    form.appendChild(this._numberRow(t(hass, 'editorPreviousYear'), 'previous_year_kwh', cfg.previous_year_kwh, 'optional'));
    {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = t(hass, 'editorPreviousYearHint');
      form.appendChild(hint);
    }
    form.appendChild(this._checkboxRow(t(hass, 'editorShowForecast'), 'show_forecast', cfg.show_forecast));
  }
}

customElements.define('lutarym-electricity-overview-card-editor', LutarymElectricityOverviewCardEditor);

customElements.define('lutarym-electricity-overview-card', LutarymElectricityOverviewCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'lutarym-electricity-overview-card',
  name: 'Electricity Overview by Lutarym',
  description: 'Yearly consumption from meter-reading differences, previous-year comparison, cost including base fee.',
});
