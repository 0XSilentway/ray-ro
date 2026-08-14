# ray-ro v5 architecture (OpenKore-based)

Blueprint for the ground-up rewrite. Derived from reading OpenKore's `AI/CoreLogic.pm`, `AI/Attack.pm`, `Misc.pm`, and `Task.pm`.

## 1. Core insight: OpenKore is a task-queue AI, not a state-machine

OpenKore has no big FSM. It has:

- **`@ai_seq`** — a stack of active "action" strings (`attack`, `route`, `take`, `sitting`, ...)
- **`@ai_seq_args`** — matching payload for each action
- **CoreLogic::iterate()** — dispatched once per frame; walks the stack in a fixed order and calls the right module
- **Task Manager** — parallel to `ai_seq`, holds long-running things (routes, NPC talks). Prioritized + mutex-guarded

Every module (`AI::Attack::process`, `AI::CoreLogic::processStorageAuto`, ...) is a **coroutine**: reads its own args slot, does one iteration of work, and either mutates args or dequeues itself when done.

Ray-ro today: one giant `combatLoop` tick with nested `if`s. Every feature (heal, sit, flee, wander, attack, walk) is inline. That's why fixing one thing breaks another.

## 2. v5 architecture

### 2.1 Modules

```
bot/
  core/
    state.js         AI queue + task queue + shared globals
    dispatch.js      per-tick dispatcher (mirror CoreLogic::iterate)
    ticker.js        setInterval driver
  actions/
    attack.js        weapon/skill/combo attack (mirror AI::Attack)
    route.js         send MOVE + arrival watcher (mirror Task::Route)
    take.js          loot pickup
    sit.js           sit/stand
    talk.js          NPC dialog state machine
    storage.js       Kafra deposit/withdraw
    sell.js          NPC sell
    heal.js          potion / SP item use
    skill.js         self-cast + attackSkillSlot
  policy/
    targetSelect.js  getBestTarget + priority + LOS approximation
    monControl.js    per-mob attack rules (mon_control equivalent)
    isAggressive.js  is_aggressive signals
    cleanness.js     checkMonsterCleanness (anti-KS multi-signal)
    hpGuards.js      attackMin/abort + dynamic margin
  net/
    ws.js            WebSocket install + packet parse (from existing v4)
    packets/         one file per opcode we handle
    send.js          typed send helpers (sendAttack, sendMove, sendUseItem, ...)
  world/
    entities.js      entity map + pos tracking + kind classification
    inventory.js     item count truth from server
    map.js           currentMap + farmMap config
  ui/
    monitor.js       remote monitor page (existing)
    configWindow.js  in-game config popup
    floatDock.js     the two floating buttons
  config/
    defaults.js
    persist.js       localStorage load + migrate + save
    schema.js        typed schema for validation
  main.js            bootstrap
```

### 2.2 AI queue (mirror `@ai_seq`)

```js
// state.js
export const ai = {
  seq: [],           // ['route', 'attack', 'take']  — pop from end for LIFO
  args: [],          // matching { ... } per entry
  suspended: 0,      // stops give-up timers when non-zero
  mode: 'AUTO',      // OFF | MANUAL | AUTO
  timings: {},       // timeout registries (ai_attack_main, ai_take, ...)

  queue(name, args = {}) { this.seq.push(name); this.args.push(args); },
  dequeue() { this.seq.pop(); this.args.pop(); },
  action() { return this.seq[this.seq.length - 1]; },
  argsRef() { return this.args[this.args.length - 1]; },
  clear(...names) {
    for (let i = this.seq.length - 1; i >= 0; i--) {
      if (!names.length || names.includes(this.seq[i])) {
        this.seq.splice(i, 1); this.args.splice(i, 1);
      }
    }
  },
  inQueue(...names) { return names.some(n => this.seq.includes(n)); },
};
```

### 2.3 Dispatcher order (mirror `CoreLogic::iterate`)

Runs every 100–200 ms.

