const D = window.DATA;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- tabs
function show(t) {
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === t));
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.t === t));
}
window.addEventListener('hashchange', () => show((location.hash.slice(1).split('/')[0]) || 'overview'));
show((location.hash.slice(1).split('/')[0]) || 'overview');

// ---------- video + chapter bar
let VID = 0;
function player(video, chapters, duration, opts = {}) {
  if (!video) return `<div class="card mute" style="text-align:center;padding:40px">${esc(opts.pending || 'render pending')}</div>`;
  const id = 'v' + (VID++);
  const dur = duration || (chapters.length ? Math.max(...chapters.map(c => c.t1 || 0)) : 1);
  const cls = c => c.origin === 'scenario' ? 'scenario' : c.origin === 'recovery' ? 'recovery' : c.origin === 'preparation' ? 'preparation' : (opts.probe && (c.id || '').startsWith('probe')) ? 'probe' : 'ref';
  const segs = chapters.filter(c => c.t0 != null).map(c => `<i class="${cls(c)}" style="left:${100 * c.t0 / dur}%;width:${Math.max(.4, 100 * (c.t1 - c.t0) / dur)}%" title="${esc(c.action)} ${esc(c.note)}"></i>`).join('');
  const rows = chapters.filter(c => c.t0 != null).map(c => `<div class="${cls(c)}" onclick="seek('${id}',${c.t0})"><span class="t">${c.t0.toFixed(1)}s</span><span><b>${esc(c.action)}</b> <span class="mono">${esc(fmtParams(c.params))}</span> <span class="mute">${esc(c.note || '')}</span></span></div>`).join('');
  return `<div class="vid"><video id="${id}" src="${video}" controls muted playsinline preload="metadata" ${opts.loop ? 'loop' : ''}></video>
    <div class="bar" onclick="barSeek(event,'${id}',${dur})">${segs}<b id="${id}h" style="left:0"></b></div>
    ${rows && !opts.nochap ? `<details ${opts.open ? 'open' : ''}><summary>${chapters.length} executed actions (click to seek)</summary><div class="chap">${rows}</div></details>` : ''}</div>`;
}
function fmtParams(p) {
  if (!p) return '';
  const o = {}; for (const [k, v] of Object.entries(p)) { if (k === 'within') continue; o[k] = (k === 'T' || k === 'M') ? '4×4' : v; }
  const s = JSON.stringify(o); return s.length > 120 ? s.slice(0, 117) + '…' : s;
}
window.seek = (id, t) => { const v = document.getElementById(id); v.currentTime = t; v.play(); };
window.barSeek = (e, id, dur) => { const r = e.currentTarget.getBoundingClientRect(); seek(id, dur * (e.clientX - r.left) / r.width); };
setInterval(() => document.querySelectorAll('video').forEach(v => { const h = document.getElementById(v.id + 'h'); if (h && v.duration) h.style.left = (100 * v.currentTime / (parseFloat(h.parentElement.getAttribute('onclick').split(',')[2]) || v.duration)) + '%'; }), 200);

// ---------- overview stats
{
  const M = D.models, done = M.filter(m => m.engine && m.engine.complete).length;
  const mot = M.filter(m => m.motion && m.motion.status === 'completed').length, vids = M.filter(m => m.video).length;
  const probes = Object.values(D.probes), pv = probes.filter(p => p.video).length, mv = D.mistakes.filter(m => m.video).length;
  $('#ov-stats').innerHTML = [
    [`${done}/${M.length}`, 'catalog models the engine builds to the official end state (0 refusals)'],
    [`${mot}/${M.length}`, 'with a full motion timeline from the latest Studio path (rest pending/failed)'],
    [`${D.actions.length}`, 'documented public actions (+ behaviour cues)'],
    [`19 · 8 · 9`, 'mistake · assistance · blocker scenario types'],
    [`${pv}/${probes.length}`, 'action probe videos rendered (human builder)'],
    [`${mv}/${D.mistakes.length}`, 'mistake/recovery videos rendered (human builder)'],
  ].map(([a, b]) => `<div class="card"><div class="stat">${a}<small>${b}</small></div></div>`).join('');
}

