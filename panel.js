window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installPanel = function installPanel(bot) {
  const panelPositionKey = "minibiaBot.ui.panelPosition";
  const panelCollapsedKey = "minibiaBot.ui.panelCollapsed";
  const panelSizeKey = "minibiaBot.ui.panelSize";
  const emergencyPositionKey = "minibiaBot.ui.emergencyPosition";

  function destroy() {
    document.getElementById("minibia-bot-panel")?.remove();
    document.getElementById("minibia-bot-style")?.remove();
    document.getElementById("minibia-bot-emergency-stop")?.remove();
  }

  function savePanelPosition(position, key = panelPositionKey) {
    bot.storage.set(key, position);
  }

  function getSavedPanelPosition(key = panelPositionKey) {
    return bot.storage.get(key, null);
  }

  function savePanelCollapsed(collapsed) {
    bot.storage.set(panelCollapsedKey, !!collapsed);
  }

  function getSavedPanelCollapsed() {
    return !!bot.storage.get(panelCollapsedKey, false);
  }

  function refreshHomeLabel() {
    const homeLabel = document.getElementById("minibia-bot-home");
    if (!homeLabel) return;

    const home = bot.pz?.getHomePz?.();
    homeLabel.textContent = home
      ? `Panic Runner Home: ${home.x}, ${home.y}, ${home.z}`
      : "Panic Runner Home: not set";
  }

  function refreshPanicStatus() {
    const unknownToggle = document.getElementById("minibia-bot-panic-unknown");
    const unknownAlarmToggle = document.getElementById("minibia-bot-panic-unknown-alarm");
    const smartChatToggle = document.getElementById("minibia-bot-panic-smart-chat");
    const healthToggle = document.getElementById("minibia-bot-panic-health");
    const returnToggle = document.getElementById("minibia-bot-panic-return");
    const status = bot.panic?.status?.();

    if (unknownToggle) {
      unknownToggle.checked = !!status?.config?.unknownPlayerEnabled;
    }
    if (unknownAlarmToggle) {
      unknownAlarmToggle.checked = !!status?.config?.unknownPlayerSoundAlertEnabled;
    }
    if (smartChatToggle) smartChatToggle.checked = !!status?.config?.smartChatAlertEnabled;

    if (healthToggle) {
      healthToggle.checked = !!status?.config?.healthLossEnabled;
    }

    if (returnToggle) {
      returnToggle.checked = !!status?.config?.returnToOriginEnabled;
    }
  }

  function refreshXrayStatus() {
    const status = bot.xray?.status?.();
    const me = bot.getPlayerPosition?.();
    const overlayButton = document.getElementById("minibia-bot-xray-overlay-toggle");
    const overlayLabel = document.getElementById("minibia-bot-xray-overlay-status");
    const floorSelect = document.getElementById("minibia-bot-xray-floor-select");
    const formatFloorOffset = (floor) => {
      if (!me || floor == null) {
        return null;
      }

      const offset = me.z - floor;
      return offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`;
    };

    if (overlayButton) {
      overlayButton.textContent = status?.config?.overlayEnabled ? "Disable Overlay" : "Enable Overlay";
    }

    if (overlayLabel) {
      const floorLabel = status?.config?.selectedFloor == null
        ? "all floors"
        : `${formatFloorOffset(status.config.selectedFloor) ?? "?"}`;
      overlayLabel.textContent = `${status?.config?.overlayEnabled ? "Overlay: on" : "Overlay: off"} • ${floorLabel}`;
    }

    if (floorSelect) {
      const floors = Array.from(
        new Set(
          (status?.visibleCreatures || [])
            .map((creature) => creature?.position?.z)
            .filter((floor) => floor != null)
        )
      ).sort((a, b) => a - b);
      const selectedFloor = status?.config?.selectedFloor;

      if (selectedFloor != null && !floors.includes(selectedFloor)) {
        floors.push(selectedFloor);
        floors.sort((a, b) => a - b);
      }

      floorSelect.innerHTML = "";

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "All floors";
      floorSelect.appendChild(allOption);

      floors.forEach((floor) => {
        const option = document.createElement("option");
        option.value = String(floor);
        const offsetLabel = formatFloorOffset(floor);
        option.textContent = offsetLabel == null
          ? String(floor)
          : offsetLabel;
        floorSelect.appendChild(option);
      });

      floorSelect.value = selectedFloor == null ? "all" : String(selectedFloor);
    }
  }

  function renderTrustedNames() {
    const list = document.getElementById("minibia-bot-panic-trusted-list");
    if (!list) return;

    const trustedNames = bot.panic?.config?.trustedNames || [];
    list.innerHTML = "";

    if (!trustedNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "No trusted names saved.";
      list.appendChild(empty);
      return;
    }

    trustedNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = trustedNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ trustedNames: nextNames });
        renderTrustedNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function renderGameMasterNames() {
    const list = document.getElementById("minibia-bot-panic-gm-list");
    if (!list) return;

    const gameMasterNames = bot.panic?.config?.gameMasterNames || [];
    list.innerHTML = "";

    if (!gameMasterNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "No game master names saved.";
      list.appendChild(empty);
      return;
    }

    gameMasterNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = gameMasterNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ gameMasterNames: nextNames });
        renderGameMasterNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function refreshRuneStatus() {
    const runeToggle = document.getElementById("minibia-bot-rune-enabled");
    const running = !!bot.rune?.status?.().running;

    if (runeToggle) {
      runeToggle.checked = running;
    }
  }

  function refreshAutoEatStatus() {
    const autoEatToggle = document.getElementById("minibia-bot-auto-eat-enabled");
    if (!autoEatToggle) return;

    autoEatToggle.checked = !!bot.eat?.status?.().running;
  }

  function refreshAutoHealStatus() {
    const autoHealToggle = document.getElementById("minibia-bot-auto-heal-enabled");
    if (!autoHealToggle) return;

    autoHealToggle.checked = !!bot.heal?.status?.().running;
  }

  function refreshAutoInvisibleStatus() {
    const autoInvisibleToggle = document.getElementById("minibia-bot-auto-invisible-enabled");
    if (!autoInvisibleToggle) return;

    autoInvisibleToggle.checked = !!bot.invisible?.status?.().running;
  }

  function refreshAutoMagicShieldStatus() {
    const autoMagicShieldToggle = document.getElementById("minibia-bot-auto-magic-shield-enabled");
    if (!autoMagicShieldToggle) return;

    autoMagicShieldToggle.checked = !!bot.magicShield?.status?.().running;
  }

  function refreshAutoAttackStatus() {
    const autoAttackToggle = document.getElementById("minibia-bot-auto-attack-enabled");
    if (!autoAttackToggle) return;

    autoAttackToggle.checked = !!bot.attack?.status?.().running;
  }

  function refreshCaveStatus() {
    const statusLabel = document.getElementById("minibia-bot-cave-status");
    const startButton = document.getElementById("minibia-bot-cave-start");
    const stopButton = document.getElementById("minibia-bot-cave-stop");
    const route = bot.cave?.getRoute?.() || [];
    const status = bot.cave?.status?.();

    if (statusLabel) {
      if (status?.sellerTrip?.phase === "waiting-at-seller") {
        statusLabel.textContent = "At seller — sell manually; press Confirm Sale & Return";
      } else if (status?.sellerTrip) {
        statusLabel.textContent = `${status.sellerTrip.kind==='home'?'HOME travel':'Seller trip'}: ${status.sellerTrip.phase} (${status.sellerTrip.index + 1})`;
      } else if (!route.length) {
        statusLabel.textContent = "Status: no waypoints";
      } else if (status?.moderatorPaused) {
        statusLabel.textContent = `GM chat ALARM: ${Math.ceil(status.moderatorPauseRemainingMs/1000)}s — movement stopped, attack stationary, Heal active`;
      } else if (status?.pausedForVerification) {
        statusLabel.textContent = `CAPTCHA ALERT ${status.verificationLastPhase||''}: no movement/chase; stationary attack and Heal stay on. Restore manually after challenge.`;
      } else if (status?.running) {
        const waypointNumber = (status.currentIndex ?? 0) + 1;
        const distanceLabel =
          Number.isFinite(status?.distanceToWaypoint) && status.distanceToWaypoint >= 0
            ? `, dist ${status.distanceToWaypoint}`
            : "";
        statusLabel.textContent = `Status: running (${waypointNumber}/${route.length}${distanceLabel})`;
      } else {
        statusLabel.textContent = `Status: idle (${route.length} waypoint${route.length === 1 ? "" : "s"})`;
      }
    }

    if (startButton) {
      startButton.disabled = !route.length || !!status?.running;
    }

    if (stopButton) {
      stopButton.disabled = !status?.running;
    }
  }

  function refreshCavePresetControls() {
    const select = document.getElementById("minibia-bot-cave-preset-select");
    const label = document.getElementById("minibia-bot-cave-preset-status");
    const deleteButton = document.getElementById("minibia-bot-cave-preset-delete");
    const status = bot.cave?.status?.();
    const presetNames = status?.presetNames || bot.cave?.getPresetNames?.() || [];
    const activePresetName = status?.activePresetName || bot.cave?.getActivePresetName?.() || "Default";

    if (select) {
      const previousValue = select.value;
      select.innerHTML = "";

      if (!presetNames.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No saved presets";
        select.appendChild(option);
        select.disabled = true;
      } else {
        presetNames.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
        select.disabled = false;
        const nextValue = presetNames.includes(activePresetName) ? activePresetName : previousValue;
        if (nextValue) {
          select.value = nextValue;
        }
      }
    }

    if (label) {
      label.textContent = presetNames.length
        ? `Preset: ${activePresetName} (${presetNames.length} saved)`
        : `Preset: ${activePresetName}`;
    }

    if (deleteButton) {
      deleteButton.disabled = !presetNames.length || !select?.value;
    }
  }

  function refreshCaveClosestStatus() {
    const label = document.getElementById("minibia-bot-cave-closest");
    if (!label) return;

    const position = bot.getPlayerPosition?.();
    const route = bot.cave?.getRoute?.() || [];

    if (!position) {
      label.textContent = "Closest start: current position unavailable";
      return;
    }

    if (!route.length) {
      label.textContent = "Closest start: no waypoints";
      return;
    }

    const closestIndex = bot.cave?.findClosestWaypointIndex?.(position) ?? 0;
    const waypoint = route[closestIndex];

    if (!waypoint) {
      label.textContent = "Closest start: unavailable";
      return;
    }

    label.textContent = `Closest start: ${closestIndex + 1}. ${waypoint.x}, ${waypoint.y}, ${waypoint.z}`;
  }

  function refreshCaveTransitionStatus() {
    const label = document.getElementById("minibia-bot-cave-transition-status");
    if (!label) return;

    const transitions = bot.cave?.getTransitions?.() || [];
    if (!transitions.length) {
      label.textContent = "Transitions learned: none";
      return;
    }

    const latest = transitions
      .slice()
      .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))[0];

    if (!latest?.from || !latest?.to) {
      label.textContent = `Transitions learned: ${transitions.length}`;
      return;
    }

    const extra = transitions.length > 1 ? ` (+${transitions.length - 1} more)` : "";
    label.textContent =
      `Transitions learned: ${latest.from.x}, ${latest.from.y}, ${latest.from.z} -> ` +
      `${latest.to.x}, ${latest.to.y}, ${latest.to.z}${extra}`;
  }

  function refreshEquipRingStatus() {
    const equipRingToggle = document.getElementById("minibia-bot-equip-ring-enabled");
    if (!equipRingToggle) return;

    equipRingToggle.checked = !!bot.equipRing?.status?.().running;
  }

  function refreshTalkStatus() {
    const talkToggle = document.getElementById("minibia-bot-talk-enabled");
    const statusLabel = document.getElementById("minibia-bot-talk-status");
    const status = bot.talk?.status?.();

    if (talkToggle) {
      talkToggle.checked = !!status?.running;
    }

    if (statusLabel) {
      if (status?.lastGeminiFailureAt && Date.now()-status.lastGeminiFailureAt<45000) {
        statusLabel.textContent = `Last auto-reply failure: ${status.lastGeminiError} (alarm ${status.config.alarmOnGeminiFailure?'ON':'OFF'}; no modules changed)`;
      } else if (status?.config?.replyMode === "gemini" && !status?.config?.apiKey) {
        statusLabel.textContent = "Status: Gemini API key missing";
      } else if (status?.pending) {
        statusLabel.textContent = "Status: preparing reply";
      } else if (status?.running) {
        statusLabel.textContent = `Status: listening to Default (${status.config.replyMode})`;
      } else {
        statusLabel.textContent = "Status: idle";
      }
    }
  }

  function refreshVisibleCreatures() {
    const list = document.getElementById("minibia-bot-visible-creatures-list");
    if (!list) return;

    const me = bot.getPlayerPosition?.();
    const status = bot.xray?.status?.();
    const creatures = status?.visibleCreatures || [];
    const selectedFloor = status?.config?.selectedFloor;
    list.innerHTML = "";

    if (!me) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "Current position unavailable.";
      list.appendChild(empty);
      return;
    }

    const getFloorOffset = (creature) => (creature.position?.z || 0) - me.z;
    const getFloorDistance = (creature) => Math.abs(getFloorOffset(creature));

    const visibleCreatures = creatures
      .filter((creature) => {
        const floor = creature?.position?.z;
        if (floor == null) {
          return false;
        }

        if (selectedFloor != null) {
          return floor === selectedFloor;
        }

        return floor !== me.z;
      })
      .sort((a, b) => {
      const floorDistanceDiff = getFloorDistance(a) - getFloorDistance(b);
      if (floorDistanceDiff !== 0) return floorDistanceDiff;

      const floorOffsetDiff = getFloorOffset(a) - getFloorOffset(b);
      if (floorOffsetDiff !== 0) return floorOffsetDiff;

      const aDist = Math.abs((a.position?.x || 0) - me.x) + Math.abs((a.position?.y || 0) - me.y);
      const bDist = Math.abs((b.position?.x || 0) - me.x) + Math.abs((b.position?.y || 0) - me.y);
      return aDist - bDist;
    });

    if (!visibleCreatures.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = selectedFloor == null
        ? "No off-floor creatures."
        : `No creatures on floor ${selectedFloor}.`;
      list.appendChild(empty);
      return;
    }

    let currentFloor = null;

    visibleCreatures.forEach((creature) => {
      const floor = creature.position?.z;
      if (floor !== currentFloor) {
        currentFloor = floor;
        const floorOffset = me.z - floor;
        const floorOffsetLabel =
          floorOffset === 0 ? "0" : floorOffset > 0 ? `+${floorOffset}` : `${floorOffset}`;

        const floorLabel = document.createElement("div");
        floorLabel.className = "mb-floor-label";
        floorLabel.textContent = floorOffsetLabel;
        list.appendChild(floorLabel);
      }

      const row = document.createElement("div");
      row.className = "mb-creature-row";

      const name = document.createElement("div");
      name.className = "mb-creature-name";
      name.textContent = creature.name || (creature.type === 0 ? "Player" : "Mob");

      const meta = document.createElement("div");
      meta.className = "mb-small-note";
      meta.textContent = `${creature.type === 0 ? "Player" : "Mob"} at ${creature.position.x}, ${creature.position.y}, ${creature.position.z}`;

      row.appendChild(name);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function setPanelCollapsed(panel, collapsed) {
    if (!panel) return;

    const body = panel.querySelector(".mb-body");
    const toggle = panel.querySelector("#minibia-bot-collapse");
    const nextCollapsed = !!collapsed;

    panel.dataset.collapsed = nextCollapsed ? "true" : "false";

    if (body) {
      body.hidden = nextCollapsed;
    }

    if (toggle) {
      toggle.textContent = nextCollapsed ? "+" : "−";
      toggle.setAttribute("aria-label", nextCollapsed ? "Maximize panel" : "Minimize panel");
      toggle.setAttribute("title", nextCollapsed ? "Maximize" : "Minimize");
    }

    savePanelCollapsed(nextCollapsed);
  }

  function panelDimensionLimits() {
    return {
      maxWidth: Math.max(220, window.innerWidth - 24),
      maxHeight: Math.max(160, window.innerHeight - 24),
    };
  }

  function clampPanelSize(width, height) {
    const { maxWidth, maxHeight } = panelDimensionLimits();
    return {
      width: Math.max(Math.min(330, maxWidth), Math.min(Number(width) || 0, maxWidth)),
      height: Math.max(Math.min(240, maxHeight), Math.min(Number(height) || 0, maxHeight)),
    };
  }

  function applySavedPanelSize(panel) {
    const size = bot.storage.get(panelSizeKey, null);
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
    const fitted = clampPanelSize(size.width, size.height);
    panel.style.width = `${fitted.width}px`;
    panel.style.height = `${fitted.height}px`;
  }

  function enablePanelResize(panel) {
    const grip = panel.querySelector("#minibia-bot-resize");
    const reset = panel.querySelector("#minibia-bot-reset-size");
    if (!grip) return;
    let resizing = null;

    const onMove = (event) => {
      if (!resizing) return;
      const limits = panelDimensionLimits();
      const maxWidth = Math.min(limits.maxWidth, window.innerWidth - resizing.left - 8);
      const maxHeight = Math.min(limits.maxHeight, window.innerHeight - resizing.top - 8);
      const size = clampPanelSize(
        resizing.width + event.clientX - resizing.x,
        resizing.height + event.clientY - resizing.y
      );
      panel.style.width = `${Math.min(maxWidth, size.width)}px`;
      panel.style.height = `${Math.min(maxHeight, size.height)}px`;
    };
    const onUp = () => {
      if (!resizing) return;
      resizing = null;
      bot.storage.set(panelSizeKey, {
        width: panel.getBoundingClientRect().width,
        height: panel.getBoundingClientRect().height,
      });
    };

    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || panel.dataset.collapsed === "true") return;
      const rect = panel.getBoundingClientRect();
      // Switch from a right-anchored panel to absolute left/top for predictable resizing.
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = "auto";
      resizing = {
        x: event.clientX, y: event.clientY,
        left: rect.left, top: rect.top,
        width: rect.width, height: rect.height,
      };
      event.preventDefault();
      event.stopPropagation();
    });

    reset?.addEventListener("click", () => {
      const { maxWidth, maxHeight } = panelDimensionLimits();
      panel.style.width = `${Math.min(1180, maxWidth)}px`;
      panel.style.height = `${Math.min(790, maxHeight)}px`;
      panel.style.top = "12px";
      panel.style.left = "auto";
      panel.style.right = "12px";
      bot.storage.set(panelSizeKey, null);
      bot.storage.set(panelPositionKey, null);
      panel.querySelector(".mb-body")?.scrollTo({ top: 0 });
    });

    const onViewportResize = () => {
      if (panel.dataset.collapsed !== "true") {
        const { maxWidth, maxHeight } = panelDimensionLimits();
        if (panel.getBoundingClientRect().width > maxWidth) panel.style.width = `${maxWidth}px`;
        if (panel.getBoundingClientRect().height > maxHeight) panel.style.height = `${maxHeight}px`;
      }
      if (panel.style.left && panel.style.left !== "auto") {
        const rect = panel.getBoundingClientRect();
        const next = clampPanelPosition(panel, rect.left, rect.top);
        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", onViewportResize);
    bot.addCleanup(() => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onViewportResize);
    });
  }

  function applySavedPanelPosition(panel, key = panelPositionKey) {
    const position = getSavedPanelPosition(key);
    if (!position) return;

    if (typeof position.top === "number") {
      panel.style.top = `${position.top}px`;
    }

    if (typeof position.left === "number") {
      panel.style.left = `${position.left}px`;
      panel.style.right = "auto";
    }
  }

  function clampPanelPosition(panel, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }

  function enableDrag(panel, key = panelPositionKey) {
    const handle = panel.querySelector(".mb-title");
    if (!handle) return;

    let dragState = null;

    const onMouseMove = (event) => {
      if (!dragState) return;

      const next = clampPanelPosition(
        panel,
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY
      );

      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = "auto";
    };

    const onMouseUp = () => {
      if (!dragState) return;

      dragState = null;
      const rect = panel.getBoundingClientRect();
      savePanelPosition({ left: rect.left, top: rect.top }, key);
    };

    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };

      event.preventDefault();
    });

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    bot.addCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });
  }

  function inject() {
    destroy();

    const style = document.createElement("style");
    style.id = "minibia-bot-style";
    style.textContent = `
      #minibia-bot-panel {
        position: fixed;
        z-index: 999999;
        box-sizing: border-box;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        min-width: min(330px, calc(100vw - 24px));
        min-height: min(240px, calc(100vh - 24px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        container-type: inline-size;
        padding: 12px;
        border: 1px solid rgba(224, 200, 148, 0.45);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(30, 23, 15, 0.95), rgba(15, 11, 8, 0.97));
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        color: #f1e2b8;
        font: 14px/1.45 Verdana, sans-serif;
        user-select: none;
      }

      #minibia-bot-panel {
        top: 12px;
        right: 12px;
        width: min(1180px, calc(100vw - 24px));
        height: min(790px, calc(100vh - 24px));
      }

      #minibia-bot-panel[data-collapsed="true"] {
        width: 220px !important;
        height: auto !important;
        min-height: 0;
      }

      #minibia-bot-panel .mb-title-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #minibia-bot-panel .mb-resize-handle {
        position: absolute;
        right: 3px;
        bottom: 3px;
        height: 22px;
        width: 22px;
        border-radius: 4px;
        cursor: nwse-resize;
        touch-action: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        color: #d3c49d;
        background: rgba(30, 23, 15, 0.92);
        z-index: 2;
      }
      #minibia-bot-panel[data-collapsed="true"] .mb-resize-handle,
      #minibia-bot-panel[data-collapsed="true"] #minibia-bot-reset-size {
        display: none;
      }

      #minibia-bot-panel .mb-title {
        margin: 0;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: move;
      }

      #minibia-bot-panel .mb-titlebar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 0 0 8px;
      }

      #minibia-bot-panel .mb-icon-button {
        width: 24px;
        min-width: 24px;
        padding: 2px 0;
        border-radius: 6px;
        font-weight: 700;
        line-height: 1;
      }

      #minibia-bot-panel[data-collapsed="true"] .mb-titlebar {
        margin-bottom: 0;
      }

      #minibia-bot-panel .mb-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(224,200,148,0.5) transparent;
        padding: 2px 10px 24px 0;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        align-items: start;
        align-content: start;
        gap: 16px;
      }
      #minibia-bot-panel .mb-body::-webkit-scrollbar { width: 9px; }
      #minibia-bot-panel .mb-body::-webkit-scrollbar-thumb {
        border-radius: 6px;
        background: rgba(224,200,148,0.45);
      }

      #minibia-bot-panel .mb-body[hidden] {
        display: none !important;
      }

      #minibia-bot-panel .mb-side-column,
      #minibia-bot-panel .mb-main-column,
      #minibia-bot-panel .mb-cave-column {
        min-width: 0;
        align-content: start;
        display: grid;
        gap: 10px;
      }

      #minibia-bot-panel .mb-section {
        padding-top: 10px;
        border-top: 1px solid rgba(224, 200, 148, 0.16);
      }

      #minibia-bot-panel .mb-column-section:first-child {
        padding-top: 0;
        border-top: 0;
      }

      #minibia-bot-panel .mb-label {
        margin: 0 0 8px;
        color: #d3c49d;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-actions {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel .mb-actions-inline-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      #minibia-bot-panel .mb-actions-inline-two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #minibia-bot-panel button {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: linear-gradient(180deg, #635133, #3f321f);
        color: #f7eccf;
        font: inherit;
        cursor: pointer;
      }

      #minibia-bot-panel button:hover {
        background: linear-gradient(180deg, #755f3d, #4f4028);
      }

      #minibia-bot-panel input,
      #minibia-bot-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: rgba(16, 12, 8, 0.88);
        color: #f7eccf;
        font: inherit;
      }

      #minibia-bot-panel textarea {
        min-height: 72px;
        resize: vertical;
      }

      #minibia-bot-panel .mb-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d3c49d;
      }

      #minibia-bot-panel .mb-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      #minibia-bot-panel .mb-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-compact {
        grid-template-columns: auto auto;
        justify-content: start;
      }

      #minibia-bot-panel .mb-row .mb-toggle {
        white-space: nowrap;
      }

      #minibia-bot-panel .mb-row input[type="text"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-three {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-three input[type="text"],
      #minibia-bot-panel .mb-row-three input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-five {
        display: grid;
        grid-template-columns: auto 82px 72px 82px 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-five input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #minibia-bot-panel .mb-field {
        display: grid;
        gap: 4px;
      }

      #minibia-bot-panel .mb-field-compact {
        width: 96px;
        justify-self: end;
      }

      #minibia-bot-panel .mb-field-label {
        color: #d3c49d;
        font-size: 12px;
      }

      #minibia-bot-panel .mb-stack {
        display: grid;
        gap: 8px;
      }

      #minibia-bot-panel .mb-inline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }

      #minibia-bot-panel .mb-list {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel .mb-list-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #d3c49d;
      }

      #minibia-bot-panel .mb-creature-row {
        padding: 6px 8px;
        border: 1px solid rgba(224, 200, 148, 0.14);
        border-radius: 8px;
        background: rgba(255, 244, 212, 0.04);
      }

      #minibia-bot-panel .mb-creature-name {
        color: #f7eccf;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-floor-label {
        margin-top: 4px;
        color: #e2cf9c;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      #minibia-bot-panel #minibia-bot-visible-creatures-list {
        max-height: 150px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel #minibia-bot-panic-trusted-list {
        max-height: 140px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel .mb-small-button {
        width: auto;
        padding: 4px 8px;
        border-radius: 6px;
      }

      #minibia-bot-panel .mb-small-note {
        color: #b7a67d;
        font-size: 12px;
      }

      #minibia-bot-panel .mb-note {
        margin-top: 8px;
        color: #b7a67d;
        font-size: 12px;
      }

      /* The layout follows the panel width, not the browser window width. */
      @container (max-width: 1060px) {
        #minibia-bot-panel .mb-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #minibia-bot-panel .mb-cave-column { grid-column: 1; grid-row: 1; }
        #minibia-bot-panel .mb-side-column { grid-column: 2; grid-row: 1; }
        #minibia-bot-panel .mb-main-column { grid-column: 1 / -1; grid-row: 2; }
      }
      @container (max-width: 850px) {
        #minibia-bot-panel .mb-body { display: flex; flex-direction: column; }
        #minibia-bot-panel .mb-body > div { width: 100%; }
        /* Quick Hunt is always first in the narrow flex layout. */
        #minibia-bot-panel .mb-quick-bar { order: -3; flex: 0 0 auto; }
        #minibia-bot-panel .mb-cave-column { order: -2; }
        #minibia-bot-panel .mb-side-column { order: -1; }
      }
      @media (max-width: 700px) {
        #minibia-bot-panel .mb-row-five {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    style.textContent += `
      #minibia-bot-panel .mb-quick-bar { grid-column: 1 / -1; grid-row: auto; padding: 12px; border: 1px solid #b09253; border-radius: 10px; background: rgba(73,55,31,.65); display:grid; gap:7px; }
      #minibia-bot-panel .mb-quick-bar .mb-quick-route { display:grid; gap:4px; }
      #minibia-bot-panel .mb-quick-routes { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px; }
      #minibia-bot-panel .mb-quick-routes select { min-width:0;width:100%; }
      #minibia-bot-panel .mb-quick-core { padding:7px 0; }
      #minibia-bot-panel .mb-quick-tools { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;align-items:start; }
      #minibia-bot-panel .mb-quick-group { min-width:0; border:1px solid rgba(224,200,148,.24);border-radius:7px;background:rgba(15,12,8,.22);padding:4px 8px; }
      #minibia-bot-panel .mb-quick-group > summary { cursor:pointer; padding:5px 1px; color:#e9d6a4; font-weight:700; }
      #minibia-bot-panel .mb-quick-group[open] { grid-column:1 / -1; }
      #minibia-bot-panel .mb-quick-group .mb-quick-settings { padding:8px 0; }
      #minibia-bot-panel .mb-quick-group-sub {font-size:11px;font-weight:400;color:#baab89;display:inline-block;margin-left:6px;}
      #minibia-bot-panel .mb-quick-group input[type=text],#minibia-bot-panel .mb-quick-group textarea { min-width:0;width:100%;box-sizing:border-box; }
      #minibia-bot-panel .mb-quick-inline-tools { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:end;padding:8px 0; }
      #minibia-bot-panel .mb-quick-inline-tools label {display:grid;gap:4px;min-width:0;}
      #minibia-bot-panel .mb-quick-inline-tools input {width:100%;min-width:0;box-sizing:border-box;}
      #minibia-bot-panel .mb-quick-inline-tools button {width:100%;}
      @container (max-width:600px) { #minibia-bot-panel .mb-quick-inline-tools {grid-template-columns:1fr;} }
      @container (max-width:780px) { #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr;} }
      @container (max-width:600px) { #minibia-bot-panel .mb-quick-tools {grid-template-columns:1fr;} }

      #minibia-bot-panel .mb-quick-head { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
      #minibia-bot-panel .mb-quick-hint { color:#cdb88c; font-size:12px; }
      #minibia-bot-panel .mb-quick-settings { display:flex; align-items:center; flex-wrap:wrap; gap:8px 20px; }
      #minibia-bot-panel .mb-quick-settings .mb-toggle { display:flex; align-items:center; gap:8px; white-space:normal; }
      #minibia-bot-panel .mb-quick-settings input[type=checkbox] { appearance:auto; width:17px; height:17px; min-width:17px; margin:0; accent-color:#d4ac58; }
      #minibia-bot-panel .mb-quick-actions { display:flex; flex-wrap:wrap; gap:8px; }
      #minibia-bot-panel .mb-quick-actions button { width:auto; min-width:128px; padding:7px 16px; font-weight:bold; }
      #minibia-bot-panel .mb-quick-summary { padding:6px 9px; background:rgba(13,10,7,.45); border-radius:6px; font-size:12px; color:#e5d5ac; }
      #minibia-bot-panel .mb-gemini-preview { white-space:pre-wrap; overflow-wrap:anywhere; padding:8px 10px; border-radius:6px; border:1px solid rgba(224,200,148,.2); background:rgba(15,12,8,.6); color:#e9d9b7; }
      #minibia-bot-panel .mb-gemini-preview[hidden] { display:none; }
      #minibia-bot-panel .mb-subfold { border:1px solid rgba(224,200,148,.16); border-radius:7px; padding:6px; margin:6px 0; }
      #minibia-bot-panel .mb-subfold > summary { cursor:pointer; color:#ddc58d; font-weight:600; padding:4px; }
      #minibia-bot-panel .mb-subfold[open] > summary { border-bottom:1px solid rgba(224,200,148,.12); margin-bottom:6px; }
      #minibia-bot-panel .mb-subfold > .mb-section { border-top:0; padding-top:6px; }
      #minibia-bot-panel .mb-monitor-intro { color:#b7a67d; font-size:12px; margin:0 3px 8px; }
      #minibia-bot-panel .mb-fold { min-width:0; border:1px solid rgba(224,200,148,.20); border-radius:8px; margin:0 0 7px; padding:7px; }
      #minibia-bot-panel .mb-fold summary { cursor:pointer; color:#e9d6a4; font-weight:700; padding:4px; }
      #minibia-bot-panel .mb-fold[open] summary { border-bottom:1px solid rgba(224,200,148,.18); margin-bottom:8px; }
      #minibia-bot-panel .mb-fold .mb-section { border:0; }
      /* V24 compact single-screen Quick Hunt: all toggles are always visible. */
      #minibia-bot-panel .mb-quick-bar {
        padding:8px; gap:5px; border-radius:7px; align-content:start;
      }
      #minibia-bot-panel .mb-quick-head {flex-wrap:nowrap;}
      #minibia-bot-panel .mb-quick-advanced-btn {
        width:auto; min-width:0; padding:4px 9px; font-size:11px;
      }
      #minibia-bot-panel .mb-quick-routes {gap:5px;}
      #minibia-bot-panel .mb-quick-routes .mb-quick-route {gap:2px;font-size:11px;}
      #minibia-bot-panel .mb-quick-routes select {max-height:25px;font-size:11px;}
      #minibia-bot-panel .mb-quick-core {padding:3px 0;gap:5px 11px;}
      #minibia-bot-panel .mb-quick-settings {gap:4px 12px;}
      #minibia-bot-panel .mb-quick-settings .mb-toggle {gap:4px;white-space:nowrap;font-size:12px;}
      #minibia-bot-panel .mb-quick-settings input[type=checkbox] {
        width:14px;height:14px;min-width:14px;
      }
      #minibia-bot-panel .mb-quick-actions {gap:4px;align-items:center;}
      #minibia-bot-panel .mb-quick-actions button {
        min-width:0;width:auto;padding:5px 9px;font-size:11px;white-space:nowrap;
      }
      #minibia-bot-panel #minibia-bot-quick-start {background:#7a5f35;}
      #minibia-bot-panel .mb-quick-summary {
        padding:4px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-tools {display:flex;flex-direction:column;gap:2px;}
      #minibia-bot-panel .mb-quick-group {
        display:flex;align-items:center;flex-wrap:wrap;min-width:0;gap:3px 10px;
        padding:4px 6px;margin:0;border-radius:4px;background:rgba(15,12,8,.17);
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-category {
        color:#d9c291;flex:0 0 138px;font-size:11px;font-weight:bold;
      }
      #minibia-bot-panel .mb-quick-group > .mb-quick-settings {
        padding:0; flex:1 1 600px; display:flex; align-items:center; gap:4px 12px;
        flex-wrap:wrap;
      }
      #minibia-bot-panel .mb-quick-group > .mb-quick-settings label:not(.mb-toggle) {
        display:inline-flex;gap:4px;align-items:center;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group select {
        width:auto;min-width:80px;max-width:140px;height:23px;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group > .mb-quick-actions {gap:4px;}
      #minibia-bot-panel .mb-quick-group .mb-small-note {display:none;}
      #minibia-bot-panel .mb-quick-secondary {display:flex;}
      #minibia-bot-panel .mb-quick-group .mb-quick-training {
        display:flex!important;flex:1 1 520px;gap:5px!important;
        margin:0!important;align-items:center!important;flex-wrap:wrap!important;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training .mb-field {
        flex:0 0 auto!important;display:inline-flex;align-items:center;gap:4px;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training .mb-field-label {font-size:11px;}
      #minibia-bot-panel .mb-quick-group .mb-quick-training input[type=text] {
        width:110px;max-width:110px;height:23px;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training input[type=number] {
        width:52px;max-width:52px;height:23px;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-status,#minibia-bot-panel #minibia-bot-quick-status {
        font-size:11px;margin:0;
      }
      #minibia-bot-panel .mb-essential-ml {
        display:flex;align-items:center;gap:7px;flex-wrap:wrap;
        padding:5px 0;border-top:1px solid rgba(224,200,148,.17);
      }
      #minibia-bot-panel .mb-essential-ml > strong {font-size:11px;color:#d9bc86;white-space:nowrap;}
      #minibia-bot-panel .mb-essential-ml .mb-quick-training {
        display:flex!important;flex-wrap:wrap!important;align-items:center!important;
        gap:5px!important;margin:0!important;
      }
      #minibia-bot-panel .mb-essential-ml .mb-field {display:inline-flex;align-items:center;gap:4px;font-size:11px;flex:0 0 auto!important;min-width:0;}
      #minibia-bot-panel .mb-essential-ml .mb-field-label {font-size:11px;}
      #minibia-bot-panel .mb-essential-ml input[type=text] {width:110px;max-width:110px;height:23px;font-size:11px;}
      #minibia-bot-panel .mb-essential-ml input[type=number] {width:52px;max-width:52px;height:23px;font-size:11px;}
      /* Every control remains visible on the SAME panel: no hidden Advanced state. */
      @container (max-width:850px) {
        #minibia-bot-panel .mb-quick-group .mb-quick-category {flex-basis:105px;}
      }
      @container (max-width:540px) {
        #minibia-bot-panel .mb-quick-group .mb-quick-category {flex-basis:100%;}
        #minibia-bot-panel .mb-quick-group > .mb-quick-settings {flex-basis:100%;}
      }
      /* Flat V24 hub: essential row at top, all features in labeled, visible cards. */
      #minibia-bot-panel .mb-quick-bar {
        display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:10px;
      }
      #minibia-bot-panel .mb-quick-tools {
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
        align-items:stretch;
      }
      #minibia-bot-panel .mb-quick-group {
        display:flex; flex-direction:column; align-items:stretch; gap:6px;
        border:1px solid rgba(224,200,148,.24); padding:9px;
        background:rgba(14,12,9,.29); border-radius:7px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-category {
        flex:0 0 auto; display:block; width:auto; padding:0 0 5px;
        border-bottom:1px solid rgba(224,200,148,.22); color:#f0d89f;
        font-size:12px;letter-spacing:.02em;
      }
      #minibia-bot-panel .mb-quick-group > .mb-quick-settings { flex:0 0 auto; gap:7px 15px; }
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools {
        display:flex;flex-wrap:wrap;gap:6px;align-items:end;padding:2px 0;
      }
      #minibia-bot-panel .mb-quick-inline-tools label {flex:1 1 150px;max-width:240px;font-size:11px;}
      #minibia-bot-panel .mb-quick-inline-tools button {width:auto;padding:5px 8px;}
      #minibia-bot-panel .mb-quick-group .mb-quick-route {
        display:flex;align-items:center;gap:7px;font-size:11px;min-width:0;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-route input,
      #minibia-bot-panel .mb-quick-group .mb-quick-route textarea {
        width:min(100%,220px);max-width:220px;min-width:0;
        min-height:24px;max-height:54px;resize:vertical;
        box-sizing:border-box;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-route textarea {height:30px;}
      #minibia-bot-panel .mb-quick-group .mb-small-note {display:none;}
      #minibia-bot-panel .mb-quick-group #minibia-bot-quick-floor-status {display:block;font-size:10px;}
      #minibia-bot-panel .mb-quick-summary {white-space:normal;}
      #minibia-bot-panel .mb-flat-monitoring {grid-column:auto;display:grid;gap:8px;}
      #minibia-bot-panel .mb-flat-monitoring > .mb-label {font-weight:bold;}
      #minibia-bot-panel .mb-flat-section {border:1px solid rgba(224,200,148,.2);border-radius:6px;padding:6px;}
      #minibia-bot-panel .mb-flat-section > .mb-label {padding:5px;color:#e9d6a4;}
      #minibia-bot-panel .mb-main-column,
      #minibia-bot-panel .mb-side-column,
      #minibia-bot-panel .mb-cave-column {min-width:0;}
      #minibia-bot-panel .mb-body > .mb-main-column,
      #minibia-bot-panel .mb-body > .mb-side-column,
      #minibia-bot-panel .mb-body > .mb-cave-column {
        border-top:2px solid rgba(224,200,148,.27);padding-top:12px;
      }
      @container (max-width:900px) {
        #minibia-bot-panel .mb-quick-tools {grid-template-columns:1fr;}
      }
      @container (max-width:540px) {
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr;}
        #minibia-bot-panel .mb-quick-group .mb-quick-category {flex-basis:auto;}
      }
      /* V24 final layout fix: each section is only as high as its content.
         Earlier compact CSS set .mb-quick-training to flex-basis:520px,
         which became 520px of HEIGHT in the later column layout. */
      #minibia-bot-panel .mb-quick-bar {
        display:flex; flex-direction:column; align-items:stretch;
        justify-content:flex-start; align-content:normal;
        gap:7px; padding:10px;
        width:100%; min-width:0; height:auto; min-height:0;
      }
      #minibia-bot-panel .mb-quick-bar > * {min-width:0;flex:0 0 auto;}
      #minibia-bot-panel .mb-quick-head {
        display:flex; align-items:center; justify-content:space-between;
        gap:8px; flex-wrap:wrap; font-size:12px;
      }
      #minibia-bot-panel .mb-quick-routes {
        display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px; align-items:start;
      }
      #minibia-bot-panel .mb-quick-core {display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;padding:2px 0;}
      #minibia-bot-panel .mb-quick-tools {
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px; align-items:start!important; align-content:start;
        grid-auto-rows:max-content; min-height:0; height:auto;
      }
      #minibia-bot-panel .mb-quick-tools > .mb-quick-group {
        display:flex; flex-direction:column; justify-content:flex-start;
        align-items:stretch; align-self:start!important;
        flex:0 0 auto!important; height:auto!important; min-height:0!important;
        gap:6px; padding:8px 9px; margin:0; min-width:0;
        border:1px solid rgba(224,200,148,.28);
        background:rgba(15,12,8,.26);border-radius:6px;
      }
      #minibia-bot-panel .mb-quick-tools .mb-quick-group > * {
        flex:0 0 auto!important; min-height:0;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-category {
        flex:0 0 auto!important; display:block;
        padding:0 0 5px; margin:0 0 1px; border-bottom:1px solid rgba(224,200,148,.18);
        color:#e9d6a4; font-size:12px; line-height:1.3;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training {
        display:flex!important; flex:0 0 auto!important;
        flex-basis:auto!important; height:auto!important; min-height:0!important;
        align-items:center!important;justify-content:flex-start!important;
        gap:6px!important; margin:0!important; padding:0!important;
        flex-wrap:wrap!important;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training > * {flex:0 0 auto!important;min-width:0;}
      #minibia-bot-panel .mb-quick-group .mb-quick-training .mb-field {
        display:inline-flex!important; flex-direction:row!important; align-items:center!important;
        gap:4px!important; margin:0!important;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-training .mb-field-label {white-space:nowrap;}
      #minibia-bot-panel .mb-quick-group .mb-quick-settings {
        display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-start;
        flex:0 0 auto!important; min-height:0;
        padding:0; gap:5px 11px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools {
        display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;
        flex:0 0 auto!important; padding:0;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools label {
        display:inline-flex;flex:0 1 auto!important;align-items:center;gap:4px;
        max-width:none;font-size:11px;min-width:0;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools input {
        flex:0 1 110px; width:110px;max-width:130px;min-width:0;
        height:25px;padding:3px 6px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools button,
      #minibia-bot-panel .mb-quick-group .mb-quick-actions button {
        width:auto; min-width:0; flex:0 0 auto;
        font-size:11px; padding:5px 8px; line-height:1.3;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-route {
        display:flex;align-items:center;gap:8px;max-width:100%;
        flex:0 0 auto!important;font-size:11px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-route input,
      #minibia-bot-panel .mb-quick-group .mb-quick-route textarea {
        width:190px;max-width:min(100%,230px);height:26px;
        min-height:26px;max-height:42px;padding:3px 7px;
      }
      #minibia-bot-panel .mb-quick-group .mb-quick-route textarea {height:32px;}
      #minibia-bot-panel .mb-quick-group .mb-quick-settings .mb-toggle {font-size:11px;white-space:nowrap;}
      #minibia-bot-panel .mb-quick-group .mb-quick-actions {gap:5px;align-items:center;}
      #minibia-bot-panel .mb-quick-group .mb-small-note:not(#minibia-bot-quick-floor-status) {display:none;}
      #minibia-bot-panel #minibia-bot-quick-floor-status {font-size:10px;line-height:1.3;}
      #minibia-bot-panel .mb-quick-summary {
        white-space:normal;overflow:visible;text-overflow:clip;
        line-height:1.3;font-size:11px;
      }
      #minibia-bot-panel #minibia-bot-quick-start {font-weight:700;background:#795b30;}
      @container (max-width:850px) {
        #minibia-bot-panel .mb-quick-tools {grid-template-columns:1fr;}
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr;}
      }
      @container (max-width:540px) {
        #minibia-bot-panel .mb-quick-core .mb-toggle {white-space:normal;}
        #minibia-bot-panel .mb-quick-actions button {white-space:normal;}
      }
      /* Independent-height columns: no equal-height rows, no giant empty panels. */
      #minibia-bot-panel .mb-quick-tools {
        display:block!important;
        column-count:2;column-gap:9px;
        height:auto;min-height:0;
      }
      #minibia-bot-panel .mb-quick-tools > .mb-quick-group {
        break-inside:avoid;page-break-inside:avoid;
        width:100%;margin:0 0 9px!important;
      }
      @container (max-width:850px) {
        #minibia-bot-panel .mb-quick-tools {column-count:1;}
      }
      /* Compact emergency handle: always on top, independently draggable and keyboard accessible. */
      #minibia-bot-emergency-stop {
        box-sizing:border-box; position:fixed; bottom:16px; left:16px; width:44px; height:44px;
        padding:0; margin:0; z-index:2147483647; display:flex; align-items:center;
        justify-content:center; border:1px solid rgba(255,255,255,.65); border-radius:50%;
        background:#a82020; color:#fff; font:700 21px Verdana,sans-serif;
        box-shadow:0 2px 9px rgba(0,0,0,.64); opacity:.72; cursor:pointer;
        touch-action:none; user-select:none; -webkit-user-select:none; transition: opacity .12s, background .12s;
      }
      #minibia-bot-emergency-stop:hover, #minibia-bot-emergency-stop:focus-visible,
      #minibia-bot-emergency-stop[data-dragging="true"] { opacity:1; }
      #minibia-bot-emergency-stop:focus-visible { outline:2px solid #fff; outline-offset:2px; }
      #minibia-bot-emergency-stop[data-halted="true"] { background:#306a46; }
      #minibia-bot-emergency-stop[data-dragging="true"] { cursor:grabbing; transition:none; }
      #minibia-bot-panel #minibia-bot-auto-sell-items { min-height:58px; resize:vertical; }
      @container (max-width:1060px) { #minibia-bot-panel .mb-quick-bar { grid-column:1 / -1; grid-row: 1; }
        #minibia-bot-panel .mb-cave-column {grid-row:2;} #minibia-bot-panel .mb-side-column {grid-row:2;} #minibia-bot-panel .mb-main-column {grid-row:3;} }
    `;

    style.textContent += `
      /* Definitive single-window layout. The old grid row and CSS columns must not overlap. */
      #minibia-bot-panel .mb-body {display:flex!important;flex-direction:column!important;align-items:stretch!important;
        gap:12px!important;min-width:0!important;overflow-x:hidden!important;}
      #minibia-bot-panel .mb-body > .mb-quick-bar,
      #minibia-bot-panel .mb-body > .mb-advanced-columns {position:relative!important;grid-row:auto!important;
        grid-column:auto!important;order:0!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;}
      #minibia-bot-panel .mb-advanced-columns {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:12px!important;align-items:start!important;align-content:start!important;}
      #minibia-bot-panel .mb-advanced-columns > .mb-main-column,
      #minibia-bot-panel .mb-advanced-columns > .mb-side-column,
      #minibia-bot-panel .mb-advanced-columns > .mb-cave-column {grid-row:auto!important;grid-column:auto!important;
        order:0!important;align-self:start!important;position:static!important;min-width:0!important;width:auto!important;}
      #minibia-bot-panel .mb-quick-bar {display:flex!important;flex-direction:column!important;align-items:stretch!important;
        gap:9px!important;min-width:0!important;height:auto!important;}
      #minibia-bot-panel .mb-quick-routes {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;}
      #minibia-bot-panel .mb-quick-tools {display:block!important;column-count:2!important;
        column-gap:10px!important;height:auto!important;min-height:0!important;}
      #minibia-bot-panel .mb-quick-tools > .mb-quick-group {break-inside:avoid!important;
        display:flex!important;flex-direction:column!important;gap:6px!important;
        margin:0 0 10px!important;padding:8px!important;width:100%!important;height:auto!important;
        align-self:start!important;box-sizing:border-box!important;}
      #minibia-bot-panel .mb-quick-group .mb-quick-category {font-size:12px!important;line-height:1.4;}
      #minibia-bot-panel .mb-quick-group .mb-quick-settings {display:flex!important;flex-wrap:wrap!important;
        align-items:center!important;justify-content:flex-start!important;gap:6px 12px!important;}
      #minibia-bot-panel .mb-quick-core {gap:6px 12px!important;}
      #minibia-bot-panel .mb-quick-settings .mb-toggle {white-space:normal!important;line-height:1.3!important;}
      #minibia-bot-panel .mb-quick-tools textarea {max-height:68px!important;min-height:30px!important;resize:vertical;}
      #minibia-bot-panel .mb-gemini-compact-heading {border-top:1px solid rgba(224,200,148,.28);
        font-size:12px;font-weight:bold;padding:8px 0 0;margin-top:4px;color:#e9d6a4;}
      #minibia-bot-panel .mb-gemini-quick-config {padding:0!important;margin:0!important;border:0!important;min-width:0!important;}
      #minibia-bot-panel .mb-gemini-quick-config > .mb-stack {display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;align-items:start!important;}
      #minibia-bot-panel .mb-gemini-quick-config .mb-stack > * {min-width:0!important;}
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-ai-settings {grid-column:1 / -1;
        display:grid!important;grid-template-columns:minmax(150px,1fr) minmax(210px,2fr)!important;gap:8px!important;}
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-ai-settings input,
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-ai-settings textarea {width:100%!important;min-width:0!important;
        box-sizing:border-box!important;margin:0!important;}
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-prompt {height:50px!important;}
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-test-result,
      #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-status {grid-column:1 / -1;}
      #minibia-bot-panel .mb-gemini-quick-config .mb-field-grid {grid-template-columns:repeat(2,minmax(0,1fr));}
      #minibia-bot-panel .mb-quick-gemini-test {grid-column:1 / -1;display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:end!important;
        padding:6px!important;border:1px solid rgba(224,200,148,.20);border-radius:6px;}
      #minibia-bot-panel .mb-quick-gemini-test > .mb-label,
      #minibia-bot-panel .mb-quick-gemini-test > #minibia-bot-talk-test-result,
      #minibia-bot-panel .mb-quick-gemini-test > .mb-small-note {grid-column:1 / -1;}
      #minibia-bot-panel .mb-quick-gemini-test input {width:100%!important;min-width:0!important;}
      #minibia-bot-panel .mb-quick-gemini-test button {min-width:100px!important;}
      #minibia-bot-panel .mb-quick-tools label {min-width:0;}
      #minibia-bot-panel .mb-quick-actions button {min-width:0!important;}
      @container (max-width:1100px) {
        #minibia-bot-panel .mb-advanced-columns {grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      }
      @container (max-width:940px) {
        #minibia-bot-panel .mb-quick-tools {column-count:1!important;}
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr!important;}
      }
      @container (max-width:700px) {
        #minibia-bot-panel .mb-advanced-columns {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-gemini-quick-config > .mb-stack {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-gemini-quick-config #minibia-bot-talk-ai-settings {grid-template-columns:1fr!important;}
      }
      #minibia-bot-panel .mb-body[hidden] {display:none!important;}
    `;
    style.textContent += `
      #minibia-bot-panel .mb-body {display:flex!important;flex-direction:column!important;gap:0!important;min-width:0!important;overflow-x:hidden!important;}
      #minibia-bot-panel .mb-quick-bar {display:flex!important;flex-direction:column!important;gap:9px!important;
        width:100%!important;max-width:100%!important;box-sizing:border-box!important;align-items:stretch!important;height:auto!important;}
      #minibia-bot-panel #minibia-bot-wiring-dock {display:none!important;}
      #minibia-bot-panel .mb-quick-routes {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;}
      #minibia-bot-panel .mb-essential-heal {display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:7px!important;margin:1px 0 2px!important;}
      #minibia-bot-panel .mb-essential-heal label {font-size:11px!important;display:flex!important;gap:4px!important;align-items:center!important;min-width:0!important;}
      #minibia-bot-panel .mb-essential-heal input {width:100%!important;min-width:0!important;max-width:95px!important;box-sizing:border-box!important;}
      #minibia-bot-panel .mb-quick-tools {display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
        column-count:initial!important;gap:8px!important;align-items:start!important;height:auto!important;}
      #minibia-bot-panel .mb-quick-tools>.mb-quick-group {break-inside:auto!important;display:flex!important;
        flex-direction:column!important;gap:6px!important;height:auto!important;min-width:0!important;margin:0!important;align-self:start!important;}
      #minibia-bot-panel #minibia-bot-quick-group-alerts {grid-column:1/-1!important;}
      #minibia-bot-panel .mb-quick-group .mb-quick-inline-tools,
      #minibia-bot-panel .mb-quick-group .mb-quick-settings {display:flex!important;flex-wrap:wrap!important;
        align-items:center!important;justify-content:flex-start!important;gap:5px 10px!important;}
      #minibia-bot-panel .mb-quick-group .mb-quick-settings label.mb-toggle {white-space:normal!important;}
      #minibia-bot-panel .mb-quick-group textarea {height:53px!important;min-height:40px!important;max-height:90px!important;resize:vertical!important;}
      #minibia-bot-panel .mb-gemini-quick-config {margin-top:5px!important;width:100%!important;min-width:0!important;}
      #minibia-bot-panel .mb-gemini-quick-config>.mb-stack {display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
        align-items:start!important;gap:6px!important;}
      #minibia-bot-panel #minibia-bot-talk-ai-settings {grid-column:1/-1!important;display:grid!important;
        grid-template-columns:minmax(150px,1fr) minmax(210px,2fr)!important;gap:8px!important;}
      #minibia-bot-panel .mb-quick-gemini-test {grid-column:1/-1!important;}
      #minibia-bot-panel .mb-quick-monitor-lists {display:flex!important;flex-wrap:wrap!important;
        gap:7px!important;align-items:center!important;border-bottom:1px solid rgba(200,175,120,.2);padding:3px 0 6px!important;}
      #minibia-bot-panel .mb-quick-monitor-lists .mb-list {display:flex!important;flex-wrap:wrap!important;gap:4px!important;max-height:80px;overflow:auto;}
      #minibia-bot-panel .mb-quick-name-list {display:flex!important;gap:6px!important;align-items:center!important;}
      #minibia-bot-panel .mb-quick-name-list strong {font-size:11px!important;}
      #minibia-bot-panel .mb-quick-monitor-lists #minibia-bot-set-home {width:auto!important;min-width:120px!important;
        max-width:160px!important;flex:0 0 auto!important;padding:5px 12px!important;}
      #minibia-bot-panel .mb-quick-combat-extras {display:flex!important;flex-wrap:wrap!important;gap:10px!important;align-items:end!important;}
      #minibia-bot-panel .mb-quick-eat-key {min-width:130px!important;max-width:160px!important;}
      #minibia-bot-panel .mb-quick-xray {margin-top:7px!important;border-top:1px solid rgba(200,175,120,.3)!important;
        padding-top:6px!important;background:none!important;border-left:0!important;border-right:0!important;border-bottom:0!important;}
      #minibia-bot-panel #minibia-bot-visible-creatures-list {max-height:120px!important;overflow:auto!important;}
      #minibia-bot-panel .mb-quick-cave-dock {border:1px solid rgba(200,175,120,.45)!important;
        border-radius:7px!important;padding:9px!important;margin-top:6px!important;box-sizing:border-box!important;min-width:0!important;}
      #minibia-bot-panel .mb-main-cave-section {padding:0!important;margin:0!important;border:0!important;background:none!important;}
      #minibia-bot-panel .mb-main-cave-section>.mb-stack {display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px 13px!important;align-items:start!important;}
      #minibia-bot-panel .mb-main-cave-section>.mb-stack> * {min-width:0!important;align-self:start!important;margin:0!important;}
      #minibia-bot-panel .mb-main-cave-section .mb-cave-help {display:none!important;}
      #minibia-bot-panel .mb-main-cave-section textarea {max-height:100px!important;min-height:50px!important;resize:vertical!important;}
      #minibia-bot-panel .mb-cave-card {display:flex!important;flex-direction:column!important;
        justify-content:flex-start!important;align-items:stretch!important;gap:7px!important;
        min-width:0!important;margin:0!important;padding:9px!important;
        border:1px solid rgba(200,175,120,.23)!important;border-radius:6px!important;
        height:auto!important;break-inside:avoid!important;}
      #minibia-bot-panel .mb-cave-card>.mb-actions {display:flex!important;flex-wrap:wrap!important;gap:5px!important;}
      #minibia-bot-panel .mb-cave-card>.mb-field-grid {display:grid!important;grid-template-columns:1fr!important;}
      #minibia-bot-panel .mb-cave-card label {min-width:0!important;}
      #minibia-bot-panel .mb-quick-corpse {grid-column:auto!important;margin:0!important;}
      #minibia-bot-panel .mb-quick-cave-dock .mb-label {font-size:12px!important;font-weight:700!important;color:#e2ce9c!important;}
      #minibia-bot-panel .mb-quick-reload {margin-top:7px!important;max-width:160px!important;}
      #minibia-bot-panel .mb-main-cave-section .mb-actions {min-width:0!important;}
      #minibia-bot-panel .mb-main-cave-section .mb-field {min-width:0!important;}
      #minibia-bot-panel .mb-main-cave-section input,#minibia-bot-panel .mb-main-cave-section select {max-width:100%!important;box-sizing:border-box!important;}
      @container (max-width:800px) {
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-quick-tools {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-main-cave-section>.mb-stack {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-essential-heal {grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      }
      @container (max-width:570px) {
        #minibia-bot-panel #minibia-bot-talk-ai-settings {grid-template-columns:1fr!important;}
        #minibia-bot-panel .mb-gemini-quick-config>.mb-stack {grid-template-columns:1fr!important;}
      }
    `;
    // User-resizable width: never cap to 1120px. Reflow into independent
    // compact columns as the actual PANEL width changes, not viewport width.
    style.textContent += `
      #minibia-bot-panel:not([data-collapsed="true"]) {
        max-width: calc(100vw - 24px) !important;
      }
      #minibia-bot-panel .mb-quick-routes {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
      #minibia-bot-panel .mb-quick-tools {
        display: block !important;
        column-count: 2 !important;
        column-gap: 10px !important;
      }
      #minibia-bot-panel .mb-quick-tools > .mb-quick-group {
        width: 100% !important;
        break-inside: avoid !important;
        height: max-content !important;
        min-height: 0 !important;
      }
      #minibia-bot-panel .mb-main-cave-section > .mb-stack,
      #minibia-bot-panel .mb-advanced-columns { align-content: start !important; }
      #minibia-bot-panel .mb-cave-card { height: max-content !important; min-height:0 !important; }
      #minibia-bot-panel .mb-quick-actions { flex-wrap:wrap !important; }
      #minibia-bot-panel .mb-quick-group textarea { max-height:65px!important; }
      @container (max-width: 940px) {
        #minibia-bot-panel .mb-quick-tools {column-count:1!important;}
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr!important;}
      }
      @container (min-width: 1450px) {
        #minibia-bot-panel .mb-quick-tools {column-count:2!important;}
        #minibia-bot-panel .mb-main-cave-section > .mb-stack {
          grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        }
      }
    `;
    // Compact seller controls: full width at the top, never a stretched grid row.
    style.textContent += `
      #minibia-bot-panel .mb-essential-seller {display:flex!important;flex-direction:column!important;
        align-items:stretch!important;gap:5px!important;margin:7px 0!important;
        padding:9px 10px!important;border:1px solid rgba(200,175,120,.34)!important;
        border-radius:6px!important;min-height:0!important;height:auto!important;}
      #minibia-bot-panel .mb-essential-seller-toggles {display:flex!important;flex-wrap:wrap!important;
        gap:5px 15px!important;align-items:center!important;}
      #minibia-bot-panel .mb-essential-seller-fields {display:grid!important;
        grid-template-columns:minmax(145px,1fr) minmax(170px,2fr)!important;gap:8px!important;align-items:start!important;}
      #minibia-bot-panel .mb-essential-seller-fields label {display:flex!important;flex-direction:column!important;
        min-width:0!important;margin:0!important;gap:3px!important;font-size:11px!important;}
      #minibia-bot-panel .mb-essential-seller-fields input {width:100%!important;max-width:100%!important;
        box-sizing:border-box!important;height:27px!important;}
      #minibia-bot-panel .mb-essential-seller-actions {display:flex!important;flex-wrap:wrap!important;gap:7px!important;}
      #minibia-bot-panel .mb-essential-seller-status {display:flex!important;flex-wrap:wrap!important;
        column-gap:15px!important;row-gap:4px!important;font-size:11px!important;}
      #minibia-bot-panel .mb-essential-seller-status .mb-small-note {margin:0!important;}
      @container (max-width:610px) {
        #minibia-bot-panel .mb-essential-seller-fields {grid-template-columns:1fr!important;}
      }
    `;
    style.textContent += `
      /* Final: real adaptive columns based on panel width, not viewport width. */
      #minibia-bot-panel .mb-quick-tools {
        display:block!important;column-count:1!important;column-gap:10px!important;
      }
      #minibia-bot-panel .mb-quick-tools>.mb-quick-group {
        display:inline-block!important;vertical-align:top!important;width:100%!important;
        margin:0 0 9px!important;box-sizing:border-box!important;break-inside:avoid!important;
        height:auto!important;min-height:0!important;
      }
      #minibia-bot-panel .mb-quick-routes {grid-template-columns:1fr!important;}
      #minibia-bot-panel .mb-main-cave-section>.mb-stack {grid-template-columns:1fr!important;align-items:start!important;}
      @container (min-width:920px) {
        #minibia-bot-panel .mb-quick-tools {column-count:2!important;}
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:repeat(2,minmax(0,1fr))!important;}
        #minibia-bot-panel .mb-main-cave-section>.mb-stack {grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      }
      @container (min-width:1420px) {
        #minibia-bot-panel .mb-quick-tools {column-count:3!important;}
        #minibia-bot-panel .mb-quick-routes {grid-template-columns:repeat(3,minmax(0,1fr))!important;}
        #minibia-bot-panel .mb-main-cave-section>.mb-stack {grid-template-columns:repeat(3,minmax(0,1fr))!important;}
      }
      #minibia-bot-panel .mb-main-cave-section>.mb-stack>.mb-cave-card {height:auto!important;align-self:start!important;}
      #minibia-bot-panel .mb-quick-profiles {
        display:flex;flex-wrap:wrap;gap:7px;align-items:center;border:1px solid rgba(224,200,148,.24);
        border-radius:7px;padding:7px 9px;max-width:100%;box-sizing:border-box;
      }
      #minibia-bot-panel .mb-quick-profiles select {min-width:150px;max-width:240px;flex:1 1 150px;}
      #minibia-bot-panel .mb-quick-profiles button {width:auto!important;padding:5px 10px!important;}
      #minibia-bot-panel .mb-quick-profiles small {font-size:11px;color:#d6c18f;}
      #minibia-bot-emergency-stop {
        width:124px!important;height:44px!important;border-radius:14px!important;
        border:1px solid rgba(255,255,255,.55)!important;
        box-shadow:0 4px 16px rgba(0,0,0,.68)!important;
        font:700 12px Verdana,sans-serif!important;letter-spacing:.35px!important;
        opacity:.94!important;touch-action:none;
      }
      #minibia-bot-emergency-stop[data-mode='start'] {background:#276042!important;}
      #minibia-bot-emergency-stop[data-mode='resume'] {background:#276042!important;}
      #minibia-bot-emergency-stop[data-mode='stop'] {background:#a62525!important;}
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "minibia-bot-panel";
    panel.innerHTML = `
        <div class="mb-titlebar">
        <div class="mb-title">Minibia Bot</div>
        <div class="mb-title-actions">
          <button type="button" class="mb-icon-button" id="minibia-bot-reset-size" aria-label="Reset panel size" title="Reset panel size">⤢</button>
          <button type="button" class="mb-icon-button" id="minibia-bot-collapse" aria-label="Minimize panel" title="Minimize">−</button>
        </div>
      </div>
      <div class="mb-body">
        <div class="mb-main-column">
          <div class="mb-actions mb-column-section">
            <button type="button" id="minibia-bot-reload">Reload Bot</button>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label" id="minibia-bot-home">Panic Runner Home: not set</div>
            <div class="mb-stack">
              <button type="button" id="minibia-bot-set-home">Set Home</button>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-unknown" />
                <span>Unknown Player</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-unknown-alarm" />
                <span>Unknown player alarm (sound only; same floor)</span>
              </label>
              <div class="mb-small-note">Alerts on unfamiliar visible players, not monsters. Uses Trusted names; does not identify a hidden GM or stop any module.</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-panic-smart-chat" /><span>Chat alarm: ALL Default + PM (sound only)</span></label>
              <div class="mb-small-note">Alerts on any new Default or private chat from others, even when players talk to each other. Ignores your own messages, game spells and old history. Audio is limited to once every 3 seconds; does not alter hunt, attack or Gemini.</div>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-health" />
                <span>Lose Health</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-return" />
                <span>Auto Return</span>
              </label>
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-trusted-input" placeholder="Trusted name" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-trusted-add">Add</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-trusted-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">GM Kill Switch</div>
            <div class="mb-stack">
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-gm-input" placeholder="Game master name" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-gm-add">Add</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-gm-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-actions">
              <div class="mb-row-three">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-rune-enabled" />
                  <span>Magic Level Trainer</span>
                </label>
                <input type="text" id="minibia-bot-rune-spell" placeholder="Spell words" />
                <input type="number" id="minibia-bot-rune-mana" min="0" placeholder="Mana" />
                <label class="mb-field mb-field-compact"><span class="mb-field-label">Min interval (s)</span><input type="number" id="minibia-bot-rune-interval-min" min="1" max="3600" step="0.5" /></label>
                <label class="mb-field mb-field-compact"><span class="mb-field-label">Max interval (s)</span><input type="number" id="minibia-bot-rune-interval-max" min="1" max="3600" step="0.5" /></label>
              </div>
              <div class="mb-row mb-row-compact">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-eat-enabled" />
                  <span>Auto Eat</span>
                </label>
                <label class="mb-field mb-field-compact" for="minibia-bot-auto-eat-hotkey">
                  <span class="mb-field-label">Eat Hotkey (1-12)</span>
                  <input type="number" id="minibia-bot-auto-eat-hotkey" min="1" max="12" placeholder="10" />
                </label>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-invisible-enabled" />
                  <span>Auto Invisible</span>
                </label>
                <div class="mb-small-note">Casts utana vid whenever invisibility is not active.</div>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-magic-shield-enabled" />
                  <span>Auto Utamo Vita</span>
                </label>
                <div class="mb-small-note">Casts utamo vita whenever magic shield is not active.</div>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-equip-ring-enabled" />
                  <span>Equip Ring</span>
                </label>
                <div></div>
              </div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-note">Loaded routines: Panic Runner, magic level trainer, auto eat, auto invisible, auto utamo vita, equip ring, auto heal, auto attack, and talk.</div>
          </div>
        </div>
        <div class="mb-side-column">
          <div class="mb-section mb-column-section">
            <div class="mb-label">Xray</div>
            <button type="button" class="mb-small-button" id="minibia-bot-xray-overlay-toggle">Disable Overlay</button>
            <div class="mb-small-note" id="minibia-bot-xray-overlay-status">Overlay: on</div>
            <label class="mb-field" for="minibia-bot-xray-floor-select">
              <span class="mb-field-label">Floor Filter</span>
              <select id="minibia-bot-xray-floor-select">
                <option value="all">All floors</option>
              </select>
            </label>
            <div class="mb-list" id="minibia-bot-visible-creatures-list"></div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Auto Heal</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-auto-heal-enabled" />
                <span>Enable Auto Heal</span>
              </label>
              <div class="mb-field-grid">
                <label class="mb-field" for="minibia-bot-auto-heal-min-hp">
                  <span class="mb-field-label">Minimum HP</span>
                  <input type="number" id="minibia-bot-auto-heal-min-hp" min="0" placeholder="250" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-hp-hotkey">
                  <span class="mb-field-label">HP Hotkey (1-12)</span>
                  <input type="number" id="minibia-bot-auto-heal-hp-hotkey" min="1" max="12" placeholder="1" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-min-mana">
                  <span class="mb-field-label">Minimum Mana</span>
                  <input type="number" id="minibia-bot-auto-heal-min-mana" min="0" placeholder="150" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-mana-hotkey">
                  <span class="mb-field-label">Mana Hotkey (1-12)</span>
                  <input type="number" id="minibia-bot-auto-heal-mana-hotkey" min="1" max="12" placeholder="2" />
                </label>
              </div>
              <div class="mb-small-note">Checks about twenty times per second. HP is used before mana, and unregistered hotkey presses are retried quickly.</div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Talk</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-talk-enabled" />
                <span>Enable Auto Reply</span>
              </label>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-talk-gemini-alarm"/><span>Alarm on failed automatic Gemini reply (sound only)</span></label>
              <div class="mb-small-note">Sounds the usual alarm on API error, timeout, empty response or delivery failure. Does not stop or change any module; no alarm for filtered messages or preview tests. Up to once every 30 seconds.</div>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-talk-npc-replies" />
                <span>Reply to nearby NPCs (any name)</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-talk-private-replies" />
                <span>Reply to private messages (PM)</span>
              </label>
              <label class="mb-field" for="minibia-bot-talk-mode">
                <span class="mb-field-label">Response mode</span>
                <select id="minibia-bot-talk-mode">
                  <option value="gemini">Gemini (AI)</option>
                  <option value="rules">Keywords (no AI, no API key)</option>
                </select>
              </label>
              <div id="minibia-bot-talk-ai-settings" class="mb-stack">
                <input type="password" id="minibia-bot-talk-api-key" placeholder="Gemini API key" autocomplete="off" />
                <textarea id="minibia-bot-talk-prompt" placeholder="Reply style prompt"></textarea>
              </div>
              <label class="mb-field" for="minibia-bot-talk-rules">
                <span class="mb-field-label">Keyword replies: word1|word2 =&gt; response (one rule per line)</span>
                <textarea id="minibia-bot-talk-rules" rows="4" spellcheck="false" placeholder="hola|hello|hi => hola!&#10;ayuda|help => decime"></textarea>
              </label>
              <div class="mb-field-grid">
                <label class="mb-field" for="minibia-bot-talk-min-delay">
                  <span class="mb-field-label">Minimum delay (seconds)</span>
                  <input type="number" id="minibia-bot-talk-min-delay" min="0" max="30" step="0.5" value="4" />
                </label>
                <label class="mb-field" for="minibia-bot-talk-max-delay">
                  <span class="mb-field-label">Maximum delay (seconds)</span>
                  <input type="number" id="minibia-bot-talk-max-delay" min="0" max="30" step="0.5" value="8" />
                </label>
              </div>
              <div class="mb-label">Test a reply (preview only)</div>
              <label class="mb-field" for="minibia-bot-talk-test-message"><span class="mb-field-label">Simulated incoming message</span>
                <input type="text" id="minibia-bot-talk-test-message" value="hola, como va la hunt?" maxlength="240" /></label>
              <button type="button" class="mb-small-button" id="minibia-bot-talk-test">Test Gemini / Keywords</button>
              <div id="minibia-bot-talk-test-result" class="mb-gemini-preview" role="status" aria-live="polite" hidden></div>
              <div class="mb-small-note">Uses real Gemini API only in AI mode. Never sends the preview to game chat.</div>
              <div class="mb-small-note" id="minibia-bot-talk-status">Status: idle</div>
              <div class="mb-small-note">Default replies require nearby visible players. Private replies work from any distance when enabled and stay private. Keywords reply only on matching rules. Minimum 15 seconds between messages.</div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Move Floor Items</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-floor-move-enabled" />
                <span>Move matching floor items</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-floor-move-rares" />
                <span>Include Rare (from Minibia Auto Loot)</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-floor-move-walk" />
                <span>Walk to matching items visible on screen</span>
              </label>
              <div class="mb-small-note">Open Minibia's Loot List once per session to load the server-defined Rare items; otherwise this filter waits without moving anything.</div>
              <label class="mb-field" for="minibia-bot-floor-move-items">
                <span class="mb-field-label">Exact names / item IDs (comma separated)</span>
                <input type="text" id="minibia-bot-floor-move-items" placeholder="e.g. crystal coin, 3035" />
              </label>
              <button type="button" class="mb-small-button" id="minibia-bot-floor-move-scan">Scan visible tiles</button>
              <div class="mb-small-note" id="minibia-bot-floor-move-status">Off</div>
              <div class="mb-small-note">Scans on-screen tiles on the current floor. If walking is enabled, approaches safely and moves one matching item to a free adjacent tile; never picks it up. Combat takes precedence.</div>
              <div class="mb-label">Auto Loot Corpses (experimental)</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-corpse-loot-enabled"/><span>Auto Loot Corpses</span></label>
              <label class="mb-field"><span class="mb-field-label">Only these loot items (exact names or IDs)</span>
                <textarea id="minibia-bot-corpse-loot-items" rows="3" placeholder="plate shield, chain armor, brass armor"></textarea></label>
              <div class="mb-small-note">First enable Auto Open Corpse in Minibia. Equip a backpack. Moves whitelisted items ONLY from nearby recognized opened corpse windows (2 tiles). Does not yet open or walk to corpses. Default OFF.</div>
              <div class="mb-small-note" id="minibia-bot-corpse-loot-status">Auto Loot Corpses: off</div>
            </div>
          </div>
        </div>
        <div class="mb-cave-column">
          <div class="mb-section mb-column-section">
            <div class="mb-label">Cave Bot</div>
            <div class="mb-stack">
              <div class="mb-field-grid">
                <label class="mb-field" for="minibia-bot-cave-preset-select">
                  <select id="minibia-bot-cave-preset-select"></select>
                </label>
              </div>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-cave-preset-new">New</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-preset-delete">Delete</button>
              </div>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-cave-record">Record Spot</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-remove-last">Remove Last</button>
              </div>
              <label class="mb-field" for="minibia-bot-cave-route-mode">
                <span class="mb-field-label">Waypoint route mode</span>
                <select id="minibia-bot-cave-route-mode">
                  <option value="pingpong">Out &amp; back: 1 → 2 → 3 → 2 → 1</option>
                  <option value="loop">Circular: 1 → 2 → 3 → 1</option>
                </select>
              </label>
              <div class="mb-small-note">Out &amp; back uses the same recorded waypoints in reverse, without a return route. Entry waypoints (once) never repeat. Cross-floor return still needs a valid way back.</div>
              <div class="mb-small-note" id="minibia-bot-cave-closest">Closest start: no waypoints</div>
              <div class="mb-small-note" id="minibia-bot-cave-transition-status">Transitions learned: none</div>
              <label class="mb-field" for="minibia-bot-cave-entry-count">
                <span class="mb-field-label">Entry waypoints (once, then hunt loop)</span>
                <input type="number" id="minibia-bot-cave-entry-count" min="0" step="1" value="0" />
              </label>
              <div class="mb-small-note">Record the entry first (including one spot beside the shovel stone), then the hunt. Set how many initial waypoints are entry-only; keep at least 2 hunt waypoints. When already in the hunt area, the entry is skipped.</div>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-cave-prioritize-monsters" />
                <span>Prioritize Monsters</span>
              </label>
              <div class="mb-small-note">When Auto Attack is active, pause waypoints while monsters are in targeting range. Melee Mode is needed to approach distant targets.</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-cave-random-movement"/><span>Randomize Movement (hunt waypoints)</span></label>
              <div class="mb-small-note">Occasional safe one-tile lateral detours, max two extra steps. Never during combat or seller trips. Disabled when floor transitions are allowed. OFF by default.</div>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-cave-limit-chase" />
                <span>Limit Melee Chase to Route</span>
              </label>
              <label class="mb-field" for="minibia-bot-cave-max-chase">
                <span class="mb-field-label">Max distance from waypoint (tiles, 2-20)</span>
                <input type="number" id="minibia-bot-cave-max-chase" min="2" max="20" step="1" value="6" />
              </label>
              <div class="mb-small-note">Only with Cave Bot running and Melee Mode on. Stop chasing beyond the radius and resume waypoints. Add intermediate waypoints along long corridors.</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-cave-allow-floors"/><span>Allow intentional floor changes (OFF for single-floor hunts)</span></label>
              <div class="mb-small-note">Same-floor Cave navigation always validates every step locally. If OFF, a waypoint requiring another floor stops Cave Bot instead of crossing stairs. If ON, explicit cross-floor waypoints can still use learned transition actions.</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-cave-tools"/><span>Use shovel / rope on waypoint floor changes</span></label>
              <div class="mb-small-note">Only deliberate waypoint transitions; not melee pursuit.</div>
              <div class="mb-label">Seller Return (capacity)</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-seller-enabled"/><span>Return to seller on low capacity</span></label>
              <label class="mb-field" for="minibia-bot-seller-cap"><span class="mb-field-label">Free capacity threshold (oz)</span>
                <input id="minibia-bot-seller-cap" type="number" min="1" max="10000" value="50" /></label>
              <label class="mb-field" for="minibia-bot-seller-route"><span class="mb-field-label">Seller route (Shanar ↔ Hunt, either direction)</span>
                <select id="minibia-bot-seller-route"><option value="">Select a route</option></select></label>
              <label class="mb-field" for="minibia-bot-seller-return-route"><span class="mb-field-label">Return route (optional: NPC to hunt)</span>
                <select id="minibia-bot-seller-return-route"><option value="">Reverse seller route</option></select></label>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-seller-fight-outbound"/><span>Fight while going to seller</span></label>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-seller-fight-return"/><span>Fight while returning to hunt</span></label>
              <div class="mb-small-note">Escort combat is available only if Auto Attack was running when the trip started. Waypoints pause while fighting. Both options start OFF. Auto Heal remains independent.</div>
              <div class="mb-small-note">Seller route may be recorded Shanar → hunt OR hunt → Shanar. One endpoint must connect unambiguously within 6 tiles to a same-floor hunt waypoint. Direction is detected automatically. Record stairs and shovel/rope transitions in both directions when possible.</div>
              <div class="mb-label">Auto Sell (experimental; OFF by default)</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-auto-sell-enabled"/><span>Enable verified NPC sales</span></label>
              <label class="mb-field"><span class="mb-field-label">NPC name (exact)</span>
                <input id="minibia-bot-auto-sell-npc" type="text" placeholder="Shanar" /></label>
              <label class="mb-field"><span class="mb-field-label">Allowed item names (comma or newline separated)</span>
                <textarea id="minibia-bot-auto-sell-items" rows="3" placeholder="plate shield, chain armor, brass armor"></textarea></label>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-auto-sell-return"/><span>Return to hunt after verified sales</span></label>
              <button type="button" class="mb-small-button" id="minibia-bot-auto-sell-test">Sell now (at NPC) — experimental</button>
              <div class="mb-small-note">Only items inside OPEN backpacks are counted. Equipped items never sold. Server inventory change must be confirmed. If uncertain, stop at NPC for manual attention. Test one cheap item first.</div>
              <div class="mb-small-note" id="minibia-bot-auto-sell-status">Auto Sell: disabled</div>
              <div class="mb-label">Minibia Native Auto Loot (no corpse bot)</div>
              <label class="mb-field"><span class="mb-field-label">Items to loot (exact names, one per line)</span>
                <textarea id="minibia-bot-native-loot-names" rows="3" placeholder="Brass Helmet" spellcheck="false"></textarea></label>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-native-loot-open">Open /lootlist</button>
                <button type="button" class="mb-small-button" id="minibia-bot-native-loot-apply">Apply loot list</button>
              </div>
              <div class="mb-small-note" id="minibia-bot-native-loot-status">Open Minibia's Loot List, then Apply. Saving replaces the selected list (whitelist); no corpse scanning.</div>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-seller-confirm">Confirm Sale &amp; Return</button>
                <button type="button" class="mb-small-button" id="minibia-bot-seller-abort">Abort Trip</button>
              </div>
              <div class="mb-small-note" id="minibia-bot-seller-status">Seller return: off</div>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-cave-moderator-pause"/><span>Sound alarm + hold movement on moderator [GOD]/[GM] (30 seconds)</span></label>
              <div class="mb-small-note">On a new moderator message: alarm + pause ALL automated walking and chase for 30 seconds. Auto Attack continues stationary (only nearby reachable targets), Auto Heal stays active, then resume previous hunt. Old chat history ignored. Configured GM names also apply. OFF by default.</div>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-cave-verification-pause" />
                <span>Pause waypoints on anti-bot notice</span>
              </label>
              <label class="mb-toggle"><input type="checkbox" id="minibia-bot-cave-verification-auto-resume"/><span>Reanudar automáticamente al completar el CAPTCHA</span></label>
              <label class="mb-field" for="minibia-bot-cave-verification-tick">
                <span class="mb-field-label">Notice scan tick (ms, 200-5000)</span>
                <input type="number" id="minibia-bot-cave-verification-tick" min="200" max="5000" step="100" value="500" />
              </label>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-cave-test-alarm">Test Loud Alarm</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-resume-verification">RESTORE AFTER CAPTCHA</button>
              </div>
              <div class="mb-small-note">Alarma 60/30/15s, ataque estacionario y Auto Heal. Auto-reanudar solo tras confirmación del servidor o cierre del desafío después de una secuencia manual válida; el botón RESTORE sigue disponible. No resuelve el CAPTCHA.</div>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button" id="minibia-bot-cave-start">Start</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-stop">Stop</button>
              </div>
              <div class="mb-small-note" id="minibia-bot-cave-status">Status: no waypoints</div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Auto Attack</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-auto-attack-enabled" />
                <span>Enable Auto Attack</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-auto-attack-melee" />
                <span>Melee Mode</span>
              </label>
              <label class="mb-field" for="minibia-bot-auto-attack-chase-controller">
                <span class="mb-field-label">Melee pursuit method</span>
                <select id="minibia-bot-auto-attack-chase-controller">
                  <option value="hybrid">Hybrid: native first, bot backup</option>
                  <option value="native">Native Safe Chase (automatic)</option>
                  <option value="pathfinder">Bot pathfinding (avoid stairs)</option>
                </select>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-auto-attack-avoid-stairs" />
                <span>Strict stair protection (all pursuit modes)</span>
              </label>
              <div class="mb-small-note">When ON, safety overrides Hybrid/Native and uses only locally validated bot paths. The game's native chase/follow is turned OFF during automatic melee attacks. Cave Bot blocks all unintended floor changes; deliberate cross-floor routes require the separate Allow intentional floor changes option. When OFF, the selected pursuit method works normally without guaranteed stair avoidance.</div>
              <label class="mb-field" for="minibia-bot-auto-attack-hotkey">
                <span class="mb-field-label">Target Hotkey (1-12)</span>
                <input type="number" id="minibia-bot-auto-attack-hotkey" min="1" max="12" placeholder="3" />
              </label>
              <label class="mb-field" for="minibia-bot-auto-attack-rune-hotkey">
                <span class="mb-field-label">Rune Hotkey (1-12)</span>
                <input type="number" id="minibia-bot-auto-attack-rune-hotkey" min="1" max="12" placeholder="4" />
              </label>
              <div class="mb-small-note">Auto Attack selects targets by creature ID without repeatedly pressing the target hotkey. Melee chooses a movement controller; non-melee lets you walk manually.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="mb-resize-handle" id="minibia-bot-resize" role="separator" aria-label="Resize Minibia Bot panel" title="Drag to resize">◢</div>
    `;
    document.body.appendChild(panel);

    // Move existing sections into collapsible groups WITHOUT recreating inputs,
    // their IDs, values, or change listeners. Quick actions are always on top.
    const quickBar = document.createElement("div");
    quickBar.className = "mb-quick-bar";
    quickBar.innerHTML = `
      <div class="mb-quick-head"><strong>HUNT ESSENTIALS · V24</strong><span class="mb-quick-hint">Solo Hunt + Shanar para vender · Home es opcional, abajo</span></div>
      <div class="mb-quick-routes">
        <label class="mb-quick-route">Hunt route <select id="minibia-bot-quick-route"></select></label>
        <label class="mb-quick-route">Seller route (Shanar ↔ Hunt) <select id="minibia-bot-quick-seller-route"></select></label>
        <label class="mb-quick-route">Home route <select id="minibia-bot-quick-home-route"></select></label>
      </div>
      <div class="mb-quick-core mb-quick-settings">
        <label class="mb-toggle"><input id="minibia-bot-quick-attack" type="checkbox"/><span>Auto Attack</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-melee" type="checkbox"/><span>Melee</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-heal" type="checkbox"/><span>Auto Heal</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-talk" type="checkbox"/><span>Gemini · Default / GM</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-private" type="checkbox"/><span>Responder privados</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-npc" type="checkbox"/><span>Responder NPC</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-stairs" type="checkbox"/><span>Protect stairs</span></label>
        <label class="mb-toggle"><input id="minibia-bot-quick-seller-enabled" type="checkbox"/><span>HUNT + SELLER</span></label>
        <label class="mb-quick-hint">Sell when free cap ≤ <input id="minibia-bot-quick-seller-cap" type="number" min="1" max="10000" step="1" style="width:67px" /> oz</label>
      </div>
      <div class="mb-quick-actions">
        <button id="minibia-bot-quick-start" type="button">START HUNT</button>
        <button id="minibia-bot-quick-stop" type="button">STOP HUNT</button>
        <button id="minibia-bot-quick-go-home" type="button">GO HOME</button>
        <button id="minibia-bot-quick-go-hunt" type="button">GO HUNT (HOME)</button>
        <button id="minibia-bot-quick-resume-notice" type="button">RESTORE CAPTCHA</button>
        <button id="minibia-bot-quick-alarm" type="button">TEST ALARM</button>
      </div>
      <div class="mb-small-note" id="minibia-bot-quick-route-check" style="margin:4px 0;line-height:1.35">Rutas: comprobando…</div>
      <div class="mb-small-note" id="minibia-bot-quick-alarm-reason" style="margin:4px 0;line-height:1.35">Última alarma: ninguna desde la carga del bot</div>
      <div class="mb-small-note" id="minibia-bot-quick-talk-trace" style="margin:4px 0;line-height:1.35">Gemini: sin eventos registrados</div>
      <div class="mb-small-note" id="minibia-bot-quick-seller-trace" style="margin:4px 0;line-height:1.35">HUNT + SELLER: comprobando…</div>
      <div class="mb-small-note" id="minibia-bot-quick-hold-reason" style="margin:4px 0;line-height:1.35">Movimiento: comprobando…</div>
      <div class="mb-quick-summary" id="minibia-bot-quick-summary">Reading current module states…</div>
      <div class="mb-quick-tools">
        <details class="mb-quick-group" id="minibia-bot-quick-group-navigation">
          <summary>Movimiento y ruta <span class="mb-quick-group-sub">waypoints · chase · stairs</span></summary>
          <div class="mb-quick-settings">
            <label class="mb-toggle"><input id="minibia-bot-quick-prioritize" type="checkbox"/><span>Priority mobs</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-random" type="checkbox"/><span>Random move</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-leash" type="checkbox"/><span>Chase limit</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-allow-floors" type="checkbox"/><span>Recorded stairs</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-tools-floor" type="checkbox"/><span>Shovel / Rope</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-travel-fight" type="checkbox"/><span>Fight on trip</span></label>
            <label>Route mode <select id="minibia-bot-quick-route-mode"><option value="pingpong">Out &amp; back</option><option value="loop">Loop</option></select></label>
            <label>Chase <select id="minibia-bot-quick-chase"><option value="pathfinder">Bot path</option><option value="hybrid">Hybrid</option><option value="native">Native</option></select></label>
          </div>
        </details>
        <details class="mb-quick-group" id="minibia-bot-quick-group-alerts">
          <summary>ANTI DETECTION · Alarmas y Gemini <span class="mb-quick-group-sub">GM · CAPTCHA · Default · PM · API</span></summary>
          <div class="mb-quick-settings">
            <label class="mb-toggle"><input id="minibia-bot-quick-verification" type="checkbox"/><span>CAPTCHA alarm</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-moderator" type="checkbox"/><span>GM alarm</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-smart-chat" type="checkbox"/><span>Chat alarm</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-gemini-alarm" type="checkbox"/><span>Gemini error alarm</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-unknown-alarm" type="checkbox"/><span>Nearby player alarm</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-panic-unknown" type="checkbox"/><span>Panic player</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-panic-health" type="checkbox"/><span>Panic HP</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-panic-return" type="checkbox"/><span>Panic return</span></label>
          </div>
          <div class="mb-quick-inline-tools">
            <label>Trusted name <input id="minibia-bot-quick-trusted-name" type="text" placeholder="Friend name"/></label>
            <button id="minibia-bot-quick-trusted-add" type="button">ADD TRUSTED</button>
            <label>GM name <input id="minibia-bot-quick-gm-name" type="text" placeholder="GM name"/></label>
            <button id="minibia-bot-quick-gm-add" type="button">ADD GM</button>
          </div>
          <div class="mb-small-note">Panic toggles can stop navigation. Sound-only alarms never do. Existing GM and Trusted lists remain in Advanced Monitoring.</div>
        </details>
        <details class="mb-quick-group" id="minibia-bot-quick-group-floor">
          <summary>Objetos raros del piso <span class="mb-quick-group-sub">mover · Rare · scan</span></summary>
          <div class="mb-quick-settings">
            <label class="mb-toggle"><input id="minibia-bot-quick-floor-enabled" type="checkbox"/><span>Move floor items</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-floor-rares" type="checkbox"/><span>Include Rare</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-floor-walk" type="checkbox"/><span>Walk to item</span></label>
          </div>
          <label class="mb-quick-route">Exact names / IDs <input id="minibia-bot-quick-floor-items" type="text" placeholder="crystal coin, 3035" /></label>
          <div class="mb-quick-actions"><button id="minibia-bot-quick-floor-scan" type="button">SCAN ITEMS</button></div>
          <div class="mb-small-note" id="minibia-bot-quick-floor-status">Moves matching items to adjacent tiles; never picks them up. Rare requires opening Minibia Loot List once per session.</div>
        </details>
        <details class="mb-quick-group" id="minibia-bot-quick-group-training">
          <summary>ML Trainer y supplies <span class="mb-quick-group-sub">spell · intervalo · comida · protección</span></summary>
          <div class="mb-quick-training" style="display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:8px 0;">
            <label class="mb-toggle"><input id="minibia-bot-quick-ml-enabled" type="checkbox"/><span>ML Trainer</span></label>
            <label class="mb-field" style="flex:2 1 155px"><span class="mb-field-label">Spell</span><input id="minibia-bot-quick-ml-spell" type="text" placeholder="exura" /></label>
            <label class="mb-field" style="flex:1 1 95px"><span class="mb-field-label">Min (s)</span><input id="minibia-bot-quick-ml-min" type="number" min="1" max="3600" step="0.5" /></label>
            <label class="mb-field" style="flex:1 1 95px"><span class="mb-field-label">Max (s)</span><input id="minibia-bot-quick-ml-max" type="number" min="1" max="3600" step="0.5" /></label>
            <label class="mb-field" style="flex:1 1 80px"><span class="mb-field-label">Mana</span><input id="minibia-bot-quick-ml-mana" type="number" min="0" step="1" /></label>
          </div>
          <div class="mb-quick-settings">
            <label class="mb-toggle"><input id="minibia-bot-quick-eat" type="checkbox"/><span>Auto Eat</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-invisible" type="checkbox"/><span>Invisible</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-shield" type="checkbox"/><span>Magic Shield</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-ring" type="checkbox"/><span>Ring</span></label>
          </div>
          <div class="mb-quick-inline-tools">
            <label>Auto Heal minimum HP <input id="minibia-bot-quick-heal-hp" type="number" min="0"/></label>
            <label>HP hotkey (1–12) <input id="minibia-bot-quick-heal-hp-key" type="number" min="1" max="12"/></label>
            <label>Auto Heal minimum Mana <input id="minibia-bot-quick-heal-mana" type="number" min="0"/></label>
            <label>Mana hotkey (1–12) <input id="minibia-bot-quick-heal-mana-key" type="number" min="1" max="12"/></label>
          </div>
          <div class="mb-small-note">The trainer draws a new random delay between Min and Max after each successful spell. Heal thresholds and hotkeys are shared with Advanced Auto Heal.</div>
        </details>
        <details class="mb-quick-group" id="minibia-bot-quick-group-waypoints">
          <summary>Waypoints, loot y venta <span class="mb-quick-group-sub">grabar · undo · loot list · NPC</span></summary>
          <div class="mb-quick-actions">
            <button id="minibia-bot-quick-wp-record" type="button">RECORD SPOT</button>
            <button id="minibia-bot-quick-wp-undo" type="button">UNDO LAST WP</button>
            <button id="minibia-bot-quick-wp-new" type="button">NEW ROUTE</button>
          </div>
          <label class="mb-quick-route">Native loot whitelist (item names)<textarea id="minibia-bot-quick-loot-names" rows="2" placeholder="Brass Helmet"></textarea></label>
          <div class="mb-quick-actions">
            <button id="minibia-bot-quick-loot-open" type="button">OPEN /LOOTLIST</button>
            <button id="minibia-bot-quick-loot-apply" type="button">APPLY LOOT</button>
          </div>
          <div class="mb-quick-settings">
            <label class="mb-toggle"><input id="minibia-bot-quick-sell-enabled" type="checkbox"/><span>Auto Sell</span></label>
            <label class="mb-toggle"><input id="minibia-bot-quick-sell-return" type="checkbox"/><span>Return to hunt</span></label>
          </div>
          <label class="mb-quick-route">Seller items (whitelist) <input id="minibia-bot-quick-sell-items" type="text" placeholder="Brass Helmet"/></label>
          <div class="mb-small-note">Native Auto Loot is managed by Minibia. Sale never includes an item absent from the Seller whitelist. Use advanced settings for NPC name and route transitions.</div>
        </details>
      </div>
      <div class="mb-small-note" id="minibia-bot-quick-status">Listo para iniciar la caza.</div>`;
    panel.querySelector(".mb-body")?.prepend(quickBar);
    // Keep ALL quick inputs in the DOM with unchanged IDs. No duplicate state or listeners.
    // Convert the previous six nested disclosure panels into always-visible compact rows.
    for (const group of Array.from(quickBar.querySelectorAll('.mb-quick-group'))) {
      const title=group.querySelector(':scope > summary');
      if (!title) continue;
      const category=document.createElement('strong');
      category.className='mb-quick-category';
      category.textContent=title.firstChild?.textContent?.trim() || 'Opciones';
      title.replaceWith(category);
      const row=document.createElement('div');
      row.className='mb-quick-group';
      row.id=group.id;
      while(group.firstChild) row.appendChild(group.firstChild);
      group.replaceWith(row);
    }
    // Keep lists, numeric thresholds and name fields directly visible, with compact sizing.
    // They belong to the same window, not a separate Advanced mode.

    // Reorganize existing nodes: controls retain their IDs, current values and listeners.
    const mainColumn = panel.querySelector(".mb-main-column");
    const sideColumn = panel.querySelector(".mb-side-column");
    const caveColumn = panel.querySelector(".mb-cave-column");
    const getSection = (column, title) => Array.from(column?.children || [])
      .find((section) => section.classList.contains("mb-column-section") &&
        section.querySelector(":scope > .mb-label")?.textContent === title);
    const caveSection = getSection(caveColumn, "Cave Bot");
    const caveStack = caveSection?.querySelector(":scope > .mb-stack");
    const verificationStart = caveStack?.querySelector("#minibia-bot-cave-verification-pause")?.closest("label");
    const verificationEnd = caveStack?.querySelector("#minibia-bot-cave-resume-verification")?.closest(".mb-actions");
    let noticeSection = null;
    if (caveStack && verificationStart && verificationEnd) {
      noticeSection = document.createElement("div");
      noticeSection.className = "mb-section mb-column-section";
      const caption = document.createElement("div");
      caption.className = "mb-label";
      caption.textContent = "Verification / Sound alerts";
      noticeSection.append(caption);
      const noticeControls = document.createElement("div");
      noticeControls.className = "mb-stack";
      let node = verificationStart;
      while (node) {
        const next = node.nextElementSibling;
        noticeControls.append(node);
        if (node === verificationEnd) {
          // Take the existing help note immediately after the alarm buttons too.
          if (next?.classList.contains("mb-small-note")) noticeControls.append(next);
          break;
        }
        node = next;
      }
      noticeSection.append(noticeControls);
    }
    const floorSection = getSection(sideColumn, "Move Floor Items");
    let corpseSection = null;
    if (floorSection) {
      const floorStack = floorSection.querySelector(":scope > .mb-stack");
      const corpseHeader = Array.from(floorStack?.children || [])
        .find((child) => child.classList.contains("mb-label") && child.textContent.includes("Auto Loot Corpses"));
      if (corpseHeader) {
        corpseSection = document.createElement("div");
        corpseSection.className = "mb-section mb-column-section";
        const corpseStack = document.createElement("div");
        corpseStack.className = "mb-stack";
        while (corpseHeader.nextElementSibling) corpseStack.append(corpseHeader.nextElementSibling);
        corpseHeader.textContent = "Auto Loot Corpses";
        corpseSection.append(corpseHeader, corpseStack);
        sideColumn.append(corpseSection);
      }
    }
    const monitoring = document.createElement("div");
    monitoring.className = "mb-monitoring mb-flat-monitoring";
    const monitorTitle = document.createElement("div");
    monitorTitle.className = "mb-label";
    monitorTitle.textContent = "Anti Detection / Monitoring";
    monitoring.append(monitorTitle);
    const monitorIntro = document.createElement("div");
    monitorIntro.className = "mb-monitor-intro";
    monitorIntro.textContent = "Optional alerts, NPC/chat replies, unusual floor items and player monitoring. Does not solve verification challenges.";
    monitoring.append(monitorIntro);
    function placeMonitor(section, title) {
      if (!section) return;
      const sub = document.createElement("section");
      sub.className = "mb-flat-section";
      const caption = document.createElement("div");
      caption.className = "mb-label";
      caption.textContent = title;
      sub.append(caption, section);
      monitoring.append(sub);
    }
    placeMonitor(getSection(mainColumn, "Panic Runner Home: not set"), "Panic Runner / Player Alerts");
    placeMonitor(getSection(mainColumn, "GM Kill Switch"), "GM Alerts");
    placeMonitor(noticeSection, "Verification Notices / Loud Alarm");
    placeMonitor(getSection(sideColumn, "Talk"), "Gemini / Auto Chat");
    placeMonitor(floorSection, "Rare Floor Item Movement");
    mainColumn.prepend(monitoring);
    // Move the REAL Talk configuration (API key, prompt, test, delay) into Anti Detection.
    // Reparent existing DOM nodes instead of cloning fields: IDs, listeners and persisted state remain unique.
    const antiGroup=quickBar.querySelector('#minibia-bot-quick-group-alerts');
    const originalTalk=monitoring.querySelector('#minibia-bot-talk-api-key')?.closest('.mb-column-section');
    if(antiGroup && originalTalk){
      const oldWrapper=originalTalk.closest('.mb-flat-section');
      const title=document.createElement('div');
      title.className='mb-gemini-compact-heading';
      title.textContent='GEMINI · API, estilo y prueba';
      antiGroup.append(title);
      originalTalk.classList.add('mb-gemini-quick-config');
      antiGroup.append(originalTalk);
      if(oldWrapper && !oldWrapper.querySelector('.mb-column-section')) oldWrapper.remove();
      const talkTitle=originalTalk.querySelector(':scope > .mb-label');
      if(talkTitle) talkTitle.remove();
      // Keep the REAL Gemini preview controls immediately after the API key and prompt.
      const talkAi=originalTalk.querySelector('#minibia-bot-talk-ai-settings');
      const testField=originalTalk.querySelector('#minibia-bot-talk-test-message')?.closest('label');
      const testButton=originalTalk.querySelector('#minibia-bot-talk-test');
      const testResult=originalTalk.querySelector('#minibia-bot-talk-test-result');
      const testCaption=Array.from(originalTalk.querySelectorAll('.mb-label'))
        .find(el=>el.textContent.trim()==='Test a reply (preview only)');
      if(talkAi && testField && testButton && testResult){
        const previewNote=testResult.nextElementSibling;
        const testLine=document.createElement('div');
        testLine.className='mb-quick-gemini-test';
        if(testCaption)testLine.append(testCaption);
        testLine.append(testField,testButton,testResult);
        if(previewNote?.classList.contains('mb-small-note'))testLine.append(previewNote);
        talkAi.after(testLine);
      }
    }
    // The body has exactly two vertical regions: Quick Hub, then all legacy modules.
    // Prevent overlapping CSS grid row placements when the panel is maximized.
    const advancedColumns=document.createElement('div');
    advancedColumns.className='mb-advanced-columns';
    const bodyElement=panel.querySelector('.mb-body');
    if(bodyElement){
      bodyElement.append(advancedColumns);
      advancedColumns.append(mainColumn,sideColumn,caveColumn);
    }
    const mainUtilities = Array.from(mainColumn.children).find((child) =>
      child.classList.contains("mb-column-section") && !!child.querySelector("#minibia-bot-rune-enabled"));
    const loadedText = Array.from(mainColumn.children).find((child) =>
      child.classList.contains("mb-column-section") && !!child.querySelector(".mb-note"));
    if (mainUtilities && loadedText) mainUtilities.append(loadedText);

    // SINGLE-SURFACE UX: no extra legacy panels, no duplicated visible controls.
    // Existing quick checkboxes remain the ONLY visible toggles. Original DOM controls
    // stay mounted in the invisible wiring dock so legacy listeners still work.
    const wiringDock=document.createElement('div');
    wiringDock.id='minibia-bot-wiring-dock';
    wiringDock.hidden=true;
    wiringDock.setAttribute('aria-hidden','true');
    quickBar.append(wiringDock);
    // Lift all four heal settings from Training into the always-visible Essentials.
    const healFields=quickBar.querySelector('#minibia-bot-quick-heal-hp')?.closest('.mb-quick-inline-tools');
    const essentialsCore=quickBar.querySelector('.mb-quick-core');
    if(healFields && essentialsCore){
      healFields.classList.add('mb-essential-heal');
      essentialsCore.after(healFields);
      for(const label of healFields.querySelectorAll('label')){
        const textNode=Array.from(label.childNodes).find(n=>n.nodeType===Node.TEXT_NODE && n.nodeValue.trim());
        if(textNode)textNode.nodeValue=textNode.nodeValue.replace('Auto Heal minimum HP','Heal HP ≤')
          .replace('Auto Heal minimum Mana','Mana ≤')
          .replace('HP hotkey (1–12)','HP key')
          .replace('Mana hotkey (1–12)','Mana key');
      }
    }
    // Reparent the REAL ML Trainer controls into Essentials. Listeners attach
    // by ID after this DOM move; the supplies section retains its other tools.
    const mlRow=quickBar.querySelector('#minibia-bot-quick-group-training .mb-quick-training');
    if (mlRow && essentialsCore) {
      const mlEssentials=document.createElement('div');
      mlEssentials.className='mb-essential-ml';
      const mlTitle=document.createElement('strong');
      mlTitle.textContent='ML Trainer';
      mlEssentials.append(mlTitle, mlRow);
      (healFields || essentialsCore).after(mlEssentials);
      const remainingTraining=quickBar.querySelector('#minibia-bot-quick-group-training > summary');
      if (remainingTraining) remainingTraining.firstChild.textContent='Supplies ';
    }
    // Group advanced Talk API/settings into the real Anti Detection group (already
    // reparented above). Keep its ONE set of inputs and events.
    const antiDetection=quickBar.querySelector('#minibia-bot-quick-group-alerts');
    const antiSettings=antiDetection?.querySelector('.mb-quick-inline-tools');
    // Show actual saved GM/trusted lists and the emergency Home without a second Monitoring section.
    const oldPanic=monitoring.querySelector('#minibia-bot-set-home')?.closest('.mb-column-section');
    const oldGM=monitoring.querySelector('#minibia-bot-panic-gm-list')?.closest('.mb-column-section');
    if(antiSettings && oldPanic){
      const homeInfo=oldPanic.querySelector('#minibia-bot-home');
      const homeButton=oldPanic.querySelector('#minibia-bot-set-home');
      const trusted=oldPanic.querySelector('#minibia-bot-panic-trusted-list');
      const inline=document.createElement('div');inline.className='mb-quick-monitor-lists';
      if(homeButton && homeInfo)inline.append(homeButton,homeInfo);
      if(trusted){
        const wrap=document.createElement('div');wrap.className='mb-quick-name-list';
        const label=document.createElement('strong');label.textContent='Trusted';
        wrap.append(label,trusted);inline.append(wrap);
      }
      if(oldGM){
        const gm=oldGM.querySelector('#minibia-bot-panic-gm-list');
        if(gm){const wrap=document.createElement('div');wrap.className='mb-quick-name-list';
          const label=document.createElement('strong');label.textContent='GM';
          wrap.append(label,gm);inline.append(wrap);}
      }
      antiSettings.after(inline);
    }
    // These original Talk toggles are already mirrored by the visible Essentials
    // controls. Do not render the same choices twice in Anti Detection.
    if(originalTalk){
      for(const id of ['minibia-bot-talk-enabled','minibia-bot-talk-gemini-alarm',
                        'minibia-bot-talk-npc-replies','minibia-bot-talk-private-replies']){
        const toggle=originalTalk.querySelector('#'+id);
        const holder=toggle?.closest('label');
        if(holder)wiringDock.append(holder);
      }
      // The Gemini failure explanatory note follows the old toggle and is redundant.
      const verbose=Array.from(originalTalk.querySelectorAll('.mb-small-note'))
        .find(node=>node.textContent.includes('Sounds the usual alarm on API error'));
      if(verbose)wiringDock.append(verbose);
    }
    if(antiDetection && noticeSection){
      const noticeTick=noticeSection.querySelector('#minibia-bot-cave-verification-tick')?.closest('label');
      if(noticeTick){noticeTick.classList.add('mb-compact-notice-tick');antiDetection.append(noticeTick);}
    }
    // ML/supplies only need one extra parameter missing from the Quick row.
    const training=quickBar.querySelector('#minibia-bot-quick-group-training');
    const eatHotkey=mainUtilities?.querySelector('#minibia-bot-auto-eat-hotkey')?.closest('label');
    if(training && eatHotkey){eatHotkey.classList.add('mb-quick-eat-key');
      training.querySelector('.mb-quick-settings')?.append(eatHotkey);}
    // Xray is its own utility, but lives inside the Quick Floor group, not far below.
    const floorQuick=quickBar.querySelector('#minibia-bot-quick-group-floor');
    const realXray=getSection(sideColumn,'Xray');
    if(floorQuick && realXray){
      const title=realXray.querySelector(':scope > .mb-label');
      if(title)title.textContent='Xray';
      realXray.classList.add('mb-quick-xray');floorQuick.append(realXray);
    }
    // Cave Bot is the ONLY large detailed section, with routes, waypoints, loot
    // and seller configuration, all in one place and all original event handlers.
    const caveDock=document.createElement('div');
    caveDock.id='minibia-bot-cave-dock';
    caveDock.className='mb-quick-cave-dock';
    caveDock.setAttribute('aria-label','Cave Bot: waypoints, loot and seller');
    quickBar.append(caveDock);
    const caveBody=caveSection?.querySelector(':scope > .mb-stack');
    if(caveSection){caveSection.classList.add('mb-main-cave-section');caveDock.append(caveSection);}
    // Keep the everyday Essentials limited to Hunt + Seller. The optional
    // Home controls remain visible below in Cave Bot, with original IDs/events.
    const optionalTravel=document.createElement('div');
    optionalTravel.className='mb-cave-card mb-optional-travel';
    const optionalTitle=document.createElement('strong');optionalTitle.className='mb-label';
    optionalTitle.textContent='Viajes puntuales (opcional; no intervienen en HUNT + SELLER)';
    optionalTravel.append(optionalTitle);
    const homePicker=quickBar.querySelector('#minibia-bot-quick-home-route')?.closest('label');
    if(homePicker){homePicker.firstChild.textContent='Home route (opcional) ';optionalTravel.append(homePicker);}
    const optionalButtons=document.createElement('div');optionalButtons.className='mb-quick-actions';
    for(const id of ['minibia-bot-quick-go-home','minibia-bot-quick-go-hunt']){
      const button=quickBar.querySelector('#'+id);if(button)optionalButtons.append(button);
    }
    optionalTravel.append(optionalButtons);
    caveDock.append(optionalTravel);
    if(caveBody && corpseSection){corpseSection.classList.add('mb-quick-corpse');caveBody.append(corpseSection);}
    // Combat-only fields not in Essentials are available in Cave Bot.
    const attackSection=getSection(caveColumn,'Auto Attack');
    if(caveBody && attackSection){
      const extra=document.createElement('div');extra.className='mb-quick-combat-extras';
      const title=document.createElement('div');title.className='mb-label';title.textContent='Combat · detalles';
      extra.append(title);
      for(const id of ['minibia-bot-auto-attack-hotkey','minibia-bot-auto-attack-rune-hotkey']){
        const label=attackSection.querySelector('#'+id)?.closest('label');
        if(label)extra.append(label);
      }
      caveBody.append(extra);
    }
    // Keep existing Quick buttons/inputs mounted for event mirroring, but show
    // only Cave Bot's original controls for waypoints and movement.
    for(const id of ['minibia-bot-quick-group-navigation','minibia-bot-quick-group-waypoints']){
      const oldQuick=quickBar.querySelector('#'+id);if(oldQuick)wiringDock.append(oldQuick);
    }
    // Hide only DUPLICATE Cave Bot widgets present in Essentials; retain the exact
    // elements in wiringDock for current direct/legacy event handlers.
    if(caveBody){
      for(const id of ['minibia-bot-seller-enabled','minibia-bot-seller-cap','minibia-bot-seller-route']){
        const control=caveBody.querySelector('#'+id);
        const holder=control?.closest('label');if(holder)wiringDock.append(holder);
      }
      const existingCaveStart=caveBody.querySelector('#minibia-bot-cave-start')?.closest('.mb-actions');
      if(existingCaveStart)wiringDock.append(existingCaveStart);
      // No repeated descriptive walls of text between routine controls.
      for(const note of caveBody.querySelectorAll('.mb-small-note')){
        if(note.id)continue;
        note.classList.add('mb-cave-help');
      }
    }
    // Group the ORIGINAL Cave Bot fields into coherent cards. Splitting each
    // standalone label into a CSS grid cell was the cause of the previous UI chaos.
    if(caveBody){
      const makeCard=(name)=>{
        const card=document.createElement('div');card.className='mb-cave-card';
        card.dataset.section=name;return card;
      };
      const routeCard=makeCard('waypoints');
      const movementCard=makeCard('movement');
      const movementHeading=document.createElement('strong');movementHeading.textContent='Movimiento, persecución y escaleras';
      movementHeading.className='mb-label';movementCard.append(movementHeading);
      const sellerCard=makeCard('seller-route');
      const saleCard=makeCard('auto-sell');
      const lootCard=makeCard('native-loot');
      let activeCard=routeCard;
      const corpseCard=caveBody.querySelector('.mb-quick-corpse');
      const combatCard=caveBody.querySelector('.mb-quick-combat-extras');
      for(const child of Array.from(caveBody.children)){
        if(child===corpseCard||child===combatCard)continue;
        if(child.querySelector?.('#minibia-bot-cave-moderator-pause')){
          // The same control is already visible in Anti Detection.
          wiringDock.append(child);continue;
        }
        if(child.querySelector?.('#minibia-bot-cave-prioritize-monsters'))activeCard=movementCard;
        if(child.classList.contains('mb-label')){
          const label=child.textContent.trim();
          if(label==='Seller Return (capacity)')activeCard=sellerCard;
          else if(label.startsWith('Auto Sell ('))activeCard=saleCard;
          else if(label.startsWith('Minibia Native Auto Loot'))activeCard=lootCard;
        }
        if(child.id==='minibia-bot-cave-status')activeCard=routeCard;
        if(child.id==='minibia-bot-seller-status')activeCard=sellerCard;
        activeCard.append(child);
      }
      for(const card of [routeCard,movementCard,saleCard,lootCard,sellerCard]){
        if(card.childElementCount)caveBody.append(card);
      }
      if(corpseCard){corpseCard.classList.add('mb-cave-card');caveBody.append(corpseCard);}
      if(combatCard){combatCard.classList.add('mb-cave-card');caveBody.append(combatCard);}
    }
    // SELLER UX: move EXISTING controls to Essentials, without cloning configuration.
    // The advanced Auto Sell inputs remain the unique targets for existing listeners.
    // Quick controls use the existing synchronization callbacks.
    const sellerEssentials = document.createElement('section');
    sellerEssentials.className = 'mb-essential-seller';
    sellerEssentials.innerHTML = '<strong class="mb-label">VENTA AUTOMÁTICA · Shanar</strong><div class="mb-essential-seller-toggles"></div><div class="mb-essential-seller-fields"></div><div class="mb-essential-seller-actions"></div><div class="mb-essential-seller-status"></div>';
    const quickSellerGroup = quickBar.querySelector('#minibia-bot-quick-group-waypoints');
    const sellerToggles = sellerEssentials.querySelector('.mb-essential-seller-toggles');
    const sellerFields = sellerEssentials.querySelector('.mb-essential-seller-fields');
    const sellerActions = sellerEssentials.querySelector('.mb-essential-seller-actions');
    const sellerStatuses = sellerEssentials.querySelector('.mb-essential-seller-status');
    const moveSellerControl = (id, destination) => {
      const control = panel.querySelector('#' + id);
      const label = control?.closest('label');
      if (label) destination.append(label); // MOVE, never clone, preserving listeners/IDs.
    };
    for (const id of ['minibia-bot-quick-sell-enabled',
                      'minibia-bot-quick-sell-return',
                      'minibia-bot-seller-fight-outbound',
                      'minibia-bot-seller-fight-return']) moveSellerControl(id, sellerToggles);
    for (const id of ['minibia-bot-auto-sell-npc',
                      'minibia-bot-quick-sell-items']) moveSellerControl(id, sellerFields);
    const saleButton = panel.querySelector('#minibia-bot-auto-sell-test');
    if (saleButton) {
      saleButton.textContent = 'VENDER AHORA (junto al NPC)';
      sellerActions.append(saleButton);
    }
    for (const id of ['minibia-bot-auto-sell-status', 'minibia-bot-seller-status']) {
      const status = panel.querySelector('#' + id);
      if (status) sellerStatuses.append(status);
    }
    const essentialsButtons = quickBar.querySelector('.mb-quick-actions');
    const essentialsSellerInsert = essentialsButtons || quickBar.querySelector('.mb-quick-summary');
    if (essentialsSellerInsert) essentialsSellerInsert.before(sellerEssentials);
    // The original sale card contains only descriptive text after the controls move.
    // Keep it out of view; every operational control remains visible at the top.
    const obsoleteSaleCard = quickBar.querySelector('.mb-cave-card[data-section="auto-sell"]');
    if (obsoleteSaleCard) wiringDock.append(obsoleteSaleCard);

    // One refreshable Auto Heal group in Essentials, one Gemini configuration,
    // one Anti Detection, one Cave Bot. Keep the remaining original nodes mounted,
    // invisible, because event bindings query them by ID after this point.
    for(const column of [mainColumn,sideColumn,caveColumn])wiringDock.append(column);
    if(monitoring?.isConnected)wiringDock.append(monitoring);
    if(advancedColumns?.isConnected)advancedColumns.remove();
    // The Reload control is useful but should not occupy a whole duplicated panel.
    const reload=panel.querySelector('#minibia-bot-reload');
    if(reload){reload.classList.add('mb-quick-reload');caveDock.append(reload);}
    const previousCaption=quickBar.querySelector('.mb-quick-head .mb-quick-hint');
    if(previousCaption)previousCaption.textContent='Activá lo necesario y presioná START HUNT';
    if(quickBar.querySelector('#minibia-bot-quick-resume-notice'))
      quickBar.querySelector('#minibia-bot-quick-resume-notice').textContent='REANUDAR TRAS CAPTCHA';
    // Named Quick profiles: save the existing module configurations. Routes
    // remain Cave presets; never snapshot credentials or the current session.
    const quickProfilesKey='minibiaBot.ui.quickProfiles.v1';
    const profileRow=document.createElement('div');
    profileRow.className='mb-quick-profiles';
    profileRow.innerHTML='<strong>Mi configuración</strong><select id="minibia-bot-profile-list" aria-label="Configuración guardada"></select><button type="button" id="minibia-bot-profile-save">GUARDAR</button><button type="button" id="minibia-bot-profile-apply">APLICAR</button><small id="minibia-bot-profile-msg" aria-live="polite">Persistente en este navegador</small>';
    const profileInsert=quickBar.querySelector('.mb-quick-routes') || quickBar.querySelector('.mb-quick-head');
    if(profileInsert) profileInsert.before(profileRow);
    const profileSelect=profileRow.querySelector('#minibia-bot-profile-list');
    const profileMsg=profileRow.querySelector('#minibia-bot-profile-msg');
    const profileModules=['cave','attack','heal','rune','talk','panic','eat','invisible','magicShield','equipRing','floorMove','corpseLoot','autoSell'];
    const safeConfig=(name)=>{
      const src=bot[name]?.status?.()?.config || bot[name]?.config || {};
      return Object.fromEntries(Object.entries(src).filter(([k,v])=>
        !/(?:key|token|secret|password|credential)/i.test(k) &&
        ['string','number','boolean'].includes(typeof v) ||
        (Array.isArray(v) && !/(?:key|token|secret|password|credential)/i.test(k))));
    };
    const readProfiles=()=>{
      const data=bot.storage.get(quickProfilesKey,{});
      return data && typeof data==='object' && !Array.isArray(data) ? data : {};
    };
    function renderProfiles(want){
      const data=readProfiles();profileSelect.replaceChildren();
      for(const name of Object.keys(data).sort()){
        const opt=document.createElement('option');opt.value=name;opt.textContent=name;profileSelect.append(opt);
      }
      if(want && data[want])profileSelect.value=want;
      if(!profileSelect.options.length){const opt=document.createElement('option');opt.value='';opt.textContent='Sin perfiles';profileSelect.append(opt);}
    }
    renderProfiles();
    profileRow.querySelector('#minibia-bot-profile-save').addEventListener('click',()=>{
      const defaultName=profileSelect.value || 'Mi Hunt';
      const name=String(window.prompt('Nombre de configuración:',defaultName)||'').trim().slice(0,48);
      if(!name)return;
      const profiles=readProfiles();
      const modules={};for(const moduleName of profileModules){modules[moduleName]=safeConfig(moduleName);}
      profiles[name]={version:1,createdAt:Date.now(),modules,
        huntPreset:bot.cave?.getActivePresetName?.()||null};
      bot.storage.set(quickProfilesKey,profiles);renderProfiles(name);
      profileMsg.textContent='Guardado: '+name+' · sin API key';
    });
    profileRow.querySelector('#minibia-bot-profile-apply').addEventListener('click',()=>{
      const name=profileSelect.value;const profile=readProfiles()[name];if(!profile?.modules)return;
      // Apply with modules OFF to avoid movement/attack triggered by a profile
      // switch. START HUNT is the explicit action to begin the route.
      if(bot.cave?.status?.()?.running){profileMsg.textContent='Detené la hunt antes de aplicar otro perfil';return;}
      const failure=[];
      try {if(profile.huntPreset)bot.cave?.loadPreset?.(profile.huntPreset);} catch(e){failure.push('ruta');}
      for(const moduleName of profileModules){
        if(!profile.modules[moduleName] || typeof bot[moduleName]?.updateConfig!=='function')continue;
        try {
          const next={...profile.modules[moduleName]};
          delete next.apiKey;
          bot[moduleName].updateConfig(next);
        }catch(e){failure.push(moduleName);}
      }
      // Reinject just the view so all current controls use the ORIGINAL
      // status/refresh handlers, never duplicates. This is not a full reload.
      profileMsg.textContent=failure.length?'Revisar: '+failure.join(', '):'Aplicado: '+name+' · pulsá START HUNT';
      if(!failure.length){
        for(const fn of ['refreshAutoHealStatus','refreshRuneStatus','refreshAutoAttackStatus',
          'refreshCaveStatus','refreshCavePresetControls','refreshTalkStatus','refreshPanicStatus']){
          try {bot.ui?.[fn]?.();}catch(_){}
        }
        refreshQuickSummary?.();
      }
    });
    // No nested disclosure menus: all functional sections stay in this one window.
    const emergencyButton = document.createElement("button");
    emergencyButton.id = "minibia-bot-emergency-stop";
    emergencyButton.type = "button";
    emergencyButton.textContent = "■";
    emergencyButton.setAttribute("aria-keyshortcuts", "Control+Shift+X");
    document.body.appendChild(emergencyButton);

    // Emergency is a two-stage latch: STOP, then intentional RESUME.
    // Only the modules running before STOP are restored.
    function refreshEmergencyButton() {
      const emergency=bot.emergencyState?.()||{};
      const halted=!!emergency.halted;
      const movementActive=bot.cave?.status?.()?.running===true;
      const otherActive=['attack','rune','heal','talk'].some(k=>bot[k]?.status?.()?.running===true);
      const state=halted ? 'resume' : (movementActive||otherActive ? 'stop':'start');
      emergencyButton.dataset.mode=state;
      emergencyButton.dataset.halted=String(halted);
      emergencyButton.textContent=state==='stop'?'■ PAUSAR':state==='resume'?'▶ REANUDAR':'▶ INICIAR';
      emergencyButton.title=state==='stop'?'PAUSAR todo y guardar estado · Ctrl+Shift+X':
        state==='resume'?(emergency.canResume?'RESTAURAR módulos previos':'Sin sesión guardada: iniciar ruta manualmente'):
        'Iniciar Hunt con la ruta guardada · Ctrl+Shift+X siempre detiene';
      emergencyButton.setAttribute('aria-label',emergencyButton.title);
    }
    function triggerEmergencyStop(fromHotkey=false) {
      const emergency=bot.emergencyState?.()||{};
      if(emergency.halted){
        if(emergency.canResume){
          if(!bot.emergencyResume?.()) console.warn('[minibia-bot] restore incomplete: check Essentials');
        }else{
          // Recovered tab with no live snapshot. An explicit click STARTS the
          // configured hunt; it must NEVER silently resume on page reload.
          bot.emergencyDismiss?.();
          if(!bot.cave?.startHuntCycle?.()?.ok) console.warn('[minibia-bot] HUNT could not start; inspect Essentials');
        }
      } else if(fromHotkey || bot.cave?.status?.()?.running ||
          ['attack','rune','heal','talk'].some(k=>bot[k]?.status?.()?.running===true)) {
        bot.emergencyStop?.();
      } else {
        const started=bot.cave?.startHuntCycle?.();
        if(!started?.ok)console.warn('[minibia-bot] HUNT could not start',started);
      }
      refreshEmergencyButton();
    }
    const emergencyDiameter = 124;
    const clampEmergency = (x, y) => ({
      left: Math.max(0, Math.min(Math.max(0, window.innerWidth - emergencyDiameter), x)),
      top: Math.max(0, Math.min(Math.max(0, window.innerHeight - emergencyDiameter), y)),
    });
    function applyEmergencyPosition(x, y) {
      const pos = clampEmergency(x, y);
      emergencyButton.style.left = `${pos.left}px`;
      emergencyButton.style.top = `${pos.top}px`;
      emergencyButton.style.right = "auto";
      emergencyButton.style.bottom = "auto";
      return pos;
    }
    const savedEmergencyPosition = bot.storage.get(emergencyPositionKey, null);
    if (Number.isFinite(savedEmergencyPosition?.left) && Number.isFinite(savedEmergencyPosition?.top)) {
      applyEmergencyPosition(savedEmergencyPosition.left, savedEmergencyPosition.top);
    }
    let emergencyPointer = null;
    let emergencyDragged = false;
    emergencyButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || emergencyPointer) return;
      event.stopPropagation();
      const rect = emergencyButton.getBoundingClientRect();
      emergencyPointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
        left: rect.left, top: rect.top, dragging: false };
      emergencyDragged = false;
      emergencyButton.setPointerCapture?.(event.pointerId);
    });
    emergencyButton.addEventListener("pointermove", (event) => {
      if (!emergencyPointer || event.pointerId !== emergencyPointer.id) return;
      const dx = event.clientX - emergencyPointer.startX;
      const dy = event.clientY - emergencyPointer.startY;
      if (!emergencyPointer.dragging && Math.hypot(dx, dy) > 6) emergencyPointer.dragging = true;
      if (!emergencyPointer.dragging) return;
      event.preventDefault();
      event.stopPropagation();
      emergencyDragged = true;
      emergencyButton.dataset.dragging = "true";
      applyEmergencyPosition(emergencyPointer.left + dx, emergencyPointer.top + dy);
    });
    function finishEmergencyDrag(event) {
      if (!emergencyPointer || event.pointerId !== emergencyPointer.id) return;
      event.stopPropagation();
      if (emergencyPointer.dragging) {
        const rect = emergencyButton.getBoundingClientRect();
        bot.storage.set(emergencyPositionKey, {left:rect.left, top:rect.top});
      }
      emergencyPointer = null;
      delete emergencyButton.dataset.dragging;
    }
    emergencyButton.addEventListener("pointerup", finishEmergencyDrag);
    emergencyButton.addEventListener("pointercancel", (event) => {
      emergencyDragged = true;
      finishEmergencyDrag(event);
    });
    emergencyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (emergencyDragged) { emergencyDragged = false; return; }
      triggerEmergencyStop(false);
    });
    const emergencyHotkey = (event) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyX" && !event.repeat) {
        event.preventDefault(); event.stopImmediatePropagation(); triggerEmergencyStop(true);
      }
    };
    const repositionEmergencyOnResize = () => {
      const rect = emergencyButton.getBoundingClientRect();
      applyEmergencyPosition(rect.left, rect.top);
    };
    window.addEventListener("resize", repositionEmergencyOnResize);
    window.addEventListener("keydown", emergencyHotkey, true);
    refreshEmergencyButton();
    const emergencyStatusTimer = window.setInterval(refreshEmergencyButton, 1500);
    bot.addCleanup(() => {
      window.clearInterval(emergencyStatusTimer);
      window.removeEventListener("resize", repositionEmergencyOnResize);
      window.removeEventListener("keydown", emergencyHotkey, true);
      emergencyButton.remove();
    });

    const quickRoute = quickBar.querySelector('#minibia-bot-quick-route');
    const quickHomeRoute = quickBar.querySelector('#minibia-bot-quick-home-route');
    const quickGoHunt = quickBar.querySelector('#minibia-bot-quick-go-hunt');
    const quickSellerRoute = quickBar.querySelector('#minibia-bot-quick-seller-route');
    const quickSellerCap = quickBar.querySelector('#minibia-bot-quick-seller-cap');
    const quickGoHome = quickBar.querySelector('#minibia-bot-quick-go-home');
    const quickAlarm = quickBar.querySelector('#minibia-bot-quick-alarm');
    const quickResumeNotice = quickBar.querySelector('#minibia-bot-quick-resume-notice');
    const quickStart = quickBar.querySelector('#minibia-bot-quick-start');
    const quickStop = quickBar.querySelector('#minibia-bot-quick-stop');
    const quickStatus = quickBar.querySelector('#minibia-bot-quick-status');
    const quickSummary = quickBar.querySelector('#minibia-bot-quick-summary');
    let quickStartWarning = '';
    let quickStartWarningAt = 0;
    const quickControls={
      attack:quickBar.querySelector('#minibia-bot-quick-attack'),
      melee:quickBar.querySelector('#minibia-bot-quick-melee'),
      stairs:quickBar.querySelector('#minibia-bot-quick-stairs'),
      prioritize:quickBar.querySelector('#minibia-bot-quick-prioritize'),
      sellerEnabled:quickBar.querySelector('#minibia-bot-quick-seller-enabled'),
      random:quickBar.querySelector('#minibia-bot-quick-random'),
      routeMode:quickBar.querySelector('#minibia-bot-quick-route-mode'),
      leash:quickBar.querySelector('#minibia-bot-quick-leash'),
      heal:quickBar.querySelector('#minibia-bot-quick-heal'),
      talk:quickBar.querySelector('#minibia-bot-quick-talk'),
      geminiAlarm:quickBar.querySelector('#minibia-bot-quick-gemini-alarm'),
      smartChat:quickBar.querySelector('#minibia-bot-quick-smart-chat'),
      moderator:quickBar.querySelector('#minibia-bot-quick-moderator'),
      verification:quickBar.querySelector('#minibia-bot-quick-verification'),
      travelFight:quickBar.querySelector('#minibia-bot-quick-travel-fight'),
      chase:quickBar.querySelector('#minibia-bot-quick-chase'),
    };
    const quickExtraIds = [
      'allow-floors','tools-floor','unknown-alarm','panic-unknown','panic-health','panic-return',
      'private','npc','floor-enabled','floor-rares','floor-walk','eat','invisible','shield','ring',
      'sell-enabled','sell-return'
    ];
    const extraQuick = Object.fromEntries(quickExtraIds.map(name=>[name,quickBar.querySelector('#minibia-bot-quick-'+name)]));
    const quickFloorItems = quickBar.querySelector('#minibia-bot-quick-floor-items');
    const quickFloorStatus = quickBar.querySelector('#minibia-bot-quick-floor-status');
    const quickLootNames = quickBar.querySelector('#minibia-bot-quick-loot-names');
    const quickSellItems = quickBar.querySelector('#minibia-bot-quick-sell-items');
    const quickSet = (element, value) => {
      if (!element || document.activeElement===element) return;
      if (element.type==='checkbox') element.checked=!!value; else element.value=String(value??'');
    };
    const quickMlEnabled=quickBar.querySelector('#minibia-bot-quick-ml-enabled');
    const quickMlSpell=quickBar.querySelector('#minibia-bot-quick-ml-spell');
    const quickMlMin=quickBar.querySelector('#minibia-bot-quick-ml-min');
    const quickMlMax=quickBar.querySelector('#minibia-bot-quick-ml-max');
    const quickMlMana=quickBar.querySelector('#minibia-bot-quick-ml-mana');
    function refreshQuickSummary() {
      const a=bot.attack?.status?.(),c=bot.cave?.status?.(),h=bot.heal?.status?.(),t=bot.talk?.status?.();
      const r=bot.rune?.status?.();
      const runeConfig=r?.config||{};
      quickMlEnabled.checked=!!r?.running;
      if(document.activeElement!==quickMlSpell) quickMlSpell.value=runeConfig.runeSpellWords||'';
      if(document.activeElement!==quickMlMin) quickMlMin.value=String((runeConfig.runeCooldownMinMs??runeConfig.runeCooldownMs??3500)/1000);
      if(document.activeElement!==quickMlMax) quickMlMax.value=String((runeConfig.runeCooldownMaxMs??runeConfig.runeCooldownMs??3500)/1000);
      if(document.activeElement!==quickMlMana) quickMlMana.value=String(runeConfig.runeManaCost??0);
      const attackConfig=a?.config||{},caveConfig=c?.config||{};
      quickControls.attack.checked=!!a?.running;
      quickControls.melee.checked=attackConfig.meleeMode===true;
      quickControls.stairs.checked=attackConfig.avoidFloorChangesOnChase!==false;
      quickControls.prioritize.checked=caveConfig.prioritizeMonsters===true;
      quickControls.sellerEnabled.checked=caveConfig.autoSellerVisit===true;
      if (document.activeElement!==quickSellerCap)
        quickSellerCap.value=String(caveConfig.minimumFreeCapacity ?? 50);
      quickControls.random.checked=caveConfig.randomizeMovement===true;
      quickControls.routeMode.value=caveConfig.routeTraversalMode||"pingpong";
      quickControls.leash.checked=caveConfig.limitChaseToRoute===true;
      quickControls.heal.checked=!!h?.running;
      quickControls.talk.checked=!!t?.running && t?.config?.replyMode==='gemini';
      quickControls.geminiAlarm.checked=t?.config?.alarmOnGeminiFailure===true;
      quickControls.smartChat.checked=bot.panic?.config?.smartChatAlertEnabled===true;
      quickControls.moderator.checked=caveConfig.pauseOnModeratorMessage===true;
      quickControls.verification.checked=caveConfig.pauseWaypointsOnVerification===true;
      quickControls.travelFight.checked=caveConfig.travelFight===true;
      quickControls.chase.value=attackConfig.chaseController||'hybrid';
      quickControls.chase.disabled=attackConfig.meleeMode===false;
      const panicConfig=bot.panic?.status?.()?.config||{};
      const floorStatusNow=bot.floorMove?.status?.()||{};
      const talkConfig=t?.config||{};
      const salesStatus=bot.autoSell?.status?.()||{};
      quickSet(extraQuick['allow-floors'],caveConfig.allowFloorTransitions===true);
      quickSet(extraQuick['tools-floor'],caveConfig.useWaypointTools!==false);
      quickSet(extraQuick['unknown-alarm'],panicConfig.unknownPlayerSoundAlertEnabled===true);
      quickSet(extraQuick['panic-unknown'],panicConfig.unknownPlayerEnabled===true);
      quickSet(extraQuick['panic-health'],panicConfig.healthLossEnabled===true);
      quickSet(extraQuick['panic-return'],panicConfig.returnToOriginEnabled===true);
      quickSet(extraQuick.private,talkConfig.replyToPrivate===true);
      quickSet(extraQuick.npc,talkConfig.replyToNpcs===true);
      quickSet(extraQuick['floor-enabled'],floorStatusNow.running===true);
      quickSet(extraQuick['floor-rares'],floorStatusNow.config?.includeRares===true);
      quickSet(extraQuick['floor-walk'],floorStatusNow.config?.walkToVisible===true);
      quickSet(quickFloorItems,floorStatusNow.config?.items||'');
      quickFloorStatus.textContent=floorStatusNow.running
        ? (floorStatusNow.config?.includeRares && !floorStatusNow.rareCatalogReady
            ? 'Waiting for Rare catalog: open /lootlist in Minibia once.' : 'Floor item mover active (no looting).')
        : 'Floor item mover OFF. Moves only matching items; it does not collect them.';
      quickSet(extraQuick.eat,bot.eat?.status?.()?.running===true);
      quickSet(extraQuick.invisible,bot.invisible?.status?.()?.running===true);
      quickSet(extraQuick.shield,bot.magicShield?.status?.()?.running===true);
      quickSet(extraQuick.ring,bot.equipRing?.status?.()?.running===true);
      quickSet(extraQuick['sell-enabled'],salesStatus.config?.enabled===true);
      quickSet(extraQuick['sell-return'],salesStatus.config?.autoReturnAfterSale===true);
      quickSet(quickSellItems,salesStatus.config?.allowedItems||'');
      for(const [name,advancedId] of [
        ['heal-hp','minibia-bot-auto-heal-min-hp'],
        ['heal-hp-key','minibia-bot-auto-heal-hp-hotkey'],
        ['heal-mana','minibia-bot-auto-heal-min-mana'],
        ['heal-mana-key','minibia-bot-auto-heal-mana-hotkey']
      ]) quickSet(quickBar.querySelector('#minibia-bot-quick-'+name),panel.querySelector('#'+advancedId)?.value||'');
      const advancedLoot=panel.querySelector('#minibia-bot-native-loot-names');
      quickSet(quickLootNames,advancedLoot?.value||'');

      // Keep advanced inputs mirrored; never maintain a separate quick preset.
      const mirror=(id,value)=>{const input=panel.querySelector('#'+id);if(input && document.activeElement!==input){
        if(input.type==='checkbox') input.checked=!!value; else input.value=String(value);
      }};
      mirror('minibia-bot-auto-attack-enabled',!!a?.running);
      mirror('minibia-bot-auto-attack-melee',attackConfig.meleeMode===true);
      mirror('minibia-bot-auto-attack-avoid-stairs',attackConfig.avoidFloorChangesOnChase!==false);
      mirror('minibia-bot-auto-attack-chase-controller',attackConfig.chaseController||'hybrid');
      mirror('minibia-bot-cave-prioritize-monsters',caveConfig.prioritizeMonsters===true);
      mirror('minibia-bot-seller-enabled',caveConfig.autoSellerVisit===true);
      mirror('minibia-bot-cave-random-movement',caveConfig.randomizeMovement===true);
      mirror('minibia-bot-cave-route-mode',caveConfig.routeTraversalMode||'pingpong');
      mirror('minibia-bot-cave-moderator-pause',caveConfig.pauseOnModeratorMessage===true);
      mirror('minibia-bot-cave-verification-pause',caveConfig.pauseWaypointsOnVerification===true);
      mirror('minibia-bot-cave-verification-auto-resume',caveConfig.autoResumeAfterVerification!==false);
      mirror('minibia-bot-panic-unknown-alarm',bot.panic?.config?.unknownPlayerSoundAlertEnabled===true);
      mirror('minibia-bot-panic-smart-chat',bot.panic?.config?.smartChatAlertEnabled===true);
      mirror('minibia-bot-cave-limit-chase',caveConfig.limitChaseToRoute===true);
      mirror('minibia-bot-auto-heal-enabled',!!h?.running);
      mirror('minibia-bot-talk-enabled',!!t?.running);
      mirror('minibia-bot-talk-mode',t?.config?.replyMode||'rules');
      mirror('minibia-bot-talk-gemini-alarm',t?.config?.alarmOnGeminiFailure===true);
      mirror('minibia-bot-rune-enabled',!!r?.running);
      mirror('minibia-bot-rune-spell',runeConfig.runeSpellWords||'');
      mirror('minibia-bot-rune-mana',runeConfig.runeManaCost??0);
      mirror('minibia-bot-rune-interval-min',(runeConfig.runeCooldownMinMs??runeConfig.runeCooldownMs??3500)/1000);
      mirror('minibia-bot-rune-interval-max',(runeConfig.runeCooldownMaxMs??runeConfig.runeCooldownMs??3500)/1000);
      mirror('minibia-bot-panic-unknown',panicConfig.unknownPlayerEnabled===true);
      mirror('minibia-bot-panic-health',panicConfig.healthLossEnabled===true);
      mirror('minibia-bot-panic-return',panicConfig.returnToOriginEnabled===true);
      mirror('minibia-bot-talk-private-replies',talkConfig.replyToPrivate===true);
      mirror('minibia-bot-talk-npc-replies',talkConfig.replyToNpcs===true);
      mirror('minibia-bot-floor-move-enabled',floorStatusNow.running===true);
      mirror('minibia-bot-floor-move-rares',floorStatusNow.config?.includeRares===true);
      mirror('minibia-bot-floor-move-walk',floorStatusNow.config?.walkToVisible===true);
      mirror('minibia-bot-floor-move-items',floorStatusNow.config?.items||'');
      mirror('minibia-bot-auto-eat-enabled',bot.eat?.status?.()?.running===true);
      mirror('minibia-bot-auto-invisible-enabled',bot.invisible?.status?.()?.running===true);
      mirror('minibia-bot-auto-magic-shield-enabled',bot.magicShield?.status?.()?.running===true);
      mirror('minibia-bot-equip-ring-enabled',bot.equipRing?.status?.()?.running===true);
      mirror('minibia-bot-auto-sell-enabled',salesStatus.config?.enabled===true);
      mirror('minibia-bot-auto-sell-return',salesStatus.config?.autoReturnAfterSale===true);
      mirror('minibia-bot-auto-sell-items',salesStatus.config?.allowedItems||'');
      const chaseAdvanced=panel.querySelector('#minibia-bot-auto-attack-chase-controller');
      if(chaseAdvanced) chaseAdvanced.disabled=attackConfig.meleeMode===false;
      quickSummary.textContent=`Attack ${a?.running?'ON':'OFF'} · Melee ${attackConfig.meleeMode?'ON':'OFF'} · Heal ${h?.running?'ON':'OFF'} · `+
        `Gemini ${quickControls.talk.checked?'ON':'OFF'} · Seller ${caveConfig.autoSellerVisit?'ON':'OFF'} · `+
        `GM ${caveConfig.pauseOnModeratorMessage?'ON':'OFF'} · CAPTCHA ${caveConfig.pauseWaypointsOnVerification?'ON':'OFF'} · `+
        `Rare mover ${floorStatusNow.running?'ON':'OFF'} · Stairs ${attackConfig.avoidFloorChangesOnChase!==false?'PROTECTED':'UNPROTECTED'} · `+
        `${c?.sellerRouteInfo?.valid?'Seller route ready':'Seller route not ready'}`;
    }
    let lastHuntStartInfo = null;
    function refreshSafetySummary() {
      const c=bot.cave?.status?.()||{};
      const em=bot.emergencyState?.()||{};
      const p=bot.panic?.status?.()||{};
      const alert=bot.alarmStatus?.()?.last;
      const routeLabel=quickBar.querySelector('#minibia-bot-quick-route-check');
      const alertLabel=quickBar.querySelector('#minibia-bot-quick-alarm-reason');
      const holdLabel=quickBar.querySelector('#minibia-bot-quick-hold-reason');
      const talkLabel=quickBar.querySelector('#minibia-bot-quick-talk-trace');
      const sellerLabel=quickBar.querySelector('#minibia-bot-quick-seller-trace');
      const huntRoute=c.route||[];
      const routeName=c.activePresetName || quickRoute?.value || '(ninguna)';
      const warnings=[];
      if (!huntRoute.length) warnings.push('ruta de caza vacía');
      if (c.config?.autoSellerVisit && !c.sellerRouteInfo?.valid) warnings.push('Shanar no conectado');
      if (huntRoute.some(w=>w && w.z!==huntRoute[0]?.z) && !c.config?.allowFloorTransitions)
        warnings.push('ruta cambia de piso y las transiciones están OFF');
      if (c.config?.autoSellerVisit) {
        const sale=bot.autoSell?.status?.()||{};
        if (!sale.config?.enabled) warnings.push('Auto Sell OFF');
        if (!String(sale.config?.allowedItems||'').trim()) warnings.push('sin lista de venta');
      }
      if (routeLabel) routeLabel.textContent =
        `Rutas: ${routeName} (${huntRoute.length} WP) · Shanar ${c.sellerRouteInfo?.valid ? 'conectado' : 'sin validar'}` +
        (warnings.length ? ` · REVISAR: ${warnings.join('; ')}` : ' · configuración básica OK');
      if (alertLabel) alertLabel.textContent = alert
        ? `Última alarma ${new Date(alert.at).toLocaleTimeString()}: ${alert.message} · ${alert.effect}`+
          (alert.source ? ` · Origen: ${alert.source} · Canal: ${alert.channel||'?'} · Remitente: ${alert.sender||'?'} · Texto: ${alert.systemText||'(sin texto)'}` : '')
        : 'Última alarma: ninguna registrada en esta pestaña';
      if (talkLabel) {
        const talk=bot.talk?.status?.()||{};
        const event=talk.lastEvent;
        talkLabel.textContent=event
          ? `Gemini: ${event.type} · ${event.sender || 'sistema'} · ${event.channel || '-'} · ${event.reason || event.stage || ''} · ${new Date(event.at).toLocaleTimeString()}`
          : `Gemini: ${talk.running?'activo':'apagado'} · sin eventos registrados (F12: minibiaBot.talk.history())`;
      }
      if (sellerLabel) {
        const phase=c.sellerTrip?.phase;
        const seller=bot.autoSell?.status?.()||{};
        const warnings=[];
        if(c.config?.autoSellerVisit && !c.sellerRouteInfo?.valid) warnings.push('ruta Shanar inválida');
        if(c.config?.autoSellerVisit && !seller.config?.enabled) warnings.push('Auto Sell OFF');
        if(c.config?.autoSellerVisit && !seller.config?.autoReturnAfterSale) warnings.push('Return to hunt OFF');
        sellerLabel.textContent=`HUNT + SELLER: ${!c.config?.autoSellerVisit?'OFF':phase || (c.running?'cazando / esperando límite de capacidad':'pendiente de START HUNT')}` +
          ` · cap ${Number.isFinite(c.freeCapacity)?c.freeCapacity:'?'} / límite ${c.config?.minimumFreeCapacity||'?'} oz`+
          (warnings.length?' · REVISAR: '+warnings.join(', '):'') +
          (lastHuntStartInfo?` · Último START HUNT: ${lastHuntStartInfo}`:'');
      }
      if (!holdLabel) return;
      const reasons=[];
      if (em.halted) reasons.push('EMERGENCY STOP: usar botón de recuperación');
      if (c.pausedForVerification) reasons.push(`CAPTCHA: ${c.verificationAutoResume?.reason||'esperando resolución'}; ${c.verificationAutoResume?.enabled?'autorreanudar activado':'RESTORE manual'}`);
      if (c.moderatorPaused) reasons.push(`GM: pausa temporal (${Math.ceil((c.moderatorPauseRemainingMs||0)/1000)} s)`);
      if (p.pendingReturn) reasons.push('Panic Runner: retorno pendiente');
      if (c.lastRoutePathError && c.lastRoutePathErrorAt && Date.now()-c.lastRoutePathErrorAt<90000)
        reasons.push(`Último problema de ruta: ${c.lastRoutePathError}`);
      if (!c.running && !reasons.length) reasons.push('Cave Bot apagado (la última alarma no demuestra la causa)');
      if (holdLabel) holdLabel.textContent = `Movimiento: ${reasons.length ? reasons.join(' · ') : 'sin bloqueos detectados'}`;
    }

    function refreshQuickRoutes() {
      const names=bot.cave?.getPresetNames?.()||[];
      refreshSafetySummary();
      const homeSelected=bot.cave?.config?.homePresetName||'';
      const sellerSelected=bot.cave?.config?.sellerPresetName||'';
      if (quickSellerRoute.options.length!==names.length+1 ||
          names.some((n,i)=>quickSellerRoute.options[i+1]?.value!==n)) {
        quickSellerRoute.replaceChildren();
        const emptySeller=document.createElement('option');
        emptySeller.value='';emptySeller.textContent='Select Shanar route';quickSellerRoute.append(emptySeller);
        for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;quickSellerRoute.append(option);}
      }
      if(document.activeElement!==quickSellerRoute) quickSellerRoute.value=names.includes(sellerSelected)?sellerSelected:'';
      if (quickHomeRoute.options.length!==names.length+1 ||
          names.some((n,i)=>quickHomeRoute.options[i+1]?.value!==n)) {
        quickHomeRoute.replaceChildren();
        const empty=document.createElement('option');empty.value='';empty.textContent='Select home route';quickHomeRoute.append(empty);
        for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;quickHomeRoute.append(option);}
      }
      if(document.activeElement!==quickHomeRoute) quickHomeRoute.value=names.includes(homeSelected)?homeSelected:'';
      const selected=quickRoute.value||bot.storage.get('minibiaBot.quick.route','')||bot.cave?.getActivePresetName?.();
      if(quickRoute.options.length!==names.length||names.some((n,i)=>quickRoute.options[i]?.value!==n)) {
        quickRoute.replaceChildren();
        for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;quickRoute.append(option);}
        if(names.includes(selected)) quickRoute.value=selected;
      }
      quickStart.disabled=!names.length;
      const em=bot.emergencyState?.();
      const caveStatus=bot.cave?.status?.()||{};
      const trip=caveStatus.sellerTrip;
      if (!em?.halted && caveStatus.verificationLastRestoreAt &&
          Date.now()-caveStatus.verificationLastRestoreAt < 12000) {
        quickStatus.textContent=caveStatus.verificationLastRestore?.reason || 'Verification restore complete';
        refreshQuickSummary();
        return;
      }
      if (quickStartWarning && Date.now()-quickStartWarningAt<20000 && caveStatus.running) {
        quickStatus.textContent='HUNT ACTIVA'+quickStartWarning;
        refreshQuickSummary();
        return;
      }
      quickStatus.textContent=em?.halted ? (em.canResume ? 'Emergency paused. Use ▶ to resume previous modules.' : 'Emergency paused; reload cleared resume snapshot.') :
        (trip?.kind==='home' ? (trip.phase==='waiting-at-home'?'At HOME — choose GO HUNT to return':'Home travel: '+trip.phase) :
        (caveStatus.moderatorPaused ? 'GM ALERT: standing still; attack in place; alarm sounded' :
        caveStatus.pausedForVerification ? `CAPTCHA ${caveStatus.verificationLastPhase||''}: ataque quieto; ${caveStatus.verificationAutoResume?.enabled?'auto-reanudación pendiente':'usar RESTORE tras resolver'}` :
        (trip && trip.kind!=='home' ? ({
          'seller-return':'YENDO A LA HUNT',
          'exit-hunt':'SALIENDO DE LA HUNT HACIA SHANAR',
          'seller-out':'YENDO A SHANAR',
          'waiting-at-seller':'EN SHANAR · VENDIENDO'
        }[trip.phase] || ('VIAJE A SHANAR: '+trip.phase)) :
        (caveStatus.running ? 'HUNT ACTIVA' : 'HUNT DETENIDA'))));
      refreshQuickSummary();
    }
    quickRoute.addEventListener('change',()=>bot.storage.set('minibiaBot.quick.route',quickRoute.value));
    quickHomeRoute.addEventListener('change',()=>{
      bot.cave?.updateConfig?.({homePresetName:quickHomeRoute.value});refreshQuickSummary();
    });
    quickSellerRoute.addEventListener('change',()=>{
      bot.cave?.updateConfig?.({sellerPresetName:quickSellerRoute.value});
      refreshSellerRouteOptions();refreshQuickSummary();
    });
    quickGoHome.addEventListener('click',()=>{
      quickStatus.textContent=bot.cave?.goHome?.() ? 'GO HOME started' :
        'GO HOME failed: START HUNT first, save/select route from hunt WP1 to marked Home, and check alerts';
    });
    quickGoHunt.addEventListener('click',()=>{
      if(!bot.cave?.status?.()?.running && quickRoute.value)
        bot.cave?.loadPreset?.(quickRoute.value);
      quickStatus.textContent=bot.cave?.goToHunt?.() ? 'GO HUNT from Home started' :
        'GO HUNT from Home failed: need completed GO HOME or stand on marked Home with valid recorded route';
    });
    quickAlarm.addEventListener('click',()=>{
      bot.unlockAudio?.();bot.reportAlarm?.('test', 'Prueba manual de sonido', 'Solo sonido; no detuvo el bot');quickStatus.textContent='Alarm test requested (check browser sound)';
    });
    quickResumeNotice.addEventListener('click',()=>{
      const result=bot.cave?.resumeAfterVerification?.();
      quickStatus.textContent=result?.reason || 'Unable to restore verification session';
      refreshQuickSummary();
    });
    function quickControl(id,callback){quickControls[id].addEventListener('change',()=>{
      if(bot.emergencyState?.().halted) bot.emergencyDismiss?.();
      callback(quickControls[id].type==='checkbox'?quickControls[id].checked:quickControls[id].value);
      refreshQuickSummary();
    });}
    quickControl('attack',(on)=>on?bot.attack.start():bot.attack.stop());
    quickControl('melee',(on)=>bot.attack.updateConfig({meleeMode:on}));
    quickControl('stairs',(on)=>bot.attack.updateConfig({avoidFloorChangesOnChase:on}));
    quickControl('prioritize',(on)=>bot.cave.updateConfig({prioritizeMonsters:on}));
    quickControl('sellerEnabled',(on)=>bot.cave.updateConfig({autoSellerVisit:on}));
    quickSellerCap.addEventListener('change',()=>{
      bot.cave.updateConfig({minimumFreeCapacity:Number(quickSellerCap.value)});
      refreshQuickSummary();
    });
    quickControl('random',(on)=>bot.cave.updateConfig({randomizeMovement:on}));
    quickControl('routeMode',(value)=>bot.cave.updateConfig({routeTraversalMode:value}));
    quickControl('moderator',(on)=>bot.cave.updateConfig({pauseOnModeratorMessage:on}));
    quickControl('verification',(on)=>bot.cave.updateConfig({pauseWaypointsOnVerification:on}));
    quickControl('travelFight',(on)=>bot.cave.updateConfig({travelFight:on}));
    quickControl('leash',(on)=>bot.cave.updateConfig({limitChaseToRoute:on}));
    quickControl('heal',(on)=>on?bot.heal.start():bot.heal.stop());
    quickControl('chase',(value)=>bot.attack.updateConfig({chaseController:value}));
    quickControl('geminiAlarm',(on)=>bot.talk.updateConfig({alarmOnGeminiFailure:on}));
    quickControl('smartChat',(on)=>{
      bot.panic.updateConfig({smartChatAlertEnabled:on, ...(on?{unknownPlayerSoundAlertEnabled:false}:{})});
      refreshPanicStatus();
    });
    // Hub and Advanced controls share the same real modules and storage. No independent presets.
    const fromAdvanced = (advancedId, value, kind='change') => {
      const advanced=panel.querySelector('#'+advancedId);
      if(!advanced) return false;
      if(advanced.type==='checkbox') advanced.checked=!!value;
      else if(value!==undefined) advanced.value=String(value);
      advanced.dispatchEvent(new Event(kind,{bubbles:true}));
      return true;
    };
    function quickExtra(name, change) {
      extraQuick[name]?.addEventListener('change',()=>{
        if(bot.emergencyState?.().halted) bot.emergencyDismiss?.();
        change(extraQuick[name].checked);
        refreshQuickSummary();
      });
    }
    quickExtra('allow-floors',value=>bot.cave?.updateConfig?.({allowFloorTransitions:value}));
    quickExtra('tools-floor',value=>bot.cave?.updateConfig?.({useWaypointTools:value}));
    quickExtra('unknown-alarm',value=>{
      bot.panic?.updateConfig?.({unknownPlayerSoundAlertEnabled:value,
        ...(value?{smartChatAlertEnabled:false}:{})});
      refreshPanicStatus();
    });
    quickExtra('panic-unknown',value=>bot.panic?.updateConfig?.({unknownPlayerEnabled:value}));
    quickExtra('panic-health',value=>bot.panic?.updateConfig?.({healthLossEnabled:value}));
    quickExtra('panic-return',value=>bot.panic?.updateConfig?.({returnToOriginEnabled:value}));
    quickExtra('private',value=>bot.talk?.updateConfig?.({replyToPrivate:value}));
    quickExtra('npc',value=>bot.talk?.updateConfig?.({replyToNpcs:value}));
    quickExtra('floor-rares',value=>bot.floorMove?.updateConfig?.({includeRares:value}));
    quickExtra('floor-walk',value=>bot.floorMove?.updateConfig?.({walkToVisible:value}));
    quickExtra('floor-enabled',value=>{
      const ok=fromAdvanced('minibia-bot-floor-move-enabled',value);
      if(!ok && bot.floorMove) value?bot.floorMove.start():bot.floorMove.stop();
    });
    quickFloorItems?.addEventListener('change',()=>{
      bot.floorMove?.updateConfig?.({items:quickFloorItems.value});
      refreshQuickSummary();
    });
    for(const [name,module] of [['eat','eat'],['invisible','invisible'],['shield','magicShield'],['ring','equipRing']]) {
      quickExtra(name,value=>{
        if(value) bot[module]?.start?.(); else bot[module]?.stop?.();
      });
    }
    quickExtra('sell-enabled',value=>fromAdvanced('minibia-bot-auto-sell-enabled',value));
    quickExtra('sell-return',value=>fromAdvanced('minibia-bot-auto-sell-return',value));
    quickSellItems?.addEventListener('change',()=>{
      fromAdvanced('minibia-bot-auto-sell-items',quickSellItems.value);
      refreshQuickSummary();
    });
    for(const [quickId,advancedId] of [
      ['heal-hp','minibia-bot-auto-heal-min-hp'],
      ['heal-hp-key','minibia-bot-auto-heal-hp-hotkey'],
      ['heal-mana','minibia-bot-auto-heal-min-mana'],
      ['heal-mana-key','minibia-bot-auto-heal-mana-hotkey']
    ]) quickBar.querySelector('#minibia-bot-quick-'+quickId)?.addEventListener('change',event=>{
      fromAdvanced(advancedId,event.target.value);
      refreshQuickSummary();
    });
    for(const [source,destination,button] of [
      ['trusted-name','minibia-bot-panic-trusted-input','minibia-bot-panic-trusted-add'],
      ['gm-name','minibia-bot-panic-gm-input','minibia-bot-panic-gm-add']
    ]) quickBar.querySelector('#minibia-bot-quick-'+(source==='trusted-name'?'trusted-add':'gm-add'))?.addEventListener('click',()=>{
      const input=quickBar.querySelector('#minibia-bot-quick-'+source);
      const name=String(input?.value||'').trim();
      if(!name) return;
      const advanced=panel.querySelector('#'+destination);
      const add=panel.querySelector('#'+button);
      if(advanced && add) {advanced.value=name;add.click(); input.value='';quickStatus.textContent='Name added to Monitoring list';}
    });
    quickBar.querySelector('#minibia-bot-quick-floor-scan')?.addEventListener('click',()=>{
      fromAdvanced('minibia-bot-floor-move-scan',undefined,'click');
      const advancedStatus=panel.querySelector('#minibia-bot-floor-move-status');
      quickFloorStatus.textContent=advancedStatus?.textContent||'Scan requested';
    });
    quickBar.querySelector('#minibia-bot-quick-test-gemini')?.addEventListener('click',()=>{
      const fold=panel.querySelector('#minibia-bot-talk-test')?.closest('details');
      if(fold) fold.open=true;
      // Use the exact existing preview function in the advanced panel.
      panel.querySelector('#minibia-bot-talk-test')?.click();
      quickStatus.textContent='Gemini preview requested; result appears in Gemini / Auto Chat.';
    });
    for (const [quickId,advancedId] of [
      ['wp-record','minibia-bot-cave-record'],
      ['wp-undo','minibia-bot-cave-remove-last'],
      ['wp-new','minibia-bot-cave-preset-new'],
      ['loot-open','minibia-bot-native-loot-open'],
      ['loot-apply','minibia-bot-native-loot-apply']
    ]) {
      quickBar.querySelector('#minibia-bot-quick-'+quickId)?.addEventListener('click',()=>{
        if(quickId==='loot-apply') {
          const advanced=panel.querySelector('#minibia-bot-native-loot-names');
          if(advanced) advanced.value=quickLootNames.value;
        }
        if((quickId==='wp-record'||quickId==='wp-undo') && quickRoute.value &&
           bot.cave?.getActivePresetName?.()!==quickRoute.value) {
          if(bot.cave?.status?.()?.running) {
            quickStatus.textContent='Stop the hunt before editing another waypoint route.';
            return;
          }
          if(!bot.cave?.loadPreset?.(quickRoute.value)) {
            quickStatus.textContent='Could not load selected hunt preset for waypoint editing.';
            return;
          }
        }
        const advanced=panel.querySelector('#'+advancedId);
        if(!advanced) {quickStatus.textContent='This advanced control is not available';return;}
        advanced.click();
        if(quickId.startsWith('wp-')) {
          refreshQuickRoutes();
          quickStatus.textContent=quickId==='wp-record'?'Waypoint recorded in active route':
            quickId==='wp-undo'?'Last waypoint remove requested':'New route dialog opened';
        } else if(quickId==='loot-apply') {
          quickStatus.textContent=panel.querySelector('#minibia-bot-native-loot-status')?.textContent||'Native loot update requested';
        }
      });
    }
    function quickMlSave(changedField='') {
      const runeConfig=bot.rune?.config||{};
      const runeSpellWords=quickMlSpell.value.trim().slice(0,90);
      const previousMin=(runeConfig.runeCooldownMinMs??runeConfig.runeCooldownMs??3500)/1000;
      const previousMax=(runeConfig.runeCooldownMaxMs??runeConfig.runeCooldownMs??3500)/1000;
      const parseSeconds=(input,fallback)=>{
        const n=Number(input.value);
        return input.value.trim()!=='' && Number.isFinite(n) ? Math.min(3600,Math.max(1,n)) : fallback;
      };
      let min=parseSeconds(quickMlMin,previousMin);
      let max=parseSeconds(quickMlMax,previousMax);
      if(min>max) {if(changedField==='max') min=max; else max=min;}
      const runeManaCost=Math.max(0,Math.floor(Number(quickMlMana.value)||0));
      bot.rune?.updateConfig?.({runeSpellWords,runeCooldownMinMs:Math.round(min*1000),runeCooldownMaxMs:Math.round(max*1000),runeManaCost});
      refreshQuickSummary();
    }
    quickMlSpell.addEventListener('change',()=>quickMlSave());
    quickMlMin.addEventListener('change',()=>quickMlSave('min'));
    quickMlMax.addEventListener('change',()=>quickMlSave('max'));
    quickMlMana.addEventListener('change',()=>quickMlSave());
    quickMlEnabled.addEventListener('change',()=>{
      const desiredRunning=quickMlEnabled.checked; // Save refreshes UI, so preserve the user's click.
      quickMlSave();
      if(desiredRunning) bot.rune?.start?.(); else bot.rune?.stop?.();
      refreshRuneStatus();refreshQuickSummary();
    });
    quickControl('talk',(on)=>{
      if(on){bot.talk.updateConfig({replyMode:'gemini'});if(!bot.talk.status().running) {
        if(!bot.talk.start()) quickStatus.textContent='Gemini could not start; check API key in Talk';
      }}else if(bot.talk.status().config.replyMode==='gemini') bot.talk.stop();
      refreshTalkStatus();
    });
    quickStart.addEventListener('click',()=>{
      const name=quickRoute.value;
      if(!name){quickStatus.textContent='Elegí una ruta de caza primero.';return;}
      const loaded=bot.cave?.loadPreset?.(name);
      if(!loaded){quickStatus.textContent='No se pudo cargar la ruta: '+name;return;}
      if(!Array.isArray(loaded.route)||!loaded.route.length){
        quickStatus.textContent='La ruta '+name+' está vacía: grabá un waypoint antes de START HUNT.';
        return;
      }
      bot.storage.set('minibiaBot.quick.route',name);
      // One button: when HUNT + SELLER is checked, Cave Bot detects whether
      // to navigate the saved Shanar corridor or start hunting in place.
      // No automatic checkbox changes and no second Shanar button.
      // Do not clear an emergency stop just by pressing START HUNT.
      let result;
      try { result=bot.cave?.startHuntCycle?.(); }
      catch(e) {
        console.error('[minibia-bot] START HUNT failed',e);
        lastHuntStartInfo='ERROR '+(e?.message||String(e));
        quickStatus.textContent='START HUNT ERROR: '+(e?.message||String(e));
        refreshSafetySummary();
        return;
      }
      const ok=typeof result==='boolean' ? result : !!result?.ok;
      const mode=result?.mode||'hunt';
      const reason=result?.reason||'';
      lastHuntStartInfo=ok?(reason|| (mode==='go-to-hunt'?'Yendo a hunt':mode==='sell-first'?'Venta antes de cazar':'Iniciado')):
        ('NO INICIÓ: '+(reason||'Motivo no informado'));
      quickStartWarning=''; quickStartWarningAt=0;
      const caveNow=bot.cave?.status?.()||{};
      const modeLabel={
        'go-to-hunt':'VIAJANDO A LA HUNT',
        'sell-first':'VENDIENDO ANTES DE CAZAR',
        'hunt':'HUNT INICIADA',
        'hunt-already-running':'HUNT YA ACTIVA',
        'hunt-seller-pending':'HUNT INICIADA · SELLER PENDIENTE'
      }[mode]||'HUNT INICIADA';
      quickStatus.textContent=ok ? `${modeLabel}: ${name}${reason?' · '+reason:''}` :
        ('NO INICIÓ: '+(reason||caveNow.lastRoutePathError||'revisá los waypoints y la ruta a Shanar'));
      refreshQuickSummary();
      refreshSafetySummary();
      refreshEntryCount();
    });
    quickStop.addEventListener('click',()=>{
      bot.cave?.stop?.();bot.attack?.stop?.();
      quickStatus.textContent='Hunt stopped; other utilities still active';refreshQuickSummary();
    });
    // A deliberate advanced control change supersedes any pending resume snapshot.
    panel.addEventListener('change',(event)=>{
      if(bot.emergencyState?.().halted && event.target !== quickRoute &&
          !quickBar.contains(event.target)) bot.emergencyDismiss?.();
    });
    refreshQuickRoutes();
    // One source of truth: advanced panel events change modules; this reads those modules.
    const quickRefreshTimer=window.setInterval(refreshQuickRoutes,800);
    bot.addCleanup(()=>window.clearInterval(quickRefreshTimer));

    const unlockAudio = () => {
      bot.unlockAudio?.();
    };

    panel.addEventListener("pointerdown", unlockAudio, { passive: true });
    panel.addEventListener("keydown", unlockAudio);

    bot.addCleanup(() => {
      panel.removeEventListener("pointerdown", unlockAudio);
      panel.removeEventListener("keydown", unlockAudio);
    });

    applySavedPanelSize(panel);
    applySavedPanelPosition(panel);
    enableDrag(panel);
    enablePanelResize(panel);
    setPanelCollapsed(panel, getSavedPanelCollapsed());

    const spellInput = panel.querySelector("#minibia-bot-rune-spell");
    const manaInput = panel.querySelector("#minibia-bot-rune-mana");
    const runeMinInput = panel.querySelector("#minibia-bot-rune-interval-min");
    const runeMaxInput = panel.querySelector("#minibia-bot-rune-interval-max");
    const runeEnabledInput = panel.querySelector("#minibia-bot-rune-enabled");
    const autoEatEnabledInput = panel.querySelector("#minibia-bot-auto-eat-enabled");
    const autoEatHotkeyInput = panel.querySelector("#minibia-bot-auto-eat-hotkey");
    const autoInvisibleEnabledInput = panel.querySelector("#minibia-bot-auto-invisible-enabled");
    const autoMagicShieldEnabledInput = panel.querySelector("#minibia-bot-auto-magic-shield-enabled");
    const equipRingEnabledInput = panel.querySelector("#minibia-bot-equip-ring-enabled");
    const autoHealEnabledInput = panel.querySelector("#minibia-bot-auto-heal-enabled");
    const autoHealMinHpInput = panel.querySelector("#minibia-bot-auto-heal-min-hp");
    const autoHealHpHotkeyInput = panel.querySelector("#minibia-bot-auto-heal-hp-hotkey");
    const autoHealMinManaInput = panel.querySelector("#minibia-bot-auto-heal-min-mana");
    const autoHealManaHotkeyInput = panel.querySelector("#minibia-bot-auto-heal-mana-hotkey");
    const autoAttackEnabledInput = panel.querySelector("#minibia-bot-auto-attack-enabled");
    const autoAttackMeleeInput = panel.querySelector("#minibia-bot-auto-attack-melee");
    const autoAttackChaseController = panel.querySelector("#minibia-bot-auto-attack-chase-controller");
    const autoAttackAvoidStairsInput = panel.querySelector("#minibia-bot-auto-attack-avoid-stairs");
    const autoAttackHotkeyInput = panel.querySelector("#minibia-bot-auto-attack-hotkey");
    const autoAttackRuneHotkeyInput = panel.querySelector("#minibia-bot-auto-attack-rune-hotkey");
    const floorMoveToggle = panel.querySelector("#minibia-bot-floor-move-enabled");
    const floorMoveItems = panel.querySelector("#minibia-bot-floor-move-items");
    const floorMoveRares = panel.querySelector("#minibia-bot-floor-move-rares");
    const floorMoveWalk = panel.querySelector("#minibia-bot-floor-move-walk");
    const floorMoveScan = panel.querySelector("#minibia-bot-floor-move-scan");
    const floorMoveStatus = panel.querySelector("#minibia-bot-floor-move-status");
    const talkTestButton = panel.querySelector("#minibia-bot-talk-test");
    const talkTestMessage = panel.querySelector("#minibia-bot-talk-test-message");
    const talkTestResult = panel.querySelector("#minibia-bot-talk-test-result");
    let talkPreviewSequence = 0;
    talkTestButton?.addEventListener("click", async () => {
      const message = talkTestMessage?.value?.trim();
      if (!message) { talkTestResult.textContent = "Enter a test message first."; talkTestResult.hidden = false; return; }
      const sequence = ++talkPreviewSequence;
      talkTestButton.disabled = true;
      talkTestResult.hidden = false;
      talkTestResult.textContent = "Generating preview… (no chat message will be sent)";
      try {
        // Read the latest values even before user blurs a field.
        bot.talk?.updateConfig?.({
          apiKey: panel.querySelector("#minibia-bot-talk-api-key")?.value?.trim() || "",
          systemPrompt: panel.querySelector("#minibia-bot-talk-prompt")?.value?.trim() || bot.talk?.config?.systemPrompt,
          replyMode: panel.querySelector("#minibia-bot-talk-mode")?.value || "gemini",
          ruleText: panel.querySelector("#minibia-bot-talk-rules")?.value || ""
        });
        const result = await bot.talk?.previewReply?.(message);
        if (sequence === talkPreviewSequence && document.getElementById("minibia-bot-panel") === panel) {
          talkTestResult.textContent = result ? `Preview: ${result}` : "No matching keyword / empty response.";
        }
      } catch (error) {
        if (sequence === talkPreviewSequence && document.getElementById("minibia-bot-panel") === panel) {
          talkTestResult.textContent = `Test failed: ${String(error?.message || error).slice(0, 350)}`;
        }
      } finally {
        if (sequence === talkPreviewSequence) talkTestButton.disabled = false;
      }
    });
    const talkEnabledInput = panel.querySelector("#minibia-bot-talk-enabled");
    const talkModeInput = panel.querySelector("#minibia-bot-talk-mode");
    const talkGeminiAlarmInput = panel.querySelector("#minibia-bot-talk-gemini-alarm");
    talkGeminiAlarmInput?.addEventListener('change',()=>{
      bot.talk?.updateConfig?.({alarmOnGeminiFailure:talkGeminiAlarmInput.checked});
      refreshQuickSummary();
    });
    const talkAiSettings = panel.querySelector("#minibia-bot-talk-ai-settings");
    const talkRulesInput = panel.querySelector("#minibia-bot-talk-rules");
    const talkMinDelayInput = panel.querySelector("#minibia-bot-talk-min-delay");
    const talkMaxDelayInput = panel.querySelector("#minibia-bot-talk-max-delay");
    const talkNpcInput = panel.querySelector("#minibia-bot-talk-npc-replies");
    const talkPrivateInput = panel.querySelector("#minibia-bot-talk-private-replies");
    const talkApiKeyInput = panel.querySelector("#minibia-bot-talk-api-key");
    const talkPromptInput = panel.querySelector("#minibia-bot-talk-prompt");
    const panicGmNameInput = panel.querySelector("#minibia-bot-panic-gm-input");
    const panicGmAddButton = panel.querySelector("#minibia-bot-panic-gm-add");
    const panicUnknownInput = panel.querySelector("#minibia-bot-panic-unknown");
    const panicUnknownAlarmInput = panel.querySelector("#minibia-bot-panic-unknown-alarm");
    const panicSmartChatInput = panel.querySelector("#minibia-bot-panic-smart-chat");
    const panicHealthInput = panel.querySelector("#minibia-bot-panic-health");
    const panicReturnInput = panel.querySelector("#minibia-bot-panic-return");
    const panicTrustedInput = panel.querySelector("#minibia-bot-panic-trusted-input");
    const panicTrustedAddButton = panel.querySelector("#minibia-bot-panic-trusted-add");
    const xrayOverlayButton = panel.querySelector("#minibia-bot-xray-overlay-toggle");
    const xrayFloorSelect = panel.querySelector("#minibia-bot-xray-floor-select");
    const collapseButton = panel.querySelector("#minibia-bot-collapse");
    const reloadButton = panel.querySelector("#minibia-bot-reload");
    const cavePrioritizeMonstersInput = panel.querySelector("#minibia-bot-cave-prioritize-monsters");
    const sellerEnabledInput = panel.querySelector("#minibia-bot-seller-enabled");
    const sellerCapInput = panel.querySelector("#minibia-bot-seller-cap");
    const sellerRouteSelect = panel.querySelector("#minibia-bot-seller-route");
    const sellerReturnRouteSelect = panel.querySelector("#minibia-bot-seller-return-route");
    const autoSellEnabled = panel.querySelector("#minibia-bot-auto-sell-enabled");
    const autoSellNpc = panel.querySelector("#minibia-bot-auto-sell-npc");
    const autoSellItems = panel.querySelector("#minibia-bot-auto-sell-items");
    const autoSellReturn = panel.querySelector("#minibia-bot-auto-sell-return");
    const autoSellStatus = panel.querySelector("#minibia-bot-auto-sell-status");
    const autoSellTest = panel.querySelector("#minibia-bot-auto-sell-test");
    const nativeLootNames = panel.querySelector("#minibia-bot-native-loot-names");
    const nativeLootOpen = panel.querySelector("#minibia-bot-native-loot-open");
    const nativeLootApply = panel.querySelector("#minibia-bot-native-loot-apply");
    const nativeLootStatus = panel.querySelector("#minibia-bot-native-loot-status");
    const sellerFightOutboundInput = panel.querySelector("#minibia-bot-seller-fight-outbound");
    const sellerFightReturnInput = panel.querySelector("#minibia-bot-seller-fight-return");
    const sellerConfirmButton = panel.querySelector("#minibia-bot-seller-confirm");
    const sellerAbortButton = panel.querySelector("#minibia-bot-seller-abort");
    const sellerStatusLabel = panel.querySelector("#minibia-bot-seller-status");
    const caveToolsInput = panel.querySelector("#minibia-bot-cave-tools");
    const caveLimitChaseInput = panel.querySelector("#minibia-bot-cave-limit-chase");
    const caveMaxChaseInput = panel.querySelector("#minibia-bot-cave-max-chase");
    const caveEntryCountInput = panel.querySelector("#minibia-bot-cave-entry-count");
    const caveRouteModeInput = panel.querySelector("#minibia-bot-cave-route-mode");
    const caveModeratorPauseInput = panel.querySelector("#minibia-bot-cave-moderator-pause");
    const caveVerificationPauseInput = panel.querySelector("#minibia-bot-cave-verification-pause");
    const caveVerificationAutoResumeInput=panel.querySelector('#minibia-bot-cave-verification-auto-resume');
    const caveVerificationTickInput = panel.querySelector("#minibia-bot-cave-verification-tick");
    const caveResumeVerificationButton = panel.querySelector("#minibia-bot-cave-resume-verification");
    const caveTestAlarmButton = panel.querySelector("#minibia-bot-cave-test-alarm");
    const caveRecordButton = panel.querySelector("#minibia-bot-cave-record");
    const caveRemoveLastButton = panel.querySelector("#minibia-bot-cave-remove-last");
    const caveStartButton = panel.querySelector("#minibia-bot-cave-start");
    const caveStopButton = panel.querySelector("#minibia-bot-cave-stop");
    const cavePresetSelect = panel.querySelector("#minibia-bot-cave-preset-select");
    const cavePresetNewButton = panel.querySelector("#minibia-bot-cave-preset-new");
    const cavePresetDeleteButton = panel.querySelector("#minibia-bot-cave-preset-delete");

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        const isCollapsed = panel.dataset.collapsed === "true";
        setPanelCollapsed(panel, !isCollapsed);
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.minibiaBotReload?.();
      });
    }

    function addTrustedName() {
      const rawName = panicTrustedInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.trustedNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ trustedNames: [...currentNames, rawName] });
      }

      if (panicTrustedInput) {
        panicTrustedInput.value = "";
      }

      renderTrustedNames();
    }

    function addGameMasterName() {
      const rawName = panicGmNameInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.gameMasterNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ gameMasterNames: [...currentNames, rawName] });
      }

      if (panicGmNameInput) {
        panicGmNameInput.value = "";
      }

      renderGameMasterNames();
    }

    if (panicGmAddButton) {
      panicGmAddButton.addEventListener("click", addGameMasterName);
    }

    if (panicGmNameInput) {
      panicGmNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addGameMasterName();
        }
      });
    }

    if (panicTrustedAddButton) {
      panicTrustedAddButton.addEventListener("click", addTrustedName);
    }

    if (panicTrustedInput) {
      panicTrustedInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTrustedName();
        }
      });
    }

    if (spellInput) {
      spellInput.value = bot.rune?.config?.runeSpellWords || "";
      spellInput.addEventListener("change", () => {
        bot.rune.updateConfig({ runeSpellWords: spellInput.value.trim() });
      });
    }

    if (manaInput) {
      manaInput.value = String(bot.rune?.config?.runeManaCost ?? 0);
      manaInput.addEventListener("change", () => {
        const runeManaCost = Math.max(0, Number(manaInput.value) || 0);
        manaInput.value = String(runeManaCost);
        bot.rune.updateConfig({ runeManaCost });
      });
    }

    if (runeMinInput && runeMaxInput) {
      const config=bot.rune?.config||{};
      runeMinInput.value=String((config.runeCooldownMinMs??config.runeCooldownMs??3500)/1000);
      runeMaxInput.value=String((config.runeCooldownMaxMs??config.runeCooldownMs??3500)/1000);
      function saveAdvancedInterval(changedField) {
        const current=bot.rune?.config||{};
        const readSeconds=(input,fallback)=>{
          const n=Number(input.value);
          return input.value.trim()!=='' && Number.isFinite(n) ? Math.min(3600,Math.max(1,n)) : fallback;
        };
        let min=readSeconds(runeMinInput,(current.runeCooldownMinMs??current.runeCooldownMs??3500)/1000);
        let max=readSeconds(runeMaxInput,(current.runeCooldownMaxMs??current.runeCooldownMs??3500)/1000);
        if(min>max) {if(changedField==='max') min=max; else max=min;}
        bot.rune.updateConfig({runeCooldownMinMs:Math.round(min*1000),runeCooldownMaxMs:Math.round(max*1000)});
        runeMinInput.value=String(bot.rune.config.runeCooldownMinMs/1000);
        runeMaxInput.value=String(bot.rune.config.runeCooldownMaxMs/1000);
        refreshQuickSummary();
      }
      runeMinInput.addEventListener('change',()=>saveAdvancedInterval('min'));
      runeMaxInput.addEventListener('change',()=>saveAdvancedInterval('max'));
    }
    if (runeEnabledInput) {
      runeEnabledInput.checked = !!bot.rune?.status?.().running;
      runeEnabledInput.addEventListener("change", () => {
        const runeSpellWords = spellInput?.value?.trim() || bot.rune.config.runeSpellWords;
        const runeManaCost = Math.max(0, Number(manaInput?.value) || bot.rune.config.runeManaCost || 0);

        if (runeEnabledInput.checked) {
          bot.rune.start({ runeSpellWords, runeManaCost });
        } else {
          bot.rune.stop();
        }

        refreshRuneStatus();
      });
    }

    if (autoEatHotkeyInput) {
      autoEatHotkeyInput.value = String(bot.eat?.config?.eatHotbarSlot ?? 10);
      autoEatHotkeyInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(12, Math.max(1, Number(autoEatHotkeyInput.value) || 1));
        autoEatHotkeyInput.value = String(eatHotbarSlot);
        bot.eat.updateConfig({ eatHotbarSlot });
      });
    }

    if (autoEatEnabledInput) {
      autoEatEnabledInput.checked = !!bot.eat?.status?.().running;
      autoEatEnabledInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoEatHotkeyInput?.value) || bot.eat.config.eatHotbarSlot || 1)
        );

        if (autoEatEnabledInput.checked) {
          bot.eat.start({ eatHotbarSlot });
        } else {
          bot.eat.stop();
        }

        refreshAutoEatStatus();
      });
    }

    if (autoInvisibleEnabledInput) {
      autoInvisibleEnabledInput.checked = !!bot.invisible?.status?.().running;
      autoInvisibleEnabledInput.addEventListener("change", () => {
        if (autoInvisibleEnabledInput.checked) {
          bot.invisible.start();
        } else {
          bot.invisible.stop();
        }

        refreshAutoInvisibleStatus();
      });
    }

    if (autoMagicShieldEnabledInput) {
      autoMagicShieldEnabledInput.checked = !!bot.magicShield?.status?.().running;
      autoMagicShieldEnabledInput.addEventListener("change", () => {
        if (autoMagicShieldEnabledInput.checked) {
          bot.magicShield.start();
        } else {
          bot.magicShield.stop();
        }

        refreshAutoMagicShieldStatus();
      });
    }

    if (equipRingEnabledInput) {
      equipRingEnabledInput.checked = !!bot.equipRing?.status?.().running;
      equipRingEnabledInput.addEventListener("change", () => {
        if (equipRingEnabledInput.checked) {
          bot.equipRing.start();
        } else {
          bot.equipRing.stop();
        }

        refreshEquipRingStatus();
      });
    }

    if (caveRouteModeInput) {
      caveRouteModeInput.value = bot.cave?.config?.routeTraversalMode || "pingpong";
      caveRouteModeInput.addEventListener("change", () => {
        bot.cave.updateConfig({ routeTraversalMode: caveRouteModeInput.value });
        refreshQuickSummary();
      });
    }
    if (cavePrioritizeMonstersInput) {
      cavePrioritizeMonstersInput.checked = bot.cave?.config?.prioritizeMonsters === true;
      cavePrioritizeMonstersInput.addEventListener("change", () => {
        bot.cave.updateConfig({ prioritizeMonsters: cavePrioritizeMonstersInput.checked });
        refreshCaveStatus();
      });
    }

    const caveRandomMovementInput=panel.querySelector('#minibia-bot-cave-random-movement');
    if(caveRandomMovementInput) {
      caveRandomMovementInput.checked=bot.cave?.config?.randomizeMovement===true;
      caveRandomMovementInput.addEventListener('change',()=>{
        bot.cave?.updateConfig?.({randomizeMovement:caveRandomMovementInput.checked});
        refreshCaveStatus();
      });
    }
    const caveAllowFloorsInput=panel.querySelector('#minibia-bot-cave-allow-floors');
    if(caveAllowFloorsInput) {
      caveAllowFloorsInput.checked=bot.cave?.config?.allowFloorTransitions===true;
      caveAllowFloorsInput.addEventListener('change',()=>bot.cave?.updateConfig?.({allowFloorTransitions:caveAllowFloorsInput.checked}));
    }
    if (caveToolsInput) {
      caveToolsInput.checked = bot.cave?.config?.useWaypointTools !== false;
      caveToolsInput.addEventListener("change", () => bot.cave?.updateConfig?.({ useWaypointTools: caveToolsInput.checked }));
    }
    if (caveLimitChaseInput) {
      caveLimitChaseInput.checked = bot.cave?.config?.limitChaseToRoute === true;
      caveLimitChaseInput.addEventListener("change", () => {
        bot.cave.updateConfig({ limitChaseToRoute: caveLimitChaseInput.checked });
        refreshCaveStatus();
      });
    }

    if (caveMaxChaseInput) {
      caveMaxChaseInput.value = String(bot.cave?.config?.maxChaseFromRouteTiles ?? 6);
      caveMaxChaseInput.addEventListener("change", () => {
        const maxChaseFromRouteTiles = Math.max(2, Math.min(20, Math.trunc(Number(caveMaxChaseInput.value) || 6)));
        caveMaxChaseInput.value = String(maxChaseFromRouteTiles);
        bot.cave.updateConfig({ maxChaseFromRouteTiles });
      });
    }

    function refreshSellerRouteOptions() {
      if (!sellerRouteSelect) return;
      const returnValue = String(bot.cave?.config?.sellerReturnPresetName || "");
      const value = String(bot.cave?.config?.sellerPresetName || "");
      const names = bot.cave?.getPresetNames?.() || [];
      sellerRouteSelect.replaceChildren();
      const empty = document.createElement("option");
      empty.value = ""; empty.textContent = "Select a route";
      sellerRouteSelect.append(empty);
      for (const name of names) {
        const item = document.createElement("option");
        item.value = name; item.textContent = name;
        sellerRouteSelect.append(item);
      }
      sellerRouteSelect.value = names.includes(value) ? value : "";
      if (sellerReturnRouteSelect) {
        sellerReturnRouteSelect.replaceChildren();
        const reversed = document.createElement("option");
        reversed.value = ""; reversed.textContent = "Reverse seller route";
        sellerReturnRouteSelect.append(reversed);
        for (const name of names) {
          const item = document.createElement("option"); item.value = name; item.textContent = name;
          sellerReturnRouteSelect.append(item);
        }
        sellerReturnRouteSelect.value = names.includes(returnValue) ? returnValue : "";
      }
    }
    function refreshSellerStatus() {
      const trip = bot.cave?.getSellerTripStatus?.();
      if (sellerStatusLabel) {
        const routeInfo=bot.cave?.status?.()?.sellerRouteInfo;
        sellerStatusLabel.textContent = trip
          ? `Seller return: ${trip.phase} · recorded ${trip.recordedDirection}`
          : `Seller return: ${bot.cave?.config?.autoSellerVisit ? "armed" : "off"} · `+
            (routeInfo?.valid ? `route ${routeInfo.recordedDirection} (hunt WP${routeInfo.huntWaypointIndex+1})` : 'seller route not connected');
      }
      if (sellerConfirmButton) sellerConfirmButton.disabled = trip?.phase !== "waiting-at-seller";
      if (sellerAbortButton) sellerAbortButton.disabled = !trip;
    }
    if (sellerEnabledInput) {
      sellerEnabledInput.checked = bot.cave?.config?.autoSellerVisit === true;
      sellerEnabledInput.addEventListener("change", () => {
        bot.cave?.updateConfig?.({autoSellerVisit: sellerEnabledInput.checked});
        refreshSellerStatus();refreshQuickSummary();
      });
    }
    if (sellerCapInput) {
      sellerCapInput.value = String(bot.cave?.config?.minimumFreeCapacity ?? 50);
      sellerCapInput.addEventListener("change", () => {
        bot.cave?.updateConfig?.({minimumFreeCapacity: Number(sellerCapInput.value)});
        refreshQuickSummary();
      });
    }
    if (sellerRouteSelect) {
      refreshSellerRouteOptions();
      sellerRouteSelect.addEventListener("change", () => {
        bot.cave?.updateConfig?.({sellerPresetName: sellerRouteSelect.value});
      });
    }
    if (sellerReturnRouteSelect) sellerReturnRouteSelect.addEventListener("change", () =>
      bot.cave?.updateConfig?.({sellerReturnPresetName:sellerReturnRouteSelect.value}));
    for (const [input, key] of [
      [sellerFightOutboundInput, "sellerFightOutbound"],
      [sellerFightReturnInput, "sellerFightReturn"],
    ]) {
      if (!input) continue;
      input.checked = bot.cave?.config?.[key] === true;
      input.addEventListener("change", () => {
        bot.cave?.updateConfig?.({ [key]: input.checked });
        refreshSellerStatus();
      });
    }
    if (sellerConfirmButton) sellerConfirmButton.addEventListener("click", () => {
      bot.cave?.resumeFromSeller?.(); refreshSellerStatus();
    });
    if (sellerAbortButton) sellerAbortButton.addEventListener("click", () => {
      bot.cave?.cancelSellerTrip?.(); refreshSellerStatus();
    });
    if (autoSellEnabled) {
      autoSellEnabled.checked = bot.autoSell?.config?.enabled === true;
      autoSellNpc.value = bot.autoSell?.config?.npcName || "Shanar";
      autoSellItems.value = bot.autoSell?.config?.allowedItems || "";
      autoSellReturn.checked = bot.autoSell?.config?.autoReturnAfterSale === true;
      autoSellEnabled.addEventListener("change", () => bot.autoSell?.updateConfig?.({enabled:autoSellEnabled.checked}));
      autoSellNpc.addEventListener("change", () => bot.autoSell?.updateConfig?.({npcName:autoSellNpc.value}));
      autoSellItems.addEventListener("change", () => bot.autoSell?.updateConfig?.({allowedItems:autoSellItems.value}));
      autoSellReturn.addEventListener("change", () => bot.autoSell?.updateConfig?.({autoReturnAfterSale:autoSellReturn.checked}));
      autoSellTest?.addEventListener("click", () => {
        bot.autoSell?.updateConfig?.({ npcName:autoSellNpc.value, allowedItems:autoSellItems.value });
        bot.autoSell?.testAtNpc?.();
      });
    }
    // Native /lootlist uses the server's item SIDs and own save handler.
    // We only provide a small whitelist editor; never scrape corpses or
    // directly invent/send packet IDs. Re-open once to verify server state.
    const nativeLootStorageKey = "minibiaBot.nativeLoot.names";
    if (nativeLootNames) {
      nativeLootNames.value = String(bot.storage.get(nativeLootStorageKey, "Brass Helmet") || "");
      nativeLootNames.addEventListener("change", () =>
        bot.storage.set(nativeLootStorageKey, nativeLootNames.value));
    }
    const setLootStatus = (message) => { if (nativeLootStatus) nativeLootStatus.textContent = message; };
    nativeLootOpen?.addEventListener("click", () => {
      const btn = document.getElementById("open-lootlist-btn");
      try {
        if (btn && !btn.disabled) btn.click();
        else if (!bot.sendChat?.("/lootlist")) throw new Error("Cannot open /lootlist");
        setLootStatus("Waiting for Minibia loot list. Once it opens, click Apply loot list.");
      } catch (error) { setLootStatus("Cannot open loot list: " + String(error?.message || error)); }
    });
    nativeLootApply?.addEventListener("click", () => {
      const names = [...new Set(String(nativeLootNames?.value || "")
        .split(/[,\n]+/).map((v) => v.trim()).filter(Boolean).map((v) => v.toLowerCase()))];
      if (!names.length) { setLootStatus("Empty list: no changes sent. Add at least one item."); return; }
      if (names.length > 500) { setLootStatus("Too many entries (max 500). No changes sent."); return; }
      bot.storage.set(nativeLootStorageKey, nativeLootNames.value);
      const mgr = window.gameClient?.interface?.modalManager;
      const modal = mgr?.get?.("lootlist-modal");
      if (!modal || mgr.__openedModal !== modal || !Array.isArray(modal.__items) || !modal.__items.length) {
        setLootStatus("Open the live Minibia /lootlist modal first, then Apply. Nothing was changed.");
        return;
      }
      const matches = names.map((name) => ({name, entries:modal.__items.filter((item) =>
        String(item?.name || "").trim().toLowerCase() === name && Number.isInteger(Number(item.sid)))}));
      const missing = matches.filter(({entries}) => entries.length === 0).map(({name}) => name);
      if (missing.length) {
        setLootStatus("Not found in Minibia's list: " + missing.join(", ") + ". No changes sent.");
        return;
      }
      const sids = [...new Set(matches.flatMap(({entries}) => entries.map((entry) => Number(entry.sid))))];
      if (!sids.length || sids.length > 500 || sids.some((sid) => !Number.isInteger(sid) || sid < 0 || sid > 65535)) {
        setLootStatus("Invalid native item ID(s). No changes sent."); return;
      }
      if (typeof modal.__handleSave !== "function") {
        setLootStatus("Native loot save interface unavailable; no changes sent."); return;
      }
      try {
        modal.__selected = new Set(sids);
        modal.__updateCount?.();
        modal.__handleSave(true); // Client sends official LOOT_LIST_UPDATE.
        setLootStatus("Native loot update requested (" + sids.length + " item ID(s)). Reopen /lootlist to verify.");
      } catch (error) {
        setLootStatus("Could not submit loot list: " + String(error?.message || error));
      }
    });
    refreshSellerStatus();
    const sellerUiRefreshId = window.setInterval(() => {
      if (document.getElementById("minibia-bot-panel") !== panel) {
        window.clearInterval(sellerUiRefreshId);
        return;
      }
      refreshSellerStatus();
      const sell = bot.autoSell?.status?.();
      if (autoSellStatus && sell) autoSellStatus.textContent =
        `Auto Sell: ${sell.phase} · confirmed units ${sell.sold}${sell.pauseReason ? " · " + sell.pauseReason : ""}`;
      if ((bot.cave?.getPresetNames?.() || []).length !== (sellerRouteSelect?.options?.length ?? 1) - 1) refreshSellerRouteOptions();
    }, 1000);

    function refreshEntryCount() {
      if (!caveEntryCountInput) return;
      const s = bot.cave?.status?.();
      caveEntryCountInput.value = String(s?.entryWaypointCount || 0);
      caveEntryCountInput.max = String(Math.max(0, (s?.route?.length || 0) - 2));
      caveEntryCountInput.disabled = !!s?.running;
    }
    if (caveEntryCountInput) {
      caveEntryCountInput.addEventListener('change', () => {
        const result = bot.cave?.setEntryWaypointCount?.(caveEntryCountInput.value);
        if (!result?.ok) console.warn('[minibia-bot] entry count:', result?.reason);
        refreshEntryCount();
        refreshCaveStatus();
      });
      refreshEntryCount();
    }
    if (caveModeratorPauseInput) {
      caveModeratorPauseInput.checked = bot.cave?.status?.()?.config?.pauseOnModeratorMessage === true;
      caveModeratorPauseInput.addEventListener('change', () => {
        bot.cave.updateConfig({ pauseOnModeratorMessage: caveModeratorPauseInput.checked });
      });
    }

    if (caveVerificationPauseInput) {
      caveVerificationPauseInput.checked = bot.cave?.config?.pauseWaypointsOnVerification === true;
      caveVerificationPauseInput.addEventListener("change", () => {
        bot.cave.updateConfig({ pauseWaypointsOnVerification: caveVerificationPauseInput.checked });
        refreshCaveStatus();
      });
    }

    if(caveVerificationAutoResumeInput){
      caveVerificationAutoResumeInput.checked=bot.cave?.config?.autoResumeAfterVerification!==false;
      caveVerificationAutoResumeInput.addEventListener('change',()=>{
        bot.cave.updateConfig({autoResumeAfterVerification:caveVerificationAutoResumeInput.checked});
      });
    }
    if (caveVerificationTickInput) {
      caveVerificationTickInput.value = String(bot.cave?.config?.verificationScanTickMs ?? 500);
      caveVerificationTickInput.addEventListener("change", () => {
        const verificationScanTickMs = Math.max(200, Math.min(5000, Math.round(Number(caveVerificationTickInput.value) || 500)));
        caveVerificationTickInput.value = String(verificationScanTickMs);
        bot.cave.updateConfig({ verificationScanTickMs });
      });
    }

    if (caveTestAlarmButton) {
      caveTestAlarmButton.addEventListener("click", () => {
        bot.reportAlarm?.('test', 'Prueba manual de sonido', 'Solo sonido; no detuvo el bot');
      });
    }

    if (caveResumeVerificationButton) {
      caveResumeVerificationButton.addEventListener("click", () => {
        const result=bot.cave.resumeAfterVerification();
        refreshCaveStatus();
        const label=panel.querySelector('#minibia-bot-cave-status');
        if(label) label.textContent=result?.reason || 'Unable to restore';
      });
    }

    if (caveRecordButton) {
      caveRecordButton.addEventListener("click", () => {
        bot.cave.addWaypointCurrentSpot();
        refreshCavePresetControls();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
        refreshEntryCount();
      });
    }

    if (caveRemoveLastButton) {
      caveRemoveLastButton.addEventListener("click", () => {
        bot.cave.removeLastWaypoint();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
        refreshEntryCount();
      });
    }

    if (caveStartButton) {
      caveStartButton.addEventListener("click", () => {
        bot.cave.start();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
        refreshEntryCount();
      });
    }

    if (caveStopButton) {
      caveStopButton.addEventListener("click", () => {
        bot.cave.stop();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
        refreshEntryCount();
      });
    }

    if (cavePresetSelect) {
      cavePresetSelect.addEventListener("change", () => {
        const name = cavePresetSelect.value || "";
        const activePresetName = bot.cave?.getActivePresetName?.() || "";
        if (!name || name === activePresetName) {
          refreshCavePresetControls();
          return;
        }

        const loadedPreset = bot.cave.loadPreset(name);
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
        refreshEntryCount();
      });
    }

    if (cavePresetNewButton) {
      cavePresetNewButton.addEventListener("click", () => {
        const name = window.prompt("Name the new cave preset:");
        if (name == null) {
          return;
        }

        const createdPreset = bot.cave.createPreset(name);
        if (!createdPreset) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetDeleteButton) {
      cavePresetDeleteButton.addEventListener("click", () => {
        const name = cavePresetSelect?.value || "";
        if (!name) {
          return;
        }

        const deleted = bot.cave.deletePreset(name);
        if (!deleted) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (autoHealMinHpInput) {
      autoHealMinHpInput.value = String(bot.heal?.config?.minHp ?? 0);
      autoHealMinHpInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput.value) || 0);
        autoHealMinHpInput.value = String(minHp);
        bot.heal.updateConfig({ minHp });
      });
    }

    if (autoHealHpHotkeyInput) {
      autoHealHpHotkeyInput.value = String(bot.heal?.config?.hpHotbarSlot ?? 1);
      autoHealHpHotkeyInput.addEventListener("change", () => {
        const hpHotbarSlot = Math.min(12, Math.max(1, Number(autoHealHpHotkeyInput.value) || 1));
        autoHealHpHotkeyInput.value = String(hpHotbarSlot);
        bot.heal.updateConfig({ hpHotbarSlot });
      });
    }

    if (autoHealMinManaInput) {
      autoHealMinManaInput.value = String(bot.heal?.config?.minMana ?? 0);
      autoHealMinManaInput.addEventListener("change", () => {
        const minMana = Math.max(0, Number(autoHealMinManaInput.value) || 0);
        autoHealMinManaInput.value = String(minMana);
        bot.heal.updateConfig({ minMana });
      });
    }

    if (autoHealManaHotkeyInput) {
      autoHealManaHotkeyInput.value = String(bot.heal?.config?.manaHotbarSlot ?? 1);
      autoHealManaHotkeyInput.addEventListener("change", () => {
        const manaHotbarSlot = Math.min(12, Math.max(1, Number(autoHealManaHotkeyInput.value) || 1));
        autoHealManaHotkeyInput.value = String(manaHotbarSlot);
        bot.heal.updateConfig({ manaHotbarSlot });
      });
    }

    if (autoHealEnabledInput) {
      autoHealEnabledInput.checked = !!bot.heal?.status?.().running;
      autoHealEnabledInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput?.value) || bot.heal.config.minHp || 0);
        const hpHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealHpHotkeyInput?.value) || bot.heal.config.hpHotbarSlot || 1)
        );
        const minMana = Math.max(0, Number(autoHealMinManaInput?.value) || bot.heal.config.minMana || 0);
        const manaHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealManaHotkeyInput?.value) || bot.heal.config.manaHotbarSlot || 1)
        );

        if (autoHealEnabledInput.checked) {
          bot.heal.start({ minHp, hpHotbarSlot, minMana, manaHotbarSlot });
        } else {
          bot.heal.stop();
        }

        refreshAutoHealStatus();
      });
    }

    if (autoAttackHotkeyInput) {
      autoAttackHotkeyInput.value = String(bot.attack?.config?.targetHotbarSlot ?? 3);
      autoAttackHotkeyInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(12, Math.max(1, Number(autoAttackHotkeyInput.value) || 1));
        autoAttackHotkeyInput.value = String(targetHotbarSlot);
        bot.attack.updateConfig({ targetHotbarSlot });
      });
    }

    if (autoAttackRuneHotkeyInput) {
      autoAttackRuneHotkeyInput.value = bot.attack?.config?.runeHotbarSlot
        ? String(bot.attack.config.runeHotbarSlot)
        : "";
      autoAttackRuneHotkeyInput.addEventListener("change", () => {
        const rawValue = Number(autoAttackRuneHotkeyInput.value);
        const runeHotbarSlot = Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12
          ? Math.trunc(rawValue)
          : null;
        autoAttackRuneHotkeyInput.value = runeHotbarSlot ? String(runeHotbarSlot) : "";
        bot.attack.updateConfig({ runeHotbarSlot });
      });
    }

    if (autoAttackChaseController) {
      const savedChaseController = bot.attack?.config?.chaseController;
      autoAttackChaseController.value = ["hybrid", "native", "pathfinder"].includes(savedChaseController)
        ? savedChaseController : "hybrid";
      autoAttackChaseController.disabled = bot.attack?.config?.meleeMode === false;
      autoAttackChaseController.addEventListener("change", () => {
        bot.attack.updateConfig({ chaseController: autoAttackChaseController.value });
      });
    }

    if (autoAttackAvoidStairsInput) {
      autoAttackAvoidStairsInput.checked = bot.attack?.config?.avoidFloorChangesOnChase !== false;
      autoAttackAvoidStairsInput.addEventListener("change", () => {
        bot.attack.updateConfig({ avoidFloorChangesOnChase: autoAttackAvoidStairsInput.checked });
      });
    }

    if (autoAttackMeleeInput) {
      autoAttackMeleeInput.checked = bot.attack?.config?.meleeMode !== false;
      autoAttackMeleeInput.addEventListener("change", () => {
        bot.attack.updateConfig({ meleeMode: autoAttackMeleeInput.checked });
        if (autoAttackChaseController) autoAttackChaseController.disabled = !autoAttackMeleeInput.checked;
      });
    }

    if (autoAttackEnabledInput) {
      autoAttackEnabledInput.checked = !!bot.attack?.status?.().running;
      autoAttackEnabledInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoAttackHotkeyInput?.value) || bot.attack.config.targetHotbarSlot || 1)
        );
        const runeHotbarSlot = (() => {
          const rawValue = Number(autoAttackRuneHotkeyInput?.value);
          if (Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12) {
            return Math.trunc(rawValue);
          }

          return bot.attack.config.runeHotbarSlot ?? null;
        })();
        const meleeMode = !!autoAttackMeleeInput?.checked;
        const chaseController = ["hybrid", "native", "pathfinder"].includes(autoAttackChaseController?.value)
          ? autoAttackChaseController.value : "hybrid";

        if (autoAttackEnabledInput.checked) {
          bot.attack.start({ targetHotbarSlot, runeHotbarSlot, meleeMode, chaseController });
        } else {
          bot.attack.stop();
        }

        refreshAutoAttackStatus();
      });
    }

    const corpseToggle = panel.querySelector("#minibia-bot-corpse-loot-enabled");
    const corpseItems = panel.querySelector("#minibia-bot-corpse-loot-items");
    const corpseStatus = panel.querySelector("#minibia-bot-corpse-loot-status");
    if (corpseToggle && corpseItems && corpseStatus) {
      const refreshCorpseStatus = () => {
        const st = bot.corpseLoot?.status?.();
        corpseToggle.checked = !!st?.running;
        corpseStatus.textContent = st ? `Collected: ${st.moved} | ${st.reason}` : "Module unavailable";
      };
      corpseItems.value = bot.corpseLoot?.config?.items || "";
      corpseItems.addEventListener("change", () => {bot.corpseLoot?.updateConfig?.({items:corpseItems.value}); refreshCorpseStatus();});
      corpseToggle.addEventListener("change", () => {
        bot.corpseLoot?.updateConfig?.({items:corpseItems.value,enabled:corpseToggle.checked});refreshCorpseStatus();
      });
      const corpseTimer = window.setInterval(refreshCorpseStatus, 1200);
      bot.addCleanup(() => window.clearInterval(corpseTimer));
      refreshCorpseStatus();
    }
    if (floorMoveToggle && floorMoveItems && floorMoveStatus) {
      const floorStatus = bot.floorMove.status();
      floorMoveItems.value = floorStatus.config.items || "";
      floorMoveRares.checked = !!floorStatus.config.includeRares;
      floorMoveWalk.checked = !!floorStatus.config.walkToVisible;
      floorMoveToggle.checked = !!floorStatus.running;
      floorMoveItems.addEventListener("change", () => {
        bot.floorMove.updateConfig({items:floorMoveItems.value});
      });
      floorMoveWalk.addEventListener("change", () => {
        bot.floorMove.updateConfig({walkToVisible:floorMoveWalk.checked});
      });
      floorMoveRares.addEventListener("change", () => {
        bot.floorMove.updateConfig({includeRares:floorMoveRares.checked});
        if (floorMoveToggle.checked) {
          const status = bot.floorMove.status();
          floorMoveStatus.textContent = status.config.includeRares && !status.rareCatalogReady ?
            "Waiting for Loot List — open it once in Minibia" : "Active";
        }
      });
      floorMoveToggle.addEventListener("change", () => {
        bot.floorMove.updateConfig({items:floorMoveItems.value,includeRares:floorMoveRares.checked,walkToVisible:floorMoveWalk.checked});
        if (floorMoveToggle.checked) {
          if (!bot.floorMove.start()) {
            floorMoveToggle.checked = false;
            floorMoveStatus.textContent = "Select Rare or enter a name/ID";
            return;
          }
        } else bot.floorMove.stop();
        const status = bot.floorMove.status();
        floorMoveStatus.textContent = !floorMoveToggle.checked ? "Off" :
          (status.config.includeRares && !status.rareCatalogReady ?
            "Waiting for Loot List — open it once in Minibia" : "Active");
      });
      floorMoveScan?.addEventListener("click", () => {
        const nearby = bot.floorMove.scanNearby();
        const status = bot.floorMove.status();
        floorMoveStatus.textContent = (status.config.includeRares ?
          (status.rareCatalogReady ? `Rare catalog: ${status.rareCount} IDs. ` : "Rare catalog not loaded. ") : "") +
          (nearby.length ? nearby.slice(0,8).map(item => `${item.name || "unknown"} (#${item.id})`).join(", ") :
            "No items visible on current floor");
      });
    }

    function refreshTalkModeInputs() {
      const mode = bot.talk?.config?.replyMode || "gemini";
      if (talkModeInput) talkModeInput.value = mode;
      if (talkAiSettings) talkAiSettings.style.display = mode === "gemini" ? "" : "none";
    }

    if (talkModeInput) {
      talkModeInput.addEventListener("change", () => {
        bot.talk.updateConfig({ replyMode: talkModeInput.value });
        refreshTalkModeInputs();
        refreshTalkStatus();
      });
    }
    if (talkRulesInput) {
      talkRulesInput.value = bot.talk?.config?.ruleText || "";
      talkRulesInput.addEventListener("change", () => {
        bot.talk.updateConfig({ ruleText: talkRulesInput.value });
      });
    }
    function saveTalkDelayConfig() {
      let min = Math.max(0, Math.min(30, Number(talkMinDelayInput?.value) || 0));
      let max = Math.max(min, Math.min(30, Number(talkMaxDelayInput?.value) || 0));
      if (talkMinDelayInput) talkMinDelayInput.value = String(min);
      if (talkMaxDelayInput) talkMaxDelayInput.value = String(max);
      bot.talk.updateConfig({ replyDelayMinMs: min * 1000, replyDelayMaxMs: max * 1000 });
    }
    if (talkMinDelayInput) {
      talkMinDelayInput.value = String((bot.talk?.config?.replyDelayMinMs ?? 4000) / 1000);
      talkMinDelayInput.addEventListener("change", saveTalkDelayConfig);
    }
    if (talkMaxDelayInput) {
      talkMaxDelayInput.value = String((bot.talk?.config?.replyDelayMaxMs ?? 8000) / 1000);
      talkMaxDelayInput.addEventListener("change", saveTalkDelayConfig);
    }
    refreshTalkModeInputs();

    if (talkApiKeyInput) {
      talkApiKeyInput.value = bot.talk?.config?.apiKey || "";
      talkApiKeyInput.addEventListener("change", () => {
        bot.talk.updateConfig({ apiKey: talkApiKeyInput.value.trim() });
        refreshTalkStatus();
      });
    }

    if (talkPromptInput) {
      talkPromptInput.value = bot.talk?.config?.systemPrompt || "";
      talkPromptInput.addEventListener("change", () => {
        bot.talk.updateConfig({ systemPrompt: talkPromptInput.value.trim() });
      });
    }

    if (talkNpcInput) {
      talkNpcInput.checked = bot.talk?.status?.().config?.replyToNpcs === true;
      talkNpcInput.addEventListener("change", () => {
        bot.talk.updateConfig({ replyToNpcs: talkNpcInput.checked });
        refreshTalkStatus();
      });
    }

    if (talkPrivateInput) {
      talkPrivateInput.checked = bot.talk?.status?.().config?.replyToPrivate === true;
      talkPrivateInput.addEventListener("change", () => {
        bot.talk.updateConfig({ replyToPrivate: talkPrivateInput.checked });
        refreshTalkStatus();
      });
    }

    if (talkEnabledInput) {
      talkEnabledInput.checked = !!bot.talk?.status?.().running;
      talkEnabledInput.addEventListener("change", () => {
        if (talkEnabledInput.checked) {
          bot.talk.updateConfig({
            apiKey: talkApiKeyInput?.value?.trim() || "",
            systemPrompt: talkPromptInput?.value?.trim() || bot.talk.config.systemPrompt || "",
          });
          const started = bot.talk.start();
          if (!started) {
            talkEnabledInput.checked = false;
          }
        } else {
          bot.talk.stop();
        }

        refreshTalkStatus();
      });
    }

    if (panicUnknownInput) {
      panicUnknownInput.checked = !!bot.panic?.status?.().config?.unknownPlayerEnabled;
      panicUnknownInput.addEventListener("change", () => {
        bot.panic.updateConfig({ unknownPlayerEnabled: panicUnknownInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicUnknownAlarmInput) {
      panicUnknownAlarmInput.checked = !!bot.panic?.status?.().config?.unknownPlayerSoundAlertEnabled;
      panicUnknownAlarmInput.addEventListener("change", () => {
        bot.panic.updateConfig({ unknownPlayerSoundAlertEnabled: panicUnknownAlarmInput.checked });
        refreshPanicStatus();
        refreshQuickSummary();
      });
    }

    if (panicSmartChatInput) {
      panicSmartChatInput.checked = !!bot.panic?.status?.().config?.smartChatAlertEnabled;
      panicSmartChatInput.addEventListener('change', () => {
        bot.panic.updateConfig({smartChatAlertEnabled:panicSmartChatInput.checked,
          ...(panicSmartChatInput.checked?{unknownPlayerSoundAlertEnabled:false}:{})});
        refreshPanicStatus(); refreshQuickSummary();
      });
    }

    if (panicHealthInput) {
      panicHealthInput.checked = !!bot.panic?.status?.().config?.healthLossEnabled;
      panicHealthInput.addEventListener("change", () => {
        bot.panic.updateConfig({ healthLossEnabled: panicHealthInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicReturnInput) {
      panicReturnInput.checked = !!bot.panic?.status?.().config?.returnToOriginEnabled;
      panicReturnInput.addEventListener("change", () => {
        bot.panic.updateConfig({ returnToOriginEnabled: panicReturnInput.checked });
        refreshPanicStatus();
      });
    }

    if (xrayOverlayButton) {
      xrayOverlayButton.addEventListener("click", () => {
        const enabled = !!bot.xray?.status?.().config?.overlayEnabled;
        bot.xray?.setOverlayEnabled?.(!enabled);
        refreshXrayStatus();
      });
    }

    if (xrayFloorSelect) {
      xrayFloorSelect.addEventListener("change", () => {
        const rawValue = xrayFloorSelect.value;
        bot.xray?.setSelectedFloor?.(rawValue === "all" ? null : Number(rawValue));
        refreshXrayStatus();
        refreshVisibleCreatures();
      });
    }

    panel.querySelector("#minibia-bot-set-home")?.addEventListener("click", () => {
      bot.pz.setHomePzCurrentSpot();
      refreshHomeLabel();
    });

    refreshHomeLabel();
    refreshPanicStatus();
    refreshXrayStatus();
    renderGameMasterNames();
    renderTrustedNames();
    refreshRuneStatus();
    refreshAutoHealStatus();
    refreshAutoInvisibleStatus();
    refreshAutoMagicShieldStatus();
    refreshAutoAttackStatus();
    refreshAutoEatStatus();
    refreshCaveStatus();
    refreshEquipRingStatus();
    refreshTalkStatus();
    refreshVisibleCreatures();
    refreshCavePresetControls();
    refreshCaveClosestStatus();
    refreshCaveTransitionStatus();

    const visibleCreaturesTimerId = window.setInterval(refreshVisibleCreatures, 1000);
    bot.addCleanup(() => {
      window.clearInterval(visibleCreaturesTimerId);
    });

    const talkStatusTimerId = window.setInterval(refreshTalkStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(talkStatusTimerId);
    });

    const caveStatusTimerId = window.setInterval(() => {
      refreshCaveStatus();
      refreshCavePresetControls();
      refreshCaveClosestStatus();
      refreshCaveTransitionStatus();
    }, 1000);
    bot.addCleanup(() => {
      window.clearInterval(caveStatusTimerId);
    });

  }

  bot.ui = {
    inject,
    destroy,
    refreshHomeLabel,
    refreshPanicStatus,
    refreshXrayStatus,
    refreshRuneStatus,
    refreshAutoHealStatus,
    refreshAutoInvisibleStatus,
    refreshAutoMagicShieldStatus,
    refreshAutoAttackStatus,
    refreshAutoEatStatus,
    refreshCaveStatus,
    refreshCavePresetControls,
    refreshEquipRingStatus,
    refreshTalkStatus,
    refreshVisibleCreatures,
    refreshCaveClosestStatus,
    refreshCaveTransitionStatus,
    getSavedPanelPosition,
    getSavedPanelCollapsed,
    setPanelCollapsed: (collapsed) => {
      const panel = document.getElementById("minibia-bot-panel");
      setPanelCollapsed(panel, collapsed);
    },
  };
};