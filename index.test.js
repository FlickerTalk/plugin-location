// The plugin's own tests: the geo URI it writes (RFC 5870), the manifest it ships, the catalogue
// of texts, and the one flow it has (ask the core once, put the place in the composer) against a
// fake core.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accuracyLabel, geoUri } from "./dist/index.js";
import { LANGUAGES, catalogueOf, t } from "./dist/i18n.js";

describe("the geo URI", () => {
  it("is geo:<lat>,<lon>;u=<metres>, five decimals and whole metres", () => {
    expect(geoUri({ lat: 40.4168, lon: -3.7038, accuracy: 20, at: 1 })).toBe("geo:40.41680,-3.70380;u=20");
  });

  it("rounds the coordinates to five decimals", () => {
    expect(geoUri({ lat: 40.4168049, lon: 2.1734036, accuracy: 5 })).toBe("geo:40.41680,2.17340;u=5");
    expect(geoUri({ lat: 40.4168061, lon: 2.1734071, accuracy: 5 })).toBe("geo:40.41681,2.17341;u=5");
  });

  it("keeps the sign of the southern and western halves", () => {
    expect(geoUri({ lat: -33.8688197, lon: -151.2092949, accuracy: 8 })).toBe("geo:-33.86882,-151.20929;u=8");
    expect(geoUri({ lat: -90, lon: 180, accuracy: 1 })).toBe("geo:-90.00000,180.00000;u=1");
  });

  it("never writes a negative zero", () => {
    expect(geoUri({ lat: -0.000001, lon: -0.000004, accuracy: 3 })).toBe("geo:0.00000,0.00000;u=3");
  });

  it("rounds the accuracy up, so it never claims to be better than it is", () => {
    expect(geoUri({ lat: 1, lon: 1, accuracy: 12.1 })).toBe("geo:1.00000,1.00000;u=13");
    expect(geoUri({ lat: 1, lon: 1, accuracy: 0.4 })).toBe("geo:1.00000,1.00000;u=1");
    expect(geoUri({ lat: 1, lon: 1, accuracy: 0 })).toBe("geo:1.00000,1.00000;u=0");
  });

  it("leaves the uncertainty out when the phone did not give one", () => {
    expect(geoUri({ lat: 1, lon: 2, accuracy: Number.NaN })).toBe("geo:1.00000,2.00000");
    expect(geoUri({ lat: 1, lon: 2, accuracy: -5 })).toBe("geo:1.00000,2.00000");
    expect(geoUri({ lat: 1, lon: 2 })).toBe("geo:1.00000,2.00000");
  });

  it("is null for what is not a place on Earth", () => {
    expect(geoUri(null)).toBeNull();
    expect(geoUri({})).toBeNull();
    expect(geoUri({ lat: Number.NaN, lon: 1, accuracy: 1 })).toBeNull();
    expect(geoUri({ lat: 90.1, lon: 1, accuracy: 1 })).toBeNull();
    expect(geoUri({ lat: 1, lon: -180.5, accuracy: 1 })).toBeNull();
    expect(geoUri({ lat: "40", lon: "3", accuracy: 1 })).toBeNull();
  });
});

describe("the accuracy on screen", () => {
  it("is ± whole metres, rounded up like the URI", () => {
    expect(accuracyLabel(20)).toBe("±20 m");
    expect(accuracyLabel(19.2)).toBe("±20 m");
    expect(accuracyLabel(Number.NaN)).toBe("");
  });
});

describe("the manifest", () => {
  const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "module.json"), "utf8"));

  it("asks for the location and to fill the composer, and for nothing else", () => {
    expect(manifest.id).toBe("com.flickertalk.location");
    expect(manifest.components).toEqual(["ft-location"]);
    expect(manifest.permissions).toEqual({ location: true, send: "propose" });
    expect(manifest).not.toHaveProperty("opens");
    expect(manifest).not.toHaveProperty("views");
  });

  it("is a valid manifest", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minCoreVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof manifest.summary).toBe("string");
    expect(manifest.summary.length).toBeLessThanOrEqual(200);
  });

  // The catalogue copies these, so the app shows the plugin in the phone's language before it is
  // installed; the web's catalogue test refuses an entry without them (2026-10-08).
  const LOCALES = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];
  const codePoints = (text) => [...text].length;

  it("names and sums up the plugin in the 20 other languages of the app, within the SDK's limits", () => {
    expect(Object.keys(manifest.locales ?? {})).toEqual(LOCALES);
    for (const lang of LOCALES) {
      const { name, summary, ...rest } = manifest.locales[lang];
      expect(rest, lang).toEqual({});
      expect(codePoints(summary.trim()), lang).toBeGreaterThan(0);
      expect(codePoints(summary), lang).toBeLessThanOrEqual(200);
      expect(codePoints(name.trim()), lang).toBeGreaterThan(0);
      expect(codePoints(name), lang).toBeLessThanOrEqual(64);
    }
  });

  it("calls the plugin in each language what the plugin calls itself", () => {
    for (const lang of LOCALES) expect(manifest.locales[lang].name, lang).toBe(catalogueOf(lang).title);
    expect(manifest.name).toBe(catalogueOf("en").title);
  });
});

