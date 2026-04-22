# Super-Memory-MCP Server Update Specification

**Document Version:** 1.0  
**Date:** 2026-04-22  
**Prepared For:** super-memory-mcp maintenance team  
**Context:** Boomerang agent system now requires mandatory super-memory usage; current implementation has path confusion, missing tool wrappers, and database recovery issues.

---

## Executive Summary

The Boomerang multi-agent orchestration system has been updated to make super-memory usage **mandatory** for all sub-agents. However, three critical issues prevent proper integration:

| Issue | Priority | Impact |
|-------|----------|--------|
| **Database Path Confusion** | Critical | LanceDB fails when running from Boomerang context due to incorrect path resolution |
| **Missing Tool Wrappers** | High | Boomerang AGENTS.md references `boomerang_memory_search_tiered` and `boomerang_memory_search_parallel` but these tools don't exist |
| **Database Corruption Handling** | High | Empty or corrupted `memories.lance` directories cause silent failures instead of recovery |

### Required Changes

1. **Add environment variable** `SUPER_MEMORY_DB_PATH` support for explicit path configuration
2. **Add tool wrapper functions** in `mcp_tools.py` for the missing search tools
3. **Enhance database initialization** to detect and recover from corrupted/empty lance directories

---

## Issue 1: Database Path Resolution

### Problem Description

When super-memory-mcp server runs from the Boomerang project context, it fails with:

```
lance error: Not found: home/jcharles/Projects/MCP-Servers/boomerang/memory_data/memories.lance/data/...
```

### Root Cause Analysis

The project structure is:

```
/home/jcharles/Projects/MCP-Servers/
├── Super-Memory/          # The super-memory-mcp server project
│   └── memory_data/        # Contains actual working LanceDB data
└── boomerang/              # The agent orchestration project
    └── memory_data/
        └── memories.lance/ # This directory exists but is empty/corrupted
```

**Two separate `memory_data/` directories exist:**

1. **Super-Memory project** (`/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data/`): Contains the actual working LanceDB database with memories
2. **Boomerang project** (`/home/jcharles/Projects/MCP-Servers/boomerang/memory_data/`): Contains an empty or corrupted `memories.lance` directory

**Default behavior of `config.py`:**

```python
raw_path = os.environ.get("SUPER_MEMORY_DB_PATH", "./memory_data")
db_path = os.path.abspath(raw_path)
```

When `SUPER_MEMORY_DB_PATH` is not set (which is the default), the server resolves `./memory_data` relative to the **current working directory**, not the project root. This causes the server to point to the Boomerang project's corrupted database instead of the Super-Memory project's working database.

### Current Code Path

1. `config.py` line 46: `os.environ.get("SUPER_MEMORY_DB_PATH", "./memory_data")`
2. `config.py` line 47: `db_path = os.path.abspath(raw_path)` - converts to absolute path
3. `memory.py` line 84-85: `os.makedirs(config.db_path, exist_ok=True)` then `_db = lancedb.connect(config.db_path)`
4. `memory.py` line 141-142: Checks `db.list_tables()` to find "memories" table

### Recommended Fix

**Add a path validation and warning system in `config.py`:**

```python
# In get_config(), after line 47 (db_path assignment)

# Validate that db_path points to a valid LanceDB directory
if os.path.exists(db_path):
    lance_dir = os.path.join(db_path, "memories.lance")
    if os.path.isdir(lance_dir):
        # Check if lance directory has actual data
        data_dir = os.path.join(lance_dir, "data")
        versions_dir = os.path.join(lance_dir, "_versions")
        if not (os.path.exists(data_dir) and os.path.exists(versions_dir)):
            logger.warning(
                "Database directory exists but appears empty or corrupted: %s. "
                "Consider setting SUPER_MEMORY_DB_PATH to a valid database location.",
                db_path
            )
```

**Alternatively, add a `SUPER_MEMORY_DB_PATH` environment variable check with clearer guidance:**

Add to `config.py`:

