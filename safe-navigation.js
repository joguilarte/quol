// Shared, fail-closed same-floor autowalk for Cave Bot and melee pursuit.
// No server-side mapclick fallback: every transmitted step is checked locally.
window.__minibiaBotBundle = window.__minibiaBotBundle || {};
window.__minibiaBotBundle.installSafeNavigationModule = function installSafeNavigationModule(bot) {
  const state = { owner: null, destinationKey: null, requestedKey: null, lastError: null, lastErrorAt: 0, lastSentAt: 0 };
  const getPos = (value) => {
    const p = value?.__position || value;
    const x = Number(p?.x), y = Number(p?.y), z = Number(p?.z);
    return [x,y,z].every(Number.isFinite) ? {x:Math.trunc(x),y:Math.trunc(y),z:Math.trunc(z)} : null;
  };
  const key = (p) => p ? `${p.x},${p.y},${p.z}` : null;
  const dist = (a,b) => Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y));
  function getTile(p) {
    if (!p || typeof Position !== 'function') return null;
    return window.gameClient?.world?.getTileFromWorldPosition?.(new Position(p.x,p.y,p.z)) || null;
  }
  function isTransition(tile) {
    if (!tile?.__position || !Number(tile.id)) return true;
    const client = window.gameClient;
    const pieces = [tile,...(Array.isArray(tile.items) ? tile.items : [])];
    for (const thing of pieces) {
      if (!thing || !Number(thing.id)) continue;
      const id = Number(thing.id);
      const def = client?.itemDefinitionsByCid?.[id] || client?.itemDefinitionsBySid?.[id] || client?.itemDefinitions?.[id];
      // Unknown ground/item metadata cannot certify the tile as non-transition.
      if (!def?.properties) return true;
      if (!!def.properties.floorchange || id === 1948 || id === 1968) return true;
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
        Math.abs(a.x-b.x) > 1 || Math.abs(a.y-b.y) > 1 || (a.x===b.x && a.y===b.y) ||
        !traversable(toTile,floor)) return false;
    if (a.x !== b.x && a.y !== b.y) {
      // No diagonal shortcuts beside stairs, unknown tiles or blocked terrain.
      if (!traversable(getTile({x:b.x,y:a.y,z:floor}),floor) ||
          !traversable(getTile({x:a.x,y:b.y,z:floor}),floor)) return false;
    }
    return true;
  }
  function plan(fromValue, toValue, options={}) {
    const from = getPos(fromValue), to = getPos(toValue);
    if (!from || !to || from.z!==to.z) return {ok:false,reason:'different/missing floor'};
    if (key(from)===key(to)) return {ok:true,path:[],destination:from,exact:true};
    const start = getTile(from), finish = getTile(to);
    if (!start || !start.__position || (finish && isTransition(finish))) return {ok:false,reason:'missing source or unsafe destination'};
    const limit = Math.max(1,Math.min(20,Number(options.maxSteps)||10));
    const budget = Math.max(100,Math.min(2400,Number(options.maxNodes)||1200));
    const exactOnly = options.exactOnly === true;
    const nodes = new Map([[key(from),{tile:start,g:0,parent:null}]]);
    const frontier = [nodes.get(key(from))];
    let best = null, bestScore = dist(from,to), explored=0, nextIndex=0;
    // Bounded BFS prevents repeated priority-queue sorting every combat tick.
    while (nextIndex<frontier.length && explored++<budget) {
      const current = frontier[nextIndex++];
      const at = getPos(current.tile);
      if (key(at)===key(to)) {best=current;break;}
      if (current.g>=limit) continue;
      for (const neighbor of current.tile.neighbours||[]) {
        if (!safeEdge(current.tile,neighbor,from.z)) continue;
        const p=getPos(neighbor), k=key(p);
        if (nodes.has(k)) continue;
        const next={tile:neighbor,g:current.g+1,parent:current};
        nodes.set(k,next);frontier.push(next);
        const score=dist(p,to);
        if (score<bestScore) {best=next;bestScore=score;}
      }
    }
    if (!best || (exactOnly && key(getPos(best.tile))!==key(to)))
      return {ok:false,reason: 'no locally validated same-floor route'};
    const path=[];
    for(let cursor=best;cursor?.parent;cursor=cursor.parent) path.unshift(cursor.tile);
    if (!path.length || path.some((tile,i)=>!safeEdge(i===0?start:path[i-1],tile,from.z)))
      return {ok:false,reason:'invalidated path'};
    return {ok:true,path,destination:getPos(path[path.length-1]),exact:key(getPos(path[path.length-1]))===key(to)};
  }
  function owns(owner) {
    const pf=window.gameClient?.world?.pathfinder;
    return state.owner===owner && state.destinationKey &&
      key(getPos(pf?.__finalDestination))===state.destinationKey;
  }
  function cancel(owner) {
    if (!owns(owner)) {
      if (state.owner===owner) {state.owner=null;state.destinationKey=null;state.requestedKey=null;}
      return false;
    }
    const pf=window.gameClient?.world?.pathfinder;
    pf?.setPathfindCache?.(null);
    state.owner=null;state.destinationKey=null;state.requestedKey=null;
    return true;
  }
  function go(owner,to,options={}) {
    if (owner!=='attack' && owner!=='cave') return {ok:false,reason:'unknown owner'};
    const client=window.gameClient,pf=client?.world?.pathfinder;
    const player=getPos(bot.getPlayerPosition());
    if (!pf || !player || typeof client?.send!=='function' ||
        typeof AutoWalkPacket!=='function' || typeof Position!=='function') return {ok:false,reason:'game client unavailable'};
    const active=!!pf.__isAutoWalking;
    const activeDestination=key(getPos(pf.__finalDestination));
    if (active && (!state.owner || !state.destinationKey || activeDestination!==state.destinationKey || state.owner!==owner))
      return {ok:false,reason:'movement owned by another controller'};
    if (!active && state.owner && state.owner!==owner) {state.owner=null;state.destinationKey=null;}
    const result=plan(player,to,options);
    if (!result.ok) {state.lastError=result.reason;state.lastErrorAt=Date.now();return result;}
    if (!result.path.length) return {ok:true,alreadyThere:true,destination:player};
    const nextKey=key(result.destination), requestKey=key(getPos(to));
    if (owns(owner) && state.destinationKey===nextKey && Date.now()-state.lastSentAt<1800)
      return {ok:true,ongoing:true,destination:result.destination};
    const directions=[]; let previous=getTile(player);
    for (const tile of result.path) {
      if (!safeEdge(previous,tile,player.z) || typeof previous?.__position?.getLookDirection!=='function')
        return {ok:false,reason:'unsafe path during send'};
      directions.push(previous.__position.getLookDirection(tile.__position));previous=tile;
    }
    if (!directions.length) return {ok:false,reason:'empty validated walk'};
    // Mirror the client's AutoWalkPacket bookkeeping; no server map-click.
    pf.__finalDestination=new Position(result.destination.x,result.destination.y,result.destination.z);
    pf.__minimapWaypoints=null;
    pf.__pathfindCache=[];
    pf.__isAutoWalking=true;
    pf.__autoWalkStepsRemaining=directions.length;
    state.owner=owner;state.destinationKey=nextKey;state.requestedKey=requestKey;state.lastSentAt=Date.now();
    client.send(new AutoWalkPacket(directions));
    return {ok:true,destination:result.destination,exact:result.exact,steps:directions.length};
  }
  bot.safeNavigation={go,plan,cancel,owns,isTransition,status:()=>({...state})};
};
