window.__minibiaBotBundle = window.__minibiaBotBundle || {};

// Opt-in, conservative corpse looting. Relies on Minibia's native Auto Open Corpse.
window.__minibiaBotBundle.installCorpseLootModule = function installCorpseLootModule(bot) {
  const key = "minibiaBot.corpseLoot.config";
  const config = Object.assign({ enabled: false, items: "" }, bot.storage.get(key, {}));
  config.enabled = config.enabled === true;
  config.items = String(config.items || "");
  const state = { pending: null, attempts: 0, moved: 0, reason: "Off", lastActionAt: 0, timer: null };
  const norm = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const corpseTitle = /^(?:the\s+)?(?:dead\b|slain\b|corpse\b|remains\b|body of\b|loot of\b)/i;
  const corpseName = /\b(?:dead|slain|corpse|remains|carcass|body of)\b/i;
  const persist = () => bot.storage.set(key, { ...config });
  function allowed() {
    const tokens = String(config.items).split(/[,;\n]+/).map(norm).filter(Boolean);
    return { ids: new Set(tokens.filter(x => /^\d+$/.test(x)).map(Number)), names: new Set(tokens.filter(x => !/^\d+$/.test(x))) };
  }
  function nameOf(item) {
    const id = Number(item?.id), client = window.gameClient;
    const def = client?.itemDefinitionsByCid?.[id] || client?.itemDefinitionsBySid?.[id] || client?.itemDefinitions?.[id];
    return norm(def?.properties?.name || item?.name);
  }
  function nearbyCorpseIds() {
    const me = bot.getPlayerPosition?.();
    const ids = new Set(), world = window.gameClient?.world;
    if (!me || typeof Position !== "function" || !world?.getTileFromWorldPosition) return ids;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const tile = world.getTileFromWorldPosition(new Position(me.x + dx, me.y + dy, me.z));
      for (const item of (tile?.items || [])) {
        if (item?.isContainer?.() && corpseName.test(nameOf(item))) ids.add(Number(item.id));
      }
    }
    return ids;
  }
  function findCorpse() {
    const containers = Array.from(window.gameClient?.player?.__openedContainers || []);
    const nearby = nearbyCorpseIds();
    for (const c of containers) {
      if (!Array.isArray(c?.slots) || typeof c.getSlotItem !== "function") continue;
      const title = c.window?.state?.title || c.__title || "";
      // A recognized corpse title AND a matching nearby corpse object are required.
      // Never take anything from an ordinary backpack or depot.
      if (corpseTitle.test(String(title)) && nearby.has(Number(c.id))) return c;
    }
    return null;
  }
  function backpackDestination() {
    const equip = window.gameClient?.player?.equipment;
    const slot = typeof CONST === "undefined" ? null : CONST?.EQUIPMENT?.BACKPACK;
    const bp = Number.isInteger(slot) ? equip?.getSlotItem?.(slot) : null;
    return bp?.isContainer?.() ? { which: equip, index: slot } : null;
  }
  function combatBusy(now) {
    const player = window.gameClient?.player;
    if (player?.target || player?.__target) return true;
    const attack = bot.attack?.status?.();
    return !!(attack?.running && (attack.combatActive || bot.attack?.hasPriorityMonsters?.(now)));
  }
  function fail(reason) { config.enabled = false; state.pending = null; state.reason = reason; persist(); bot.log("auto loot stopped", reason); }
  function tick(now = Date.now()) {
    if (!config.enabled) return false;
    const filter = allowed();
    if (!filter.ids.size && !filter.names.size) { state.reason = "Add exact loot names first"; return false; }
    if (state.pending) {
      const p = state.pending;
      const stillOpen = Array.from(window.gameClient?.player?.__openedContainers || []).includes(p.container);
      if (!stillOpen) { fail("Corpse closed before move confirmation; manual check required"); return false; }
      const current = p.container.getSlotItem(p.slot);
      const remaining = current?.id === p.id ? (current.isStackable?.() ? Number(current.count || 1) : 1) : 0;
      if (remaining < p.before) { state.pending = null; state.moved++; state.reason = "Confirmed item moved"; return true; }
      if (now - p.at > 4000) { fail("Server did not confirm corpse item move; manual check required"); return false; }
      state.reason = "Waiting for item confirmation";
      return false;
    }
    const cave = bot.cave?.status?.();
    if (combatBusy(now) || cave?.sellerTrip || cave?.pausedForVerification || bot.floorMove?.status?.()?.navigatingTo) {
      state.reason = "Yielding to combat / travel"; return false;
    }
    if (now - state.lastActionAt < 1200) return false;
    const destination = backpackDestination();
    if (!destination) { state.reason = "Equip a backpack"; return false; }
    const corpse = findCorpse();
    if (!corpse) { state.reason = "Waiting for nearby opened corpse (use game's Auto Open Corpse)"; return false; }
    if (!window.gameClient?.send || typeof ItemMovePacket !== "function") { state.reason = "ItemMovePacket not available"; return false; }
    for (let i = 0; i < corpse.slots.length; i++) {
      const item = corpse.getSlotItem(i);
      if (!item || (!filter.ids.has(Number(item.id)) && !filter.names.has(nameOf(item)))) continue;
      const count = item.isStackable?.() ? Math.min(100, Math.max(1, Math.floor(Number(item.count) || 1))) : 1;
      try {
        state.pending = { container: corpse, slot: i, id: item.id, before: count, at: now };
        state.lastActionAt = now; state.attempts++;
        window.gameClient.send(new ItemMovePacket({ which: corpse, index: i }, destination, count));
        state.reason = "Taking " + nameOf(item);
        bot.log("corpse item move requested", { name: nameOf(item), count });
        return true;
      } catch (err) { fail("Corpse item move error: " + (err?.message || err)); return false; }
    }
    state.reason = "No selected items in corpse";
    return false;
  }
  function updateConfig(opts = {}) {
    if ("items" in opts) config.items = String(opts.items || "");
    if ("enabled" in opts) {
      if (opts.enabled !== true) { config.enabled = false; state.pending = null; state.reason = "Off"; }
      else if (!allowed().ids.size && !allowed().names.size) { config.enabled = false; state.reason = "Add exact loot names first"; }
      else { config.enabled = true; state.reason = "Looking for corpses"; }
    }
    persist(); return { ...config };
  }
  function stop(reason = "Off") { return updateConfig({ enabled: false }), state.reason = reason, true; }
  function status() { return { running: config.enabled, config: { ...config }, reason: state.reason, moved: state.moved, attempts: state.attempts, pending: !!state.pending }; }
  function isBusy() { return !!(config.enabled && state.pending); }
  state.timer = window.setInterval(() => { try { tick(); } catch (e) { fail("Auto loot exception: " + (e?.message || e)); } }, 750);
  bot.addCleanup(() => { window.clearInterval(state.timer); state.pending = null; });
  bot.corpseLoot = { config, updateConfig, stop, status, isBusy, tick };
};
