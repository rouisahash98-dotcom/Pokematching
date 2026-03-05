// ============================================================
// app.js — Battle Blueprint Pokémon Trainer Lab
// Core jQuery logic: search, team, suggestions, evaluator, moves, types
// ============================================================

$(async function () {

    // ── State ──────────────────────────────────────────────────
    let team = []; // array of enriched Pokémon objects (max 6)
    let rivalTeam = []; // array of opponent Pokémon (max 6)

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

        $('input[name="rivalBattleFormat"]').on('change', runRivalAnalysis);
    }

    // ── Add Pokémon ────────────────────────────────────────────
    async function addPokemon(name) {
        if (team.length >= 6) {
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

            team.push({
                id: data.id,
                name: data.name,
                displayName: capitalise(data.name),
                types,
                stats,
                isLegendary,
                sprite: spriteUrl(data.id),
                artwork: artworkUrl(data.id),
                movesRaw: data.moves.slice(0, 40),
                abilities: data.abilityDetails || []
            });

            $('#search-input').val('');
            saveTeam();
            renderTeam();
            await renderSuggestions();
            if (team.length === 6) runTeamEvaluator();
            else clearEvaluator();

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
        saveTeam();
        renderTeam();
        await renderSuggestions();
        clearEvaluator();
        updateMovesTab();
    });

    function renderSyncTeam() {
        const $grid = $('#rival-sync-team-grid');
        if (!$grid.length) return;
        $grid.empty();
        if (team.length === 0) {
            $grid.html('<span class="text-muted p-2" style="font-size:0.8rem">No members in Team Builder yet.</span>');
            return;
        }
        team.forEach(p => {
            const sprite = p.sprite || spriteUrl(p.id);
            $grid.append(`
                <div class="sync-mini-card">
                    <img src="${sprite}" alt="${p.displayName}">
                    <span class="sync-mini-name">${p.displayName}</span>
                </div>
            `);
        });
    }

    // ── Clear Methods ──────────────────────────────────────────
    $('#clear-team-btn').on('click', function () {
        if (team.length === 0) return;
        if (confirm('Wipe your entire team? This cannot be undone.')) {
            team = [];
            saveTeam();
            renderTeam();
            renderSuggestions();
            clearEvaluator();
            runRivalAnalysis(); // Update counter suggestions if tab 4 is open
            showToast('Team cleared!', 'info');
        }
    });

    $('#clear-rival-btn').on('click', function () {
        if (rivalTeam.length === 0) return;
        rivalTeam = [];
        renderRivalTeam();
        runRivalAnalysis();
        showToast('Rival team cleared!', 'info');
    });

    // Refresh Rival Suggestions
    $(document).on('click', '#refresh-rival-suggestions', function () {
        runRivalAnalysis();
        showToast('Refreshing tactical options...', 'info');
    });

    // Refresh Teammates
    $(document).on('click', '#refresh-teammates', function () {
        renderSuggestions();
        showToast('Finding new teammates...', 'info');
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
            const types = p.types || [];
            const abilities = p.abilities || [];
            const typeBadges = types.map(typeBadge).join('');
            const legendBadge = p.isLegendary ? '<span class="legendary-badge">★ Legendary</span>' : '';
            $grid.append(`
        <div class="team-card animate-in" data-idx="${idx}">
          <button class="remove-btn" data-idx="${idx}" title="Remove">✕</button>
          ${legendBadge}
          <img class="pokemon-sprite" src="${p.artwork}" alt="${p.displayName}"
               onerror="this.src='${p.sprite}'">
          <div class="pokemon-name">${p.displayName}</div>
          <div class="pokemon-types">${typeBadges}</div>
          <div class="pokemon-abilities-mini mt-1">
             ${abilities.map(a => `
                <span class="ability-tag-mini ${a.isHidden ? 'ability-hidden' : ''}" 
                      title="${capitalise(a.name.replace('-', ' '))}: ${a.description}">
                    ${capitalise(a.name.replace('-', ' '))}
                </span>
             `).join('')}
          </div>
          <div class="stat-bar-mini">${miniStats(p.stats)}</div>
        </div>
      `);
        });

        // Update synchronized team in Rival Tab
        renderSyncTeam();

        // Team counter & Footer status
        $('#team-counter').text(`${team.length} / 6`);
        $('#footer-team-status').text(`${team.length} member${team.length === 1 ? '' : 's'}`);
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
    async function renderSuggestions() {
        const $box = $('#suggestions-section');
        if (team.length === 0 || team.length >= 6) {
            $box.hide(); return;
        }

        $box.show();
        $('#suggestions-grid').html('<div class="loading-spinner"><div class="spinner"></div><p>Finding great team-mates…</p></div>');

        const legendaryCount = team.filter(p => p.isLegendary).length;
        const weaknesses = aggregateWeaknesses();

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
                // Get Pokémon of this type (they provide coverage against our weakness)
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

        // Deduplicate, filter to IDs ≤ 1025, shuffle, pick 5
        candidates = [...new Set(candidates)]
            .filter(n => {
                // Accept only base-game Pokémon (no forms with hyphens except standard ones)
                const hasExoticForm = /-(?:mega|gmax|alola|galar|hisui|paldea|totem|partner|starter|original|zen|therian|resolute|black|white|pirouette|ash|eternal|-o|-f|-m|-s|-10|50|complete|dusk|dawn|midday|midnight|school|disguised|busted)-?/.test(n);
                return !hasExoticForm;
            });
        shuffle(candidates);
        const picked = candidates.slice(0, 20); // fetch up to 20, show best 5

        const enriched = (await Promise.allSettled(picked.map(n => fetchPokemon(n))))
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(d => {
                if (legendaryCount >= 1 && LEGENDARY_IDS.has(d.id)) return false;
                if (d.id > 1025) return false;
                return true;
            })
            .slice(0, 5);

        if (enriched.length === 0) {
            $('#suggestions-grid').html('<p class="no-suggestions">No suggestions found. Try a different team!</p>');
            return;
        }

        // Score each candidate by how many of topWeak it covers
        enriched.sort((a, b) => {
            const scoreA = coverageScore(a, topWeak);
            const scoreB = coverageScore(b, topWeak);
            return scoreB - scoreA;
        });

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

    $(document).on('click', '.btn-rival-suggest-add', async function () {
        const name = $(this).data('name');
        const $btn = $(this);
        $btn.prop('disabled', true).html('Adding...');
        await addPokemon(name);
        // Refresh analysis to remove added Pokémon from suggestions
        runRivalAnalysis();
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

    // ── Team Evaluator ─────────────────────────────────────────
    function runTeamEvaluator() {
        const $panel = $('#evaluator-panel');
        $panel.show();
        $('html, body').animate({ scrollTop: $panel.offset().top - 20 }, 600);

        // Defense Matrix
        const matrix = {};
        ALL_TYPES.forEach(at => {
            matrix[at] = { weak: 0, superWeak: 0, resist: 0, immune: 0 };
            team.forEach(p => {
                const m = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (m === 0) matrix[at].immune++;
                else if (m < 1) matrix[at].resist++;
                else if (m > 2.25) matrix[at].superWeak++; // 4x
                else if (m > 1) matrix[at].weak++;
            });
        });

        // Build table
        let tableHtml = `<table class="defense-matrix">
      <thead><tr><th>Attacking Type</th><th>🔴 Weak</th><th>🟢 Resist</th><th>⚪ Immune</th><th>Status</th></tr></thead>
      <tbody>`;

        const criticals = [];
        ALL_TYPES.forEach(at => {
            const { weak, superWeak, resist, immune } = matrix[at];
            const isCritical = (weak + superWeak) >= 3 || superWeak >= 1;
            if (isCritical) criticals.push(at);

            let statusClass = 'status-ok';
            let statusLabel = '▸ Manageable';

            if (superWeak >= 1) {
                statusClass = 'status-extreme';
                statusLabel = '🛑 EXTREME (4x)';
            } else if (isCritical) {
                statusClass = 'status-critical';
                statusLabel = '⚠️ Critical';
            } else if (weak === 0) {
                statusClass = 'status-safe';
                statusLabel = '✅ Safe';
            }

            tableHtml += `<tr class="${statusClass === 'status-extreme' ? 'row-extreme' : isCritical ? 'row-critical' : ''}">
        <td>${typeBadge(at)}</td>
        <td class="center">
            ${weak} ${superWeak > 0 ? `<span class="super-weak-count" title="4x Weakness">(${superWeak}!!)</span>` : ''}
        </td>
        <td class="center">${resist}</td>
        <td class="center">${immune}</td>
        <td class="${statusClass}">${statusLabel}</td>
      </tr>`;
        });
        tableHtml += '</tbody></table>';
        $('#defense-matrix-container').html(tableHtml);

        // Critical warnings + replacement suggestions
        if (criticals.length > 0) {
            let warnHtml = '<div class="critical-warnings">';
            warnHtml += '<h5>⚠️ Critical Weaknesses Detected</h5>';
            criticals.forEach(ct => {
                const counterTypes = getResistingTypes(ct).slice(0, 3);
                const mostVuln = [...team].sort((a, b) => {
                    const ma = getCombinedEffectiveness(ct, a.types[0], a.types[1]);
                    const mb = getCombinedEffectiveness(ct, b.types[0], b.types[1]);
                    return mb - ma;
                })[0];

                const vulnerableMembers = team.filter(p => {
                    const eff = getCombinedEffectiveness(ct, p.types[0], p.types[1]);
                    return eff > 1;
                });
                const vulnerableHtm = vulnerableMembers.map(p => `
                    <div class="mini-poke-vulnerable" title="${p.displayName} is weak to ${ct}">
                        <img src="${spriteUrl(p.id)}" alt="${p.displayName}" class="mini-sprite">
                        <span>${p.displayName}</span>
                    </div>
                `).join('');

                const superVuln = team.filter(p => {
                    const eff = getCombinedEffectiveness(ct, p.types[0], p.types[1]);
                    return eff > 2.25;
                });

                const superVulnHtm = superVuln.length > 0 ? `
                    <div class="extreme-alert mb-2">
                        🛑 <strong>EXTREME VULNERABILITY (4x):</strong> ${superVuln.map(p => p.displayName).join(', ')}
                    </div>
                ` : '';

                warnHtml += `<div class="warning-block">
          <div class="weakness-summary mb-2">
            ${superVuln.length > 0 ? '<span class="badge bg-danger me-2">EXTREME</span>' : ''}
            Your team has <strong>${matrix[ct].weak + matrix[ct].superWeak} members</strong> weak to ${typeBadge(ct)}:
          </div>
          ${superVulnHtm}
          <div class="vulnerable-members-row mb-3">
            ${vulnerableHtm}
          </div>
          <div class="counter-suggestions-row">
            <span class="suggestion-intro">Consider adding:</span>
            ${counterTypes.map(t => {
                    const currentTeamNames = team.map(p => p.name.toLowerCase());
                    const examplesHtm = (TYPE_EXAMPLES[t] || [])
                        .filter(ex => !currentTeamNames.includes(ex.name.toLowerCase()))
                        .slice(0, 3)
                        .map(ex => `
                <div class="mini-poke-suggestion">
                  <img src="${spriteUrl(ex.id)}" alt="${ex.name}" class="mini-sprite">
                  <span>${ex.name}</span>
                </div>
              `).join('');
                    return `
                <div class="counter-item-v2">
                  <div class="counter-type-header">${typeBadge(t)}</div>
                  <div class="mini-examples-grid">${examplesHtm}</div>
                </div>`;
                }).join('')}
          </div>
          <p class="mt-2"><small>Replacing <strong>${mostVuln.displayName}</strong> would help the most.</small></p>
        </div>`;



            });
            warnHtml += '</div>';
            $('#critical-warnings').html(warnHtml);
        } else {
            $('#critical-warnings').html('<div class="team-safe"><p>✅ No critical weaknesses! Your team has great coverage.</p></div>');
        }

        // Strength summary
        const strongAgainst = ALL_TYPES.filter(at => {
            let superHitters = 0;
            team.forEach(p => {
                p.types.forEach(pt => {
                    if (getEffectiveness(pt, at) > 1) superHitters++;
                });
            });
            return superHitters >= 2;
        });

        if (strongAgainst.length) {
            const labels = strongAgainst.map(typeBadge).join(' ');
            $('#strength-summary').html(`<p><strong>💪 Your team hits hard against:</strong> ${labels}</p>`);
        } else {
            $('#strength-summary').html('');
        }
    }

    function clearEvaluator() {
        $('#evaluator-panel').hide();
    }

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
                    <img src="${p.sprite}" alt="${p.displayName}" class="rival-mini-sprite">
                    <div class="rival-mini-name">${p.displayName}</div>
                    <div class="type-badges">${p.types.map(typeBadge).join('')}</div>
                </div>
            `);
        });
    }

    // Add suggested rival counter to main team
    $(document).on('click', '.btn-rival-suggest-add', async function () {
        const name = $(this).data('name');
        if (team.length >= 6) {
            showToast('Team is full! Remove someone first.', 'warning');
            return;
        }
        await addPokemon(name);
        showToast(`Added ${capitalise(name)} to your Team Builder!`, 'success');
        // Visually remove it from the suggestions
        $(this).closest('.rival-counter-card').fadeOut(400, function () {
            $(this).remove();
            if ($('#rival-counters-grid').children(':visible').length === 0) {
                runRivalAnalysis(true); // silent refresh
            }
        });
    });

    $(document).on('click', '.rival-remove-btn', function () {
        const idx = $(this).data('idx');
        rivalTeam.splice(idx, 1);
        renderRivalTeam();
        runRivalAnalysis();
    });

    // Track if we are already analyzing to avoid loops
    let isAnalyzingRival = false;
    async function runRivalAnalysis(keepCurrent = false) {
        const $section = $('#rival-counters-section');
        const $grid = $('#rival-counters-grid');
        const $label = $('#rival-counters-label');

        if (rivalTeam.length === 0) {
            $section.hide();
            return;
        }
        if (isAnalyzingRival) return;
        isAnalyzingRival = true;

        $section.show();

        // Show calculating state only if not keeping current
        if (!keepCurrent) {
            $grid.html('<div class="p-4 text-center text-muted">Sizing up the competition...</div>');
        }

        const format = $('input[name="rivalBattleFormat"]:checked').val() || 'singles';

        // 1. Analyze weaknesses across the entire rival team
        const rivalWeaknesses = {};
        rivalTeam.forEach(p => {
            ALL_TYPES.forEach(at => {
                const eff = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (eff > 1) {
                    rivalWeaknesses[at] = (rivalWeaknesses[at] || 0) + 1;
                }
            });
        });

        const exploitTypes = Object.entries(rivalWeaknesses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([t]) => t);

        if (exploitTypes.length === 0) {
            $grid.html('<p class="no-suggestions text-center">Your rival seems well balanced! No common type weaknesses found.</p>');
            $label.html('');
            return;
        }

        // 2. Fetch potential counters of those exploiting types
        let candidates = [];
        for (const t of exploitTypes) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
                const data = await res.json();
                candidates.push(...data.pokemon.map(p => p.pokemon.name));
            } catch (e) { }
        }

        candidates = [...new Set(candidates)].filter(n => !/-(?:mega|gmax|alola|galar|hisui|paldea|totem)/.test(n));
        shuffle(candidates);

        // Fetch up to 12, pick 6 that best fit the format/team
        const picked = candidates.slice(0, 12);
        const results = (await Promise.allSettled(picked.map(n => fetchPokemon(n))))
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(d => d.id <= 1025);

        $grid.empty();
        results.slice(0, 6).forEach(d => {
            const types = parseTypes(d.types);
            const stats = parseStats(d.stats);

            let formatReason = "";
            if (format === 'singles') {
                if (stats.speed > 100) formatReason = "Outspeeds threats";
                else if (stats.attack > 115 || stats.sp_atk > 115) formatReason = "High damage potential";
            } else {
                if (types.includes('steel') || types.includes('fairy')) formatReason = "Defensive utility";
                else if (stats.hp > 100 || stats.defense > 100) formatReason = "Solid survival bulk";
            }

            // Find which rival pokemon this counts
            const target = rivalTeam.find(p => {
                return types.some(t => getCombinedEffectiveness(t, p.types[0], p.types[1]) > 1);
            });
            const targetName = target ? target.displayName : "Opponent";
            const rationale = formatReason ? `<strong>${formatReason}</strong><br>Counters ${targetName}` : `Counters ${targetName}`;

            const name = d.name;
            const sprite = spriteUrl(d.id);
            const badges = types.map(typeBadge).join('');

            $grid.append(`
            <div class="rival-counter-card animate-in show">
              <div class="counter-badge">COUNTER</div>
              <img src="${sprite}" alt="${capitalise(name)}">
              <div class="counter-name">${capitalise(name)}</div>
              <div class="counter-types mb-2 text-center">${badges}</div>
              <div class="counter-rationale">${rationale}</div>
              <button class="btn btn-sm btn-outline-success btn-rival-suggest-add mt-2 w-100" data-name="${name}">
                ➕ Add to Team
              </button>
            </div>
          `);
        });

        isAnalyzingRival = false;
        const exploitLabels = exploitTypes.map(typeBadge).join(' ');
        $label.html(`Exploiting opponent weaknesses: ${exploitLabels}`);
    }

    // ── Moves & Items Tab ───────────────────────────────────────
    function updateMovesTab() {
        const $container = $('#moves-container');
        $container.empty();

        if (team.length === 0) {
            $container.html('<p class="empty-team-msg">Add Pokémon to your team first, then come here for move & item suggestions!</p>');
            return;
        }

        team.forEach(p => {
            const itemSugg = getSuggestedItem(p.stats, p.types);
            const itemText = itemSugg ? `<img class="item-icon" src="${itemIconUrl(itemSugg.slug)}" alt="${itemSugg.name}" onerror="this.style.display='none'"> ${itemSugg.name}` : 'Focus Sash';
            const itemRationale = itemSugg ? itemSugg.rationale : '';
            const moveSugg = buildMoveSuggestions(p);

            const typeBadgesHtml = p.types.map(typeBadge).join('');
            $container.append(`
        <div class="poke-analysis-card mb-4 animate-in">
          <div class="analysis-header">
            <img src="${p.sprite}" alt="${p.displayName}">
            <div>
              <h5>${p.displayName}</h5>
              <div class="mini-types">${typeBadgesHtml}</div>
            </div>
          </div>
          <div class="moves-body">
            <div class="move-list">
              <h6>⚔️ Suggested Moves</h6>
              ${moveSugg.map(mv => {
                const catIcon = mv.category === 'physical' ? '⚡' : mv.category === 'special' ? '🌀' : '🛡️';
                return `<div class="move-row">
                    <div class="move-row-top">
                        <span class="move-tag" style="background:${mv.tagColor || '#888'}">${mv.tag}</span>
                        ${typeBadge(mv.type, true)}
                        <span class="move-name-v2">${mv.name}</span>
                    </div>
                    <div class="move-row-meta">${catIcon} ${mv.power ? mv.power + ' PWR' : 'Status'}</div>
                </div>`;
            }).join('')}
            </div>
            <div class="item-suggestion">
              <h6>🎒 Suggested Item</h6>
              <div class="item-display">
                <div class="item-name">${itemText}</div>
                <div class="item-rationale">${itemRationale}</div>
              </div>
            </div>
          </div>
        </div>
      `);
        });
    }

    // ── Moves Helper ───────────────────────────────────────────
    function buildMoveSuggestions(p) {
        const suggestions = [];

        // 1× high power STAB (Physical or Special based on better stat)
        const betterOffAtk = p.stats.attack >= p.stats.sp_atk ? 'physical' : 'special';
        const stabMoves = p.types.map(t => SAMPLE_MOVES_BY_TYPE[t]).filter(Boolean);
        stabMoves.forEach(m => {
            suggestions.push({ ...m, tag: 'STAB', tagColor: '#60a5fa' });
        });

        // 1× Coverage move (fixed type choice for now)
        const coverageType = p.types.includes('fire') ? 'water' : 'fire';
        const covMove = SAMPLE_MOVES_BY_TYPE[coverageType];
        if (covMove) suggestions.push({ ...covMove, tag: 'Coverage', tagColor: '#4ade80' });

        // 1× utility move
        suggestions.push(UTILITY_MOVE);

        return suggestions.slice(0, 4);
    }


    // ── Type Chart Tab ──────────────────────────────────────────
    function renderTypeTable() {
        let html = '<table class="type-chart-full"><thead><tr><th>Def \\ Atk</th>';
        ALL_TYPES.forEach(t => {
            html += `<th>${typeBadge(t, true)}</th>`;
        });
        html += '</tr></thead><tbody>';

        ALL_TYPES.forEach(def => {
            html += `<tr><th>${typeBadge(def, true)}</th>`;
            ALL_TYPES.forEach(atk => {
                const m = getEffectiveness(atk, def);
                let label = m;
                let cls = '';
                if (m === 2) cls = 'tc-super';
                if (m === 0.5) { label = '0.5'; cls = 'tc-resist'; }
                if (m === 0) { label = '0'; cls = 'tc-immune'; }
                if (m === 1) { label = ''; } // hide 1x for clarity
                html += `<td class="${cls}">${label}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        $('#type-table-container').html(html);
    }

    function runDualCalc() {
        const type1 = $('#dual-type1').val();
        const type2 = $('#dual-type2').val();
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

    function aggregateWeaknesses() {
        const total = {};
        team.forEach(p => {
            ALL_TYPES.forEach(at => {
                const m = getCombinedEffectiveness(at, p.types[0], p.types[1]);
                if (m > 1) total[at] = (total[at] || 0) + 1;
            });
        });
        return total;
    }

    function miniStats(stats) {
        if (!stats) return '';
        return Object.entries(stats).map(([k, v]) => {
            const percent = Math.min(100, (v / 200) * 100);
            return `
            <div class="mini-stat" title="${k.toUpperCase()}: ${v}">
                <div class="mini-stat-bar" style="height:${percent}%"></div>
            </div>
        `;
        }).join('');
    }

    function clearEvaluator() {
        $('#defense-matrix-container, #critical-warnings, #strength-summary').empty();
    }

    // The existing updateMovesTab function is more complex and should be kept.
    // This placeholder version is likely from an older or different context.
    // Keeping the original updateMovesTab and adding the other missing helpers.

});
