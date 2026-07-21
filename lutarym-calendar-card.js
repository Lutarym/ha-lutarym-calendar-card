/**
 * Lutarym Calendar Card
 * Compact agenda-style calendar card. No icon clutter, no wasted padding —
 * just date / time / summary, one line per event, grouped by day.
 *
 * Config:
 *   type: custom:lutarym-calendar-card
 *   title: "Kalender"                 // optional
 *   entities:                          // required, list of calendar.* entities
 *     - entity: calendar.apple_kalender
 *       name: "Apple"                  // optional label
 *       color: "#4a90d9"               // optional left-bar accent color
 *   days_ahead: 14                     // optional, default 14
 *   max_events: 30                     // optional, default 30
 *   show_past_today: false             // optional, default false (hide events already finished today)
 *   refresh_seconds: 60                // optional, default 60 (re-reads entity data, cheap)
 *   language: "de"                     // optional, "de" or "en", default auto from hass
 */

const CARD_VERSION = "1.0.0";

const I18N = {
  de: {
    no_events: "Keine Termine",
    today: "Heute",
    tomorrow: "Morgen",
    all_day: "ganztägig",
  },
  en: {
    no_events: "No events",
    today: "Today",
    tomorrow: "Tomorrow",
    all_day: "all day",
  },
};

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

class LutarymCalendarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._events = [];
    this._built = false;
    this._refreshTimer = null;
    this._lastFetchKey = null;
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error("lutarym-calendar-card: 'entities' muss eine nicht-leere Liste sein.");
    }
    this._config = {
      title: config.title || "",
      entities: config.entities.map((e) =>
        typeof e === "string" ? { entity: e } : e
      ),
      days_ahead: config.days_ahead ?? 14,
      max_events: config.max_events ?? 30,
      show_past_today: config.show_past_today ?? false,
      refresh_seconds: config.refresh_seconds ?? 60,
      language: config.language || null,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) {
      this._buildDOM();
      this._built = true;
      this._scheduleRefresh();
      this._fetchAndRender();
      return;
    }
    // Cheap check: only re-render header/labels if entity friendly names changed;
    // event data itself is refreshed on its own timer, not on every hass tick,
    // to avoid hammering the API on every state change in the system.
  }

  connectedCallback() {
    if (this._built) this._scheduleRefresh();
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  _scheduleRefresh() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    const seconds = Math.max(15, this._config.refresh_seconds);
    this._refreshTimer = setInterval(() => this._fetchAndRender(), seconds * 1000);
  }

  _lang() {
    if (this._config.language) return this._config.language;
    const lang = (this._hass && this._hass.language) || "de";
    return lang.startsWith("de") ? "de" : "en";
  }

  _t(key) {
    const lang = this._lang();
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key];
  }

  _buildDOM() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
      }
      .card {
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, none);
        border: 1px solid var(--ha-card-border-color, var(--divider-color, transparent));
        padding: 8px 0;
        font-family: var(--paper-font-body1_-_font-family, inherit);
        color: var(--primary-text-color);
      }
      .title {
        font-size: 1.05em;
        font-weight: 500;
        padding: 4px 16px 6px 16px;
      }
      .day-group {
        padding: 2px 0;
      }
      .day-label {
        font-size: 0.72em;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        padding: 6px 16px 2px 16px;
        letter-spacing: 0.03em;
      }
      .event-row {
        display: flex;
        align-items: baseline;
        padding: 3px 16px 3px 12px;
        border-left: 3px solid var(--lutarym-cal-color, var(--primary-color));
        margin: 0 8px 1px 0;
        line-height: 1.35;
        gap: 8px;
      }
      .event-row:hover {
        background: var(--secondary-background-color, rgba(0,0,0,0.03));
      }
      .event-time {
        flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
        font-size: 0.85em;
        color: var(--secondary-text-color);
        min-width: 38px;
      }
      .event-summary {
        flex: 1 1 auto;
        font-size: 0.9em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .empty {
        padding: 10px 16px;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }
    `;

    const container = document.createElement("div");
    container.className = "card";

    if (this._config.title) {
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = this._config.title;
      container.appendChild(title);
    }

    const list = document.createElement("div");
    list.className = "list";
    container.appendChild(list);
    this._listEl = list;

    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(container);
  }

  async _fetchAndRender() {
    if (!this._hass || !this._config) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + this._config.days_ahead * 86400000);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const fetchKey = `${startIso}|${endIso}|${this._config.entities.map((e) => e.entity).join(",")}`;
    this._lastFetchKey = fetchKey;

    let allEvents = [];
    try {
      const results = await Promise.all(
        this._config.entities.map((cfg) =>
          this._hass
            .callApi(
              "GET",
              `calendars/${cfg.entity}?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
            )
            .then((events) => (events || []).map((ev) => ({ ...ev, _cfg: cfg })))
            .catch(() => [])
        )
      );
      allEvents = results.flat();
    } catch (err) {
      // Silently degrade to empty list; a broken single card should not spam the log.
      allEvents = [];
    }

    if (fetchKey !== this._lastFetchKey) return; // a newer fetch superseded this one

    allEvents.sort((a, b) => this._eventStart(a) - this._eventStart(b));

    const now = new Date();
    if (!this._config.show_past_today) {
      allEvents = allEvents.filter((ev) => this._eventEnd(ev) >= now);
    }

    this._events = allEvents.slice(0, this._config.max_events);
    this._render();
  }

  _eventStart(ev) {
    const raw = ev.start.dateTime || ev.start.date;
    return new Date(raw);
  }

  _eventEnd(ev) {
    const raw = ev.end.dateTime || ev.end.date;
    return new Date(raw);
  }

  _isAllDay(ev) {
    return !ev.start.dateTime;
  }

  _dayLabel(date) {
    const lang = this._lang();
    const weekdays = lang === "de" ? WEEKDAYS_DE : WEEKDAYS_EN;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) return this._t("today");
    if (d.getTime() === tomorrow.getTime()) return this._t("tomorrow");

    const wd = weekdays[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${wd} ${dd}.${mm}.`;
  }

  _render() {
    if (!this._listEl) return;
    this._listEl.innerHTML = "";

    if (this._events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = this._t("no_events");
      this._listEl.appendChild(empty);
      return;
    }

    let currentDayKey = null;
    let groupEl = null;

    for (const ev of this._events) {
      const start = this._eventStart(ev);
      const dayKey = start.toDateString();

      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        const dayLabel = document.createElement("div");
        dayLabel.className = "day-label";
        dayLabel.textContent = this._dayLabel(start);
        this._listEl.appendChild(dayLabel);

        groupEl = document.createElement("div");
        groupEl.className = "day-group";
        this._listEl.appendChild(groupEl);
      }

      const row = document.createElement("div");
      row.className = "event-row";
      const color = ev._cfg && ev._cfg.color;
      if (color) row.style.setProperty("--lutarym-cal-color", color);

      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = this._isAllDay(ev)
        ? this._t("all_day")
        : start.toLocaleTimeString(this._lang() === "de" ? "de-DE" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
      row.appendChild(time);

      const summary = document.createElement("span");
      summary.className = "event-summary";
      const label = ev._cfg && ev._cfg.name ? `${ev._cfg.name}: ` : "";
      summary.textContent = `${label}${ev.summary || ""}`;
      row.appendChild(summary);

      groupEl.appendChild(row);
    }
  }

  getCardSize() {
    return Math.max(2, Math.ceil((this._events.length || 3) / 3) + 1);
  }

  static getStubConfig() {
    return {
      entities: [{ entity: "calendar.apple_kalender" }],
      days_ahead: 14,
      max_events: 30,
    };
  }
}

customElements.define("lutarym-calendar-card", LutarymCalendarCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lutarym-calendar-card",
  name: "Lutarym Calendar Card",
  description: "Kompakte Agenda-Liste ohne Icon-Ballast, gruppiert nach Tag.",
  preview: false,
  documentationURL: "https://github.com/lutarym/lutarym-calendar-card",
});

console.info(
  `%c LUTARYM-CALENDAR-CARD %c v${CARD_VERSION} `,
  "color: white; background: #4a90d9; font-weight: 700;",
  "color: #4a90d9; background: white; font-weight: 700;"
);
