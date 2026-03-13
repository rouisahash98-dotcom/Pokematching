// ============================================================
// app.js — Battle Blueprint Pokémon Team Builder
// Core jQuery logic: search, team, suggestions, evaluator, moves, types
// ============================================================

$(async function () {

    // ── State ──────────────────────────────────────────────────
    let team = []; // array of enriched Pokémon objects (max 6)
    let rivalTeam = []; // array of opponent Pokémon (max 6)

    // Suggestion refresh tracking
    let lastSuggestionBatch = new Set(); // names shown in immediately previous batch
    let lastCounterBatch = new Set(); // names shown in immediately previous rival counter batch
    let suggestionRefreshCount = 0;      // >0 means full shuffle mode
    let counterRefreshCount = 0;

    // Feature 4: Cache rival analysis results per battle format
    // Invalidated whenever rival team changes or user clicks Refresh
    let rivalAnalysisCache = { singles: null, doubles: null };

    // Declared here (top of scope) so they are available immediately on boot.
    // const has a Temporal Dead Zone — declaring mid-function would crash when
    // loadTeamFromStorage triggers renderTeam→buildMoveSuggestions before reaching them.
    const SAMPLE_MOVES_BY_TYPE = {
        normal: { name: 'Return', type: 'normal', category: 'physical', power: 102 },
        fire: { name: 'Flamethrower', type: 'fire', category: 'special', power: 90 },
        water: { name: 'Surf', type: 'water', category: 'special', power: 90 },
        electric: { name: 'Thunderbolt', type: 'electric', category: 'special', power: 90 },
        grass: { name: 'Energy Ball', type: 'grass', category: 'special', power: 90 },
        ice: { name: 'Ice Beam', type: 'ice', category: 'special', power: 90 },
        fighting: { name: 'Close Combat', type: 'fighting', category: 'physical', power: 120 },
        poison: { name: 'Sludge Bomb', type: 'poison', category: 'special', power: 90 },
        ground: { name: 'Earthquake', type: 'ground', category: 'physical', power: 100 },
        flying: { name: 'Brave Bird', type: 'flying', category: 'physical', power: 120 },
        psychic: { name: 'Psychic', type: 'psychic', category: 'special', power: 90 },
        bug: { name: 'Bug Buzz', type: 'bug', category: 'special', power: 90 },
        rock: { name: 'Stone Edge', type: 'rock', category: 'physical', power: 100 },
        ghost: { name: 'Shadow Ball', type: 'ghost', category: 'special', power: 80 },
        dragon: { name: 'Dragon Claw', type: 'dragon', category: 'physical', power: 80 },
        dark: { name: 'Crunch', type: 'dark', category: 'physical', power: 80 },
        steel: { name: 'Iron Head', type: 'steel', category: 'physical', power: 80 },
        fairy: { name: 'Moonblast', type: 'fairy', category: 'special', power: 95 },
    };
    const UTILITY_MOVE = {
        name: 'Will-O-Wisp / Stealth Rock / Roost',
        type: 'fire', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa'
    };

    // ── Boot ───────────────────────────────────────────────────
    await loadPokemonNameList();
    initAutocomplete();
    loadTeamFromStorage();   // restore saved team before first render
    renderTeam();
    renderTypeTable();
    if (team.length === 6) runTeamEvaluator();
    else if (team.length > 0) renderSuggestions();
    initRivalAutocomplete();
    runMatchupAnalysis(); // Initial check in case team is restored

    // Refresh buttons
    $('#refresh-suggestions-btn').on('click', function () {
        renderSuggestions(true);
    });
    $('#refresh-counters-btn').on('click', function () {
        // Invalidate cache so a true refresh is forced
        rivalAnalysisCache = { singles: null, doubles: null };
        runRivalAnalysis(null, true);
    });

    // Feature 1: Clear team buttons
    $('#clear-team-btn').on('click', function () {
        if (team.length === 0) return;
        team = [];
        lastSuggestionBatch = new Set();
        suggestionRefreshCount = 0;
        saveTeam();
        renderTeam();
        renderSuggestions();
        clearEvaluator();
        updateMovesTab();
        runMatchupAnalysis();
        showToast('Team cleared!', 'info');
    });

    $('#clear-rival-btn').on('click', function () {
        if (rivalTeam.length === 0) return;
        rivalTeam = [];
        rivalAnalysisCache = { singles: null, doubles: null };
        lastCounterBatch = new Set();
        counterRefreshCount = 0;
        renderRivalTeam();
        $('#rival-counters-section').hide();
        $('#rival-matchup-section').hide();
        showToast('Rival team cleared!', 'info');
    });

    // ── Search / Autocomplete ───────────────────────────────────
    function initAutocomplete() {
        $('#search-input').autocomplete({
            source: function (req, res) {
                const term = req.term.toLowerCase();
                const matches = POKEMON_NAME_LIST
                    .filter(n => n.startsWith(term))
                    .slice(0, 10)
                    .map(n => ({ label: capitalise(n), value: n }));
                res(matches);
            },
            minLength: 2,
            delay: 200,
            select: function (e, ui) {
                e.preventDefault();
                $('#search-input').val(ui.item.label);
                addPokemon(ui.item.value);
            }
        });

        $('#search-btn').on('click', function () {
            // Close autocomplete first to prevent it from clearing the input
            $('#search-input').autocomplete('close');
            const name = resolveSearchTerm($('#search-input').val());
            if (name) addPokemon(name);
        });

        $('#search-input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                const $widget = $(this).autocomplete('widget');
                if ($widget && $widget.is(':visible')) return;
                const name = resolveSearchTerm($(this).val());
                if (name) addPokemon(name);
            }
        });
    }

    function initRivalAutocomplete() {
        $('#rival-search-input').autocomplete({
            source: function (req, res) {
                const term = req.term.toLowerCase();
                const matches = POKEMON_NAME_LIST
                    .filter(n => n.startsWith(term))
                    .slice(0, 10)
                    .map(n => ({ label: capitalise(n), value: n }));
                res(matches);
            },
            minLength: 2,
            select: function (e, ui) {
                e.preventDefault();
                $('#rival-search-input').val(ui.item.label);
                addRivalPokemon(ui.item.value);
            }
        });

        $('#rival-search-btn').on('click', function () {
            const name = resolveSearchTerm($('#rival-search-input').val());
            if (name) addRivalPokemon(name);
        });

        $('#rival-search-input').on('keydown', function (e) {
            if (e.key === 'Enter') {
                const name = resolveSearchTerm($(this).val());
                if (name) addRivalPokemon(name);
            }
        });

        // Feature 4: format switch uses cache — no forced refresh
        $('input[name="rivalBattleFormat"]').on('change', function () {
            runRivalAnalysis(null, false);
        });
    }

    // ── Add Pokémon ────────────────────────────────────────────
    async function addPokemon(name, insertAtIdx = null, replacedByData = null) {
        if (insertAtIdx === null && team.length >= 6) {
            showToast('Your team is full! Remove a Pokémon first.', 'warning');
            return;
        }
        if (team.some(p => p.name === name)) {
            showToast(`${capitalise(name)} is already on your team!`, 'info');
            return;
        }

        showSearchLoading(true);

        // ── Step 1: fetch only — spelling errors caught here ──
        let data;
        try {
            data = await fetchPokemon(name);
        } catch (err) {
            console.error(`Error fetching Pokémon "${name}":`, err);
            showToast(`Couldn't find "${name}". Check the spelling!`, 'danger');
            showSearchLoading(false);
            return;
        }

        // ── Step 2: render — fetch already succeeded ──
        try {
            const types = parseTypes(data.types);
            const stats = parseStats(data.stats);
            const isLegendary = LEGENDARY_IDS.has(data.id);

            const newEntry = {
                id: data.id,
                name: data.name,
                displayName: capitalise(data.name),
                types,
                stats,
                isLegendary,
                sprite: spriteUrl(data.id),
                artwork: artworkUrl(data.id),
                movesRaw: data.moves.slice(0, 40),
                replacedBy: replacedByData || null   // stores swapped-out Pokémon
            };

            if (insertAtIdx !== null && insertAtIdx >= 0 && insertAtIdx < team.length) {
                team.splice(insertAtIdx, 1, newEntry);
            } else {
                team.push(newEntry);
            }

            // Reset suggestion tracking whenever the team composition changes
            lastSuggestionBatch = new Set();
            suggestionRefreshCount = 0;

            $('#search-input').val('');
            saveTeam();
            renderTeam();
            await renderSuggestions();
            if (team.length === 6) runTeamEvaluator();
            else clearEvaluator();
            runMatchupAnalysis(); // Update matchup whenever team changes

        } catch (err) {
            console.error('Error rendering Pokémon after successful fetch:', err);
            showToast('Something went wrong displaying the Pokémon. Please try again.', 'warning');
        } finally {
            showSearchLoading(false);
        }
    }

    // ── Remove Pokémon ─────────────────────────────────────────
    $(document).on('click', '.remove-btn', async function () {
        const idx = parseInt($(this).data('idx'));
        team.splice(idx, 1);
        lastSuggestionBatch = new Set();
        suggestionRefreshCount = 0;
        saveTeam();
        renderTeam();
        await renderSuggestions();
        clearEvaluator();
        updateMovesTab();
        runMatchupAnalysis(); // Update matchup whenever team changes
    });

    // ── Revert Swap ────────────────────────────────────────────
    $(document).on('click', '.revert-swap-btn', async function (e) {
        e.stopPropagation();
        const idx = parseInt($(this).closest('.team-card').data('idx'));
        const current = team[idx];
        if (!current || !current.replacedBy) return;
        const orig = current.replacedBy;
        team.splice(idx, 1, { ...orig, replacedBy: null });
        lastSuggestionBatch = new Set();
        suggestionRefreshCount = 0;
        saveTeam();
        renderTeam();
        await renderSuggestions();
        if (team.length === 6) runTeamEvaluator();
        else clearEvaluator();
        showToast(`Restored ${orig.displayName}! ↩`, 'success');
    });

    // ── Render Team Grid ───────────────────────────────────────
    function renderTeam() {
        const $grid = $('#team-grid');
        $grid.empty();

        if (team.length === 0) {
            $grid.html('<p class="empty-team-msg">Search for a Pokémon above to start building your team!</p>');
            return;
        }

        team.forEach((p, idx) => {
            const typeBadges = p.types.map(typeBadge).join('');
            const legendBadge = p.isLegendary ? '<span class="legendary-badge">★ Legendary</span>' : '';

            // Replaced indicator (top-left corner)
            const replacedHtml = p.replacedBy ? `
                <div class="replaced-indicator" title="Replaced ${p.replacedBy.displayName} — click ↩ to revert">
                    <img src="${p.replacedBy.sprite}" alt="${p.replacedBy.displayName}" class="replaced-sprite">
                    <button class="revert-swap-btn" title="Revert to ${p.replacedBy.displayName}">↩</button>
                </div>` : '';

            $grid.append(`
        <div class="team-card" data-idx="${idx}">
          <button class="remove-btn" data-idx="${idx}" title="Remove">✕</button>
          ${replacedHtml}
          ${legendBadge}
          <img class="pokemon-sprite" src="${p.artwork}" alt="${p.displayName}"
               onerror="this.src='${p.sprite}'">
          <div class="pokemon-name">${p.displayName}</div>
          <div class="type-badges">${typeBadges}</div>
          <div class="stat-bar-mini">${miniStats(p.stats)}</div>
        </div>
      `);
        });

        // Team counter
        $('#team-counter').text(`${team.length} / 6`);
        updateMovesTab();
    }

    function miniStats(stats) {
        const ORDER = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed'];
        const LABELS = { hp: 'HP', attack: 'ATK', defense: 'DEF', sp_atk: 'SPA', sp_def: 'SPD', speed: 'SPE' };
        return ORDER.map(k => {
            const val = stats[k] || 0;
            const pct = Math.round((val / 255) * 100);
            const color = val >= 100 ? '#4ade80' : val >= 60 ? '#facc15' : '#f87171';
            return `<div class="stat-row">
        <span class="stat-label">${LABELS[k]}</span>
        <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="stat-val">${val}</span>
      </div>`;
        }).join('');
    }

    // ── Suggestion Engine ──────────────────────────────────────
    async function renderSuggestions(isRefresh = false) {
        const $box = $('#suggestions-section');
        if (team.length === 0 || team.length >= 6) {
            $box.hide(); return;
        }

        $box.show();
        $('#suggestions-grid').html('<div class="loading-spinner"><div class="spinner"></div><p>Finding great team-mates…</p></div>');

        // Manage refresh counter — first press excludes last batch, subsequent presses shuffle freely
        if (isRefresh) {
            suggestionRefreshCount++;
        }

        const legendaryCount = team.filter(p => p.isLegendary).length;
        const weaknesses = aggregateWeaknesses();

        // Compute the team's CURRENT x4 and x2 weakness sets so we don't introduce new ones
        const currentX4 = new Set();
        const currentX2 = new Set();
        team.forEach(p => {
            getAllWeaknesses(p.types, 4).forEach(t => currentX4.add(t));
            getAllWeaknesses(p.types, 2).forEach(t => currentX2.add(t));
        });

        // Top 3 uncovered weaknesses
        const topWeak = Object.entries(weaknesses)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([t]) => t);

        if (topWeak.length === 0) {
            $('#suggestions-grid').html('<p class="no-suggestions">Your team already covers every type well! Try adding variety.</p>');
            return;
        }

        // Gather candidates from PokéAPI type endpoints
        let candidates = [];
        for (const weakType of topWeak) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/type/${weakType}`);
                const data = await res.json();
                const pkmnOfType = data.pokemon
                    .map(p => p.pokemon.name)
                    .filter(n => !team.some(t => t.name === n));
                candidates.push(...pkmnOfType);
            } catch (e) { /* skip type if fetch fails */ }
        }

        // Also pull Pokémon of types that resist topWeak
        const resistTypes = topWeak.flatMap(wt => getResistingTypes(wt));
        for (const rt of [...new Set(resistTypes)].slice(0, 3)) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/type/${rt}`);
                const data = await res.json();
                const pkmnOfType = data.pokemon.map(p => p.pokemon.name)
                    .filter(n => !team.some(t => t.name === n));
                candidates.push(...pkmnOfType);
            } catch (e) { /* skip */ }
        }

        // Deduplicate & filter exotic forms
        candidates = [...new Set(candidates)]
            .filter(n => {
                const hasExoticForm = /-(?:mega|gmax|alola|galar|hisui|paldea|totem|partner|starter|original|zen|therian|resolute|black|white|pirouette|ash|eternal|-o|-f|-m|-s|-10|50|complete|dusk|dawn|midday|midnight|school|disguised|busted)-?/.test(n);
                return !hasExoticForm;
            });

        // On first refresh: exclude last batch. On further refreshes: pure shuffle
        if (isRefresh && suggestionRefreshCount === 1 && lastSuggestionBatch.size > 0) {
            candidates = candidates.filter(n => !lastSuggestionBatch.has(n));
        }

        shuffle(candidates);
        const picked = candidates.slice(0, 40); // Feature 5: fetch more to allow stricter filtering

        const enriched = (await Promise.allSettled(picked.map(n => fetchPokemon(n))))
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(d => {
                if (legendaryCount >= 1 && LEGENDARY_IDS.has(d.id)) return false;
                if (d.id > 1025) return false;
                // Feature 5: Reject if candidate adds a NEW x4 weakness
                const cTypes = parseTypes(d.types);
                const newX4 = getAllWeaknesses(cTypes, 4).filter(t => !currentX4.has(t));
                if (newX4.length > 0) return false;
                // Feature 5: Count new x2 weaknesses as a penalty (keep candidates but rank lower)
                return true;
            });

        if (enriched.length === 0) {
            $('#suggestions-grid').html('<p class="no-suggestions">No suggestions found. Try a different team!</p>');
            return;
        }

        // Feature 5: Score = coverage gain minus penalty for NEW x2 weaknesses introduced
        function candidateScore(d) {
            const cTypes = parseTypes(d.types);
            const coverage = coverageScore(d, topWeak);
            const newX2 = getAllWeaknesses(cTypes, 2).filter(t => !currentX2.has(t)).length;
            return coverage - newX2 * 0.75; // penalise new x2 weaknesses
        }
        enriched.sort((a, b) => candidateScore(b) - candidateScore(a));

        // Record this batch so next refresh can skip it
        lastSuggestionBatch = new Set(enriched.map(d => d.name));

        const $grid = $('#suggestions-grid');
        $grid.empty();
        enriched.forEach(d => {
            const types = parseTypes(d.types);
            const badges = types.map(typeBadge).join('');
            const isLeg = LEGENDARY_IDS.has(d.id);
            const legTag = isLeg ? '<span class="legendary-badge">★ Legendary</span>' : '';
            $grid.append(`
        <div class="suggestion-card">
          ${legTag}
          <img class="suggestion-sprite" src="${artworkUrl(d.id)}" alt="${d.name}"
               onerror="this.src='${spriteUrl(d.id)}'">
          <div class="suggestion-name">${capitalise(d.name)}</div>
          <div class="type-badges">${badges}</div>
          <button class="add-suggestion-btn" data-name="${d.name}">+ Add to Team</button>
        </div>
      `);
        });

        // Info about what we're covering
        const weakLabels = topWeak.map(t => typeBadge(t)).join(' ');
        $('#suggestions-label').html(`Covering team weaknesses: ${weakLabels}`);
    }

    $(document).on('click', '.add-suggestion-btn', async function () {
        const name = $(this).data('name');
        await addPokemon(name);
    });

    // ── Type Coverage Helpers ───────────────────────────────────
    function aggregateWeaknesses() {
        const scores = {};
        ALL_TYPES.forEach(at => {
            let weak = 0;
            team.forEach(p => {
                const m = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (m > 1) weak++;
            });
            scores[at] = weak;
        });
        return scores;
    }

    function getResistingTypes(attackingType) {
        // Find types T such that attackingType is NOT very effective against T
        return ALL_TYPES.filter(defType => {
            const m = getEffectiveness(attackingType, defType);
            return m < 1;
        });
    }

    function coverageScore(apiData, weakTypes) {
        const types = parseTypes(apiData.types);
        let score = 0;
        weakTypes.forEach(wt => {
            const m = getCombinedEffectiveness(wt, types[0], types[1]);
            if (m < 1) score++;
        });
        return score;
    }

    // Returns all attacking types that hit the given type combination at the specified multiplier (2 or 4)
    function getAllWeaknesses(types, multiplier) {
        return ALL_TYPES.filter(at => {
            const m = getCombinedEffectiveness(at, types[0], types[1]);
            return m === multiplier;
        });
    }

    // ── Team Evaluator ─────────────────────────────────────────
    function runTeamEvaluator() {
        const $panel = $('#evaluator-panel');
        $panel.show();
        $('html, body').animate({ scrollTop: $panel.offset().top - 20 }, 600);

        // Defense Matrix
        const matrix = {};
        ALL_TYPES.forEach(at => {
            matrix[at] = { weak: 0, resist: 0, immune: 0 };
            team.forEach(p => {
                const m = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (m === 0) matrix[at].immune++;
                else if (m < 1) matrix[at].resist++;
                else if (m > 1) matrix[at].weak++;
            });
        });

        // Build table
        let tableHtml = `<table class="defense-matrix">
      <thead><tr><th>Attacking Type</th><th>🔴 Weak</th><th>🟢 Resist</th><th>⚪ Immune</th><th>Status</th></tr></thead>
      <tbody>`;

        const criticals = [];
        ALL_TYPES.forEach(at => {
            const { weak, resist, immune } = matrix[at];
            const isCritical = weak >= 3;
            if (isCritical) criticals.push(at);
            const statusClass = isCritical ? 'status-critical' : weak === 0 ? 'status-safe' : 'status-ok';
            const statusLabel = isCritical ? '⚠️ Critical' : weak === 0 ? '✅ Safe' : '▸ Manageable';
            tableHtml += `<tr class="${isCritical ? 'row-critical' : ''}">
        <td>${typeBadge(at)}</td>
        <td class="center">${weak}</td>
        <td class="center">${resist}</td>
        <td class="center">${immune}</td>
        <td class="${statusClass}">${statusLabel}</td>
      </tr>`;
        });
        tableHtml += '</tbody></table>';
        $('#defense-matrix-container').html(tableHtml);

        // Weakness Overview Table
        let weaknessOverviewHtml = `
            <div class="section-title" style="margin-top:1.5rem;">Weakness Overview</div>
            <table class="weakness-overview-table">
                <thead>
                    <tr>
                        <th>Pokémon</th>
                        <th>Types</th>
                        <th>Weaknesses (4× / 2×)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        team.forEach(p => {
            const x4w = getAllWeaknesses(p.types, 4);
            const x2w = getAllWeaknesses(p.types, 2);

            const x4Badges = x4w.map(t => `<span class="weakness-badge x4-badge">x4 ${capitalise(t)}</span>`).join(' ');
            const x2Badges = x2w.map(t => `<span class="weakness-badge x2-badge">x2 ${capitalise(t)}</span>`).join(' ');

            weaknessOverviewHtml += `
                <tr>
                    <td class="poke-cell">
                        <img src="${p.sprite}" alt="${p.displayName}" class="mini-sprite me-2">
                        <strong>${p.displayName}</strong>
                    </td>
                    <td>${p.types.map(typeBadge).join(' ')}</td>
                    <td>
                        <div class="d-flex flex-wrap gap-1">
                            ${x4Badges} ${x2Badges || (x4Badges ? '' : '<span class="text-muted" style="font-size:0.7rem;">None</span>')}
                        </div>
                    </td>
                </tr>
            `;
        });

        weaknessOverviewHtml += '</tbody></table>';
        $('#weakness-overview-container').html(weaknessOverviewHtml);

        // Weakness warnings + replacement suggestions (all weaknesses, not only criticals)
        const allWeakTypes = ALL_TYPES.filter(at => matrix[at].weak >= 2); // 2+ members weak = significant

        if (allWeakTypes.length > 0) {
            let warnHtml = '<div class="critical-warnings">';
            const criticalTypes = allWeakTypes.filter(at => matrix[at].weak >= 3);
            const regularTypes = allWeakTypes.filter(at => matrix[at].weak === 2);

            if (criticalTypes.length > 0) {
                warnHtml += '<h5>⚠️ Critical Weaknesses Detected</h5>';
            } else {
                warnHtml += '<h5>⚠️ Team Weaknesses Detected</h5>';
            }

            allWeakTypes.forEach(ct => {
                const counterTypes = getResistingTypes(ct).slice(0, 3);
                const mostVuln = [...team].sort((a, b) => {
                    const ma = getCombinedEffectiveness(ct, a.types[0], a.types[1]);
                    const mb = getCombinedEffectiveness(ct, b.types[0], b.types[1]);
                    return mb - ma;
                })[0];
                const mostVulnIdx = team.indexOf(mostVuln);

                const vulnerableMembers = team.filter(p => {
                    const eff = getCombinedEffectiveness(ct, p.types[0], p.types[1]);
                    return eff > 1;
                });
                const vulnerableHtm = vulnerableMembers.map(p => {
                    const isSelected = p.id === mostVuln.id;
                    return `
                    <div class="mini-poke-vulnerable${isSelected ? ' selected' : ''}" 
                         data-idx="${team.indexOf(p)}" 
                         data-name="${p.name}"
                         data-display-name="${p.displayName}"
                         title="Click to set ${p.displayName} as the swap target">
                        <img src="${spriteUrl(p.id)}" alt="${p.displayName}" class="mini-sprite">
                        <span>${p.displayName}</span>
                    </div>`;
                }).join('');

                const isCrit = matrix[ct].weak >= 3;
                warnHtml += `<div class="warning-block${isCrit ? ' warning-critical' : ''}" data-type="${ct}">
          <div class="weakness-summary mb-2">
            Your team has <strong>${matrix[ct].weak} members</strong> weak to ${typeBadge(ct)}:
            <div class="vulnerable-list mt-2">${vulnerableHtm}</div>
          </div>
          <div class="counter-suggestions-row">
            <span class="suggestion-intro">Click a Pokémon below to replace <strong class="replace-target-name">${mostVuln.displayName}</strong>:</span>
            ${counterTypes.map(t => {
                    const currentTeamNames = team.map(p => p.name.toLowerCase());
                    const examplesHtm = (TYPE_EXAMPLES[t] || [])
                        .filter(ex => !currentTeamNames.includes(ex.name.toLowerCase()))
                        .slice(0, 3)
                        .map(ex => `
                <div class="mini-poke-suggestion swap-suggestion-btn"
                     data-name="${ex.name}" data-replace-idx="${mostVulnIdx}"
                     data-replaced-name="${mostVuln.name}"
                     title="Click to replace ${mostVuln.displayName} with ${ex.name}">
                  <img src="${spriteUrl(ex.id)}" alt="${ex.name}" class="mini-sprite">
                  <span>${ex.name}</span>
                  <span class="swap-hint">↔ Swap</span>
                </div>
              `).join('');
                    return `
                <div class="counter-item-v2">
                  <div class="counter-type-header">${typeBadge(t)}</div>
                  <div class="mini-examples-grid">${examplesHtm}</div>
                </div>`;
                }).join('')}
          </div>
        </div>`;
            });
            warnHtml += '</div>';
            $('#critical-warnings').html(warnHtml);
        } else {
            $('#critical-warnings').html('<div class="team-safe"><p>✅ No critical weaknesses! Your team has great coverage.</p></div>');
        }

        // Strength summary
        const strongAgainstData = {};
        ALL_TYPES.forEach(at => {
            team.forEach(p => {
                p.types.forEach(pt => {
                    if (getEffectiveness(pt, at) > 1) {
                        if (!strongAgainstData[at]) strongAgainstData[at] = [];
                        if (!strongAgainstData[at].includes(p.displayName)) {
                            strongAgainstData[at].push(p.displayName);
                        }
                    }
                });
            });
        });

        // Feature 3: Show strength even when only 1 Pokémon hits that type effectively
        const strongTypes = Object.keys(strongAgainstData).filter(t => strongAgainstData[t].length >= 1);

        if (strongTypes.length) {
            const labels = strongTypes.map(t => {
                const members = strongAgainstData[t].join(', ');
                return `<div class="strength-tag">${typeBadge(t)} <span class="strength-members">(${members})</span></div>`;
            }).join('');
            $('#strength-summary').html(`
                <div class="strength-summary-wrapper">
                    <strong>💪 Your team hits hard against:</strong>
                    <div class="strength-tags-container mt-2">${labels}</div>
                </div>
            `);
        } else {
            $('#strength-summary').html('');
        }
    }

    // ── Swap Suggestion Click ──────────────────────────────────
    $(document).on('click', '.swap-suggestion-btn', async function () {
        const suggestName = $(this).data('name');
        const replaceIdx = parseInt($(this).data('replace-idx'));
        if (isNaN(replaceIdx) || replaceIdx < 0 || replaceIdx >= team.length) return;

        const outgoing = team[replaceIdx];
        // Store the full outgoing member so we can revert later
        const replacedByData = {
            id: outgoing.id,
            name: outgoing.name,
            displayName: outgoing.displayName,
            types: outgoing.types,
            stats: outgoing.stats,
            isLegendary: outgoing.isLegendary,
            sprite: outgoing.sprite,
            artwork: outgoing.artwork,
            movesRaw: outgoing.movesRaw || []
        };

        showToast(`Swapping ${outgoing.displayName} → ${capitalise(suggestName)}…`, 'info');
        await addPokemon(suggestName, replaceIdx, replacedByData);
    });

    function clearEvaluator() {
        $('#evaluator-panel').hide();
    }

    // ── Select Swap Target ─────────────────────────────────────
    $(document).on('click', '.mini-poke-vulnerable', function () {
        const $this = $(this);
        const $block = $this.closest('.warning-block');
        const newIdx = $this.data('idx');
        const newName = $this.data('name');
        const dispName = $this.data('display-name');

        // Toggle selected class
        $block.find('.mini-poke-vulnerable').removeClass('selected');
        $this.addClass('selected');

        // Update instruction text
        $block.find('.replace-target-name').text(dispName);

        // Update all swap suggestion buttons in this block
        $block.find('.swap-suggestion-btn').each(function () {
            const $btn = $(this);
            $btn.data('replace-idx', newIdx);
            $btn.data('replaced-name', newName);
            const suggestName = capitalise($btn.data('name'));
            $btn.attr('title', `Click to replace ${dispName} with ${suggestName}`);
        });
    });

    async function addRivalPokemon(name) {
        if (rivalTeam.length >= 6) {
            showToast('Rival team is full!', 'warning');
            return;
        }
        if (rivalTeam.some(p => p.name === name)) {
            showToast(`${capitalise(name)} is already on the rival team!`, 'info');
            return;
        }

        try {
            const data = await fetchPokemon(name);
            const types = parseTypes(data.types);
            rivalTeam.push({
                id: data.id,
                name: data.name,
                displayName: capitalise(data.name),
                types,
                sprite: spriteUrl(data.id)
            });
            // Feature 4: invalidate cache when rival team changes
            rivalAnalysisCache = { singles: null, doubles: null };
            $('#rival-search-input').val('');
            renderRivalTeam();
            runRivalAnalysis();
        } catch (err) {
            showToast(`Couldn't find "${name}" for the rival team.`, 'danger');
        }
    }

    function renderRivalTeam() {
        const $grid = $('#rival-team-grid');
        $grid.empty();
        if (rivalTeam.length === 0) {
            $grid.html('<p class="empty-team-msg text-center opacity-50">Add opponent Pokémon to start analysis.</p>');
            return;
        }

        rivalTeam.forEach((p, idx) => {
            $grid.append(`
                <div class="rival-mini-card">
                    <button class="rival-remove-btn" data-idx="${idx}">✕</button>
                    <img src="${p.sprite}" alt="${p.displayName}" class="rival-mini-sprite" onerror="this.src='${artworkUrl(p.id)}'">
                    <div class="rival-mini-name">${p.displayName}</div>
                    <div class="type-badges">${p.types.map(typeBadge).join('')}</div>
                </div>
            `);
        });

        runMatchupAnalysis();
    }

    function runMatchupAnalysis() {
        console.log('Running Matchup Analysis...', { rivalCount: rivalTeam.length, teamCount: team.length });
        const $section = $('#rival-matchup-section');
        const $container = $('#matchup-container');

        if (rivalTeam.length === 0 || team.length === 0) {
            console.log('Matchup analysis skipped: empty team(s).');
            $section.hide();
            return;
        }

        $section.show();
        $container.empty();

        rivalTeam.forEach(rival => {
            // Find best counter in OUR team
            const bestCounters = team.map(member => {
                let score = 0;
                // Offense: Can we hit them?
                member.types.forEach(mt => {
                    const eff = getCombinedEffectiveness(mt, rival.types[0], rival.types[1]);
                    if (eff > 1) score += (eff * 2);
                    if (eff === 0) score -= 2;
                });
                // Defense: Can they hit us?
                rival.types.forEach(rt => {
                    const eff = getCombinedEffectiveness(rt, member.types[0], member.types[1]);
                    if (eff < 1) score += (1 / (eff || 0.1)) * 2;
                    if (eff > 1) score -= (eff * 3);
                });
                return { member, score };
            }).sort((a, b) => b.score - a.score);

            const top = bestCounters[0];
            let statusClass = 'status-draw';
            let statusLabel = 'Neutral';

            if (top.score > 8) { statusClass = 'status-win'; statusLabel = 'Strong Counter'; }
            else if (top.score > 2) { statusClass = 'status-win'; statusLabel = 'Advantage'; }
            else if (top.score < -5) { statusClass = 'status-lose'; statusLabel = 'Danger'; }

            $container.append(`
                <div class="matchup-row">
                    <div class="matchup-status ${statusClass}">${statusLabel}</div>
                    <div class="matchup-rival">
                        <img src="${rival.sprite}" alt="${rival.displayName}" class="matchup-poke-sprite">
                        <div class="matchup-poke-info">
                            <span class="matchup-poke-name">${rival.displayName}</span>
                            <div class="type-badges">${rival.types.map(typeBadge).join('')}</div>
                        </div>
                    </div>
                    <div class="matchup-your-team">
                        <img src="${top.member.sprite}" alt="${top.member.displayName}" class="matchup-poke-sprite">
                        <div class="matchup-poke-info">
                            <span class="matchup-poke-name">${top.member.displayName}</span>
                            <div class="matchup-best-counters">
                                ${bestCounters.slice(0, 3).filter(c => c.score > 0).map(c => `
                                    <div class="mini-counter-token" title="${c.member.displayName} (Score: ${Math.round(c.score)})">
                                        <img src="${c.member.sprite}" alt="${c.member.displayName}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });
    }

    $(document).on('click', '.rival-remove-btn', function () {
        const idx = $(this).data('idx');
        rivalTeam.splice(idx, 1);
        // Feature 4: invalidate cache on team change
        rivalAnalysisCache = { singles: null, doubles: null };
        lastCounterBatch = new Set();
        counterRefreshCount = 0;
        renderRivalTeam();
        runRivalAnalysis();
    });

    async function runRivalAnalysis(_unused, isRefresh = false) {
        const $section = $('#rival-counters-section');
        const $grid = $('#rival-counters-grid');
        const $label = $('#rival-counters-label');

        if (rivalTeam.length === 0) {
            $section.hide();
            return;
        }

        if (isRefresh) counterRefreshCount++;

        const format = $('input[name="rivalBattleFormat"]:checked').val() || 'singles';

        // Feature 4: serve from cache if format hasn't changed and no refresh
        if (!isRefresh && rivalAnalysisCache[format]) {
            $section.show();
            $grid.html(rivalAnalysisCache[format].gridHtml);
            $label.html(rivalAnalysisCache[format].labelHtml);
            return;
        }

        $section.show();
        $grid.html('<div class="loading-spinner"><div class="spinner"></div><p>Sizing up the competition…</p></div>');

        // 1. Analyze weaknesses per rival Pokémon and across the whole team
        const rivalWeaknesses = {};
        const rivalWeakMap = {}; // per-rival weak types
        rivalTeam.forEach(p => {
            rivalWeakMap[p.name] = [];
            ALL_TYPES.forEach(at => {
                const eff = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (eff > 1) {
                    rivalWeaknesses[at] = (rivalWeaknesses[at] || 0) + 1;
                    rivalWeakMap[p.name].push(at);
                }
            });
        });

        const exploitTypes = Object.entries(rivalWeaknesses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([t]) => t);

        if (exploitTypes.length === 0) {
            $grid.html('<p class="no-suggestions text-center">Your rival seems well balanced! No common type weaknesses found.</p>');
            $label.html('');
            return;
        }

        // 2. Fetch candidates — grab types for ALL rival weaknesses to improve breadth
        const allRivalWeakTypes = [...new Set(Object.values(rivalWeakMap).flat())];
        let candidates = [];
        const typesToFetch = [...new Set([...exploitTypes, ...allRivalWeakTypes])].slice(0, 6);
        for (const t of typesToFetch) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
                const data = await res.json();
                candidates.push(...data.pokemon.map(p => p.pokemon.name));
            } catch (e) { }
        }

        candidates = [...new Set(candidates)].filter(n => !/-(?:mega|gmax|alola|galar|hisui|paldea|totem)/.test(n));

        // First refresh: skip last counter batch; subsequent: pure shuffle
        if (isRefresh && counterRefreshCount === 1 && lastCounterBatch.size > 0) {
            candidates = candidates.filter(n => !lastCounterBatch.has(n));
        }

        shuffle(candidates);

        // Fetch up to 30 to have a large pool for breadth selection
        const picked = candidates.slice(0, 30);
        const results = (await Promise.allSettled(picked.map(n => fetchPokemon(n))))
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(d => d.id <= 1025);

        // Feature 6/F9: Breadth-first selection — ensure coverage across all rival Pokémon
        // Each candidate gets a score per rival it counter (multiplied by eff), pick greedily
        const rivalCoverage = new Map(rivalTeam.map(p => [p.name, 0])); // how many counters each rival has
        const selected = [];

        // Score a candidate: how well does it counter each rival?
        function rivalCounterScore(d, format) {
            const types = parseTypes(d.types);
            const stats = parseStats(d.stats);
            let total = 0;
            rivalTeam.forEach(rival => {
                let offScore = 0;
                types.forEach(mt => {
                    const eff = getCombinedEffectiveness(mt, rival.types[0], rival.types[1]);
                    if (eff > 1) offScore += eff;
                });
                // Format suitability bonus
                if (format === 'singles' && (stats.speed > 100 || stats.attack > 115 || stats.sp_atk > 115)) offScore += 1;
                if (format === 'doubles' && (types.includes('steel') || types.includes('fairy') || stats.hp > 100)) offScore += 1;
                total += offScore;
            });
            return total;
        }

        // Breadth-first: prioritise candidates that cover rivals with fewest counters so far
        function breadthPriorityScore(d) {
            const types = parseTypes(d.types);
            let score = 0;
            rivalTeam.forEach(rival => {
                const offEff = Math.max(...types.map(mt => getCombinedEffectiveness(mt, rival.types[0], rival.types[1])));
                if (offEff > 1) {
                    // Bonus inversely proportional to how many counters this rival already has
                    const existingCoverage = rivalCoverage.get(rival.name) || 0;
                    score += offEff * (1 + 1 / (existingCoverage + 1));
                }
            });
            return score;
        }

        const pool = [...results];
        while (selected.length < 6 && pool.length > 0) {
            // Sort by breadth priority each iteration
            pool.sort((a, b) => breadthPriorityScore(b) - breadthPriorityScore(a));
            const best = pool.shift();
            selected.push(best);
            // Update coverage counts
            const bestTypes = parseTypes(best.types);
            rivalTeam.forEach(rival => {
                const eff = Math.max(...bestTypes.map(mt => getCombinedEffectiveness(mt, rival.types[0], rival.types[1])));
                if (eff > 1) {
                    rivalCoverage.set(rival.name, (rivalCoverage.get(rival.name) || 0) + 1);
                }
            });
        }

        // Record this batch
        lastCounterBatch = new Set(selected.map(d => d.name));

        // Build HTML
        let gridHtml = '';
        selected.forEach(d => {
            const types = parseTypes(d.types);
            const stats = parseStats(d.stats);

            let formatReason = '';
            if (format === 'singles') {
                if (stats.speed > 100) formatReason = 'Outspeeds many threats';
                else if (stats.attack > 115 || stats.sp_atk > 115) formatReason = 'Deals massive damage';
            } else {
                if (types.includes('steel') || types.includes('fairy')) formatReason = 'Defensive utility';
                else if (stats.hp > 100 || stats.defense > 100) formatReason = 'Solid bulk for doubles';
            }

            // Find which rivals this counters
            const targets = rivalTeam.filter(p =>
                types.some(mt => getCombinedEffectiveness(mt, p.types[0], p.types[1]) > 1)
            );
            const targetNames = targets.length > 0 ? targets.map(p => p.displayName).join(', ') : 'General support';
            const rationale = formatReason
                ? `<strong>${formatReason}</strong><br>Counters: ${targetNames}`
                : `Counters: ${targetNames}`;

            gridHtml += `
                <div class="suggestion-card rival-counter-card">
                    <img class="suggestion-sprite" src="${artworkUrl(d.id)}" alt="${d.name}"
                         onerror="this.src='${spriteUrl(d.id)}'">
                    <div class="suggestion-name">${capitalise(d.name)}</div>
                    <div class="type-badges mb-2">${types.map(typeBadge).join('')}</div>
                    <span class="counter-rationale">${rationale}</span>
                    <button class="add-suggestion-btn" data-name="${d.name}" style="margin-top:0.8rem">+ Add to Your Team</button>
                </div>
            `;
        });

        const exploitLabels = exploitTypes.map(typeBadge).join(' ');
        const labelHtml = `Exploiting opponent weaknesses: ${exploitLabels}`;

        // Feature 4: store in cache
        rivalAnalysisCache[format] = { gridHtml, labelHtml };

        $grid.html(gridHtml);
        $label.html(labelHtml);
    }

    // ── Moves & Items Tab ───────────────────────────────────────
    function updateMovesTab() {
        const $container = $('#moves-container');
        $container.empty();

        if (team.length === 0) {
            $container.html('<p class="empty-team-msg">Add Pokémon to your team first, then come here for move & item suggestions!</p>');
            return;
        }

        // Feature 7: Track which coverage types have already been assigned across the team
        const usedCoverageTypes = new Set();

        team.forEach((p, idx) => {
            // Feature 7: each Pokémon gets item suggestion + alternatives
            const { main: itemSugg, alternatives: itemAlts } = getSuggestedItem(p.stats, p.types);
            const itemIconHtml = itemSugg
                ? `<img class="item-icon" src="${itemIconUrl(itemSugg.slug)}" alt="${itemSugg.name}" onerror="this.style.display='none'"> ${itemSugg.name}`
                : 'Focus Sash';
            const itemRationale = itemSugg ? itemSugg.rationale : '';

            // Build alternatives HTML
            let altsHtml = '';
            if (itemAlts && itemAlts.length > 0) {
                const altRows = itemAlts.map(alt => `
                    <div class="item-alt-row">
                        <img src="${itemIconUrl(alt.slug)}" alt="${alt.name}" onerror="this.style.display='none'">
                        <span><strong>${alt.name}</strong> — ${alt.rationale}</span>
                    </div>
                `).join('');
                altsHtml = `
                    <div class="item-alternatives">
                        <div class="item-alts-label">Alternatives</div>
                        ${altRows}
                    </div>
                `;
            }

            // Feature 7: pass usedCoverageTypes so each Pokémon gets a unique coverage move
            const moveSugg = buildMoveSuggestions(p, usedCoverageTypes);

            const typeBadgesHtml = p.types.map(typeBadge).join('');
            $container.append(`
        <div class="moves-card">
          <div class="moves-card-header">
            <img class="moves-sprite" src="${p.sprite}" alt="${p.displayName}">
            <div>
              <div class="moves-pokemon-name">${p.displayName}</div>
              <div class="type-badges">${typeBadgesHtml}</div>
            </div>
          </div>
          <div class="moves-body">
            <div class="move-list">
              <h6>⚔️ Suggested Moves</h6>
              ${moveSugg}
            </div>
            <div class="item-suggestion">
              <h6>🎒 Suggested Item</h6>
              <div class="item-row">${itemIconHtml}</div>
              <div class="item-rationale">${itemRationale}</div>
              ${altsHtml}
            </div>
          </div>
        </div>
      `);
        });
    }

    function buildMoveSuggestions(p, usedCoverageTypes = new Set()) {
        // Use type-based suggestions since PokéAPI move fetching per Pokémon is too slow
        const suggestions = [];

        // 2× STAB moves
        p.types.forEach(t => {
            const move = SAMPLE_MOVES_BY_TYPE[t];
            if (move) suggestions.push({ ...move, tag: 'STAB', tagColor: '#4ade80' });
        });

        // Feature 7: 1× coverage move — pick from team weaknesses, but exclude already-used coverage types
        // so each Pokémon on the team covers a different field
        const weakTypes = Object.entries(aggregateWeaknesses())
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([t]) => t);
        let coveragePicked = false;
        for (const wt of weakTypes) {
            // Skip if this move type is already a STAB for this Pokémon
            if (p.types.includes(wt)) continue;
            // Feature 7: prefer types not yet covered by another teammate
            const cov = SAMPLE_MOVES_BY_TYPE[wt];
            if (cov && !suggestions.some(s => s.name === cov.name) && !usedCoverageTypes.has(wt)) {
                suggestions.push({ ...cov, tag: 'Coverage', tagColor: '#60a5fa' });
                usedCoverageTypes.add(wt);
                coveragePicked = true;
                break;
            }
        }
        // Fallback: if all top-weak types are taken, pick any remaining one
        if (!coveragePicked) {
            for (const wt of weakTypes) {
                if (p.types.includes(wt)) continue;
                const cov = SAMPLE_MOVES_BY_TYPE[wt];
                if (cov && !suggestions.some(s => s.name === cov.name)) {
                    suggestions.push({ ...cov, tag: 'Coverage', tagColor: '#60a5fa' });
                    break;
                }
            }
        }

        // Feature 7: Role-based utility move instead of the same generic one
        const utilMove = getRoleUtilityMove(p);
        suggestions.push(utilMove);

        return suggestions.slice(0, 4).map(mv => {
            const catIcon = mv.category === 'physical' ? '⚡' : mv.category === 'special' ? '🌀' : '🛡️';
            return `<div class="move-row">
        <span class="move-tag" style="background:${mv.tagColor || '#888'}">${mv.tag}</span>
        ${typeBadge(mv.type)}
        <span class="move-name">${mv.name}</span>
        <span class="move-meta">${catIcon} ${mv.power ? mv.power + ' PWR' : 'Status'}</span>
      </div>`;
        }).join('');
    }

    // Feature 7: Role-based utility move suggestions
    function getRoleUtilityMove(p) {
        const s = p.stats;
        const types = p.types;
        // Physical sweeper
        if (s.attack >= s.sp_atk && s.speed >= 90) return { name: 'Swords Dance', type: 'normal', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa' };
        // Special sweeper
        if (s.sp_atk > s.attack && s.speed >= 90) return { name: 'Nasty Plot', type: 'dark', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa' };
        // Defensive wall
        if (s.defense >= 90 || s.sp_def >= 90) return { name: 'Recover / Roost', type: 'normal', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa' };
        // Hazard setter
        if (s.hp >= 85 || s.defense >= 75) return { name: 'Stealth Rock', type: 'rock', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa' };
        // Pivot
        if (types.includes('water') || types.includes('grass')) return { name: 'U-turn / Volt Switch', type: 'bug', category: 'physical', power: 70, tag: 'Utility', tagColor: '#a78bfa' };
        // Default
        return { name: 'Will-O-Wisp / Thunder Wave', type: 'fire', category: 'status', power: null, tag: 'Utility', tagColor: '#a78bfa' };
    }


    // ── Type Chart Tab ──────────────────────────────────────────
    function renderTypeTable() {
        const $table = $('#type-chart-table');
        // Header row
        let html = '<thead><tr><th class="tc-corner">ATK ↓ DEF →</th>';
        ALL_TYPES.forEach(t => {
            html += `<th class="tc-head" title="${t}"><span class="tc-type-pill" style="background:${TYPE_COLORS[t]}"><img src="${TYPE_ICONS[t]}" alt="${t}" style="width:14px;height:14px;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.5))"></span></th>`;
        });

        html += '</tr></thead><tbody>';

        ALL_TYPES.forEach(at => {
            html += `<tr><th class="tc-row-head">${typeBadge(at)}</th>`;
            ALL_TYPES.forEach(dt => {
                const m = getEffectiveness(at, dt);
                let cls = 'tc-normal', label = '1×';
                if (m === 0) { cls = 'tc-immune'; label = '0×'; }
                else if (m === 0.5) { cls = 'tc-resist'; label = '½×'; }
                else if (m === 2) { cls = 'tc-super'; label = '2×'; }
                html += `<td class="${cls}">${label}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        $table.html(html);

        // Dual-type calculator
        const typeOptions = ALL_TYPES.map(t => `<option value="${t}">${capitalise(t)}</option>`).join('');
        $('#dual-type1, #dual-type2').html(typeOptions);

        setupCustomSelect('#dual-type1');
        setupCustomSelect('#dual-type2');

        $('#dual-calc-btn').on('click', runDualCalc);
    }

    function setupCustomSelect(selectId) {
        const $select = $(selectId);

        // Remove existing custom select if already initialized
        $select.next('.custom-select-container').remove();

        const currentVal = $select.val() || 'normal';
        const displayVal = capitalise(currentVal);
        const iconUrl = TYPE_ICONS[currentVal] || '';

        const $container = $('<div class="custom-select-container"></div>');
        const $trigger = $(`
            <div class="custom-select-trigger">
                <div class="d-flex align-items-center gap-2">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${currentVal}" class="type-icon-small">` : ''}
                    <span>${displayVal}</span>
                </div>
            </div>
        `);
        const $options = $('<div class="custom-select-options"></div>');

        $select.after($container);
        $container.append($trigger).append($options);

        // Build options
        ALL_TYPES.forEach(t => {
            const $opt = $(`
                <div class="custom-select-option" data-value="${t}">
                    <img src="${TYPE_ICONS[t] || ''}" alt="${t}" class="type-icon-small">
                    <span>${capitalise(t)}</span>
                </div>
            `);
            if (t === currentVal) $opt.addClass('selected');
            $options.append($opt);
        });

        // Toggle open
        $trigger.on('click', function (e) {
            e.stopPropagation();
            $('.custom-select-container').not($container).removeClass('open');
            $container.toggleClass('open');
        });

        // Select option
        $options.on('click', '.custom-select-option', function (e) {
            const val = $(this).data('value');
            if ($select.val() === val) {
                $container.removeClass('open');
                return;
            }

            $select.val(val).trigger('change');

            // Update trigger UI
            $trigger.find('span').text(capitalise(val));
            const newIcon = TYPE_ICONS[val] || '';
            if (newIcon) {
                $trigger.find('img').attr('src', newIcon).attr('alt', val);
            }

            $options.find('.custom-select-option').removeClass('selected');
            $(this).addClass('selected');

            $container.removeClass('open');
            runDualCalc(); // Auto-calculate on change
        });
    }

    // Close custom selects when clicking outside
    $(document).on('click', function () {
        $('.custom-select-container').removeClass('open');
    });

    function runDualCalc() {
        const type1 = $('#dual-type1').val();
        const type2 = $('#dual-type2').val();

        // Weakness calculator (existing)
        let html = `<h6>Damage multipliers vs ${typeBadge(type1)} / ${typeBadge(type2)} defender</h6>`;
        html += '<div class="dual-results">';
        ALL_TYPES.forEach(at => {
            const m = getCombinedEffectiveness(at, type1, type2);
            let cls = 'tc-normal';
            if (m === 0) cls = 'tc-immune';
            else if (m < 1) cls = 'tc-resist';
            else if (m > 1) cls = 'tc-super';
            html += `<div class="dual-row ${cls}">${typeBadge(at)} → <strong>${m}×</strong></div>`;
        });
        html += '</div>';
        $('#dual-result').html(html);

        // Feature 8: Dual-type offensive strength calculator
        runDualStrengthCalc(type1, type2);
    }

    // Feature 8: Show what a dual-type combo hits super-effectively
    function runDualStrengthCalc(type1, type2) {
        const hits4x = [];
        const hits2x = [];

        ALL_TYPES.forEach(defType => {
            // Check what each of the two attacker types can hit
            const eff1 = getEffectiveness(type1, defType);
            const eff2 = getEffectiveness(type2, defType);
            const bestEff = Math.max(eff1, eff2);
            if (bestEff >= 4) hits4x.push(defType);
            else if (bestEff >= 2) hits2x.push(defType);
        });

        let sHtml = `<div class="dual-strength-result">`;
        sHtml += `<h6>⚔️ What ${typeBadge(type1)} + ${typeBadge(type2)} hits super-effectively</h6>`;

        if (hits4x.length === 0 && hits2x.length === 0) {
            sHtml += `<p class="no-strength-msg">No super-effective coverage with this combination.</p>`;
        } else {
            sHtml += `<div class="strength-results-grid">`;
            hits4x.forEach(t => {
                sHtml += `<div class="strength-chip x4">${typeBadge(t)} <span>4×</span></div>`;
            });
            hits2x.forEach(t => {
                sHtml += `<div class="strength-chip">${typeBadge(t)} <span>2×</span></div>`;
            });
            sHtml += `</div>`;
        }
        sHtml += `</div>`;

        // Insert after #dual-result, replacing any previous strength result
        $('#dual-strength-section').html(sHtml);
    }

    // ── UI Helpers ──────────────────────────────────────────────

    // Persist / restore team across page reloads
    function saveTeam() {
        try {
            localStorage.setItem('ag_team', JSON.stringify(team));
        } catch (e) { /* storage full or blocked — silently skip */ }
    }

    function loadTeamFromStorage() {
        try {
            const saved = localStorage.getItem('ag_team');
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                team = parsed;
                showToast(`Restored your team of ${team.length} Pokémon! 🎉`, 'success');
            }
        } catch (e) { /* corrupt data — start fresh */ }
    }

    // Resolve whatever the user typed to a proper lowercase Pokémon name.
    // 1. Try an exact match (case-insensitive).
    // 2. Fall back to the first name in the list that starts with the term.
    // This handles: capitalised input, partial typing, autocomplete dismissed early.
    function resolveSearchTerm(raw) {
        const term = raw.trim().toLowerCase();
        if (!term) return null;
        if (POKEMON_NAME_LIST.includes(term)) return term;
        const match = POKEMON_NAME_LIST.find(n => n.startsWith(term));
        return match || term; // if still no match, pass through so the API error toast fires
    }

    function capitalise(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    function showSearchLoading(on) {
        if (on) {
            $('#search-btn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
        } else {
            $('#search-btn').prop('disabled', false).html('Search');
        }
    }

    function showToast(msg, type = 'info') {
        const colors = { info: '#60a5fa', warning: '#facc15', danger: '#f87171', success: '#4ade80' };
        const $t = $(`<div class="ag-toast" style="border-left:4px solid ${colors[type]}">${msg}</div>`);
        $('#toast-area').append($t);
        setTimeout(() => $t.addClass('show'), 10);
        setTimeout(() => { $t.removeClass('show'); setTimeout(() => $t.remove(), 400); }, 3500);
    }

});
