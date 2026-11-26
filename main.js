"use strict";
const $ = (id) => document.getElementById(id);
const paths = {
  metal: '<path d="m3 15 4-7h9l5 7-3 3H5zM3 15h18M7 8l4 7m5-7-3 7"/>',
  oil: '<path d="M12 2c-2 4-7 8-7 13a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M9 15c0 2 1 3 3 3"/>',
  units:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3c0-6 12-6 12 0v3zM16 5a3 3 0 0 1 0 6m1 3c3 0 4 2 4 4v2"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  play: '<path d="m7 4 12 8-12 8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.5"/>',
  flag: '<path d="M5 21V4m0 1c5-7 9 5 15-1v10c-6 6-10-6-15 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  focus:
    '<path d="M3 9V4h5m8 0h5v5m0 7v5h-5m-8 0H3v-5"/><circle cx="12" cy="12" r="3"/>',
  radar:
    '<circle cx="12" cy="12" r="9"/><path d="m12 12 6-7m-2 8a4 4 0 1 1-5-5"/>',
  select:
    '<path d="M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5"/><path d="m8 8 8 3-4 2-2 4z"/>',
  commands: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1m-12 5h12"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
};
function icon(s) {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths[s] +
    "</svg>"
  );
}
document
  .querySelectorAll("[data-icon]")
  .forEach((n) => (n.innerHTML = icon(n.dataset.icon)));
let sim = new Battle(),
  field = new Field($("field"), sim),
  selected = [sim.hq],
  mode = null,
  cursor = null,
  touchFootprint = null,
  lastPick = null,
  paused = false,
  drag = null,
  box = null,
  point = null,
  messageUntil = 0,
  artKey = "",
  radarBg = null,
  radarKey = "",
  lastUI = -Infinity,
  last = performance.now(),
  ended = false;
const keys = new Set(),
  canvas = $("field");
