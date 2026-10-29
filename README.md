# Winterfall

A lightweight, dependency-free falling snow effect you can add to any website. It renders snowflakes on a transparent canvas overlay, so it does not change your page layout or intercept clicks.

## Features

- **Depth** — distant flakes are smaller, slower, and fainter than nearby ones.
- **Snowflake designs** — rotating ❄ snowflakes in three designs: classic, fern, and star. Add your own with `customDesigns`.
- **Wind and gusts** — a steady breeze with random gusts; optional wind driven by device tilt (`gyroWind`).
- **Interactive** — flakes drift away from the pointer, slow down when "caught" near it (`catchRadius`), and scatter on click (`burst`).
- **Snow accumulation** — optional snowdrifts that build up at the bottom of the screen and slowly melt away (`melt`).
- **Scenery** — optional moon, twinkling stars, and a fog layer (`moon`, `stars`, `fog`).
- **Gradient flakes** — tint flakes from `color` at the core to `color2` at the tips.
- **Presets** — `gentle`, `default`, `blizzard`, and `christmas`, with smooth transitions when switched at runtime.
- **Seasonal activation** — run only between chosen dates, for example from December 1 to January 15.
- **Floating controls** — an optional draggable ❄ button with a built-in panel for presets, intensity, wind, and feature toggles (`controls: true`). The button position is remembered.
- **Live updates** — change any option at runtime with `snowfall.update({...})`.
- **Soft fades** — snow eases in and out over `fadeDuration` instead of popping on and off.
- **Events** — `onGustStart` and `onFlakeLand` hooks for ambient sound or stats.
- **Remembers the visitor's choice** — optionally saves the on/off state in `localStorage`.
- **Respectful by default** — honors `prefers-reduced-motion` (including live changes), pauses in hidden tabs, and uses fewer flakes on small screens.
- **Single file** — one script with no stylesheet required.

## Demo

Open `index.html` in a browser. A floating ❄ button appears in the corner — drag it anywhere, click it to open the control panel, and try the presets, sliders, and snowdrifts. The **Playground** section under the card applies any options as JSON live, and can show an FPS counter.

## Quick start (no code)

Add one script tag to your page. The `data-*` attributes configure the effect:

```html
<script src="snowfall.js" data-auto></script>

<!-- or with options -->
<script
  src="snowfall.js"
  data-preset="christmas"
  data-color="#eaf6ff"
  data-active-dates="12-01..01-15"
  data-remember-choice="true"
  defer
></script>
```

Any option from the table below can be passed as a `data-` attribute in kebab-case (`particleCount` → `data-particle-count`). The created instance is available as `Winterfall.instance`.

## JavaScript setup

```html
<script src="snowfall.js"></script>
<script>
  const snowfall = Winterfall.create({
    preset: "blizzard",
    color: "#eaf6ff",
  });
</script>
```