// ---------- models
{
  const M = D.models;
  const sizes = [[0,10],[11,25],[26,50],[51,999]].map(([a,b]) => M.filter(m => m.parts >= a && m.parts <= b).length);
  const sub = M.filter(m => m.verbs.attach).length;
  const fails = M.filter(m => m.motion && m.motion.status && m.motion.status !== 'completed');
  $('#mod-summary').innerHTML = `
  <p><b>Answer:</b> the model library behind Episode Studio has <b>${M.length} real LEGO sets</b> (LDraw OMR files, 2–${Math.max(...M.map(m=>m.parts))} parts; the same 212 models as the report's gallery). I re-ran every one through the current engine (<code>legosim.cli.examples --engine-only</code> on its Studio input). <b>All ${M.filter(m=>m.engine&&m.engine.complete).length} finish at the official model with zero refused actions.</b> Size mix: ${sizes[0]} with ≤10 parts, ${sizes[1]} with 11–25, ${sizes[2]} with 26–50, ${sizes[3]} with more. ${sub} of them build at least one sub-assembly on the table and <code>attach</code> it later.</p>
  <p>Build order is <b>inferred</b> from LDraw STEP groups by the shared planner (<code>legosim/tasks/planner.py</code>). It is not verified against the printed booklet, except where a reviewed instruction recipe exists. The catalog inputs use only <code>pick</code>, <code>place</code> (pose level, with connector checks) and <code>attach</code>. The curated templates (House, Ghost, Dracaena, stack) also use connector-level <code>mate</code> and the richer actions shown in section 2.</p>
  <p class="note">"Complete" here means: the engine accepted the whole action list and the final state matches the official model. It does not certify collision-free continuous motion or feasible hand contact; the repository keeps those as separate validations. ${fails.length ? `Motion generation did not complete for: ${fails.map(f => f.set).join(', ')}.` : ''}</p>`;
  $('#mod-human').innerHTML = D.human_models.map(h => `<div class="card"><b>${esc(h.title)}</b> <span class="pill">${esc(h.status)}</span>${player(h.video, h.chapters, h.duration, {pending: 'human render ' + h.status})}</div>`).join('');
  const gal = $('#gal');
  function draw() {
    const q = $('#q').value.toLowerCase(), sz = $('#sz').value, vb = $('#vb').value, st = $('#st').value;
    const L = M.filter(m => (!q || (m.set + ' ' + m.title).toLowerCase().includes(q))
      && (!sz || (m.parts >= +sz.split('-')[0] && m.parts <= +sz.split('-')[1]))
      && (!vb || (vb === 'attach' ? m.verbs.attach : !m.verbs.attach))
      && (!st || (st === 'video' ? m.video : !m.video)));
    $('#cnt').textContent = `${L.length} models`;
    gal.innerHTML = L.map(m => `<div class="mc" onclick="openModel('${m.set}')">
      ${m.thumb ? `<img loading="lazy" src="${m.thumb}" alt="">` : '<img alt="">'}
      <div class="b"><strong>${esc(m.set)} · ${esc(m.title)}</strong>${m.parts} parts · ${m.steps} steps · ${m.actions} actions<br>
      <span class="${m.engine && m.engine.complete ? 'ok' : 'bad'}">engine ${m.engine && m.engine.complete ? '✓ complete' : '✗'}</span> ·
      ${m.video ? '<span class="ok">▶ video</span>' : m.motion && m.motion.failure ? '<span class="bad">motion failed</span>' : '<span class="mute">pending</span>'}</div></div>`).join('');
  }
  ['#q', '#sz', '#vb', '#st'].forEach(s => $(s).addEventListener('input', draw)); draw();
  window.openModel = set => {
    const m = M.find(x => x.set === set);
    $('#mbox').innerHTML = `<div style="display:flex;justify-content:space-between"><h3 style="margin:0">${esc(m.set)} · ${esc(m.title)}</h3><a href="javascript:closeM()">close ✕</a></div>
      ${player(m.video, [], m.motion && m.motion.seconds, {pending: m.motion && m.motion.failure ? 'motion generation failed: ' + m.motion.failure : 'render pending'})}
      <div class="kv" style="margin-top:10px"><div>Parts / LDraw steps</div><div>${m.parts} / ${m.steps}</div>
      <div>Planned actions</div><div>${m.actions} (${Object.entries(m.verbs).map(([k, v]) => `${k}×${v}`).join(', ')})</div>
      <div>Engine run</div><div>${m.engine ? `${m.engine.status}; complete=${m.engine.complete}; ${m.engine.attempted} attempted, ${m.engine.rejections} refused` : 'n/a'}</div>
      <div>Motion timeline</div><div>${m.motion ? `${m.motion.status || ''} · ${m.motion.seconds ?? '?'} s` : 'pending'}</div>
      <div>Source</div><div><a href="${m.source}" target="_blank">LDraw OMR file</a></div></div>`;
    $('#modal').style.display = 'flex';
  };
  window.closeM = () => { $('#modal').style.display = 'none'; $('#mbox').innerHTML = ''; };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeM(); });
}

