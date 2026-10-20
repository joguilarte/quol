window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installCaveModule = function installCaveModule(bot) {
  const configStorageKey = "minibiaBot.cave.config";
  const routeStorageKey = "minibiaBot.cave.route";
  const transitionStorageKey = "minibiaBot.cave.transitions";
  const presetStorageKey = "minibiaBot.cave.presets";
  const defaultPresetName = "Default";
  const minimapOverlayRootId = "minibia-bot-cave-minimap-overlay";
  const minimapOverlayStyleId = "minibia-bot-cave-minimap-overlay-style";
  const ladderItemIds = new Set([1948, 1968]);
  const ropeNamePattern = /\brope\b/i;
  const shovelNamePattern = /\bshovel\b/i;
  const shovelTargetNamePatterns = [
    /\bstone pile\b/i,
    /\bloose stone pile\b/i,
    /\bgravel pile\b/i,
    /\bdirt pile\b/i,
    /\bcovered hole\b/i,
    /\bsealed hole\b/i,
    /\bstone heap\b/i,
  ];
  const state = {
    running: false,
    timerId: null,
    observerTimerId: null,
    currentIndex: 0,
    direction: 1,
    lastPathAt: 0,
    lastPositionKey: null,
    lastProgressAt: 0,
    lastStairsUseAt: 0,
    lastObservedPosition: null,
    pendingTransitionSource: null,
    pendingFloorAction: null,
    lastAuthorizedFloorArrival: null,
    floorTransitionCount: 0,
    lastFloorTransitionResult: null,
    floorArrivalGraceUntil: 0,
    pausedForCombat: false,
    expectedFloor: null,
    pausedForFloorMove: false,
    lastWaypointWalkDestinationKey: null,
    lastPriorityMonsterSeenAt: 0,
    pausedForVerification: false,
    verificationTimerId: null,
    lastVerificationNotice: null,
    lastVerificationSource: null,
    lastVerificationChannel: null,
    lastVerificationSender: null,
    lastVerificationSeenAt: 0,
    verificationPendingNotices: [],
    verificationBoundConsole: null,
    verificationDomSeen: new WeakMap(),
    ignoredVerificationNotice: null,
    verificationSnapshot: null,
    verificationSeenEntries: new WeakSet(),
    verificationSeenNodes: new WeakSet(),
    verificationSeenFallback: new Set(),
    verificationAlarmedStages: new Set(),
    verificationLastPhase: null,
    verificationLastRestore: null,
    verificationLastRestoreAt: 0,
    lastRouteRejoinAt: 0,
    routeRejoinCount: 0,
    lastRouteRejoinReason: null,
    needsRouteRejoinCheck: false,
    lastRoutePathError: null,
    lastRoutePathErrorAt: 0,
    lastRouteRecoveryWarningAt: 0,
    combatPauseStartedAt: 0,
    combatYieldUntil: 0,
    sellerTrip: null, // transient: not persisted across reload
    sellerTripCooldownUntil: 0,
    entranceCompleted: false,
    pausedForModeratorUntil: 0,
    moderatorLastSender: null,
    moderatorSeen: new Set(),
    moderatorPresenceSeen: new Set(),
    moderatorScannerTimerId: null,
  };
  const minimapOverlayState = {
    timerId: null,
  };

  const config = Object.assign(
    {
      tickMs: 500,
      repathMs: 1500,
      autoRecoverWaypoints: true,
      waypointTolerance: 0,
      allowFloorTransitions: false, // explicit opt-in for intentional cross-floor waypoints
      routeTraversalMode: "pingpong", // follow 1 -> 2 -> 3 -> 2 -> 1 by default
      prioritizeMonsters: false, // opt-in: pause waypoint navigation during fights
      randomizeMovement: false, // opt-in: rare locally validated lateral detours between hunt waypoints
      limitChaseToRoute: false, // opt-in: do not chase mobs outside recorded route area
      maxChaseFromRouteTiles: 6,
      autoSellerVisit: false,
      sellerPresetName: "",
      sellerReturnPresetName: "",
      minimumFreeCapacity: 50,
      sellerFightOutbound: false,
      sellerFightReturn: false,
      homePresetName: "",
      travelFight: false,
      useWaypointTools: true, // rope and shovel for deliberate waypoint floor changes
      pauseWaypointsOnVerification: false, // opt-in, never pauses auto-attack or auto-heal
      verificationScanTickMs: 500,
      pauseOnModeratorMessage: false,
      moderatorPauseMs: 30000,
      enabled: false,
      activePresetName: defaultPresetName,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 500;
  config.routeTraversalMode = config.routeTraversalMode === "loop" ? "loop" : "pingpong";
  config.allowFloorTransitions = config.allowFloorTransitions === true;
  config.prioritizeMonsters = config.prioritizeMonsters === true;
  config.randomizeMovement = config.randomizeMovement === true;
  config.autoRecoverWaypoints = config.autoRecoverWaypoints !== false;
  config.limitChaseToRoute = config.limitChaseToRoute === true;
  config.maxChaseFromRouteTiles = Math.max(2, Math.min(20, Math.trunc(Number(config.maxChaseFromRouteTiles) || 6)));
  config.autoSellerVisit = config.autoSellerVisit === true;
  config.sellerPresetName = String(config.sellerPresetName || "").trim();
  config.sellerReturnPresetName = String(config.sellerReturnPresetName || "").trim();
  config.minimumFreeCapacity = Math.max(1, Math.min(10000, Number(config.minimumFreeCapacity) || 50));
  config.sellerFightOutbound = config.sellerFightOutbound === true;
  config.sellerFightReturn = config.sellerFightReturn === true;
  config.homePresetName = String(config.homePresetName || "").trim();
  config.travelFight = config.travelFight === true;
  config.useWaypointTools = config.useWaypointTools !== false;
  config.pauseWaypointsOnVerification = config.pauseWaypointsOnVerification === true;
  config.verificationScanTickMs = Math.max(200, Math.min(5000, Math.round(Number(config.verificationScanTickMs) || 500)));
  config.pauseOnModeratorMessage = config.pauseOnModeratorMessage === true;
  config.moderatorPauseMs = Math.max(20000, Math.min(120000, Number(config.moderatorPauseMs) || 30000));

  function normalizePresetName(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  function cloneValue(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function normalizePreset(value) {
    if (!value) {
      return null;
    }

    const name = normalizePresetName(value.name);
    if (!name) {
      return null;
    }

    return {
      name,
      route: normalizeRoute(value.route),
      transitions: normalizeTransitions(value.transitions),
      entryWaypointCount: Math.max(0, Math.trunc(Number(value.entryWaypointCount) || 0)),
    };
  }

  function normalizePresets(value) {
    const entries = Array.isArray(value) ? value : [];
    const deduped = new Map();

    entries.map(normalizePreset).filter(Boolean).forEach((preset) => {
      deduped.set(preset.name.toLowerCase(), preset);
    });

    return Array.from(deduped.values());
  }

  let route = normalizeRoute(bot.storage.get(routeStorageKey, []));
  let transitions = normalizeTransitions(bot.storage.get(transitionStorageKey, []));
  let entryWaypointCount = 0; // initial approach WPs visited once per hunt start
  let presets = normalizePresets(bot.storage.get(presetStorageKey, []));

  if (!presets.length && (route.length || transitions.length)) {
    presets = [{
      name: defaultPresetName,
      route: route.map((waypoint) => cloneValue(waypoint)),
      transitions: transitions.map((transition) => cloneValue(transition)),
    }];
  }

  function getPresetNames() {
    return presets.map((preset) => preset.name);
  }

  function getPresetByName(name) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      return null;
    }

    return presets.find((preset) => preset.name.toLowerCase() === normalizedName.toLowerCase()) || null;
  }

  function getActivePresetName() {
    const configuredName = normalizePresetName(config.activePresetName);
    if (configuredName && getPresetByName(configuredName)) {
      return getPresetByName(configuredName).name;
    }

    if (presets.length) {
      return presets[0].name;
    }

    return configuredName || defaultPresetName;
  }

  function persistPresets() {
    bot.storage.set(
      presetStorageKey,
      presets.map((preset) => ({
        name: preset.name,
        route: preset.route.map((waypoint) => ({ ...waypoint })),
        transitions: preset.transitions.map((transition) => cloneValue(transition)),
        entryWaypointCount: preset.entryWaypointCount || 0,
      }))
    );
  }

  function persistLegacyActivePreset() {
    bot.storage.set(routeStorageKey, route.map((waypoint) => ({ ...waypoint })));
    bot.storage.set(transitionStorageKey, transitions.map((transition) => cloneValue(transition)));
  }

  function setActivePresetName(name) {
    config.activePresetName = normalizePresetName(name) || defaultPresetName;
    persistConfig();
    return config.activePresetName;
  }

  function upsertPreset(name, nextRoute = route, nextTransitions = transitions, nextEntryCount = entryWaypointCount) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      return null;
    }

    const preset = {
      name: normalizedName,
      route: normalizeRoute(nextRoute).map((waypoint) => cloneValue(waypoint)),
      transitions: normalizeTransitions(nextTransitions).map((transition) => cloneValue(transition)),
      entryWaypointCount: Math.max(0, Math.min(Math.max(0, nextRoute.length - 2), Math.trunc(Number(nextEntryCount) || 0))),
    };
    const existingIndex = presets.findIndex((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());

    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }

    persistPresets();
    return preset;
  }

  function persistActivePreset() {
    upsertPreset(getActivePresetName(), route, transitions);
    persistLegacyActivePreset();
  }

  function loadPresetState(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      return null;
    }

    route = normalizeRoute(preset.route);
    transitions = normalizeTransitions(preset.transitions);
    entryWaypointCount = Math.max(0, Math.min(Math.max(0, route.length - 2), Number(preset.entryWaypointCount) || 0));
    state.entranceCompleted = false;
    state.currentIndex = 0;
    state.direction = 1;
    state.pendingTransitionSource = null;
    state.pendingFloorAction = null;
    state.lastAuthorizedFloorArrival = null;
    setActivePresetName(preset.name);
    persistLegacyActivePreset();
    return preset;
  }

  const initialActivePreset = getActivePresetName();
  if (loadPresetState(initialActivePreset)) {
    config.activePresetName = initialActivePreset;
  } else {
    setActivePresetName(initialActivePreset);
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function persistRoute() {
    persistActivePreset();
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

  function normalizeWaypoint(waypoint) {
    return normalizePosition(waypoint);
  }

  function normalizeRoute(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map(normalizeWaypoint).filter(Boolean);
  }

  function normalizeTransition(transition) {
    if (!transition) {
      return null;
    }

    const from = normalizePosition(transition.from || transition);
    const to = normalizePosition(transition.to || {
      x: transition.targetX,
      y: transition.targetY,
      z: transition.targetZ,
    });

    if (!from || !to || from.z === to.z) {
      return null;
    }

    const count = Math.max(1, Math.trunc(Number(transition.count) || 1));
    const lastSeenAt = Math.max(0, Math.trunc(Number(transition.lastSeenAt) || Date.now()));

    return { from, to, count, lastSeenAt };
  }

  function normalizeTransitions(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    const deduped = new Map();
    value.map(normalizeTransition).filter(Boolean).forEach((transition) => {
      deduped.set(getPositionKey(transition.from), transition);
    });
    return Array.from(deduped.values());
  }

  function getEntryWaypointCount() { return entryWaypointCount; }

  function setEntryWaypointCount(count) {
    if (state.running) return { ok: false, reason: "Stop Cave Bot to change the entry section" };
    const n = Math.trunc(Number(count));
    if (!Number.isFinite(n) || n < 0 || n > Math.max(0, route.length - 2))
      return { ok: false, reason: "At least two hunt waypoints must remain" };
    entryWaypointCount = n;
    state.entranceCompleted = false;
    persistActivePreset();
    return { ok: true, count: n };
  }

  function getRoute() {
    return route.map((waypoint) => cloneValue(waypoint));
  }

  function getTransitions() {
    return transitions.map((transition) => cloneValue(transition));
  }

  function persistTransitions() {
    persistActivePreset();
  }

  function savePreset(name, options = {}) {
    const preset = upsertPreset(name, route, transitions);
    if (!preset) {
      bot.log("cave preset name is required");
      return null;
    }

    if (options.activate !== false) {
      setActivePresetName(preset.name);
      persistLegacyActivePreset();
    }

    bot.log("cave preset saved", {
      name: preset.name,
      waypoints: preset.route.length,
      transitions: preset.transitions.length,
    });
    return {
      name: preset.name,
      route: preset.route.map((waypoint) => cloneValue(waypoint)),
      transitions: preset.transitions.map((transition) => cloneValue(transition)),
    };
  }

  function createPreset(name) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      bot.log("cave preset name is required");
      return null;
    }

    if (getPresetByName(normalizedName)) {
      bot.log("cave preset already exists", { name: normalizedName });
      return null;
    }

    if (state.running) {
      stop();
    }

    const preset = upsertPreset(normalizedName, [], [], 0);
    if (!preset) {
      return null;
    }

    loadPresetState(preset.name);
    bot.log("cave preset created", { name: preset.name });
    return {
      name: preset.name,
      route: [],
      transitions: [],
    };
  }

  function loadPreset(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      bot.log("cave preset not found", { name });
      return null;
    }

    if (state.running) {
      stop();
    }

    loadPresetState(preset.name);
    bot.log("cave preset loaded", {
      name: preset.name,
      waypoints: route.length,
      transitions: transitions.length,
    });
    return {
      name: preset.name,
      route: getRoute(),
      transitions: getTransitions(),
    };
  }

  function deletePreset(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      bot.log("cave preset not found", { name });
      return false;
    }

    presets = presets.filter((entry) => entry.name.toLowerCase() !== preset.name.toLowerCase());
    persistPresets();

    if (preset.name.toLowerCase() === getActivePresetName().toLowerCase()) {
      const fallbackPreset = presets[0] || null;
      if (state.running) {
        stop();
      }

      if (fallbackPreset) {
        loadPresetState(fallbackPreset.name);
      } else {
        route = [];
        transitions = [];
        entryWaypointCount = 0;
        state.currentIndex = 0;
        state.direction = 1;
        state.pendingTransitionSource = null;
        setActivePresetName(defaultPresetName);
        persistLegacyActivePreset();
      }
    }

    bot.log("cave preset deleted", { name: preset.name });
    return true;
  }

  function getCurrentWaypoint() {
    if (!route.length) {
      return null;
    }

    if (state.currentIndex < 0 || state.currentIndex >= route.length) {
      state.currentIndex = 0;
    }

    return route[state.currentIndex] || null;
  }

  function getPositionKey(position) {
    return position ? `${position.x},${position.y},${position.z}` : null;
  }

  function getDistance(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(Number(from.x) - Number(to.x)) + Math.abs(Number(from.y) - Number(to.y));
  }

  function isBesideOrSameTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    return Math.abs(Number(from.x) - Number(to.x)) <= 1 &&
      Math.abs(Number(from.y) - Number(to.y)) <= 1;
  }

  function isAdjacentTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    const dx = Math.abs(Number(from.x) - Number(to.x));
    const dy = Math.abs(Number(from.y) - Number(to.y));
    return (dx !== 0 || dy !== 0) && dx <= 1 && dy <= 1;
  }

  function getDistanceToWaypoint(position, waypoint) {
    if (!position || !waypoint) {
      return null;
    }

    return getDistance(position, waypoint);
  }

  function isSameTile(a, b) {
    if (!a || !b) {
      return false;
    }

    return Number(a.x) === Number(b.x) &&
      Number(a.y) === Number(b.y) &&
      Number(a.z) === Number(b.z);
  }

  function findClosestWaypointIndex(position, minimumIndex = 0) {
    if (!position || !route.length) {
      return 0;
    }

    let bestIndex = Math.min(route.length - 1, minimumIndex);
    let bestDistance = Number.POSITIVE_INFINITY;

    route.forEach((waypoint, index) => {
      if (index < minimumIndex) return;
      const distance = getDistanceToWaypoint(position, waypoint);
      if (!Number.isFinite(distance)) {
        return;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  // Rejoin on start using a physically reachable waypoint, not just the
  // closest Manhattan coordinate. This avoids selecting a waypoint behind a
  // sealed stone entrance when starting outside the saved hunt route.
  function findReachableStartWaypointIndex(position) {
    if (!position || !route.length || !bot.safeNavigation?.plan) {
      return findClosestWaypointIndex(position);
    }
    const candidates = route
      .map((waypoint, index) => ({ index, waypoint, distance: getDistance(position, waypoint) }))
      .filter((entry) => Number.isFinite(entry.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 16);
    for (const entry of candidates) {
      try {
        const path = bot.safeNavigation.plan(position, entry.waypoint, {
          maxSteps: 28, maxNodes: 1200, exactOnly: true
        });
        if (path?.ok && path.exact) return entry.index;
      } catch (_) { /* incomplete client map; use prior selection */ }
    }
    return findClosestWaypointIndex(position);
  }

  function chooseStartIndex(position) {
    if (entryWaypointCount === 0) return findReachableStartWaypointIndex(position);
    const first = route[0];
    const hunt = route.slice(entryWaypointCount);
    const nearestHunt = hunt.reduce((best, p) => Math.min(best, getDistance(position, p)), Infinity);
    const entryDist = getDistance(position, first);
    // Starting already inside the hunting floor/area skips the access leg.
    const shouldEnter = !!position && position.z === first?.z &&
      Number.isFinite(entryDist) && (entryDist <= nearestHunt + 2 || !Number.isFinite(nearestHunt));
    if (shouldEnter) return 0;
    state.entranceCompleted = true;
    return findClosestWaypointIndex(position, entryWaypointCount);
  }

  // When combat or an external displacement ends far from the recorded path,
  // re-anchor to the closest same-floor waypoint instead of repeatedly trying
  // to reach a distant waypoint from a previous section of the route.
  // Never skip a floor transition or interrupt an active combat / item action.
  function maybeRecoverRoute(position, now = Date.now()) {
    if (!config.autoRecoverWaypoints || !position || route.length < 2 ||
        now - state.lastRouteRejoinAt < 8000) return false;
    const current = getCurrentWaypoint();
    if (!current || current.z !== position.z) return false;
    const currentDistance = getDistance(position, current);
    if (entryWaypointCount > 0 && !state.entranceCompleted) return false;
    const closestIndex = findClosestWaypointIndex(position, entryWaypointCount);
    const closest = route[closestIndex];
    const closestDistance = getDistance(position, closest);
    if (closestIndex === state.currentIndex || !Number.isFinite(closestDistance) ||
        currentDistance < 8 || currentDistance - closestDistance < 6) return false;
    // A fresh combat/floor-item return is a valid reason to rejoin immediately.
    // Otherwise require a period with no movement (e.g. stopped autowalk).
    if (!state.needsRouteRejoinCheck && now - state.lastProgressAt < 3500) return false;
    cancelOwnWaypointWalk();
    const previousIndex = state.currentIndex;
    state.currentIndex = closestIndex;
    state.lastRouteRejoinAt = now;
    state.routeRejoinCount += 1;
    state.lastRouteRejoinReason = state.needsRouteRejoinCheck ? "returned from activity" : "displaced from waypoint";
    state.needsRouteRejoinCheck = false;
    state.lastPathAt = 0;
    state.lastWaypointWalkDestinationKey = null;
    bot.log("cave route recovered to nearest same-floor waypoint", {
      fromIndex: previousIndex + 1,
      toIndex: closestIndex + 1,
      currentDistance,
      closestDistance,
      reason: state.lastRouteRejoinReason,
    });
    return true;
  }

  function getTileAt(position) {
    if (!position) {
      return null;
    }

    return window.gameClient?.world?.getTileFromWorldPosition?.(
      new Position(position.x, position.y, position.z)
    ) || null;
  }

  function getTilePosition(tile) {
    return normalizePosition(tile?.__position);
  }

  function getThingDefinition(itemId) {
    if (!itemId) {
      return null;
    }

    return (
      window.gameClient?.itemDefinitionsByCid?.[itemId] ||
      window.gameClient?.itemDefinitionsBySid?.[itemId] ||
      window.gameClient?.itemDefinitions?.[itemId] ||
      null
    );
  }

  function getThingName(thing) {
    const definition = getThingDefinition(thing?.id);
    return String(definition?.properties?.name || thing?.name || "").trim().toLowerCase();
  }

  function isLadderThing(thing) {
    if (!thing?.id) {
      return false;
    }

    if (ladderItemIds.has(Number(thing.id))) {
      return true;
    }

    return getThingName(thing).includes("ladder");
  }

  function isFloorChangeThing(thing) {
    const definition = getThingDefinition(thing?.id);
    return !!definition?.properties?.floorchange || isLadderThing(thing);
  }

  function isFloorChangeTile(tile) {
    const tilePosition = getTilePosition(tile);
    if (!tilePosition) {
      return false;
    }

    if (isFloorChangeThing(tile)) {
      return true;
    }

    if (Array.isArray(tile.items) && tile.items.some((item) => isFloorChangeThing(item))) {
      return true;
    }
    // Some Minibia stairs and opened holes only expose a display name, not
    // `properties.floorchange`. Only the deliberate cross-floor handler may
    // use them; Safe Navigation still treats them as blocked for normal walks.
    return isStairsTile(tile) || isHoleTile(tile);
  }

  function getTileThings(tile) {
    if (!tile) {
      return [];
    }

    const things = [];
    if (tile.id) {
      things.push(tile);
    }
    if (Array.isArray(tile.items)) {
      tile.items.forEach((item) => {
        if (item) {
          things.push(item);
        }
      });
    }
    return things;
  }

  function tileHasNamedThing(tile, needle) {
    const value = String(needle || "").trim().toLowerCase();
    if (!value) {
      return false;
    }

    return getTileThings(tile).some((thing) => getThingName(thing).includes(value));
  }

  function isLadderTile(tile) {
    return getTileThings(tile).some((thing) => isLadderThing(thing));
  }

  function isStairsTile(tile) {
    return getTileThings(tile).some((thing) =>
      /\b(stairs?|staircase|ramp)\b/i.test(getThingName(thing)));
  }

  function isHoleTile(tile) {
    return tileHasNamedThing(tile, "hole");
  }

  function isRopeSpotTile(tile) {
    return tileHasNamedThing(tile, "rope spot");
  }

  function isRopeTargetTile(tile) {
    return isHoleTile(tile) || isRopeSpotTile(tile);
  }

  function isShovelTargetThing(thing) {
    const name = getThingName(thing);
    if (!name) {
      return false;
    }

    return shovelTargetNamePatterns.some((pattern) => pattern.test(name));
  }

  function isShovelTargetTile(tile) {
    return getTileThings(tile).some((thing) => isShovelTargetThing(thing));
  }

  function isTransitionCandidateTile(tile, waypoint, position) {
    if (!tile) {
      return false;
    }

    if (isFloorChangeTile(tile)) {
      return true;
    }

    const hasWaypointDelta =
      waypoint &&
      position &&
      Number.isFinite(waypoint.z) &&
      Number.isFinite(position.z);

    if (!hasWaypointDelta) {
      return false;
    }

    if (waypoint.z > position.z) {
      return isShovelTargetTile(tile);
    }

    if (waypoint.z < position.z) {
      return isRopeTargetTile(tile);
    }

    return false;
  }

  function getFloorChangeTileBias(tile, position, waypoint) {
    if (!tile || !position || !waypoint || position.z === waypoint.z) {
      return 0;
    }

    const goingDown = waypoint.z > position.z;
    const goingUp = waypoint.z < position.z;

    if (goingDown) {
      if (isLadderTile(tile)) return -30;
      if (isHoleTile(tile)) return -20;
      if (isStairsTile(tile)) return 25;
    }

    if (goingUp) {
      if (isStairsTile(tile)) return -20;
      if (isHoleTile(tile)) return 20;
    }

    return 0;
  }

  function getLoadedTiles() {
    const chunks = window.gameClient?.world?.chunks || [];
    const tiles = [];

    for (const chunk of chunks) {
      if (!chunk?.tiles) continue;

      for (const tile of chunk.tiles) {
        if (tile?.__position) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  function ensureMinimapOverlayStyle() {
    if (document.getElementById(minimapOverlayStyleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = minimapOverlayStyleId;
    style.textContent = `
      #${minimapOverlayRootId} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999997;
      }

      #${minimapOverlayRootId} canvas {
        position: fixed;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMinimapOverlayRoot() {
    let root = document.getElementById(minimapOverlayRootId);
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = minimapOverlayRootId;
    root.innerHTML = '<canvas></canvas>';
    document.body.appendChild(root);
    return root;
  }

  function destroyMinimapOverlayElements() {
    document.getElementById(minimapOverlayRootId)?.remove();
    document.getElementById(minimapOverlayStyleId)?.remove();
  }

  function getMinimapCanvas() {
    return window.gameClient?.renderer?.minimap?.minimap?.canvas || document.getElementById("minimap") || null;
  }

  function getMinimapViewport() {
    const canvas = getMinimapCanvas();
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return { canvas, rect };
  }

  function getWaypointCanvasPoint(waypoint, viewport, playerPosition, minimap) {
    if (!waypoint || !viewport || !playerPosition || !minimap) {
      return null;
    }

    if (waypoint.z !== minimap.__renderLayer) {
      return null;
    }

    const zoomScale = 1 << (Number(minimap.__zoomLevel) || 0);
    const center = minimap.center || { x: 0, y: 0 };
    const internalWidth = Number(viewport.canvas.width) || 160;
    const internalHeight = Number(viewport.canvas.height) || 160;
    const internalX = (internalWidth / 2) + (waypoint.x - playerPosition.x - Number(center.x || 0)) * zoomScale;
    const internalY = (internalHeight / 2) + (waypoint.y - playerPosition.y - Number(center.y || 0)) * zoomScale;

    return {
      x: internalX * (viewport.rect.width / internalWidth),
      y: internalY * (viewport.rect.height / internalHeight),
    };
  }

  function renderMinimapOverlay() {
    const viewport = getMinimapViewport();
    const minimap = window.gameClient?.renderer?.minimap;
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const root = ensureMinimapOverlayRoot();
    const canvas = root.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    if (!viewport || !minimap || !playerPosition || !route.length) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const rect = viewport.rect;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    canvas.style.left = `${Math.round(rect.left)}px`;
    canvas.style.top = `${Math.round(rect.top)}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const visibleWaypoints = route
      .map((waypoint, index) => ({
        waypoint,
        index,
        point: getWaypointCanvasPoint(waypoint, viewport, playerPosition, minimap),
      }))
      .filter((entry) => entry.point);

    if (!visibleWaypoints.length) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let index = 1; index < visibleWaypoints.length; index += 1) {
      const previous = visibleWaypoints[index - 1];
      const current = visibleWaypoints[index];
      if (current.index !== previous.index + 1) {
        continue;
      }

      context.strokeStyle = "rgba(92, 228, 196, 0.7)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(previous.point.x, previous.point.y);
      context.lineTo(current.point.x, current.point.y);
      context.stroke();
    }

    visibleWaypoints.forEach(({ point, index }) => {
      const isCurrent = state.running && index === state.currentIndex;
      const radius = isCurrent ? 7 : 5;

      context.fillStyle = isCurrent ? "#ffcf5a" : "#2bd1c4";
      context.strokeStyle = isCurrent ? "#6a2400" : "#083f49";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = "#ffffff";
      context.font = "bold 11px Verdana, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), point.x, point.y);
    });

    context.restore();
  }

  function startMinimapOverlay() {
    if (minimapOverlayState.timerId != null) {
      return;
    }

    ensureMinimapOverlayStyle();
    renderMinimapOverlay();
    minimapOverlayState.timerId = window.setInterval(renderMinimapOverlay, 250);
  }

  function stopMinimapOverlay() {
    if (minimapOverlayState.timerId != null) {
      window.clearInterval(minimapOverlayState.timerId);
      minimapOverlayState.timerId = null;
    }

    destroyMinimapOverlayElements();
  }

  function getNearbyTransitionTiles(position, waypoint, radius = 8) {
    if (!position) {
      return [];
    }

    return getLoadedTiles()
      .map((tile) => ({ tile, position: getTilePosition(tile) }))
      .filter((entry) =>
        entry.position &&
        entry.position.z === position.z &&
        Math.abs(entry.position.x - position.x) <= radius &&
        Math.abs(entry.position.y - position.y) <= radius &&
        isTransitionCandidateTile(entry.tile, waypoint, position)
      );
  }

  function findTransitionTileNearPosition(position, waypoint, radius = 1) {
    if (!position) {
      return null;
    }

    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    getNearbyTransitionTiles(position, waypoint, radius).forEach((entry) => {
      const distance = getDistance(position, entry.position);
      if (!Number.isFinite(distance)) {
        return;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    });

    return best;
  }

  function findBestKnownTransition(position, waypoint) {
    if (!position || !waypoint) {
      return null;
    }

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    const sellerTransitions = [
      ...(state.sellerTrip?.sellerTransitions || []),
      ...(state.sellerTrip?.returnTransitions || []),
    ];
    const consider = (transition, reverse = false) => {
      if (!transition?.from || !transition?.to) return;
      const from = reverse ? transition.to : transition.from;
      const to = reverse ? transition.from : transition.to;
      if (from.z !== position.z || to.z !== waypoint.z) return;
      const playerDistance = getDistance(position, from);
      const landingDistance = getDistance(to, waypoint);
      if (!Number.isFinite(playerDistance) || !Number.isFinite(landingDistance)) return;
      // A recorded transition is only applicable near its source and its
      // expected destination; never borrow a different staircase across town.
      if (playerDistance > 22 || landingDistance > 18) return;
      const score = playerDistance * 10 + landingDistance + (reverse ? 2 : 0);
      if (score < bestScore) { bestScore = score; best = { ...transition, from, to, reversed:reverse }; }
    };
    [...transitions, ...sellerTransitions].forEach(t => {
      consider(t, false);
      // Seller route may have been recorded Shanar -> hunt but will be used
      // hunt -> Shanar. Reverse is a HINT, not an unchecked movement.
      if (state.sellerTrip) consider(t, true);
    });

    return best;
  }

  function findNearbyTransitionTile(position, waypoint, candidateFilter = null) {
    if (!position || !waypoint) {
      return null;
    }

    const waypointDistance = Math.abs(position.x - waypoint.x) + Math.abs(position.y - waypoint.y);
    const radius = Math.max(4, Math.min(20, waypointDistance + 2));
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    getNearbyTransitionTiles(position, waypoint, radius).forEach((entry) => {
      if (candidateFilter && !candidateFilter(entry)) return;
      const playerDistance = getDistance(position, entry.position);
      const tileToWaypointDistance =
        Math.abs(entry.position.x - waypoint.x) + Math.abs(entry.position.y - waypoint.y);
      const score =
        playerDistance * 10 +
        tileToWaypointDistance +
        getFloorChangeTileBias(entry.tile, position, waypoint);

      if (score < bestScore) {
        bestScore = score;
        best = {
          tile: entry.tile,
          position: entry.position,
          playerDistance,
          waypointDistance: tileToWaypointDistance,
        };
      }
    });

    return best;
  }

  function isAtWaypoint(position, waypoint) {
    const distance = getDistanceToWaypoint(position, waypoint);
    if (!Number.isFinite(distance)) {
      return false;
    }

    return distance <= Math.max(0, Number(config.waypointTolerance) || 0);
  }

  function isAuthorizedLandingWaypoint(position, waypoint, index, trip = null) {
    const arrival = state.lastAuthorizedFloorArrival;
    if (!arrival || !position || !waypoint ||
        Date.now() - arrival.at > 120000 || arrival.z !== position.z ||
        waypoint.z !== position.z || arrival.waypointIndex !== (trip ? state.currentIndex : index)) return false;
    if (trip && (arrival.tripPhase !== trip.phase || arrival.tripIndex !== trip.index)) return false;
    if (!trip && arrival.tripPhase !== null) return false;
    const close = Math.max(Math.abs(position.x-waypoint.x),Math.abs(position.y-waypoint.y)) <= 1;
    // NEVER bypass a normal destination: accept adjacent ONLY when its tile
    // is an unsafe stair/transition which the guarded pathfinder cannot enter.
    if (!close || !isFloorChangeTile(getTileAt(waypoint))) return false;
    state.lastAuthorizedFloorArrival = null;
    bot.log('cave landing waypoint accepted beside recorded stair', { waypoint });
    return true;
  }

  function goToWaypoint(waypoint) {
    const from = normalizePosition(bot.getPlayerPosition());
    if (!from || !waypoint || !bot.safeNavigation?.go) return false;
    const now = Date.now();
    const pf = window.gameClient?.world?.pathfinder;
    // Continue a healthy, verified route segment; never spam StopWalkPacket.
    if (bot.safeNavigation.owns('cave') && pf?.__isAutoWalking &&
        now-state.lastProgressAt<3500) return true;
    if (now-state.lastPathAt<800) return false;
    if (bot.safeNavigation.owns('cave')) bot.safeNavigation.cancel('cave');
    state.lastPathAt=now;
    const randomize = config.randomizeMovement === true && !state.sellerTrip &&
      !state.pausedForCombat && !config.allowFloorTransitions;
    const result = bot.safeNavigation.go('cave',waypoint,{maxSteps:10,randomize});
    if (!result.ok) {
      state.lastRoutePathError=result.reason;
      state.lastRoutePathErrorAt=now;
      if (now-state.lastRouteRecoveryWarningAt>=8000) {
        state.lastRouteRecoveryWarningAt=now;
        const trip = state.sellerTrip;
        bot.log('cave blocked unsafe/unavailable path; waypoint unchanged',
          {from, waypoint, index:trip ? trip.index + 1 : state.currentIndex+1,
           sellerPhase:trip?.phase || null, sellerPreset:trip?.sellerPresetName || null,
           reason:result.reason,
           advice: trip ? 'Revisá este tramo y grabá waypoints intermedios en terreno transitable; no se habilita mapclick inseguro.' : undefined});
      }
      return false;
    }
    state.lastWaypointWalkDestinationKey=getPositionKey(result.destination);
    state.lastRoutePathError=null;
    return true;
  }

  function goToPosition(position) {
    if (!position) {
      return false;
    }

    return goToWaypoint(position);
  }

  function markPendingTransitionSource(source, destinationFloor = null) {
    const normalized = normalizePosition(source);
    if (!normalized) return;
    const now = Date.now();
    state.pendingTransitionSource = { ...normalized, at: now };
    if (Number.isFinite(Number(destinationFloor)) && Number(destinationFloor) !== normalized.z) {
      // Track ONLY a deliberate floor action, never a normal map click.
      state.pendingFloorAction = {
        source: normalized, targetZ: Number(destinationFloor), at: now,
        waypointIndex: state.currentIndex,
        tripPhase: state.sellerTrip?.phase || null,
        tripIndex: state.sellerTrip?.index ?? null,
      };
    }
  }

  function upsertTransition(from, to) {
    const normalizedFrom = normalizePosition(from);
    const normalizedTo = normalizePosition(to);
    if (!normalizedFrom || !normalizedTo || normalizedFrom.z === normalizedTo.z) {
      return null;
    }

    const key = getPositionKey(normalizedFrom);
    const index = transitions.findIndex((transition) => getPositionKey(transition.from) === key);
    const next = {
      from: normalizedFrom,
      to: normalizedTo,
      count: index >= 0 ? transitions[index].count + 1 : 1,
      lastSeenAt: Date.now(),
    };

    if (index >= 0) {
      transitions[index] = next;
    } else {
      transitions.push(next);
    }

    persistTransitions();
    bot.log("cave learned floor transition", next);
    return cloneValue(next);
  }

  function resolveObservedTransitionSource(previousPosition) {
    const pending = normalizePosition(state.pendingTransitionSource);
    // Never attribute an unrelated later floor change to a stale shovel/rope use.
    if (pending && pending.z === previousPosition.z &&
        Date.now() - Number(state.pendingTransitionSource?.at || 0) <= 5000) {
      return pending;
    }

    const currentTile = getTileAt(previousPosition);
    if (currentTile && isFloorChangeTile(currentTile)) {
      return previousPosition;
    }

    const nearby = findTransitionTileNearPosition(previousPosition, null, 1);
    if (nearby?.position) {
      return nearby.position;
    }

    return null;
  }

  function observePosition() {
    const current = normalizePosition(bot.getPlayerPosition());
    if (!current) {
      return;
    }

    const previous = state.lastObservedPosition;
    if (previous && !isSameTile(previous, current) && previous.z !== current.z) {
      const action = state.pendingFloorAction;
      const authorized = action && action.source?.z === previous.z &&
        action.targetZ === current.z && Date.now() - action.at <= 9000;
      const source = resolveObservedTransitionSource(previous);
      if (source) upsertTransition(source, current);
      if (authorized) {
        // A deliberate stair packet sets __finalDestination and __isAutoWalking.
        // Some Minibia client builds preserve these flags after teleporting,
        // leaving all later guarded waypoints blocked as "external autowalk".
        // Reset ONLY the flags belonging to this exact bot-issued floor action.
        const pf = window.gameClient?.world?.pathfinder;
        const oldDestination = normalizePosition(pf?.__finalDestination);
        if (pf && (!oldDestination || isSameTile(oldDestination, action.source))) {
          pf.__isAutoWalking = false;
          pf.__autoWalkStepsRemaining = 0;
          pf.__finalDestination = null;
          pf.__minimapWaypoints = null;
          pf.__pathfindCache = [];
        }
        state.lastAuthorizedFloorArrival = {
          waypointIndex: action.waypointIndex,
          tripPhase: action.tripPhase, tripIndex: action.tripIndex,
          at: Date.now(), z: current.z, position: current,
        };
        state.floorTransitionCount += 1;
        state.lastFloorTransitionResult = 'arrived at recorded destination floor';
        state.floorArrivalGraceUntil = Date.now() + 550;
        state.expectedFloor = current.z;
        state.lastPathAt = 0;
        state.lastWaypointWalkDestinationKey = null;
        state.lastRoutePathError = null;
        state.lastProgressAt = Date.now();
        state.lastPositionKey = getPositionKey(current);
        bot.log('cave recorded floor transition completed; resuming route', {
          floor: current.z, waypoint: action.waypointIndex + 1,
          sellerPhase: action.tripPhase,
        });
      } else if (action) {
        state.lastFloorTransitionResult = 'unexpected floor reached; no automatic route recovery';
        bot.log('cave floor change differs from recorded target', {
          expected: action.targetZ, observed: current.z,
        });
      }
      state.pendingTransitionSource = null;
      state.pendingFloorAction = null;
    }

    state.lastObservedPosition = current;
  }

  function getEquipment() {
    return window.gameClient?.player?.equipment || null;
  }

  function getOpenContainers() {
    return Array.from(window.gameClient?.player?.__openedContainers || []);
  }

  function findAdjacentWalkablePosition(targetPosition, playerPosition) {
    if (!targetPosition || !playerPosition || !bot.safeNavigation?.plan ||
        playerPosition.z !== targetPosition.z) return null;
    // The Minibia tiles do not consistently implement `isWalkable()`.
    // Require a reachable same-floor approach checked by Safe Navigation,
    // rather than selecting an adjacent tile based on an unavailable method.
    const offsets = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
    ];
    const candidates = offsets.map((offset) => ({
      x: targetPosition.x + offset.x,
      y: targetPosition.y + offset.y,
      z: targetPosition.z,
    })).sort((a, b) => {
      const distanceA = getDistance(playerPosition, a);
      const distanceB = getDistance(playerPosition, b);
      const cardinalA = Math.abs(a.x-targetPosition.x)+Math.abs(a.y-targetPosition.y);
      const cardinalB = Math.abs(b.x-targetPosition.x)+Math.abs(b.y-targetPosition.y);
      return distanceA-distanceB || cardinalA-cardinalB;
    });
    let partial = null;
    let bestProgress = 0;
    for (const candidate of candidates) {
      if (isSameTile(candidate, playerPosition)) return candidate;
      const path = bot.safeNavigation.plan(playerPosition, candidate,
        { exactOnly: false, maxSteps: 28, maxNodes: 1200 });
      if (path?.ok && path.exact) return candidate;
      const progress = path?.ok ? getDistance(playerPosition, candidate) -
        getDistance(path.destination, candidate) : 0;
      if (progress > bestProgress) { bestProgress = progress; partial = candidate; }
    }
    // For a long approach, allow one locally validated partial segment.
    // Do not enter the transition tile; the next tick replans safely.
    return partial;
  }

  function isRopeItem(item) {
    const name = getThingName(item);
    return !!name && ropeNamePattern.test(name);
  }

  function isShovelItem(item) {
    const name = getThingName(item);
    return !!name && shovelNamePattern.test(name);
  }

  function findToolSource(predicate) {
    const equipment = getEquipment();

    if (equipment?.slots) {
      for (let slotIndex = 0; slotIndex < equipment.slots.length; slotIndex += 1) {
        const item = equipment.getSlotItem?.(slotIndex);
        if (predicate(item)) {
          return { which: equipment, index: slotIndex, item, location: "equipment" };
        }
      }
    }

    for (const container of getOpenContainers()) {
      const slots = container?.slots || [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const item = container.getSlotItem?.(slotIndex);
        if (predicate(item)) {
          return { which: container, index: slotIndex, item, location: "container" };
        }
      }
    }

    return null;
  }

  function findRopeSource() {
    return findToolSource(isRopeItem);
  }

  function findShovelSource() {
    return findToolSource(isShovelItem);
  }

  function useToolOnTile(tool, targetTile, targetPosition, actionLabel, now = Date.now(), targetZ = null) {
    if (!tool || !targetTile || !targetPosition) {
      return false;
    }

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    if (!playerPosition) {
      return false;
    }

    // A tool may only be used from the target's tile or one adjacent tile.
    // Previously this fell through and attempted the use even when no adjacent
    // walkable approach existed, producing false 'shoveled' successes.
    if (!isBesideOrSameTile(playerPosition, targetPosition)) {
      const adjacentPosition = findAdjacentWalkablePosition(targetPosition, playerPosition);
      if (!adjacentPosition || !bot.safeNavigation?.go) {
        return false;
      }
      return goToPosition(adjacentPosition);
    }

    const useWith = window.gameClient?.mouse?.__handleItemUseWith;
    if (typeof useWith !== 'function') return false;
    try {
      useWith.call(window.gameClient.mouse,
        { which: tool.which, index: tool.index },
        { which: targetTile, index: 0xFF }
      );
    } catch (error) {
      bot.log('cave waypoint tool failed', error?.message || error);
      return false;
    }
    state.lastStairsUseAt = now;
    state.lastPathAt = now;
    markPendingTransitionSource(targetPosition, targetZ);
    bot.log(actionLabel, {
      source: targetPosition,
      toolLocation: tool.location,
      toolSlot: tool.index,
      toolName: getThingName(tool.item),
    });
    return true;
  }

  function useRopeOnTile(targetTile, targetPosition, now = Date.now(), targetZ = null) {
    return useToolOnTile(
      findRopeSource(),
      targetTile,
      targetPosition,
      "cave roped transition tile",
      now, targetZ
    );
  }

  function useShovelOnTile(targetTile, targetPosition, now = Date.now(), targetZ = null) {
    return useToolOnTile(
      findShovelSource(),
      targetTile,
      targetPosition,
      "cave shoveled transition tile",
      now, targetZ
    );
  }

  function useFloorChangeTile(target, waypoint, now = Date.now()) {
    const position = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target?.position);
    const targetTile = target?.tile || (targetPosition ? getTileAt(targetPosition) : null);
    if (!position || !targetPosition || !targetTile) {
      return false;
    }

    if (state.pendingFloorAction && state.pendingFloorAction.targetZ === waypoint?.z &&
        now - state.pendingFloorAction.at < 3500) return true;
    if (now - state.lastStairsUseAt < 1200) return true;

    if (config.useWaypointTools && waypoint?.z < position.z && isRopeTargetTile(targetTile)) {
      return useRopeOnTile(targetTile, targetPosition, now, waypoint?.z);
    }
    // Attempt the shovel before a floorchange walk: some sealed piles expose
    // floorchange metadata while still closed. After opening, the next tick
    // can step onto the new hole without shoveling again.
    if (config.useWaypointTools && waypoint?.z > position.z && isShovelTargetTile(targetTile)) {
      return useShovelOnTile(targetTile, targetPosition, now, waypoint?.z);
    }
    if (!isFloorChangeTile(targetTile)) return false;

    if (isLadderTile(targetTile)) {
      if (!isBesideOrSameTile(position, targetPosition)) {
        const adjacent = findAdjacentWalkablePosition(targetPosition, position);
        return adjacent ? goToPosition(adjacent) : false;
      }
      if (typeof window.gameClient?.mouse?.use !== 'function') return false;
      bot.safeNavigation?.cancel?.('cave');
      window.gameClient.mouse.use({ which: targetTile, index: 0xFF });
      state.lastStairsUseAt = now;
      state.lastPathAt = now;
      markPendingTransitionSource(targetPosition, waypoint?.z);
      bot.log("cave used ladder tile", {
        source: targetPosition,
        targetZ: waypoint?.z ?? null,
      });
      return true;
    }

    if (!isSameTile(position, targetPosition)) {
      // Deliberate cross-floor waypoint only: approach safely, then step on
      // the actual transition with ONE explicit direction (never mapclick).
      if (!config.allowFloorTransitions || waypoint?.z === position.z) return false;
      if (!isAdjacentTile(position, targetPosition)) {
        const adjacent=findAdjacentWalkablePosition(targetPosition,position);
        return adjacent ? goToPosition(adjacent) : false;
      }
      const pf=window.gameClient?.world?.pathfinder;
      if (pf?.__isAutoWalking && !bot.safeNavigation?.owns?.('cave')) return false;
      const fromTile=getTileAt(position);
      if (!fromTile?.__position || typeof fromTile.__position.getLookDirection!=="function" ||
          typeof AutoWalkPacket!=="function" || !pf) return false;
      bot.safeNavigation?.cancel?.('cave');
      const direction=fromTile.__position.getLookDirection(targetTile.__position);
      const client=window.gameClient;
      // The only unchecked destination is the exact, chosen floorchange tile.
      pf.__finalDestination=new Position(targetPosition.x,targetPosition.y,targetPosition.z);
      pf.__minimapWaypoints=null;
      pf.__pathfindCache=[];
      pf.__isAutoWalking=true;
      pf.__autoWalkStepsRemaining=1;
      client.send(new AutoWalkPacket([direction]));
      state.lastStairsUseAt=now;
      markPendingTransitionSource(targetPosition, waypoint?.z);
      return true;
    }

    const currentTile = getTileAt(position);
    if (!currentTile || !isFloorChangeTile(currentTile)) {
      return false;
    }

    window.gameClient?.mouse?.use?.({ which: currentTile, index: 0xFF });
    state.lastStairsUseAt = now;
    state.lastPathAt = now;
    markPendingTransitionSource(position, waypoint?.z);
    bot.log("cave used floor-change tile", {
      source: position,
      targetZ: waypoint?.z ?? null,
    });
    return true;
  }

  function getRecordedTransitionAnchor(position, waypoint, override = null) {
    if (override && override.z === position?.z && waypoint?.z !== position.z)
      return normalizePosition(override);
    // On a route crossing floors, the waypoint immediately preceding the
    // cross-floor destination is the *only* authorized area for discovery.
    const lastIndex = state.currentIndex - state.direction;
    const previous = route[lastIndex];
    // On a seller visit, only the ACTIVE seller corridor is a valid source.
    // The old code incorrectly used a waypoint from the unrelated hunt loop.
    const trip = state.sellerTrip;
    if (trip && waypoint?.z !== position?.z) {
      const active = trip.phase === 'exit-hunt' ? route :
        trip.phase === 'seller-return' ? (trip.returnRoute || trip.sellerRoute) : trip.sellerRoute;
      const last = trip.phase === 'seller-return' && !trip.returnRoute ? trip.index + 1 :
        trip.phase === 'exit-hunt' ? (trip.index > (trip.huntWaypointIndex ?? 0) ? trip.index + 1 : trip.index - 1) : trip.index - 1;
      const point = active?.[last];
      if (point && Number(point.z) === Number(position.z)) return normalizePosition(point);
      return null;
    }
    if (previous && previous.z === position?.z && waypoint?.z !== position.z)
      return previous;
    return null;
  }

  function findRecordedTransitionTile(anchor, waypoint) {
    if (!anchor || !waypoint) return null;
    const exactTile = getTileAt(anchor);
    if (isTransitionCandidateTile(exactTile, waypoint, anchor))
      return { tile: exactTile, position: anchor };
    // A saved waypoint can be a few tiles BEFORE the real stair. The previous
    // one-tile limit incorrectly rejected valid, visible transitions on the
    // reversed Shanar route. Expand ONLY around the recorded same-floor point;
    // never search for arbitrary stairs around the player or destination.
    // A single match is required: if there are two stairs/holes, STOP rather
    // than choosing based on distance or stepping onto the wrong floor.
    const MAX_RECORDED_STAIR_OFFSET = 3;
    const nearby = getNearbyTransitionTiles(anchor, waypoint, MAX_RECORDED_STAIR_OFFSET)
      .filter((entry) => Math.max(
        Math.abs(entry.position.x-anchor.x), Math.abs(entry.position.y-anchor.y)
      ) <= MAX_RECORDED_STAIR_OFFSET);
    if (nearby.length !== 1) return null;
    return nearby[0];
  }

  function warnBlockedFloorChange(waypoint, reason, now) {
    state.lastRoutePathError = reason;
    state.lastRoutePathErrorAt = now;
    if (now - state.lastRouteRecoveryWarningAt >= 8000) {
      state.lastRouteRecoveryWarningAt = now;
      bot.log('cave floor transition waiting', { waypoint, reason });
    }
  }

  function handleFloorChange(waypoint, now = Date.now(), explicitAnchor = null) {
    if (!config.allowFloorTransitions) return false;
    const position = normalizePosition(bot.getPlayerPosition());
    if (!position || !waypoint || position.z === waypoint.z) return false;

    const recordedAnchor = getRecordedTransitionAnchor(position, waypoint, explicitAnchor);
    const previouslyLearned = findBestKnownTransition(position, waypoint);
    const knownTransition = previouslyLearned &&
      (!recordedAnchor || Math.max(
        Math.abs(previouslyLearned.from.x - recordedAnchor.x),
        Math.abs(previouslyLearned.from.y - recordedAnchor.y)
      ) <= 2) ? previouslyLearned : null;
    // A learned action takes precedence, but the destination must be a real
    // visible tile on our current floor; never navigate to a guessed stair.
    if (knownTransition) {
      const target = { tile: getTileAt(knownTransition.from), position: knownTransition.from };
      if (target.tile && useFloorChangeTile(target, waypoint, now)) {
        state.lastRoutePathError = null;
        return true;
      }
      // Permit the explicit recorded anchor if the learned tile is not loaded
      // (or became unusable), but do not search arbitrary nearby staircases.
    }

    const recordedTarget = findRecordedTransitionTile(recordedAnchor, waypoint);
    if (recordedTarget && useFloorChangeTile(recordedTarget, waypoint, now)) {
      state.lastRoutePathError = null;
      return true;
    }
    if (recordedAnchor) {
      const candidates = getNearbyTransitionTiles(recordedAnchor, waypoint, 3)
        .filter((entry) => Math.max(Math.abs(entry.position.x-recordedAnchor.x),
          Math.abs(entry.position.y-recordedAnchor.y)) <= 3);
      const reason = candidates.length > 1
        ? `Transición ambigua: ${candidates.length} escaleras/agujeros visibles cerca de WP (${recordedAnchor.x},${recordedAnchor.y},${recordedAnchor.z}). Grabá WP junto a la correcta.`
        : candidates.length === 1
        ? `Escalera grabada localizada pero inaccesible desde la posición actual; revisar obstáculo y waypoint (${recordedAnchor.x},${recordedAnchor.y},${recordedAnchor.z}).`
        : `Sin transición reconocible a 3 casillas del WP (${recordedAnchor.x},${recordedAnchor.y},${recordedAnchor.z}). Grabá un waypoint junto a la escalera.`;
      warnBlockedFloorChange(waypoint, reason, now);
      return false;
    }

    // Compatibility for a route beginning beside a shovel/rope spot without
    // a learned transition. Never automatically enter unrecorded stairs.
    const pending = state.pendingTransitionSource;
    const visibleCandidate = findNearbyTransitionTile(position, waypoint, (entry) => {
      const recentlyShoveled = pending &&
        getPositionKey(pending) === getPositionKey(entry.position) &&
        now - Number(pending.at || 0) <= 5000;
      const toolEntrance = config.useWaypointTools && (
        (waypoint.z > position.z && isShovelTargetTile(entry.tile)) ||
        (waypoint.z < position.z && isRopeTargetTile(entry.tile))
      );
      return toolEntrance || recentlyShoveled;
    });
    if (visibleCandidate && isBesideOrSameTile(position, visibleCandidate.position) &&
        useFloorChangeTile(visibleCandidate, waypoint, now)) {
      state.lastRoutePathError = null;
      return true;
    }
    // A reversed route can land exactly on an explicitly recorded transition
    // without a learned action in this direction. Only use a verified tile
    // ON/ADJACENT to a same-floor point stored in the active seller route.
    const currentTile=getTileAt(position);
    const trip=state.sellerTrip;
    const points=trip ? (trip.phase==='exit-hunt' ? route :
      trip.phase==='seller-return' ? (trip.returnRoute||trip.sellerRoute) : trip.sellerRoute) : route;
    const isRouteMarked=!!points?.some((p) => p?.z===position.z &&
      Math.max(Math.abs(p.x-position.x),Math.abs(p.y-position.y))<=1);
    if (isRouteMarked && currentTile && isTransitionCandidateTile(currentTile, waypoint, position) &&
        useFloorChangeTile({tile:currentTile,position},waypoint,now)) {
      state.lastRoutePathError=null;return true;
    }
    warnBlockedFloorChange(waypoint,
      `No recorded usable transition on floor ${position.z}: route ${trip?.sellerPresetName || getActivePresetName()}, phase ${trip?.phase || 'hunt'}, WP ${trip?trip.index+1:state.currentIndex+1}; record a point ON/BESIDE this stair and a point after changing floor`,now);
    return false;
  }

  function advanceWaypoint() {
    if (!route.length) {
      return null;
    }

    if (route.length === 1) {
      return route[0];
    }

    // Recorded entry waypoints are traversed only once. The hunt section
    // then either reverses along the recorded path (default) or loops.
    const cycleStart = entryWaypointCount > 0 && state.entranceCompleted ? entryWaypointCount : 0;
    let nextIndex = state.currentIndex + (config.routeTraversalMode === "loop" ? 1 : state.direction);
    if (entryWaypointCount > 0 && !state.entranceCompleted && nextIndex >= entryWaypointCount) {
      state.entranceCompleted = true;
      state.direction = 1;
      bot.log("cave entrance completed; cycling hunt-only segment", { entryWaypoints: entryWaypointCount });
    }
    const huntStart = entryWaypointCount > 0 && state.entranceCompleted ? entryWaypointCount : cycleStart;

    if (config.routeTraversalMode === "loop") {
      state.direction = 1;
      if (nextIndex >= route.length) nextIndex = huntStart;
    } else if (nextIndex >= route.length) {
      state.direction = -1;
      nextIndex = route.length - 2;
    } else if (nextIndex < huntStart) {
      state.direction = 1;
      nextIndex = huntStart + 1;
    }

    state.currentIndex = Math.max(huntStart, Math.min(route.length - 1, nextIndex));

    const nextWaypoint = getCurrentWaypoint();
    bot.log("cave advanced waypoint", {
      index: state.currentIndex + 1,
      total: route.length,
      direction: state.direction,
      waypoint: nextWaypoint,
    });
    return nextWaypoint;
  }

  // Give movement control to Auto Attack when combat takes priority.
  // A Cave Bot path can continue executing even though cave.tick() returns:
  // cancel it only when the active destination matches the last waypoint
  // navigation request. Never cancel a melee chase or manual movement.
  function cancelOwnWaypointWalk() {
    const cancelled=bot.safeNavigation?.cancel?.('cave') === true;
    if (cancelled) {
      state.lastWaypointWalkDestinationKey=null;
      state.lastPathAt=0;
    }
    return cancelled;
  }

  // The floor-item mover may temporarily own movement to a visible item.
  // Never cancel its path; only stop a Cave Bot-owned waypoint route.
  function setFloorMovePause(paused) {
    const next=paused===true;
    if (state.pausedForFloorMove===next) return false;
    state.pausedForFloorMove=next;
    if (next) cancelOwnWaypointWalk();
    else {
      state.lastPathAt=0; // revisit or rejoin after the item action
      state.needsRouteRejoinCheck=true;
    }
    return true;
  }

  // Human-in-the-loop warning detection. It never solves or dismisses a CAPTCHA.
  // Snapshot is session-scoped: survives a reload in this tab, but never auto-resumes.
  const verificationSnapshotKey = 'minibiaBot.verification.resume.v2';
  const verificationSnapshotMaxAgeMs = 30 * 60 * 1000;
  const verificationNoticePattern = /(?:anti[\s_-]*bot|bot[\s_-]*(?:test|check|verification|challenge)|captcha|verificaci[oó]n[\s_-]*anti[\s_-]*bot|(?:test|prueba)[\s_-]*anti[\s_-]*bot|toca el objeto que se ilumin[oó]|touch the (?:object|item) that (?:lit up|was illuminated)|verify (?:you are|you're) human)/i;
  const verificationCompletePattern = /(?:captcha|verification|verificaci[oó]n)[^\n]{0,45}\b(?:passed|solved|completed|successful|finished|aprobado|resuelto|completado|superado)\b|\b(?:passed|solved|completed|successfully|aprobado|resuelto|completado)\b[^\n]{0,45}(?:captcha|verification|verificaci[oó]n)/i;
  const verificationResumeModules = ['heal','rune','eat','invisible','magicShield',
    'equipRing','talk','floorMove','corpseLoot','attack','panic','cave'];

  function getVerificationSnapshot() {
    const snap = state.verificationSnapshot;
    if (snap && Number.isFinite(snap.createdAt) &&
        Date.now() - snap.createdAt >= 0 &&
        Date.now() - snap.createdAt < verificationSnapshotMaxAgeMs) return snap;
    state.verificationSnapshot = null;
    try {
      const raw = window.sessionStorage?.getItem(verificationSnapshotKey);
      const stored = raw ? JSON.parse(raw) : null;
      if (stored && stored.version === 2 && Number.isFinite(stored.createdAt) &&
          Date.now() - stored.createdAt >= 0 &&
          Date.now() - stored.createdAt < verificationSnapshotMaxAgeMs) {
        state.verificationSnapshot = stored;
        return stored;
      }
      window.sessionStorage?.removeItem(verificationSnapshotKey);
    } catch (error) { bot.log('verification snapshot read failed', error?.message || error); }
    return null;
  }

  function clearVerificationSnapshot() {
    state.verificationSnapshot = null;
    try { window.sessionStorage?.removeItem(verificationSnapshotKey); } catch (_) {}
  }

  function saveVerificationSnapshot() {
    if (getVerificationSnapshot()) return;
    const modules = {};
    for (const name of verificationResumeModules) {
      try { modules[name] = bot[name]?.status?.()?.running === true; }
      catch (_) { modules[name] = false; }
    }
    const snap = { version:2, createdAt:Date.now(), modules,
      autoSellEnabled:bot.autoSell?.status?.()?.config?.enabled === true,
      overlayEnabled:bot.xray?.status?.()?.config?.overlayEnabled === true };
    state.verificationSnapshot = snap;
    try { window.sessionStorage?.setItem(verificationSnapshotKey, JSON.stringify(snap)); }
    catch (error) { bot.log('verification snapshot could not persist', error?.message || error); }
    bot.log('saved pre-verification active modules', modules);
  }

  function verificationPhase(text) {
    const match = String(text).match(/\b(60|30|15)\s*(?:seconds?|secs?|segundos?|segs?|s)\b/i);
    return match ? match[1] : 'challenge';
  }

  // STRICT: a generic mention of bot/check/captcha by another player is NOT
  // a system verification. Only explicit countdowns or the active challenge UI.
  const verificationCountdownPattern = /(?:\b(?:60|30|15)\s*(?:seconds?|secs?|segundos?|segs?|s)\b[^\n]{0,70}\b(?:captcha|verification|verificaci[oó]n|anti[\s_-]*bot|bot[\s_-]*(?:test|check|challenge))\b|\b(?:captcha|verification|verificaci[oó]n|anti[\s_-]*bot|bot[\s_-]*(?:test|check|challenge))\b[^\n]{0,70}\b(?:60|30|15)\s*(?:seconds?|secs?|segundos?|segs?|s)\b)/i;
  const verificationActiveUiPattern = /(?:captcha|anti[\s_-]*bot|verificaci[oó]n|verify (?:you are|you're) human|toca el objeto que se ilumin[oó]|touch the (?:object|item) that (?:lit up|was illuminated))/i;

  function enqueueTrustedVerificationNotice(text, source, channel='Console', sender='Sistema') {
    const plain=String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if (!plain || plain.length>400 || verificationCompletePattern.test(plain)) return false;
    const strictCountdown=verificationCountdownPattern.test(plain);
    if (source==='Console (sistema)' && !strictCountdown) return false;
    if (source==='Ventana de verificación' && !verificationActiveUiPattern.test(plain)) return false;
    if (state.verificationPendingNotices.length >= 25) state.verificationPendingNotices.shift();
    state.verificationPendingNotices.push({text:plain.slice(0,160),source,channel,sender,at:Date.now()});
    return true;
  }

  // The actual Minibia client routes server broadcasts to Console with
  // ChannelManager.addConsoleMessage(). Never scan player chat or PM channels.
  function watchVerificationSystemConsole() {
    const manager=window.gameClient?.interface?.channelManager;
    if (!manager || typeof manager.addConsoleMessage!=='function') return;
    if (state.verificationBoundConsole?.manager === manager &&
        manager.addConsoleMessage === state.verificationBoundConsole.wrapper) return;
    if (state.verificationBoundConsole) {
      const prev=state.verificationBoundConsole;
      if (prev.manager.addConsoleMessage === prev.wrapper) prev.manager.addConsoleMessage=prev.original;
      state.verificationBoundConsole=null;
    }
    const original=manager.addConsoleMessage;
    const wrapper=function(message, ...args) {
      const result=original.call(this,message,...args);
      if (config.pauseWaypointsOnVerification) {
        enqueueTrustedVerificationNotice(message, 'Console (sistema)', 'Console', 'Sistema');
      }
      return result;
    };
    manager.addConsoleMessage=wrapper;
    state.verificationBoundConsole={manager,original,wrapper};
  }
  bot.addCleanup?.(() => {
    const old=state.verificationBoundConsole;
    if (old && old.manager.addConsoleMessage===old.wrapper) old.manager.addConsoleMessage=old.original;
    state.verificationBoundConsole=null;
  });

  // Only inspect an actual visible dedicated challenge dialog. We do not
  // search all DOM text: that previously matched chat transcript text.
  function getVisibleChallengeDialogNotices() {
    if (!document.body) return [];
    const out=[];
    for (const node of document.querySelectorAll(
      '#captcha-modal, #verification-modal, [data-testid="captcha-modal"], '+
      '[data-testid="verification-modal"], [class~="captcha-modal"], '+
      '[class~="verification-modal"], [id^="captcha-"], [id^="verification-"]')) {
      if (node.closest('#minibia-bot-panel') || node.closest('#server-message, #notification')) continue;
      if (node.closest('[hidden], [aria-hidden="true"]') || node.getClientRects?.().length===0) continue;
      const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
      if (!text || text.length>350 || !verificationActiveUiPattern.test(text)) continue;
      if (state.verificationDomSeen.get(node)===text) continue;
      state.verificationDomSeen.set(node,text);
      out.push({text:text.slice(0,160),source:'Ventana de verificación',channel:'Interfaz',sender:'Sistema',at:Date.now()});
    }
    return out;
  }

  function scanVerificationNotice() {
    if (!config.pauseWaypointsOnVerification) return;
    try {
      watchVerificationSystemConsole();
      if (state.pausedForVerification) {
        bot.attack?.setMovementHold?.('verification',true);
        if (state.running) cancelOwnWaypointWalk();
      }
      const notices=state.verificationPendingNotices.splice(0).concat(getVisibleChallengeDialogNotices());
      for (const notice of notices) {
        if (!state.pausedForVerification) {
          saveVerificationSnapshot();
          state.pausedForVerification=true;
          cancelOwnWaypointWalk();
          bot.attack?.setMovementHold?.('verification',true);
          bot.safeNavigation?.cancel?.('attack');
          bot.log('verified system challenge: movement held, stationary combat preserved');
        }
        state.lastVerificationSeenAt=Date.now();
        state.lastVerificationNotice=notice.text;
        state.lastVerificationSource=notice.source;
        state.lastVerificationChannel=notice.channel;
        state.lastVerificationSender=notice.sender;
        const phase=verificationPhase(notice.text);
        state.verificationLastPhase=phase;
        if (!state.verificationAlarmedStages.has(phase)) {
          state.verificationAlarmedStages.add(phase);
          bot.reportAlarm?.('captcha-'+phase, `Aviso de verificación ${phase}: ${notice.source}`,
            'Movimiento y persecución pausados; Auto Attack estacionario conservado',
            {source:notice.source,channel:notice.channel,sender:notice.sender,stage:phase,systemText:notice.text});
          bot.log('verification warning confirmed', {phase,source:notice.source,channel:notice.channel,sender:notice.sender});
        }
      }
    } catch(error) { bot.log('verification notice check failed',error?.message||error); }
  }

  function restartVerificationScanner() {
    if (state.verificationTimerId != null) {
      window.clearInterval(state.verificationTimerId);
      state.verificationTimerId=null;
    }
    state.verificationPendingNotices.length=0; // Never replay messages before enabling/reloading.
    if (!config.pauseWaypointsOnVerification) return;
    watchVerificationSystemConsole();
    scanVerificationNotice();
    state.verificationTimerId=window.setInterval(scanVerificationNotice,config.verificationScanTickMs);
  }

  // Special-status chat sender detector. No color-only guessing: colors are
  // themes and messages may quote role tags. Use the sender field/prefix only.
  const moderatorRolePattern = /\[(?:GOD|GM|CM|ADMIN|MODERATOR|MOD)\]/i;
  // Exact-name evidence from the observed Minibia server; a purple chat
  // colour or sudden appearance alone is not proof of moderator status.
  const knownModeratorSenders = new Set(['god minibia']);
  function isModeratorSender(sender, role = "") {
    const text = String(sender || "").trim();
    const declaredRole = String(role || "").trim();
    if (moderatorRolePattern.test(text) || moderatorRolePattern.test(`[${declaredRole}]`)) return true;
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    if (knownModeratorSenders.has(normalized)) return true;
    const gmNames = bot.panic?.config?.gameMasterNames || [];
    return !!text && gmNames.some((name) => String(name || "").trim().toLowerCase() === normalized);
  }

  function isModeratorChatMessage(message) {
    if (isModeratorSender(message?.sender, message?.role)) return true;
    const raw = String(message?.rawMessage || "");
    const prefix = raw.match(/^(?:\d{1,2}:\d{2}\s+)?(.{1,80}?)\s+says:\s+/i)?.[1] || "";
    return !!prefix && isModeratorSender(prefix);
  }

  function moderatorChatSnapshot() {
    const out = [];
    for (const channel of window.gameClient?.interface?.channelManager?.channels || []) {
      const entries = channel?.__contents || [];
      for (let i = Math.max(0, entries.length - 20); i < entries.length; i++) {
        const entry = entries[i] || {};
        const raw = String(entry.message || entry.text || "");
        let sender = String(entry.author || entry.sender || entry.name || "").trim();
        // Some client versions keep the complete "Name [GOD] says" line.
        const prefixSender = String(raw.match(/^(?:\d{1,2}:\d{2}\s+)?(.{1,80}?)\s+says:\s+/i)?.[1] || "").trim();
        if (!sender || (prefixSender && moderatorRolePattern.test(prefixSender))) sender = prefixSender;
        const role = String(entry.role || entry.rank || entry.senderRole || "");
        if (!sender && !role) continue;
        const stamp = String(entry.__time || entry.time || entry.id || "");
        const key = `${channel?.name || ""}|${stamp}|${i}|${sender}|${raw}`;
        out.push({ key, sender, role });
      }
    }
    return out;
  }

  function resetModeratorScanBaseline() {
    state.moderatorSeen = new Set(moderatorChatSnapshot().map((msg) => msg.key));
  }

  function pauseForModerator(sender, source = 'chat') {
    if (!(state.running || bot.attack?.status?.()?.running)) return false;
    const now=Date.now();
    const alreadyPaused=now < state.pausedForModeratorUntil;
    state.pausedForModeratorUntil=now+config.moderatorPauseMs;
    state.moderatorLastSender=sender;
    if (!alreadyPaused) {
      cancelOwnWaypointWalk();
      bot.attack?.setMovementHold?.('moderator', true);
      bot.safeNavigation?.cancel?.('attack');
      bot.reportAlarm?.('gm-'+source, `Posible moderador: ${sender}`,
        `Movimiento en pausa ${Math.ceil(config.moderatorPauseMs/1000)} s; ataque estacionario`,
        {source: source==='presence'?'Entidad reconocida cerca':'Mensaje de chat',
          channel:source==='presence'?'mundo':'chat',sender});
      bot.log('cave paused after moderator signal', {sender,source,seconds:config.moderatorPauseMs/1000});
    }
    return true;
  }

  function scanModeratorPresence() {
    const me=normalizePosition(bot.getPlayerPosition?.());
    if (!me) return;
    const playerType=window.CONST?.TYPES?.PLAYER ?? 0;
    const npcType=window.CONST?.TYPES?.NPC ?? 2;
    const current=new Set();
    for (const creature of Object.values(window.gameClient?.world?.activeCreatures || {})) {
      if (!creature || (creature.type!==playerType && creature.type!==npcType)) continue;
      const position=normalizePosition(creature.getPosition?.() || creature.__position);
      if (!position || position.z!==me.z ||
          Math.max(Math.abs(position.x-me.x),Math.abs(position.y-me.y))>8) continue;
      const name=String(creature.name||'').trim();
      if (!isModeratorSender(name, creature.role||creature.rank||'')) continue;
      const key=`${creature.id ?? creature.__id ?? name}|${name.toLowerCase()}`;
      current.add(key);
      if (!state.moderatorPresenceSeen.has(key)) pauseForModerator(name,'presence');
    }
    // Re-arm only after the entity has left the observable area.
    state.moderatorPresenceSeen=current;
  }

  function scanModeratorChat() {
    if (!config.pauseOnModeratorMessage) return;
    try {
      scanModeratorPresence();
      const messages=moderatorChatSnapshot();
      for (const msg of messages) {
        if (state.moderatorSeen.has(msg.key)) continue;
        state.moderatorSeen.add(msg.key);
        if (state.moderatorSeen.size>400)
          state.moderatorSeen=new Set(Array.from(state.moderatorSeen).slice(-250));
        if (!isModeratorSender(msg.sender,msg.role)) continue;
        pauseForModerator(msg.sender,'chat');
      }
      if (!state.running && state.pausedForModeratorUntil) processModeratorPause(Date.now());
    } catch(error) {
      bot.log('moderator scan failed',error?.message||error);
    }
  }

  function restartModeratorScanner() {
    if (state.moderatorScannerTimerId != null) window.clearInterval(state.moderatorScannerTimerId);
    state.moderatorScannerTimerId = null;
    resetModeratorScanBaseline(); // Do not trigger on old chat history.
    state.moderatorPresenceSeen=new Set();
    if (config.pauseOnModeratorMessage) {
      state.moderatorScannerTimerId = window.setInterval(scanModeratorChat, 500);
    }
  }

  function processModeratorPause(now) {
    if (!state.pausedForModeratorUntil) return false;
    if (now < state.pausedForModeratorUntil) {
      cancelOwnWaypointWalk();
      return true;
    }
    state.pausedForModeratorUntil = 0;
    bot.attack?.setMovementHold?.('moderator', false);
    state.lastPathAt = 0;
    state.needsRouteRejoinCheck = true;
    bot.log('cave moderator pause ended; previous hunt resumed');
    return false;
  }

  // Manual restore only: never automatically restart a hunt after a challenge.
  // Re-arm exactly the modules that were active at the FIRST warning.
  function resumeAfterVerification() {
    if (bot.emergencyState?.()?.halted) {
      const result = {ok:false, restored:[], failed:[], reason:'Emergency Stop is active; resume/dismiss it first'};
      state.verificationLastRestore=result;state.verificationLastRestoreAt=Date.now();
      return result;
    }
    const snapshot = getVerificationSnapshot();
    state.pausedForVerification = false;
    state.lastVerificationNotice = null;
    state.lastVerificationSource = null;
    state.lastVerificationChannel = null;
    state.lastVerificationSender = null;
    state.verificationLastPhase = null;
    state.verificationAlarmedStages.clear();
    state.lastPathAt = 0;
    state.needsRouteRejoinCheck = true;
    bot.attack?.setMovementHold?.('verification', false);
    const restored=[],failed=[];
    if (snapshot) {
      // Heal and attack BEFORE route movement. Skip previously disabled modules.
      const order=['heal','rune','eat','invisible','magicShield','equipRing',
        'talk','floorMove','corpseLoot','attack','panic','cave'];
      for (const name of order) {
        if (!snapshot.modules?.[name]) continue;
        try {
          const mod=bot[name];
          if (!mod) {failed.push(name);continue;}
          if (mod.status?.()?.running===true) continue;
          if (name==='corpseLoot') mod.updateConfig?.({enabled:true});
          else mod.start?.();
          if (mod.status?.()?.running===true) restored.push(name);
          else failed.push(name);
        } catch (error) { failed.push(name);bot.log('verification restore failed '+name,error?.message||error); }
      }
      if (snapshot.autoSellEnabled) {
        try {bot.autoSell?.updateConfig?.({enabled:true});} catch (_) {failed.push('autoSell');}
      }
      if (snapshot.overlayEnabled) {
        try {bot.xray?.setOverlayEnabled?.(true);} catch (_) {failed.push('xray');}
      }
    }
    if (!failed.length) clearVerificationSnapshot(); // Leave snapshot for retries otherwise.
    const result={ok:failed.length===0, restored, failed,
      reason:failed.length ? `Could not restore: ${failed.join(', ')}` :
        snapshot ? `Restored ${restored.length} stopped module(s), previous setup recovered` :
        'Movement pause cleared; no saved setup (restart the hunt manually if needed)'};
    state.verificationLastRestore=result;
    state.verificationLastRestoreAt=Date.now();
    bot.log('verification manual restore',result);
    return result;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  // Seller navigation is independent from the optional Auto Sell module.
  // If Auto Sell is OFF or needs attention, wait for operator confirmation.
  function getSellerTripStatus() {
    const trip = state.sellerTrip;
    return trip ? { kind: trip.kind || 'seller', phase: trip.phase, index: trip.index,
      sellerPresetName: trip.sellerPresetName, returnPresetName: trip.returnPresetName, attackWasRunning: trip.attackWasRunning,
      combatEnabled: isSellerEscortCombatEnabled(trip),
      sellerWaypoints: trip.sellerRoute.length,
      recordedDirection: trip.recordedDirection || 'hunt-to-seller',
      huntWaypointIndex: trip.huntWaypointIndex ?? 0 } : null;
  }

  function isSellerEscortCombatEnabled(trip) {
    if (!trip || !trip.attackWasRunning) return false;
    if (trip.kind === 'home') return config.travelFight === true &&
      trip.phase !== 'waiting-at-home';
    if (trip.phase === "exit-hunt" || trip.phase === "seller-out") {
      return config.sellerFightOutbound === true;
    }
    if (trip.phase === "seller-return") return config.sellerFightReturn === true;
    return false; // Always peaceful while standing at the merchant.
  }

  // Only control Auto Attack when the desired travel phase changes. That keeps
  // a manual user stop respected until the next phase transition.
  function syncSellerEscortCombat(trip) {
    if (!trip) return;
    const shouldFight = isSellerEscortCombatEnabled(trip);
    if (trip.lastCombatMode === shouldFight) return;
    const isRunning = !!bot.attack?.status?.()?.running;
    if (shouldFight && !isRunning) bot.attack?.start?.();
    if (!shouldFight && isRunning) bot.attack?.stop?.({ persistEnabled: false });
    trip.lastCombatMode = shouldFight;
    trip.combatPaused = false;
    trip.lastCombatSeenAt = 0;
    state.lastPathAt = 0;
    bot.log(`seller escort combat ${shouldFight ? "enabled" : "disabled"}`, { phase: trip.phase });
  }

  function getSellerEscortWaypoints() {
    const trip = state.sellerTrip;
    if (!isSellerEscortCombatEnabled(trip)) return null;
    // Keeps the existing route leash, extended across the planned seller
    // corridor. We never allow arbitrarily long pursuits across the map.
    return [...route, ...trip.sellerRoute, ...(trip.returnRoute || [])].map((point) => cloneValue(point));
  }

  // Normalize either recorded direction to hunt-anchor -> seller. An exact
  // common waypoint is preferred, but the endpoints may now connect to a
  // UNIQUE nearby repeatable hunt waypoint on the SAME FLOOR. The short
  // rejoin leg still uses Safe Navigation; no arbitrary stairs are selected.
  function getValidatedSellerRoute(logFailure = true) {
    const preset = getPresetByName(config.sellerPresetName);
    const fail = (reason) => {
      if (logFailure) bot.log('seller route invalid: ' + reason);
      return null;
    };
    if (!preset || preset.route.length < 2 || route.length < 2 ||
        preset.name.toLowerCase() === getActivePresetName().toLowerCase()) {
      return fail('select a separate saved Shanar route with at least two waypoints');
    }
    const first = preset.route[0];
    const last = preset.route[preset.route.length - 1];
    const validHuntStart = Math.min(Math.max(0, entryWaypointCount), route.length - 1);
    const MAX_JOIN_TILES = 6; // No blind shortcuts; only a short, same-floor connection.
    const closestHuntEndpoint = (point) => {
      const candidates = route.map((candidate, index) => ({candidate, index}))
        .filter(({candidate,index}) => index >= validHuntStart &&
          Number(candidate?.z) === Number(point?.z))
        .map(({candidate,index}) => ({index, distance: Math.max(
          Math.abs(Number(candidate.x) - Number(point.x)),
          Math.abs(Number(candidate.y) - Number(point.y))
        )}))
        .filter(({distance}) => Number.isFinite(distance) && distance <= MAX_JOIN_TILES)
        .sort((a,b) => a.distance - b.distance || a.index - b.index);
      if (!candidates.length) return null;
      // Duplicate / equidistant candidates are ambiguous, so do not guess.
      if (candidates.length > 1 && candidates[0].distance === candidates[1].distance)
        return {ambiguous:true, distance:candidates[0].distance};
      return candidates[0];
    };
    const firstMatch = closestHuntEndpoint(first);
    const lastMatch = closestHuntEndpoint(last);
    if (firstMatch?.ambiguous || lastMatch?.ambiguous) return fail(
      'seller endpoint is equally close to multiple hunt waypoints; record a clearer connection');
    if (Number(!!firstMatch) + Number(!!lastMatch) !== 1) return fail(
      'exactly one seller-route endpoint must be within 6 tiles of ONE hunt waypoint on the same floor (not entry-only)');
    const recordedFromSeller = !!lastMatch;
    const huntMatch = recordedFromSeller ? lastMatch : firstMatch;
    const huntWaypointIndex = huntMatch.index;
    const sellerRoute = (recordedFromSeller ? [...preset.route].reverse() : preset.route)
      .map((point) => cloneValue(point));
    const npcPosition = sellerRoute[sellerRoute.length - 1];
    let returnRoute = null, returnTransitions = [];
    let returnPresetName = '';
    if (config.sellerReturnPresetName) {
      const returnPreset = getPresetByName(config.sellerReturnPresetName);
      if (!returnPreset || returnPreset.route.length < 2) return fail('return preset not found');
      const ret = returnPreset.route;
      if (isSameTile(ret[0], npcPosition) && isSameTile(ret[ret.length - 1], sellerRoute[0])) {
        returnRoute = ret.map((point) => cloneValue(point));
      } else if (isSameTile(ret[ret.length - 1], npcPosition) && isSameTile(ret[0], sellerRoute[0])) {
        returnRoute = [...ret].reverse().map((point) => cloneValue(point));
      } else return fail('return preset must connect the same exact NPC and hunt endpoints');
      returnTransitions = returnPreset.transitions.map((item) => cloneValue(item));
      returnPresetName = returnPreset.name;
    }
    return {sellerRoute, sellerTransitions: preset.transitions.map((item) => cloneValue(item)),
      returnRoute, returnTransitions, returnPresetName, sellerPresetName:preset.name,
      huntWaypointIndex, joinDistance: huntMatch.distance,
      recordedDirection: recordedFromSeller ? 'seller-to-hunt' : 'hunt-to-seller'};
  }

  function beginSellerTrip(force = false) {
    if (!state.running || state.sellerTrip) return false;
    if (!force && !config.autoSellerVisit) return false;
    if (!force && Date.now() < state.sellerTripCooldownUntil) return false;
    if (!force) {
      const sale=bot.autoSell?.config;
      if (!sale?.enabled || !sale.autoReturnAfterSale ||
          !String(sale.npcName||'').trim() || !String(sale.allowedItems||'').trim()) return false;
    }
    const seller = getValidatedSellerRoute(force);
    if (!seller) return false;
    const freeCapacity = Number(bot.getPlayerSnapshot?.()?.capacity);
    if (!force && (!Number.isFinite(freeCapacity) ||
        freeCapacity > config.minimumFreeCapacity)) return false;
    const pos = normalizePosition(bot.getPlayerPosition());
    if (!pos) return false;
    const attackWasRunning = !!bot.attack?.status?.()?.running;
    const floorMoveWasRunning = !!bot.floorMove?.status?.()?.running;
    if (floorMoveWasRunning) bot.floorMove.stop({ persistEnabled: false });
    state.sellerTrip = {
      phase: "exit-hunt", index: findClosestWaypointIndex(pos, Math.min(entryWaypointCount, route.length-1)),
      ...seller, attackWasRunning, floorMoveWasRunning,
      lastCombatMode: null, combatPaused: false, lastCombatSeenAt: 0,
    };
    syncSellerEscortCombat(state.sellerTrip);
    state.lastWaypointWalkDestinationKey = null;
    state.lastPathAt = 0;
    bot.log("seller trip started; optional Auto Sell handled separately", {
      freeCapacity, threshold: config.minimumFreeCapacity,
      preset: seller.sellerPresetName, recordedDirection: seller.recordedDirection,
      huntWaypoint: seller.huntWaypointIndex + 1,
    });
    return true;
  }

  function goToHuntFromSeller() {
    if (state.sellerTrip || state.pausedForVerification ||
        state.pausedForModeratorUntil || bot.emergencyState?.()?.halted) return false;
    const seller = getValidatedSellerRoute(true);
    const pos = normalizePosition(bot.getPlayerPosition());
    const npcTile = seller?.sellerRoute?.[seller.sellerRoute.length - 1];
    if (!seller || !pos || pos.z !== npcTile.z ||
        Math.max(Math.abs(pos.x - npcTile.x), Math.abs(pos.y - npcTile.y)) > 1) {
      bot.log('GO HUNT from Shanar requires standing at (or beside) the recorded seller endpoint');
      return false;
    }
    if (state.running) {
      bot.log('GO HUNT from Shanar requires the Cave Bot to be stopped, without another active trip');
      return false;
    }
    const attackWasRunning = !!bot.attack?.status?.()?.running;
    // Avoid a premature hunt tick: give the seller return controller ownership first.
    if (!start({deferFirstTick:true})) return false;
    state.sellerTrip = {
      ...seller, phase:'seller-return',
      index: seller.returnRoute ? 1 : seller.sellerRoute.length - 2,
      attackWasRunning, floorMoveWasRunning:false,
      lastCombatMode:null, combatPaused:false, lastCombatSeenAt:0,
    };
    state.lastPathAt = 0;
    state.lastWaypointWalkDestinationKey = null;
    syncSellerEscortCombat(state.sellerTrip);
    bot.log('GO HUNT from Shanar started', {
      recordedDirection: seller.recordedDirection,
      huntWaypoint: seller.huntWaypointIndex+1,
    });
    tick();
    return true;
  }

  // ONE entry point for normal hunts and the optional hunt/sell loop.
  // When HUNT + SELLER is on, start on whichever saved corridor the player
  // is actually standing near. NEVER infer a floor change or use a teleport.
  function startHuntCycle() {
    if (state.running) {
      bot.log('START HUNT: already running', {trip: getSellerTripStatus()});
      return {ok:true, mode:state.sellerTrip?.phase || 'hunt-already-running'};
    }
    if (state.pausedForVerification || state.pausedForModeratorUntil ||
        bot.emergencyState?.()?.halted) {
      bot.log('START HUNT blocked by a pending safety pause');
      return {ok:false, reason:'Safety pause active. Resolve it and restore manually.'};
    }
    if (!config.autoSellerVisit) {
      const ok = start();
      return {ok, mode:ok?'hunt':null, reason:ok?'':'Cave Bot could not start'};
    }
    const seller = getValidatedSellerRoute(false);
    const sales=bot.autoSell?.config;
    const merchantReady=!!seller && !!sales?.enabled &&
      !!String(sales.allowedItems||'').trim() && sales.autoReturnAfterSale===true &&
      !!String(sales.npcName||'').trim();
    // An incomplete OPTIONAL seller configuration must not suppress hunting.
    // Never start an automated trip until both route and sale safeguards pass.
    if (!merchantReady) {
      const reason=!seller ? 'Shanar route is invalid' :
        'Auto Sell must be ON with NPC name, allowed items and Return to hunt ON';
      const ok=start();
      bot.log('START HUNT: hunting only; automated selling pending configuration', {reason});
      return {ok, mode:ok?'hunt-seller-pending':null,
        reason:ok?`Caza activa; venta pendiente: ${reason}`:'Cave Bot could not start'};
    }
    const position = normalizePosition(bot.getPlayerPosition());
    if (!position) return {ok:false, reason:'Player position is unavailable'};
    // Find a waypoint on the current floor reachable through validated local
    // navigation. A short corridor connection is allowed; arbitrary map-wide
    // travel and unknown stair crossings are deliberately NOT allowed.
    const reachable = (waypoint, maxDistance=6) => {
      if (Number(position.z)!==Number(waypoint?.z)) return Infinity;
      const distance=Math.max(Math.abs(position.x-waypoint.x),
        Math.abs(position.y-waypoint.y));
      if (!Number.isFinite(distance) || distance>maxDistance) return Infinity;
      if (distance<=1) return distance;
      try {
        const result=bot.safeNavigation?.plan?.(position,waypoint,
          {exactOnly:true,maxSteps:10,searchSteps:48,maxNodes:1800});
        return result?.ok && result?.exact ? distance : Infinity;
      } catch (_) { return Infinity; }
    };
    const huntCandidates=route.map((wp,i)=>({index:i,distance:reachable(wp)}))
      .filter((x)=>x.index>=Math.min(entryWaypointCount,route.length-1) && Number.isFinite(x.distance))
      .sort((a,b)=>a.distance-b.distance || a.index-b.index);
    const sellerCandidates=seller.sellerRoute.map((wp,i)=>({index:i,distance:reachable(wp)}))
      .filter((x)=>Number.isFinite(x.distance))
      .sort((a,b)=>a.distance-b.distance || b.index-a.index);
    // START HUNT must work at an actual hunt spawn even when its nearest
    // waypoint is beyond the six-tile merchant-connection tolerance. Validate
    // a same-floor path before deciding whether to enter the seller corridor.
    const additionalHuntCandidates=route.map((wp,i)=>({index:i,
      distance:reachable(wp,24)}))
      .filter(x=>x.index>=Math.min(entryWaypointCount,route.length-1) && Number.isFinite(x.distance))
      .sort((a,b)=>a.distance-b.distance || a.index-b.index);
    const nearbyHunt=huntCandidates[0]||additionalHuntCandidates[0]||null;
    const nearbySeller=sellerCandidates[0]||null;
    const merchantEnd=seller.sellerRoute[seller.sellerRoute.length-1];
    const nearSellerEnd=reachable(merchantEnd,3)<=3;
    // On the hunt, start hunting normally; the normal capacity check initiates
    // the next merchant trip. At a seller or along the connecting route, do not
    // dispatch the first Cave waypoint: seller-trip navigation owns movement.
    if (nearbyHunt && !nearSellerEnd &&
        (!nearbySeller || nearbyHunt.distance<=nearbySeller.distance)) {
      const ok=start();
      return {ok, mode:ok?'hunt':null,reason:ok?'':'Cave Bot could not start'};
    }
    if (!nearbySeller) {
      const reason='Current position is not near a reachable Shanar or hunt waypoint on this floor. No unrecorded travel attempted.';
      bot.log('START HUNT safe route unavailable', {position,reason});
      return {ok:false,reason};
    }
    // Never silently choose a fork in a route that crosses itself on one floor.
    if (sellerCandidates[1] && sellerCandidates[0].distance===sellerCandidates[1].distance &&
        Math.abs(sellerCandidates[0].index - sellerCandidates[1].index)>1 &&
        !isSameTile(seller.sellerRoute[sellerCandidates[0].index],
          seller.sellerRoute[sellerCandidates[1].index])) {
      const reason='Several seller waypoints are equally close; move to a recorded waypoint before START HUNT.';
      bot.log('START HUNT ambiguous seller corridor', {position,reason});
      return {ok:false,reason};
    }
    // Distinguish returning to hunt from arriving with a full backpack.
    const capacity=Number(bot.getPlayerSnapshot?.()?.capacity);
    const needsSale=Number.isFinite(capacity) && capacity<=config.minimumFreeCapacity;
    const attackWasRunning=!!bot.attack?.status?.()?.running;
    if (!start({deferFirstTick:true})) return {ok:false,reason:'Could not start Cave Bot'};
    const sellingBeforeHunt=needsSale && (nearSellerEnd || !nearbyHunt);
    state.sellerTrip={
      ...seller,
      phase:sellingBeforeHunt?'seller-out':'seller-return',
      index:sellingBeforeHunt ? nearbySeller.index : nearbySeller.index,
      attackWasRunning, floorMoveWasRunning:false,
      lastCombatMode:null,combatPaused:false,lastCombatSeenAt:0,
    };
    state.lastPathAt=0;
    state.lastWaypointWalkDestinationKey=null;
    syncSellerEscortCombat(state.sellerTrip);
    bot.log('START HUNT unified travel started', {
      phase:state.sellerTrip.phase, selectedWaypoint:nearbySeller.index+1,
      route:seller.sellerPresetName,capacity,threshold:config.minimumFreeCapacity,
    });
    tick();
    return {ok:true,mode:sellingBeforeHunt?'sell-first':'go-to-hunt'};
  }

  // The same route engine handles both directions. A home route must be
  // RECORDED from hunt waypoint #1 to the operator's marked Home tile.
  // Never guess stairs, teleport between floors, or reuse an arbitrary preset.
  function getValidatedHomeRoute(logFailure = true) {
    const preset = getPresetByName(config.homePresetName);
    const home = normalizePosition(bot.pz?.getHomePz?.());
    if (!preset || !home || !route.length || preset.route.length < 2 ||
        !isSameTile(preset.route[0], route[0]) ||
        !isSameTile(preset.route[preset.route.length - 1], home) ||
        preset.name.toLowerCase() === getActivePresetName().toLowerCase()) {
      if (logFailure) bot.log('HOME ROUTE INVALID: save a route from hunt WP1 to the exact marked Home position');
      return null;
    }
    return preset;
  }

  function goHome() {
    if (!state.running || state.sellerTrip || state.pausedForModeratorUntil ||
        state.pausedForVerification) return false;
    const preset = getValidatedHomeRoute();
    const pos = normalizePosition(bot.getPlayerPosition());
    if (!preset || !pos) return false;
    const attackWasRunning = !!bot.attack?.status?.()?.running;
    state.sellerTrip = {
      kind: 'home', phase: 'exit-hunt', index: findClosestWaypointIndex(pos),
      sellerRoute: preset.route.map(cloneValue),
      sellerTransitions: preset.transitions.map(cloneValue),
      returnRoute: null, returnTransitions: [], sellerPresetName: preset.name,
      attackWasRunning, floorMoveWasRunning: false,
      lastCombatMode: null, combatPaused: false, lastCombatSeenAt: 0,
    };
    cancelOwnWaypointWalk();
    state.lastPathAt = 0;
    syncSellerEscortCombat(state.sellerTrip);
    bot.log('travel HOME started', { route: preset.name, fight: config.travelFight });
    return true;
  }

  function goToHunt() {
    const trip = state.sellerTrip;
    if (trip) {
      if (trip.kind !== 'home' || trip.phase !== 'waiting-at-home') return false;
      trip.phase = 'seller-return';
      trip.index = trip.sellerRoute.length - 2;
      trip.lastCombatMode = null;
      syncSellerEscortCombat(trip);
      state.lastPathAt = 0;
      state.lastWaypointWalkDestinationKey = null;
      bot.log('travel to HUNT started');
      return true;
    }
    // A newly loaded session at Home may start the recorded reverse route.
    const preset = getValidatedHomeRoute();
    const pos = normalizePosition(bot.getPlayerPosition());
    const home = normalizePosition(bot.pz?.getHomePz?.());
    if (!preset || !pos || !home || !isSameTile(pos, home)) {
      bot.log('GO HUNT requires standing at marked Home or waiting after GO HOME');
      return false;
    }
    if (state.running) return false;
    // start() normally issues a waypoint movement immediately. Defer the first
    // tick until the reverse home route owns the navigation.
    if (!start({ deferFirstTick: true })) return false;
    const attackWasRunning = !!bot.attack?.status?.()?.running;
    state.sellerTrip = {
      kind: 'home', phase: 'seller-return', index: preset.route.length - 2,
      sellerRoute: preset.route.map(cloneValue),
      sellerTransitions: preset.transitions.map(cloneValue),
      returnRoute: null, returnTransitions: [], sellerPresetName: preset.name,
      attackWasRunning, floorMoveWasRunning: false,
      lastCombatMode: null, combatPaused: false, lastCombatSeenAt: 0,
    };
    syncSellerEscortCombat(state.sellerTrip);
    tick();
    return true;
  }

  function cancelSellerTrip() {
    const trip = state.sellerTrip;
    if (!trip) return false;
    cancelOwnWaypointWalk();
    state.sellerTrip = null;
    state.sellerTripCooldownUntil = Date.now() + 60000;
    state.needsRouteRejoinCheck = true;
    state.lastPathAt = 0;
    if (trip.attackWasRunning && !bot.attack?.status?.()?.running) bot.attack?.start?.();
    if (trip.floorMoveWasRunning && !bot.floorMove?.status?.()?.running) bot.floorMove?.start?.();
    bot.log("seller trip aborted; hunt resumed");
    return true;
  }

  function resumeFromSeller() {
    const trip = state.sellerTrip;
    if (!trip || trip.phase !== "waiting-at-seller") return false;
    trip.phase = "seller-return";
    syncSellerEscortCombat(trip);
    trip.index = trip.returnRoute ? 1 : trip.sellerRoute.length - 2;
    state.lastPathAt = 0;
    state.lastWaypointWalkDestinationKey = null;
    bot.log("seller visit confirmed by operator; returning to hunting zone");
    return true;
  }

  function finishSellerTrip() {
    const trip = state.sellerTrip;
    if (!trip) return;
    state.sellerTrip = null;
    state.sellerTripCooldownUntil = Date.now() + 60000;
    state.currentIndex = Math.max(0, Math.min(route.length - 1, trip.huntWaypointIndex ?? 0));
    state.entranceCompleted = entryWaypointCount > 0 && state.currentIndex >= entryWaypointCount;
    state.direction = config.routeTraversalMode === 'pingpong' &&
      state.currentIndex >= route.length-1 ? -1 : 1;
    state.lastWaypointWalkDestinationKey = null;
    state.lastPathAt = 0;
    state.needsRouteRejoinCheck = false;
    if (trip.attackWasRunning && !bot.attack?.status?.()?.running) bot.attack?.start?.();
    if (trip.floorMoveWasRunning && !bot.floorMove?.status?.()?.running) bot.floorMove?.start?.();
    bot.log("seller route return completed; normal hunting resumed");
  }

  function processSellerTrip(position, now) {
    let trip = state.sellerTrip;
    if (!trip) {
      beginSellerTrip(false);
      trip = state.sellerTrip;
    }
    if (!trip) return false;
    // Accept arrival at the recorded merchant endpoint even if the operator
    // manually navigated the final stairs/obstacle. Normally the waypoint
    // state machine reaches this state on its own, but the sale engine only
    // runs while phase === 'waiting-at-seller'. Confirm BOTH geometry and a
    // nearby NPC with the exact configured name: proximity alone is unsafe.
    if (trip.kind !== 'home' &&
        (trip.phase === 'exit-hunt' || trip.phase === 'seller-out')) {
      const endpoint = trip.sellerRoute?.[trip.sellerRoute.length - 1];
      const name = String(bot.autoSell?.config?.npcName || '').trim().toLowerCase();
      const npcType = window.CONST?.TYPES?.NPC ?? 2;
      // An NPC can stand several tiles away from the saved endpoint (the
      // player's recorded tile, not the NPC tile). Verify the real NPC by
      // type/name/floor/range; do not make sale depend on exact waypoint XY.
      const correctFloor = endpoint && position && position.z === endpoint.z;
      const npcNearby = correctFloor && !!name &&
        Object.values(window.gameClient?.world?.activeCreatures || {}).some((npc) => {
          const p = npc?.getPosition?.() || npc?.__position;
          return npc?.type === npcType && String(npc.name || '').trim().toLowerCase() === name &&
            p?.z === position.z && Math.max(Math.abs(p.x-position.x), Math.abs(p.y-position.y)) <= 2;
        });
      if (npcNearby) {
        cancelOwnWaypointWalk();
        trip.phase = 'waiting-at-seller';
        trip.combatPaused = false;
        trip.lastCombatMode = null;
        state.lastPathAt = 0;
        bot.log('seller reached at recorded endpoint; merchant interaction ready',
          { npc: bot.autoSell.config.npcName, autoSellEnabled: bot.autoSell.config.enabled === true });
      }
    }
    // Final approach to the verified Shanar NPC via validated same-floor moves.
    if (trip.kind !== 'home' && (trip.phase === 'exit-hunt' || trip.phase === 'seller-out') &&
        position?.z === trip.sellerRoute?.[trip.sellerRoute.length - 1]?.z) {
      const expectedName = String(bot.autoSell?.config?.npcName || '').trim().toLowerCase();
      const npcType = window.CONST?.TYPES?.NPC ?? 2;
      const merchant = Object.values(window.gameClient?.world?.activeCreatures || {}).find((c) => {
        const p = c?.getPosition?.() || c?.__position;
        return c?.type === npcType && String(c.name || '').trim().toLowerCase() === expectedName &&
          p?.z === position.z && Math.max(Math.abs(p.x-position.x),Math.abs(p.y-position.y)) <= 8;
      });
      const mp = merchant?.getPosition?.() || merchant?.__position;
      if (mp && Date.now() - (trip.lastMerchantApproachAt || 0) > 1800) {
        trip.lastMerchantApproachAt = Date.now();
        const choices = [
          {x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},
          {x:-1,y:-1},{x:1,y:-1},{x:-1,y:1},{x:1,y:1},
        ].map(({x,y}) => ({x:mp.x+x,y:mp.y+y,z:mp.z}))
          .sort((a,b) => Math.max(Math.abs(a.x-position.x),Math.abs(a.y-position.y)) -
            Math.max(Math.abs(b.x-position.x),Math.abs(b.y-position.y)));
        for (const tile of choices) {
          if (!bot.safeNavigation?.plan?.(position,tile,
              {exactOnly:true,maxSteps:10,searchSteps:48,maxNodes:1800})?.ok) continue;
          if (goToWaypoint(tile)) return true;
          break;
        }
      }
    }
    syncSellerEscortCombat(trip);
    if (trip.phase === "waiting-at-seller" || trip.phase === 'waiting-at-home') return true;
    if (isSellerEscortCombatEnabled(trip) && bot.attack?.status?.()?.running) {
      const active = !!bot.attack.status().combatActive;
      const monsters = !!bot.attack?.hasPriorityMonsters?.(now);
      if (active || monsters) {
        trip.lastCombatSeenAt = now;
        if (!trip.combatPaused) {
          trip.combatPaused = true;
          cancelOwnWaypointWalk(); // Does not cancel Auto Attack-owned chase.
          bot.log("seller escort paused for combat", { phase: trip.phase });
        }
        return true;
      }
      // Brief grace between respawns without walking one square after each kill.
      if (trip.combatPaused && now - trip.lastCombatSeenAt < 900) return true;
      if (trip.combatPaused) {
        trip.combatPaused = false;
        state.lastPathAt = 0;
        bot.log("seller escort resumed waypoint navigation");
      }
    }
    const currentReturnRoute = trip.returnRoute || trip.sellerRoute;
    let destination = trip.phase === "exit-hunt" ? route[trip.index] :
      trip.phase === "seller-return" ? currentReturnRoute[trip.index] : trip.sellerRoute[trip.index];
    if (!destination) {
      bot.log("seller trip invalid waypoint; aborting to prevent unsafe navigation");
      cancelSellerTrip();
      return true;
    }
    if (isAtWaypoint(position, destination) ||
        isAuthorizedLandingWaypoint(position, destination, state.currentIndex, trip)) {
      if (trip.phase === "exit-hunt") {
        if (trip.index === (trip.huntWaypointIndex ?? 0)) {
          trip.phase = "seller-out"; trip.index = 0;
        } else trip.index += trip.index > (trip.huntWaypointIndex ?? 0) ? -1 : 1;
      } else if (trip.phase === "seller-out") {
        if (trip.index === trip.sellerRoute.length - 1) {
          trip.phase = trip.kind === 'home' ? 'waiting-at-home' : 'waiting-at-seller';
          syncSellerEscortCombat(trip);
          bot.log(trip.kind === 'home' ?
            'HOME reached: stationary until GO HUNT' :
            'arrived at seller: optional Auto Sell starts when enabled, otherwise sell manually');
          return true;
        }
        trip.index += 1;
      } else if (trip.phase === "seller-return") {
        if (trip.returnRoute) {
          if (trip.index >= trip.returnRoute.length - 1) { finishSellerTrip(); return true; }
          trip.index += 1;
        } else {
          if (trip.index === 0) { finishSellerTrip(); return true; }
          trip.index -= 1;
        }
      }
      state.lastPathAt = 0;
      state.lastWaypointWalkDestinationKey = null;
      destination = trip.phase === "exit-hunt" ? route[trip.index] :
        trip.phase === "seller-return" ? currentReturnRoute[trip.index] : trip.sellerRoute[trip.index];
    }
    // Reuse the same learned stair/hole handling as intentional Cave Bot routes.
    if (destination?.z !== position.z) {
      if (!config.allowFloorTransitions) {
        bot.log('seller route blocked: explicit floor transitions are OFF');
        stop();bot.reportAlarm?.('seller-floor-blocked', 'Viaje a Shanar: cambios de piso desactivados', 'Cave Bot detenido');return true;
      }
      state.expectedFloor=null;
      const previous = trip.phase === 'exit-hunt'
        ? route[trip.index > (trip.huntWaypointIndex ?? 0) ? trip.index + 1 : trip.index - 1]
        : trip.phase === 'seller-out' ? trip.sellerRoute[trip.index - 1]
        : trip.returnRoute ? trip.returnRoute[trip.index - 1]
        : trip.sellerRoute[trip.index + 1];
      handleFloorChange(destination, now, previous);
    } else if (now - state.lastPathAt >= config.repathMs ||
      now - state.lastProgressAt >= config.repathMs) {
      goToWaypoint(destination);
    }
    return true;
  }

  function tick() {
    if (!state.running) return;

    try {
      observePosition();

      if (!route.length) {
        stop();
        return;
      }

      const position = normalizePosition(bot.getPlayerPosition());
      const positionKey = getPositionKey(position);
      const now = Date.now();
      if (config.allowFloorTransitions && state.expectedFloor === null && position) state.expectedFloor=position.z;
      if (positionKey && positionKey !== state.lastPositionKey) {
        state.lastPositionKey = positionKey;
        state.lastProgressAt = now;
      }

      // The server may still teleport the player unexpectedly. Stop instead of
      // resuming the route on another floor (never auto-recover via stairs).
      if (!config.allowFloorTransitions && state.expectedFloor !== null &&
          position && position.z !== state.expectedFloor) {
        const expectedBeforeStop = state.expectedFloor;
        bot.log('UNEXPECTED FLOOR CHANGE: cave and melee stopped',
          {expected:expectedBeforeStop,observed:position.z});
        bot.attack?.stop?.();
        stop();
        bot.reportAlarm?.('unexpected-floor', `Piso inesperado: esperaba ${expectedBeforeStop}, detectó ${position.z}`, 'Detuvo Cave Bot y Auto Attack');
        return;
      }
      // Moderator alert pauses movement ONLY; Auto Attack and Auto Heal keep running.
      if (processModeratorPause(now)) return;
      if (now < state.floorArrivalGraceUntil) return;
      // Pause *only* cave navigation. Auto Attack and Auto Heal remain active.
      if (config.pauseWaypointsOnVerification && state.pausedForVerification) {
        cancelOwnWaypointWalk();
        return;
      }

      if (state.pausedForFloorMove) {
        // A stale pause can remain if floor-item navigation was interrupted.
        // Never steal an active floor-item path.
        const itemStatus = bot.floorMove?.status?.();
        if (itemStatus?.running && itemStatus.navigatingTo) {
          cancelOwnWaypointWalk();
          return;
        }
        setFloorMovePause(false);
        state.needsRouteRejoinCheck = true;
        bot.log("cave recovered stale floor-item navigation pause");
      }
      // Supply-return route has priority over the hunting route and combat.
      if (processSellerTrip(position, now)) return;
      // Hold the route only while a corpse item transfer is waiting for confirmation.
      if (bot.corpseLoot?.isBusy?.()) { cancelOwnWaypointWalk(); return; }
      const attackStatus = bot.attack?.status?.() || null;
      const priorityEnabled = config.prioritizeMonsters === true &&
        !!attackStatus?.running && !!attackStatus?.config?.enabled;
      const monstersInRange = priorityEnabled &&
        !!bot.attack?.hasPriorityMonsters?.(now);
      if (monstersInRange) state.lastPriorityMonsterSeenAt = now;
      // Preserve the original 60-second behavior when this is disabled.
      // With priority enabled, a short grace period prevents waypoint movement
      // between kills, but a stale client target cannot freeze the route.
      const noTarget = !attackStatus?.currentTarget && !attackStatus?.combatActive;
      const targetPosition = normalizePosition(attackStatus?.currentTarget?.position);
      const targetDistance = getDistance(position, targetPosition);
      const staleCombat = priorityEnabled && state.pausedForCombat &&
        now - state.combatPauseStartedAt > 15000 &&
        now - state.lastProgressAt > 12000 &&
        (noTarget || (attackStatus?.config?.meleeMode === true && targetDistance > 2));
      if (staleCombat && now >= state.combatYieldUntil) {
        state.combatYieldUntil = now + 5000;
        bot.log("cave priority yielded temporarily after stalled chase", {
          targetDistance,
          hasTarget: !noTarget,
        });
      }
      // Do not override actual nearby engaged combat. If no valid target or
      // melee chase cannot move for a long period, allow Cave to leave the
      // unreachable spot briefly rather than pausing forever.
      const yielded = now < state.combatYieldUntil && noTarget && !monstersInRange;
      // Waypoint findPath() is deliberately interpreted by the Minibia client
      // as a manual map click and disables Safe Chase while a target exists.
      // If the player has explicitly activated native chase/follow, Cave Bot
      // must not compete for movement until the current fight has ended.
      const nativeChaseMode = Number(window.gameClient?.interface?.fightModeSelector?.currentChaseMode) || 0;
      const nativeFollow = !!window.gameClient?.player?.__followTarget;
      const nativeMovementOwnsCombat = !!attackStatus?.running && !!attackStatus?.currentTarget &&
        (nativeFollow || nativeChaseMode === 1 || nativeChaseMode === 2);
      const shouldPauseForCombat = nativeMovementOwnsCombat || (priorityEnabled
        ? !yielded && (monstersInRange || (state.pausedForCombat && now - state.lastPriorityMonsterSeenAt < 900))
        : !!attackStatus?.combatActive &&
          Number(attackStatus?.combatDurationMs || 0) < 60000);

      if (shouldPauseForCombat) {
        if (!state.pausedForCombat) {
          state.pausedForCombat = true;
          state.combatPauseStartedAt = now;
          // Always hand the movement queue to combat, even if priority is OFF:
          // a previously queued cave route must not block an active chase.
          cancelOwnWaypointWalk();
          bot.log("cave paused for auto attack", {
            combatDurationMs: Number(attackStatus?.combatDurationMs || 0),
            targetCount: Number(attackStatus?.targetCount || 0),
            prioritizeMonsters: priorityEnabled,
            monstersInRange: !!monstersInRange,
          });
        }
        // If the previous Cave Bot step was still queued, relinquish it.
        if (bot.safeNavigation?.owns?.('cave')) cancelOwnWaypointWalk();
        return;
      }

      if (state.pausedForCombat) {
        state.pausedForCombat = false;
        state.combatPauseStartedAt = 0;
        state.needsRouteRejoinCheck = true;
        state.lastPathAt = 0; // resume or rejoin immediately
        bot.log("cave resumed after auto attack", {
          combatDurationMs: Number(attackStatus?.combatDurationMs || 0),
          targetCount: Number(attackStatus?.targetCount || 0),
        });
      }

      maybeRecoverRoute(position, now);

      let waypoint = getCurrentWaypoint();
      if (!waypoint) {
        stop();
        return;
      }

      if (isAtWaypoint(position, waypoint) ||
          isAuthorizedLandingWaypoint(position, waypoint, state.currentIndex)) {
        waypoint = advanceWaypoint();
      }

      if (!waypoint) {
        return;
      }

      // A floor-change waypoint is deliberately not walkable by SafeNavigation.
      // If it directly precedes a waypoint on another floor, dispatch the
      // deliberate transition instead of indefinitely pathing to its tile.
      const nextTransitionIndex = state.currentIndex + state.direction;
      const nextTransitionWaypoint = route[nextTransitionIndex];
      const waypointTile = position?.z === waypoint.z ? getTileAt(waypoint) : null;
      if (config.allowFloorTransitions && position && waypointTile &&
          nextTransitionWaypoint && nextTransitionWaypoint.z !== position.z &&
          isTransitionCandidateTile(waypointTile, nextTransitionWaypoint, position)) {
        state.currentIndex = nextTransitionIndex;
        handleFloorChange(nextTransitionWaypoint, now, waypoint);
        return;
      }

      if (position && waypoint.z !== position.z) {
        if (!config.allowFloorTransitions) {
          state.lastRoutePathError='floor transition blocked (enable intentional transitions explicitly)';
          state.lastRoutePathErrorAt=now;
          stop();
          bot.reportAlarm?.('forbidden-floor', 'Waypoint requiere cambio de piso no autorizado', 'Detuvo Cave Bot');
          bot.log('cave stopped: waypoint requires a forbidden floor change',waypoint);
          return;
        }
        state.expectedFloor=null; // deliberate transition: no false emergency while changing floors
        handleFloorChange(waypoint, now);
        return;
      }

      const shouldRepath =
        now - state.lastPathAt >= config.repathMs ||
        !state.lastProgressAt ||
        now - state.lastProgressAt >= config.repathMs;

      if (shouldRepath) {
        goToWaypoint(waypoint);
      }
    } catch (error) {
      bot.log("cave tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function startObserver() {
    if (state.observerTimerId != null) {
      return;
    }

    state.observerTimerId = window.setInterval(() => {
      try {
        observePosition();
      } catch (error) {
        bot.log("cave observer failed", error?.message || error);
      }
    }, 200);
  }

  function stopObserver() {
    if (state.observerTimerId == null) {
      return;
    }

    window.clearInterval(state.observerTimerId);
    state.observerTimerId = null;
  }

  function start(overrides = {}) {
    const deferFirstTick = overrides.deferFirstTick === true;
    const { deferFirstTick: ignored, ...safeOverrides } = overrides;
    Object.assign(config, safeOverrides, { enabled: true });
    config.tickMs = 500;
    persistConfig();

    if (!route.length) {
      bot.log("cave bot cannot start without waypoints");
      return false;
    }

    if (state.running) {
      bot.log("cave bot already running");
      return false;
    }

    const position = normalizePosition(bot.getPlayerPosition());
    state.running = true;
    state.entranceCompleted = false;
    state.currentIndex = chooseStartIndex(position);
    state.direction = config.routeTraversalMode === "pingpong" && state.currentIndex >= route.length - 1 ? -1 : 1;
    if (route.length <= 1) {
      state.direction = 1;
    }
    state.lastPathAt = 0;
    state.lastPositionKey = getPositionKey(position);
    state.expectedFloor = position?.z ?? null;
    state.pendingFloorAction = null;
    state.lastAuthorizedFloorArrival = null;
    state.floorArrivalGraceUntil = 0;
    state.lastProgressAt = Date.now();
    state.pausedForCombat = false;
    state.lastWaypointWalkDestinationKey = null;
    state.lastPriorityMonsterSeenAt = 0;
    state.needsRouteRejoinCheck = false;
    state.lastRouteRejoinAt = 0;
    state.lastRoutePathError = null;
    state.combatYieldUntil = 0;
    state.combatPauseStartedAt = 0;
    bot.log("cave bot started", {
      waypoints: route.length,
      currentIndex: state.currentIndex + 1,
      direction: state.direction,
      waypoint: getCurrentWaypoint(),
    });
    if (!deferFirstTick) tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    state.pausedForCombat = false;
    state.entranceCompleted = false;
    state.pausedForModeratorUntil = 0;
    bot.attack?.setMovementHold?.('moderator', false);
    bot.attack?.setMovementHold?.('verification', false);
    state.expectedFloor = null;
    state.pendingFloorAction = null;
    state.lastAuthorizedFloorArrival = null;
    state.floorArrivalGraceUntil = 0;
    const abandonedSellerTrip = state.sellerTrip;
    cancelOwnWaypointWalk();
    state.sellerTrip = null;
    if (abandonedSellerTrip?.attackWasRunning && !bot.attack?.status?.()?.running) {
      bot.attack?.start?.();
    }
    state.pausedForFloorMove = false;
    state.needsRouteRejoinCheck = false;
    state.combatPauseStartedAt = 0;
    bot.log("cave bot stopped");
    return true;
  }

  function addWaypoint(waypoint) {
    const normalized = normalizeWaypoint(waypoint);
    if (!normalized) {
      return null;
    }

    route.push(normalized);
    persistRoute();
    bot.log("cave waypoint added", { ...normalized, total: route.length });
    return cloneValue(normalized);
  }

  function addWaypointCurrentSpot() {
    const position = normalizePosition(bot.getPlayerPosition());
    if (!position) {
      bot.log("could not read current position for cave waypoint");
      return null;
    }

    return addWaypoint(position);
  }

  function clearWaypoints() {
    route = [];
    entryWaypointCount = 0;
    state.currentIndex = 0;
    state.direction = 1;
    persistRoute();
    bot.log("cave route cleared");

    if (state.running) {
      stop();
    }

    return [];
  }

  function clearTransitions() {
    transitions = [];
    state.pendingTransitionSource = null;
    persistTransitions();
    bot.log("cave learned transitions cleared");
    return [];
  }

  function removeLastWaypoint() {
    if (!route.length) {
      return null;
    }

    const removed = route.pop();
    if (state.currentIndex >= route.length) {
      state.currentIndex = Math.max(0, route.length - 1);
    }
    if (route.length <= 1) {
      state.direction = 1;
    }
    entryWaypointCount = Math.min(entryWaypointCount, Math.max(0, route.length - 2));
    persistRoute();
    bot.log("cave waypoint removed", removed);

    if (!route.length && state.running) {
      stop();
    }

    return removed;
  }

  function setCurrentIndex(index) {
    if (!route.length) {
      state.currentIndex = 0;
      state.direction = 1;
      return 0;
    }

    const nextIndex = Math.max(0, Math.min(route.length - 1, Math.trunc(Number(index) || 0)));
    state.currentIndex = nextIndex;
    state.entranceCompleted = entryWaypointCount === 0 || nextIndex >= entryWaypointCount;
    state.direction = config.routeTraversalMode === "pingpong" && nextIndex >= route.length - 1 ? -1 : 1;
    if (route.length <= 1) {
      state.direction = 1;
    }
    return state.currentIndex;
  }

  function status() {
    const position = normalizePosition(bot.getPlayerPosition());
    const waypoint = getCurrentWaypoint();

    return {
      running: state.running,
      config: { ...config },
      route: getRoute(),
      transitions: getTransitions(),
      presetNames: getPresetNames(),
      activePresetName: getActivePresetName(),
      currentIndex: state.currentIndex,
      entryWaypointCount,
      entranceCompleted: state.entranceCompleted,
      moderatorPaused: Date.now() < state.pausedForModeratorUntil,
      moderatorPauseRemainingMs: Math.max(0, state.pausedForModeratorUntil - Date.now()),
      moderatorLastSender: state.moderatorLastSender,
      direction: state.direction,
      currentWaypoint: cloneValue(waypoint),
      distanceToWaypoint: getDistanceToWaypoint(position, waypoint),
      nearestWaypointIndex: route.length ? findClosestWaypointIndex(position) : null,
      distanceToNearestWaypoint: position && route.length ?
        getDistanceToWaypoint(position, route[findClosestWaypointIndex(position)]) : null,
      routeRejoinCount: state.routeRejoinCount,
      lastRouteRejoinReason: state.lastRouteRejoinReason,
      lastRoutePathError: state.lastRoutePathError,
      lastRoutePathErrorAt: state.lastRoutePathErrorAt,
      priorityYieldUntil: state.combatYieldUntil,
      lastPathAt: state.lastPathAt,
      lastProgressAt: state.lastProgressAt,
      pendingTransitionSource: cloneValue(state.pendingTransitionSource),
      pendingFloorAction: cloneValue(state.pendingFloorAction),
      lastAuthorizedFloorArrival: cloneValue(state.lastAuthorizedFloorArrival),
      floorTransitionCount: state.floorTransitionCount,
      lastFloorTransitionResult: state.lastFloorTransitionResult,
      shovelFound: !!findShovelSource(),
      ropeFound: !!findRopeSource(),
      relevantLearnedTransition: position && waypoint ? cloneValue(findBestKnownTransition(position, waypoint)) : null,
      pausedForCombat: state.pausedForCombat,
      expectedFloor: state.expectedFloor,
      pausedForFloorMove: state.pausedForFloorMove,
      pausedForVerification: state.pausedForVerification && config.pauseWaypointsOnVerification,
      lastVerificationNotice: state.lastVerificationNotice,
      lastVerificationSource: state.lastVerificationSource,
      lastVerificationChannel: state.lastVerificationChannel,
      lastVerificationSender: state.lastVerificationSender,
      lastVerificationSeenAt: state.lastVerificationSeenAt,
      verificationLastPhase: state.verificationLastPhase,
      verificationSavedSetup: !!getVerificationSnapshot(),
      verificationLastRestore: state.verificationLastRestore,
      verificationLastRestoreAt: state.verificationLastRestoreAt,
      sellerTrip: getSellerTripStatus(),
      sellerRouteInfo: (() => {
        const sr = config.sellerPresetName ? getValidatedSellerRoute(false) : null;
        return sr ? { valid:true, recordedDirection:sr.recordedDirection,
          huntWaypointIndex:sr.huntWaypointIndex, joinDistance:sr.joinDistance,
          sellerPresetName:sr.sellerPresetName } : {valid:false};
      })(),
      homeRouteValid: !!(config.homePresetName && getValidatedHomeRoute(false)),
      freeCapacity: (() => {
        const cap = bot.getPlayerSnapshot?.()?.capacity;
        return cap == null ? null : (Number.isFinite(Number(cap)) ? Number(cap) : null);
      })(),
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    config.allowFloorTransitions = config.allowFloorTransitions === true;
    config.routeTraversalMode = config.routeTraversalMode === "loop" ? "loop" : "pingpong";
    if (config.routeTraversalMode === "loop") state.direction = 1;
    config.prioritizeMonsters = config.prioritizeMonsters === true;
    config.randomizeMovement = config.randomizeMovement === true;
    config.autoRecoverWaypoints = config.autoRecoverWaypoints !== false;
    config.limitChaseToRoute = config.limitChaseToRoute === true;
    config.maxChaseFromRouteTiles = Math.max(2, Math.min(20, Math.trunc(Number(config.maxChaseFromRouteTiles) || 6)));
    config.autoSellerVisit = config.autoSellerVisit === true;
    config.sellerPresetName = String(config.sellerPresetName || "").trim();
    config.sellerReturnPresetName = String(config.sellerReturnPresetName || "").trim();
    config.minimumFreeCapacity = Math.max(1, Math.min(10000, Number(config.minimumFreeCapacity) || 50));
    config.sellerFightOutbound = config.sellerFightOutbound === true;
    config.sellerFightReturn = config.sellerFightReturn === true;
    config.homePresetName = String(config.homePresetName || '').trim();
    config.travelFight = config.travelFight === true;
    config.useWaypointTools = config.useWaypointTools !== false;
    config.pauseWaypointsOnVerification = config.pauseWaypointsOnVerification === true;
    config.verificationScanTickMs = Math.max(200, Math.min(5000, Math.round(Number(config.verificationScanTickMs) || 500)));
    config.pauseOnModeratorMessage = config.pauseOnModeratorMessage === true;
    config.moderatorPauseMs = Math.max(20000, Math.min(120000, Number(config.moderatorPauseMs) || 30000));
    config.tickMs = 500;
    if (!config.pauseWaypointsOnVerification) {
      state.pausedForVerification = false;
      bot.attack?.setMovementHold?.('verification', false);
      state.verificationAlarmedStages.clear();
    }
    if (!config.pauseOnModeratorMessage && state.pausedForModeratorUntil) {
      state.pausedForModeratorUntil = 0;
      bot.attack?.setMovementHold?.('moderator', false);
    }
    restartVerificationScanner();
    restartModeratorScanner();
    persistConfig();
    bot.log("cave config updated", { ...config });
    return { ...config };
  }

  restartVerificationScanner();
  restartModeratorScanner();
  bot.addCleanup(() => {
    if (state.verificationTimerId != null) window.clearInterval(state.verificationTimerId);
    state.verificationTimerId = null;
    if (state.moderatorScannerTimerId != null) window.clearInterval(state.moderatorScannerTimerId);
    state.moderatorScannerTimerId = null;
  });
  startObserver();
  bot.addCleanup(stopObserver);
  startMinimapOverlay();
  bot.addCleanup(stopMinimapOverlay);

  if (config.enabled && route.length) {
    start();
  }

  bot.cave = {
    start,
    stop,
    status,
    updateConfig,
    resumeAfterVerification,
    beginSellerTrip,
    startHuntCycle,
    goHome,
    goToHunt,
    goToHuntFromSeller,
    getSellerTripStatus,
    getSellerEscortWaypoints,
    resumeFromSeller,
    cancelSellerTrip,
    setFloorMovePause,
    scanVerificationNotice,
    config,
    getRoute,
    getEntryWaypointCount,
    setEntryWaypointCount,
    isModeratorSender,
    isModeratorChatMessage,
    getTransitions,
    getPresetNames,
    getActivePresetName,
    getCurrentWaypoint,
    createPreset,
    savePreset,
    loadPreset,
    deletePreset,
    addWaypoint,
    addWaypointCurrentSpot,
    clearWaypoints,
    clearTransitions,
    removeLastWaypoint,
    setCurrentIndex,
    goToWaypoint,
    goToPosition,
    handleFloorChange,
    findClosestWaypointIndex,
    findRopeSource,
    findShovelSource,
    inspectNearbyTiles: (radius = 1) => {
      const position = normalizePosition(bot.getPlayerPosition());
      if (!position) {
        return [];
      }

      return getLoadedTiles()
        .map((tile) => ({ tile, position: getTilePosition(tile) }))
        .filter((entry) =>
          entry.position &&
          entry.position.z === position.z &&
          Math.abs(entry.position.x - position.x) <= radius &&
          Math.abs(entry.position.y - position.y) <= radius
        )
        .map((entry) => ({
          position: entry.position,
          isFloorChange: isFloorChangeTile(entry.tile),
          isHole: isHoleTile(entry.tile),
          isRopeTarget: isRopeTargetTile(entry.tile),
          isShovelTarget: isShovelTargetTile(entry.tile),
          names: getTileThings(entry.tile).map((thing) => getThingName(thing)).filter(Boolean),
        }));
    },
    isAtWaypoint,
  };
};
