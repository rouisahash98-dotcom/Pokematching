# 🗺️ Future Improvements Roadmap

This document outlines planned enhancements for the Battle Blueprint application, evaluated by importance (Strategic Value) and technical difficulty.

## 🚦 Priority Overview

| Feature | Importance | Difficulty | Category |
| :--- | :--- | :--- | :--- |
| **Logic: Smart Suggestions (Net Weakness)** | 🔥 Critical | 🟡 Moderate | Core Logic |
| **UI: Multi-Level Stat Ranges (Lv 50/100)** | 🔥 High | 🟡 Moderate | Pokémon Data |
| **UX: "Clear All" Buttons** | 🔥 High | 🟢 Easy | Convenience |
| **Logic: Whole-Team Rival Counters** | 🔥 High | 🟡 Moderate | Rival Analysis |
| **Logic: Individual Coverage Reporting** | 🔥 High | 🟢 Easy | Evaluator |
| **UI: Reorder Analysis Panels** | 🟡 Moderate | 🟢 Easy | UX Design |
| **Data: Item/Move Variety** | 🟡 Moderate | 🟡 Moderate | Polish |
| **UX: Rival Suggestion Persistence** | 🟡 Moderate | 🟢 Easy | UX Design |
| **UI: Type Chart Lockdown** | ✅ Done | N/A | Constraint |

---

## 🔍 Detailed Evaluation

### 1. Multi-Level Stat Ranges
**Description**: Enhance the stat block to show Base Stats + calculated ranges at Level 50 and 100 (including IV/EV extremes).
- **Difficulty**: 🟡 Moderate. Requires implementing the standard Pokémon stat formulas.
- **Why**: Essential for competitive players to see actual potential values.

### 2. Individual Coverage Reporting
**Description**: Show type effectiveness even if only one Pokémon provides it (currently requires 2+).
- **Difficulty**: 🟢 Easy. Tiny tweak to the `runTeamEvaluator` threshold logic.
- **Why**: Users need to know they have coverage, even if it's "thin" (single source).

### 3. Smart Suggestions (Weakness-Aware)
**Description**: Filter or score suggestions based on whether the new Pokémon introduces more weaknesses than it solves.
- **Difficulty**: 🟡 Moderate. Requires running a "virtual" team evaluation for each top candidate.
- **Why**: Prevents the "whack-a-mole" problem where fixing a Fire weakness adds a new Rock weakness.

### 4. "Clear All" Buttons
**Description**: Add buttons to wipe the player team and rival team in one click.
- **Difficulty**: 🟢 Easy. Simple state reset functions.
- **Why**: Major UX improvement for starting new builds.

### 5. Reorder Analysis Panels
**Description**: Move "Weakness Overview" above the "Defense Matrix".
- **Difficulty**: 🟢 Easy. DOM reordering in `index.html` or `app.js`.
- **Why**: Weakness identification is the primary action; the matrix is the secondary detail.

### 6. Item/Move Variety
**Description**: Diversify suggested items (fewer Choice items) and moves per type. Add "Alternatives" list.
- **Difficulty**: 🟡 Moderate. Expand `data.js` mappings and logic to pick from a pool rather than a single default.
- **Why**: Makes suggestions feel more personalized and less like a template.

### 7. Rival Suggestion Persistence
**Description**: Keep counter suggestions stable when switching between Singles/Doubles format unless explicitly refreshed.
- **Difficulty**: 🟢 Easy. Adjust trigger logic in `runRivalAnalysis` to skip re-fetching if data exists.
- **Why**: Prevents losing a good suggestion just by checking a different format toggle.

### 8. Whole-Team Rival Counter Logic
**Description**: Stop over-focusing on common weaknesses. Ensure suggestions cover all unique threats on the rival team.
- **Difficulty**: 🟡 Moderate. Update the scoring algorithm to reward "unique coverage" of rival members.
- **Why**: Ensures the user isn't left vulnerable to a "sweeper" just because its type wasn't the most common in the rival's team.

---

## 🚫 Constraints
- **Type Chart**: The current design is finalized. No further automated or manual iterations needed.
