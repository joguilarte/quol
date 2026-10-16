// Conservative same-floor route controller shared by Cave Bot and Auto Attack.
// Uses locally validated AutoWalkPacket steps; never hands a guarded route
// to the client's map-click/minimap retry pathfinder.
window.__minibiaBotBundle = window.__minibiaBotBundle || {};
window.__minibiaBotBundle.installSafeNavigationModule = function installSafeNavigationModule(bot) {
  const state = {
    owner: null, destinationKey: null, requestedKey: null,
    lastError: null, lastErrorAt: 0, lastSentAt: 0,
    lastProgressAt: 0, lastPositionKey: null, lastReleaseReason: null,
    lastDirections: [], consecutiveStalls: 0
  };
  const getPos = (value) => {
    const p = value?.__position || value;
    const x = Number(p?.x), y = Number(p?.y), z = Number(p?.z);
    return [x, y, z].every(Number.isFinite)
      ? { x: Math.trunc(x), y: Math.trunc(y), z: Math.trunc(z) } : null;
  };
  const key = (p) => p ? `${p.x},${p.y},${p.z}` : null;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const getPathfinder = () => window.gameClient?.world?.pathfinder;

  function getTile(p) {
    if (!p || typeof Position !== 'function') return null;
    return window.gameClient?.world?.getTileFromWorldPosition?.(new Position(p.x, p.y, p.z)) || null;
  }
  function isTransition(tile) {
    if (!tile?.__position || !Number(tile.id)) return true;
    const client = window.gameClient;
    const pieces = [tile, ...(Array.isArray(tile.items) ? tile.items : [])];
    for (const thing of pieces) {
      if (!thing || !Number(thing.id)) continue;
      const id = Number(thing.id);
      const def = client?.itemDefinitionsByCid?.[id] || client?.itemDefinitionsBySid?.[id] || client?.itemDefinitions?.[id];
      if (!def?.properties) return true; // Unknown metadata: do not gamble on a transition.
      if (def.properties.floorchange || id === 1948 || id === 1968) return true;
      const name = String(def.properties.name || thing.name || '').toLowerCase();
      if (/\b(stairs?|staircase|ladder|hole|rope spot|ramp|teleport)\b/.test(name)) return true;
    }
    return false;
  }
  function traversable(tile, floor) {
    return !!tile?.__position && Number(tile.__position.z) === floor && !isTransition(tile) &&
      typeof tile.isOccupied === 'function' && tile.isOccupied() === false &&
      (typeof tile.isNotPathable !== 'function' || tile.isNotPathable() === false);
  }
  function safeEdge(fromTile, toTile, floor) {
    const a = getPos(fromTile), b = getPos(toTile);
    if (!a || !b || a.z !== floor || b.z !== floor ||
        Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 ||
        (a.x === b.x && a.y === b.y) || !traversable(toTile, floor)) return false;
    if (a.x !== b.x && a.y !== b.y) {
      // Prevent diagonal corner cutting around doors, stairs and unknown ground.
      if (!traversable(getTile({ x: b.x, y: a.y, z: floor }), floor) ||
          !traversable(getTile({ x: a.x, y: b.y, z: floor }), floor)) return false;
    }
    return true;
  }

  // A* with cardinal cost 10 and diagonal cost 30 (as in Minibia's client),
  // plus a small turning penalty. BFS in the previous patch made diagonals
  // artificially attractive and changed the selected route every tick.
  function plan(fromValue, toValue, options = {}) {
    const from = getPos(fromValue), to = getPos(toValue);
    if (!from || !to || from.z !== to.z) return { ok: false, reason: 'different/missing floor' };
    if (key(from) === key(to)) return { ok: true, path: [], destination: from, exact: true, cost: 0 };
    const start = getTile(from), finish = getTile(to);
    if (!start || !start.__position || (finish && isTransition(finish)))
      return { ok: false, reason: 'missing source or unsafe destination' };
    const limit = Math.max(1, Math.min(28, Number(options.maxSteps) || 12));
    const budget = Math.max(100, Math.min(2400, Number(options.maxNodes) || 1000));
    const exactOnly = options.exactOnly === true;
    const nodes = new Map();
    const heap = [];
    const heuristic = (p) => manhattan(p, to) * 10;
    const insert = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].f <= node.f) break;
        heap[i] = heap[parent]; i = parent;
      }
      heap[i] = node;
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        while (true) {
          let child = i * 2 + 1;
          if (child >= heap.length) break;
          if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
          if (heap[child].f >= last.f) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = last;
      }
      return top;
    };
    const initial = { tile: start, g: 0, f: heuristic(from), steps: 0, parent: null, heading: null };
    nodes.set(key(from), initial); insert(initial);
    let best = null, bestDistance = manhattan(from, to), explored = 0;
    while (heap.length && explored < budget) {
      const current = pop();
      if (current !== nodes.get(key(getPos(current.tile)))) continue; // superseded node
      explored++;
      const at = getPos(current.tile), remaining = manhattan(at, to);
      if (key(at) === key(to)) { best = current; break; }
      if (remaining < bestDistance || (remaining === bestDistance && best && current.g < best.g)) {
        bestDistance = remaining; best = current;
      }
      if (current.steps >= limit) continue;
      for (const neighbor of current.tile.neighbours || []) {
        if (!safeEdge(current.tile, neighbor, from.z)) continue;
        const p = getPos(neighbor), k = key(p);
        const dx = p.x - at.x, dy = p.y - at.y;
        const heading = `${dx},${dy}`;
        const diagonal = dx !== 0 && dy !== 0;
        const cost = (diagonal ? 30 : 10) + (current.heading && current.heading !== heading ? 2 : 0);
        const g = current.g + cost, known = nodes.get(k);
        if (known && known.g <= g) continue;
        const next = { tile: neighbor, g, f: g + heuristic(p), steps: current.steps + 1,
          heading, parent: current };
        nodes.set(k, next); insert(next);
      }
    }
    if (!best || (exactOnly && key(getPos(best.tile)) !== key(to)))
      return { ok: false, reason: 'no locally validated same-floor route' };
    const path = [];
    for (let cursor = best; cursor?.parent; cursor = cursor.parent) path.unshift(cursor.tile);
    if (!path.length || path.some((tile, i) => !safeEdge(i === 0 ? start : path[i - 1], tile, from.z)))
      return { ok: false, reason: 'invalidated path' };
    return { ok: true, path, destination: getPos(path[path.length - 1]),
      exact: key(getPos(path[path.length - 1])) === key(to), cost: best.g };
  }

  function release(reason) {
    state.lastReleaseReason = reason;
    state.owner = null; state.destinationKey = null; state.requestedKey = null;
    state.lastDirections = [];
  }
  function markError(reason) {
    state.lastError = reason;
    state.lastErrorAt = Date.now();
  }
  function reconcile() {
    if (!state.owner) return;
    const pf = getPathfinder();
    const now = Date.now();
    const playerKey = key(getPos(bot.getPlayerPosition()));
    // This bot leaves __finalDestination null. Non-null means a manual click
    // or another client controller has taken over. Never cancel their walk.
    if (pf?.__finalDestination) { release('external navigation took control'); return; }
    if (!pf?.__isAutoWalking) {
      if (playerKey === state.destinationKey) state.consecutiveStalls = 0;
      else markError('walk cancelled or rejected by server');
      release('client stopped walking');
      return;
    }
    if (playerKey !== state.lastPositionKey) {
      state.lastPositionKey = playerKey;
      state.lastProgressAt = now;
      state.consecutiveStalls = 0;
    }
    if (playerKey === state.destinationKey || Number(pf.__autoWalkStepsRemaining) <= 0) {
      // Client's CREATURE_MOVE handler does not clear __isAutoWalking when
      // __finalDestination is null, so perform completion bookkeeping here.
      pf.__isAutoWalking = false;
      pf.__autoWalkStepsRemaining = 0;
      if (playerKey !== state.destinationKey) markError('walk batch ended short of destination');
      release('route segment completed');
      return;
    }
    if (now - state.lastProgressAt > 2800 && now - state.lastSentAt > 2800) {
      // Only our own packet queue may be stopped here. No unsafe native retry.
      pf.setPathfindCache?.(null);
      state.consecutiveStalls++;
      markError('validated autowalk stalled; stopped and released');
      release('stalled walk');
    }
  }
  function owns(owner) { reconcile(); return state.owner === owner; }
  function cancel(owner) {
    reconcile();
    if (state.owner !== owner) return false;
    const pf = getPathfinder();
    if (pf?.__isAutoWalking && !pf.__finalDestination) {
      pf.setPathfindCache?.(null); // stop the server queue before handoff
    }
    release('cancelled by ' + owner);
    return true;
  }
  function go(owner, to, options = {}) {
    if (owner !== 'attack' && owner !== 'cave') return { ok: false, reason: 'unknown owner' };
    const client = window.gameClient, pf = getPathfinder();
    const player = getPos(bot.getPlayerPosition()), now = Date.now();
    if (!pf || !player || typeof client?.send !== 'function' ||
        typeof AutoWalkPacket !== 'function' || typeof Position !== 'function')
      return { ok: false, reason: 'game client unavailable' };
    reconcile();
    if (pf.__isAutoWalking && state.owner !== owner)
      return { ok: false, reason: 'movement owned by another controller' };
    const destination = getPos(to), requestKey = key(destination);
    if (state.owner === owner && pf.__isAutoWalking) {
      const previousDestination = state.destinationKey?.split(',').map(Number);
      const previous = previousDestination?.length === 3
        ? { x: previousDestination[0], y: previousDestination[1], z: previousDestination[2] } : null;
      // A moving creature can step one tile away without needing a new path.
      // Let the previous segment complete instead of stopping and restarting it.
      const changed = previous && destination && chebyshev(previous, destination) > 2;
      if (!changed || now - state.lastSentAt < 1500 || now - state.lastProgressAt < 350)
        return { ok: true, ongoing: true, deferred: true, destination: previous };
      cancel(owner);
    }
    if (pf.__isAutoWalking) return { ok: false, reason: 'non-bot autowalk active' };
    const result = plan(player, destination, options);
    if (!result.ok) { markError(result.reason); return result; }
    if (!result.path.length) return { ok: true, alreadyThere: true, destination: player };
    const directions = [];
    let previous = getTile(player);
    for (const tile of result.path) {
      if (!safeEdge(previous, tile, player.z) || typeof previous?.__position?.getLookDirection !== 'function')
        return { ok: false, reason: 'unsafe path during send' };
      directions.push(previous.__position.getLookDirection(tile.__position)); previous = tile;
    }
    if (!directions.length) return { ok: false, reason: 'empty validated walk' };
    // IMPORTANT: null destination disables the client's automatic cancel/retry,
    // loop-recovery and minimap fallback. All retries must return via plan().
    pf.__finalDestination = null;
    pf.__minimapWaypoints = null;
    pf.__pathfindCache = [];
    pf.__isAutoWalking = true;
    pf.__autoWalkStepsRemaining = directions.length;
    state.owner = owner;
    state.destinationKey = key(result.destination);
    state.requestedKey = requestKey;
    state.lastSentAt = now;
    state.lastProgressAt = now;
    state.lastPositionKey = key(player);
    state.lastDirections = directions.slice();
    try { client.send(new AutoWalkPacket(directions)); }
    catch (error) {
      pf.__isAutoWalking = false;
      pf.__autoWalkStepsRemaining = 0;
      markError('failed to send validated walk: ' + (error?.message || error));
      release('packet send failed');
      return { ok: false, reason: state.lastError };
    }
    return { ok: true, destination: result.destination, exact: result.exact,
      steps: directions.length, cost: result.cost };
  }
  function status() {
    reconcile();
    return { ...state, lastDirections: state.lastDirections.slice(),
      active: !!state.owner, playerPosition: getPos(bot.getPlayerPosition()),
      queuedSteps: Number(getPathfinder()?.__autoWalkStepsRemaining) || 0 };
  }
  bot.safeNavigation = { go, plan, cancel, owns, isTransition, status };
};
