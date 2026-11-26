// A half-tile navigation grid keeps vehicles on passable ground. Road cells have
// a lower travel cost so regular hauling routes prefer the prepared tracks.
class Navigation {
  constructor(sim, scenery) {
    this.sim = sim;
    this.scenery = scenery;
    this.size = 79;
    this.origin = -20;
    this.rebuild();
  }
  index(x, y) {
    return y * this.size + x;
  }
  cell(p) {
    return this.index(
      bound(Math.round((p.x - this.origin) * 2), 0, this.size - 1),
      bound(Math.round((p.y - this.origin) * 2), 0, this.size - 1),
    );
  }
  position(i) {
    return {
      x: this.origin + (i % this.size) / 2,
      y: this.origin + Math.floor(i / this.size) / 2,
    };
  }
  rebuild() {
    this.version = (this.version || 0) + 1;
    this.cost = new Float32Array(this.size ** 2);
    const obstacles = this.sim.structures.filter(
      (s) =>
        s.built || s.remaining || s === this.sim.hq || s === this.sim.enemy,
    );
    for (let i = 0; i < this.cost.length; i++) {
      const { x, y } = this.position(i);
      let blocked = Math.abs(x - river(y)) < 1.65 && Math.abs(y - 2.65) > 0.42;
      for (const s of obstacles) {
        const base = s === this.sim.hq || s === this.sim.enemy;
        const [w, d] =
          TYPES[s.type].tiles || (base ? [3.4, 2.84] : [2.76, 2.06]);
        if (Math.abs(x - s.x) < w / 2 && Math.abs(y - s.y) < d / 2) {
          blocked = true;
          break;
        }
      }
      const paved = ROADS.some((path) =>
        path
          .slice(1)
          .some((end, j) => segmentDistance(x, y, path[j], end) < 0.48),
      );
      this.cost[i] = blocked ? 0 : paved ? 1 : 1.35;
    }
    for (const o of this.scenery)
      if (o.type === "pine" || (o.type === "rock" && o.h > 0.45))
        this.cost[this.cell(o)] = 0;
  }
  nearest(i) {
    if (this.cost[i]) return i;
    let best = null,
      dist = Infinity;
    const p = this.position(i);
    for (let k = 0; k < this.cost.length; k++)
      if (this.cost[k]) {
        const d = distance(p, this.position(k));
        if (d < dist) {
          best = k;
          dist = d;
        }
      }
    return best;
  }
  route(u, goal) {
    const from = this.nearest(this.cell(u)),
      raw = this.cell(goal),
      to = this.nearest(raw);
    const prior = new Int32Array(this.cost.length).fill(-1),
      g = new Float32Array(this.cost.length).fill(Infinity),
      closed = new Uint8Array(this.cost.length);
    const queue = [{ i: from, f: 0 }],
      n = this.size,
      end = this.position(to);
    g[from] = 0;
    // The small local frontiers make a linear minimum lookup sufficient.
    while (queue.length) {
      let best = 0;
      for (let j = 1; j < queue.length; j++)
        if (queue[j].f < queue[best].f) best = j;
      const at = queue[best].i;
      queue[best] = queue[queue.length - 1];
      queue.pop();
      if (at === to) break;
      if (closed[at]) continue;
      closed[at] = 1;
      const x = at % n,
        y = Math.floor(at / n);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        let nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const next = this.index(nx, ny);
        if (closed[next] || !this.cost[next]) continue;
        if (dx && dy && (!this.cost[at + dx] || !this.cost[at + dy * n]))
          continue;
        let score = g[at] + (dx && dy ? 1.414 : 1) * this.cost[next];
        if (score >= g[next]) continue;
        g[next] = score;
        prior[next] = at;
        queue.push({
          i: next,
          f: score + distance(this.position(next), end) * 2,
        });
      }
    }
    let steps = [];
    if (from !== to && prior[to] < 0) return steps;
    for (let i = to; i !== from; i = prior[i]) steps.push(this.position(i));
    steps.reverse();
    if (raw === to) steps.push({ x: goal.x, y: goal.y });
    else if (!steps.length) steps.push(end);
    return steps;
  }
}
