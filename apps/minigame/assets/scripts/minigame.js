var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/storage.ts
function createWxStorageBackend() {
  return {
    getItem(key) {
      try {
        const v = wx.getStorageSync(key);
        return typeof v === "string" ? v : null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        wx.setStorageSync(key, value);
      } catch {
      }
    }
  };
}

// ../../packages/game/src/index.ts
var CROPS = {
  carrot: { id: "carrot", name: "\u80E1\u841D\u535C", emoji: "\u{1F955}", seedPrice: 10, sellPrice: 25, stageMs: [1e4, 15e3] },
  corn: { id: "corn", name: "\u7389\u7C73", emoji: "\u{1F33D}", seedPrice: 20, sellPrice: 55, stageMs: [2e4, 3e4] }
};
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

// src/app.ts
var AppController = class {
  constructor(backend) {
    this.dirty = false;
    this.backend = backend;
    this.data = load(backend);
  }
  // 暴露给视图层的只读快照
  getData() {
    return this.data;
  }
  // 选中的种子变更（来自种子栏）
  select(crop) {
    if (this.data.selected === crop) return;
    this.data = { ...this.data, selected: crop };
    this.dirty = true;
  }
  // 单地块交互（来自 PlotView onTouchEnd）
  // 状态机镜像 web useFarm.handlePlot：
  //   empty    → 播种 (扣金币 / checkCoins)
  //   sown/sprout/growing → 重复点击无效 (M1 阶段不做浇水/施肥)
  //   mature   → 收获 (加金币)
  //   withered → 清理 (→ empty)
  handlePlot(i) {
    const plot = this.data.plots[i];
    if (!plot) return;
    const result = applyAction(plot, this.data);
    if (!result.changed) return;
    const plots = this.data.plots.slice();
    plots[i] = result.plot;
    this.data = { ...this.data, ...result.delta };
    this.dirty = true;
  }
  // 每帧调一次：推进 withered → empty 自动恢复 + 落盘
  tick() {
    const now = Date.now();
    let changed = false;
    const plots = this.data.plots.map((p) => {
      const np = tickPlot(p, now);
      if (np !== p) {
        changed = true;
        return np;
      }
      return p;
    });
    if (changed) {
      this.data = { ...this.data, plots };
      this.dirty = true;
    }
    if (this.dirty) {
      save(this.data, this.backend);
      this.dirty = false;
    }
  }
};
function applyAction(plot, save2) {
  switch (plot.state) {
    case "empty": {
      const def = CROPS[save2.selected];
      if (save2.coins < def.seedPrice) return { changed: false, plot, delta: {} };
      return {
        changed: true,
        plot: {
          crop: save2.selected,
          plantedAt: Date.now(),
          state: "sown",
          witheredAt: null
        },
        delta: { coins: save2.coins - def.seedPrice }
      };
    }
    case "mature": {
      const def = plot.crop ? CROPS[plot.crop] : null;
      const earn = def ? def.sellPrice : 0;
      return {
        changed: true,
        plot: { crop: null, plantedAt: null, state: "empty", witheredAt: null },
        delta: { coins: save2.coins + earn }
      };
    }
    case "withered": {
      return {
        changed: true,
        plot: { crop: null, plantedAt: null, state: "empty", witheredAt: null },
        delta: {}
      };
    }
    default:
      return { changed: false, plot, delta: {} };
  }
}

// src/main.ts
var { ccclass, property } = cc._decorator;
var _Main_decorators, _init, _a;
_Main_decorators = [ccclass];
var Main = class extends (_a = cc.Component) {
  constructor() {
    super(...arguments);
    this.app = null;
  }
  onLoad() {
    this.app = new AppController(createWxStorageBackend());
    globalThis.__farmApp = this.app;
  }
  update(_dt) {
    this.app?.tick();
  }
  onDestroy() {
    ;
    globalThis.__farmApp = void 0;
  }
};
_init = __decoratorStart(_a);
Main = __decorateElement(_init, 0, "Main", _Main_decorators, Main);
__runInitializers(_init, 1, Main);
export {
  Main as default
};
//# sourceMappingURL=minigame.js.map