```python
# Add after line 46
# Warn if using default path and it appears empty
if not os.environ.get("SUPER_MEMORY_DB_PATH"):
    default_path = os.path.abspath("./memory_data")
    if os.path.exists(default_path):
        lance_path = os.path.join(default_path, "memories.lance")
        if not os.path.exists(os.path.join(lance_path, "data")):
            logger.warning(
                "Default database path '%s' appears empty. "
                "Set SUPER_MEMORY_DB_PATH to point to a valid LanceDB database. "
                "Expected path: /home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data",
                default_path
            )
```

---

## Issue 2: Missing Tool Wrappers

### Problem Description

The Boomerang `AGENTS.md` references two tool names that do not exist in `mcp_tools.py`:

| Documented Tool | Expected Behavior | Actual Status |
|-----------------|-------------------|---------------|
| `boomerang_memory_search_tiered` | Fast tiered search (MiniLM with BGE fallback) | **MISSING** |
| `boomerang_memory_search_parallel` | Archivist parallel search (RRF fusion) | **MISSING** |

The existing `query_memory` function (line 208-243 in `mcp_tools.py`) has a `strategy` parameter that can achieve this, but it requires callers to know to pass `strategy="tiered"` or `strategy="parallel"`. The Boomerang protocol expects distinct named tools for discoverability.

### Code Changes Required

**File:** `src/super_memory/mcp_tools.py`

Add the following two tool wrapper functions after the `query_memory` function (after line 243):

```python
@mcp.tool()
@_mcp_error_handler
def boomerang_memory_search_tiered(question: str, top_k: int = 5) -> str:
    """Fast tiered memory search - Quick MiniLM search with BGE fallback.

    Use this for routine queries where speed matters.
    This is the "Fast Reply" mode - prioritizes MiniLM speed but falls back
    to BGE-Large if confidence is low (below BGE_THRESHOLD config).

    Args:
        question: Query text to search for.
        top_k: Maximum number of results to return (default 5, max 20).
    """
    logger.info("Tiered memory search: %s", question)
    results = query_memories(question=question, top_k=top_k, strategy_override="TIERED")

    if not results:
        return "No relevant memories found in tiered search."

    context = "\n---\n".join([r.text for r in results])
    return f"[TIERED] Found these relevant memories:\n\n{context}"


@mcp.tool()
@_mcp_error_handler
def boomerang_memory_search_parallel(question: str, top_k: int = 5) -> str:
    """Archivist parallel memory search - Dual-tier search with RRF fusion.

    Use this for important queries where maximum recall matters.
    This is the "Archivist" mode - searches both MiniLM and BGE-Large tables
    simultaneously and merges results using Reciprocal Rank Fusion (RRF).

    Args:
        question: Query text to search for.
        top_k: Maximum number of results to return (default 5, max 20).
    """
    logger.info("Parallel memory search: %s", question)
    results = query_memories(question=question, top_k=top_k, strategy_override="PARALLEL")

    if not results:
        return "No relevant memories found in parallel search."

    context = "\n---\n".join([r.text for r in results])
    return f"[PARALLEL] Found these relevant memories:\n\n{context}"
```

### Import Requirements

The `query_memories` function is already imported at line 15 of `mcp_tools.py`:

```python
from .memory import (
    # ... other imports
    query_memories,
    # ...
)
```

**No additional imports are needed.**

### Registration Integration

These tools will be automatically registered when `register_tools(mcp)` is called, as they use the `@mcp.tool()` decorator within the `register_tools` function scope.

---

## Issue 3: Database Corruption Recovery

### Problem Description

When the `memories.lance` directory exists but is empty or corrupted, operations fail with unclear error messages:

```
lance error: Not found: home/jcharles/Projects/MCP-Servers/boomerang/memory_data/memories.lance/data/...
```

The current code in `memory.py` has some corruption handling in `_migrate_schema_if_needed()` (lines 267-289) but:

1. It only handles the case where a table is listed but can't be opened
2. It doesn't handle the case where `list_tables()` itself fails due to corrupted structure
3. Error messages don't clearly indicate the database needs re-initialization

### Current Code Analysis

**`_get_or_create_table()` (lines 130-162):**
- Checks if "memories" exists in `db.list_tables()`
- If exists, opens it; if not, creates it
- Handles "already exists" race condition
- Does NOT validate table can actually be queried after opening

