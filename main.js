(() => {
  const bundle = window.__minibiaBotBundle || window.__minibiaBotReloadBundle || {};
  const persistedEnabledModules = [
    ["rune", "minibiaBot.rune.config"],
    ["heal", "minibiaBot.heal.config"],
    ["invisible", "minibiaBot.invisible.config"],
    ["magicShield", "minibiaBot.magicShield.config"],
    ["attack", "minibiaBot.attack.config"],
    ["cave", "minibiaBot.cave.config"],
    ["equipRing", "minibiaBot.equipRing.config"],
    ["eat", "minibiaBot.eat.config"],
    ["talk", "minibiaBot.talk.config"],
  ];

  function getPersistedEnabledSnapshot(bot) {
    const snapshot = {};
    const status = typeof bot?.status === "function" ? bot.status() : null;

    persistedEnabledModules.forEach(([moduleName]) => {
      const enabled = status?.[moduleName]?.config?.enabled;
      if (typeof enabled === "boolean") {
        snapshot[moduleName] = enabled;
      }
    });

    return snapshot;
  }

  function restorePersistedEnabledSnapshot(snapshot) {
    persistedEnabledModules.forEach(([moduleName, storageKey]) => {
      if (typeof snapshot?.[moduleName] !== "boolean") {
        return;
      }

      try {
        const rawValue = window.localStorage.getItem(storageKey);
        const config = rawValue ? JSON.parse(rawValue) : {};
        config.enabled = snapshot[moduleName];
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      } catch (error) {
        console.error("[minibia-bot] failed to restore persisted enabled state", {
          module: moduleName,
          error,
        });
      }
    });
  }

  function boot(currentBundle = bundle) {
    const previousEnabledSnapshot = getPersistedEnabledSnapshot(window.minibiaBot);

    if (window.minibiaBot?.destroy) {
      window.minibiaBot.destroy();
    }

    restorePersistedEnabledSnapshot(previousEnabledSnapshot);

    const bot = currentBundle.createBot();

    currentBundle.installPzModule(bot);
    currentBundle.installXrayModule(bot);
    currentBundle.installPanicModule(bot);
    currentBundle.installRuneModule(bot);
    currentBundle.installHealModule(bot);
    currentBundle.installAutoInvisibleModule(bot);
    currentBundle.installAutoMagicShieldModule(bot);
    currentBundle.installAutoAttackModule(bot);
    currentBundle.installCaveModule(bot);
    currentBundle.installEquipRingModule(bot);
    currentBundle.installAutoEatModule(bot);
    currentBundle.installTalkModule(bot);
    currentBundle.installFloorMoveModule(bot);
    currentBundle.installCorpseLootModule(bot);
    currentBundle.installAutoSellModule(bot);
    currentBundle.installPanel(bot);

    // Emergency stop: never restarts itself or clears recorded waypoints.
    // Cave must stop first: stopping an active seller trip may restart attack.
    bot.emergencyStop = function emergencyStop() {
      try {
        bot.storage.set("minibiaBot.emergencyStop", true);
        bot.autoSell?.updateConfig?.({enabled:false});
        bot.autoSell?.reset?.();
        bot.corpseLoot?.stop?.("Emergency stop");
        bot.cave?.stop?.();
        bot.attack?.stop?.();
        for (const key of ["rune", "heal", "eat", "invisible", "magicShield", "equipRing", "talk", "floorMove"]) {
          try { bot[key]?.stop?.(); } catch(error) { bot.log("emergency stop " + key, error?.message || error); }
        }
        bot.panic?.stop?.();
        bot.xray?.setOverlayEnabled?.(false);
        const client = window.gameClient;
        // Emergency only: clear even native chase, unlike the normal STOP HUNT.
        try { client?.interface?.fightModeSelector?.setChaseMode?.(0); } catch(e) { /* no native chase on this client */ }
        try { client?.world?.pathfinder?.setPathfindCache?.(null); } catch(e) { /* no walk cache */ }
        try { if (typeof StopWalkPacket === "function") client?.send?.(new StopWalkPacket()); } catch(e) { /* no stop packet */ }
        bot.log("EMERGENCY STOP engaged: all bot automation halted");
      } catch (error) {
        console.error("[minibia-bot] emergency stop failure", error);
      }
      return true;
    };
    bot.ui.inject();

    bot.start = (...args) => bot.rune.start(...args);
    bot.stop = (...args) => bot.rune.stop(...args);
    bot.reload = () => window.minibiaBotReload?.();
    bot.status = () => ({
      version: bot.version,
      pz: {
        home: bot.pz.getHomePz(),
      },
      xray: bot.xray.status(),
      panic: bot.panic.status(),
      rune: bot.rune.status(),
      heal: bot.heal.status(),
      invisible: bot.invisible.status(),
      magicShield: bot.magicShield.status(),
      attack: bot.attack.status(),
      cave: bot.cave.status(),
      equipRing: bot.equipRing.status(),
      eat: bot.eat.status(),
      talk: bot.talk.status(),
      floorMove: bot.floorMove.status(),
      corpseLoot: bot.corpseLoot.status(),
      autoSell: bot.autoSell.status(),
    });

    window.minibiaBot = bot;
    window.pzBot = bot.pz;

    console.log("[minibia-bot] ready", {
      version: bot.version,
      modules: ["pz", "xray", "panic", "rune", "heal", "invisible", "magicShield", "attack", "cave", "equipRing", "eat", "talk", "floorMove", "corpseLoot", "autoSell", "ui"],
    });
    console.log("minibiaBot.reload()");
    console.log("minibiaBot.xray.status()");
    console.log("minibiaBot.panic.status()");
    console.log("minibiaBot.pz.goToNearestPz()");
    console.log("minibiaBot.pz.setHomePzCurrentSpot()");
    console.log("minibiaBot.pz.goToHomePz()");
    console.log("minibiaBot.rune.start()");
    console.log("minibiaBot.rune.stop()");
    console.log("minibiaBot.heal.start()");
    console.log("minibiaBot.heal.stop()");
    console.log("minibiaBot.invisible.start()");
    console.log("minibiaBot.invisible.stop()");
    console.log("minibiaBot.magicShield.start()");
    console.log("minibiaBot.magicShield.stop()");
    console.log("minibiaBot.attack.start()");
    console.log("minibiaBot.attack.stop()");
    console.log("minibiaBot.cave.addWaypointCurrentSpot()");
    console.log("minibiaBot.cave.start()");
    console.log("minibiaBot.cave.stop()");
    console.log("minibiaBot.equipRing.start()");
    console.log("minibiaBot.equipRing.stop()");
    console.log("minibiaBot.eat.start()");
    console.log("minibiaBot.eat.stop()");
    console.log("minibiaBot.talk.updateConfig({ apiKey: \"...\" })");
    console.log("minibiaBot.talk.start()");
    console.log("minibiaBot.floorMove.scanNearby()");
    console.log("minibiaBot.talk.stop()");
    return bot;
  }

  window.__minibiaBotReloadBundle = bundle;
  window.minibiaBotReload = () => boot(window.__minibiaBotReloadBundle || bundle);
  delete window.__minibiaBotBundle;
  boot(bundle);
})();
