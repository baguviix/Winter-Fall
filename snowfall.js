/*! Winterfall v2.4.2 | Lightweight falling snow effect | MIT License */
(function (global, document) {
  "use strict";

  const VERSION = "2.4.2";
  const STORAGE_KEY = "winterfall-enabled";
  const POSITION_KEY = "winterfall-controls-position";
  const SPRITE_SIZE = 64;
  const MIN_FLAKE_SIZE = 10;
  // Arm length relative to the sprite size.
  const ARM_RATIO = 0.42;
  const GROUND_COLUMN = 6;
  const DEPOSIT_WEIGHTS = [0.3, 0.7, 1, 0.7, 0.3];

  const defaults = {
    particleCount: 120,
    speed: 1,
    color: "#ffffff",
    color2: null,
    minSize: 1,
    maxSize: 4,
    shape: "all",
    wind: 0.2,
    gusts: true,
    gustStrength: 1.2,
    interactive: true,
    interactionRadius: 90,
    catchRadius: 40,
    burst: false,
    burstRadius: 120,
    burstStrength: 3,
    gyroWind: false,
    accumulate: false,
    maxAccumulation: 50,
    accumulationRate: 1,
    moon: false,
    stars: 0,
    fog: 0,
    melt: true,
    meltRate: 0.02,
    autoScale: true,
    activeDates: null,
    rememberChoice: false,
    zIndex: 1000,
    respectReducedMotion: true,
    controls: false,
    fadeDuration: 600,
    customDesigns: null,
    onChange: null,
    onGustStart: null,
    onFlakeLand: null,
  };

  // Options controlled by presets. Switching presets resets these first.
  const LOOK_KEYS = [
    "particleCount",
    "speed",
    "color",
    "color2",
    "minSize",
    "maxSize",
    "shape",
    "wind",
    "gusts",
    "gustStrength",
    "interactionRadius",
    "catchRadius",
    "burst",
    "burstRadius",
    "burstStrength",
    "accumulate",
    "maxAccumulation",
    "accumulationRate",
    "moon",
    "stars",
    "fog",
    "melt",
    "meltRate",
  ];
  // Options that only apply when the effect is created.
  const CREATE_ONLY_KEYS = ["controls", "rememberChoice", "activeDates", "respectReducedMotion", "customDesigns"];
  // Changing these requires restyling existing flakes.
  const FLAKE_KEYS = ["minSize", "maxSize", "shape", "speed"];
  const TRANSITION_KEYS = ["particleCount", "speed", "wind", "gustStrength"];
  const TRANSITION_MS = 800;

  const presets = {
    gentle: { particleCount: 60, speed: 0.6, maxSize: 3, wind: 0.1, gusts: false },
    default: {},
    blizzard: {
      particleCount: 400,
      speed: 2.4,
      minSize: 0.8,
      maxSize: 3.5,
      wind: 1.5,
      gustStrength: 3,
      interactionRadius: 60,
    },
    christmas: {
      particleCount: 140,
      minSize: 1.2,
      maxSize: 4.5,
      accumulate: true,
      accumulationRate: 1.5,
      melt: true,
      moon: true,
      stars: 60,
    },
  };

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  function isNumberInRange(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }

  function parseMonthDay(value) {
    const match = /^(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return month * 100 + day;
  }

  function parseDateRange(range) {
    if (!range || typeof range !== "object") return null;
    const from = parseMonthDay(range.from);
    const to = parseMonthDay(range.to);
    return from === null || to === null ? null : { from: from, to: to };
  }

  function isInSeason(range, date) {
    if (!range) return true;
    const today = (date.getMonth() + 1) * 100 + date.getDate();
    // A range such as 12-01..01-15 wraps around the new year.
    return range.from <= range.to
      ? today >= range.from && today <= range.to
      : today >= range.from || today <= range.to;
  }

  function resolveOptions(options) {
    const input = options || {};
    const presetName = input.preset || "default";
    if (!Object.prototype.hasOwnProperty.call(presets, presetName)) {
      throw new RangeError('Unknown preset "' + presetName + '". Use one of: ' + Object.keys(presets).join(", ") + ".");
    }
    const settings = Object.assign({}, defaults, presets[presetName], input);
    delete settings.preset;
    return settings;
  }

  function validate(s, designNames) {
    if (!Number.isInteger(s.particleCount) || s.particleCount < 1 || s.particleCount > 1000) {
      throw new RangeError("particleCount must be an integer between 1 and 1000.");
    }
    if (!isNumberInRange(s.speed, Number.MIN_VALUE, 10)) {
      throw new RangeError("speed must be a positive number up to 10.");
    }
    if (!isNumberInRange(s.minSize, Number.MIN_VALUE, 100) || !isNumberInRange(s.maxSize, s.minSize, 100)) {
      throw new RangeError("maxSize must be greater than or equal to a positive minSize.");
    }
    if (typeof s.color !== "string" || s.color.length === 0) {
      throw new TypeError("color must be a non-empty CSS color string.");
    }
    if (s.color2 !== null && (typeof s.color2 !== "string" || s.color2.length === 0)) {
      throw new TypeError("color2 must be null or a non-empty CSS color string.");
    }
    if (s.shape !== "all" && designNames.indexOf(s.shape) === -1) {
      throw new TypeError("shape must be one of: all, " + designNames.join(", ") + ".");
    }
    if (!isNumberInRange(s.wind, -10, 10)) throw new RangeError("wind must be a number between -10 and 10.");
    if (!isNumberInRange(s.gustStrength, 0, 10)) throw new RangeError("gustStrength must be a number between 0 and 10.");
    if (!isNumberInRange(s.interactionRadius, 0, 1000)) {
      throw new RangeError("interactionRadius must be a number between 0 and 1000.");
    }
    if (!isNumberInRange(s.catchRadius, 0, 500)) throw new RangeError("catchRadius must be a number between 0 and 500.");
    if (!isNumberInRange(s.burstRadius, 0, 1000)) throw new RangeError("burstRadius must be a number between 0 and 1000.");
    if (!isNumberInRange(s.burstStrength, 0, 20)) throw new RangeError("burstStrength must be a number between 0 and 20.");
    if (!Number.isInteger(s.stars) || s.stars < 0 || s.stars > 200) {
      throw new RangeError("stars must be an integer between 0 and 200.");
    }
    if (!isNumberInRange(s.fog, 0, 1)) throw new RangeError("fog must be a number between 0 and 1.");
    if (!isNumberInRange(s.meltRate, 0, 10)) throw new RangeError("meltRate must be a number between 0 and 10.");
    if (!isNumberInRange(s.fadeDuration, 0, 10000)) throw new RangeError("fadeDuration must be between 0 and 10000 ms.");
    if (!isNumberInRange(s.maxAccumulation, 0, 1000)) {
      throw new RangeError("maxAccumulation must be a number between 0 and 1000.");
    }
    if (!isNumberInRange(s.accumulationRate, 0, 100)) {
      throw new RangeError("accumulationRate must be a number between 0 and 100.");
    }
    if (!Number.isInteger(s.zIndex)) throw new TypeError("zIndex must be an integer.");
    if (s.activeDates !== null && !parseDateRange(s.activeDates)) {
      throw new TypeError('activeDates must look like { from: "12-01", to: "01-15" }.');
    }
    if (s.customDesigns !== null) {
      if (typeof s.customDesigns !== "object") throw new TypeError("customDesigns must be an object of functions.");
      Object.keys(s.customDesigns).forEach(function (name) {
        if (typeof s.customDesigns[name] !== "function") {
          throw new TypeError('customDesigns.' + name + " must be a function (ctx, arm) => void.");
        }
      });
    }
    ["onChange", "onGustStart", "onFlakeLand"].forEach(function (key) {
      if (s[key] !== null && typeof s[key] !== "function") {
        throw new TypeError(key + " must be a function.");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function readStoredChoice() {
    try {
      const value = global.localStorage.getItem(STORAGE_KEY);
      return value === null ? null : value === "true";
    } catch (error) {
      return null;
    }
  }

  function storeChoice(value) {
    try {
      global.localStorage.setItem(STORAGE_KEY, String(value));
    } catch (error) {
      // Storage can be unavailable (private mode, blocked cookies); ignore.
    }
  }

  function readStoredPosition() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(POSITION_KEY));
      if (parsed && isNumberInRange(parsed.x, 0, 100000) && isNumberInRange(parsed.y, 0, 100000)) {
        return { x: parsed.x, y: parsed.y };
      }
    } catch (error) {
      // Missing or malformed storage entry; fall back to the default spot.
    }
    return null;
  }

  function storePosition(position) {
    try {
      global.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch (error) {
      // Storage can be unavailable (private mode, blocked cookies); ignore.
    }
  }

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createSnowflakeIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      '<path d="M12 2.5v19"/><path d="M4.2 7l15.6 10"/><path d="M19.8 7L4.2 17"/>' +
      '<path d="M12 2.5 9.7 4.9M12 2.5l2.3 2.4"/><path d="M12 21.5l-2.3-2.4M12 21.5l2.3-2.4"/>' +
      '<path d="M4.2 7l4 .7M4.2 7l.7 4"/><path d="M19.8 17l-4-.7M19.8 17l-.7-4"/>' +
      '<path d="M19.8 7l-4 .7M19.8 7l-.7 4"/><path d="M4.2 17l4-.7M4.2 17l.7-4"/>';
    return svg;
  }

  // Self-contained so the script keeps working without any stylesheet.
  function injectControlsStyles() {
    if (document.getElementById("winterfall-controls-styles")) return;
    const style = document.createElement("style");
    style.id = "winterfall-controls-styles";
    style.textContent = [
      ".wf-controls{position:fixed;top:0;left:0}",
      ".wf-controls-btn{width:52px;height:52px;padding:0;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(220,238,255,.35);background:rgba(13,30,49,.85);color:#dceeff;cursor:grab;box-shadow:0 12px 32px rgba(0,0,0,.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:transform .16s ease,border-color .16s ease,background .16s ease;touch-action:none}",
      ".wf-controls-btn:hover{transform:scale(1.07);border-color:rgba(220,238,255,.6)}",
      ".wf-controls-btn:active{cursor:grabbing}",
      ".wf-controls-btn:focus-visible{outline:3px solid #82caff;outline-offset:3px}",
      ".wf-controls-btn svg{width:26px;height:26px;pointer-events:none}",
      ".wf-panel{position:fixed;width:264px;max-width:calc(100vw - 16px);padding:16px 16px 14px;border-radius:18px;border:1px solid rgba(220,238,255,.18);background:rgba(9,22,37,.94);color:#eaf4ff;box-shadow:0 24px 70px rgba(0,0,0,.5);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",sans-serif;font-size:13px}",
      ".wf-panel[hidden]{display:none}",
      ".wf-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}",
      ".wf-title{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a9c7e8}",
      ".wf-close{border:0;background:transparent;color:#8fa7bf;font-size:20px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:8px}",
      ".wf-close:hover{color:#fff;background:rgba(220,238,255,.1)}",
      ".wf-label{margin:12px 0 6px;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8fa7bf}",
      ".wf-label-row{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 2px}",
      ".wf-label-row .wf-label{margin:0}",
      ".wf-value{color:#dceeff;font-size:.8rem;font-weight:600}",
      ".wf-range{width:100%;margin:2px 0 4px;accent-color:#82caff}",
      ".wf-chips{display:flex;flex-wrap:wrap;gap:6px}",
      ".wf-chip{padding:6px 12px;border-radius:999px;cursor:pointer;border:1px solid rgba(220,238,255,.22);background:rgba(220,238,255,.06);color:#dceeff;font:inherit;font-size:.8rem;font-weight:600}",
      ".wf-chip:hover{border-color:rgba(220,238,255,.45)}",
      ".wf-chip[aria-pressed=\"true\"]{border-color:#82caff;background:rgba(130,202,255,.2);color:#fff}",
      ".wf-switch-row{display:flex;width:100%;align-items:center;justify-content:space-between;padding:8px 2px;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:.88rem}",
      ".wf-switch-row + .wf-switch-row{border-top:1px solid rgba(220,238,255,.08)}",
      ".wf-track{width:38px;height:22px;border-radius:999px;flex:none;background:rgba(220,238,255,.15);position:relative;transition:background .16s ease}",
      ".wf-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#dceeff;transition:transform .16s ease,background .16s ease}",
      ".wf-switch-row[aria-checked=\"true\"] .wf-track{background:#82caff}",
      ".wf-switch-row[aria-checked=\"true\"] .wf-knob{transform:translateX(16px);background:#10243a}",
      ".wf-clear{width:100%;margin-top:14px;padding:9px 0;border-radius:12px;cursor:pointer;border:1px solid rgba(220,238,255,.22);background:rgba(220,238,255,.06);color:#dceeff;font:inherit;font-weight:600;font-size:.85rem}",
      ".wf-clear:hover{border-color:rgba(220,238,255,.45);background:rgba(220,238,255,.12)}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // Each design draws one of the six arms of a snowflake, pointing up.
  // `arm` is the arm length.
  const DESIGNS = {
    // One pair of branches.
    classic: function (ctx, arm) {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -arm);
      ctx.moveTo(0, -arm * 0.55);
      ctx.lineTo(-arm * 0.28, -arm * 0.8);
      ctx.moveTo(0, -arm * 0.55);
      ctx.lineTo(arm * 0.28, -arm * 0.8);
    },
    // Two pairs of branches.
    fern: function (ctx, arm) {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -arm);
      [0.38, 0.68].forEach(function (at, index) {
        const reach = index === 0 ? 0.3 : 0.2;
        ctx.moveTo(0, -arm * at);
        ctx.lineTo(-arm * reach, -arm * (at + reach));
        ctx.moveTo(0, -arm * at);
        ctx.lineTo(arm * reach, -arm * (at + reach));
      });
    },
    // Hexagon core with arrow-tipped arms.
    star: function (ctx, arm) {
      const core = arm * 0.28;
      ctx.moveTo(0, -core);
      ctx.lineTo(core * Math.sin(Math.PI / 3), -core * Math.cos(Math.PI / 3));
      ctx.moveTo(0, -core);
      ctx.lineTo(0, -arm);
      ctx.moveTo(-arm * 0.18, -arm * 0.72);
      ctx.lineTo(0, -arm * 0.9);
      ctx.lineTo(arm * 0.18, -arm * 0.72);
    },
  };
  const DESIGN_NAMES = Object.keys(DESIGNS);

  // Flakes are pre-rendered once and drawn as images, which is much faster
  // than building paths or applying blur for every flake on every frame.
  // The soft halo is baked into the sprite with a second, wider stroke pass,
  // which is much faster than canvas shadowBlur at draw time.
  function createSprite(designs, design, color, color2) {
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;
    const ctx = sprite.getContext("2d");
    if (!ctx) throw new Error("Winterfall could not create a 2D canvas context.");

    ctx.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
    if (color2) {
      const arm = SPRITE_SIZE * ARM_RATIO;
      const gradient = ctx.createRadialGradient(0, 0, arm * 0.2, 0, 0, arm * 1.05);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color2);
      ctx.strokeStyle = gradient;
    } else {
      ctx.strokeStyle = color;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      designs[design](ctx, SPRITE_SIZE * ARM_RATIO);
      ctx.rotate(Math.PI / 3);
    }
    ctx.lineWidth = SPRITE_SIZE * 0.16;
    ctx.globalAlpha = 0.2;
    ctx.stroke();
    ctx.lineWidth = SPRITE_SIZE * 0.065;
    ctx.globalAlpha = 1;
    ctx.stroke();
    return sprite;
  }

  // ---------------------------------------------------------------------------
  // Effect
  // ---------------------------------------------------------------------------

  function create(options) {
    const settings = resolveOptions(options);
    const designs = Object.assign({}, DESIGNS, settings.customDesigns || {});
    const designNames = Object.keys(designs);
    validate(settings, designNames);
    if (!document.body) {
      throw new Error("Winterfall.create() must be called after <body> exists.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Winterfall could not create a 2D canvas context.");

    canvas.className = "snowfall-canvas";
    canvas.setAttribute("aria-hidden", "true");
    // Styles are set inline so the script works without any stylesheet.
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: String(settings.zIndex),
    });
    document.body.appendChild(canvas);

    const sprites = {};
    function rebuildSprites() {
      designNames.forEach(function (design) {
        sprites[design] = createSprite(designs, design, settings.color, settings.color2);
      });
    }
    rebuildSprites();
    const dateRange = parseDateRange(settings.activeDates);
    const motionQuery = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const storedChoice = settings.rememberChoice ? readStoredChoice() : null;

    let wantsSnow = storedChoice === null ? true : storedChoice;
    let motionBlocked = Boolean(settings.respectReducedMotion && motionQuery && motionQuery.matches);
    let seasonBlocked = !isInSeason(dateRange, new Date());
    let running = false;
    let destroyed = false;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let flakes = [];
    let ground = new Float32Array(0);
    let pointer = null;
    let gust = 0;
    let gustTarget = 0;
    let nextGustAt = 0;
    let currentPreset = options && typeof options.preset === "string" ? options.preset : "default";
    let controlsCleanup = null;
    let fade = 0;
    let transition = null;
    // Animated copies of TRANSITION_KEYS; the draw loop eases these toward
    // the target values in `settings` after a preset switch.
    const effect = {
      particleCount: settings.particleCount,
      speed: settings.speed,
      wind: settings.wind,
      gustStrength: settings.gustStrength,
    };
    let skyCanvas = null;
    let fogCanvas = null;
    let fogHeightCss = 0;
    let gyroWindOffset = 0;
    let gyroListenerActive = false;
    let pointerIdleTimeout = 0;
    // Fixed per-column noise so melting shrinks unevenly, like real snow.
    let meltNoise = new Float32Array(0);

    // --- Flakes -------------------------------------------------------------

    function pickDesign() {
      if (settings.shape === "all") return designNames[Math.floor(Math.random() * designNames.length)];
      return settings.shape;
    }

    // `z` (0 = far, 1 = near) drives size, speed and opacity to fake depth.
    function resetFlake(flake, randomY) {
      const depth = 0.4 + flake.z * 0.8;
      flake.radius = settings.minSize + (flake.z * 0.8 + Math.random() * 0.2) * (settings.maxSize - settings.minSize);
      flake.design = pickDesign();
      // A minimum size keeps tiny flakes from looking like plain dots.
      flake.drawSize = Math.max(MIN_FLAKE_SIZE, (flake.radius * 2.5) / ARM_RATIO);
      flake.x = Math.random() * width;
      flake.y = randomY ? Math.random() * height : -flake.drawSize;
      flake.fallSpeed = (0.6 + Math.random() * 0.5) * depth * effect.speed;
      flake.vx = 0;
      flake.vy = 0;
      flake.caught = 0;
      flake.phase = Math.random() * Math.PI * 2;
      flake.wobble = 0.005 + Math.random() * 0.015;
      flake.rotation = Math.random() * Math.PI * 2;
      flake.spin = (Math.random() - 0.5) * 0.03;
      flake.opacity = 0.3 + flake.z * 0.6 + Math.random() * 0.1;
      return flake;
    }

    function makeFlake() {
      // Bias toward distant flakes for a more natural look.
      return resetFlake({ z: Math.pow(Math.random(), 1.4) }, true);
    }

    function targetCount() {
      if (!settings.autoScale) return Math.round(effect.particleCount);
      const areaRatio = (width * height) / (1440 * 900);
      return Math.max(1, Math.round(effect.particleCount * Math.min(1, Math.max(0.35, areaRatio))));
    }

    function syncFlakeCount() {
      const target = targetCount();
      if (flakes.length === target) return;
      if (flakes.length > target) {
        flakes.length = target;
        return;
      }
      while (flakes.length < target) flakes.push(makeFlake());
      flakes.sort(function (a, b) {
        return a.z - b.z;
      });
    }

    // --- Accumulated snow ---------------------------------------------------

    // `heightRatio` keeps the drift at the same level when the viewport height changes.
    function resizeGround(heightRatio) {
      const columns = Math.max(1, Math.ceil(width / GROUND_COLUMN) + 1);
      const next = new Float32Array(columns);
      const nextNoise = new Float32Array(columns);
      for (let i = 0; i < columns; i += 1) {
        nextNoise[i] = Math.random();
      }
      if (ground.length > 0) {
        const ratio = isNumberInRange(heightRatio, 0, 100) ? heightRatio : 1;
        for (let i = 0; i < columns; i += 1) {
          next[i] = Math.min(settings.maxAccumulation, ground[Math.floor((i * ground.length) / columns)] * ratio);
        }
      }
      ground = next;
      meltNoise = nextNoise;
    }

    function groundHeightAt(x) {
      if (ground.length === 0) return 0;
      const index = Math.max(0, Math.min(ground.length - 1, Math.round(x / GROUND_COLUMN)));
      return ground[index];
    }

    // Drifts slowly shrink on their own and faster under a warm pointer.
    function meltGround(frameScale) {
      const pointerMelt = settings.interactive && pointer !== null;
      if (!settings.melt && !pointerMelt) return;
      const radius = 60;
      for (let i = 0; i < ground.length; i += 1) {
        if (ground[i] <= 0) continue;
        let melt = settings.melt ? settings.meltRate * (0.5 + meltNoise[i]) * frameScale : 0;
        if (pointerMelt) {
          const distance = Math.abs(i * GROUND_COLUMN - pointer.x);
          if (distance < radius) melt += settings.meltRate * 8 * (1 - distance / radius) * frameScale;
        }
        ground[i] = Math.max(0, ground[i] - melt);
      }
    }

    function deposit(x, amount) {
      const center = Math.round(x / GROUND_COLUMN);
      for (let k = -2; k <= 2; k += 1) {
        const i = center + k;
        if (i < 0 || i >= ground.length) continue;
        ground[i] = Math.min(settings.maxAccumulation, ground[i] + amount * DEPOSIT_WEIGHTS[k + 2]);
      }
    }

    // Lets steep piles slide into neighbouring columns so the drift stays smooth.
    function settleGround() {
      for (let i = 1; i < ground.length; i += 1) {
        const diff = ground[i] - ground[i - 1];
        if (Math.abs(diff) > 1) {
          const transfer = diff * 0.2;
          ground[i] -= transfer;
          ground[i - 1] += transfer;
        }
      }
    }

    function drawGround() {
      if (ground.length === 0) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = settings.color;

      // The snow pile grows upward from the screen bottom. A small sinusoidal
      // wobble keeps the top edge organic instead of a straight bar.
      const topAt = function (i) {
        return height - ground[i] + Math.sin(i * 1.7) * 1.2 * Math.min(1, ground[i] / 8);
      };

      // Traced twice: once to fill the drift, once to clip the feather pass so
      // it only erases drift pixels and never carves a band through falling flakes.
      const traceDrift = function () {
        context.beginPath();
        context.moveTo(0, height);
        context.lineTo(0, topAt(0));
        for (let i = 1; i < ground.length; i += 1) {
          const prevX = (i - 1) * GROUND_COLUMN;
          const midX = prevX + GROUND_COLUMN / 2;
          context.quadraticCurveTo(prevX, topAt(i - 1), midX, (topAt(i - 1) + topAt(i)) / 2);
        }
        context.lineTo(width, topAt(ground.length - 1));
        context.lineTo(width, height);
        context.closePath();
      };

      let highest = Infinity;
      for (let i = 1; i < ground.length; i += 1) {
        if (ground[i] > 1) highest = Math.min(highest, topAt(i));
      }

      context.globalAlpha = 0.95 * fade;
      traceDrift();
      context.fill();

      // Frosted top edge: a soft highlight that follows only the snowy segments.
      context.globalAlpha = 0.25 * fade;
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.4;
      context.beginPath();
      let penDown = false;
      let prevTop = 0;
      for (let i = 0; i < ground.length; i += 1) {
        if (ground[i] <= 1) {
          penDown = false;
          continue;
        }
        const x = i * GROUND_COLUMN;
        const top = topAt(i);
        if (!penDown) {
          context.moveTo(x, top);
          penDown = true;
        } else {
          context.quadraticCurveTo(x - GROUND_COLUMN, prevTop, x - GROUND_COLUMN / 2, (prevTop + top) / 2);
        }
        prevTop = top;
      }
      context.stroke();

      // Feather the very top of the pile so it never reads as a hard bar.
      // Clipped to the drift so the transparent gradient only softens snow
      // pixels, not flakes falling above the pile.
      if (highest !== Infinity) {
        context.save();
        traceDrift();
        context.clip();
        context.globalCompositeOperation = "destination-out";
        const feather = context.createLinearGradient(0, highest - 5, 0, highest + 7);
        feather.addColorStop(0, "rgba(0, 0, 0, 1)");
        feather.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = feather;
        context.fillRect(0, highest - 5, width, 12);
        context.restore();
      }

      // Sparse glitter dots on the drift surface; their per-frame randomness
      // reads as snow sparkling in the light.
      context.globalAlpha = 0.18 * fade;
      for (let i = 0; i < ground.length; i += 3) {
        const h = ground[i];
        if (h <= 2) continue;
        context.fillRect(
          i * GROUND_COLUMN + Math.random() * GROUND_COLUMN,
          height - Math.random() * h,
          1.4,
          1.4
        );
      }
    }

    // --- Scenery (moon, stars, fog) -------------------------------------------

    function renderSky() {
      skyCanvas = null;
      if (!settings.moon && settings.stars <= 0) return;
      skyCanvas = document.createElement("canvas");
      skyCanvas.width = Math.max(1, Math.round(width * pixelRatio));
      skyCanvas.height = Math.max(1, Math.round(height * pixelRatio));
      const sctx = skyCanvas.getContext("2d");
      if (!sctx) {
        skyCanvas = null;
        return;
      }
      sctx.scale(pixelRatio, pixelRatio);
      for (let i = 0; i < settings.stars; i += 1) {
        sctx.globalAlpha = 0.3 + Math.random() * 0.5;
        sctx.fillStyle = settings.color;
        sctx.beginPath();
        sctx.arc(Math.random() * width, Math.random() * height * 0.7, 0.4 + Math.random() * 1.2, 0, Math.PI * 2);
        sctx.fill();
      }
      if (settings.moon) {
        const moonRadius = Math.min(width, height) * 0.07;
        const moonX = width - moonRadius * 2.4;
        const moonY = moonRadius * 2.2;
        const glow = sctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 2.6);
        glow.addColorStop(0, "rgba(255, 252, 232, 0.95)");
        glow.addColorStop(0.3, "rgba(255, 248, 214, 0.3)");
        glow.addColorStop(1, "rgba(255, 248, 214, 0)");
        sctx.globalAlpha = 1;
        sctx.fillStyle = glow;
        sctx.beginPath();
        sctx.arc(moonX, moonY, moonRadius * 2.6, 0, Math.PI * 2);
        sctx.fill();
      }
    }

    function renderFog() {
      fogCanvas = null;
      fogHeightCss = 0;
      if (settings.fog <= 0 || height <= 0) return;
      fogHeightCss = Math.max(1, Math.round(height * 0.25));
      fogCanvas = document.createElement("canvas");
      fogCanvas.width = Math.max(1, Math.round(width * pixelRatio));
      fogCanvas.height = Math.max(1, Math.round(fogHeightCss * pixelRatio));
      const fctx = fogCanvas.getContext("2d");
      if (!fctx) {
        fogCanvas = null;
        return;
      }
      fctx.scale(pixelRatio, pixelRatio);
      const gradient = fctx.createLinearGradient(0, 0, 0, fogHeightCss);
      gradient.addColorStop(0, "rgba(226, 238, 250, 0)");
      gradient.addColorStop(1, "rgba(226, 238, 250, 0.9)");
      fctx.fillStyle = gradient;
      fctx.fillRect(0, 0, width, fogHeightCss);
    }

    function refreshScenery() {
      renderSky();
      renderFog();
    }

    // --- Animation ----------------------------------------------------------

    function clearCanvas() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    function updateWind(timestamp, frameScale) {
      if (settings.gusts && effect.gustStrength > 0) {
        if (timestamp >= nextGustAt) {
          gustTarget = (Math.random() * 2 - 1) * effect.gustStrength;
          nextGustAt = timestamp + 2500 + Math.random() * 5000;
          if (settings.onGustStart) settings.onGustStart(gustTarget);
        }
        // Small per-frame jitter keeps the breeze alive without long flat pauses.
        gustTarget = Math.max(
          -effect.gustStrength,
          Math.min(effect.gustStrength, gustTarget + (Math.random() - 0.5) * 0.1 * effect.gustStrength * frameScale)
        );
      } else {
        gustTarget = 0;
      }
      gust += (gustTarget - gust) * Math.min(1, 0.01 * frameScale);
    }

    function updateTransition(timestamp, frameScale) {
      if (!transition) return;
      if (transition.startedAt === null) transition.startedAt = timestamp;
      const t = Math.min(1, (timestamp - transition.startedAt) / TRANSITION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      TRANSITION_KEYS.forEach(function (key) {
        effect[key] = transition.from[key] + (transition.to[key] - transition.from[key]) * eased;
      });
      if (t >= 1) transition = null;
    }

    // Radial impulse that scatters flakes away from a click or tap point.
    function burstAt(x, y) {
      const radius = settings.burstRadius;
      const radiusSquared = radius * radius;
      for (let i = 0; i < flakes.length; i += 1) {
        const flake = flakes[i];
        const dx = flake.x - x;
        const dy = flake.y - y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= radiusSquared || distanceSquared < 0.01) continue;
        const distance = Math.sqrt(distanceSquared);
        const force = (1 - distance / radius) * settings.burstStrength;
        flake.vx += (dx / distance) * force;
        flake.vy += (dy / distance) * force - force * 0.5;
      }
    }

    function draw(timestamp) {
      if (document.hidden) {
        animationFrame = 0;
        return;
      }

      const frameScale = lastFrameTime === 0 ? 1 : Math.min((timestamp - lastFrameTime) / 16.67, 3);
      lastFrameTime = timestamp;

      // Ease the canvas in and out instead of popping the snow on and off.
      const fadeStep = (frameScale * 16.67) / Math.max(1, settings.fadeDuration);
      fade = running ? Math.min(1, fade + fadeStep) : Math.max(0, fade - fadeStep);
      if (!running && fade === 0) {
        animationFrame = 0;
        clearCanvas();
        return;
      }

      updateWind(timestamp, frameScale);
      updateTransition(timestamp, frameScale);
      syncFlakeCount();

      const wind = effect.wind + gust + (settings.gyroWind ? gyroWindOffset : 0);
      const radius = settings.interactionRadius;
      const radiusSquared = radius * radius;
      const canInteract = settings.interactive && pointer !== null && radius > 0;
      const catchRadius = settings.catchRadius;
      const catchRadiusSquared = catchRadius * catchRadius;
      const canCatch = canInteract && catchRadius > 0;
      const damping = Math.pow(0.94, frameScale);

      clearCanvas();

      if (skyCanvas) {
        // Whole-canvas alpha oscillation reads as stars twinkling.
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = (0.75 + 0.25 * Math.sin(timestamp * 0.0012)) * fade;
        context.drawImage(skyCanvas, 0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < flakes.length; i += 1) {
        const flake = flakes[i];
        const depth = 0.4 + flake.z * 0.8;

        flake.phase += flake.wobble * frameScale;
        flake.rotation += flake.spin * frameScale;
        flake.vx *= damping;
        flake.vy *= damping;
        // Gravity pulls burst flakes back down.
        flake.vy = Math.min(flake.vy + 0.06 * frameScale, 4);

        if (canInteract) {
          const dx = flake.x - pointer.x;
          const dy = flake.y - pointer.y;
          const distanceSquared = dx * dx + dy * dy;
          if (canCatch) {
            flake.caught = distanceSquared < catchRadiusSquared
              ? Math.min(1, flake.caught + 0.08 * frameScale)
              : Math.max(0, flake.caught - 0.04 * frameScale);
          }
          if (distanceSquared < radiusSquared && distanceSquared > 0.01) {
            const distance = Math.sqrt(distanceSquared);
            const force = (1 - distance / radius) * frameScale;
            flake.vx += (dx / distance) * force * 0.8;
            flake.y += (dy / distance) * force * 1.5;
          }
        } else if (flake.caught > 0) {
          flake.caught = Math.max(0, flake.caught - 0.04 * frameScale);
        }

        const previousY = flake.y;
        flake.x += (wind * depth + Math.sin(flake.phase) * 0.35 + flake.vx) * frameScale;
        flake.y += (flake.fallSpeed * (1 - 0.85 * flake.caught) + flake.vy) * frameScale;

        const margin = flake.drawSize;
        const pileTop = height - groundHeightAt(flake.x);
        // Land while falling anywhere inside the pile's vertical span: this
        // catches flakes crossing the pile top as well as flakes that spawned
        // inside the drift.
        const insidePile = flake.y + flake.radius >= pileTop && flake.y - flake.radius <= height;
        if (settings.accumulate && flake.z > 0.35 && insidePile && previousY <= flake.y) {
          deposit(flake.x, flake.radius * 0.8 * settings.accumulationRate);
          if (settings.onFlakeLand) settings.onFlakeLand(flake.x);
          resetFlake(flake, false);
        } else if (flake.y - margin > height) {
          resetFlake(flake, false);
        }
        if (flake.x < -margin) flake.x = width + margin;
        else if (flake.x > width + margin) flake.x = -margin;

        const cos = Math.cos(flake.rotation) * pixelRatio;
        const sin = Math.sin(flake.rotation) * pixelRatio;
        const size = flake.drawSize;
        context.setTransform(cos, sin, -sin, cos, flake.x * pixelRatio, flake.y * pixelRatio);
        context.globalAlpha = flake.opacity * fade;
        context.drawImage(sprites[flake.design], -size / 2, -size / 2, size, size);
      }

      if (settings.accumulate) {
        meltGround(frameScale);
        settleGround();
        drawGround();
      }

      if (fogCanvas) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = settings.fog * fade;
        context.drawImage(fogCanvas, 0, height - fogHeightCss, width, fogHeightCss);
      }

      context.globalAlpha = 1;
      animationFrame = global.requestAnimationFrame(draw);
    }

    function sync(notify) {
      const wasRunning = running;
      running = !destroyed && wantsSnow && !motionBlocked && !seasonBlocked;
      // Keep animating while fading out so the snow dissolves instead of popping away.
      const shouldAnimate = (running || fade > 0) && !document.hidden;

      if (shouldAnimate && animationFrame === 0) {
        lastFrameTime = 0;
        animationFrame = global.requestAnimationFrame(draw);
      } else if (!shouldAnimate && animationFrame !== 0) {
        global.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      if (!running && fade === 0) clearCanvas();
      if (notify && wasRunning !== running && settings.onChange) settings.onChange(running);
    }

    function resize() {
      const previousWidth = width;
      const previousHeight = height;
      pixelRatio = Math.min(global.devicePixelRatio || 1, 2);
      width = global.innerWidth;
      height = global.innerHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      if (previousWidth > 0 && previousHeight > 0) {
        flakes.forEach(function (flake) {
          flake.x = (flake.x / previousWidth) * width;
          flake.y = (flake.y / previousHeight) * height;
        });
      }
      syncFlakeCount();
      resizeGround(previousHeight > 0 ? height / previousHeight : 1);
      refreshScenery();
    }

    // --- Events -------------------------------------------------------------

    function handleVisibilityChange() {
      sync(false);
    }

    function handleMotionChange(event) {
      motionBlocked = Boolean(settings.respectReducedMotion && event.matches);
      sync(true);
    }

    function handlePointerDown(event) {
      // Clicks on the floating controls adjust settings; bursting snow behind
      // them (or while dragging the button) reads as a glitch.
      if (event.target && event.target.closest && event.target.closest(".wf-controls, .wf-panel")) return;
      // iOS only grants orientation access from an explicit user gesture.
      if (settings.gyroWind && !gyroListenerActive && global.DeviceOrientationEvent) {
        const request = global.DeviceOrientationEvent.requestPermission;
        if (typeof request === "function") {
          try {
            const result = request.call(global.DeviceOrientationEvent);
            if (result && typeof result.then === "function") {
              result.then(function () { syncGyroListener(); }).catch(function () {});
            }
          } catch (error) {
            // Permission API unavailable or already decided; the listener
            // setup below is attempted anyway.
          }
        }
        syncGyroListener();
      }
      if (settings.burst) burstAt(event.clientX, event.clientY);
    }

    function handlePointerMove(event) {
      pointer = { x: event.clientX, y: event.clientY };
      // Touch never fires a reliable pointerup on every device; release the
      // pointer after a short idle period so flakes do not hover in place.
      if (event.pointerType !== "mouse") {
        if (pointerIdleTimeout) global.clearTimeout(pointerIdleTimeout);
        pointerIdleTimeout = global.setTimeout(function () {
          pointer = null;
          pointerIdleTimeout = 0;
        }, 600);
      }
    }

    function handlePointerEnd(event) {
      if (event.type === "mouseout" && event.relatedTarget) return;
      if (event.type === "pointerup" && event.pointerType === "mouse") return;
      pointer = null;
    }

    function handleDeviceOrientation(event) {
      if (typeof event.gamma === "number") {
        gyroWindOffset = Math.max(-3, Math.min(3, (event.gamma / 45) * 2));
      }
    }

    function syncGyroListener() {
      const want = Boolean(settings.gyroWind && global.DeviceOrientationEvent);
      if (want && !gyroListenerActive) {
        global.addEventListener("deviceorientation", handleDeviceOrientation);
        gyroListenerActive = true;
      } else if (!want && gyroListenerActive) {
        global.removeEventListener("deviceorientation", handleDeviceOrientation);
        gyroListenerActive = false;
        gyroWindOffset = 0;
      }
    }

    function addPointerListeners() {
      document.addEventListener("pointerdown", handlePointerDown, { passive: true });
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerup", handlePointerEnd, { passive: true });
      document.addEventListener("pointercancel", handlePointerEnd, { passive: true });
      document.addEventListener("mouseout", handlePointerEnd, { passive: true });
    }

    function removePointerListeners() {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
      document.removeEventListener("mouseout", handlePointerEnd);
    }

    // --- Runtime option updates ---------------------------------------------

    function updateOptions(options) {
      if (destroyed) return instance;
      const input = options ? Object.assign({}, options) : {};
      // resolveOptions validates the preset name and throws for unknown ones.
      const presetName = typeof input.preset === "string" ? input.preset : currentPreset;
      const presetChange = presetName !== currentPreset;
      // Start from defaults + preset. A preset switch takes its look options
      // from the new preset; anything else carries over from the current
      // settings unless explicitly replaced. Without a preset switch the
      // current settings carry over wholesale, so toggling one feature does
      // not reset sliders the user already adjusted.
      const next = resolveOptions({ preset: presetName });
      Object.keys(settings).forEach(function (key) {
        const carriedOver = !presetChange || LOOK_KEYS.indexOf(key) === -1;
        if (carriedOver && !Object.prototype.hasOwnProperty.call(input, key)) {
          next[key] = settings[key];
        }
      });
      Object.keys(input).forEach(function (key) {
        if (key !== "preset") next[key] = input[key];
      });
      // Create-only options carry over unless explicitly replaced.
      CREATE_ONLY_KEYS.forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) next[key] = settings[key];
      });
      if (!Object.prototype.hasOwnProperty.call(input, "onChange")) next.onChange = settings.onChange;
      validate(next, designNames);

      const flakesNeedReset =
        next.color !== settings.color ||
        next.color2 !== settings.color2 ||
        FLAKE_KEYS.some(function (key) { return next[key] !== settings[key]; });
      const sceneryChanged =
        next.moon !== settings.moon ||
        next.stars !== settings.stars ||
        next.fog !== settings.fog ||
        next.color !== settings.color;
      const accumulationStopped = settings.accumulate && !next.accumulate;
      // Pointer listeners carry interaction, click bursts and the iOS gyro
      // permission gesture, so they stay attached while any of those is on.
      const pointerListening = settings.interactive || settings.burst || settings.gyroWind;
      const nextPointerListening = next.interactive || next.burst || next.gyroWind;
      const interactiveChanged = nextPointerListening !== pointerListening;

      Object.assign(settings, next);
      currentPreset = presetName;

      if (presetChange && TRANSITION_KEYS.some(function (key) { return settings[key] !== effect[key]; })) {
        transition = { startedAt: null, from: {}, to: {} };
        TRANSITION_KEYS.forEach(function (key) {
          transition.from[key] = effect[key];
          transition.to[key] = settings[key];
        });
      } else {
        transition = null;
        TRANSITION_KEYS.forEach(function (key) {
          effect[key] = settings[key];
        });
      }

      if (interactiveChanged) {
        if (settings.interactive || settings.burst || settings.gyroWind) addPointerListeners();
        else {
          removePointerListeners();
          pointer = null;
        }
      }
      syncGyroListener();
      if (accumulationStopped) ground.fill(0);
      if (flakesNeedReset) {
        rebuildSprites();
        flakes.forEach(function (flake) {
          const x = flake.x;
          const y = flake.y;
          resetFlake(flake, true);
          flake.x = x;
          flake.y = y;
        });
        flakes.sort(function (a, b) { return a.z - b.z; });
      }
      if (sceneryChanged) refreshScenery();
      syncFlakeCount();
      sync(true);
      return instance;
    }

    // --- Floating controls ----------------------------------------------------

    function buildControls() {
      injectControlsStyles();

      const BUTTON_SIZE = 52;
      const clampX = function (value) { return Math.max(0, Math.min(global.innerWidth - BUTTON_SIZE, value)); };
      const clampY = function (value) { return Math.max(0, Math.min(global.innerHeight - BUTTON_SIZE, value)); };
      const stored = readStoredPosition();
      const position = stored || { x: global.innerWidth - BUTTON_SIZE - 22, y: global.innerHeight - BUTTON_SIZE - 22 };

      const controlsRoot = makeElement("div", "wf-controls");
      const panel = makeElement("div", "wf-panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Winterfall controls");
      const toggleButton = makeElement("button", "wf-controls-btn");
      toggleButton.type = "button";
      toggleButton.setAttribute("aria-label", "Snow controls");
      toggleButton.setAttribute("aria-expanded", "false");
      toggleButton.appendChild(createSnowflakeIcon());
      controlsRoot.appendChild(toggleButton);
      controlsRoot.style.zIndex = String(settings.zIndex + 1);
      panel.style.zIndex = String(settings.zIndex + 1);

      // --- Panel content -------------------------------------------------------

      const header = makeElement("div", "wf-header");
      header.appendChild(makeElement("span", "wf-title", "Winterfall"));
      const closeButton = makeElement("button", "wf-close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close controls");
      header.appendChild(closeButton);
      panel.appendChild(header);

      const masterRow = makeElement("button", "wf-switch-row");
      masterRow.type = "button";
      masterRow.setAttribute("role", "switch");
      masterRow.appendChild(makeElement("span", null, "Snowfall"));
      const masterTrack = makeElement("span", "wf-track");
      masterTrack.appendChild(makeElement("span", "wf-knob"));
      masterRow.appendChild(masterTrack);
      panel.appendChild(masterRow);

      panel.appendChild(makeElement("div", "wf-label", "Preset"));
      const chipsRow = makeElement("div", "wf-chips");
      const presetButtons = {};
      Object.keys(presets).forEach(function (name) {
        const chip = makeElement("button", "wf-chip", name.charAt(0).toUpperCase() + name.slice(1));
        chip.type = "button";
        chip.setAttribute("aria-pressed", "false");
        chip.addEventListener("click", function () {
          instance.update({ preset: name });
          refresh();
        });
        presetButtons[name] = chip;
        chipsRow.appendChild(chip);
      });
      panel.appendChild(chipsRow);

      const sliderDefs = [
        { label: "Intensity", min: 10, max: 500, step: 10, key: "particleCount", format: function (v) { return String(Math.round(v)); } },
        { label: "Speed", min: 0.2, max: 5, step: 0.1, key: "speed", format: function (v) { return v.toFixed(1) + "\u00d7"; } },
        { label: "Wind", min: -5, max: 5, step: 0.1, key: "wind", format: function (v) { return (v > 0 ? "+" : "") + v.toFixed(1); } },
        { label: "Fog", min: 0, max: 100, step: 5, key: "fog", scale: 100, format: function (v) { return Math.round(v) + "%"; } },
      ];
      const sliders = sliderDefs.map(function (def) {
        const scale = def.scale || 1;
        const labelRow = makeElement("div", "wf-label-row");
        labelRow.appendChild(makeElement("span", "wf-label", def.label));
        const value = makeElement("span", "wf-value");
        labelRow.appendChild(value);
        panel.appendChild(labelRow);
        const input = makeElement("input", "wf-range");
        input.type = "range";
        input.min = String(def.min);
        input.max = String(def.max);
        input.step = String(def.step);
        input.setAttribute("aria-label", def.label);
        panel.appendChild(input);
        return { key: def.key, scale: scale, format: def.format, input: input, value: value };
      });
      sliders.forEach(function (slider) {
        slider.input.addEventListener("input", function () {
          const v = Number(slider.input.value) / slider.scale;
          slider.value.textContent = slider.format(Number(slider.input.value));
          instance.update((function () { const o = {}; o[slider.key] = v; return o; })());
        });
      });

      panel.appendChild(makeElement("div", "wf-label", "Features"));
      const gyroSupported = typeof global.DeviceOrientationEvent !== "undefined";
      const featureDefs = [
        { label: "Wind gusts", key: "gusts" },
        { label: "Interactive", key: "interactive" },
        { label: "Snowdrifts", key: "accumulate" },
        { label: "Melting", key: "melt" },
        { label: "Click burst", key: "burst" },
        {
          // The switch drives both options so the sky never shows stars alone.
          label: "Moon & stars",
          key: "moon",
          turnOn: { moon: true, stars: 60 },
          turnOff: { moon: false, stars: 0 },
        },
        gyroSupported ? { label: "Tilt wind (gyro)", key: "gyroWind" } : null,
      ].filter(Boolean);
      const featureSwitches = featureDefs.map(function (def) {
        const row = makeElement("button", "wf-switch-row");
        row.type = "button";
        row.setAttribute("role", "switch");
        row.appendChild(makeElement("span", null, def.label));
        const track = makeElement("span", "wf-track");
        track.appendChild(makeElement("span", "wf-knob"));
        row.appendChild(track);
        row.addEventListener("click", function () {
          if (def.turnOn) {
            instance.update(settings[def.key] ? def.turnOff : def.turnOn);
          } else {
            const update = {};
            update[def.key] = !settings[def.key];
            instance.update(update);
          }
          refresh();
        });
        panel.appendChild(row);
        return { key: def.key, row: row };
      });

      const clearButton = makeElement("button", "wf-clear", "Clear accumulated snow");
      clearButton.type = "button";
      clearButton.addEventListener("click", function () {
        instance.clearSnow();
      });
      panel.appendChild(clearButton);

      document.body.appendChild(controlsRoot);
      document.body.appendChild(panel);
      panel.hidden = true;

      // --- Behavior ------------------------------------------------------------

      let controlsOpen = false;

      function refresh() {
        masterRow.setAttribute("aria-checked", String(instance.isEnabled()));
        Object.keys(presetButtons).forEach(function (name) {
          presetButtons[name].setAttribute("aria-pressed", String(name === currentPreset));
        });
        sliders.forEach(function (slider) {
          slider.input.value = String(settings[slider.key] * slider.scale);
          slider.value.textContent = slider.format(settings[slider.key] * slider.scale);
        });
        featureSwitches.forEach(function (sw) {
          sw.row.setAttribute("aria-checked", String(Boolean(settings[sw.key])));
        });
      }

      function applyPosition() {
        controlsRoot.style.transform = "translate(" + position.x + "px, " + position.y + "px)";
      }

      function placePanel() {
        const buttonRect = toggleButton.getBoundingClientRect();
        panel.style.left = "0px";
        panel.style.top = "0px";
        const panelRect = panel.getBoundingClientRect();
        const gap = 12;
        let left = buttonRect.left + buttonRect.width / 2 - panelRect.width / 2;
        left = Math.max(8, Math.min(global.innerWidth - panelRect.width - 8, left));
        let top = buttonRect.top - panelRect.height - gap;
        if (top < 8) top = buttonRect.bottom + gap;
        panel.style.left = left + "px";
        panel.style.top = top + "px";
      }

      function openPanel() {
        controlsOpen = true;
        toggleButton.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        // Measure while invisible so the panel does not flash at the corner.
        panel.style.visibility = "hidden";
        placePanel();
        panel.style.visibility = "";
        refresh();
      }

      function closePanel() {
        controlsOpen = false;
        toggleButton.setAttribute("aria-expanded", "false");
        panel.hidden = true;
      }

      function togglePanel() {
        if (controlsOpen) closePanel();
        else openPanel();
      }

      let dragState = null;

      toggleButton.addEventListener("pointerdown", function (event) {
        if (event.button !== undefined && event.button !== 0) return;
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y,
          moved: false,
        };
        if (toggleButton.setPointerCapture) toggleButton.setPointerCapture(event.pointerId);
      });
      toggleButton.addEventListener("pointermove", function (event) {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (!dragState.moved && Math.sqrt(dx * dx + dy * dy) < 6) return;
        dragState.moved = true;
        position.x = clampX(dragState.originX + dx);
        position.y = clampY(dragState.originY + dy);
        applyPosition();
        if (controlsOpen) placePanel();
      });
      toggleButton.addEventListener("pointerup", function (event) {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        const wasDrag = dragState.moved;
        dragState = null;
        if (wasDrag) storePosition(position);
        else togglePanel();
      });
      toggleButton.addEventListener("pointercancel", function () {
        dragState = null;
      });
      // Keyboard activation fires click with detail 0; mouse clicks are handled
      // in pointerup so a drag does not also toggle the panel.
      toggleButton.addEventListener("click", function (event) {
        if (!event.detail) togglePanel();
      });

      masterRow.addEventListener("click", function () {
        instance.toggle();
        refresh();
      });
      closeButton.addEventListener("click", closePanel);

      function handleDocumentPointerDown(event) {
        if (!controlsOpen) return;
        if (panel.contains(event.target) || controlsRoot.contains(event.target)) return;
        closePanel();
      }
      function handleDocumentKeydown(event) {
        if (event.key === "Escape" && controlsOpen) closePanel();
      }
      function handleControlsResize() {
        position.x = clampX(position.x);
        position.y = clampY(position.y);
        applyPosition();
        if (controlsOpen) placePanel();
      }
      document.addEventListener("pointerdown", handleDocumentPointerDown, { passive: true });
      document.addEventListener("keydown", handleDocumentKeydown);
      global.addEventListener("resize", handleControlsResize);

      // Keep the master switch in sync when the effect is toggled elsewhere.
      const userOnChange = settings.onChange;
      settings.onChange = function (isEnabled) {
        refresh();
        if (userOnChange) userOnChange(isEnabled);
      };

      applyPosition();
      refresh();

      return {
        destroy: function () {
          global.removeEventListener("resize", handleControlsResize);
          document.removeEventListener("pointerdown", handleDocumentPointerDown);
          document.removeEventListener("keydown", handleDocumentKeydown);
          panel.remove();
          controlsRoot.remove();
        },
      };
    }

    global.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (motionQuery) {
      if (motionQuery.addEventListener) motionQuery.addEventListener("change", handleMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(handleMotionChange);
    }
    if (settings.interactive || settings.burst || settings.gyroWind) addPointerListeners();
    syncGyroListener();

    resize();
    sync(false);

    // --- Public API ---------------------------------------------------------

    function persist() {
      if (settings.rememberChoice) storeChoice(wantsSnow);
    }

    const instance = {
      start: function () {
        if (destroyed) return;
        // An explicit start overrides reduced motion and the active date range.
        wantsSnow = true;
        motionBlocked = false;
        seasonBlocked = false;
        persist();
        sync(true);
      },
      stop: function () {
        if (destroyed) return;
        wantsSnow = false;
        persist();
        sync(true);
      },
      toggle: function () {
        if (running) instance.stop();
        else instance.start();
        return running;
      },
      isEnabled: function () {
        return running;
      },
      update: updateOptions,
      clearSnow: function () {
        ground.fill(0);
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (controlsCleanup) {
          controlsCleanup.destroy();
          controlsCleanup = null;
        }
        if (pointerIdleTimeout) {
          global.clearTimeout(pointerIdleTimeout);
          pointerIdleTimeout = 0;
        }
        if (gyroListenerActive) {
          global.removeEventListener("deviceorientation", handleDeviceOrientation);
          gyroListenerActive = false;
        }
        sync(true);
        global.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (motionQuery) {
          if (motionQuery.removeEventListener) motionQuery.removeEventListener("change", handleMotionChange);
          else if (motionQuery.removeListener) motionQuery.removeListener(handleMotionChange);
        }
        removePointerListeners();
        canvas.remove();
        flakes = [];
      },
    };

    if (settings.controls) controlsCleanup = buildControls();

    return instance;
  }

  // ---------------------------------------------------------------------------
  // Zero-config setup: <script src="snowfall.js" data-auto data-preset="..."></script>
  // ---------------------------------------------------------------------------

  function readDataOptions(element) {
    const options = {};
    Object.keys(element.dataset).forEach(function (key) {
      const value = element.dataset[key];
      if (key === "preset") {
        options.preset = value;
      } else if (key === "activeDates") {
        const parts = value.split("..");
        options.activeDates = { from: parts[0], to: parts[1] };
      } else if (Object.prototype.hasOwnProperty.call(defaults, key) &&
        key !== "onChange" && key !== "onGustStart" && key !== "onFlakeLand" && key !== "customDesigns") {
        const type = typeof defaults[key];
        if (type === "number") options[key] = Number(value);
        else if (type === "boolean") options[key] = value !== "false";
        else options[key] = value;
      }
    });
    return options;
  }

  const api = {
    version: VERSION,
    presets: Object.freeze(Object.keys(presets)),
    create: create,
    instance: null,
  };

  const currentScript = document.currentScript;
  if (currentScript && (currentScript.hasAttribute("data-auto") || currentScript.hasAttribute("data-preset"))) {
    const autoInit = function () {
      api.instance = create(readDataOptions(currentScript));
    };
    if (document.body) autoInit();
    else document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  }

  global.Winterfall = api;
  // Backwards-compatible alias for v1.
  global.Snowfall = api;
})(window, document);
