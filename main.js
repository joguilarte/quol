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
    currentBundle.installSafeNavigationModule(bot);
    currentBundle.installAutoAttackModule(bot);
    currentBundle.installCaveModule(bot);
    currentBundle.installEquipRingModule(bot);
    currentBundle.installAutoEatModule(bot);
    currentBundle.installTalkModule(bot);
    currentBundle.installFloorMoveModule(bot);
    currentBundle.installCorpseLootModule(bot);
    currentBundle.installAutoSellModule(bot);
    currentBundle.installPanel(bot);

    // Reversible emergency latch. Snapshot exists only in this running tab:
    // reloading must NEVER silently re-enable stopped automation.
    let emergencySnapshot = null;
    const resumableModules = ["heal", "rune", "eat", "invisible", "magicShield",
      "equipRing", "talk", "floorMove", "corpseLoot", "attack", "cave", "panic"];
    bot.emergencyState = () => ({halted:!!bot.storage.get('minibiaBot.emergencyStop',false),
      canResume:emergencySnapshot!==null,
      previous: emergencySnapshot ? {...emergencySnapshot.modules} : null});
    bot.emergencyStop = function emergencyStop() {
      if (emergencySnapshot !== null) return false;
      const modules = {};
      for (const key of resumableModules) {
        try {modules[key]=bot[key]?.status?.()?.running === true;} catch (_) {modules[key]=false;}
      }
      emergencySnapshot = {
        modules,
        autoSellEnabled: bot.autoSell?.status?.()?.config?.enabled === true,
        overlayEnabled: bot.xray?.status?.()?.config?.overlayEnabled === true,
      };
      bot.storage.set('minibiaBot.emergencyStop',true);
      try {
        bot.autoSell?.updateConfig?.({enabled:false});bot.autoSell?.reset?.();
        bot.corpseLoot?.stop?.('Emergency stop');
        bot.cave?.stop?.();
        bot.attack?.stop?.();
        for (const key of ['rune','heal','eat','invisible','magicShield','equipRing','talk','floorMove','panic']) {
          try {bot[key]?.stop?.();} catch(error) {bot.log('emergency stop '+key,error?.message||error);}
        }
        bot.safeNavigation?.cancel?.('attack');bot.safeNavigation?.cancel?.('cave');
        bot.xray?.setOverlayEnabled?.(false);
        const client=window.gameClient;
        try {client?.interface?.fightModeSelector?.setChaseMode?.(0);} catch (_) {}
        try {client?.world?.pathfinder?.setPathfindCache?.(null);} catch (_) {}
        try {if(typeof StopWalkPacket==='function')client?.send?.(new StopWalkPacket());} catch (_) {}
        bot.log('EMERGENCY STOP: configuration saved for manual resume');
      } catch(error) {console.error('[minibia-bot] emergency stop failure',error);}
      return true;
    };
    bot.emergencyDismiss = function emergencyDismiss() {
      emergencySnapshot=null;
      bot.storage.set("minibiaBot.emergencyStop",false);
      return true;
    };
    bot.emergencyResume = function emergencyResume() {
      if (!emergencySnapshot) {
        bot.log('cannot resume: no snapshot in this session; use Quick Hunt');
        return false;
      }
      const saved=emergencySnapshot;
      // Cave last: restart defense/combat before restoring waypoint movement.
      const order=['heal','rune','eat','invisible','magicShield','equipRing',
        'talk','floorMove','corpseLoot','attack','panic','cave'];
      const failed=[];
      for(const key of order) {
        if(!saved.modules[key]) continue;
        try {
          if(bot[key]?.status?.()?.running===true) continue;
          if (key==='corpseLoot') bot.corpseLoot?.updateConfig?.({enabled:true});
          else if (bot[key]?.start?.()===false) {failed.push(key);continue;}
          if(bot[key]?.status?.()?.running!==true) failed.push(key);
        }catch(error){failed.push(key);bot.log('emergency resume '+key,error?.message||error);}
      }
      if(saved.autoSellEnabled) try {bot.autoSell?.updateConfig?.({enabled:true});} catch (_) {failed.push('autoSell');}
      if(saved.overlayEnabled) try {bot.xray?.setOverlayEnabled?.(true);} catch (_) {failed.push('xray');}
      if(failed.length) {
        bot.log('partial emergency restore; retry or check modules',failed);
        return false;
      }
      emergencySnapshot=null;
      bot.storage.set('minibiaBot.emergencyStop',false);
      bot.log('EMERGENCY RESUME: previously running modules restored');
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
      emergency: bot.emergencyState(),
      navigation: bot.safeNavigation.status(),
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
