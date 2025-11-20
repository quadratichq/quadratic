How shift+arrow keyboard movement should work:

## Shift+Arrow Selection (without merged cells)

Shift+arrow extends or contracts the selection from an anchor point (the cursor position where selection started).

**Basic behavior:**
- The cursor position acts as the **anchor** - it stays fixed during selection
- Pressing shift+arrow moves the **selection end** (opposite corner from anchor)
- The selection rectangle expands or contracts based on the direction moved
- Moving away from anchor: selection grows
- Moving toward anchor: selection shrinks
- Moving past anchor: selection flips to the opposite side

**Example:** Starting at D5 (cursor/anchor):
- Shift+Right: D5 → D5:E5 → D5:F5 → D5:G5 (growing right)
- Shift+Down: D5:G5 → D5:G6 → D5:G7 → D5:G8 (growing down)
- Shift+Left: D5:G8 → D5:F8 → D5:E8 → D5:D8 → D5:C8 (shrinking right, then growing left)
- Shift+Up: D5:C8 → D5:C7 → D5:C6 → D5:C5 (shrinking down)

**Implementation:**
- Track `end_pos` as the current selection end position
- Apply delta to `end_pos` to get target position
- Update `range.end` to the target position
- Anchor (cursor) remains unchanged, ensuring it stays within the selection bounds

## Shift+Arrow Selection with Merged Cells

When merged cells are involved, the selection must always include complete merged cells, never partial ones.

