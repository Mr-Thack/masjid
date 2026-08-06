# Admin UX Improvements: Prayer Rules

## Summary

The rules engine is powerful but the admin UI needs to make the chaining model visible and give instant feedback. These are UX-only changes — no new engine features needed for most of them (only `enabled` column from the rules spec).

---

## 1. Inline Computed Times in the Rules Table

**Problem**: Currently the admin sees rules but has no idea what times they produce until they use the dry-run simulator (a separate panel at the bottom). This is a disconnect.

**Solution**: Each rule row shows what time the chain produces at that point, using today's date. This gives instant feedback and makes the sequential chaining model obvious.

```
┌─────────────────────────────────────────────────────────────┐
│ DHUHR (3 rules)                              [+ Add Rule]   │
├──────┬──────────────────────┬─────────────┬─────────────────┤
│  #   │ Name                 │ Conditions  │ Action          │
├──────┼──────────────────────┼─────────────┼─────────────────┤
│  1   │ Friday override      │ Fridays     │ Set 13:30       │
│      │                      │             │ → skipped today │
│  2   │ Default offset       │ Always      │ +10 min         │
│      │                      │             │ 12:15 → 12:25   │
│  3   │ Round up             │ Always      │ Round up 5      │
│      │                      │             │ 12:25 → 12:25   │
├──────┴──────────────────────┴─────────────┴─────────────────┤
│ Adhaan: 12:15  →  Iqaamah: 12:25                            │
└─────────────────────────────────────────────────────────────┘
```

**How it works**: Each rule row calls a lightweight compute endpoint (`GET /api/v1/admin/masjids/{id}/prayer/rules/preview?date=today`) or computes client-side by replaying the rules for today's date. The preview shows:
- Whether the rule matched today (green check / grey dash)
- The intermediate time after applying this rule
- Final adhaan → iqaamah at the bottom of each prayer section

**Implementation**: Since the admin page already has the full rule list loaded, it can compute times client-side using the same logic. The `applyAction` and `allConditionsMatch` functions should be extracted from the API into `@masjid/ui-utils` so both the API engine and the admin frontend can use them. (Currently they live in `apps/api/src/lib/server/prayer/engine.ts` — move the pure functions to a shared package.)

**Edge case**: Client needs the Hijri date for `hijri_month` / `hijri_day_range` conditions. Solution: the admin API already returns prayer config; add a `GET /api/v1/admin/masjids/{id}/prayer/hijri-today` endpoint that returns today's Hijri date, or include it in the prayer config response. The admin page calls this once on load.

---

## 2. Prayer Pipeline Visualization

**Problem**: New admins don't understand the chaining model. They think rules are independent options, not a sequential pipeline.

**Solution**: A visual pipeline for each prayer, collapsed by default, expandable with a "Show pipeline" link.

```
Adhaan (12:15)
  │
  ├─[1] Friday override ─── skipped (not Friday) ──┐
  │                                                  │
  ├─[2] Default offset ─── +10 min ──→ 12:25 ──────┤
  │                                                  │
  └─[3] Round up ─── round 5 ──→ 12:25 ────────────┘
                                                        │
                                                    Iqaamah: 12:25
```

**Visual design**:
- Vertical pipeline with rule cards connected by lines
- Rules that matched: green left border, show the transformation
- Rules that didn't match: grey, muted, crossed out
- The final iqaamah is highlighted at the bottom
- Adhaan on the left, arrows pointing right to iqaamah

**Implementation**: Pure client-side rendering. Uses the shared `applyAction` / `allConditionsMatch` functions. Each rule card shows: order number, name, condition summary (with check/cross for today), action description, input time → output time.

---

## 3. Rule Enable/Disable Toggle

**Problem**: Currently the only way to stop a rule from firing is to delete it. Admins want to experiment ("What if I disable the Friday override during Ramadan?") without losing rules.

**Solution**: A toggle switch per rule in the rules table. Requires the `enabled` column from `docs/new-rules-spec.md`.

```
┌──────┬──────────────────────┬─────────────┬─────────────────┬────────┐
│  #   │ Name                 │ Conditions  │ Action          │ Active │
├──────┼──────────────────────┼─────────────┼─────────────────┼────────┤
│  1   │ Friday override      │ Fridays     │ Set 13:30       │  [ON]  │
│  2   │ Default offset       │ Always      │ +10 min         │  [ON]  │
│  3   │ Old summer rule      │ Jun–Aug     │ +20 min         │ [OFF]  │
└──────┴──────────────────────┴─────────────┴─────────────────┴────────┘
```

**Behavior**:
- Toggle calls `updatePrayerRule(id, { enabled: false })` — instant save
- Disabled rules are visually dimmed (reduced opacity, grey text)
- Disabled rules are skipped in the inline computed times
- The dry-run simulator also respects the enabled state (reads from DB)
- Toast notification: "Rule disabled" / "Rule enabled" with undo for 5 seconds

**Edge cases**:
- Disabling a rule that other rules depend on (e.g., a `set_fixed_time` that subsequent `round_up` operates on) — the chain just skips that step. No warning needed; the inline computed times make the effect visible immediately.

---

## 4. Duplicate Rule Button

**Problem**: Common pattern — create a rule, then want a variant with a different condition. Currently it's entirely manual.

**Solution**: A duplicate icon/button per rule row that opens the "Add Rule" form pre-filled with the cloned rule's data, but with an empty rule name (or "Copy of Foo") and the next execution order.

```
[ Edit ] [ Duplicate ] [ Delete ]
```

**Behavior**:
- Clones all fields: `prayer_name`, `conditions_json`, `action_json`
- Sets `rule_name` to `"Copy of {original name}"` (or empty to force naming)
- Sets `execution_order` to `max + 1` for that prayer
- Opens the regular "Add Rule" form, pre-filled
- Does NOT save yet — admin edits first, then clicks "Add Rule"

---

## Remaining Items (Not Implemented Now)

These were considered but deferred:

| Item | Reason |
|---|---|
| **Drag-to-reorder** | ▲▼ buttons work for typical rule counts (2-5 per prayer). Low ROI for now. |
| **Bulk apply** | "Add 10 min to all prayers" is a 5-rule operation. Admin can do it manually. Low ROI. |
| **Rule conflict detection** | Admins see conflicts in the inline computed times. A warning badge could be added later. |
| **Export/Import** | JSON export/import of rule sets between masjids. Nice but niche. |

---

## Implementation Order

| Step | What | Dependency |
|---|---|---|
| 1 | Extract `applyAction` + `allConditionsMatch` to `@masjid/ui-utils` | None |
| 2 | Add `GET /prayer/hijri-today` or include hijri in prayer config response | None |
| 3 | Inline computed times in rules table | Step 1 + 2 |
| 4 | Pipeline visualization (collapsible) | Step 1 |
| 5 | `enabled` column + toggle UI | `enabled` from new-rules-spec |
| 6 | Duplicate rule button | None |