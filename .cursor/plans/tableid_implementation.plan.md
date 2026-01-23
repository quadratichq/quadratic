---
name: TableId Implementation
overview: "Add a stable `table_id: TableId` to all tables, refactor `TableRef` to use it, and create `MultiPos` enum for representing positions as either absolute sheet coordinates or relative table coordinates."
todos:
  - id: fix-tableref-errors
    content: Fix remaining 53 compilation errors for TableRef table_id change
    status: completed
  - id: update-cellrefrange
    content: Update CellRefRange parsing/display to resolve names to IDs and vice versa
    status: completed
  - id: create-tablepos
    content: Create TablePos struct with table_id and col/row offsets
    status: pending
  - id: create-multipos
    content: Create MultiPos enum with Sheet and Table variants
    status: pending
  - id: add-tests
    content: Add tests for all new functionality
    status: pending
isProject: false
---

review to start w/table_map.rs

# TableId Implementation Plan

## Completed Work

### 1. Created `TableId` type ([`quadratic-core/src/grid/ids.rs`](quadratic-core/src/grid/ids.rs))

- Newtype wrapper around `Uuid` (same pattern as `SheetId`)
- Implements `new()`, `Default`, `FromStr`, `Display`, `Hash`, `PartialEq`, `Eq`, `Copy`, `Clone`, `Debug`, `Serialize`, `Deserialize`, `TS`
- Has `TEST` constant for testing

### 2. Added `id: TableId` to `DataTable` ([`quadratic-core/src/grid/data_table/mod.rs`](quadratic-core/src/grid/data_table/mod.rs))

- New field initialized in `DataTable::new()`
- Added `with_id()` builder method for tests
- Updated serialization/deserialization

### 3. Updated `TableMapEntry` ([`quadratic-core/src/a1/a1_context/table_map_entry.rs`](quadratic-core/src/a1/a1_context/table_map_entry.rs))

- Added `table_id: TableId` field
- Updated `from_table()` to capture table's ID

### 4. Restructured `TableMap` ([`quadratic-core/src/a1/a1_context/table_map.rs`](quadratic-core/src/a1/a1_context/table_map.rs))

- Primary storage: `tables_by_id: HashMap<TableId, TableMapEntry>`
- Index maps: `name_to_id: IndexMap<String, TableId>`, `sheet_pos_to_id: HashMap<SheetPos, TableId>`
- New methods: `try_table_by_id()`, `try_table_id()`

### 5. Changed `TableRef` to use `table_id` (COMPLETED)

- Changed struct field from `table_name: String` to `table_id: TableId`
- Updated `new()` to take `TableId`
- Added `from_name()` constructor
- Added `table_name()` method that takes `A1Context`
- Changed `to_string()` to `to_string_with_context(&A1Context)`
- Added `to_string_with_name()` for table name replacement during formula updates
- Removed `replace_table_name()` method

### 6. Fixed all compilation errors (COMPLETED)

All 53+ compilation errors have been fixed. Key changes made:

- Updated all `table_ref.table_name` field accesses to use `table_ref.table_name(a1_context)` method
- Updated all `TableRef` struct constructions to use `table_id` (resolved from context)
- Updated `CellRefRange` to use `to_a1_string_with_context()` and `to_rc_string_with_context()`
- Added `to_a1_string_replacing_table_name()` for updating formula strings during table renames
- Updated formulas parser to look up `table_id` from context during parsing
- Updated serialization layer with `TableNameResolver` (for import) and `TableIdResolver` (for export)
- Updated wasm bindings to pass context where needed

## Current State: Compiles Successfully

Run `cargo check` in `quadratic-core` - should compile with no errors.

## Remaining Todos

### 1. Create `TablePos` struct

```rust
pub struct TablePos {
    pub table_id: TableId,
    pub col: i64,  // offset from first data column
    pub row: i64,  // offset from first data row
}
```

### 4. Create `MultiPos` enum

```rust
pub enum MultiPos {
    Sheet(SheetPos),
    Table(TablePos),
}
```

## Key Design Decisions

- `TableId` uses newtype pattern for type safety (matches `SheetId`)
- `(0,0)` in `TablePos` = top-left of data (not header row)
- Internal references (AST, formulas) use `table_id`
- Python/JS code cells use `table_name` (resolved at runtime)
- File format stores `table_name` for backward compatibility, resolves to ID on load