**Key rules:**
1. **Auto-expansion**: If the target position lands inside a merged cell, the selection automatically expands to include the entire merged cell rectangle
2. **End position stays at target**: `end_pos` remains at the target position (which may be inside the merged cell)
3. **Next movement exits merged cell**: When `end_pos` is inside a merged cell, the next arrow press moves it to the edge of the merged cell in the direction of the arrow (and continues beyond if it's a single-cell movement)

**Example:** Starting at B7, merged cell at C5:E10:
- Shift+Right: target C7 (inside merged cell C5:E10)
  - Selection expands to B5:E10 (includes entire merged cell)
  - `end_pos` = C7 (stays at target, inside merged cell)
- Shift+Right again: Since `end_pos` (C7) is inside merged cell, move to right edge → `end_pos` = F7 (exits merged cell)
  - Selection = B5:F10
- Shift+Down: `end_pos` = F11, selection = B5:F11

**Another example:** Starting at D12, merged cell at C5:E10:
- Shift+Up: `end_pos` = D11, selection = D12:D11
- Shift+Up: target D10 (inside merged cell C5:E10)
  - Selection expands to C5:D12 (includes entire merged cell)
  - `end_pos` = D10 (inside merged cell)
- Shift+Up again: Since `end_pos` (D10) is inside merged cell, move to top edge → `end_pos` = D4 (exits merged cell)
  - Selection = C5:D12

**Edge exit logic:**
- When `end_pos` is inside a merged cell, the next arrow press moves it outside the merged cell in the direction of the arrow:
  - Moving right: `end_pos.x` moves to `merged_rect.max.x + 1` (one cell past right edge)
  - Moving left: `end_pos.x` moves to `merged_rect.min.x - 1` (one cell past left edge)
  - Moving down: `end_pos.y` moves to `merged_rect.max.y + 1` (one cell past bottom edge)
  - Moving up: `end_pos.y` moves to `merged_rect.min.y - 1` (one cell past top edge)

**Partial merged cell handling:**
- If a merged cell is partially inside the selection, the selection must expand to fully include the merged cell
- This ensures the selection never contains a partial merged cell

## Shrinking Selection with Merged Cells

When shrinking the selection (moving `end_pos` toward the anchor), merged cells behave differently.

**Shrinking behavior:**
- When `end_pos` is at the edge of a merged cell and the user arrows INTO that merged cell (toward the anchor, shrinking the selection), the merged cell should be removed from the selection
- `end_pos` moves outside the merged cell in the direction of the arrow, skipping over the merged cell entirely

**Example:** Selection is B5:F10, merged cell at C5:E10, anchor at B5:
- `end_pos` is at F7 (right edge of selection, outside merged cell)
- Shift+Left: `end_pos` moves to E7 (still outside merged cell)
  - Selection = B5:E10 (merged cell is still included)
- Shift+Left: `end_pos` moves to D7 (inside merged cell C5:E10)
  - Since we're moving INTO the merged cell (toward anchor), remove it from selection
  - `end_pos` moves to C4 (outside merged cell, one cell past left edge)
  - Selection = B5:C10 (merged cell removed)

**Another example:** Selection is C5:D12, merged cell at C5:E10, anchor at D12:
- `end_pos` is at C5 (top-left of selection, at top-left edge of merged cell)
- Shift+Down: `end_pos` moves to C6 (inside merged cell)
  - Since we're moving INTO the merged cell (toward anchor), remove it from selection
  - `end_pos` moves to C11 (outside merged cell, one cell past bottom edge)
  - Selection = C11:D12 (merged cell removed)

**Shrinking logic:**
- When `end_pos` is at the edge of a merged cell and arrow would move it INTO the merged cell:
  - Determine if movement is toward anchor (shrinking)
  - If shrinking: `end_pos` moves to the opposite edge of the merged cell (outside, in direction of arrow)
    - Moving right into merged cell: `end_pos.x` = `merged_rect.max.x + 1`
    - Moving left into merged cell: `end_pos.x` = `merged_rect.min.x - 1`
    - Moving down into merged cell: `end_pos.y` = `merged_rect.max.y + 1`
    - Moving up into merged cell: `end_pos.y` = `merged_rect.min.y - 1`
  - Selection updates to exclude the merged cell

## Edge Cases with Merged Cells

### Chained Merged Cell Exits

**Scenario:** `end_pos` is inside a merged cell, and the next arrow press would move it into another merged cell.

**Behavior:** Exit the current merged cell. If the exit position lands inside another merged cell, stop there (inside the second merged cell). Do not exit the second merged cell in the same arrow press.

**Example:** `end_pos` at C7 (inside merged cell C5:E10), merged cell at F5:H10:
- Shift+Right: `end_pos` exits first merged cell → F7 (inside merged cell F5:H10, stops here)
  - Selection expands to B5:H10 (includes both merged cells)
  - `end_pos` = F7 (inside second merged cell)
- Shift+Right again: `end_pos` exits second merged cell → I7 (outside all merged cells)
  - Selection = B5:I10

**Implementation:** When exiting a merged cell, calculate the exit position. If that position is inside another merged cell, stop there (don't exit the second merged cell). The next arrow press will handle exiting the second merged cell.

### Cascading Expansion

**Scenario:** When expanding selection to include a merged cell, the expanded selection may intersect with other merged cells.

**Behavior:** The selection must continue to expand to include all intersecting merged cells, recursively.

**Example:** Starting at B7, merged cell at C5:E10, another merged cell at D8:F12:
- Shift+Right: target C7 (inside merged cell C5:E10)
  - Selection expands to B5:E10 (includes C5:E10)
  - Expanded selection now intersects D8:F12 (partially included)
  - Selection must expand further to B5:F12 (includes both merged cells)
  - `end_pos` = C7 (stays at target)

**Implementation:** After expanding for a merged cell, check if the expanded selection intersects any other merged cells. If so, expand again to include them. Repeat until no new intersections are found.

### Multiple Merged Cells in Path

**Scenario:** When moving, `end_pos` may pass through multiple merged cells sequentially.

**Behavior:** Exit one merged cell per arrow press. If exiting lands `end_pos` inside another merged cell, stop there. The next arrow press will exit that merged cell.

**Example:** `end_pos` at B7, merged cells at C5:E10, F5:H10, I5:K10:
- Shift+Right: target C7 (inside C5:E10)
  - Selection expands to B5:E10, `end_pos` = C7
- Shift+Right again: `end_pos` exits C5:E10 → F7 (inside F5:H10, stops here)
  - Selection expands to B5:H10, `end_pos` = F7
- Shift+Right again: `end_pos` exits F5:H10 → I7 (inside I5:K10, stops here)
  - Selection expands to B5:K10, `end_pos` = I7
- Shift+Right again: `end_pos` exits I5:K10 → L7 (outside all merged cells)
  - Selection = B5:L10, `end_pos` = L7

**Implementation:** When `end_pos` is inside a merged cell and arrow is pressed, exit the current merged cell. If the exit position is inside another merged cell, recursively exit that one as well. Continue until `end_pos` is outside all merged cells.