**`_migrate_schema_if_needed()` (lines 235-313):**
- Has corruption handling at lines 267-289
- Detects "not found" or "lance" in error message
- Attempts to drop and recreate table
- But this only triggers when table is LISTED but can't be OPENED

**`get_table()` (lines 92-104):**
- Simple lazy initialization
- No corruption detection or recovery
- No clear error message if table is unusable

### Recommended Fix

**Add corruption detection and auto-recovery in `memory.py`:**

1. **Add a `_validate_table_accessible()` helper function:**

```python
def _validate_table_accessible(table, table_name: str) -> bool:
    """Check if a table can actually be accessed/queried.

    Args:
        table: LanceDB table instance to validate.
        table_name: Name of table for error messages.

    Returns:
        True if table is accessible, False otherwise.
    """
    try:
        # Try a simple operation to verify table is usable
        table.search().limit(0).to_pydantic(_get_memory_schema())
        return True
    except Exception as e:
        logger.error("Table '%s' is not accessible: %s", table_name, e)
        return False
```

2. **Modify `_get_or_create_table()` to validate after opening:**

```python
def _get_or_create_table():
    """Get existing table or create new one with proper error handling.

    Returns:
        LanceDB table instance.

    Raises:
        DatabaseError: If table operations fail or table is corrupted.
    """
    db = get_db()
    try:
        if "memories" in db.list_tables():
            table = db.open_table("memories")
            # Validate table is actually accessible
            if not _validate_table_accessible(table, "memories"):
                raise DatabaseError(
                    "Table 'memories' exists but is corrupted. "
                    "Database needs re-initialization."
                )
            return table
    except Exception as e:
        logger.error("Failed to list tables: %s", e)
        raise DatabaseError(f"Failed to list tables: {e}") from e

    try:
        return db.create_table("memories", schema=_get_memory_schema())
    except Exception as e:
        # Handle race condition where table was created between check and create
        if "already exists" in str(e).lower():
            try:
                table = db.open_table("memories")
                if not _validate_table_accessible(table, "memories"):
                    raise DatabaseError(
                        "Table 'memories' exists but is corrupted. "
                        "Database needs re-initialization."
                    )
                return table
            except Exception as open_err:
                logger.error(
                    "Table creation reported success but open failed: %s", open_err
                )
                raise DatabaseError(
                    f"Table creation reported success but open failed: {open_err}"
                ) from open_err
        logger.error("Failed to create table: %s", e)
        raise DatabaseError(f"Failed to create table: {e}") from e
```

3. **Apply same pattern to `_get_or_create_table_long()`:**

```python
def _get_or_create_table_long():
    """Get existing memories_long table or create new one with proper error handling.

    Returns:
        LanceDB table instance.

    Raises:
        DatabaseError: If table operations fail or table is corrupted.
    """
    db = get_db()
    try:
        if "memories_long" in db.list_tables():
            table = db.open_table("memories_long")
            if not _validate_table_accessible(table, "memories_long"):
                raise DatabaseError(
                    "Table 'memories_long' exists but is corrupted. "
                    "Database needs re-initialization."
                )
            return table
    except Exception as e:
        logger.error("Failed to list tables: %s", e)
        raise DatabaseError(f"Failed to list tables: {e}") from e

    try:
        return db.create_table("memories_long", schema=_get_memory_schema_long())
    except Exception as e:
        # Handle race condition where table was created between check and create
        if "already exists" in str(e).lower():
            try:
                table = db.open_table("memories_long")
                if not _validate_table_accessible(table, "memories_long"):
                    raise DatabaseError(
                        "Table 'memories_long' exists but is corrupted. "
                        "Database needs re-initialization."
                    )
                return table
            except Exception as open_err:
                logger.error(
                    "Table creation reported success but open failed: %s", open_err
                )
                raise DatabaseError(
                    f"Table creation reported success but open failed: {open_err}"
                ) from open_err
        logger.error("Failed to create table: %s", e)
        raise DatabaseError(f"Failed to create table: {e}") from e
```

4. **Enhance `_migrate_schema_if_needed()` error handling:**

