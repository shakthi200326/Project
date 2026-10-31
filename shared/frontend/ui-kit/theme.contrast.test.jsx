/**
 * Every theme, checked against WCAG.
 *
 * Six colours times two modes is twelve palettes, and nobody is going to
 * eyeball twelve palettes on every change. This reads the stylesheets, works
 * out what each combination actually resolves to, and measures it -- so a
 * colour picked carelessly fails here rather than shipping.
 *
 * It is the reason the palette can be a closed list and the reason custom
 * colours are not in this phase: an arbitrary hex has nothing to check it.
 *
 * The thresholds are WCAG 2.1 AA:
 *
 *   4.5:1  text against its background (1.4.3)
 *   3:1    a boundary or indicator that has to be seen (1.4.11)
 *
 * The parser below emulates the cascade rather than guessing: rules are
 * ordered by specificity and then by source order, exactly as a browser does,
 * so what is measured is what renders.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MODES, THEME_COLORS } from "../core/theme/appearance";

const HERE = dirname(fileURLToPath(import.meta.url));

const read = (name) => readFileSync(resolve(HERE, name), "utf8");

/** Every `selector { --token: value }` block, in source order.
 *
 * Comments are stripped first. Without that, the block comment above a rule
 * is swallowed into its selector and the rule is silently skipped -- which
 * would leave this file measuring an empty palette and passing.
 */
function rules(css) {
  const found = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = /([^{}]+)\{([^}]*)\}/g;

  let match;
  while ((match = block.exec(withoutComments)) !== null) {
    const selector = match[1].trim();
    if (!selector.startsWith(":root")) continue;

    const declarations = {};
    match[2].replace(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g, (_, name, value) => {
      declarations[name] = value.trim();
      return "";
    });

    if (Object.keys(declarations).length > 0) {
      found.push({ selector, declarations });
    }
  }
  return found;
}

const ALL_RULES = [...rules(read("tokens.css")), ...rules(read("theme.css"))];

/** Whether a `:root[...]` selector matches this combination. */
function matches(selector, { color, mode }) {
  const attributes = [...selector.matchAll(/\[([a-z-]+)="([a-z-]+)"\]/g)];

  return attributes.every(([, name, value]) => {
    if (name === "data-erp-color") return value === color;
    if (name === "data-erp-mode") return value === mode;
    // The rest -- `data-erp-nav`, the preference -- carry no colour.
    return false;
  });
}

/**
 * Follow `var(--x)` indirection down to a literal value.
 *
 * Several role tokens are deliberately defined as references -- in light mode
 * `--erp-color-primary-fill` *is* `var(--erp-color-primary)` -- so without
 * this the matrix reads the reference as a string, computes NaN, and a role
 * defined by indirection goes silently unchecked. The browser resolves these;
 * so must the test, or it is not measuring what renders.
 */
function resolved(tokens) {
  const out = { ...tokens };

  // Chains here are one or two deep; the bound also stops a cycle looping.
  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;

    Object.keys(out).forEach((name) => {
      const reference = /^var\((--[a-z0-9-]+)\)$/.exec(String(out[name]).trim());
      if (!reference) return;

      const target = out[reference[1]];
      if (target !== undefined && target !== out[name]) {
        out[name] = target;
        changed = true;
      }
    });

    if (!changed) break;
  }

  return out;
}

