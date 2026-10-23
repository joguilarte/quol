window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installHealModule = function installHealModule(bot) {
  const configStorageKey = "minibiaBot.heal.config";
  const state = {
    running: false,
    timerId: null,
    lastHpHealAt: 0,
    lastManaHealAt: 0,
    lastHpAttemptAt: 0,
    lastManaAttemptAt: 0,
    pendingHpAttempt: null,
    pendingManaAttempt: null,
  };

  const config = Object.assign(
    {
      tickMs: 200,
      healCooldownMs: 1200,
      healRetryMs: 3000,
      healConfirmMs: 600,
      minHp: 250,
      hpHotbarSlot: 1,
      minMana: 150,
      manaHotbarSlot: 2,
      hpEnabled: true,
      manaEnabled: true,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function readStats() {
    const playerState = bot.getPlayerSnapshot?.();

    return playerState
      ? {
          hp: {
            current: Number(playerState.health ?? 0),
            max: Number(playerState.maxHealth ?? 0),
          },
          mana: {
            current: Number(playerState.mana ?? 0),
            max: Number(playerState.maxMana ?? 0),
          },
        }
      : { hp: null, mana: null };
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

  // Hotkeys may contain spells, custom text, items or combat actions.
  // Do not press a spell unless the player has enough mana to cast it.
  function getHealSlotInfo(slotNumber) {
    const index = normalizeHotbarSlot(slotNumber);
    const slot = index == null ? null : window.gameClient?.interface?.hotbarManager?.slots?.[index - 1];
    if (!slot || !slot.canvas?.canvas) return null;

    const spells = window.gameClient?.interface?.SPELLS;
    let spell = slot.spell || null;
    if (!spell && typeof slot.text === "string") {
      const words = slot.text.trim().toLowerCase();
      if (Array.isArray(spells)) {
        const sid = spells.findIndex((candidate) =>
          candidate?.words?.trim().toLowerCase() === words
        );
        if (sid !== -1) {
          spell = { sid, mana: spells[sid]?.mana ?? 0 };
        }
      }
    }
    // Arbitrary text and action slots are not healing potions/spells.
    if (!spell && !slot.item) return null;

    if (!spell) return { slot, manaCost: 0, spell: null };
    const definition = typeof window.gameClient?.interface?.getSpell === "function"
      ? window.gameClient.interface.getSpell(spell.sid)
      : null;
    const manaCost = Number(definition?.mana ?? spell.mana ?? 0);
    return { slot, spell, manaCost: Number.isFinite(manaCost) ? Math.max(0, manaCost) : 0 };
  }

  function canUseHealSlot(slotNumber, stats) {
    const details = getHealSlotInfo(slotNumber);
    if (!details || !stats?.mana) return false;
    if (details.manaCost > stats.mana.current) return false;
    if (details.spell) {
      const manager = window.gameClient?.interface?.hotbarManager;
      if (typeof manager?.__canPlayerCastSpell === "function" &&
          !manager.__canPlayerCastSpell(details.spell.sid)) return false;
      const spellbook = window.gameClient?.player?.spellbook;
      if (spellbook?.cooldowns?.has?.(details.spell.sid) ||
          (spellbook?.GLOBAL_COOLDOWN != null &&
           spellbook?.cooldowns?.has?.(spellbook.GLOBAL_COOLDOWN))) return false;
    }
    return true;
  }

  const minFailedRetryMs = 3000;
  function getRetryMs() {
    return Math.max(minFailedRetryMs, Number(config.healRetryMs) || 0);
  }

  function hasPendingAttempt() {
    return !!(state.pendingHpAttempt || state.pendingManaAttempt);
  }

  function didHpHealSucceed(stats, attempt) {
    if (!stats?.hp || !attempt) {
      return false;
    }

    return (
      stats.hp.current > attempt.hpBefore
    );
  }

  function didManaHealSucceed(stats, attempt) {
    if (!stats?.mana || !attempt) {
      return false;
    }

    return (
      stats.mana.current > attempt.manaBefore
    );
  }

  function resolvePendingAttempts(stats, now = Date.now()) {
    const hpAttempt = state.pendingHpAttempt;
    if (hpAttempt) {
      if (didHpHealSucceed(stats, hpAttempt)) {
        state.lastHpHealAt = hpAttempt.attemptedAt;
        state.pendingHpAttempt = null;
        bot.log("confirmed hp heal", { slot: hpAttempt.slot });
      } else if (now - hpAttempt.attemptedAt >= Math.max(500, Number(config.healConfirmMs) || 0)) {
        state.pendingHpAttempt = null;
        bot.log("hp heal did not register", { slot: hpAttempt.slot });
      }
    }

    const manaAttempt = state.pendingManaAttempt;
    if (manaAttempt) {
      if (didManaHealSucceed(stats, manaAttempt)) {
        state.lastManaHealAt = manaAttempt.attemptedAt;
        state.pendingManaAttempt = null;
        bot.log("confirmed mana heal", { slot: manaAttempt.slot });
      } else if (now - manaAttempt.attemptedAt >= Math.max(500, Number(config.healConfirmMs) || 0)) {
        state.pendingManaAttempt = null;
        bot.log("mana heal did not register", { slot: manaAttempt.slot });
      }
    }
  }

  function canUseHpHeal(now = Date.now(), stats = readStats()) {
    const { hp } = stats;
    const slot = normalizeHotbarSlot(config.hpHotbarSlot);
    if (!config.hpEnabled || !hp || !slot || state.pendingHpAttempt || !canUseHealSlot(slot, stats)) return false;

    return (
      Number(config.minHp) > 0 &&
      hp.max > 0 &&
      hp.current > 0 &&
      hp.current < hp.max &&
      hp.current <= Number(config.minHp) &&
      now - state.lastHpHealAt >= Math.max(0, Number(config.healCooldownMs) || 0) &&
      now - state.lastHpAttemptAt >= getRetryMs()
    );
  }

  function canUseManaHeal(now = Date.now(), stats = readStats()) {
    const { mana } = stats;
    const slot = normalizeHotbarSlot(config.manaHotbarSlot);
    if (!config.manaEnabled || !mana || !slot || state.pendingManaAttempt || state.pendingHpAttempt ||
        !canUseHealSlot(slot, stats)) return false;

    return (
      Number(config.minMana) > 0 &&
      mana.max > 0 &&
      mana.current < mana.max &&
      mana.current <= Number(config.minMana) &&
      now - state.lastManaHealAt >= Math.max(0, Number(config.healCooldownMs) || 0) &&
      now - state.lastManaAttemptAt >= getRetryMs()
    );
  }

  function triggerHpHeal(now = Date.now(), stats = readStats()) {
    if (!canUseHpHeal(now, stats)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.hpHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastHpAttemptAt = now;
      state.pendingHpAttempt = {
        attemptedAt: now,
        slot,
        hpBefore: Number(stats.hp?.current ?? 0),
        manaBefore: Number(stats.mana?.current ?? 0),
      };
      bot.log("pressed hp heal hotkey", { slot, minHp: config.minHp });
    }

    return clicked;
  }

  function triggerManaHeal(now = Date.now(), stats = readStats()) {
    if (!canUseManaHeal(now, stats)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.manaHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastManaAttemptAt = now;
      state.pendingManaAttempt = {
        attemptedAt: now,
        slot,
        hpBefore: Number(stats.hp?.current ?? 0),
        manaBefore: Number(stats.mana?.current ?? 0),
      };
      bot.log("pressed mana heal hotkey", { slot, minMana: config.minMana });
    }

    return clicked;
  }

  function tryHeal() {
    if (!config.enabled) {
      return false;
    }

    const now = Date.now();
    const stats = readStats();

    resolvePendingAttempts(stats, now);

    if (hasPendingAttempt()) {
      return false;
    }

    if (triggerHpHeal(now, stats)) {
      return true;
    }

    return triggerManaHeal(now, stats);
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
      tryHeal();
    } catch (error) {
      bot.log("auto heal tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    persistConfig();

    if (state.running) {
      bot.log("auto heal already running");
      return false;
    }

    state.running = true;
    bot.log("auto heal started", { ...config });
    tick();
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
    bot.log("auto heal stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      stats: readStats(),
      lastHpHealAt: state.lastHpHealAt,
      lastManaHealAt: state.lastManaHealAt,
      lastHpAttemptAt: state.lastHpAttemptAt,
      lastManaAttemptAt: state.lastManaAttemptAt,
      pendingHpAttempt: state.pendingHpAttempt ? { ...state.pendingHpAttempt } : null,
      pendingManaAttempt: state.pendingManaAttempt ? { ...state.pendingManaAttempt } : null,
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "hpHotbarSlot")) {
      nextConfig.hpHotbarSlot = normalizeHotbarSlot(nextConfig.hpHotbarSlot) ?? config.hpHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "manaHotbarSlot")) {
      nextConfig.manaHotbarSlot = normalizeHotbarSlot(nextConfig.manaHotbarSlot) ?? config.manaHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "minHp")) {
      nextConfig.minHp = Math.max(0, Number(nextConfig.minHp) || 0);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "minMana")) {
      nextConfig.minMana = Math.max(0, Number(nextConfig.minMana) || 0);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "healRetryMs")) {
      nextConfig.healRetryMs = Math.max(minFailedRetryMs, Number(nextConfig.healRetryMs) || minFailedRetryMs);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "healConfirmMs")) {
      nextConfig.healConfirmMs = Math.max(500, Number(nextConfig.healConfirmMs) || 500);
    }

    Object.assign(config, nextConfig);
    config.hpEnabled = config.hpEnabled !== false;
    config.manaEnabled = config.manaEnabled !== false;
    persistConfig();
    bot.log("auto heal config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.heal = {
    start,
    stop,
    status,
    updateConfig,
    readStats,
    tryHeal,
    canUseHpHeal,
    canUseManaHeal,
    triggerHpHeal,
    triggerManaHeal,
    normalizeHotbarSlot,
    config,
  };
};