```
1.  cleanup: prune stale entities, refresh names
2.  MANUAL block (always runs — even in AUTO):
    - clientSuspend timeout
    - processTask('NPC')     - active NPC dialog
    - equip / drop / escape
    - sit / stand
    - take (loot in progress)
    - attack (existing attack in queue)
    - skillUse / autoCommand
    - route / move (movement in progress)
3.  return if not AUTO
4.  AUTO block (start new things):
    - dead? → wait respawn
    - transferItems / cart
    - storageAuto / sellAuto / buyAuto
    - farmMap warp back
    - randomWalk / follow
    - sitAuto
    - autoEquip / teleport
```

Ray-ro today mashes 2 and 4 together. v5 splits them so AUTO doesn't queue new work while a MANUAL action is running.

### 2.4 Task queue (mirror `Task.pm`)

```js
// core/task.js
export const TaskStatus = { INACTIVE:0, RUNNING:1, INTERRUPTED:2, STOPPED:3, DONE:4 };
export const TaskPriority = { LOW:100, NORMAL:500, HIGH:1000, USER:5000 };

export class Task {
  constructor({ name, priority = TaskPriority.NORMAL, mutexes = [] } = {}) {
    this.name = name; this.priority = priority; this.mutexes = mutexes;
    this.status = TaskStatus.INACTIVE; this.error = null;
    this._on = { mutex: [], stop: [] };
  }
  activate() { this.status = TaskStatus.RUNNING; }
  iterate()  { /* override */ }
  interrupt(){ if (this.status === TaskStatus.RUNNING) this.status = TaskStatus.INTERRUPTED; }
  resume()   { if (this.status === TaskStatus.INTERRUPTED) this.status = TaskStatus.RUNNING; }
  stop()     { this.status = TaskStatus.STOPPED; this._on.stop.forEach(cb => cb(this)); }
  done(err)  { this.error = err; this.status = TaskStatus.DONE; }
  setMutexes(...m) { this.mutexes = m; this._on.mutex.forEach(cb => cb(this)); }
}

export class TaskManager {
  constructor() { this.tasks = []; }
  add(t) { this.tasks.push(t); this.tasks.sort((a,b) => b.priority - a.priority); }
  tick() {
    for (const t of [...this.tasks]) {
      if (t.status === TaskStatus.INACTIVE) t.activate();
      if (t.status === TaskStatus.RUNNING && this._canRun(t)) t.iterate();
      if (t.status === TaskStatus.DONE || t.status === TaskStatus.STOPPED) {
        this.tasks = this.tasks.filter(x => x !== t);
      }
    }
  }
  _canRun(task) {
    return this.tasks.every(o =>
      o === task || o.status !== TaskStatus.RUNNING ||
      task.mutexes.every(m => !o.mutexes.includes(m))
    );
  }
}
```

Used for: routes (`Task.Route`), NPC talk (`Task.TalkNPC`), Kafra flow, sell flow. Anything that has more than one server round-trip.

### 2.5 Combat as an AI queue entry, not a giant loop

```js
// actions/attack.js
export function process() {
  if (ai.action() !== 'attack') return;
  const args = ai.argsRef();
  const target = entities.get(args.ID);

  if (targetGone(target))          return finish(args);
  if (shouldGiveUp(args, target))  return giveUp(args, target, 0);
  if (config.attackChangeTarget)   attemptSwitch(args, target);
  if (!cleanness.isClean(target))  return giveUp(args, target, 0);

  if (approachRouteStale(args, target)) return resetApproachRoute(args, target);

  if (args.stage === 'MOVING_TO_ATTACK') return; // route task runs
  // stage ATTACKING
  if (!timings.due('ai_attack_main')) return;
  main(args, target);
  timings.mark('ai_attack_main');
}

function main(args, target) {
  buildPredictedPositions(target);
  const method = selectAttackMethod(args, target);   // combo → weapon → skill

  const canAttack = evaluateCanAttack(args, target, method);
  if (canAttack === 'YES')          executeAttack(args, target, method);
  else if (canAttack === 'FAR')     approach(args, target, method);
  else if (canAttack === 'NO_LOS')  approach(args, target, method);
}
```

