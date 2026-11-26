"use strict";
const SHADE = new Map();
function tone(hex, m) {
  const key = hex + ":" + m;
  if (SHADE.has(key)) return SHADE.get(key);
  const v = parseInt(hex.slice(1), 16);
  const out =
    "rgb(" +
    [v >> 16, (v >> 8) & 255, v & 255]
      .map((n) => Math.min(255, Math.round(n * m)))
      .join(",") +
    ")";
  SHADE.set(key, out);
  return out;
}
function random(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
class Painter {
  constructor(c, scale = 1, ox = 0, oy = 0) {
    this.c = c;
    this.scale = scale;
    this.ox = ox;
    this.oy = oy;
    this.cx = 0;
    this.cy = 0;
    this.x = 0;
    this.y = 0;
    this.rot = 0;
  }
  screen(x, y, z = 0) {
    return [
      this.ox + (x - this.cx - (y - this.cy)) * 0.866 * this.scale,
      this.oy +
        (x - this.cx + (y - this.cy)) * 0.45 * this.scale -
        z * this.scale,
    ];
  }
  groundPoint(x, y) {
    const across = (x - this.ox) / (0.866 * this.scale),
      down = (y - this.oy) / (0.45 * this.scale);
    return {
      x: this.cx + (across + down) / 2,
      y: this.cy + (down - across) / 2,
    };
  }
  point(x, y, z = 0) {
    const a = this.rot;
    return this.screen(
      this.x + x * Math.cos(a) - y * Math.sin(a),
      this.y + x * Math.sin(a) + y * Math.cos(a),
      z,
    );
  }
  shape(pts, fill, stroke = null, lw = 1) {
    if (!pts.length) return;
    const c = this.c;
    c.beginPath();
    c.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) c.lineTo(...pts[i]);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  poly(pts, color) {
    this.shape(
      pts.map((p) => this.point(...p)),
      color,
    );
  }
  line(a, b, color, width = 0.04) {
    let c = this.c;
    c.beginPath();
    c.moveTo(...this.point(...a));
    c.lineTo(...this.point(...b));
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.55, this.scale * width);
    c.stroke();
  }
  box(x, y, z, w, d, h, col) {
    const v = [
        [x, y],
        [x + w, y],
        [x + w, y + d],
        [x, y + d],
      ],
      tops = v.map((p) => this.point(...p, z + h)),
      bots = v.map((p) => this.point(...p, z));
    for (let i = 0; i < 4; i++) {
      let j = (i + 1) % 4;
      if (tops[j][0] - tops[i][0] < 0) {
        let n = this.rot + (i * Math.PI) / 2;
        this.shape(
          [bots[i], bots[j], tops[j], tops[i]],
          tone(col, 0.7 + 0.14 * Math.cos(n)),
        );
      }
    }
    this.shape(tops, col);
  }
  cyl(x, y, z, r, h, col, n = 12, r2 = r) {
    let top = [],
      bot = [];
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2;
      top.push(this.point(x + r2 * Math.cos(a), y + r2 * Math.sin(a), z + h));
      bot.push(this.point(x + r * Math.cos(a), y + r * Math.sin(a), z));
    }
    for (let i = 0; i < n; i++) {
      let j = (i + 1) % n;
      if (bot[j][0] < bot[i][0])
        this.shape(
          [bot[i], bot[j], top[j], top[i]],
          tone(
            col,
            Math.round(
              (0.66 + 0.22 * Math.sin((i / n) * 6.28 + this.rot)) * 16,
            ) / 16,
          ),
        );
    }
    this.shape(top, col);
  }
  shadow(w, d, offset = 0.15) {
    this.poly(
      [
        [-w / 2 + offset, -d / 2 + 0.12],
        [w / 2 + offset, -d / 2 + 0.12],
        [w / 2 + offset, d / 2 + 0.32],
        [-w / 2 + offset, d / 2 + 0.32],
      ],
      "rgba(45,48,35,.24)",
    );
  }
}
function crate(p, x, y, z = 0, c = "#a79b71") {
  p.box(x, y, z, 0.38, 0.34, 0.33, c);
  for (let t of [0.05, 0.28])
    p.box(x + t, y - 0.008, z + 0.01, 0.042, 0.36, 0.33, "#666457");
}
function vents(p, x, y, z, n) {
  p.box(x, y, z, n * 0.105 + 0.1, 0.38, 0.065, "#494f4c");
  for (let i = 0; i < n; i++)
    p.box(
      x + 0.04 + i * 0.105,
      y + 0.04,
      z + 0.062,
      0.046,
      0.3,
      0.035,
      "#a8b0a3",
    );
}
function dish(p, x, y, z) {
  p.cyl(x, y, z, 0.14, 0.17, "#878b78");
  p.line([x, y, z], [x - 0.05, y, z + 0.56], "#d1cfb8", 0.08);
  let rim = [];
  for (let i = 0; i < 15; i++) {
    let a = (i / 15) * 6.28;
    rim.push([
      x + 0.43 * Math.cos(a),
      y + 0.34 * Math.sin(a),
      z + 0.58 - 0.2 * Math.sin(a),
    ]);
  }
  p.poly(rim, "#d3d6bd");
  for (let i = 0; i < 15; i++) {
    p.poly(
      [[x, y, z + 0.42], rim[i], rim[(i + 1) % 15]],
      i < 8 ? "#aeb6a3" : "#ccd0b9",
    );
  }
  p.line([x, y, z + 0.45], [x, y - 0.22, z + 0.88], "#6d756b", 0.035);
}
function hqModel(p, enemy = false) {
  const green = enemy ? "#a05e47" : "#607f78",
    light = enemy ? "#b37c5d" : "#7f9b89",
    dark = "#525c55";
  p.shadow(3.25, 2.8, 0.38);
  p.box(-1.55, -1.25, 0, 3.1, 2.5, 0.12, "#a5a58f");
  p.box(-1.39, -1.12, 0.12, 0.34, 0.42, 1.12, dark);
  p.box(-1.38, -0.96, 0.12, 2.52, 1.85, 0.62, "#aaa990");
  p.box(-1.47, -1.04, 0.73, 2.7, 2.04, 0.11, green);
  p.box(-1.33, -0.94, 0.84, 2.44, 1.82, 0.08, "#a4ae9c");
  p.box(-1.2, -0.82, 0.9, 1.44, 1.3, 0.6, "#85978b");
  p.box(-1.24, -0.86, 1.45, 1.54, 1.39, 0.09, dark);
  p.box(-1.27, -0.89, 1.53, 1.6, 1.45, 0.11, light);
  p.box(-1.16, -0.79, 1.64, 1.39, 1.24, 0.035, "#9daa97");
  for (let i = 0; i < 4; i++)
    p.box(-1.14 + i * 0.34, 0.476, 1.15, 0.26, 0.036, 0.21, "#344b4e");
  for (let i = 0; i < 3; i++)
    p.box(0.235, -0.7 + i * 0.38, 1.15, 0.035, 0.3, 0.21, "#3e5758");
  vents(p, 0.48, -0.65, 0.925, 4);
  vents(p, 0.48, -0.14, 0.925, 4);
  dish(p, -0.48, -0.27, 1.67);
  p.line([-1.08, 0.26, 1.65], [-1.08, 0.26, 2.7], "#515c57", 0.035);
  p.line([-1.08, 0.26, 2.59], [-1.08, 0.26, 2.71], "#d98c5d", 0.06);

  p.box(-1.32, 0.9, 0.12, 1.45, 0.14, 0.5, "#69756b");
  for (let i = 0; i < 4; i++)
    p.box(-1.23 + i * 0.32, 1.033, 0.26, 0.24, 0.02, 0.24, "#364b4c");
  p.box(0.34, 0.88, 0.12, 0.67, 0.16, 0.53, "#515958");
  for (let i = 0; i < 5; i++)
    p.line(
      [0.37, 1.049, 0.19 + i * 0.075],
      [0.96, 1.049, 0.19 + i * 0.075],
      "#a1a298",
      0.016,
    );
  p.box(0.24, 0.92, 0.65, 0.9, 0.3, 0.09, green);
  p.box(0.29, 1.04, 0.02, 0.81, 0.41, 0.08, "#b1ad93");
  crate(p, 1.05, 0.45, 0.12);
  crate(p, 1.04, 0.02, 0.12, "#929a79");
}
function tower(p, x, y, z, h, base, top, col) {
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const [a, b] = corners[i],
      [c, d] = corners[(i + 1) % 4];
    p.line(
      [x + a * base, y + b * base, z],
      [x + a * top, y + b * top, z + h],
      col,
      0.083,
    );
    for (let j = 0; j < 3; j++) {
      let t = j / 3,
        v = (j + 1) / 3,
        s = base + (top - base) * t,
        e = base + (top - base) * v;
      p.line(
        [x + a * s, y + b * s, z + h * t],
        [x + c * e, y + d * e, z + h * v],
        col,
        0.038,
      );
      p.line(
        [x + c * s, y + d * s, z + h * t],
        [x + a * e, y + b * e, z + h * v],
        col,
        0.038,
      );
    }
  }
}
function mineModel(p) {
  p.shadow(2.5, 2, 0.3);
  p.box(-1.22, -0.92, 0, 2.5, 1.83, 0.12, "#a5a38d");
  for (let i = 0; i < 7; i++)
    rock(
      p,
      -0.98 + (i % 4) * 0.31,
      -0.83 - Math.floor(i / 4) * 0.24,
      0.21 + (i % 3) * 0.09,
      i + 22,
      "#929792",
    );
  p.box(-1, -0.78, 0.13, 1.3, 1.48, 0.31, "#777969");
  p.cyl(-0.37, -0.15, 0.43, 0.56, 0.13, "#555b51");
  tower(p, -0.4, -0.18, 0.48, 1.7, 0.5, 0.23, "#555a4f");
  p.box(-0.73, -0.51, 2.13, 0.69, 0.66, 0.15, "#af8750");
  p.cyl(-0.4, -0.18, 0.48, 0.07, 1.81, "#bbac85");
  p.box(0.39, -0.79, 0.12, 0.67, 1.22, 0.67, "#9d9172");
  p.box(0.34, -0.86, 0.77, 0.78, 1.37, 0.12, "#6c7c6d");
  vents(p, 0.45, -0.63, 0.89, 4);
  p.box(0.42, 0.43, 0.12, 0.74, 0.4, 0.34, "#6f7568");
  crate(p, -0.95, 0.68, 0.13);
}
function oilModel(p, t) {
  p.shadow(2.6, 1.8);
  p.box(-1.28, -0.85, 0, 2.55, 1.72, 0.11, "#aaa48d");
  p.cyl(-0.76, -0.42, 0.11, 0.36, 0.63, "#a7a795");
  p.cyl(-0.76, -0.42, 0.59, 0.365, 0.065, "#73776b");
  tower(p, 0.24, 0.09, 0.11, 0.99, 0.35, 0.13, "#59645a");
  let h = Math.sin(t * 1.5) * 0.15;
  p.line([-0.65, 0.1, 1.22 + h], [1.02, 0.1, 1.19 - h], "#b18b51", 0.18);
  p.line([0.98, 0.1, 1.18 - h], [0.94, 0.1, 0.84 - h], "#8a663f", 0.17);
  p.line([0.94, 0.1, 0.84 - h], [0.94, 0.1, 0.11], "#55584b", 0.04);
  p.box(-0.85, 0.05, 0.11, 0.55, 0.49, 0.35, "#617267");
  p.line([-0.56, 0.22, 0.38], [-0.6, 0.14, 1.2 + h], "#6c6e5e", 0.07);
}
function resourceModel(p, type) {
  if (type === "metal") {
    let r = random(93);
    for (let i = 0; i < 12; i++)
      rock(
        p,
        (r() - 0.5) * 1.9,
        (r() - 0.5) * 1.5,
        0.22 + r() * 0.38,
        2 + i,
        "#9ba49a",
      );
  } else {
    p.cyl(0, 0, 0.012, 0.64, 0.07, "#665f50", 12);
    p.cyl(0, 0, 0.08, 0.29, 0.13, "#858779");
    p.cyl(0, 0, 0.21, 0.105, 0.57, "#5b645a");
    p.box(-0.34, -0.09, 0.49, 0.68, 0.18, 0.11, "#7a8273");
    for (let x of [-0.32, 0.24]) p.cyl(x, 0, 0.5, 0.14, 0.065, "#a67b4e");
    p.cyl(0, 0, 0.78, 0.17, 0.07, "#c0985f");
  }
}
function truckModel(p, cargo = 0, enemy = false) {
  p.shadow(1.05, 0.52);
  p.box(-0.56, -0.28, 0.16, 1.13, 0.56, 0.13, "#50564f");
  for (const x of [-0.4, -0.13, 0.38])
    for (const y of [-0.28, 0.28]) {
      p.box(x - 0.099, y - 0.056, 0.035, 0.205, 0.113, 0.22, "#333c38");
      p.box(x - 0.049, y - 0.06, 0.075, 0.105, 0.121, 0.1, "#777c70");
    }
  p.box(-0.55, -0.253, 0.28, 0.72, 0.51, 0.22, "#708477");
  p.box(-0.52, -0.219, 0.5, 0.65, 0.44, 0.02, cargo ? "#a79972" : "#49584f");
  for (let i = 0; i < 5; i++)
    p.box(-0.5 + i * 0.14, 0.251, 0.31, 0.026, 0.011, 0.16, "#9d9f89");
  p.box(0.21, -0.25, 0.29, 0.37, 0.5, 0.27, enemy ? "#b47d62" : "#78968c");
  p.box(0.31, -0.23, 0.505, 0.233, 0.46, 0.14, "#405456");
  p.box(0.2, -0.26, 0.644, 0.36, 0.52, 0.047, enemy ? "#c7997c" : "#93a99a");
  p.box(0.53, -0.25, 0.3, 0.14, 0.5, 0.14, "#6c8c7e");
  p.box(0.66, -0.22, 0.31, 0.02, 0.09, 0.064, "#e2d3a0");
  p.box(0.66, 0.13, 0.31, 0.02, 0.09, 0.064, "#e2d3a0");
}
function tankModel(p, enemy = false) {
  const col = enemy ? "#a47a5c" : "#838d71";
  p.shadow(1.2, 0.72);
  for (let y of [-0.4, 0.22]) {
    p.box(-0.64, y, 0.07, 1.29, 0.18, 0.23, "#454e44");
    for (let i = 0; i < 7; i++)
      p.box(-0.58 + i * 0.17, y - 0.008, 0.1, 0.095, 0.197, 0.135, "#6f7563");
  }
  p.box(-0.57, -0.335, 0.28, 1.2, 0.67, 0.18, col);
  p.box(-0.63, -0.42, 0.3, 1.24, 0.16, 0.055, col);
  p.box(-0.63, 0.26, 0.3, 1.24, 0.16, 0.055, col);
  p.cyl(-0.04, 0, 0.46, 0.32, 0.19, col, 8, 0.29);
  p.cyl(-0.13, -0.04, 0.65, 0.14, 0.05, "#657260", 8);
  p.box(0.16, -0.06, 0.54, 0.76, 0.12, 0.09, "#697560");
  p.box(0.81, -0.074, 0.53, 0.21, 0.15, 0.115, col);
  p.line([-0.24, 0.17, 0.59], [-0.3, 0.18, 1.08], "#49544a", 0.019);
}
function infantryModel(p, type, enemy = false) {
  let c = enemy ? "#956d50" : "#667b65";
  p.shadow(0.28, 0.24);
  p.box(-0.105, -0.1, 0, 0.13, 0.11, 0.26, "#495749");
  p.box(0.02, 0.03, 0, 0.13, 0.11, 0.26, "#434f42");
  p.box(-0.11, -0.14, 0.22, 0.23, 0.28, 0.25, c);
  p.box(-0.17, -0.1, 0.27, 0.08, 0.21, 0.19, "#777d64");
  p.cyl(0, 0, 0.46, 0.089, 0.085, "#b09875", 7);
  p.cyl(-0.008, 0, 0.52, 0.112, 0.07, c, 8, 0.085);
  if (type === "medic") {
    p.box(-0.22, -0.12, 0.28, 0.13, 0.25, 0.19, "#d7cda9");
    p.box(-0.15, 0.15, 0.28, 0.14, 0.07, 0.16, "#abc5a1");
    p.cyl(0, 0, 0.562, 0.1, 0.027, "#c3cfac", 8);
  } else if (type === "rocketeer") {
    p.line([-0.19, 0.13, 0.43], [0.45, 0.13, 0.46], "#5a604c", 0.105);
    p.line([0.33, 0.13, 0.455], [0.44, 0.13, 0.46], "#a59a6e", 0.12);
  } else if (type === "gunner") {
    p.box(-0.15, -0.16, 0.27, 0.26, 0.32, 0.18, "#586652");
    p.line([0.02, 0.14, 0.33], [0.47, 0.14, 0.34], "#36453c", 0.072);
    p.box(0.06, 0.11, 0.22, 0.12, 0.12, 0.14, "#aa996b");
  } else p.line([0.03, 0.12, 0.37], [0.34, 0.12, 0.38], "#394640", 0.047);
}
function rock(p, x, y, r, seed, col) {
  let rand = random(seed * 931 + 1),
    pts = [],
    tops = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    let a = ((i + rand() * 0.36) / n) * 6.283,
      s = r * (0.8 + rand() * 0.3);
    pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s, 0.016]);
    tops.push([
      x + Math.cos(a) * s * 0.58 - 0.05 * r,
      y + Math.sin(a) * s * 0.55,
      r * (0.55 + rand() * 0.51),
    ]);
  }
  let cap = [x - r * 0.07, y - r * 0.1, r * 0.96];
  for (let i = 0; i < n; i++) {
    let j = (i + 1) % n;
    if (p.point(...pts[j])[0] < p.point(...pts[i])[0])
      p.poly([pts[i], pts[j], tops[j], tops[i]], tone(col, 0.62 + i * 0.033));
  }
  for (let i = 0; i < n; i++)
    p.poly([tops[i], tops[(i + 1) % n], cap], tone(col, 0.84 + i * 0.039));
}
function pine(p, height, seed) {
  let r = random(seed),
    w = height * (0.19 + r() * 0.045);
  p.poly(
    [
      [-w * 0.4, 0, 0],
      [w * 0.47, -0.05, 0],
      [w * 0.9, 0.39 * height, 0],
      [w * 1.55, 0.58 * height, 0],
      [-w * 0.55, 0.3 * height, 0],
    ],
    "rgba(55,61,43,.22)",
  );
  p.box(-0.055, -0.055, 0, 0.11, 0.11, height * 0.35, "#746a51");
  const colors = [
    "#526952",
    "#5f7458",
    "#758467",
    "#667a60",
    "#51694f",
    "#4d624d",
    "#607357",
  ];
  const tint = 0.84 + r() * 0.24;
  for (let layer = 0; layer < 3; layer++) {
    let rad = w * (1 - layer * 0.24),
      z = height * (0.17 + layer * 0.22);
    let base = [];
    for (let i = 0; i < 7; i++) {
      let a = (i / 7) * 6.28 + seed * 0.36;
      let s = rad * (0.86 + r() * 0.2);
      base.push([s * Math.cos(a), s * Math.sin(a), z + r() * 0.065 * height]);
    }
    for (let i = 0; i < 7; i++) {
      let j = (i + 1) % 7;
      if (p.point(...base[j])[0] < p.point(...base[i])[0])
        p.poly(
          [base[i], base[j], [0, 0, z + height * (0.47 - layer * 0.015)]],
          tone(colors[(i + seed) % 7], Math.round(tint * 12) / 12),
        );
    }
  }
}
function facilityModel(p, type) {
  p.shadow(2.72, 2.08, 0.26);
  p.box(-1.34, -1.02, 0, 2.68, 2.04, 0.12, "#a2a38d");
  if (type === "refinery") {
    for (const x of [-0.78, -0.12]) {
      p.cyl(x, -0.43, 0.12, 0.31, 1.33, "#afb3a3");
      for (const z of [0.39, 0.91, 1.39])
        p.cyl(x, -0.43, z, 0.32, 0.07, "#91714f");
      p.cyl(x, -0.43, 1.45, 0.3, 0.18, "#b6bdac", 12, 0.14);
    }
    p.cyl(0.77, -0.38, 0.12, 0.4, 0.75, "#829384");
    p.line([-0.77, -0.44, 1.56], [-0.12, -0.44, 1.56], "#8e9587", 0.09);
    p.box(-1.14, 0.15, 0.12, 1.12, 0.64, 0.48, "#7e8978");
    vents(p, -1, 0.25, 0.6, 6);
    p.box(0.22, 0.18, 0.12, 0.71, 0.55, 0.41, "#9c926d");
    for (let i = 0; i < 4; i++)
      p.box(0.62 + i * 0.16, 0.83, 0.13, 0.08, 0.1, 0.025, "#dfbd72");
  } else if (type === "barracks") {
    for (const y of [-0.79, 0.18]) {
      p.box(-1.09, y, 0.12, 2.15, 0.7, 0.47, "#8c9880");
      p.poly(
        [
          [-1.16, y - 0.05, 0.56],
          [1.13, y - 0.05, 0.56],
          [1.13, y + 0.35, 0.88],
          [-1.16, y + 0.35, 0.88],
        ],
        "#7f9178",
      );
      p.poly(
        [
          [-1.16, y + 0.35, 0.88],
          [1.13, y + 0.35, 0.88],
          [1.13, y + 0.75, 0.56],
          [-1.16, y + 0.75, 0.56],
        ],
        "#647963",
      );
      p.poly(
        [
          [1.09, y, 0.56],
          [1.09, y + 0.7, 0.56],
          [1.09, y + 0.35, 0.87],
        ],
        "#a5ae95",
      );
      for (let i = 0; i < 3; i++)
        p.box(-0.92 + i * 0.56, y + 0.7, 0.27, 0.26, 0.02, 0.19, "#455951");
      p.box(1.07, y + 0.24, 0.12, 0.03, 0.25, 0.35, "#515e51");
    }
    p.line([-1.18, 0.86, 0.12], [-1.18, 0.86, 1.48], "#687469", 0.035);
    p.poly(
      [
        [-1.18, 0.86, 1.47],
        [-0.68, 0.86, 1.38],
        [-1.18, 0.86, 1.19],
      ],
      "#adc99a",
    );
  } else {
    p.box(-1.15, -0.86, 0.12, 2.28, 1.66, 0.85, "#899483");
    p.box(-1.23, -0.94, 0.94, 2.46, 1.84, 0.13, "#697f75");
    for (let i = 0; i < 3; i++)
      p.box(-1.08 + i * 0.72, -0.71, 1.07, 0.53, 1.38, 0.12, "#9aa797");
    p.box(1.13, -0.62, 0.13, 0.03, 1.1, 0.63, "#485950");
    for (let i = 0; i < 5; i++)
      p.box(1.16, -0.6, 0.23 + i * 0.105, 0.02, 1.06, 0.026, "#959c8c");
    for (let i = 0; i < 5; i++)
      p.box(-0.99 + i * 0.39, 0.81, 0.57, 0.29, 0.03, 0.22, "#405554");
    crate(p, 0.66, 0.69, 0.12);
  }
}
function constructionModel(p, o) {
  const progress = 1 - o.remaining / TYPES[o.type].buildTime,
    top = 0.45 + progress * 0.88;
  p.box(-1.24, -0.92, 0, 2.48, 1.84, 0.14, "#989887");
  p.box(-0.94, -0.64, 0.14, 1.91, 1.25, progress * 0.73, "#848e7d");
  for (const y of [-0.8, 0.8]) {
    for (const x of [-1.13, 0, 1.13])
      p.line([x, y, 0.14], [x, y, top + 0.17], "#bb965f", 0.07);
    p.line([-1.13, y, top], [1.13, y, top], "#a38962", 0.06);
    p.line([-1.13, y, 0.14], [0, y, top], "#a99b7d", 0.045);
    p.line([0, y, top], [1.13, y, 0.14], "#a99b7d", 0.045);
  }
  crate(p, 0.73, 0.56, 0.14);
}
function model(p, type, opts = {}) {
  if (opts.remaining > 0) {
    constructionModel(p, opts);
    return;
  }
  switch (type) {
    case "refinery":
    case "factory":
    case "barracks":
      facilityModel(p, type);
      if (opts.team === "enemy")
        p.box(0.65, 0.9, 0.12, 0.52, 0.1, 0.18, "#b16e55");
      break;
    case "hq":
      hqModel(p);
      break;
    case "enemyHQ":
      hqModel(p, true);
      break;
    case "metal":
      opts.built === false ? resourceModel(p, type) : mineModel(p);
      break;
    case "oil":
      opts.built === false
        ? resourceModel(p, type)
        : oilModel(p, opts.time || 0);
      break;
    case "truck":
      truckModel(p, opts.cargo, opts.team === "enemy");
      break;
    case "tank":
      tankModel(p, opts.team === "enemy");
      break;
    case "infantry":
    case "medic":
    case "rocketeer":
    case "gunner":
      infantryModel(p, type, opts.team === "enemy");
      break;
  }
}