/** The custom properties in force for one combination, after the cascade. */
function palette(combination) {
  const merged = ALL_RULES.filter(
    (rule) =>
      !rule.selector.includes("[") || matches(rule.selector, combination)
  )
    // Specificity first, source order second: a browser's own tie-break.
    .map((rule, index) => ({
      ...rule,
      weight: (rule.selector.match(/\[/g) || []).length,
      index,
    }))
    .sort((a, b) => a.weight - b.weight || a.index - b.index)
    .reduce((merged, rule) => ({ ...merged, ...rule.declarations }), {});

  return resolved(merged);
}

// --- Contrast ---------------------------------------------------------------

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;

  const [r, g, b] = [0, 2, 4].map((at) =>
    channel(parseInt(full.slice(at, at + 2), 16))
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Where a colour sits on the wheel, 0-360. */
function hue(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(
    (at) => parseInt(value.slice(at, at + 2), 16) / 255
  );

  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  if (spread === 0) return 0;

  let degrees;
  if (max === r) degrees = ((g - b) / spread) % 6;
  else if (max === g) degrees = (b - r) / spread + 2;
  else degrees = (r - g) / spread + 4;

  return (degrees * 60 + 360) % 360;
}

/** The shorter way round the wheel between two colours. */
function hueDistance(a, b) {
  const apart = Math.abs(hue(a) - hue(b));
  return Math.min(apart, 360 - apart);
}

function contrast(foreground, background) {
  const [a, b] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x
  );
  return (a + 0.05) / (b + 0.05);
}

/** Every combination that actually renders. `system` resolves to one of these. */
const COMBINATIONS = THEME_COLORS.flatMap((color) =>
  ["light", "dark"].map((mode) => ({ color, mode }))
);

const describeCombination = ({ color, mode }) => `${color} / ${mode}`;

// ---------------------------------------------------------------
// The checks
// ---------------------------------------------------------------

describe("the palette is complete", () => {
  it.each(COMBINATIONS)("$color / $mode declares every brand token", (combination) => {
    const tokens = palette(combination);

    [
      "--erp-color-primary",
      "--erp-color-primary-strong",
      "--erp-color-primary-surface",
      "--erp-color-primary-border",
      "--erp-color-on-primary",
    ].forEach((token) => {
      expect(tokens[token], `${describeCombination(combination)} ${token}`)
        .toMatch(/^#[0-9a-f]{3,8}$/i);
    });
  });

  it("offers a theme for every colour the engine publishes", () => {
    // A colour on the Appearance screen with no rules behind it renders as
    // the default and looks like nothing happened.
    THEME_COLORS.forEach((color) => {
      const light = palette({ color, mode: "light" });
      const dark = palette({ color, mode: "dark" });

      expect(light["--erp-color-primary"], color).not.toBe(
        dark["--erp-color-primary"]
      );
    });
  });

  it("resolves only light and dark, whatever the stored mode", () => {
    // `system` never reaches CSS: the provider resolves it first.
    expect(MODES).toContain("system");
    expect(read("theme.css")).not.toContain('data-erp-mode="system"');
  });
});

describe("text on its background", () => {
  it.each(COMBINATIONS)(
    "$color / $mode reads on a card and on the page",
    (combination) => {
      const tokens = palette(combination);
      const where = describeCombination(combination);

      ["--erp-color-surface", "--erp-color-background"].forEach((ground) => {
        ["--erp-color-text", "--erp-color-text-secondary", "--erp-color-text-muted"].forEach(
          (ink) => {
            expect(
              contrast(tokens[ink], tokens[ground]),
              `${where}: ${ink} on ${ground}`
            ).toBeGreaterThanOrEqual(4.5);
          }
        );
      });
    }
  );
});

describe("the brand colour", () => {
  it.each(COMBINATIONS)(
    "$color / $mode works as link text",
    (combination) => {
      const tokens = palette(combination);
      const where = describeCombination(combination);

      // `--erp-color-primary` is a link and a focus ring as well as a fill,
      // so the text threshold applies to it and not only the 3:1 one.
      ["--erp-color-surface", "--erp-color-background"].forEach((ground) => {
        expect(
          contrast(tokens["--erp-color-primary"], tokens[ground]),
          `${where}: primary on ${ground}`
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  );

  it.each(COMBINATIONS)(
    "$color / $mode carries its own button label",
    (combination) => {
      const tokens = palette(combination);

      // The reason `--erp-color-on-primary` is chosen per colour per mode
      // rather than assumed to be white.
      expect(
        contrast(tokens["--erp-color-on-primary"], tokens["--erp-color-primary"]),
        `${describeCombination(combination)}: on-primary on primary`
      ).toBeGreaterThanOrEqual(4.5);

      // The fill behind a primary button is its own role: in dark mode it is
      // a saturated shade with white on it, not the light tint `primary`
      // uses for text. It carries a button label, so it needs the same 4.5.
      expect(
        contrast(
          tokens["--erp-color-on-primary-fill"],
          tokens["--erp-color-primary-fill"]
        ),
        `${describeCombination(combination)}: on-primary-fill on primary-fill`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(COMBINATIONS)(
    "$color / $mode stays legible on its own tinted surface",
    (combination) => {
      const tokens = palette(combination);

      expect(
        contrast(tokens["--erp-color-text"], tokens["--erp-color-primary-surface"]),
        `${describeCombination(combination)}: text on primary-surface`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(COMBINATIONS)(
    "$color / $mode reads as the selected navigation entry",
    (combination) => {
      const tokens = palette(combination);

      // The active entry in the sidebar, the top bar and the administration
      // section nav is `primary` on `primary-surface` -- a tint rather than a
      // solid fill, so the pair has to carry text on its own. Nothing checked
      // it until the navigation started depending on it.
      expect(
        contrast(
          tokens["--erp-color-primary"],
          tokens["--erp-color-primary-surface"]
        ),
        `${describeCombination(combination)}: primary on primary-surface`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );
});

describe("status colours", () => {
  it.each(COMBINATIONS)(
    "$color / $mode keeps every status indicator perceivable",
    (combination) => {
      const tokens = palette(combination);
      const where = describeCombination(combination);

      ["success", "warning", "danger", "info"].forEach((status) => {
        expect(
          contrast(tokens[`--erp-color-${status}`], tokens["--erp-color-surface"]),
          `${where}: ${status} on surface`
        ).toBeGreaterThanOrEqual(3);
      });
    }
  );

  it.each(COMBINATIONS)("$color / $mode keeps alert text readable", (combination) => {
    const tokens = palette(combination);
    const where = describeCombination(combination);

    ["success", "warning", "danger", "info"].forEach((status) => {
      expect(
        contrast(tokens["--erp-color-text"], tokens[`--erp-color-${status}-surface`]),
        `${where}: text on ${status}-surface`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  // Every badge tone, not only success. `Badge` offers six and four of them
  // are coloured; a pill is 11px text, so each needs the full 4.5:1 rather
  // than the 3:1 a large glyph would get away with.
  const BADGES = [
    ["success", "--erp-color-success-strong", "--erp-color-success-badge"],
    ["danger", "--erp-color-danger-stronger", "--erp-color-danger-badge"],
    ["warning", "--erp-color-warning-strong", "--erp-color-warning-badge"],
    ["info", "--erp-color-info-strong", "--erp-color-info-badge"],
  ];

  it.each(COMBINATIONS)("$color / $mode keeps every badge readable", (combination) => {
    const tokens = palette(combination);
    const where = describeCombination(combination);

    BADGES.forEach(([name, ink, ground]) => {
      expect(
        contrast(tokens[ink], tokens[ground]),
        `${where}: ${name} badge`
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it.each(COMBINATIONS)(
    "$color / $mode keeps the danger button's label readable",
    (combination) => {
      const tokens = palette(combination);

      expect(
        contrast(tokens["--erp-color-on-danger"], tokens["--erp-color-danger"]),
        `${describeCombination(combination)}: on-danger on danger`
      ).toBeGreaterThanOrEqual(4.5);
    }
  );
});

describe("the red theme and the danger colour", () => {
  /**
   * A primary button that looks like the delete button is a usability
   * problem, not a theme -- and the red theme is the one place the product
   * can produce it.
   *
   * Two colours are tellable apart if they differ enough in **hue** or enough
   * in **lightness**; either will do, and requiring both would rule out every
   * red worth offering. Measuring only contrast would pass two identical
   * hues at different lightness and fail two clearly different hues at the
   * same one, so both are measured and either may carry it.
   */
  it.each(["light", "dark"])("are tellable apart in %s mode", (mode) => {
    const tokens = palette({ color: "red", mode });
    const primary = tokens["--erp-color-primary"];
    const danger = tokens["--erp-color-danger"];

    expect(primary).not.toBe(danger);

    const apart = hueDistance(primary, danger);
    const lighter = contrast(primary, danger);

    expect(
      apart >= 12 || lighter >= 1.4,
      `red / ${mode}: primary ${primary} against danger ${danger} — ` +
        `${apart.toFixed(1)}° apart, ${lighter.toFixed(2)}:1`
    ).toBe(true);
  });

  it.each(["light", "dark"])(
    "leave the danger colour itself alone in %s mode",
    (mode) => {
      // The theme moves; the meaning of red does not. Whatever colour the
      // organization picked, destructive still looks destructive.
      const themed = palette({ color: "red", mode });
      const plain = palette({ color: "blue", mode });

      expect(themed["--erp-color-danger"]).toBe(plain["--erp-color-danger"]);
    }
  );
});

describe("the swatches on the Appearance screen", () => {
  const css = read("theme.css");

  it.each(THEME_COLORS)("%s shows the colour it will apply", (color) => {
    // The swatch is the one control that names a colour rather than a role,
    // so it is the one that can drift from the theme it advertises.
    const light = palette({ color, mode: "light" })["--erp-color-primary"];
    const swatch = css.match(
      new RegExp(
        `\\.erp-swatch\\[data-erp-swatch="${color}"\\]\\s*\\{\\s*--erp-swatch-color:\\s*([^;]+);`
      )
    );

    expect(swatch, `no swatch declared for ${color}`).not.toBeNull();
    expect(swatch[1].trim().toLowerCase()).toBe(light.toLowerCase());
  });
});