// ---------- actions
{
  const ex = {mate: 'probe <code>mate</code> uses connector addresses: <code>using</code> connector 0 of the held brick onto connector <code>at</code> of the base plate. The pose is solved in closed form from the two connector frames, and the outcome is <i>mated</i>, <i>resting</i> or <i>fell</i>. The <code>press</code> probe also shows <code>seat=0.5</code> (half-inserted).'};
  $('#act-toc').innerHTML = D.actions.map(a => `<a href="#actions" onclick="document.getElementById('A-${a.id}').scrollIntoView();return false">${esc(a.name)}</a>`).join(' ');
  $('#act-list').innerHTML = D.actions.map(a => {
    const pr = a.probes.map(n => D.probes[n]).filter(Boolean);
    const probeHtml = pr.map(p => `<div class="card" style="background:var(--bg)"><b>Probe: <code>${esc(p.name)}</code></b> <span class="pill">render ${esc(p.render)}</span>${p.human ? `<span class="pill">hand contact ${esc(p.human)}</span>` : ''}
      <div class="grid g2" style="margin-top:8px"><div>${player(p.video, p.chapters, p.duration, {probe: true, pending: 'human render ' + p.render, open: true})}</div>
      <div>${p.steps.map(s => `<div class="step"><b>${esc(s.action)}</b> <span class="mono">${esc(s.params)}</span><br>
        engine: <span class="${s.ok ? 'ok' : 'bad'}">${s.ok ? 'accepted' : 'refused'} (${esc(s.code)})</span> <span class="mono mute">effect ${esc(s.effect)}</span>
        <ul class="tight">${s.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul><span class="note">progress: ${esc(s.progress)}</span></div>`).join('')}</div></div></div>`).join('');
    const hist = a.history ? `<div class="card" style="background:var(--bg)"><b>Historical clip from the repository report</b> <span class="note">(earlier code version; shown because no JSON-runner probe exists for this action)</span>${player(a.history, [], null, {})}</div>` : '';
    return `<div class="card" id="A-${a.id}"><h3 style="margin-top:0">${esc(a.name)} <span class="pill">${esc(a.kind)}</span></h3>
      <pre>${esc(a.sig)}</pre>
      <div class="grid g2"><div><b>Input parameters</b><table>${a.params.map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('')}</table>
        <b>Preconditions</b><ul class="tight">${a.pre.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><b>World-state change (effect)</b><p>${esc(a.effect)}</p><b>Refusal codes</b><div>${a.fail.map(f => `<span class="pill">${esc(f)}</span>`).join('') || '—'}</div>
        <b>Rendered motion phases</b><p class="note">${esc(a.phases)}</p>${ex[a.id] ? `<p class="note">${ex[a.id]}</p>` : ''}</div></div>
      ${probeHtml}${a.see_mistake ? `<p>▶ Also rendered in context: <a href="#mistakes" onclick="show('mistakes');setTimeout(()=>document.getElementById('M-${a.see_mistake}').scrollIntoView(),50);return false">mistake episode <code>${a.see_mistake}</code></a>${['attach','detach'].includes(a.id) ? ' (a 3-part distractor sub-assembly is attached, then detached during recovery). A standalone single-brick detach/attach probe on the House failed motion planning, see Method &amp; caveats.' : ''}</p>` : ''}${hist}${!pr.length && !a.history ? '<p class="note">No standalone probe: this is a style/automatic behaviour (see note).</p>' : ''}</div>`;
  }).join('');
  const codes = [['BAG_OPEN','the bag is already open'],['NO_GRIP','fingers cannot take the part off (use pry)'],['TOO_BIG','model too big to hold in one hand (>16 cm)'],['NOT_HELD','the part / model / tool is not held'],['MODEL_HELD','a held model or tool cannot be passed between hands'],['NO_SUCH_PART','part, bag or tool does not exist'],['HANDS_BUSY','needs both hands free'],['NO_FREE_HAND','no hand is free'],['HAND_BUSY','that hand is holding something'],['NOT_FREE','part not loose (built in, held, or in a closed bag)'],['NO_CONNECTION','nothing engages the model at the target pose'],['APPROACH_BLOCKED','cannot be pushed in along the joint axis'],['COLLISION','would interpenetrate another part'],['NOT_ATTACHED','part is not built in'],['FULLY_SEATED','press on a fully seated part'],['BLOCKED','no direction frees every joint'],['NOT_ONE_SUBASSEMBLY','parts are not exactly one separate connected section'],['INCOMPATIBLE','connectors cannot mate (same gender / profile)'],['OCCUPIED','the stud already holds a part'],['TARGET_NOT_BUILT','mate onto a part that is not built in'],['NO_SUCH_CONNECTOR','connector index/grid address does not exist'],['GEOMETRY_UNAVAILABLE','attempt_grasp needs a full part mesh'],['INVALID_PARAMETERS','invalid public request'],['NOT_SUPPORTED','a purported resting part has no live support']];
  $('#codes').innerHTML = `<table>${codes.map(([c, m]) => `<tr><td><code>${c}</code></td><td>${m}</td></tr>`).join('')}</table>`;
}

// ---------- mistakes
const MECH = {
  wrong_sequence: ['Execute the next reference operation while a declared <code>requires</code> dependency of its step is still unmet (e.g. attach the cap before the cylinder).', 'Engine accepts it (physically legal); the procedure checker records a dependency violation. Expected outcome: <b>unresolved</b>.', 'none: the violation is the point'],
  wrong_direction: ['At the held brick\'s placement, compute the joint insertion axis from the reference connection and call <code>attempt_direction(pid, T_ref, d)</code> with d ⟂ axis.', 'No state change: the attempt is journaled; the hand approaches sideways and backs off.', 'redo the reference placement along the proper axis'],
  accidental_disassembly: ['Pick an already-connected brick; <code>separator.choose</code> selects a real removal (<code>remove</code> by fingers, or <code>pry</code> with the separator if NO_GRIP).', 'Its joints are deleted and it is in a hand (or on the table); progress no longer lists it as correct.', '<code>place</code> it back at its previous pose'],
  wrong_position: ['Enumerate <code>World.affordances(pid)</code> (every engine-feasible connector pairing), sorted by distance to the reference pose; take the nearest non-equivalent one ≥1 LDU away and not flipped.', 'Part clicks in (<code>assembly</code>) at the wrong connector → progress <i>misplaced</i>.', 'restore_reference: <code>notice</code> → <code>remove</code>/<code>pry</code> (blocking parts unstacked first) → reference placement'],
  wrong_orientation: ['Same affordance search; keep options within 1 LDU of the reference position but with a rotation that is <b>not</b> symmetry-equivalent.', 'Clicks in turned → <i>misplaced</i>. Not applicable to symmetric parts.', 'restore_reference'],
  mirrored_assembly: ['For every <code>place</code> of the step, reflect its pose through a mirror plane of an anchor part (<code>S·T·S</code>); keep only if the reflected rigid parts truly differ.', 'A whole step is built in the opposite handedness → several <i>misplaced</i> parts.', 'remove all step parts in reverse, then redo the step'],
  upside_down: ['Affordance search restricted to options whose up-axis is reversed relative to the reference.', 'Clicks in upside down → <i>misplaced</i>.', 'restore_reference (may need the separator)'],
  skipped_step: ['Drop the step\'s (or one placement\'s) reference actions from the executed sequence.', 'Required parts stay <i>loose</i>; later steps proceed → requirements outstanding.', 'explicit: run the skipped pick/placement later'],
  extra_copies: ['From declared step <code>instances</code>, build one more copy with matching distractor inventory (<code>pick</code>/<code>place</code> each member beside the build).', 'Instance count exceeds the required count (extra separate component).', 'remove + put_down each extra member'],
  too_few_copies: ['Omit the actions belonging to one declared required instance.', 'Copies completed &lt; copies required; those parts stay loose.', 'execute the omitted instance\'s actions'],
  extra_part: ['<code>pick</code> an available distractor (inventory extra) and attach it at an accepted free connector near the reference.', 'A <i>foreign</i> part is attached to the build.', '<code>remove</code> it and <code>put_down</code> aside'],
  wrong_part: ['Put down the required part if held, <code>pick</code> a distractor of a different design/colour, place it at the reference pose.', 'A <i>foreign</i> part occupies the target slot; the required part is still loose.', 'remove + put_down the substitute, pick the required part, reference placement'],
  wrong_subassembly: ['Build a distractor group of the same size on the table (preparation), then <code>attach</code> it with the reference rigid move.', 'Wrong component joined to the model.', '<code>detach</code>, take apart and put down the distractor, then the reference <code>attach</code>'],
  not_seated: ['Replace the reference placement by the same connection with <code>seat=0.5</code> (stud-length joints only).', 'Joint engaged but shallower → part <i>unseated</i>.', '<code>press</code> the part until fully seated'],
  misaligned: ['Take the equivalent connector option and add a 1.6 mm lateral <code>residual</code> (beyond the 0.8 mm capture tolerance).', 'Part does not click in: <i>resting</i> on its supports (or falls to the table).', 'pick it off and redo the reference placement'],
  misgrasp: ['<code>attempt_grasp(pid, hand, clearance_ldu)</code>: the empty pinch closes beside and above the part\'s mesh bounds.', 'No state change (acquired=false, outcome=missed); state hash identical.', 'explicit <code>pick</code> retry'],
  slip: ['While the brick is held before its placement: <code>release_part(pid, T_park, kind="slip")</code>.', 'Hand becomes empty; the brick lands at an authored table pose (scripted fall, no force simulation).', '<code>pick</code> it again, then the reference placement'],
  drop: ['Same as slip with <code>kind="drop"</code> (open-hand release animation).', 'Brick on the table, hand empty.', 'pick + reference placement'],
  failed_recovery: ['Target a brick left wrong by an earlier mistake and attempt a repair that cannot fix it (e.g. <code>press</code> on a misplaced brick, expected code recorded).', 'The error remains (or a new one appears) → <b>unresolved</b>.', 'none: documents an unsuccessful repair'],
};
{
  $('#mis-table').innerHTML = `<table><tr><th>Kind</th><th>Meaning</th><th>Policy family</th><th>Episode</th><th>Outcome</th><th>Video</th></tr>${D.mistakes.map(m => `<tr><td><a href="#mistakes" onclick="document.getElementById('M-${m.kind}').scrollIntoView();return false"><code>${m.kind}</code></a></td><td>${esc(m.desc)}</td><td>${['wrong_position','wrong_orientation','upside_down','not_seated','misaligned'].includes(m.kind) ? 'connector placement search' : ['misgrasp','slip','drop','wrong_direction'].includes(m.kind) ? 'handling / execution failure' : ['wrong_sequence','skipped_step','too_few_copies','extra_copies'].includes(m.kind) ? 'procedure / quantity' : 'part / assembly substitution'}</td><td class="note">${esc(m.set)}</td><td>${esc(m.outcome.status || '')}</td><td>${m.video ? '<span class="ok">▶</span>' : '<span class="mute">pending</span>'}</td></tr>`).join('')}</table>`;
  $('#mis-list').innerHTML = D.mistakes.map(m => {
    const [gen, state, rec] = MECH[m.kind] || ['', '', ''];
    const al = (rows, cls) => rows.map(r => `<div class="step ${cls}"><b>${esc(r.action)}</b> <span class="mono">${esc(r.params)}</span>${r.code ? ` <span class="pill">${esc(r.code)}</span>` : ''}<br><span class="note">${esc(r.note || '')}</span><br><span class="note">after → ${esc(r.prog)}</span></div>`).join('') || '<p class="note">—</p>';
    return `<div class="card" id="M-${m.kind}"><h3 style="margin-top:0"><code>${m.kind}</code> <span class="note">${esc(m.desc)}</span></h3>
      <div class="grid g2"><div>${player(m.video, m.chapters, m.duration, {pending: 'human render ' + m.render, open: false})}
        <p class="note">${esc(m.set)} · ${m.studio ? 'authored as an Episode Studio project (generate policy, latest code path)' : 'repository real-set scenario input, re-executed with current code'}</p></div>
      <div><div class="kv"><div>Trigger (<code>at</code>)</div><div class="mono">${esc(m.at)}</div><div>Mistake spec</div><div class="mono">${esc(m.spec)}</div><div>Recovery policy</div><div>${esc(m.recovery_policy || 'none')}</div><div>Expected</div><div>${esc(m.expect || '')}</div><div>Outcome</div><div>${esc(m.outcome.status || '')} <span class="note">${esc(m.outcome.reason || '')}</span></div></div>
        <p><b>How it is generated:</b> ${gen}</p><p><b>World-state change:</b> ${state}</p><p><b>Recovery:</b> ${rec}</p>
        ${m.scope ? `<p class="note">Scope: ${esc(m.scope)}</p>` : ''}</div></div>
      <div class="grid g2"><div><b class="bad">Error-making actions actually executed</b>${al(m.mistake_actions, 'scenario')}</div><div><b class="ok">Recovery actions actually executed</b>${al(m.recovery_actions, 'recovery')}
        ${m.recovery_records.map(r => `<p class="note">recovery record: ${esc(r.policy)} → <b>${esc(r.status)}</b>${r.unaffected_work_preserved ? ', unaffected work preserved' : ''}; ${esc(r.remaining)}</p>`).join('')}</div></div>
      <p class="note">scenario events: ${m.events.map(e => esc(e.event) + (e.mistake_occurred ? ' (mistake occurred)' : '') + (e.execution_failure ? ' (execution failure)' : '')).join(' → ')}</p></div>`;
  }).join('');
  $('#assist').innerHTML = `<ul class="tight">${Object.entries(D.assistance).map(([k, v]) => `<li><code>${k}</code>: ${esc(v)}</li>`).join('')}</ul>`;
  $('#block').innerHTML = `<ul class="tight">${Object.entries(D.blockers).map(([k, v]) => `<li><code>${k}</code>: ${esc(v)}${D.unsupported[k] ? ` <span class="warn">(unsupported: ${esc(D.unsupported[k])})</span>` : ''}</li>`).join('')}</ul>`;
}

// ---------- notes
$('#notes-body').innerHTML = `
<p><b>Source:</b> private repository <code>hellomuffin/legosim</code> at commit <code>${esc(D.commit)}</code>. Page data generated ${esc(D.generated)}.</p>
<h3>How the videos were made</h3>
<ul>
<li><b>Environment rebuilt from scratch</b> per <code>docs/development/developer_guide.md</code>: LDraw complete library, LDCad shadow (connector) library, LDraw OMR corpus, Poly Haven HDRIs, MPFB 2.0.18 + MakeHuman CC0 packs (4 builder characters built with <code>tools.setup.build_mpfb_human</code>), Blender <code>bpy</code> 4.5.15 on one NVIDIA L40S.</li>
<li><b>Model completion:</b> for each catalog model, <code>legosim.editor.project.default_project → compile_project → prepare</code> with the full step range and no scenario, then the shared runner. Engine-only for the completion check, <code>--no-render</code> for the motion timeline, then the object observer for pixels. Full first-person human renders use the Studio worker (<code>legosim.editor.worker --mode render</code>, draft quality).</li>
<li><b>Actions:</b> 25 probe inputs (schema v2), each = Small House reference prefix + explicit tail, executed by <code>legosim.cli.examples</code> with human rendering (480×360, 8 samples, hand_mode=contacts). The world-state diffs come from a separate engine-only run of the same input.</li>
<li><b>Mistakes:</b> 16 kinds re-run from the repository's real-set <code>examples/&lt;set&gt;/scenario_&lt;kind&gt;</code> inputs (resolution lowered to 480×360). <code>slip</code>, <code>drop</code> and <code>wrong_direction</code> are marked "unsupported" in those older inputs but are generated by the newest code (<code>scenarios/policies/generation.py</code>), so they are authored as Studio projects on the Ghost exactly as <code>create_case_examples.py</code> does.</li>
</ul>
<h3>Things I found while doing this</h3>
<ul>
<li><b>Line-ending bug in the reviewed <code>wrong_sequence</code> example:</b> its instruction source is bound to the model's SHA-256 computed on CRLF bytes, but git checks the MPD out with LF. On a fresh Linux clone it fails with "Instruction source is bound to a different model hash". I converted my copy back to CRLF; the repo should add <code>*.mpd -text</code> (or <code>eol=crlf</code>) to <code>.gitattributes</code>.</li>
<li><b>Docs lag the code:</b> <code>docs/status/scenario_coverage.md</code> still lists <code>wrong_direction</code>, <code>slip</code> and <code>drop</code> as unsupported. The code now has <code>attempt_direction</code> / <code>release_part</code> actions and generation policies for them (scripted kinematics, no force simulation).</li>
<li><b>GPU lock serialises everything:</b> every render takes <code>$TMPDIR/legosim_gpu_jobs.lock</code>, so parallel jobs silently queue. Per-job <code>TMPDIR</code> allows concurrency; each Blender process needs ≈3.2 GB VRAM.</li>
<li><b>Human rendering is CPU-bound:</b> ≈0.3–0.5 s of Cycles per frame but ≈5–10 s of hand/contact fitting per frame in <code>human_observations</code>.</li>
<li><b>Caption fitting breaks encoding at lower resolutions:</b> the annotated <code>video.mp4</code> encoder raises "Display label does not fit at the minimum readable font size" for long step captions (e.g. the Dracaena leaf names) at 480 px width. That aborts the whole run after every frame has rendered. For those episodes I encoded <code>raw_video.mp4</code> from the rendered frames with ffmpeg.</li>
<li><b>Motion limits hit by my probes:</b> detaching a single House wall brick as a "section" fails with <i>No two separated exposed contact plans satisfy nominal reach for the group path</i>. Detaching/attaching the pose-placed window p005 fails with <i>Attachment needs explicit physical connector axes to plan insertion</i>. Parking a part inside the parts tray fails with <i>Conservative set down path is blocked by container</i>. The engine accepts all three. Only the motion layer refuses them, which is the repository's intended separation.</li>
<li><b>Bags:</b> <code>open_bag</code> exists in the engine and planner (<code>assign_bags</code>), but the JSON runner / Studio path has no bag configuration. The bag clip shown is historical.</li>
<li><b>Object observer camera:</b> fits the camera to every part's trajectory, including the whole table of loose parts, so small builds are a few pixels wide. I patched the fit to the final build for the catalog videos.</li>
</ul>
<h3>What "complete" and "rendered" do not mean</h3>
<p class="note">The repository deliberately keeps engine acceptance, procedure compliance, motion feasibility, measured hand contact and media completeness as separate results. Draft human renders here use the diagnostic <code>contacts</code> hand mode, not the strict preflight, so visible hands are a solver result and not certified contact. Catalog build orders are inferred from LDraw STEP groups.</p>`;