Attack no longer *walks* the character. `approach()` queues a `Task.Route` with `attackID = target.id`. Route finishes → attack `MOVING_TO_ATTACK` sees route gone → flips to `ATTACKING`.

### 2.6 Route as a Task, not a global map

```js
// actions/route.js
export class RouteTask extends Task {
  constructor({ x, y, dest = null, distFromGoal = 0, attackID = null, sendAttackWithMove = false, maxTime = 15000 }) {
    super({ name: `Route(${x},${y})`, priority: TaskPriority.HIGH, mutexes: ['movement'] });
    this.dest = dest || { x, y };
    this.distFromGoal = distFromGoal;
    this.attackID = attackID;
    this.sendAttackWithMove = sendAttackWithMove;
    this.startedAt = Date.now();
    this.maxTime = maxTime;
    this._lastSend = 0;
    this._lastPosT = 0;
  }
  activate() {
    super.activate();
    send.move(this.dest.x, this.dest.y);
    if (this.sendAttackWithMove && this.attackID) send.attack(this.attackID);
    this._lastSend = Date.now();
  }
  iterate() {
    const now = Date.now();
    if (now - this.startedAt > this.maxTime) return this.done(new Error('route timeout'));
    const dist = geom.distance(player, this.dest);
    if (dist <= this.distFromGoal + 0.5) return this.done();
    // player-idle stuck check
    if (world.player.movedRecently(4000)) return;
    // player hasn't moved 4s → try re-send once every 2s
    if (now - this._lastSend > 2000) {
      send.move(this.dest.x, this.dest.y);
      this._lastSend = now;
    }
    if (!world.player.movedRecently(8000)) return this.done(new Error('stuck'));
  }
}
```

Route owns its own state. Everything that needs to walk (attack approach, wander, warp-back-to-farm) uses this. No more global `_walkSentAt` per target.

## 3. Policy layer

### 3.1 Target selection (`policy/targetSelect.js`)

Direct port of OpenKore's `getBestTarget`:

```js
export function getBestTarget(candidates) {
  const actorPos = { x: world.player.x, y: world.player.y };
  const noLOS = [];
  let best = null, bestPri = -Infinity, bestDist = Infinity;

  for (const m of candidates) {
    if (recentlyFailed(m)) continue;
    if (nearOtherPlayer(m, config.attackMinPlayerDistance)) continue;
    if (nearPortal(m, config.attackMinPortalDistance)) continue;

    const ctrl = monControl.get(m);
    if (ctrl.attack_auto === -1) continue;
    if (ctrl.attack_lvl > char.baseLv) continue;
    if (ctrl.attack_jlvl > char.jobLv) continue;
    if (ctrl.attack_hp > world.player.hp) continue;
    if (ctrl.attack_sp > world.player.sp) continue;
    if (ctrl.attack_auto === 3 && (m.dmgToYou || m.missedYou || m.dmgFromYou)) continue;
    if (ctrl.attack_auto === 0 && !(m.dmgToYou || m.missedYou)) continue;

    if (!los(actorPos, m)) { noLOS.push(m); continue; }

    const d = geom.distance(actorPos, m);
    if (d > config.attackRouteMaxPathDistance) continue;
    const pri = policy.monsterPriority(m);

    if (!best || pri > bestPri) { bestPri = pri; bestDist = d; best = m; }
    else if (pri === bestPri && d < bestDist) { bestDist = d; best = m; }
  }

  if (config.attackCheckLOS && !best && noLOS.length) {
    // pathfinding fallback (best-effort in our world without .gat)
    for (const m of noLOS) { /* try route reachability */ }
  }
  return best;
}
```

### 3.2 mon_control (`policy/monControl.js`)

Config schema per mob:

