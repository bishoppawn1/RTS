const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sources = ["sim", "art", "world", "navigation"].map((name) =>
  fs.readFileSync(path.join(__dirname, "..", name + ".js"), "utf8"),
);
const { Battle, Navigation, generateTerrain, Painter } = vm.runInNewContext(
  sources.join("\n") + ";({Battle, Navigation, generateTerrain, Painter})",
);
function game() {
  const b = new Battle();
  b.nav = new Navigation(b, generateTerrain(b).things);
  return b;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 20); i++) b.tick(0.05);
}
function plot(b, type, near = b.hq) {
  const legal = [];
  for (let col = -9; col < 10; col++)
    for (let row = -7; row < 9; row++) {
      const fp = b.footprint(type, { x: col + 0.5, y: row });
      if (fp.valid) legal.push(fp);
    }
  assert(legal.length, "a legal footprint must exist");
  return legal.sort(
    (a, c) =>
      Math.hypot(near.x - a.x, near.y - a.y) -
      Math.hypot(near.x - c.x, near.y - c.y),
  )[0];
}
test("grid construction reserves the footprint and grants exactly one truck at completion", () => {
  const b = game(),
    site = plot(b, "refinery");
  assert.equal(b.build({ x: 15, y: 15 }, "refinery"), null);
  assert.equal(b.build(b.hq, "refinery"), null);
  assert.equal(b.metal, 420);
  const refinery = b.build(site, "refinery");
  assert(refinery);
  assert.equal(b.metal, 270);
  assert.equal(b.build(site, "refinery"), null);
  advance(b, 9.9);
  assert(!refinery.built);
  assert(!b.units.some((u) => u.type === "truck"));
  advance(b, 0.2);
  const trucks = b.units.filter((u) => u.type === "truck");
  assert.equal(trucks.length, 1);
  const truck = trucks[0];
  assert.equal(truck.job.type, "metal");
  for (let i = 0; i < 1600 && b.metal === 270; i++) b.tick(0.05);
  assert(b.metal > 270);
  const dock = b.exitPoint(refinery);
  assert(Math.hypot(truck.x - dock.x, truck.y - dock.y) < 0.35);
  assert.equal(b.units.filter((u) => u.type === "truck").length, 1);
  const second = b.build(plot(b, "refinery"), "refinery");
  advance(b, 10.1);
  assert(second.built);
  assert.equal(
    b.units.filter((u) => u.type === "truck" && u.depot === second).length,
    1,
  );
});
test("independent timed production, resource assignments, exclusive loading, and rallies", () => {
  const b = game();
  b.metal = 2000;
  const refinery = b.build(plot(b, "refinery"), "refinery");
  advance(b, 10.1);
  const well = b.sites.find((s) => s.type === "oil");
  assert.equal(b.build(well, "metal"), null);
  assert(b.build(well, "oil"));
  const barracks = b.build(plot(b, "barracks"), "barracks"),
    factory = b.build(plot(b, "factory"), "factory");
  assert(barracks && factory);
  assert(!b.train(barracks, "infantry"));
  assert(!b.train(factory, "truck"));
  advance(b, 14.1);
  assert(well.built && factory.built && barracks.built);
  assert(!b.train(b.hq, "infantry"));
  assert(!b.train(barracks, "tank"));
  assert(!b.train(factory, "infantry"));
  assert(!b.train(factory, "tank"));
  const rally = { x: 1.65, y: 0.05 };
  b.setRally(factory, rally);
  b.setRally(barracks, rally);
  assert(b.train(barracks, "infantry"));
  assert(b.train(factory, "truck"));
  advance(b, 4.05);
  const infantry = b.units.find(
    (u) => u.team === "ally" && u.type === "infantry",
  );
  assert(infantry);
  assert.equal(infantry.goal, barracks.rally);
  const trucks = b.units.filter((u) => u.type === "truck");
  assert.equal(trucks.length, 2);
  assert.equal(trucks[1].goal, factory.rally);
  trucks.forEach((u) => b.command([u], well, well));
  let loaded = false,
    delivered = false;
  for (let i = 0; i < 4000; i++) {
    const oil = b.oil;
    b.tick(0.05);
    assert(well.reserve <= 160 && well.reserve >= 0);
    assert(trucks.filter((u) => u.job === well && u.progress > 0).length <= 1);
    assert(trucks.every((u) => u.cargo <= 35));
    loaded ||= trucks.some((u) => u.cargoType === "oil" && u.cargo);
    if (b.oil > oil) {
      const dock = b.exitPoint(refinery);
      assert(trucks.some((u) => Math.hypot(u.x - dock.x, u.y - dock.y) < 0.35));
      delivered = true;
    }
    if (b.oil >= 55) break;
  }
  assert(loaded && delivered);
  const oil = b.oil,
    metal = b.metal;
  assert(b.train(factory, "tank"));
  assert.equal(b.oil, oil - 55);
  assert.equal(b.metal, metal - 180);
  advance(b, 8.05);
  assert.equal(
    b.units.filter((u) => u.type === "tank" && u.team === "ally").length,
    2,
  );
});
test("a Move order bypasses enemies while Attack Move engages and resumes", () => {
  for (const kind of ["move", "attackMove"]) {
    const b = new Battle();
    b.units = [];
    const tank = b.spawn("tank", { x: 0, y: 0 }),
      foe = b.spawn("infantry", { x: 2, y: 1 }, "enemy");
    const destination = { x: 8, y: 0 };
    b.command([tank], destination, null, kind);
    advance(b, 3);
    if (kind === "move") {
      assert.equal(foe.hp, foe.maxHp);
      assert(tank.x > 2);
    } else {
      assert(foe.hp < foe.maxHp);
      assert(tank.goal);
      assert.equal(tank.x, 0);
    }
    advance(b, 18);
    assert.equal(tank.goal, null);
    assert(Math.abs(tank.x - 8) < 0.05);
  }
});
test("nearby selection includes friendly units of all types and excludes distant units", () => {
  const b = new Battle();
  b.units = [];
  const a = b.spawn("tank", b.hq),
    c = b.spawn("truck", { x: b.hq.x + 4, y: b.hq.y });
  b.spawn("infantry", { x: b.hq.x + 6, y: b.hq.y });
  b.spawn("infantry", b.hq, "enemy");
  assert.equal(b.nearbyUnits(b.hq).length, 2);
  assert(b.nearbyUnits(a).includes(c));
});
test("tactical map and field project, pick, and orient the same world points", () => {
  const field = new Painter(null, 47, 381, 197);
  field.cx = 3;
  field.cy = -4;
  const radar = new Painter(null, 2.9, 85, 44);
  for (const [x, y] of [
    [-8, 9],
    [1, 1],
    [3, -4],
    [14, -12],
  ]) {
    const ground = radar.groundPoint(...radar.screen(x, y));
    assert(Math.hypot(ground.x - x, ground.y - y) < 1e-9);
    const fieldPoint = field.groundPoint(...field.screen(x, y));
    assert(Math.hypot(ground.x - fieldPoint.x, ground.y - fieldPoint.y) < 1e-9);
  }
  const corners = [
    [0, 0],
    [760, 0],
    [760, 394],
  ].map(([x, y]) => {
    const p = field.groundPoint(x, y);
    return radar.screen(p.x, p.y);
  });
  assert(Math.abs(corners[0][1] - corners[1][1]) < 1e-9);
  assert(Math.abs(corners[1][0] - corners[2][0]) < 1e-9);
});