Call `Winterfall.create()` after `<body>` exists, for example from a script at the end of the body or a `defer` script.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `preset` | `"default"` | Base settings: `gentle`, `default`, `blizzard`, or `christmas`. Other options override the preset. |
| `particleCount` | `120` | Number of snowflakes (1–1000) on a 1440×900 screen. |
| `speed` | `1` | Fall speed multiplier (greater than 0, up to 10). |
| `color` | `"#ffffff"` | CSS color for the flakes and accumulated snow. |
| `minSize` | `1` | Minimum flake radius in pixels. |
| `maxSize` | `4` | Maximum flake radius in pixels. |
| `shape` | `"all"` | Snowflake design: `classic` (one pair of branches), `fern` (two pairs of branches), `star` (hexagon core with arrow tips), or `all` for a random mix. |
| `wind` | `0.2` | Constant horizontal wind (-10 to 10). Negative values blow left. |
| `gusts` | `true` | Enables random wind gusts. |
| `gustStrength` | `1.2` | Maximum gust strength (0–10). |
| `interactive` | `true` | Flakes move away from the pointer. |
| `interactionRadius` | `90` | Pointer influence radius in pixels. |
| `catchRadius` | `40` | Flakes near the pointer slow to a hover within this radius (0–500 px, 0 disables). |
| `burst` | `false` | Flakes scatter away from the click/tap point. |
| `burstRadius` | `120` | Radius of the click burst in pixels (0–1000). |
| `burstStrength` | `3` | How hard the burst pushes flakes (0–20). |
| `gyroWind` | `false` | Adds wind from device tilt (gamma), clamped to ±3. iOS asks for permission on first tap. |
| `accumulate` | `false` | Snow builds up at the bottom of the screen. |
| `maxAccumulation` | `50` | Maximum snowdrift height in pixels. |
| `accumulationRate` | `1` | How quickly snow builds up. |
| `moon` | `false` | Draws a glowing moon in the top-right corner. |
| `stars` | `0` | Number of twinkling background stars (0–200). |
| `fog` | `0` | Opacity of the mist layer over the bottom of the screen (0–1). |
| `melt` | `true` | Drifts slowly shrink over time and faster under the pointer. |
| `meltRate` | `0.02` | Base melting speed in pixels per 60fps frame (0–10). |
| `color2` | `null` | Second color for a center-to-tip gradient on each flake. |
| `fadeDuration` | `600` | Milliseconds for the fade in/out when snow starts or stops (0 = instant). |
| `autoScale` | `true` | Uses fewer flakes on smaller screens (down to 35% of `particleCount`). |
| `activeDates` | `null` | `{ from: "MM-DD", to: "MM-DD" }`. Outside this range the effect starts off. Ranges can span the new year. |
| `rememberChoice` | `false` | Saves the visitor's on/off choice in `localStorage`. |
| `zIndex` | `1000` | Stacking order of the canvas overlay. |
| `respectReducedMotion` | `true` | Stays paused when reduced motion is requested. |
| `controls` | `false` | Shows a draggable floating ❄ button with a built-in control panel (presets, intensity, speed, wind, fog, feature switches, clear snow). |
| `customDesigns` | `null` | `{ name: (ctx, arm) => void }` — extra snowflake designs; add the names to `shape` to use them. |
| `onChange` | `null` | `function (isEnabled) {}`, called when the effect is turned on or off. |
| `onGustStart` | `null` | `function (strength) {}`, called when a new gust target is picked. |
| `onFlakeLand` | `null` | `function (x) {}`, called when a flake lands on the drift (needs `accumulate`). |

### Presets

| Preset | Description |
| --- | --- |
| `gentle` | Few slow flakes and no gusts. |
| `default` | Balanced snowfall. |
| `blizzard` | Dense, fast snow with strong wind. |
| `christmas` | Larger snowflakes, accumulating snowdrifts, a moon, and stars. |

## Controls

### Floating control panel

Set `controls: true` to get a draggable ❄ button (bottom-right by default). Click it to open a panel with:

- a snowfall on/off switch,
- preset buttons (`gentle`, `default`, `blizzard`, `christmas`),
- sliders for intensity, speed, wind, and fog,
- switches for wind gusts, pointer interaction, snowdrifts, melting, click burst, moon & stars, and gyro wind (on supported devices),
- a "Clear accumulated snow" button.

The button can be dragged anywhere on screen; its position is saved in `localStorage`. The panel closes on `Esc` or when clicking outside.

### Instance API

`Winterfall.create()` returns an instance with these methods:

```js
snowfall.start();     // Also overrides reduced motion and activeDates; use it for an explicit "turn on" button.
snowfall.stop();
snowfall.toggle();    // Returns true if snowfall is now enabled.
snowfall.isEnabled();
snowfall.update({ speed: 2, wind: 0.5 }); // Change options live; look options apply instantly.
snowfall.clearSnow(); // Removes accumulated snow.
snowfall.destroy();   // Stops the animation and removes the canvas, control panel, and event listeners.
```

`update()` accepts the same options as `create()`. Passing a `preset` resets the look options to that preset first, then applies your overrides; intensity, speed, wind, and gust strength ease toward the new values over ~800 ms. Options that only apply at creation (`controls`, `rememberChoice`, `activeDates`, `respectReducedMotion`, `customDesigns`) are carried over unless you replace them explicitly.

### Example: on/off button

```html
<button id="snow-toggle" type="button">Toggle snow</button>
<script>
  const snowfall = Winterfall.create({ rememberChoice: true });
  document.querySelector("#snow-toggle").addEventListener("click", function () {
    snowfall.toggle();
  });
</script>
```

## Upgrading from v1

`window.Snowfall` is still available as an alias of `window.Winterfall`, so `Snowfall.create()` keeps working. The `.snowfall-canvas` CSS rule is no longer needed because the script styles the canvas itself.

## Browser support

Requires a modern browser with Canvas 2D, `requestAnimationFrame`, and standard DOM APIs.