```js
{
  attack_auto: 1,     // -1 ignore, 0 defend, 1 attack, 2 aggressive, 3 attack-once
  attack_lvl: 0,      // min baseLv to engage
  attack_jlvl: 0,     // min jobLv
  attack_hp: 0,       // min char HP
  attack_sp: 0,       // min char SP
  teleport_auto: 0,   // >0 teleport when nearby
  weight: 1.0,        // aggro count multiplier
}
```

Stored as `{ [nameOrSubId]: rule, all: defaultRule }`. Editable via existing blacklist popup + a new per-mob detail row.

### 3.3 Cleanness / anti-KS (`policy/cleanness.js`)

Ports `checkMonsterCleanness` signal list:

- `dmgToYou`, `missedYou`, `castOnToYou` — mob attacked us → clean
- `dmgFromYou`, `missedFromYou`, `castOnByYou` — we attacked → clean
- Anyone else's damage/miss/cast on mob → dirty (unless in aggressive anti-KS mode)
- `objectInsideSpell`, `objectInsideCasting` → dirty (someone is about to hit it)

Signals come from packets we already parse (0x0b, 0x17, 0x1d, 0x18).

### 3.4 HP guards (`policy/hpGuards.js`)

Keep the v4.61 additions but move behind the policy layer:

```js
export function canEngage() {
  if (world.player.hpPct >= config.attackMinHpPercent) return true;
  if (world.mobAttackers.size > 0) return true; // must fight back
  return false;
}

export function shouldAbort(target) {
  if (world.player.hpPct < config.abortAttackHpPercent) return true;
  if (config.dynamicHpMarginEnabled) {
    const hits = target._damageTakenHits.filter(h => Date.now() - h.t < 15000);
    if (hits.length >= 3) {
      const avg = hits.reduce((a,h) => a+h.dmg, 0) / hits.length;
      if (world.player.hp < avg * config.dynamicHpMarginMult) return true;
    }
  }
  return false;
}
```

## 4. Migration plan

**v5 lives in a `bot/` folder inside the existing userscript.** The v4 monolith stays alive but delegates to v5 when a `CFG.useV5` flag is on. When v5 hits parity, v4 code is deleted.

Milestone order (each one shippable):

1. **M0 — scaffolding.** Add `bot/` files, `TaskManager`, `ai` queue, ticker. No behavior change; feature toggle `CFG.useV5 = false`.
2. **M1 — RouteTask.** Migrate wander to use `RouteTask`. Feature flag switches wander only.
3. **M2 — AttackTask.** Rewrite attack loop as `attack` ai-queue entry. Uses `RouteTask` for approach. Sends ATTACK with `sendAttackWithMove` when far.
4. **M3 — Target policy.** `getBestTarget` + `monControl` + `monsterPriority`. Blacklist popup starts editing mon_control instead of a flat list.
5. **M4 — HP guards + cleanness moved to policy layer.** Removes the "shouldAbort" inline check from combat.
6. **M5 — Heal / sit / take as task queue entries.** Replaces inline heal loop.
7. **M6 — Storage / sell / kafra state machines as tasks.**
8. **M7 — delete v4 monolith.**

Each milestone: PR, opt-in flag, one round of live testing, promote when green.

## 5. What we still don't get from OpenKore

- **A* pathfinding.** Needs `.gat` walkable tile map. rayrag.com doesn't ship it. `RouteTask` therefore fires a plain MOVE and trusts server-side routing. Stuck detection is our substitute.
- **checkLOS.** Same reason. LOS check degrades to distance-only.
- **Priority.txt as a plain-text file.** We stay JSON in localStorage.

## 6. Non-goals for v5

- Not rewriting packet parsing — the existing 0x0b / 0x17 / 0x1d / 0x24 / 0x32 handlers are correct and tested against rayrag.com.
- Not chasing feature parity with plugins/, PVP, mercenary, quest, GM commands. Those are OpenKore extras irrelevant to farming.
- Not moving to a build tool. Stays a single-file userscript concatenated from `bot/`.

---

**Ready to start M0 in the next session.** Say the word.