describe("the catalogue", () => {
  const APP_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "ro", "pl", "ru", "uk", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];

  it("speaks the 21 languages of the app, with the same keys in each and none empty", () => {
    expect([...LANGUAGES].sort()).toEqual([...APP_LANGUAGES].sort());
    const keys = Object.keys(catalogueOf("en")).sort();
    expect(keys.length).toBeGreaterThan(0);
    for (const lang of LANGUAGES) {
      expect(Object.keys(catalogueOf(lang)).sort(), lang).toEqual(keys);
      for (const key of keys) expect(catalogueOf(lang)[key].trim(), `${lang}.${key}`).not.toBe("");
    }
  });

  it("falls back to the base language and then to English", () => {
    expect(t("pt-BR", "send")).toBe(t("pt", "send"));
    expect(t("xx", "send")).toBe("Send my location");
    expect(t("es", "no-such-key")).toBe("no-such-key");
  });
});

/** A deferred answer, to look at the plugin while the core is still looking for the phone. */
function later() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** A fake core: only what this plugin uses, as the frame's `ft` would answer. */
function fakeCore(location) {
  const handlers = [];
  return {
    open: (opening) => Promise.all(handlers.map((handler) => handler({ text: "", dark: false, lang: "en", file: null, ref: null, reminder: null, live: false, ...opening }))),
    ft: {
      onOpen: (handler) => handlers.push(handler),
      location: vi.fn(location),
      say: vi.fn(),
      close: vi.fn(),
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const HERE = { lat: 40.4168, lon: -3.7038, accuracy: 19.2, at: 1_759_000_000_000 };

describe("the plugin", () => {
  let core;
  let element;
  // The tool draws in the page: Ionic's styles do not cross a shadow root.
  const inside = () => element;
  // Ionic moves a button's first aria attributes to the native button inside it once it has drawn.
  const aria = (one, name) => one.getAttribute(name) ?? one.shadowRoot?.querySelector("button")?.getAttribute(name);
  const button = (act) => inside().querySelector(`[data-act="${act}"]`);
  const press = async (act) => {
    button(act).click();
    await tick();
    await tick();
  };
  const mount = async (location, opening = {}) => {
    core = fakeCore(location);
    globalThis.ft = core.ft;
    document.body.innerHTML = "";
    element = document.createElement("ft-location");
    document.body.append(element);
    await core.open(opening);
  };

  beforeEach(() => {
    delete globalThis.ft;
  });

  it("shows one big button, labelled in the language of the app", async () => {
    await mount(async () => HERE, { lang: "es" });
    expect(aria(button("send"), "aria-label")).toBe(t("es", "send"));
    expect(button("send").disabled).toBe(false);
    expect(core.ft.location).not.toHaveBeenCalled();
  });

  it("asks the core once and puts the geo URI in the composer, with the accuracy on screen", async () => {
    await mount(async () => HERE);
    await press("send");
    expect(core.ft.location).toHaveBeenCalledTimes(1);
    expect(core.ft.say).toHaveBeenCalledWith("geo:40.41680,-3.70380;u=20");
    expect(inside().textContent).toContain("±20 m");
  });

  it("disables the button while it waits, and does not ask twice", async () => {
    const answer = later();
    await mount(() => answer.promise);
    await press("send");
    expect(button("send").disabled).toBe(true);
    expect(inside().textContent).toContain(t("en", "finding"));
    await press("send");
    expect(core.ft.location).toHaveBeenCalledTimes(1);
    answer.resolve(HERE);
    await tick();
    await tick();
    expect(core.ft.say).toHaveBeenCalledTimes(1);
  });

  it("says the location is not available when the core gives none, and lets the user try again", async () => {
    const answers = [null, HERE];
    await mount(async () => answers.shift());
    await press("send");
    expect(core.ft.say).not.toHaveBeenCalled();
    expect(inside().textContent).toContain(t("en", "unavailable"));
    expect(button("retry")).not.toBeNull();
    expect(aria(button("retry"), "aria-label")).toBe(t("en", "retry"));
    await press("retry");
    expect(core.ft.location).toHaveBeenCalledTimes(2);
    expect(core.ft.say).toHaveBeenCalledWith("geo:40.41680,-3.70380;u=20");
  });

  it("treats a failed or nonsense answer like no location", async () => {
    await mount(async () => {
      throw new Error("refused");
    });
    await press("send");
    expect(inside().textContent).toContain(t("en", "unavailable"));
    await mount(async () => ({ lat: 200, lon: 0, accuracy: 5, at: 1 }));
    await press("send");
    expect(core.ft.say).not.toHaveBeenCalled();
    expect(inside().textContent).toContain(t("en", "unavailable"));
  });

  it("says the location is not available on a core that cannot give one", async () => {
    await mount(undefined);
    delete core.ft.location;
    await press("send");
    expect(core.ft.say).not.toHaveBeenCalled();
    expect(inside().textContent).toContain(t("en", "unavailable"));
  });

  // The app's tool window has its own ✕ and the plugin's name (and Android's Back): the tool's own
  // ✕ was a duplicate, and was all its bar had (2026-10-09).
  it("leaves closing to the app's window: no ✕ and no bar of its own", async () => {
    await mount(async () => HERE);
    expect(button("close")).toBeNull();
    expect(element.querySelector("ion-header")).toBeNull();
  });

  it("draws in the page, in ion-content, its buttons Ionic's", async () => {
    await mount(async () => null);
    expect(element.shadowRoot).toBe(null);
    expect(element.querySelector(":scope > ion-content ion-button[data-act='send']")).toBeTruthy();
    expect(element.querySelector(":scope > ion-content .hint").textContent).toBe(t("en", "privacy"));
    await press("send");
    expect(element.querySelector("ion-content ion-button[data-act='retry']")).toBeTruthy();
    expect(element.querySelector("button")).toBeNull();
  });

  // Ionic draws a button once; drawing it again on every change would flash it.
  it("keeps the big button while it looks for the phone, waits with Ionic's spinner, and speaks a new language in place", async () => {
    const answer = later();
    await mount(() => answer.promise);
    const send = button("send");
    await press("send");
    expect(button("send")).toBe(send);
    expect(element.querySelector("[role='status'] ion-spinner")).toBeTruthy();
    answer.resolve(HERE);
    await tick();
    await tick();
    expect(button("send")).toBe(send);
    expect(element.querySelector("ion-spinner")).toBeNull();
    await core.open({ lang: "es" });
    expect(button("send")).toBe(send);
    expect(send.getAttribute("aria-label")).toBe(t("es", "send"));
    expect(send.textContent).toContain(t("es", "send"));
  });

  // The icons are the app's, never an emoji: Ionic's own when the app lent them by name, else the
  // ones it serves.
  it("draws an Ionicon the app lent by name with ion-icon, and the one it serves otherwise", async () => {
    await mount(async () => HERE);
    expect(element.querySelector('[data-act="send"] ion-icon')).toBe(null);
    expect(element.querySelector('[data-act="send"] .ft-i').getAttribute("style")).toContain("./icon/location-outline.svg");
    expect(element.querySelector('[data-act="send"]').textContent).not.toContain("📍");

    globalThis.Ionicons = { map: new Map([["location-outline", "data:image/svg+xml;utf8,<svg></svg>"]]) };
    await mount(async () => HERE);
    expect(element.querySelector('[data-act="send"] ion-icon').getAttribute("name")).toBe("location-outline");
  });

  afterEach(() => {
    delete globalThis.Ionicons;
  });
});

describe("the package", () => {
  const dist = join(import.meta.dirname, "dist");
  const files = readdirSync(dist);

  // Only an app that lends Ionic can show it (app 1.6.0): an older one keeps the version it has.
  it("asks for an app that lends Ionic", () => {
    expect(JSON.parse(readFileSync(join(import.meta.dirname, "module.json"), "utf8")).minCoreVersion).toBe("1.6.0");
  });

  // Ionic is the app's, lent to the frame: a copy in the package would be a second one, and heavy.
  it("carries no Ionic of its own", () => {
    for (const file of files) {
      const code = readFileSync(join(dist, file), "utf8");
      expect(code, file).not.toMatch(/@ionic\/core|ionicframework|stencil|defineCustomElement|__registerHost/i);
      expect(code, file).not.toMatch(/^\s*import\s.*from\s+["'](?!\.\/)/m);
    }
  });

  // The app carries it as a seed on iOS: 128 KiB at most (plugin-sdk).
  it("is small enough to be a seed", () => {
    const bytes = files.reduce((sum, file) => sum + statSync(join(dist, file)).size, 0);
    expect(bytes).toBeLessThanOrEqual(128 * 1024);
  });
});

describe("the image of the Apps grid", () => {
  // icon.svg beside module.json and dist/, signed with the rest: the app draws it on the tile; the
  // Ionicon in module.json stays as the fallback (2026-10-08).
  const image = join(import.meta.dirname, "icon.svg");

  it("is a square 64 × 64 SVG of at most 4 KB at the root of the package, and not inside dist/", () => {
    expect(existsSync(image), "icon.svg").toBe(true);
    expect(statSync(image).size).toBeLessThanOrEqual(4096);
    const svg = readFileSync(image, "utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(existsSync(join(import.meta.dirname, "dist", "icon.svg"))).toBe(false);
  });
});
