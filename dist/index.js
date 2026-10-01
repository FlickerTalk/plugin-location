// Location for FlickerTalk (approved 2026-10-02): where the user is, once, as a message. The
// plugin asks the core for one position (`ft.location()`), writes it as an RFC 5870 geo URI and
// puts it in the composer (`ft.say`); the user is the one who sends it. No map, no tiles, no
// geocoding, no network at all, and nothing kept: the frame forgets the position when it closes.

import { t } from "./i18n.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** A coordinate to five decimals (about a metre), without the `-0.00000` that rounding leaves. */
function degrees(value) {
  const fixed = value.toFixed(5);
  return /^-0\.0+$/.test(fixed) ? fixed.slice(1) : fixed;
}

/**
 * The position as an RFC 5870 geo URI: `geo:<lat>,<lon>;u=<metres>`. The uncertainty is rounded
 * up, so the message never claims to be more precise than the phone was, and left out when the
 * phone gave none. Null for anything that is not a place on Earth.
 */
export function geoUri(fix) {
  if (!fix || !finite(fix.lat) || !finite(fix.lon)) return null;
  if (Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) return null;
  const uri = `geo:${degrees(fix.lat)},${degrees(fix.lon)}`;
  return finite(fix.accuracy) && fix.accuracy >= 0 ? `${uri};u=${Math.ceil(fix.accuracy)}` : uri;
}

/** The accuracy as the screen shows it: `±20 m`, rounded up like the URI; empty if unknown. */
export function accuracyLabel(accuracy) {
  return finite(accuracy) && accuracy >= 0 ? `±${Math.ceil(accuracy)} m` : "";
}

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (one) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[one]);

const STYLE = `
:host { display: block; font: 15px system-ui, sans-serif; color: #111; --soft: #666; --accent: #e0562b; }
@media (prefers-color-scheme: dark) { :host { color: #f4f4f4; --soft: #aaa; } }
:host([dark]) { color: #f4f4f4; --soft: #aaa; }
* { box-sizing: border-box; }
.bar { display: flex; justify-content: flex-end; padding: 4px 0 10px; }
button {
  appearance: none; border: 1px solid currentColor; background: transparent; color: inherit;
  border-radius: 10px; min-width: 44px; height: 40px; font: inherit; padding: 0 10px; cursor: pointer; opacity: .8;
}
button:disabled { cursor: default; opacity: .5; }
.main { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 16px 0 24px; text-align: center; }
button.big {
  width: 100%; max-width: 360px; height: auto; min-height: 96px; border-radius: 18px; opacity: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 17px; font-weight: 600;
  box-shadow: inset 0 0 0 2px currentColor;
}
.pin { font-size: 36px; line-height: 1; }
.spinner {
  width: 28px; height: 28px; border-radius: 50%; border: 3px solid currentColor; border-top-color: transparent;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
.status { min-height: 1.4em; margin: 0; }
.status.warn { color: var(--accent); }
.accuracy { font-size: 22px; font-weight: 600; }
.hint { color: var(--soft); font-size: 13px; margin: 0; max-width: 360px; }
.i {
  display: block; width: 22px; height: 22px; margin: auto; background: currentColor;
  -webkit-mask: var(--i) center/contain no-repeat; mask: var(--i) center/contain no-repeat;
}
`;

const icon = (name) => `<i class="i" style="--i:url(./icon/${name}.svg)" aria-hidden="true"></i>`;

/** The plugin's one screen: a big button, and what came of pressing it. */
class Location extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.lang = "en";
    // `idle`, `finding` (waiting for the core), `found` or `failed`.
    this.state = "idle";
    this.accuracy = null;
  }

  connectedCallback() {
    this.root.innerHTML = `<style>${STYLE}</style><div class="view"></div>`;
    this.view = this.root.querySelector(".view");
    this.root.addEventListener("click", (event) => this.onClick(event));
    globalThis.ft?.onOpen?.((opening) => this.onOpen(opening));
    this.paint();
  }

  onOpen(opening) {
    this.lang = opening.lang || "en";
    this.toggleAttribute("dark", Boolean(opening.dark));
    this.paint();
  }

  async onClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const { act } = button.dataset;
    if (act === "send" || act === "retry") await this.locate();
    else if (act === "close") globalThis.ft.close();
  }

  /** Asks the core for the position once, and hands it to the composer as a geo URI. */
  async locate() {
    if (this.state === "finding") return;
    this.state = "finding";
    this.paint();
    let fix = null;
    try {
      fix = typeof globalThis.ft?.location === "function" ? await globalThis.ft.location() : null;
    } catch {
      fix = null;
    }
    const uri = geoUri(fix);
    if (!uri) {
      this.state = "failed";
      return this.paint();
    }
    this.state = "found";
    this.accuracy = fix.accuracy;
    this.paint();
    globalThis.ft.say(uri);
  }

  paint() {
    if (!this.view) return;
    const T = (key) => escape(t(this.lang, key));
    const finding = this.state === "finding";
    let status = "";
    if (finding) status = `<div class="spinner" aria-hidden="true"></div><p class="status">${T("finding")}</p>`;
    else if (this.state === "found") {
      status = `<p class="accuracy">${escape(accuracyLabel(this.accuracy))}</p><p class="status">${T("found")}</p>`;
    } else if (this.state === "failed") {
      status = `<p class="status warn">${T("unavailable")}</p>
        <button data-act="retry" aria-label="${T("retry")}">${icon("refresh-outline")}</button>`;
    }
    this.view.innerHTML = `
      <div class="bar">
        <button data-act="close" aria-label="${T("close")}">${icon("close-outline")}</button>
      </div>
      <div class="main">
        <button data-act="send" class="big" aria-label="${T("send")}" ${finding ? "disabled" : ""}>
          <span class="pin" aria-hidden="true">📍</span><span>${T("send")}</span>
        </button>
        <div role="status" aria-live="polite">${status}</div>
        <p class="hint">${T("privacy")}</p>
      </div>`;
  }
}

if (!customElements.get("ft-location")) customElements.define("ft-location", Location);
