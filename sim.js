"use strict";
const TYPES = {
  hq: { name: "Command HQ", hp: 1600 },
  enemyHQ: { name: "Enemy outpost", hp: 820 },
  refinery: {
    name: "Refinery",
    cost: [150, 0],
    hp: 640,
    buildTime: 10,
    tiles: [3, 2],
  },
  barracks: {
    name: "Barracks",
    cost: [110, 0],
    hp: 520,
    buildTime: 8,
    tiles: [3, 2],
    produces: ["infantry"],
  },
  factory: {
    name: "Vehicle factory",
    cost: [190, 0],
    hp: 760,
    buildTime: 14,
    tiles: [3, 3],
    produces: ["truck", "tank"],
  },
  metal: { name: "Metal mine", cost: [140, 0], hp: 500, buildTime: 7 },
  oil: { name: "Oil well", cost: [160, 0], hp: 460, buildTime: 8 },
  truck: { name: "Hauler", cost: [85, 0], hp: 95 },
  infantry: { name: "Infantry", cost: [45, 0], hp: 70 },
  tank: { name: "Battle tank", cost: [180, 55], hp: 280 },
};
// Each rectangle contains whole world tiles, with exclusive upper bounds.
const BUILD_ZONES = [
  [-9, -6, 0, 1],
  [2, -7, 9, 1],
  [-7, 3, 5, 9],
  [3, 1, 10, 7],
];
function inBuildZone(col, row) {
  return BUILD_ZONES.some(
    ([left, top, right, bottom]) =>
      col >= left && col < right && row >= top && row < bottom,
  );
}
const BASE = { x: -1.6, y: 1.2 },
  OUTPOST = { x: -6, y: -14 };
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function bound(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
class Battle {
  constructor() {
    this.id = 0;
    this.time = 0;
    this.metal = 420;
    this.oil = 0;
    this.events = [];
    this.shots = [];
    this.units = [];
    this.facilities = [];
    this.end = "";
    this.oilDelivered = false;
    this.hq = this.make("hq", BASE);
    this.enemy = this.make("enemyHQ", OUTPOST, "enemy");
    this.sites = [
      ["metal", 0, -5.5, true],
      ["oil", 5.9, 1.5, false],
      ["metal", -9, 3.4, false],
      ["oil", -10, -9, false],
    ].map(([type, x, y, built]) => ({
      ...this.make(type, { x, y }),
      built,
      reserve: built ? 65 : 0,
      capacity: 160,
      loader: null,
    }));
    this.spawn("tank", { x: 2.2, y: 3.9 });
    this.spawn("tank", { x: -4.5, y: -12.8 }, "enemy");
    this.spawn("infantry", { x: -4, y: -12 }, "enemy");
    this.spawn("infantry", { x: -5, y: -12.5 }, "enemy");
  }
  make(type, p, team = "ally") {
    return {
      id: ++this.id,
      type,
      team,
      x: p.x,
      y: p.y,
      hp: TYPES[type].hp,
      maxHp: TYPES[type].hp,
    };
  }
  spawn(type, p, team = "ally") {
    const u = {
      ...this.make(type, p, team),
      goal: null,
      order: null,
      angle: 0,
      cool: 0,
      job: null,
      cargo: 0,
      cargoType: null,
      progress: 0,
    };
    this.units.push(u);
    return u;
  }
  notice(s) {
    this.events.push(s);
  }
  canBuy(type) {
    const [m, o] = TYPES[type].cost;
    return this.metal >= m && this.oil >= o;
  }
  pay(type) {
    const [m, o] = TYPES[type].cost;
    this.metal -= m;
    this.oil -= o;
  }
  get structures() {
    return [this.hq, this.enemy, ...this.sites, ...this.facilities];
  }
  refineries() {
    return this.facilities.filter((p) => p.type === "refinery" && p.built);
  }
  tileAvailable(col, row) {
    if (!inBuildZone(col, row)) return false;
    const x = col + 0.5,
      y = row + 0.5;
    if (
      !dry(x, y) ||
      ROADS.some((path) =>
        path.slice(1).some((b, i) => segmentDistance(x, y, path[i], b) < 0.83),
      )
    )
      return false;
    for (const b of this.structures) {
      const [w, d] =
        TYPES[b.type].tiles ||
        (b === this.hq || b === this.enemy ? [3.4, 2.8] : [2.8, 2.2]);
      if (Math.abs(b.x - x) < w / 2 + 0.49 && Math.abs(b.y - y) < d / 2 + 0.49)
        return false;
      // Keep an approach to each building exit and extractor loading bay.
      if (
        b !== this.hq &&
        b !== this.enemy &&
        Math.abs(x - (b.x + w / 2 + 0.6)) < 1 &&
        Math.abs(y - (b.y + 0.5)) < 0.9
      )
        return false;
    }
    return true;
  }
  footprint(type, point) {
    const [w, d] = TYPES[type].tiles,
      col = Math.round(point.x - w / 2),
      row = Math.round(point.y - d / 2);
    const x = col + w / 2,
      y = row + d / 2;
    let valid = true;
    for (let tx = col; tx < col + w; tx++)
      for (let ty = row; ty < row + d; ty++)
        if (!this.tileAvailable(tx, ty)) valid = false;
    if (
      this.units.some(
        (u) =>
          Math.abs(x - u.x) < w / 2 + 0.24 && Math.abs(y - u.y) < d / 2 + 0.24,
      )
    )
      valid = false;
    // The exit belongs to this building's truck or production queue.
    const exit = this.exitPoint({ x, y });
    if (this.nav && !this.nav.cost[this.nav.cell(exit)]) valid = false;
    return { x, y, col, row, w, d, valid };
  }
  canPlace(site, type) {
    return (
      !!site &&
      this.sites.includes(site) &&
      site.type === type &&
      !site.built &&
      !site.remaining
    );
  }
  build(site, type) {
    if (this.end || !site || !TYPES[type]?.buildTime || !this.canBuy(type))
      return null;
    if (TYPES[type].tiles) {
      const footprint = this.footprint(type, site);
      if (!footprint.valid) return null;
      site = this.make(type, footprint);
      this.facilities.push(site);
    } else if (!this.canPlace(site, type)) return null;
    this.pay(type);
    Object.assign(site, {
      built: false,
      remaining: TYPES[type].buildTime,
      queue: [],
    });
    this.nav?.rebuild();
    return site;
  }
  exitPoint(building) {
    return { x: building.x + 2, y: building.y + 0.5 };
  }
  nearbyUnits(o) {
    return this.units.filter(
      (u) => u.team === "ally" && u.hp > 0 && distance(u, o) <= 5,
    );
  }
  canRally(o) {
    return (
      !!o && o.team === "ally" && (o === this.hq || o.built || o.remaining > 0)
    );
  }
  setRally(building, p) {
    if (!this.canRally(building)) return false;
    const dest = { x: bound(p.x, -18, 18), y: bound(p.y, -19, 18) };
    building.rally =
      this.nav && !this.nav.cost[this.nav.cell(dest)]
        ? this.nav.position(this.nav.nearest(this.nav.cell(dest)))
        : dest;
    return true;
  }
  deploy(building, type) {
    const unit = this.spawn(type, this.exitPoint(building));
    unit.goal = building.rally || this.hq.rally || null;
    if (type === "truck" && building.type === "refinery") unit.depot = building;
    return unit;
  }
  train(building, type) {
    if (
      this.end ||
      !this.facilities.includes(building) ||
      !building.built ||
      !TYPES[building.type].produces?.includes(type) ||
      !this.canBuy(type) ||
      building.queue.length >= 5
    )
      return false;
    this.pay(type);
    building.queue.push({ type, left: type === "tank" ? 8 : 4 });
    return true;
  }
  updateBuildings(dt) {
    for (const b of [...this.facilities, ...this.sites]) {
      if (b.remaining > 0) {
        b.remaining = Math.max(0, b.remaining - dt);
        if (!b.remaining) {
          b.built = true;
          if (b.type === "refinery") {
            this.deploy(b, "truck");
          }
          this.notice(TYPES[b.type].name + " operational");
        }
        continue;
      }
      if (!b.built || !b.queue?.length) continue;
      const job = b.queue[0];
      job.left -= dt;
      if (job.left <= 0) {
        this.deploy(b, job.type);
        b.queue.shift();
        this.notice(TYPES[job.type].name + " ready");
      }
    }
  }
  move(u, p, dt, speed) {
    if (this.nav) {
      const key = this.nav.cell(p) + ":" + this.nav.version;
      if (u.pathKey !== key) {
        u.pathKey = key;
        u.path = this.nav.route(u, p);
      }
      while (u.path.length && distance(u, u.path[0]) < 0.045) u.path.shift();
      if (!u.path.length)
        return distance(u, p) < 0.35 || this.nav.cost[this.nav.cell(p)] === 0;
      p = u.path[0];
    }
    const dx = p.x - u.x,
      dy = p.y - u.y,
      d = Math.hypot(dx, dy);
    if (d < 0.045) return true;
    const step = Math.min(d, speed * dt);
    u.x += (dx * step) / d;
    u.y += (dy * step) / d;
    u.angle = Math.atan2(dy, dx);
    return step === d && (!this.nav || u.path.length === 1);
  }
  assign(truck, site) {
    if (!this.sites.includes(site) || !site.built) return;
    if (truck.job?.loader === truck.id) truck.job.loader = null;
    truck.hold = false;
    truck.job = site;
    truck.manual = true;
    truck.progress = 0;
    truck.goal = null;
  }
  route(u, dt) {
    if (!u.depot?.built)
      u.depot = this.refineries().sort(
        (a, b) => distance(u, a) - distance(u, b),
      )[0];
    if (!u.depot) return;
    if (u.cargo) {
      const dock = this.exitPoint(u.depot);
      if (this.move(u, dock, dt, 1.25) && distance(u, dock) < 0.35) {
        this[u.cargoType] += u.cargo;
        if (u.cargoType === "oil") this.oilDelivered = true;
        u.cargo = 0;
        if (!u.hold) u.goal = u.depot.rally || null;
        if (!u.manual) u.job = null;
      }
      return;
    }
    if (!u.job) {
      const score = (s) =>
        s.reserve -
        30 *
          this.units.filter((t) => t !== u && t.job === s && !t.cargo).length;
      u.job = this.sites
        .filter((s) => s.built)
        .sort((a, b) => score(b) - score(a))[0];
    }
    const s = u.job;
    if (!s) return;
    const waiting = s.loader !== null && s.loader !== u.id;
    const p = {
      x: s.x + 1.55 + (waiting ? 0.55 : 0),
      y: s.y + 0.55 + (waiting ? 0.45 * (1 + (u.id % 3)) : 0),
    };
    if (!this.move(u, p, dt, 1.25) || waiting || s.reserve < 1) return;
    if (s.loader === null) {
      if (s.reserve < 12) return;
      s.loader = u.id;
    }
    u.progress += dt;
    if (u.progress >= 1.7) {
      u.cargo = Math.min(35, Math.floor(s.reserve));
      u.cargoType = s.type;
      u.goal = s.rally || null;
      s.reserve -= u.cargo;
      s.loader = null;
      u.progress = 0;
    }
  }
  command(units, p, target, kind = "context") {
    units.forEach((u, i) => {
      if (
        kind === "context" &&
        u.type === "truck" &&
        this.sites.includes(target) &&
        target.built
      ) {
        this.assign(u, target);
        return;
      }
      if (u.job?.loader === u.id) u.job.loader = null;
      u.job = null;
      u.manual = false;
      u.progress = 0;
      u.hold = u.type === "truck";
      u.order =
        kind === "context" && target?.team === "enemy" && u.type !== "truck"
          ? target
          : null;
      u.movement =
        kind === "attackMove" && u.type !== "truck" ? "attackMove" : "move";
      u.goal = {
        x: bound(p.x + (i % 3) * 0.55, -18, 18),
        y: bound(p.y + Math.floor(i / 3) * 0.55, -19, 18),
      };
    });
  }
  tick(dt) {
    if (this.end) return;
    this.time += dt;
    for (const s of this.sites)
      if (s.built)
        s.reserve = Math.min(
          s.capacity,
          s.reserve + dt * (s.type === "metal" ? 4.2 : 3.2),
        );
    this.updateBuildings(dt);
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      u.cool = Math.max(0, u.cool - dt);
      if (u.type === "truck") {
        if (u.goal) {
          if (this.move(u, u.goal, dt, 1.25)) u.goal = null;
        } else if (!u.hold || u.cargo) this.route(u, dt);
        continue;
      }
      const isAlly = u.team === "ally",
        range = u.type === "tank" ? 3.5 : 2.4;
      let t = u.order?.hp > 0 ? u.order : null;
      if (
        !t &&
        (!u.goal || u.movement === "attackMove" || u.team === "enemy")
      ) {
        const foes = [...this.units, isAlly ? this.enemy : this.hq].filter(
          (v) => v.team !== u.team && v.hp > 0,
        );
        t = foes
          .filter(
            (v) =>
              distance(v, u) <
              range + (u.movement === "attackMove" || !isAlly ? 1.6 : 0),
          )
          .sort((a, b) => distance(u, a) - distance(u, b))[0];
      }
      if (t && distance(u, t) <= range) {
        u.angle = Math.atan2(t.y - u.y, t.x - u.x);
        if (!u.cool) {
          t.hp -= u.type === "tank" ? 32 : 8;
          u.cool = u.type === "tank" ? 1.9 : 0.85;
          this.shots.push({ x: u.x, y: u.y, tx: t.x, ty: t.y, life: 0.18 });
        }
      } else if (t || u.goal) {
        if (
          this.move(u, t || u.goal, dt, u.type === "tank" ? 0.95 : 1.12) &&
          !t
        )
          u.goal = null;
      }
    }
    this.units = this.units.filter((u) => {
      if (u.hp > 0) return true;
      if (u.job?.loader === u.id) u.job.loader = null;
      return false;
    });
    this.shots = this.shots.filter((b) => (b.life -= dt) > 0);
    if (this.enemy.hp <= 0) this.end = "Sector secured";
    if (this.hq.hp <= 0) this.end = "Headquarters lost";
  }
  objective() {
    if (!this.refineries().length)
      return this.facilities.some((p) => p.type === "refinery")
        ? "Finish refinery construction"
        : "Build a refinery";
    if (!this.sites.some((s) => s.type === "oil" && s.built))
      return "Build an oil well";
    if (!this.oilDelivered) return "Deliver oil to a refinery";
    return "Destroy the northern outpost";
  }
}