```python
def _migrate_schema_if_needed() -> None:
    """Migrate from 0.1.0 (text, vector) to 0.2.1 schema using LanceDB add_columns.

    Uses schema evolution (add_columns) instead of recreate:
    1. If table doesn't exist: create it
    2. If table exists with old schema: add new columns with defaults
    3. If table exists with new schema: use as-is
    4. Handle corrupted/missing tables gracefully

    Raises:
        MigrationError: If migration fails.
    """
    db = get_db()

    try:
        existing_tables = db.list_tables()
    except Exception as e:
        logger.error("Failed to list tables (DB may be corrupted): %s", e)
        raise MigrationError(
            f"Failed to list tables (DB may be corrupted): {e}. "
            "Hint: Check SUPER_MEMORY_DB_PATH points to a valid database location. "
            "If corrupted, delete the memories.lance directory and restart."
        ) from e
```

---

## Code Changes Summary

### File 1: `src/super_memory/config.py`

**Changes:** Add path validation warning when using default database path

**Location:** After line 47 (`db_path = os.path.abspath(raw_path)`)

**Add code:**

```python
# Warn if using default path and it appears empty/invalid
if not os.environ.get("SUPER_MEMORY_DB_PATH"):
    if os.path.exists(db_path):
        lance_path = os.path.join(db_path, "memories.lance")
        # Check if lance directory structure is valid
        if os.path.isdir(lance_path):
            data_dir = os.path.join(lance_path, "data")
            versions_dir = os.path.join(lance_path, "_versions")
            if not (os.path.exists(data_dir) and os.path.exists(versions_dir)):
                logger.warning(
                    "Database path '%s' exists but memories.lance appears empty or corrupted. "
                    "Set SUPER_MEMORY_DB_PATH to a valid database location. "
                    "Expected valid path: /home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data",
                    db_path
                )
```

### File 2: `src/super_memory/mcp_tools.py`

**Changes:** Add two new tool wrapper functions after line 243

**Add after `query_memory` function:**

```python
@mcp.tool()
@_mcp_error_handler
def boomerang_memory_search_tiered(question: str, top_k: int = 5) -> str:
    """Fast tiered memory search - Quick MiniLM search with BGE fallback.

    Use this for routine queries where speed matters.
    This is the "Fast Reply" mode - prioritizes MiniLM speed but falls back
    to BGE-Large if confidence is low (below BGE_THRESHOLD config).

    Args:
        question: Query text to search for.
        top_k: Maximum number of results to return (default 5, max 20).
    """
    logger.info("Tiered memory search: %s", question)
    results = query_memories(question=question, top_k=top_k, strategy_override="TIERED")

    if not results:
        return "No relevant memories found in tiered search."

    context = "\n---\n".join([r.text for r in results])
    return f"[TIERED] Found these relevant memories:\n\n{context}"


@mcp.tool()
@_mcp_error_handler
def boomerang_memory_search_parallel(question: str, top_k: int = 5) -> str:
    """Archivist parallel memory search - Dual-tier search with RRF fusion.

    Use this for important queries where maximum recall matters.
    This is the "Archivist" mode - searches both MiniLM and BGE-Large tables
    simultaneously and merges results using Reciprocal Rank Fusion (RRF).

    Args:
        question: Query text to search for.
        top_k: Maximum number of results to return (default 5, max 20).
    """
    logger.info("Parallel memory search: %s", question)
    results = query_memories(question=question, top_k=top_k, strategy_override="PARALLEL")

    if not results:
        return "No relevant memories found in parallel search."

    context = "\n---\n".join([r.text for r in results])
    return f"[PARALLEL] Found these relevant memories:\n\n{context}"
```

### File 3: `src/super_memory/memory.py`

**Changes:**
1. Add `_validate_table_accessible()` helper function (after line 225, before `_validate_vector_dimensions`)
2. Update `_get_or_create_table()` to validate table after opening (lines 130-162)
3. Update `_get_or_create_table_long()` to validate table after opening (lines 165-198)
4. Enhance `_migrate_schema_if_needed()` error message (lines 247-253)

**Add helper function after line 225:**

