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

// Ionic draws the window (the app lends it to the frame, app 1.6.0); this is only what is the
// tool's own: how the one big button and what came of it sit. The colours are the app's, through
// Ionic's variables, in light and dark.
const STYLE = `
ft-location { display: flex; flex-direction: column; height: 100%; font: 15px system-ui, sans-serif; }
ft-location ion-content { flex: 1; }
ft-location .main { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 16px 0 24px; text-align: center; }
ft-location .big { width: 100%; max-width: 360px; height: auto; min-height: 96px; margin: 0; --border-radius: 18px; font-size: 17px; font-weight: 600; }
ft-location .big .inside { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; }
ft-location .big .ft-i { width: 36px; height: 36px; }
ft-location .big ion-icon { font-size: 36px; }
ft-location .status { min-height: 1.4em; margin: 0; }
ft-location .status.warn { color: var(--ion-color-danger, #e0562b); }
ft-location .accuracy { font-size: 22px; font-weight: 600; }
ft-location .hint { color: var(--ion-color-medium, #666); font-size: 13px; margin: 0; max-width: 360px; }
ft-location .ft-i {
  display: block; width: 22px; height: 22px; background: currentColor;
  -webkit-mask: var(--i) center/contain no-repeat; mask: var(--i) center/contain no-repeat;
}
`;

/** An Ionicon: Ionic's own `ion-icon` when the app lent it by name, else the one the app serves
 *  at `./icon/<name>.svg`, painted in the button's colour. Never a picture of ours, never an emoji. */
const icon = (name, slot = "") =>
  globalThis.Ionicons?.map?.has(name)
    ? `<ion-icon ${slot ? `slot="${slot}" ` : ""}name="${name}" aria-hidden="true"></ion-icon>`
    : `<i ${slot ? `slot="${slot}" ` : ""}class="ft-i" style="--i:url(./icon/${name}.svg)" aria-hidden="true"></i>`;

/** The plugin's one screen: a big button, and what came of pressing it. No bar of its own: the
 *  app's tool window has the name and the ✕ (2026-10-09). */
class Location extends HTMLElement {
  constructor() {
    super();
    this.lang = "en";
    // `idle`, `finding` (waiting for the core), `found` or `failed`.
    this.state = "idle";
    this.accuracy = null;
  }

  connectedCallback() {
    // In the page, not in a shadow root: the frame holds only this tool, and Ionic's global
    // styles (colours, typography) do not cross a shadow boundary. Drawn once: Ionic draws a
    // button once, and drawing it again on every change would make it flash.
    this.innerHTML = `<style>${STYLE}</style>
      <ion-content class="ion-padding">
        <div class="main">
          <ion-button data-act="send" class="big" fill="outline" expand="block">
            <span class="inside">${icon("location-outline")}<span class="label"></span></span>
          </ion-button>
          <div role="status" aria-live="polite"></div>
          <p class="hint"></p>
        </div>
      </ion-content>`;
    this.send = this.querySelector('[data-act="send"]');
    this.statusEl = this.querySelector("[role='status']");
    this.hintEl = this.querySelector(".hint");
    this.addEventListener("click", (event) => this.onClick(event));
    globalThis.ft?.onOpen?.((opening) => this.onOpen(opening));
    this.paint();
  }

  onOpen(opening) {
    this.lang = opening.lang || "en";
    this.toggleAttribute("dark", Boolean(opening.dark));
    this.paint();
  }

  async onClick(event) {
    const button = event.target.closest("ion-button");
    if (!button || button.disabled) return;
    const { act } = button.dataset;
    if (act === "send" || act === "retry") await this.locate();
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
    if (!this.send) return;
    const T = (key) => escape(t(this.lang, key));
    const finding = this.state === "finding";
    let status = "";
    if (finding) status = `<ion-spinner aria-hidden="true"></ion-spinner><p class="status">${T("finding")}</p>`;
    else if (this.state === "found") {
      status = `<p class="accuracy">${escape(accuracyLabel(this.accuracy))}</p><p class="status">${T("found")}</p>`;
    } else if (this.state === "failed") {
      status = `<p class="status warn">${T("unavailable")}</p>
        <ion-button data-act="retry" fill="clear" aria-label="${T("retry")}">${icon("refresh-outline", "icon-only")}</ion-button>`;
    }
    this.send.setAttribute("aria-label", t(this.lang, "send"));
    this.send.querySelector(".label").textContent = t(this.lang, "send");
    this.send.disabled = finding;
    this.statusEl.innerHTML = status;
    this.hintEl.textContent = t(this.lang, "privacy");
  }
}

if (!customElements.get("ft-location")) customElements.define("ft-location", Location);