function notify(s) {
  $("message").textContent = s;
  messageUntil = performance.now() + 3000;
}
const buildTypes = ["refinery", "barracks", "factory", "metal", "oil"];
const orders = {
  rally: {
    name: "Set rally",
    key: "P",
    icon: "flag",
    hint: "Choose destination",
  },
  move: { name: "Move", key: "M", icon: "flag", hint: "To destination" },
  attackMove: {
    name: "Attack Move",
    key: "A",
    icon: "focus",
    hint: "Engage on route",
  },
  haul: {
    name: "Assign route",
    key: "R",
    icon: "metal",
    hint: "Choose a site",
  },
};
function contextTypes() {
  const o = selected[0];
  if (sim.canRally(o)) return [...(TYPES[o.type].produces || []), "rally"];
  const units = selected.filter(
    (u) => u.team === "ally" && u.angle !== undefined,
  );
  if (!units.length) return [];
  return [
    "move",
    ...(units.some((u) => u.type !== "truck") ? ["attackMove"] : []),
    ...(units.some((u) => u.type === "truck") ? ["haul"] : []),
  ];
}
function locked(type) {
  if (orders[type]) return "";
  if (!TYPES[type].buildTime) return sim.productionBlock(selected, type);
  if (!sim.canBuy(type)) return "Insufficient resources";
  return "";
}
function thumbnail(cv, type, opts = {}) {
  let r = cv.getBoundingClientRect(),
    d = Math.min(devicePixelRatio || 1, 2);
  if (r.width <= 0 || r.height <= 0) return;
  cv.width = Math.round(r.width * d);
  cv.height = Math.round(r.height * d);
  let c = cv.getContext("2d");
  c.scale(d, d);
  let large = TYPES[type].buildTime || ["hq", "enemyHQ"].includes(type),
    size = large
      ? Math.min(r.width / 5.25, r.height / 3.95)
      : Math.min(r.width / 2.1, r.height / 1.48);
  let p = new Painter(c, size, r.width * 0.5, r.height * (large ? 0.74 : 0.65));
  if (TYPES[type].infantry) p.scale *= 1.55;
  model(p, type, opts);
}
function drawCards(host, types) {
  host.replaceChildren();
  for (const [i, type] of types.entries()) {
    const b = document.createElement("button");
    b.className = "card";
    b.dataset.type = type;
    const order = orders[type];
    if (order) {
      b.innerHTML =
        '<div class="cardart orderart">' +
        icon(order.icon) +
        "<span>" +
        order.key +
        '</span></div><div class="cardname">' +
        order.name +
        '</div><div class="cardcost">' +
        order.hint +
        "</div>";
      b.title = order.name + " (" + order.key + "), then click the battlefield";
    } else {
      const count = TYPES[type].trainTime ? selected.length : 1;
      const [m, o] = TYPES[type].cost.map((cost) => cost * count);
      b.innerHTML =
        '<div class="cardart"><canvas></canvas><span>' +
        (i + 1) +
        '</span></div><div class="cardname">' +
        TYPES[type].name +
        (count > 1 ? " ×" + count : "") +
        '</div><div class="cardcost"><span>' +
        icon("metal") +
        m +
        "</span>" +
        (o ? '<span class="oilcost">' + icon("oil") + o + "</span>" : "") +
        "<small>" +
        (TYPES[type].buildTime || TYPES[type].trainTime) +
        "s</small></div>";
      b.title =
        TYPES[type].name +
        " · " +
        m +
        " metal" +
        (o ? ", " + o + " oil" : "") +
        (TYPES[type].role ? " · " + TYPES[type].role : "");
    }
    b.onclick = () => action(type);
    host.append(b);
    if (!order) thumbnail(b.querySelector("canvas"), type);
  }
}
function cards() {
  const commands = contextTypes();
  const producer =
    selected[0]?.team === "ally" && TYPES[selected[0].type].produces;
  $("commandTitle").textContent = producer
    ? (selected[0].type === "factory" ? "FACTORY" : "BARRACKS") + " PRODUCTION"
    : "ORDERS";
  $("selectProducers").hidden = !producer;
  $("selectProducers").textContent =
    selected[0]?.type === "factory" ? "Select factories" : "Select barracks";
  drawCards($("cards"), commands);
  if (!commands.length)
    $("cards").textContent = "Select a friendly unit or building.";
  if (!$("buildMenu").hidden) drawCards($("buildCards"), buildTypes);
}
$("selectProducers").onclick = () => {
  const type = selected[0]?.type;
  const group = sim.facilities.filter(
    (b) => b.type === type && b.team === "ally" && b.built && b.hp > 0,
  );
  if (group.length) choose(group);
  else notify("Construction in progress");
};
function showBuild(open) {
  $("buildMenu").hidden = !open;
  $("openBuild").setAttribute("aria-expanded", String(open));
  if (open) {
    cancelMode();
    drawCards($("buildCards"), buildTypes);
    ui();
  }
}
$("openBuild").onclick = () => showBuild($("buildMenu").hidden);
$("closeBuild").onclick = () => showBuild(false);
$("mapToggle").onclick = () => {
  const opened = document.querySelector(".radar").classList.toggle("expanded");
  $("mapToggle").setAttribute("aria-expanded", String(opened));
  minimap();
};
function cancelMode() {
  mode = null;
  touchFootprint = null;
  $("placement").hidden = true;
  canvas.style.cursor = "default";
}
function action(type) {
  if (paused || sim.end) {
    notify("Resume the operation to issue orders");
    return;
  }
  if (mode === type) {
    cancelMode();
    return;
  }
  const reason = locked(type);
  if (reason) {
    notify(reason);
    return;
  }
  if (orders[type]) {
    if (!contextTypes().includes(type)) return;
    mode = type;
    $("placement").textContent =
      type === "rally"
        ? "Select a rally point"
        : type === "haul"
          ? "Select an operating mine or oil well"
          : "Select " +
            (type === "attackMove" ? "an attack-move" : "a move") +
            " destination";
  } else if (TYPES[type].buildTime) {
    const dims = TYPES[type].tiles;
    if (dims) {
      $("placement").textContent =
        TYPES[type].name +
        " · " +
        dims.join(" × ") +
        " · Place on open grid tiles";
    } else {
      const options = sim.sites
        .filter((s) => sim.canPlace(s, type))
        .sort((a, b) => distance(a, sim.hq) - distance(b, sim.hq));
      if (!options.length) {
        notify("No undeveloped " + type + " deposits");
        return;
      }
      $("placement").textContent =
        type === "metal" ? "Select a metal deposit" : "Select an oil field";
      if (
        !options.some((s) => {
          const [x, y] = field.p.screen(s.x, s.y);
          return x > 60 && x < field.w - 60 && y > 90 && y < field.h - 40;
        })
      )
        field.center(options[0]);
    }
    showBuild(false);
    mode = type;
    touchFootprint = null;
  } else {
    const b = selected[0];
    if (sim.train(selected, type))
      notify(
        TYPES[type].name +
          (selected.length > 1
            ? " queued at each of " + selected.length + " buildings"
            : " queued at " + TYPES[b.type].name.toLowerCase()),
      );
    else notify("Production queue full");
    ui();
    return;
  }
  $("placement").textContent += " · Esc to cancel";
  $("placement").hidden = false;
  canvas.style.cursor = "crosshair";
  ui();
}
function choose(arr) {
  selected = arr;
  artKey = "";
  cancelMode();
  cards();
  ui();
}
function ui() {
  if (selected.some((o) => o.hp <= 0)) {
    selected = selected.filter((o) => o.hp > 0);
    cancelMode();
    cards();
  }
  let o = selected[0];
  $("metal").textContent = Math.floor(sim.metal);
  $("oil").textContent = Math.floor(sim.oil);
  $("units").textContent = sim.units.filter((u) => u.team === "ally").length;
  $("clock").textContent = [
    Math.floor(sim.time / 60),
    Math.floor(sim.time % 60),
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  $("objective").textContent = sim.objective();
  $("zoom").textContent = Math.round(field.zoom * 100) + "%";
  $("status").textContent = paused ? "PAUSED" : "LIVE";
  $("selected-count").textContent =
    String(selected.length).padStart(2, "0") + " SELECTED";
  let label = o ? TYPES[o.type].name : "No selection",
    category = o
      ? o.team === "enemy"
        ? "HOSTILE"
        : o.remaining
          ? "CONSTRUCTION"
          : o.built === false
            ? "DEPOSIT"
            : o.angle !== undefined
              ? "UNIT"
              : "STRUCTURE"
      : "FIELD COMMAND";
  if (o?.built === false && !o.remaining)
    label = o.type === "metal" ? "Metal deposit" : "Oil field";
  if (selected.length > 1) {
    label =
      selected.length +
      (o.type === "factory"
        ? " factories"
        : o.type === "barracks"
          ? " barracks"
          : " units");
    category = "CONTROL GROUP";
  }
  $("name").textContent = label;
  $("category").textContent = category;
  let hp = selected.reduce((s, x) => s + Math.max(x.hp, 0), 0),
    max = selected.reduce((s, x) => s + x.maxHp, 0);
  $("healthtext").textContent = o?.remaining
    ? Math.ceil(o.remaining) + "s to completion"
    : o?.built === false
      ? "UNDEVELOPED"
      : o
        ? Math.ceil(hp) + " / " + max + " HP"
        : "Select a unit or structure";
  $("health").style.width =
    (o?.remaining
      ? 100 * (1 - o.remaining / TYPES[o.type].buildTime)
      : o && o.built !== false
        ? (100 * hp) / max
        : 0) + "%";
  let detail = "";
  if (selected.length > 1 && TYPES[o.type].produces)
    detail =
      "One per building · Queues " +
      selected.map((b) => b.queue.length + "/5").join(" · ");
  else if (selected.length > 1) detail = "Right-click to issue an order";
  else if (o?.remaining) detail = "Under construction";
  else if (o === sim.hq) detail = "Sets the default rally point";
  else if (o?.type === "refinery") detail = "Receives metal and oil shipments";
  else if (TYPES[o?.type]?.produces)
    detail = o.queue.length
      ? "Queue " +
        o.queue.length +
        "/5 · " +
        TYPES[o.queue[0].type].name +
        " " +
        Math.ceil(o.queue[0].left) +
        "s"
      : "Ready for production";
  else if (o?.built)
    detail =
      Math.floor(o.reserve) +
      " / " +
      o.capacity +
      " stored · " +
      (o.loader ? "Loading" : "Extracting");
  else if (o?.built === false)
    detail = "Build a " + TYPES[o.type].name.toLowerCase() + " here";
  else if (o?.type === "truck")
    detail = o.cargo
      ? "Returning · " + o.cargo + " " + o.cargoType
      : o.job?.loader === o.id
        ? "Loading " + o.job.type
        : o.job
          ? "Hauling " + o.job.type
          : "Ready";
  else if (o)
    detail =
      o.team === "enemy"
        ? "Northern garrison"
        : o.goal || o.order?.hp > 0
          ? o.order?.hp > 0
            ? "Attacking"
            : o.movement === "attackMove"
              ? "Attack moving"
              : "Moving"
          : TYPES[o.type].role || "Standing by";
  $("detail").textContent = detail;
  const k =
    (o?.type || "") +
    o?.built +
    o?.team +
    $("portrait").clientWidth +
    "x" +
    $("portrait").clientHeight;
  if (k !== artKey) {
    artKey = k;
    const cv = $("portrait");
    if (o) thumbnail(cv, o.type, o);
    else cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }
  document.querySelectorAll(".card").forEach((b) => {
    b.classList.toggle("active", mode === b.dataset.type);
    b.classList.toggle("disabled", Boolean(locked(b.dataset.type)));
  });
  while (sim.events.length) notify(sim.events.shift());
  if (performance.now() > messageUntil) $("message").textContent = "";
}
function radarProjection(w, h) {
  return new Painter(
    null,
    Math.min((w - 8) / (40 * 2 * 0.866), (h - 8) / (40 * 2 * 0.45)),
    w / 2,
    h / 2,
  );
}
function minimap() {
  const cv = $("mini"),
    w = cv.clientWidth,
    h = cv.clientHeight;
  if (!w || !h) return;
  const d = Math.min(devicePixelRatio || 1, 2),
    key = [w, h, d].join("/"),
    c = cv.getContext("2d"),
    p = radarProjection(w, h);
  if (key !== radarKey) {
    radarKey = key;
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    radarBg = document.createElement("canvas");
    radarBg.width = cv.width;
    radarBg.height = cv.height;
    const g = radarBg.getContext("2d");
    g.scale(d, d);
    g.fillStyle = "#29352b";
    g.fillRect(0, 0, w, h);
    p.c = g;
    p.poly(
      [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
      "#47523f",
    );
    g.clip();
    for (let v = -20; v <= 20; v += 5) {
      p.line([v, -20], [v, 20], "#59634f", 0.06);
      p.line([-20, v], [20, v], "#59634f", 0.06);
    }
    for (let y = -20; y < 20; y += 0.4)
      p.line([river(y), y], [river(y + 0.4), y + 0.4], "#738f83", 1.85);
    for (const road of ROADS)
      for (let j = 1; j < road.length; j++)
        p.line(road[j - 1], road[j], "#9b977a", 0.35);
    for (const o of field.map.things) {
      const [x, y] = p.screen(o.x, o.y);
      g.fillStyle = o.type === "pine" ? "#334332" : "#737965";
      g.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  c.setTransform(d, 0, 0, d, 0, 0);
  c.drawImage(radarBg, 0, 0, w, h);
  for (const o of [...sim.structures, ...sim.units]) {
    if (o.hp <= 0) continue;
    const [x, y] = p.screen(o.x, o.y),
      r = o.angle === undefined ? 2 : 1.5;
    c.fillStyle =
      o.team === "enemy"
        ? "#e39c76"
        : o.built === false
          ? "#d9bd7a"
          : "#c4ddb1";
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const corners = [
    [0, 0],
    [field.w, 0],
    [field.w, field.h],
    [0, field.h],
  ].map(([x, y]) => {
    const q = field.inverse(x, y);
    return p.screen(q.x, q.y);
  });
  p.c = c;
  p.shape(corners, "#c4dda515", "#d3e6c3", 1);
}
$("mini").onpointerdown = (e) => {
  const r = $("mini").getBoundingClientRect(),
    p = radarProjection(r.width, r.height);
  const q = p.groundPoint(e.clientX - r.left, e.clientY - r.top);
  if (Math.abs(q.x) > 20 || Math.abs(q.y) > 20) return;
  field.center({ x: bound(q.x, -19, 19), y: bound(q.y, -19, 19) });
};
function coords(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function pick(p) {
  for (const o of field.labels.slice().reverse()) {
    let [x, y, w, h] = o.labelRect || [];
    if (p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return o;
  }
  let best = null,
    score = 1;
  for (let o of [...sim.structures, ...sim.units]) {
    if (o.hp <= 0) continue;
    let base = o.type === "hq" || o.type === "enemyHQ",
      unit = o.angle !== undefined;
    let [x, y] = field.p.screen(o.x, o.y, base ? 0.62 : unit ? 0.24 : 0.3);
    let w = unit ? (TYPES[o.type].infantry ? 0.28 : 0.8) : base ? 2.3 : 1.4;
    let h = unit ? 0.46 : base ? 1.38 : 1.05;
    let v =
      ((x - p.x) / Math.max(8, w * field.scale)) ** 2 +
      ((y - p.y) / Math.max(9, h * field.scale)) ** 2;
    if (v < score) {
      best = o;
      score = v;
    }
  }
  return best;
}
function order(p, obj, kind = "context") {
  if (paused || sim.end) return;
  if (
    selected.length &&
    selected.every((o) => sim.canRally(o)) &&
    (kind === "rally" || kind === "context")
  ) {
    for (const building of selected)
      sim.setRally(building, field.inverse(p.x, p.y));
    notify("Rally point set");
    return;
  }
  let units = selected.filter(
    (o) => o.team === "ally" && o.angle !== undefined,
  );
  if (!units.length) {
    notify("Select a hauler or combat unit first");
    return;
  }
  if (paused || sim.end) return;
  let dest =
    kind === "context" && obj?.team === "enemy" ? obj : field.inverse(p.x, p.y);
  if (kind === "haul") units = units.filter((u) => u.type === "truck");
  sim.command(units, dest, obj, kind === "haul" ? "context" : kind);
  point = { ...dest, until: performance.now() + 700 };
  notify(
    kind === "attackMove"
      ? "Attack Move order received"
      : (kind === "context" || kind === "haul") &&
          sim.sites.includes(obj) &&
          obj.built &&
          units.every((u) => u.type === "truck")
        ? "Hauling route assigned"
        : kind === "context" && obj?.team === "enemy"
          ? "Attack order received"
          : "Move order received",
  );
}
function click(p, e) {
  const o = pick(p);
  if (mode) {
    if (e.button === 2) {
      cancelMode();
      return;
    }
    if (orders[mode]) {
      if (
        mode === "haul" &&
        (!sim.sites.includes(o) || !o.built || o.team !== "ally")
      ) {
        notify("Select an operating mine or oil well");
        return;
      }
      order(p, o, mode);
      cancelMode();
    } else {
      const onGrid = TYPES[mode].tiles;
      const site = onGrid ? sim.footprint(mode, field.inverse(p.x, p.y)) : o;
      if (
        onGrid &&
        e.pointerType === "touch" &&
        site.valid &&
        (!touchFootprint ||
          touchFootprint.col !== site.col ||
          touchFootprint.row !== site.row)
      ) {
        touchFootprint = site;
        cursor = p;
        notify("Tap the footprint again to build");
        return;
      }
      const built = !paused && sim.build(site, mode);
      if (built) {
        field.dirty = true;
        notify(TYPES[mode].name + " construction started");
        cancelMode();
        choose([built]);
      } else
        notify(
          onGrid
            ? "Keep the footprint on clear tiles with an open exit"
            : "Select the matching undeveloped deposit",
        );
    }
    return;
  }
  if (
    e.button === 0 &&
    o?.team === "ally" &&
    (o.angle !== undefined || sim.canRally(o))
  ) {
    const now = performance.now();
    if (lastPick?.id === o.id && now - lastPick.at < 450) {
      const group = sim.nearbyUnits(o);
      lastPick = null;
      if (group.length) {
        choose(group);
        notify(group.length + " nearby selected");
      } else notify("No friendly units nearby");
      return;
    }
    lastPick = { id: o.id, at: now };
  } else lastPick = null;
  if (
    e.button === 2 ||
    (e.pointerType === "touch" &&
      selected.some((u) => u.angle !== undefined && u.team === "ally") &&
      (!o ||
        o.team === "enemy" ||
        (sim.sites.includes(o) &&
          o.built &&
          selected.some((u) => u.type === "truck"))))
  ) {
    order(p, o);
    return;
  }
  if (o) {
    if (e.shiftKey && o.team === "ally" && TYPES[o.type].produces) {
      choose([
        ...new Set([
          ...selected.filter((b) => b.team === "ally" && b.type === o.type),
          o,
        ]),
      ]);
    } else if (e.shiftKey && o.team === "ally" && o.angle !== undefined) {
      choose([
        ...new Set([
          ...selected.filter((u) => u.team === "ally" && u.angle !== undefined),
          o,
        ]),
      ]);
    } else choose([o]);
  } else choose([]);
}
canvas.oncontextmenu = (e) => e.preventDefault();
canvas.onpointerdown = (e) => {
  if (drag) return;
  showBuild(false);
  cursor = coords(e);
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  const p = coords(e);
  drag = {
    start: p,
    last: p,
    id: e.pointerId,
    pan: e.button === 1 || e.altKey || e.pointerType === "touch",
    moved: false,
  };
};
canvas.onpointerleave = () => {
  if (!touchFootprint) cursor = null;
};
canvas.onpointermove = (e) => {
  cursor = coords(e);
  if (!drag || drag.id !== e.pointerId) return;
  let p = coords(e),
    d = Math.hypot(p.x - drag.start.x, p.y - drag.start.y);
  if (d > 5) drag.moved = true;
  if (drag.moved) {
    if (drag.pan) {
      let a = field.inverse(drag.last.x, drag.last.y),
        b = field.inverse(p.x, p.y);
      field.pan(a.x - b.x, a.y - b.y);
    } else {
      box = {
        x: Math.min(p.x, drag.start.x),
        y: Math.min(p.y, drag.start.y),
        w: Math.abs(p.x - drag.start.x),
        h: Math.abs(p.y - drag.start.y),
      };
    }
  }
  drag.last = p;
};
canvas.onpointerup = (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  let p = coords(e);
  if (!drag.moved && e.button !== 1) click(p, e);
  else if (box && !mode) {
    let group = sim.units.filter((u) => {
      let [x, y] = field.p.screen(u.x, u.y, 0.2);
      return (
        u.team === "ally" &&
        x >= box.x &&
        x <= box.x + box.w &&
        y >= box.y &&
        y <= box.y + box.h
      );
    });
    choose(group);
  }
  drag = null;
  box = null;
};
canvas.onpointercancel = () => {
  drag = null;
  box = null;
};
function zoom(n) {
  field.zoom = bound(Math.round((field.zoom + n) * 100) / 100, 0.65, 1.8);
  field.dirty = true;
  ui();
}
canvas.onwheel = (e) => {
  e.preventDefault();
  zoom(e.deltaY < 0 ? 0.1 : -0.1);
};
$("zin").onclick = () => zoom(0.1);
$("zout").onclick = () => zoom(-0.1);
$("home").onclick = () => {
  field.center(sim.hq);
  choose([sim.hq]);
};
function dialog(title, body, actions) {
  const d = $("dialog");
  $("dialogtitle").textContent = title;
  $("dialogbody").innerHTML = body;
  const ac = $("dialogactions");
  ac.replaceChildren();
  for (let [name, fn] of actions) {
    let b = document.createElement("button");
    b.textContent = name;
    b.onclick = fn;
    ac.append(b);
  }
  if (!d.open) d.showModal();
  keys.clear();
}
function resume() {
  if (sim.end) return;
  paused = false;
  $("dialog").close();
  $("pause").innerHTML = icon("pause");
  $("pause").setAttribute("aria-label", "Pause game");
  ui();
}
function stop() {
  paused = true;
  $("pause").innerHTML = icon("play");
  $("pause").setAttribute("aria-label", "Resume game");
  ui();
}
function pauseMenu() {
  if (sim.end) return;
  stop();
  dialog(
    "Operation paused",
    "<p>Your units and extraction sites are holding position.</p>",
    [
      ["Resume", resume],
      ["Restart operation", confirmRestart],
    ],
  );
}
function confirmRestart() {
  dialog(
    "Restart Foothold?",
    "<p>This will reset your units, buildings, and resource stockpiles.</p>",
    [
      ["Restart", restart],
      ["Back", pauseMenu],
    ],
  );
}
function restart() {
  sim = new Battle();
  field.sim = sim;
  sim.nav = new Navigation(sim, field.map.things);
  field.cx = -0.18;
  field.cy = -1.33;
  field.zoom = 1;
  field.dirty = true;
  field.labels = [];
  selected = [sim.hq];
  ended = false;
  cancelMode();
  showBuild(false);
  lastPick = null;
  choose([sim.hq]);
  resume();
  notify("Operation restarted");
}
function manual() {
  if (sim.end) return;
  stop();
  dialog(
    "Field manual",
    "<p>Both sides start with a working mine, refinery and truck. The northern base collects its own resources, builds production facilities, and sends attack waves. Open <b>Build (B)</b> to expand on clear tiles. Green footprints fit. On touchscreens, tap once to preview and again to place. Add an oil well to supply your tanks.</p><ul><li>Select a truck and use <b>Assign route</b>, or right-click an operating mine or well. Trucks carry up to 35 from a site’s 160-unit reserve and unload at a refinery.</li><li>Build and select a <b>barracks</b> for infantry or a <b>vehicle factory</b> for haulers and tanks. Shift-click matching producers, or use Select factories or Select barracks. Each unit click queues one at every selected building and charges the displayed group cost. Rocketeers counter tanks, machine gunners counter infantry, and unarmed field medics heal wounded infantry.</li><li>Click or drag to select. Double-click a friendly unit or building to select friendly units within five tiles. Right-click terrain with a building selected to set its rally point. Choose <b>Move (M)</b> or <b>Attack Move (A)</b>, then click the destination. Right-click an enemy to focus fire.</li><li>Pan with the tac map, arrow keys, middle-drag, or touch drag. Scroll to zoom. H centers HQ and Space pauses.</li></ul>",
    [["Return to field", resume]],
  );
}
$("pause").onclick = () => (paused ? resume() : pauseMenu());
$("help").onclick = manual;
$("manual").onclick = manual;
$("dismiss").onclick = () => (sim.end ? restart() : resume());
$("dialog").oncancel = (e) => {
  e.preventDefault();
  if (!sim.end) resume();
};
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ($("dialog").open) {
    if (k === " " && e.target.tagName !== "BUTTON" && !sim.end) {
      e.preventDefault();
      resume();
    }
    return;
  }
  if (k === " " && e.target.tagName === "BUTTON") return;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === "escape") {
    cancelMode();
    showBuild(false);
  }
  if (k === "b") showBuild($("buildMenu").hidden);
  if (k === " ") pauseMenu();
  if (k === "h") $("home").click();
  if (k === "?" || k === "f1") {
    e.preventDefault();
    manual();
  }
  const command = Object.keys(orders).find(
    (type) => orders[type].key.toLowerCase() === k,
  );
  if (command && contextTypes().includes(command)) action(command);
  if (/^[1-5]$/.test(k)) {
    let type = ($("buildMenu").hidden ? contextTypes() : buildTypes)[+k - 1];
    if (type) action(type);
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => {
  keys.clear();
  drag = null;
  box = null;
});
function frame(now) {
  let dt = bound((now - last) / 1000, 0, 0.08);
  last = now;
  if (!paused && !document.hidden) {
    sim.tick(dt);
    if (sim.end && !ended) {
      ended = true;
      stop();
      dialog(
        sim.end,
        "<p>" +
          (sim.enemy.hp <= 0
            ? "The northern outpost has fallen. Iron Basin is under your control."
            : "Your command depot has fallen.") +
          "</p>",
        [["Play again", restart]],
      );
    }
  }
  let x = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0),
    y = (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0);
  if (x || y)
    field.pan(((x + y) * dt * 5) / field.zoom, ((y - x) * dt * 5) / field.zoom);
  field.render(selected, mode, box, point, cursor);
  if (now - lastUI > 150) {
    ui();
    minimap();
    lastUI = now;
  }
  requestAnimationFrame(frame);
}
cards();
new ResizeObserver(() => {
  artKey = "";
  cards();
  ui();
}).observe($("dock"));
requestAnimationFrame(frame);
