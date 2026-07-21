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
    const rawEntities = Array.isArray(config.entities) ? config.entities : [];
    this._config = {
      title: config.title || "",
      entities: rawEntities
        .map((e) => (typeof e === "string" ? { entity: e } : e))
        .filter((e) => e && e.entity), // ignore blank rows while editing in the GUI
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

  static getConfigElement() {
    return document.createElement("lutarym-calendar-card-editor");
  }
}

if (!customElements.get("lutarym-calendar-card")) {
  customElements.define("lutarym-calendar-card", LutarymCalendarCard);
}

/**
 * Visual (GUI) config editor — no YAML required.
 * Rebuilds the DOM once, then only re-assigns .hass on child pickers on
 * subsequent updates, so the entity-picker dropdowns stay usable and inputs
 * don't lose focus while typing.
 */
class LutarymCalendarCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._built = false;
  }

  setConfig(config) {
    const normalized = {
      title: config.title || "",
      entities: (config.entities || []).map((e) =>
        typeof e === "string" ? { entity: e, name: "", color: "" } : { name: "", color: "", ...e }
      ),
      days_ahead: config.days_ahead ?? 14,
      max_events: config.max_events ?? 30,
      show_past_today: config.show_past_today ?? false,
      refresh_seconds: config.refresh_seconds ?? 60,
      language: config.language || "",
    };

    // HA round-trips the config we just emitted back into setConfig(). If it's
    // unchanged from what we already have rendered, skip the rebuild — otherwise
    // every keystroke in a text field would tear down the DOM and steal focus.
    const unchanged =
      this._built && this._config && JSON.stringify(normalized) === JSON.stringify(this._config);

    this._config = normalized;
    if (this._built && !unchanged) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) {
      this._render();
      this._built = true;
    } else {
      // propagate to entity pickers without rebuilding the whole form
      this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((el) => {
        el.hass = hass;
      });
    }
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: JSON.parse(JSON.stringify(this._config)) },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    if (!this._config) return;

    const style = document.createElement("style");
    style.textContent = `
      .form { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
      .row { display: flex; gap: 8px; align-items: center; }
      .row-fields { display: flex; gap: 8px; }
      .row-fields > * { flex: 1; }
      .entity-row {
        display: flex;
        gap: 8px;
        align-items: center;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 8px;
      }
      .entity-row ha-entity-picker { flex: 2; }
      .entity-row .name-field { flex: 1; }
      .color-input {
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: none;
        cursor: pointer;
      }
      .remove-btn {
        cursor: pointer;
        background: none;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        color: var(--error-color, #db4437);
        width: 32px;
        height: 32px;
        font-size: 16px;
        line-height: 1;
      }
      .add-btn {
        cursor: pointer;
        background: none;
        border: 1px dashed var(--divider-color);
        border-radius: 8px;
        padding: 8px;
        color: var(--primary-color);
        font-size: 0.9em;
      }
      .section-label {
        font-size: 0.8em;
        font-weight: 600;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-top: 4px;
      }
      .switch-row { display: flex; align-items: center; justify-content: space-between; }
    `;

    const wrap = document.createElement("div");
    wrap.className = "form";

    // --- Title ---
    const titleField = document.createElement("ha-textfield");
    titleField.label = "Titel";
    titleField.value = this._config.title;
    titleField.style.width = "100%";
    titleField.addEventListener("input", (e) => {
      this._config.title = e.target.value;
      this._emitChange();
    });
    wrap.appendChild(titleField);

    // --- Entities ---
    const entLabel = document.createElement("div");
    entLabel.className = "section-label";
    entLabel.textContent = "Kalender";
    wrap.appendChild(entLabel);

    const entContainer = document.createElement("div");
    entContainer.style.display = "flex";
    entContainer.style.flexDirection = "column";
    entContainer.style.gap = "8px";
    wrap.appendChild(entContainer);

    this._config.entities.forEach((entCfg, idx) => {
      const row = document.createElement("div");
      row.className = "entity-row";

      const picker = document.createElement("ha-entity-picker");
      picker.hass = this._hass;
      picker.includeDomains = ["calendar"];
      picker.value = entCfg.entity || "";
      picker.label = "Kalender-Entity";
      picker.addEventListener("value-changed", (e) => {
        this._config.entities[idx].entity = e.detail.value;
        this._emitChange();
      });
      row.appendChild(picker);

      const nameField = document.createElement("ha-textfield");
      nameField.className = "name-field";
      nameField.label = "Label";
      nameField.value = entCfg.name || "";
      nameField.addEventListener("input", (e) => {
        this._config.entities[idx].name = e.target.value;
        this._emitChange();
      });
      row.appendChild(nameField);

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "color-input";
      colorInput.value = entCfg.color || "#4a90d9";
      colorInput.title = "Randfarbe";
      colorInput.addEventListener("input", (e) => {
        this._config.entities[idx].color = e.target.value;
        this._emitChange();
      });
      row.appendChild(colorInput);

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.title = "Entfernen";
      removeBtn.addEventListener("click", () => {
        this._config.entities.splice(idx, 1);
        this._render();
        this._emitChange();
      });
      row.appendChild(removeBtn);

      entContainer.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = "+ Kalender hinzufügen";
    addBtn.addEventListener("click", () => {
      this._config.entities.push({ entity: "", name: "", color: "#4a90d9" });
      this._render();
      this._emitChange();
    });
    wrap.appendChild(addBtn);

    // --- Numeric options ---
    const numLabel = document.createElement("div");
    numLabel.className = "section-label";
    numLabel.textContent = "Anzeige";
    wrap.appendChild(numLabel);

    const numRow = document.createElement("div");
    numRow.className = "row-fields";

    const daysField = document.createElement("ha-textfield");
    daysField.label = "Tage im Voraus";
    daysField.type = "number";
    daysField.value = this._config.days_ahead;
    daysField.addEventListener("input", (e) => {
      this._config.days_ahead = Number(e.target.value) || 14;
      this._emitChange();
    });
    numRow.appendChild(daysField);

    const maxField = document.createElement("ha-textfield");
    maxField.label = "Max. Termine";
    maxField.type = "number";
    maxField.value = this._config.max_events;
    maxField.addEventListener("input", (e) => {
      this._config.max_events = Number(e.target.value) || 30;
      this._emitChange();
    });
    numRow.appendChild(maxField);

    const refreshField = document.createElement("ha-textfield");
    refreshField.label = "Refresh (Sek.)";
    refreshField.type = "number";
    refreshField.value = this._config.refresh_seconds;
    refreshField.addEventListener("input", (e) => {
      this._config.refresh_seconds = Number(e.target.value) || 60;
      this._emitChange();
    });
    numRow.appendChild(refreshField);

    wrap.appendChild(numRow);

    // --- Show past today switch ---
    const switchRow = document.createElement("div");
    switchRow.className = "switch-row";
    const switchLabel = document.createElement("span");
    switchLabel.textContent = "Beendete Termine von heute anzeigen";
    switchRow.appendChild(switchLabel);
    const switchEl = document.createElement("ha-switch");
    switchEl.checked = this._config.show_past_today;
    switchEl.addEventListener("change", (e) => {
      this._config.show_past_today = e.target.checked;
      this._emitChange();
    });
    switchRow.appendChild(switchEl);
    wrap.appendChild(switchRow);

    this.shadowRoot.innerHTML = "";
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }
}

if (!customElements.get("lutarym-calendar-card-editor")) {
  customElements.define("lutarym-calendar-card-editor", LutarymCalendarCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "lutarym-calendar-card")) {
  window.customCards.push({
    type: "lutarym-calendar-card",
    name: "Lutarym Calendar Card",
    description: "Kompakte Agenda-Liste ohne Icon-Ballast, gruppiert nach Tag.",
    preview: false,
    documentationURL: "https://github.com/lutarym/lutarym-calendar-card",
  });
}

console.info(
  `%c LUTARYM-CALENDAR-CARD %c v${CARD_VERSION} `,
  "color: white; background: #4a90d9; font-weight: 700;",
  "color: #4a90d9; background: white; font-weight: 700;"
);