```python
def _validate_table_accessible(table, table_name: str) -> bool:
    """Check if a table can actually be accessed/queried.

    Args:
        table: LanceDB table instance to validate.
        table_name: Name of table for error messages.

    Returns:
        True if table is accessible, False otherwise.
    """
    try:
        # Try a simple search operation to verify table is usable
        table.search().limit(0).to_pydantic(_get_memory_schema())
        return True
    except Exception as e:
        logger.error("Table '%s' is not accessible: %s", table_name, e)
        return False
```

**Update `_get_or_create_table()` validation (after line 141-142):**

Original:
```python
    if "memories" in db.list_tables():
        return db.open_table("memories")
```

Change to:
```python
    if "memories" in db.list_tables():
        table = db.open_table("memories")
        if not _validate_table_accessible(table, "memories"):
            raise DatabaseError(
                "Table 'memories' exists but is corrupted. "
                "Database needs re-initialization."
            )
        return table
```

**Apply same pattern to `_get_or_create_table_long()` (after line 175-177):**

Original:
```python
    if "memories_long" in db.list_tables():
        return db.open_table("memories_long")
```

Change to:
```python
    if "memories_long" in db.list_tables():
        table = db.open_table("memories_long")
        if not _validate_table_accessible(table, "memories_long"):
            raise DatabaseError(
                "Table 'memories_long' exists but is corrupted. "
                "Database needs re-initialization."
            )
        return table
```

**Enhance `_migrate_schema_if_needed()` error message (after line 253):**

Original:
```python
    except Exception as e:
        logger.error("Failed to list tables (DB may be corrupted): %s", e)
        raise MigrationError(f"Failed to list tables (DB may be corrupted): {e}") from e
```

Change to:
```python
    except Exception as e:
        logger.error("Failed to list tables (DB may be corrupted): %s", e)
        raise MigrationError(
            f"Failed to list tables (DB may be corrupted): {e}. "
            "Hint: Check SUPER_MEMORY_DB_PATH points to a valid database location. "
            "If corrupted, delete the memories.lance directory and restart."
        ) from e
```

---

## Configuration Recommendations

### Environment Variables

The following environment variables should be documented and supported:

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPER_MEMORY_DB_PATH` | `./memory_data` | Path to LanceDB database directory |
| `SUPER_MEMORY_DEVICE` | `auto` | Device for embedding model (auto/cpu/cuda) |
| `SUPER_MEMORY_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | MiniLM model name |
| `SUPER_MEMORY_DTYPE` | `float32` | Data type for embeddings |
| `EMBEDDING_STRATEGY` | `TIERED` | Search strategy (TIERED/PARALLEL/MINILM_ONLY) |
| `BGE_THRESHOLD` | `0.72` | Confidence threshold for tiered fallback |
| `BGE_MODEL` | `BAAI/bge-large-en-v1.5` | BGE-Large model name |
| `SUPER_MEMORY_LOG_LEVEL` | `WARNING` | Logging level |

### Recommended Setup for Boomerang Integration

When running super-memory-mcp in the Boomerang context, set:

```bash
export SUPER_MEMORY_DB_PATH=/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data
```

Or programmatically in the server startup:

```python
os.environ["SUPER_MEMORY_DB_PATH"] = "/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data"
```

---

## Testing Checklist

### Test 1: Database Path Resolution

**Setup:**
```bash
cd /home/jcharles/Projects/MCP-Servers/boomerang
export SUPER_MEMORY_DB_PATH=/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data
python -c "from super_memory.config import get_config; c = get_config(); print(f'db_path: {c.db_path}')"
```

**Expected Output:**
```
db_path: /home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data
```

**Verify:** Path points to Super-Memory project, not Boomerang project.

### Test 2: Tool Registration

**Setup:**
```bash
cd /home/jcharles/Projects/MCP-Servers/Super-Memory
python -c "
from super_memory.mcp_tools import register_tools
from fastmcp import FastMCP
mcp = FastMCP('test')
register_tools(mcp)
# Check tools are registered
tool_names = [t.name for t in mcp._tool_manager.tools]
print('Registered tools:', tool_names)
assert 'boomerang_memory_search_tiered' in tool_names, 'Missing tiered tool'
assert 'boomerang_memory_search_parallel' in tool_names, 'Missing parallel tool'
print('SUCCESS: All tools registered')
"
```

