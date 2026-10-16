window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installAutoAttackModule = function installAutoAttackModule(bot) {
  const configStorageKey = "minibiaBot.attack.config";
  const state = {
    running: false,
    timerId: null,
    lastTargetHotkeyAt: 0,
    lastRuneHotkeyAt: 0,
    engagedTargetId: null,
    targetMissingSince: 0,
    lastEngagedSeenAt: 0,
    nearerTargetId: null,
    nearerTargetSince: 0,
    combatStartedAt: 0,
    lastChaseAt: 0,
    lastChaseDestinationKey: null,
    lastFollowTargetId: null,
    lastFollowDistance: Number.POSITIVE_INFINITY,
    lastFollowProgressAt: 0,
    lastFollowStallAt: 0,
    // Track actual player movement, not just shrinking distance to a moving mob.
    lastChasePlayerPositionKey: null,
    lastChasePlayerMovedAt: 0,
    skippedTargetIds: new Map(),
  };

  const storedConfig = bot.storage.get(configStorageKey, {}) || {};
  const config = Object.assign(
    {
      tickMs: 500,
      targetHotbarSlot: 3,
      runeHotbarSlot: null,
      targetCooldownMs: 1200,
      runeCooldownMs: 1200,
      maxTargetDistance: 8,
      meleeMode: true,
      // Explicitly select who owns pursuit. Native Safe Chase is more reliable
      // in Minibia, while local pathfinding can validate transitions.
      chaseController: "hybrid",
      // When enabled, override native chase in ALL movement modes so every
      // automated melee step follows a locally validated, same-floor path.
      avoidFloorChangesOnChase: true,
      enabled: false,
    },
    storedConfig
  );
  config.avoidFloorChangesOnChase = config.avoidFloorChangesOnChase !== false;
  config.chaseController = ["hybrid", "native", "pathfinder"].includes(config.chaseController)
    ? config.chaseController : "hybrid";
  if (config.targetHotbarSlot == null && storedConfig.hotbarSlot != null) {
    config.targetHotbarSlot = storedConfig.hotbarSlot;
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeHotbarSlot(slot) {
    const value = Number(slot);
    if (!Number.isFinite(value)) {
      return null;
    }

    const normalized = Math.trunc(value);
    if (normalized < 1 || normalized > 12) {
      return null;
    }

    return normalized;
  }

  function getNearbyMonsters() {
    return bot.xray?.getVisibleMonsters?.({ sameFloorOnly: true }) || [];
  }

  function normalizePosition(value) {
    if (!value) {
      return null;
    }

    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }

    return {
      x: Math.trunc(x),
      y: Math.trunc(y),
      z: Math.trunc(z),
    };
  }

  function getPositionKey(position) {
    return position ? `${position.x},${position.y},${position.z}` : null;
  }

  function isAdjacentTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    const dx = Math.abs(Number(from.x) - Number(to.x));
    const dy = Math.abs(Number(from.y) - Number(to.y));
    return (dx !== 0 || dy !== 0) && dx <= 1 && dy <= 1;
  }

  function getTileDistance(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(
      Math.abs(Number(from.x) - Number(to.x)),
      Math.abs(Number(from.y) - Number(to.y))
    );
  }

  // Optional chase leash: the area is defined by waypoints on the current
  // floor, not a radius around the player. Disabled outside an active Cave Bot.
  // Never changes the manual/non-melee targeting behavior.
  function getRouteLeash() {
    const cave = bot.cave;
    if (!cave?.status || !cave?.getRoute || cave.config?.limitChaseToRoute !== true) return null;
    if (!cave.status().running) return null;
    const escortRoute = cave.getSellerEscortWaypoints?.();
    return {
      points: (escortRoute || cave.getRoute()).map(normalizePosition).filter(Boolean),
      radius: Math.max(2, Math.min(20, Math.trunc(Number(cave.config.maxChaseFromRouteTiles) || 6))),
    };
  }

  function routeDistance(position, leash) {
    if (!position || !leash) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    for (const waypoint of leash.points) {
      best = Math.min(best, getTileDistance(position, waypoint));
    }
    return best;
  }

  function isInsideRoute(position, leash) {
    return !leash || routeDistance(position, leash) <= leash.radius;
  }

  function enforceRouteLeash(now = Date.now()) {
    if (!config.meleeMode) return false;
    const leash = getRouteLeash();
    if (!leash) return false;
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const target = getCurrentTarget() || getEngagedTarget();
    const targetPosition = normalizePosition(target?.getPosition?.() || target?.__position);
    const playerOut = !isInsideRoute(playerPosition, leash);
    const targetOut = !!target && !isInsideRoute(targetPosition, leash);
    if (!playerOut && !targetOut) return false;

    // Cancel ONLY an Auto Attack-owned walk; Cave Bot will reclaim waypoints.
    cancelPreviousMeleeChase();
    if (target) {
      skipTarget(target, "outside route chase limit", now, 1500);
    } else if (state.engagedTargetId != null) {
      clearEngagedTarget();
    }
    return true;
  }

  function isSameCreature(left, right) {
    if (!left || !right) {
      return false;
    }

    return left === right || left.id === right.id;
  }

  function findNearbyMonster(creature) {
    if (!creature) {
      return null;
    }

    const nearbyMonsters = getNearbyMonsters();
    return nearbyMonsters.find((monster) => isSameCreature(monster, creature)) || null;
  }

  function findNearbyMonsterById(id) {
    if (id == null) {
      return null;
    }

    return getNearbyMonsters().find((monster) => monster?.id === id) || null;
  }

  function getCurrentTarget() {
    return window.gameClient?.player?.__target || null;
  }

  function getCurrentFollowTarget() {
    return window.gameClient?.player?.__followTarget || null;
  }

  function pruneSkippedTargets(now = Date.now()) {
    for (const [id, expiresAt] of state.skippedTargetIds.entries()) {
      if (expiresAt <= now) {
        state.skippedTargetIds.delete(id);
      }
    }
  }

  function resetFollowProgress() {
    state.lastFollowTargetId = null;
    state.lastFollowDistance = Number.POSITIVE_INFINITY;
    state.lastFollowProgressAt = 0;
    state.lastFollowStallAt = 0;
    state.lastChasePlayerPositionKey = null;
    state.lastChasePlayerMovedAt = 0;
  }

  function clearEngagedTarget() {
    state.engagedTargetId = null;
    state.targetMissingSince = 0;
    state.lastEngagedSeenAt = 0;
    state.nearerTargetId = null;
    state.nearerTargetSince = 0;
    state.combatStartedAt = 0;
    state.lastChaseDestinationKey = null;
    resetFollowProgress();
  }

  function clearCurrentFollowTarget() {
    if (!window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof FollowPacket !== "function") {
      return false;
    }

    if (!getCurrentFollowTarget()) {
      return false;
    }

    window.gameClient.player.setFollowTarget(null);
    window.gameClient.send(new FollowPacket(0));
    return true;
  }

  function clearCurrentTarget() {
    if (!window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof TargetPacket !== "function") {
      return false;
    }

    if (!getCurrentTarget()) {
      return false;
    }

    window.gameClient.player.setTarget(null);
    window.gameClient.send(new TargetPacket(0));
    return true;
  }

  function markCombatActive(now = Date.now()) {
    if (!state.combatStartedAt) {
      state.combatStartedAt = now;
    }
  }

  function getCombatTargetCount() {
    return getEngagedTarget() ? 1 : 0;
  }

  function isCombatActive() {
    if (!config.enabled || !state.running) {
      return false;
    }

    return !!getEngagedTarget();
  }

  function syncCombatState(now = Date.now()) {
    if (isCombatActive()) {
      markCombatActive(now);
      return true;
    }

    state.combatStartedAt = 0;
    return false;
  }

  function getEngagedTarget() {
    const currentTarget = getCurrentTarget();
    if (currentTarget) {
      state.engagedTargetId = currentTarget.id;
      state.lastEngagedSeenAt = Date.now();
      state.targetMissingSince = 0;
      return currentTarget;
    }

    if (state.engagedTargetId == null) {
      return null;
    }

    // A FollowPacket can outlive the creature. Prioritize live/visible mobs.
    const nearbyTarget = findNearbyMonsterById(state.engagedTargetId);
    if (nearbyTarget) {
      state.lastEngagedSeenAt = Date.now();
      return nearbyTarget;
    }

    const followTarget = getCurrentFollowTarget();
    if (followTarget && followTarget.id === state.engagedTargetId &&
        Date.now() - state.lastEngagedSeenAt < 1500) {
      return followTarget;
    }

    clearEngagedTarget();
    return null;
  }

  function setCurrentTarget(target) {
    if (!target || !window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof TargetPacket !== "function") {
      return false;
    }

    // No duplicate packets while the client still has this target.
    // Recovery of a lost target is separately debounced by canAttack().
    if (isSameCreature(getCurrentTarget(), target)) {
      return false;
    }

    // When switching creatures, drop only an old melee chase destination.
    // Otherwise an already queued walk can continue toward the old monster.
    if (state.engagedTargetId != null && state.engagedTargetId !== target.id) {
      cancelPreviousMeleeChase();
    }
    // Set the server's chase mode BEFORE engaging. Otherwise it can receive
    // the target first in Stand mode and never begin following automatically.
    // If a native chase was enabled, disarm it BEFORE selecting a new target;
    // otherwise the server could begin following before our next tick.
    if (config.meleeMode && (config.avoidFloorChangesOnChase || config.chaseController === "pathfinder")) {
      if (!disableUnsafeNativeChase()) return false;
    } else if (config.meleeMode && config.chaseController === "native") {
      ensureNativeChase();
    }
    window.gameClient.player.setTarget(target);
    window.gameClient.send(new TargetPacket(target.id));
    state.engagedTargetId = target.id;
    state.targetMissingSince = 0;
    state.lastEngagedSeenAt = Date.now();
    state.nearerTargetId = null;
    state.nearerTargetSince = 0;
    resetFollowProgress();
    return true;
  }

  function setCurrentFollowTarget(target) {
    if (!target || !window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof FollowPacket !== "function") {
      return false;
    }

    if (isSameCreature(getCurrentFollowTarget(), target)) {
      return true;
    }

    window.gameClient.player.setFollowTarget(target);
    window.gameClient.send(new FollowPacket(target.id));
    return true;
  }

  function skipTarget(target, reason, now = Date.now(), skipMs = 4000) {
    if (!target?.id) {
      return false;
    }

    const until = now + Math.max(500, Number(skipMs) || 0);
    state.skippedTargetIds.set(target.id, until);

    const clearedTarget = isSameCreature(getCurrentTarget(), target) ? clearCurrentTarget() : false;
    const clearedFollow = isSameCreature(getCurrentFollowTarget(), target) ? clearCurrentFollowTarget() : false;

    if (state.engagedTargetId === target.id) {
      clearEngagedTarget();
    } else if (state.lastFollowTargetId === target.id) {
      resetFollowProgress();
    }

    bot.log("skipping auto attack target", {
      id: target.id,
      name: target.name || "Mob",
      reason,
      skippedForMs: Math.max(500, Number(skipMs) || 0),
      clearedTarget,
      clearedFollow,
    });
    return true;
  }

  function isTargetSkipped(target, now = Date.now()) {
    pruneSkippedTargets(now);
    return !!target?.id && (state.skippedTargetIds.get(target.id) || 0) > now;
  }

  function getMonsterCandidates(now = Date.now()) {
    pruneSkippedTargets(now);

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const leash = config.meleeMode ? getRouteLeash() : null;
    if (leash && !isInsideRoute(playerPosition, leash)) return [];
    return getNearbyMonsters()
      .filter((monster) => !isTargetSkipped(monster, now))
      .filter((monster) => !leash || isInsideRoute(
        normalizePosition(monster?.getPosition?.() || monster?.__position), leash
      ))
      .sort((left, right) => {
        const leftDistance = getTileDistance(playerPosition, normalizePosition(left?.getPosition?.() || left?.__position));
        const rightDistance = getTileDistance(playerPosition, normalizePosition(right?.getPosition?.() || right?.__position));
        return leftDistance - rightDistance || Number(left?.id || 0) - Number(right?.id || 0);
      });
  }

  // Read-only query for Cave Bot. Only monsters that Auto Attack could
  // actually select, on the same floor and within its configured range,
  // are considered. This does not press keys or issue combat packets.
  function hasPriorityMonsters(now = Date.now()) {
    if (!state.running || !config.enabled) return false;
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    if (!playerPosition) return false;
    const maxDistance = Math.max(1, Number(config.maxTargetDistance) || 8);
    return getMonsterCandidates(now).some((monster) => {
      const position = normalizePosition(monster?.getPosition?.() || monster?.__position);
      return getTileDistance(playerPosition, position) <= maxDistance;
    });
  }

  // Only cancel an autowalk previously initiated by this module. Do not
  // interrupt a Cave Bot waypoint or an unrelated player move.
  function cancelPreviousMeleeChase() {
    const cancelled = bot.safeNavigation?.cancel?.("attack") === true;
    state.lastChaseDestinationKey = null;
    state.lastChaseAt = 0;
    return cancelled;
  }

  // Prefer the active monster and switch only when another is strictly closer
  // for a stable period. No duplicate selection of the same creature ID.
  function getPreferredTarget(now = Date.now()) {
    const candidates = getMonsterCandidates(now);
    const engaged = getEngagedTarget();
    if (!engaged || isTargetSkipped(engaged, now)) {
      state.nearerTargetId = null;
      state.nearerTargetSince = 0;
      return candidates[0] || null;
    }

    const nearest = candidates[0] || null;
    if (!nearest || isSameCreature(nearest, engaged)) {
      state.nearerTargetId = null;
      state.nearerTargetSince = 0;
      return engaged;
    }

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const engagedDistance = getTileDistance(playerPosition, normalizePosition(engaged.getPosition?.() || engaged.__position));
    const nearestDistance = getTileDistance(playerPosition, normalizePosition(nearest.getPosition?.() || nearest.__position));
    if (!(nearestDistance < engagedDistance)) {
      state.nearerTargetId = null;
      state.nearerTargetSince = 0;
      return engaged;
    }

    if (state.nearerTargetId !== nearest.id) {
      state.nearerTargetId = nearest.id;
      state.nearerTargetSince = now;
      return engaged;
    }

    // Ignore short-lived changes from animation/pathfinding to avoid thrashing.
    if (now - state.nearerTargetSince < 300) {
      return engaged;
    }
    return nearest;
  }

  function shouldGiveUpTarget(target) {
    const maxTargetDistance = Math.max(1, Number(config.maxTargetDistance) || 8);
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target?.getPosition?.() || target?.__position);
    if (!playerPosition || !targetPosition) {
      return false;
    }

    return getTileDistance(playerPosition, targetPosition) > maxTargetDistance;
  }

  function resetTargetIfTooFar() {
    const currentTarget = getCurrentTarget();
    if (currentTarget && shouldGiveUpTarget(currentTarget)) {
      skipTarget(currentTarget, "target too far", Date.now(), 2500);
      bot.log("gave up distant auto attack target", {
        id: currentTarget.id,
        name: currentTarget.name || "Mob",
        position: normalizePosition(currentTarget.getPosition?.() || currentTarget.__position),
        maxTargetDistance: Math.max(1, Number(config.maxTargetDistance) || 8),
      });
      return true;
    }

    const engagedTarget = getEngagedTarget();
    if (engagedTarget && shouldGiveUpTarget(engagedTarget)) {
      skipTarget(engagedTarget, "engaged target too far", Date.now(), 2500);
      bot.log("gave up distant auto attack target", {
        id: engagedTarget.id,
        name: engagedTarget.name || "Mob",
        position: normalizePosition(engagedTarget.getPosition?.() || engagedTarget.__position),
        maxTargetDistance: Math.max(1, Number(config.maxTargetDistance) || 8),
      });
      return true;
    }

    return false;
  }

  function getTileFromPosition(position) {
    if (!position || typeof Position !== "function") {
      return null;
    }

    return window.gameClient?.world?.getTileFromWorldPosition?.(
      new Position(position.x, position.y, position.z)
    ) || null;
  }

  // Use the same validated walk engine as Cave Bot. Never fall back to
  // server map-click during melee pursuit, even when that client option is ON.
  function isFloorTransitionTile(tile) {
    return bot.safeNavigation?.isTransition?.(tile) !== false;
  }

  function disableUnsafeNativeChase() {
    const player = window.gameClient?.player;
    const selector = window.gameClient?.interface?.fightModeSelector;
    if (player?.__followTarget) clearCurrentFollowTarget();
    const mode = Number(selector?.currentChaseMode) || 0;
    if (mode !== 0) {
      if (typeof selector?.setChaseMode !== 'function') return false;
      selector.setChaseMode(0);
      bot.log('stair guard: native chase disabled');
    }
    return true;
  }

  function sendValidatedMeleeWalk(playerPosition, targetPosition) {
    return bot.safeNavigation?.go?.('attack', targetPosition, {exactOnly:true, maxSteps:15})?.ok === true;
  }

  function findReachableAdjacentPosition(targetPosition, playerPosition) {
    if (!targetPosition || !playerPosition) {
      return null;
    }

    const offsets = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
    ];

    offsets.sort((a, b) => {
      const da = Math.abs(targetPosition.x + a.x - playerPosition.x) +
        Math.abs(targetPosition.y + a.y - playerPosition.y);
      const db = Math.abs(targetPosition.x + b.x - playerPosition.x) +
        Math.abs(targetPosition.y + b.y - playerPosition.y);
      return da - db;
    });

    const pathfinder = window.gameClient?.world?.pathfinder;
    const startTile = getTileFromPosition(playerPosition);
    if (!pathfinder || !startTile || !bot.safeNavigation?.plan) {
      return null;
    }

    for (const offset of offsets) {
      const candidatePosition = {
        x: targetPosition.x + offset.x,
        y: targetPosition.y + offset.y,
        z: targetPosition.z,
      };
      const tile = getTileFromPosition(candidatePosition);
      if (!tile?.isWalkable?.()) {
        continue;
      }
      if (config.avoidFloorChangesOnChase && isFloorTransitionTile(tile)) {
        continue;
      }
      // Do not start a new melee walk whose destination escapes the route.
      const leash = getRouteLeash();
      if (leash && !isInsideRoute(candidatePosition, leash)) continue;

      if (candidatePosition.x === playerPosition.x && candidatePosition.y === playerPosition.y) {
        return { position: candidatePosition, path: [] };
      }

      try {
        const route = bot.safeNavigation?.plan?.(playerPosition,candidatePosition,
          {exactOnly:true,maxSteps:15});
        const safeLeash = !leash || (route?.path?.every((node) =>
          isInsideRoute(normalizePosition(node?.__position), leash)) === true);
        if (route?.ok && safeLeash) return { position:candidatePosition, path:route.path };
      } catch (error) {
        bot.log('auto attack safe route check failed',error?.message||error);
      }
    }

    return null;
  }

  // Native Chase controls movement through ChaseModePacket (blue button),
  // NOT FollowPacket (green follow). Do not emulate a click on the hotbar.
  function ensureNativeChase() {
    const selector = window.gameClient?.interface?.fightModeSelector;
    if (!selector || typeof selector.setChaseMode !== "function") return false;
    const mode = Number(selector.currentChaseMode);
    if (mode === 1 || mode === 2) return true;
    // Idempotent: do not send a packet when already in safe chase.
    selector.setChaseMode(1);
    bot.log("native Safe Chase enabled for melee attack");
    return true;
  }

  // The two movement controllers are mutually exclusive.  A client map click
  // in pathfinder mode would otherwise disable the game's Safe Chase.
  function syncMeleeChase(now = Date.now()) {
    if (!config.meleeMode) return false;

    const target = getEngagedTarget();
    if (!target) {
      clearEngagedTarget();
      return false;
    }

    if (!isSameCreature(getCurrentTarget(), target)) return false;

    if (config.avoidFloorChangesOnChase || config.chaseController === "pathfinder") {
      // Safety has precedence over Hybrid/Native/Bot. A native server chase
      // cannot be guaranteed to avoid stairs from client-side code.
      if (!disableUnsafeNativeChase()) return false;
    } else if (config.chaseController === "native") {
      cancelPreviousMeleeChase();
      return ensureNativeChase();
    } else {
      const manualFollow = getCurrentFollowTarget();
      const selector = window.gameClient?.interface?.fightModeSelector;
      const nativeChaseMode = Number(selector?.currentChaseMode) || 0;
      if (config.chaseController === "hybrid") {
        if (manualFollow || nativeChaseMode === 1 || nativeChaseMode === 2) {
          cancelPreviousMeleeChase();
          return true;
        }
      } else {
        if (manualFollow) return false;
        if (nativeChaseMode === 1 || nativeChaseMode === 2) {
          if (typeof selector?.setChaseMode !== "function") return false;
          selector.setChaseMode(0);
        }
      }
    }

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target.getPosition?.() || target.__position);
    if (!playerPosition || !targetPosition || playerPosition.z !== targetPosition.z) return false;

    // A moving monster can stay the same distance away for many seconds even
    // while the character is walking successfully. Measure the PLAYER's tile
    // progress to avoid falsely blacklisting that target after five seconds.
    const playerKey = getPositionKey(playerPosition);
    if (state.lastFollowTargetId !== target.id) {
      resetFollowProgress();
      state.lastFollowTargetId = target.id;
    }
    if (state.lastChasePlayerPositionKey !== playerKey) {
      state.lastChasePlayerPositionKey = playerKey;
      state.lastChasePlayerMovedAt = now;
      state.lastFollowStallAt = 0;
    }
    const idleForMs = Math.max(0, now - state.lastChasePlayerMovedAt);
    const giveUpDelayMs = Math.max(12000, (Number(config.tickMs) || 0) * 24);

    if (isAdjacentTile(playerPosition, targetPosition)) {
      cancelPreviousMeleeChase();
      state.lastFollowStallAt = 0;
      // Keep movement progress information so a moving target is tracked
      // without allocating another target or toggling follow mode.
      return false;
    }

    const safeRoute = findReachableAdjacentPosition(targetPosition, playerPosition);
    const adjacentPosition = safeRoute?.position;
    if (!adjacentPosition) {
      if (!state.lastFollowStallAt) state.lastFollowStallAt = now;
      // Only give up after a sustained lack of player movement AND no valid
      // path. A brief occupied tile is common while fighting in a cave.
      if (idleForMs >= giveUpDelayMs && now - state.lastFollowStallAt >= giveUpDelayMs)
        return skipTarget(target, "no reachable adjacent tile", now, 1500);
      return false;
    }

    const distance = getTileDistance(playerPosition, targetPosition);
    state.lastFollowDistance = distance;
    state.lastFollowProgressAt = state.lastChasePlayerMovedAt;
    if (idleForMs >= giveUpDelayMs) {
      return skipTarget(target, "chase could not progress", now, 1500);
    }

    const destinationKey = getPositionKey(adjacentPosition);
    const pathfinder = window.gameClient?.world?.pathfinder;
    if (!pathfinder || typeof Position !== "function" ||
        ((!config.avoidFloorChangesOnChase && config.chaseController !== "pathfinder") &&
          typeof pathfinder.findPath !== "function")) return false;

    // If Minibia completed/cancelled the autowalk, __finalDestination becomes
    // null. A stale lastChaseDestinationKey must not suppress reacquisition.
    const activeDestinationKey = getPositionKey(normalizePosition(pathfinder.__finalDestination));
    const ownPathActive = bot.safeNavigation?.owns?.("attack") &&
      activeDestinationKey === state.lastChaseDestinationKey &&
      activeDestinationKey === destinationKey && pathfinder.__isAutoWalking !== false;
    const sameDestination = destinationKey === state.lastChaseDestinationKey;
    const elapsed = now - state.lastChaseAt;

    // Let a healthy walk continue; only repath after an actual stall, a
    // cancelled/completed autowalk or a changed monster position.
    if (sameDestination && ownPathActive && idleForMs < 2200) return false;
    if (sameDestination && elapsed < (ownPathActive ? 2000 : 900)) return false;
    if (!sameDestination && elapsed < 450) return false;

    try {
      // Do not cancel another module's movement. When we own the old path,
      // replace it using a freshly validated route (without map-click).
      if (config.avoidFloorChangesOnChase || config.chaseController === "pathfinder") {
        if (!sendValidatedMeleeWalk(playerPosition, adjacentPosition)) return false;
      } else {
        if (ownPathActive && idleForMs >= 2200) cancelPreviousMeleeChase();
        pathfinder.findPath(
          new Position(playerPosition.x, playerPosition.y, playerPosition.z),
          new Position(adjacentPosition.x, adjacentPosition.y, adjacentPosition.z)
        );
      }
      state.lastChaseAt = now;
      state.lastChaseDestinationKey = destinationKey;
      return true;
    } catch (error) {
      bot.log("melee pathfind failed", error?.message || error);
      return false;
    }
  }

  // Both modes acquire the nearest monster through TargetPacket. The only
  // difference is whether the bot performs movement to melee range.
  function canAttack(now = Date.now()) {
    const wanted = getPreferredTarget(now);
    if (!wanted) {
      state.targetMissingSince = 0;
      return false;
    }

    const current = getCurrentTarget();
    if (isSameCreature(current, wanted)) {
      state.targetMissingSince = 0;
      return false;
    }

    // Wait a single brief observation if the client dropped the SAME target;
    // never stall 2.5 seconds as the previous version did. TargetPacket still
    // goes only when the client has no target or a DIFFERENT target.
    if (!current && state.engagedTargetId === wanted.id) {
      if (!state.targetMissingSince) {
        state.targetMissingSince = now;
        return false;
      }
      if (now - state.targetMissingSince < 300) return false;
      if (now - state.lastTargetHotkeyAt < 900) return false;
      return true;
    }

    state.targetMissingSince = 0;
    const switching = state.engagedTargetId != null && state.engagedTargetId !== wanted.id;
    const cooldownMs = switching ? 700 : Math.max(0, Number(config.targetCooldownMs) || 0);
    return now - state.lastTargetHotkeyAt >= cooldownMs;
  }

  function triggerAttack(now = Date.now()) {
    if (!canAttack(now)) return false;

    const previous = getCurrentTarget();
    const preferred = getPreferredTarget(now);
    if (!preferred || !setCurrentTarget(preferred)) return false;

    state.lastTargetHotkeyAt = now;
    markCombatActive(now);
    bot.log("selected auto attack target", {
      id: preferred.id,
      name: preferred.name || "Mob",
      reason: previous ? "closer creature" : "nearest or recovered creature",
      meleeMode: !!config.meleeMode,
    });
    return true;
  }

  function canUseRune(now = Date.now()) {
    const slot = normalizeHotbarSlot(config.runeHotbarSlot);
    if (!slot || !getCurrentTarget()) {
      return false;
    }

    if (now - state.lastRuneHotkeyAt < Math.max(0, Number(config.runeCooldownMs) || 0)) {
      return false;
    }

    return true;
  }

  function triggerRune(now = Date.now()) {
    if (!canUseRune(now)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.runeHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastRuneHotkeyAt = now;
      markCombatActive(now);
      bot.log("used auto attack rune hotkey", {
        slot,
        target: getCurrentTarget()?.name || "Mob",
      });
    }

    return clicked;
  }

  function tryAttack() {
    if (!config.enabled) return false;

    const now = Date.now();
    if (enforceRouteLeash(now)) return true;
    if (resetTargetIfTooFar()) return true;

    syncCombatState(now);
    // Select (or switch) first. This also runs when melee is disabled;
    // it never presses a native "attack nearest" hotkey that could toggle off.
    const selected = triggerAttack(now);
    if (config.meleeMode) {
      const chased = syncMeleeChase(now);
      return selected || chased;
    }

    // No automatic movement with Melee Mode off; player controls follow/walk.
    const runeUsed = triggerRune(now);
    return selected || runeUsed;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    try {
      tryAttack();
    } catch (error) {
      bot.log("auto attack tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    persistConfig();

    if (state.running) {
      bot.log("auto attack already running");
      return false;
    }

    state.running = true;
    bot.log("auto attack started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    // Stop only a walk started by Auto Attack; preserve manual/native Chase.
    cancelPreviousMeleeChase();
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }

    clearEngagedTarget();
    state.lastChaseAt = 0;
    // Never cancel a Follow target chosen manually by the player.
    state.skippedTargetIds.clear();

    bot.log("auto attack stopped");
    return true;
  }

  function status() {
    const combatActive = syncCombatState(Date.now());
    return {
      running: state.running,
      config: { ...config },
      lastTargetHotkeyAt: state.lastTargetHotkeyAt,
      lastRuneHotkeyAt: state.lastRuneHotkeyAt,
      engagedTargetId: state.engagedTargetId,
      combatActive,
      combatStartedAt: state.combatStartedAt || 0,
      combatDurationMs: state.combatStartedAt ? Math.max(0, Date.now() - state.combatStartedAt) : 0,
      targetCount: getCombatTargetCount(),
      lastChaseAt: state.lastChaseAt,
      currentTarget: getCurrentTarget()
        ? {
            id: getCurrentTarget().id,
            name: getCurrentTarget().name,
            type: getCurrentTarget().type,
            position: getCurrentTarget().__position || null,
          }
        : null,
      nearbyMonsters: getNearbyMonsters().map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "targetHotbarSlot")) {
      nextConfig.targetHotbarSlot = normalizeHotbarSlot(nextConfig.targetHotbarSlot) ?? config.targetHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "runeHotbarSlot")) {
      nextConfig.runeHotbarSlot = normalizeHotbarSlot(nextConfig.runeHotbarSlot);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "maxTargetDistance")) {
      nextConfig.maxTargetDistance = Math.max(1, Math.trunc(Number(nextConfig.maxTargetDistance) || config.maxTargetDistance || 8));
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "chaseController")) {
      nextConfig.chaseController = ["hybrid", "native", "pathfinder"].includes(nextConfig.chaseController)
        ? nextConfig.chaseController : config.chaseController;
    }
    if (nextConfig.meleeMode === false ||
        (nextConfig.chaseController && nextConfig.chaseController !== config.chaseController)) {
      // Disabling melee or switching controllers must relinquish our movement
      // immediately, not leave an old autowalk running for several tiles.
      cancelPreviousMeleeChase();
    }
    Object.assign(config, nextConfig);
    persistConfig();
    bot.log("auto attack config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.addCleanup(() => {
    stop({ persistEnabled: false });
  });

  bot.attack = {
    start,
    stop,
    status,
    updateConfig,
    tryAttack,
    canAttack,
    triggerAttack,
    canUseRune,
    triggerRune,
    getNearbyMonsters,
    hasPriorityMonsters,
    getCurrentTarget,
    getCurrentFollowTarget,
    isCombatActive,
    syncMeleeChase,
    normalizeHotbarSlot,
    config,
  };
};
