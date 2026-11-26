"use strict";
const ROADS = [
  [
    [-20, 2.7],
    [-5, 2.7],
    [-3, 3.25],
    [0.7, 3.25],
    [1.65, 2.34],
    [1.65, -5.15],
    [2.65, -6.65],
    [2.65, -15.2],
    [-7, -15.2],
  ],
  [
    [1.65, 0.05],
    [3.45, 0.05],
    [4.95, 1.49],
    [7.3, 1.49],
    [8.5, 2.65],
    [18, 2.65],
  ],
  [
    [-1, 3.25],
    [-1, 13],
    [-2.6, 15.2],
    [-2.6, 20],
  ],
];
function segmentDistance(x, y, a, b) {
  let dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = bound(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function river(y) {
  return 12.9 + Math.sin(y * 0.27) * 1.75 + Math.sin(y * 0.69) * 0.45;
}
function dry(x, y) {
  return Math.abs(x - river(y)) > 1.9;
}
function clearLand(x, y, b) {
  if (
    !dry(x, y) ||
    [...BUILD_ZONES, ...ENEMY_ZONES].some(
      ([left, top, right, bottom]) =>
        x > left - 0.65 && x < right + 1 && y > top - 0.65 && y < bottom + 0.65,
    ) ||
    [...b.structures, { x: 2, y: 2 }].some(
      (o) =>
        Math.hypot(x - o.x, y - o.y) < (o.type?.includes("hq") ? 3.4 : 2.45),
    )
  )
    return false;
  return !ROADS.some((path) =>
    path.slice(1).some((end, i) => segmentDistance(x, y, path[i], end) < 0.75),
  );
}
function generateTerrain(b) {
  const r = random(76049),
    things = [],
    tufts = [],
    tiles = [],
    ground = [],
    water = [],
    marks = [];
  for (let i = -26; i <= 26; i++)
    for (let j = -26; j <= 26; j++) {
      let noise =
        (Math.sin(i * 0.79 + j * 0.32) +
          Math.sin(j * 1.7 - i * 0.22) +
          Math.sin(j * 0.64 + i * 0.61)) /
        3;
      let base = [174 + noise * 13, 177 + noise * 7, 133 + noise * 2];
      tiles.push([i, j, ...base.map(Math.round), r()]);
    }
  for (let i = 0; i < 31000; i++) {
    let x = r() * 51 - 25.5,
      y = r() * 51 - 25.5;
    let c = r();
    ground.push([
      x,
      y,
      r() * 0.14 + 0.025,
      r() * 0.08 + 0.017,
      c > 0.52 ? "rgba(224,218,164,.27)" : "rgba(80,95,68,.19)",
    ]);
    if (c > 0.69)
      tufts.push([x, y, 0.04 + r() * 0.12, c > 0.87 ? "#c3c095" : "#939b74"]);
  }
  for (let i = 0; i < 1100; i++) {
    let y = r() * 51 - 25.5;
    water.push([river(y) + (r() - 0.5) * 2.7, y, 0.04 + r() * 0.34]);
  }
  for (const path of ROADS)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        e = path[i],
        len = Math.hypot(a[0] - e[0], a[1] - e[1]);
      for (let n = 0; n < len * 42; n++) {
        let t = r(),
          d = r() - 0.5;
        marks.push([
          a[0] + (e[0] - a[0]) * t - ((e[1] - a[1]) / len) * d * 0.82,
          a[1] + (e[1] - a[1]) * t + ((e[0] - a[0]) / len) * d * 0.82,
          r() * 0.08 + 0.02,
        ]);
      }
    }
  const groves = [
    [-7.6, -3.9, 3.9],
    [-10, -7.7, 3.2],
    [-5.8, 7.2, 3.2],
    [4.7, 8.6, 2.1],
    [4.9, -8.2, 2.3],
    [9, -3.4, 2.5],
    [3.5, -12.5, 2.4],
    [-11, 1, 2.7],
    [8.6, 5.6, 1.4],
    [-12, 10, 3.3],
    [-8, -17, 3.1],
    [16, 0, 3],
    [0.7, -17, 2.4],
  ];
  for (const [cx, cy, radius] of groves)
    for (let i = 0; i < radius * 12; i++) {
      let a = r() * 6.28,
        d = Math.sqrt(r()) * radius,
        x = cx + Math.cos(a) * d,
        y = cy + Math.sin(a) * d;
      if (clearLand(x, y, b))
        things.push({
          type: "pine",
          x,
          y,
          h: 1.05 + r() * 1.65,
          k: Math.floor(r() * 80),
        });
    }
  for (let i = 0; i < 105; i++) {
    let cx = r() * 40 - 20,
      cy = r() * 40 - 20;
    for (let j = 0; j < 3 + r() * 4; j++) {
      let x = cx + (r() - 0.5) * 1.7,
        y = cy + (r() - 0.5) * 1.5;
      if (clearLand(x, y, b))
        things.push({
          type: "rock",
          x,
          y,
          h: r() * 0.31 + 0.09,
          k: Math.floor(r() * 50),
        });
    }
  }
  const ledges = [
    [-4, -6.8, 2.8],
    [-4.3, 6.7, 2.1],
    [6.7, -5.6, 2.5],
    [7.6, 5, 1.7],
    [-9, -10, 2.6],
    [-10, 5.8, 1.8],
  ];
  for (const [x, y, len] of ledges)
    for (let i = 0; i < len * 6; i++) {
      let xx = x + (r() - 0.5) * len,
        yy = y + (r() - 0.5) * len * 0.7;
      if (clearLand(xx, yy, b))
        things.push({
          type: "rock",
          x: xx,
          y: yy,
          h: 0.28 + r() * 0.68,
          k: Math.floor(r() * 60),
        });
    }
  for (let i = 0; i < 60; i++) {
    let y = r() * 40 - 20,
      x = river(y) + (r() < 0.5 ? -1 : 1) * (1.35 + r() * 0.31);
    things.push({ type: "rock", x, y, h: 0.11 + r() * 0.35, k: i });
  }
  for (let i = 0; i < 5; i++)
    things.push({ type: "fence", x: -3.38 + i * 0.66, y: -0.35 });
  for (let i = 0; i < 4; i++)
    things.push({ type: "fence", x: -1.15 + i * 0.66, y: -6.62 });
  return { things, ground, tufts, tiles, water, marks };
}
class Field {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sim = sim;
    this.map = generateTerrain(sim);
    sim.nav = new Navigation(sim, this.map.things);
    this.cx = -0.18;
    this.cy = -1.33;
    this.zoom = 1;
    this.terrain = document.createElement("canvas");
    this.dirty = true;
    this.sprites = new Map();
    this.labels = [];
  }
  size() {
    let { width: w, height: h } = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== this.w || h !== this.h || this.dpr !== dpr) {
      this.w = w;
      this.h = h;
      this.dpr = dpr;
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.terrain.width = w * dpr;
      this.terrain.height = h * dpr;
      this.dirty = true;
    }
    this.scale = Math.max(24, Math.min(w / 20.6, h / 10.6)) * this.zoom;
    this.p = new Painter(this.ctx, this.scale, w * 0.5, h * 0.5);
    this.p.cx = this.cx;
    this.p.cy = this.cy;
  }
  inverse(x, y) {
    return this.p.groundPoint(x, y);
  }
  pan(dx, dy) {
    this.cx = bound(this.cx + dx, -16, 16);
    this.cy = bound(this.cy + dy, -17, 16);
    this.dirty = true;
  }
  center(o) {
    this.cx = o.x;
    this.cy = o.y;
    this.dirty = true;
  }
  visible(x, y, margin = 90) {
    const [a, b] = this.p.screen(x, y);
    return (
      a > -margin && a < this.w + margin && b > -margin && b < this.h + margin
    );
  }
  drawGround() {
    const c = this.terrain.getContext("2d"),
      p = new Painter(c, this.scale, this.p.ox, this.p.oy);
    p.cx = this.cx;
    p.cy = this.cy;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#b0b48c";
    c.fillRect(0, 0, this.w, this.h);
    for (const [x, y, r, g, b, n] of this.map.tiles) {
      if (!this.visible(x, y, 100)) continue;
      p.poly(
        [
          [x, y],
          [x + 1.02, y],
          [x + 1.02, y + 1.02],
          [x, y + 1.02],
        ],
        "rgb(" + r + "," + g + "," + b + ")",
      );
      p.poly(
        [
          [x, y],
          [x + 1.02, y],
          [x + n, y + 1.02],
        ],
        "rgba(222,217,164,.10)",
      );
    }
    for (const [x, y, w, h, col] of this.map.ground) {
      if (!this.visible(x, y, 12)) continue;
      p.poly(
        [
          [x - w, y],
          [x, y - h],
          [x + w, y],
          [x, y + h],
        ],
        col,
      );
    }
    for (const [x, y, h, col] of this.map.tufts) {
      if (!this.visible(x, y, 8)) continue;
      p.line([x, y, 0], [x - 0.035, y, h], col, 0.013);
      p.line([x + 0.023, y, 0], [x + 0.056, y, h * 0.66], col, 0.013);
    }
    let bank = (width, col) => {
      let a = [],
        b = [];
      for (let i = -29; i <= 29; i += 0.34) {
        a.push([river(i) - width, i]);
        b.unshift([river(i) + width, i]);
      }
      p.poly(a.concat(b), col);
    };
    bank(1.88, "#8b957a");
    bank(1.64, "#abc0a7");
    bank(1.52, "#7a9f98");
    bank(1.24, "#739994");
    for (const [x, y, len] of this.map.water) {
      if (this.visible(x, y))
        p.line([x, y], [x + len, y + 0.03], "#9cb8aa", 0.018);
    }
    const pathStroke = (path, width, col) => {
      c.beginPath();
      path.forEach(([x, y], i) => {
        const q = p.screen(x, y);
        i ? c.lineTo(...q) : c.moveTo(...q);
      });
      c.strokeStyle = col;
      c.lineWidth = width * this.scale;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.stroke();
    };
    for (const path of ROADS) {
      pathStroke(path, 0.83, "#a7a786");
      pathStroke(path, 0.73, "#c3b794");
      pathStroke(path, 0.59, "#cbbd9c");
      for (const s of [-0.19, 0.19])
        pathStroke(
          path.map(([x, y]) => [x + s, y - s]),
          0.045,
          "rgba(146,131,99,.33)",
        );
    }
    for (const [x, y, s] of this.map.marks)
      if (this.visible(x, y, 5))
        p.line([x, y], [x + s, y], "rgba(119,108,84,.27)", 0.015);
    for (const o of this.sim.structures) {
      if (!this.visible(o.x, o.y)) continue;
      p.x = o.x;
      p.y = o.y;
      let w = o.type === "hq" || o.type === "enemyHQ" ? 2.05 : 1.49;
      p.poly(
        [
          [-w, -w * 0.59],
          [-w * 0.84, -w * 0.83],
          [w * 0.65, -w * 0.87],
          [w, -w * 0.6],
          [w * 1.13, w * 0.46],
          [w * 0.79, w * 0.87],
          [-w * 0.67, w * 0.82],
          [-w, w * 0.57],
        ],
        o.type === "oil" ? "#9e9b7b" : "#b6ae8e",
      );
      for (let i = 0; i < 34; i++) {
        const r = random(i * 933 + o.id);
        let x = (r() - 0.5) * w * 1.76,
          y = (r() - 0.5) * w * 1.28;
        p.line([x, y], [x + 0.03 + r() * 0.1, y], "#a49d7e", 0.025);
      }
      p.x = 0;
      p.y = 0;
    }
    p.x = river(2.65);
    p.y = 2.65;
    p.box(-1.98, -0.46, 0, 3.96, 0.92, 0.1, "#8d8d74");
    for (let i = -1.95; i < 1.95; i += 0.16)
      p.line([i, -0.45, 0.11], [i, 0.45, 0.11], "#727b6c", 0.027);
    this.dirty = false;
  }
  scenery(p, o) {
    const key = o.type + ":" + o.k + ":" + Math.round((o.h || 0) * 10);
    let s = this.sprites.get(key);
    if (!s) {
      const size = 144,
        cv = document.createElement("canvas");
      cv.width = size;
      cv.height = size;
      const q = new Painter(cv.getContext("2d"), 40, 72, 115);
      if (o.type === "pine") pine(q, o.h, o.k);
      if (o.type === "rock") rock(q, 0, 0, o.h, o.k, "#969986");
      if (o.type === "fence") {
        for (let x of [0, 0.64])
          q.box(x, -0.03, 0, 0.052, 0.052, 0.43, "#6f7563");
        for (let h of [0.17, 0.34])
          q.line([0, 0, h], [0.67, 0, h], "#828675", 0.026);
      }
      s = cv;
      this.sprites.set(key, s);
    }
    let [x, y] = p.screen(o.x, o.y);
    let f = this.scale / 40;
    p.c.drawImage(s, x - 72 * f, y - 115 * f, 144 * f, 144 * f);
  }
  ring(p, o, col, fill) {
    const w =
      o.type === "hq" || o.type === "enemyHQ"
        ? 1.72
        : o.built !== undefined
          ? 1.39
          : TYPES[o.type].infantry
            ? 0.27
            : 0.69;
    const d = w * 0.81;
    p.poly(
      [
        [-w, -d],
        [w, -d],
        [w, d],
        [-w, d],
      ],
      fill,
    );
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      p.line([a * (w - 0.22), b * d, 0.02], [a * w, b * d, 0.02], col, 0.055);
      p.line([a * w, b * d, 0.02], [a * w, b * (d - 0.22), 0.02], col, 0.055);
    }
  }
  buildGrid(p, type, cursor) {
    const facility = TYPES[type].tiles;
    const cells = new Set();
    const tile = (x, y) =>
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ].map((v) => p.screen(...v, 0.025));
    for (const [left, top, right, bottom] of BUILD_ZONES) {
      for (let x = left; x < right; x++)
        for (let y = top; y < bottom; y++) {
          const key = x + ":" + y;
          if (cells.has(key) || !this.visible(x, y)) continue;
          cells.add(key);
          const free = this.sim.tileAvailable(x, y);
          p.shape(
            tile(x, y),
            free ? "rgba(71,124,92,.21)" : "rgba(66,69,58,.10)",
            free ? "rgba(219,239,197,.77)" : "rgba(82,87,71,.36)",
            0.9,
          );
        }
    }
    if (!facility || !cursor) return;
    const fp = this.sim.footprint(type, this.inverse(cursor.x, cursor.y)),
      color = fp.valid ? "#d4f9ac" : "#ffb096";
    for (let x = fp.col; x < fp.col + fp.w; x++)
      for (let y = fp.row; y < fp.row + fp.d; y++) {
        p.shape(
          tile(x, y),
          fp.valid ? "rgba(80,155,88,.65)" : "rgba(174,77,55,.63)",
          color,
          1.65,
        );
      }
    return fp;
  }
  render(selected, mode, box, point, cursor) {
    this.size();
    if (this.dirty || this.terrainVersion !== this.sim.nav.version) {
      this.drawGround();
      this.terrainVersion = this.sim.nav.version;
    }
    let p = this.p,
      c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.terrain, 0, 0, this.w, this.h);
    p.x = p.y = p.rot = 0;
    const footprint = TYPES[mode]?.buildTime
      ? this.buildGrid(p, mode, cursor)
      : null;
    const objects = [
      ...this.map.things,
      ...this.sim.structures,
      ...this.sim.units,
    ]
      .filter((o) => !(o.hp <= 0) && this.visible(o.x, o.y, 145))
      .sort((a, b) => a.x + a.y - (b.x + b.y));
    this.labels = [];
    for (let o of objects) {
      p.x = o.x;
      p.y = o.y;
      p.rot = 0;
      if (!o.id) {
        this.scenery(p, o);
        continue;
      }
      let sel = selected.includes(o);
      if (sel || this.sim.canPlace(o, mode))
        this.ring(
          p,
          o,
          sel ? "#bcf4cf" : "#f2c378",
          sel ? "rgba(64,113,88,.15)" : "rgba(228,178,98,.23)",
        );
      p.rot = o.angle || 0;
      model(p, o.type, { ...o, time: this.sim.time });
      p.rot = 0;
      if (
        o.team === "enemy" ||
        o.hp < o.maxHp ||
        (sel && o.angle !== undefined)
      ) {
        let [x, y] = p.screen(o.x, o.y, o.angle !== undefined ? 0.9 : 2.65);
        c.fillStyle = "#36473d";
        c.fillRect(x - 12, y - 2, 24, 3);
        c.fillStyle = o.team === "enemy" ? "#df9273" : "#bde7ad";
        c.fillRect(x - 12, y - 2, 24 * Math.max(o.hp / o.maxHp, 0), 3);
      }
      if (o.angle === undefined) this.labels.push(o);
    }
    if (footprint) {
      p.x = footprint.x;
      p.y = footprint.y;
      p.rot = 0;
      c.save();
      c.globalAlpha = 0.46;
      model(p, mode);
      c.restore();
    }
    p.x = p.y = 0;
    const building = selected.length === 1 ? selected[0] : null;
    if (this.sim.canRally(building) && building.rally) {
      const a = building.rally;
      c.save();
      c.setLineDash([5, 5]);
      p.line(
        [building.x, building.y, 0.05],
        [a.x, a.y, 0.05],
        "#e6e5ba",
        0.035,
      );
      c.restore();
      p.line([a.x, a.y, 0], [a.x, a.y, 0.7], "#4e6153", 0.06);
      p.poly(
        [
          [a.x, a.y, 0.72],
          [a.x + 0.46, a.y, 0.61],
          [a.x, a.y, 0.43],
        ],
        "#e9cd83",
      );
    }
    for (let b of this.sim.shots)
      p.line(
        [b.x, b.y, 0.48],
        [b.tx, b.ty, 0.37],
        b.heal ? "#b3f3bf" : "#ffe0a0",
        0.055,
      );
    if (point && point.until > performance.now()) {
      let [x, y] = p.screen(point.x, point.y);
      c.strokeStyle = "#e4ffe5";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(x, y, 12, 6, 0, 0, 6.29);
      c.stroke();
    }
    for (let o of this.labels)
      this.label(o, selected.includes(o), this.sim.canPlace(o, mode));
    if (box) {
      c.fillStyle = "rgba(156,220,182,.15)";
      c.strokeStyle = "#b8eed2";
      c.fillRect(box.x, box.y, box.w, box.h);
      c.strokeRect(box.x, box.y, box.w, box.h);
    }
  }
  label(o, sel, active) {
    const c = this.ctx,
      isBase = o.type === "hq" || o.type === "enemyHQ";
    const [x, y] = this.p.screen(
      o.x,
      o.y,
      isBase
        ? 2.95
        : o.built
          ? o.type === "metal"
            ? 2.68
            : 2
          : o.remaining
            ? 1.8
            : 1.12,
    );
    let name = TYPES[o.type].name.toUpperCase();
    if (o.remaining)
      name +=
        " · " +
        Math.floor(100 * (1 - o.remaining / TYPES[o.type].buildTime)) +
        "%";
    else if (o.built === false)
      name = o.type === "metal" ? "METAL DEPOSIT" : "OIL FIELD";
    c.font = "600 10px ui-monospace, Menlo, monospace";
    let w = c.measureText(name).width + 27,
      h = 21;
    c.fillStyle = active ? "#745b37" : "rgba(32,43,38,.90)";
    c.beginPath();
    c.roundRect(x - w / 2, y - h / 2, w, h, 3);
    c.fill();
    const color =
      o.team === "enemy"
        ? "#e0a083"
        : o.built === false
          ? "#e8bf7a"
          : "#b1d8b8";
    c.fillStyle = color;
    c.beginPath();
    c.arc(x - w / 2 + 10, y, 2.7, 0, 7);
    c.fill();
    c.fillStyle = "#f2f1dd";
    c.textBaseline = "middle";
    c.fillText(name, x - w / 2 + 18, y + 0.6);
    c.strokeStyle = "#465649";
    c.beginPath();
    c.moveTo(x, y + h / 2);
    c.lineTo(x, y + h / 2 + 6);
    c.stroke();
    o.labelRect = [x - w / 2, y - h / 2, w, h];
  }
}
