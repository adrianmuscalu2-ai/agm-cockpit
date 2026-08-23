window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'AGM_TURN_AGENT_MODEL') return;
  const byPanel = new Map((event.data.agents || []).flatMap((agent) => [[agent.panelAgentId, agent], [agent.displayName, agent]]));
  objects.forEach((object) => {
    const runtime = byPanel.get(object.panelAgentId) || byPanel.get(object.name);
    if (!runtime) return;
    object.state = runtime.mappingStatus === 'UNMAPPED' ? 'planned' : runtime.visualState;
    object.color = runtime.color;
    object.runtimeStatus = runtime.runtimeStatus;
    object.generalStatus = runtime.generalStatus;
    object.proceduralStatus = runtime.proceduralStatus;
    object.mappingStatus = runtime.mappingStatus;
    object.freshness = runtime.freshness;
    object.health = runtime.health;
    object.lastSeen = runtime.lastSeen;
    object.telemetry = runtime.telemetry;
  });
  window.__agmTurnModel = event.data;
});

function showRuntimeDetails(agent) {
  const values = { name: agent.registryName || agent.displayName || 'UNKNOWN', level: agent.displayLevel ?? 'UNKNOWN', state: agent.generalStatus || 'UNKNOWN', dept: agent.department || 'UNKNOWN', resp: agent.registryRole || agent.responsibility || 'UNKNOWN', esc: agent.escalation || 'UNKNOWN' };
  Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
  const panel = document.getElementById('agm-panel');
  if (!panel) return;
  panel.dataset.turnAgentId = agent.turnAgentId || 'UNMAPPED';
  let meta = document.getElementById('agm-runtime-meta');
  if (!meta) { meta = document.createElement('div'); meta.id = 'agm-runtime-meta'; meta.className = 'field'; panel.appendChild(meta); }
  meta.innerHTML = '<span class="label">Turn Agent ID:</span> <span class="value">' + (agent.turnAgentId || 'UNMAPPED') + '</span><br><span class="label">Health:</span> <span class="value">' + (agent.health || 'UNKNOWN') + '</span><br><span class="label">Freshness:</span> <span class="value">' + (agent.freshness || 'UNKNOWN') + '</span><br><span class="label">Last seen:</span> <span class="value">' + (agent.lastSeen || 'UNKNOWN') + '</span><br><span class="label">Telemetry:</span> <span class="value">' + (agent.telemetry || 'NO TELEMETRY') + '</span>';
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const hit = objects.find((object) => Math.hypot(x - object.x, y - object.y) <= object.radius + 6);
  if (!hit) return;
  const runtime = (window.__agmTurnModel?.agents || []).find((agent) => agent.panelAgentId === hit.panelAgentId || agent.displayName === hit.name);
  if (runtime) showRuntimeDetails(runtime);
});
