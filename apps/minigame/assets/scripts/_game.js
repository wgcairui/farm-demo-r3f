// ../../packages/game/src/index.ts
var CROPS = {
  carrot: { id: "carrot", name: "\u80E1\u841D\u535C", emoji: "\u{1F955}", seedPrice: 10, sellPrice: 25, stageMs: [1e4, 15e3] },
  corn: { id: "corn", name: "\u7389\u7C73", emoji: "\u{1F33D}", seedPrice: 20, sellPrice: 55, stageMs: [2e4, 3e4] }
};
function stageOf(plot, now) {
  if (plot.state === "withered" || plot.state === "empty") return plot.state;
  if (!plot.crop || !plot.plantedAt) return "empty";
  const def = CROPS[plot.crop];
  const elapsed = Math.max(0, now - plot.plantedAt);
  if (elapsed < def.stageMs[0]) return "sown";
  if (elapsed < def.stageMs[0] + def.stageMs[1]) return "growing";
  return "mature";
}
function progressOf(plot, now) {
  if (!plot.crop || !plot.plantedAt) return 0;
  const def = CROPS[plot.crop];
  const total = def.stageMs[0] + def.stageMs[1];
  return Math.min(1, Math.max(0, (now - plot.plantedAt) / total));
}
var PLOT_COUNT = 6;
var WITHER_RECOVER_MS = 8e3;
var KEY = "farm-demo-v2";
var KEY_V1 = "farm-demo-v1";
function isPlot(v) {
  if (typeof v !== "object" || v === null) return false;
  const p = v;
  const cropOk = p.crop === null || typeof p.crop === "string" && p.crop in CROPS;
  const timeOk = p.plantedAt === null || typeof p.plantedAt === "number" && Number.isFinite(p.plantedAt);
  const stateOk = typeof p.state === "string" && ("empty" === p.state || "sown" === p.state || "sprout" === p.state || "growing" === p.state || "mature" === p.state || "withered" === p.state);
  const witheredOk = p.witheredAt === null || typeof p.witheredAt === "number" && Number.isFinite(p.witheredAt);
  return cropOk && timeOk && stateOk && witheredOk;
}
function isPlotV1(v) {
  if (typeof v !== "object" || v === null) return false;
  const p = v;
  const cropOk = p.crop === null || typeof p.crop === "string" && p.crop in CROPS;
  const timeOk = p.plantedAt === null || typeof p.plantedAt === "number" && Number.isFinite(p.plantedAt);
  return cropOk && timeOk;
}
function isSaveDataV1(v) {
  if (typeof v !== "object" || v === null) return false;
  const d = v;
  return typeof d.coins === "number" && Array.isArray(d.plots) && d.plots.length === PLOT_COUNT && d.plots.every((p) => isPlotV1(p)) && typeof d.selected === "string" && d.selected in CROPS;
}
function migratePlotV1(p, now) {
  if (!p.crop || !p.plantedAt) return { crop: null, plantedAt: null, state: "empty", witheredAt: null };
  const def = CROPS[p.crop];
  const elapsed = Math.max(0, now - p.plantedAt);
  let state;
  if (elapsed < def.stageMs[0]) state = "sown";
  else if (elapsed < def.stageMs[0] + def.stageMs[1]) state = "growing";
  else state = "mature";
  return { crop: p.crop, plantedAt: p.plantedAt, state, witheredAt: null };
}
function isSaveData(v) {
  if (typeof v !== "object" || v === null) return false;
  const d = v;
  return typeof d.coins === "number" && Array.isArray(d.plots) && d.plots.length === PLOT_COUNT && d.plots.every((p) => isPlot(p)) && typeof d.selected === "string" && d.selected in CROPS;
}
var defaultBackend = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v)
};
function load(backend = defaultBackend) {
  try {
    const raw = backend.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isSaveData(parsed)) return parsed;
    }
    const rawV1 = backend.getItem(KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (isSaveDataV1(parsedV1)) {
        const now = Date.now();
        return {
          coins: parsedV1.coins,
          plots: parsedV1.plots.map((p) => migratePlotV1(p, now)),
          selected: parsedV1.selected
        };
      }
    }
  } catch {
  }
  return {
    coins: 50,
    plots: Array.from({ length: PLOT_COUNT }, () => ({ crop: null, plantedAt: null, state: "empty", witheredAt: null })),
    selected: "carrot"
  };
}
function save(d, backend = defaultBackend) {
  backend.setItem(KEY, JSON.stringify(d));
}
function tickPlot(plot, now) {
  if (plot.state !== "withered") return plot;
  if (plot.witheredAt === null) return { ...plot, state: "empty", witheredAt: null };
  if (now - plot.witheredAt < WITHER_RECOVER_MS) return plot;
  return { crop: null, plantedAt: null, state: "empty", witheredAt: null };
}
export {
  CROPS,
  PLOT_COUNT,
  WITHER_RECOVER_MS,
  load,
  progressOf,
  save,
  stageOf,
  tickPlot
};
//# sourceMappingURL=_game.js.map