**Expected Output:**
```
Registered tools: [..., 'boomerang_memory_search_tiered', 'boomerang_memory_search_parallel', ...]
SUCCESS: All tools registered
```

### Test 3: Tiered Search Tool

**Setup:**
```bash
cd /home/jcharles/Projects/MCP-Servers/Super-Memory
export SUPER_MEMORY_DB_PATH=/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data
python -c "
from super_memory.mcp_tools import boomerang_memory_search_tiered
result = boomerang_memory_search_tiered('test query', top_k=3)
print(result)
assert '[TIERED]' in result or 'No relevant memories' in result
print('SUCCESS: Tiered search works')
"
```

**Expected Output:** Either relevant memories with `[TIERED]` prefix or "No relevant memories found" message.

### Test 4: Parallel Search Tool

**Setup:**
```bash
cd /home/jcharles/Projects/MCP-Servers/Super-Memory
export SUPER_MEMORY_DB_PATH=/home/jcharles/Projects/MCP-Servers/Super-Memory/memory_data
python -c "
from super_memory.mcp_tools import boomerang_memory_search_parallel
result = boomerang_memory_search_parallel('test query', top_k=3)
print(result)
assert '[PARALLEL]' in result or 'No relevant memories' in result
print('SUCCESS: Parallel search works')
"
```

**Expected Output:** Either relevant memories with `[PARALLEL]` prefix or "No relevant memories found" message.

### Test 5: Corruption Detection

**Setup:**
```bash
# Create a corrupted empty lance directory
mkdir -p /tmp/test_corrupt/memory_data/memories.lance
touch /tmp/test_corrupt/memory_data/memories.lance/.gitkeep
export SUPER_MEMORY_DB_PATH=/tmp/test_corrupt/memory_data
cd /home/jcharles/Projects/MCP-Servers/Super-Memory
python -c "
from super_memory.memory import get_table
try:
    table = get_table()
    print('Table obtained (may be empty but accessible)')
except Exception as e:
    print(f'Error caught: {e}')
    assert 'corrupted' in str(e).lower() or 'not found' in str(e).lower() or 're-initialization' in str(e).lower()
    print('SUCCESS: Corruption detected with clear error message')
"
```

**Expected Output:** Clear error message indicating database corruption and need for re-initialization.

### Test 6: Valid Database Path Warning

**Setup:**
```bash
cd /home/jcharles/Projects/MCP-Servers/Super-Memory
# Test with empty Boomerang path (no env var set for this path)
export SUPER_MEMORY_DB_PATH=/home/jcharles/Projects/MCP-Servers/boomerang/memory_data
python -c "
import logging
logging.basicConfig(level=logging.WARNING)
from super_memory.config import get_config
c = get_config()
print(f'Config loaded: {c.db_path}')
" 2>&1
```

**Expected Output:** Warning message about empty or corrupted database path.

---

## Additional Notes

### Backward Compatibility

All changes are backward compatible:
- Existing `query_memory` tool continues to work with `strategy` parameter
- New tools provide convenience wrappers without changing underlying behavior
- Database initialization improvements don't break existing valid databases

### Error Message Improvements

All error messages now include actionable hints:
- "Check SUPER_MEMORY_DB_PATH points to a valid database location"
- "If corrupted, delete the memories.lance directory and restart"
- "Database needs re-initialization"

### Logging

The `config.py` changes use `logger.warning()` which respects the `SUPER_MEMORY_LOG_LEVEL` environment variable. Set to `INFO` or `DEBUG` to see these warnings during development.

---

## Files Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/super_memory/config.py` | Add path validation warning | After line 47 |
| `src/super_memory/mcp_tools.py` | Add two new tool functions | After line 243 |
| `src/super_memory/memory.py` | Add validation helper + update existing functions | Multiple locations |

---

## Implementation Order

1. **First:** Update `mcp_tools.py` - Add the two new tool wrappers (simplest change, validates tool registration works)
2. **Second:** Update `memory.py` - Add corruption detection (improves reliability)
3. **Third:** Update `config.py` - Add path validation warning (helps with debugging)

Run tests after each step to validate changes.