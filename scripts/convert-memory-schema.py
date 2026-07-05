#!/usr/bin/env python3
"""
Convert legacy memory_data folders to new camelCase schema.

This script transforms LanceDB memory tables from legacy snake_case schema
to the new camelCase schema with proper defaults.

Usage:
    python convert-memory-schema.py [--dry-run] [--verbose]

Author: Boomerang Coder
"""

import argparse
import hashlib
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import lancedb
import pandas as pd
import pyarrow as pa


# Target schema field definitions
TARGET_FIELDS = [
    pa.field("id", pa.string()),
    pa.field("text", pa.string()),
    pa.field("vector", pa.list_(pa.float32(), 1024)),
    pa.field("sourceType", pa.string()),
    pa.field("sourcePath", pa.string()),
    pa.field("timestamp", pa.int64()),
    pa.field("contentHash", pa.string()),
    pa.field("metadataJson", pa.string()),
    pa.field("sessionId", pa.string()),
]

TARGET_SCHEMA = pa.schema(TARGET_FIELDS)

# Column mappings: legacy -> new
COLUMN_RENAMES = {
    "source_type": "sourceType",
    "source_path": "sourcePath",
    "content_hash": "contentHash",
    "metadata_json": "metadataJson",
}

# Default values for missing columns
DEFAULTS = {
    "sourceType": "session",
    "sourcePath": "",
    "timestamp": lambda: int(datetime.now(timezone.utc).timestamp() * 1_000_000),  # microseconds
    "contentHash": None,  # computed from text
    "metadataJson": "{}",
    "sessionId": "",
}


def compute_content_hash(text: str) -> str:
    """Compute SHA256 hash of text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def find_memory_data_dirs(base_path: str, skip_trash: bool = True) -> list[Path]:
    """Find all memory_data directories under base_path."""
    memory_dirs = []
    trash_pattern = ".Trash" if not sys.platform == "darwin" else ".Trash"

    for path in Path(base_path).rglob("memory_data"):
        if skip_trash and trash_pattern in str(path):
            continue
        if path.is_dir():
            memory_dirs.append(path)

    return sorted(memory_dirs)


def inspect_lancedb_tables(db_path: Path) -> list[str]:
    """List all table names in a LanceDB database."""
    try:
        db = lancedb.connect(str(db_path))
        # Attempt to get table names - this may not work in all LanceDB versions
        # Try alternative approach
        return db.table_names()
    except Exception:
        # Fallback: try to list via subprocess
        try:
            result = subprocess.run(
                ["lancedb", "dump", str(db_path)],
                capture_output=True,
                text=True,
            )
            # Parse output for table names
            return []
        except Exception:
            return []


def get_table_names_from_lance_dir(lance_dir: Path) -> list[str]:
    """Extract table names from a .lance directory name."""
    # A .lance directory is named after the table
    if lance_dir.suffix == ".lance":
        return [lance_dir.stem]
    return []


def check_target_schema_exists(table: "lancedb.table.Table") -> bool:
    """Check if table already has target schema (has 'id' and camelCase columns)."""
    schema = table.schema
    field_names = set(schema.names)

    # Check for key camelCase fields
    has_id = "id" in field_names
    has_source_type = "sourceType" in field_names

    return has_id and has_source_type


def transform_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Transform a DataFrame from legacy schema to target schema."""
    df = df.copy()

    # Force string columns to handle mixed types
    string_cols = ["text", "source_type", "source_path", "content_hash", "metadata_json"]
    for col in string_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).replace("nan", "").replace("None", "")

    # Ensure vector column is proper format (list of floats)
    if "vector" in df.columns:
        def safe_vector(v):
            if v is None or (isinstance(v, float) and pd.isna(v)):
                return [0.0] * 1024
            try:
                return [float(x) for x in v]
            except (TypeError, ValueError):
                return [0.0] * 1024
        df["vector"] = df["vector"].apply(safe_vector)

    # Handle timestamp column
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df["timestamp"] = df["timestamp"].fillna(pd.Timestamp.now())
        df["timestamp"] = df["timestamp"].apply(lambda x: int(x.timestamp() * 1_000_000))

    # Add id column if not present
    if "id" not in df.columns:
        df["id"] = [str(uuid.uuid4()) for _ in range(len(df))]

    # Rename columns
    for old_name, new_name in COLUMN_RENAMES.items():
        if old_name in df.columns and new_name not in df.columns:
            df[new_name] = df[old_name]
            df = df.drop(columns=[old_name])

    # Add missing columns with defaults
    for col, default in DEFAULTS.items():
        if col not in df.columns:
            if callable(default):
                df[col] = [default() for _ in range(len(df))]
            elif default is None:
                # Compute from text
                df[col] = df["text"].apply(compute_content_hash)
            else:
                df[col] = default

    # Ensure column order matches target schema
    ordered_columns = [f.name for f in TARGET_FIELDS]
    existing_columns = [c for c in ordered_columns if c in df.columns]
    missing_columns = [c for c in df.columns if c not in ordered_columns]
    df = df[existing_columns + missing_columns]

    return df


def convert_table(db: "lancedb.LanceDB", db_path: Path, table_name: str, dry_run: bool = False, verbose: bool = False) -> bool:
    """Convert a single table to new schema."""
    new_table_name = f"{table_name}_new"
    backup_dir = None

    if verbose:
        print(f"  Converting table '{table_name}'...")

    try:
        # Open existing table
        table = db.open_table(table_name)

        # Check if already converted
        if check_target_schema_exists(table):
            if verbose:
                print(f"    Table '{table_name}' already has target schema, skipping.")
            return True

        # Read all data
        try:
            df = table.to_pandas()
        except Exception as e:
            print(f"    ERROR: Cannot read table '{table_name}': {e}")
            print("    This may indicate corrupted LanceDB data. Check .lance directory contents.")
            return False

        row_count = len(df)

        if verbose:
            print(f"    Read {row_count} rows from '{table_name}'")

        if dry_run:
            print(f"    [DRY RUN] Would transform {row_count} rows")
            return True

        if row_count == 0:
            if verbose:
                print("    Table is empty, skipping conversion")
            return True

        # Transform data
        df_transformed = transform_dataframe(df)

        # Get the lance directory path
        lance_dir = db_path / f"{table_name}.lance"

        if not lance_dir.exists():
            print(f"    ERROR: Lance directory not found: {lance_dir}")
            return False

        # Create backup BEFORE any modifications
        backup_dir = lance_dir.with_suffix(".lance.backup")
        if backup_dir.exists():
            shutil.rmtree(backup_dir)
        shutil.copytree(lance_dir, backup_dir)
        if verbose:
            print(f"    Created backup at {backup_dir}")

        try:
            # Build records with proper type handling
            records = []
            for _, row in df_transformed.iterrows():
                record = {}
                for col in df_transformed.columns:
                    val = row[col]
                    if col == "vector":
                        # Ensure vector is list of floats
                        if val is None or (isinstance(val, float) and pd.isna(val)):
                            record[col] = [0.0] * 1024
                        else:
                            try:
                                record[col] = [float(x) for x in val]
                            except (TypeError, ValueError):
                                record[col] = [0.0] * 1024
                    elif col in ("timestamp",):
                        # Keep timestamp as microseconds
                        if pd.isna(val):
                            record[col] = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
                        else:
                            record[col] = int(val)
                    elif col in ("text", "sourceType", "sourcePath", "contentHash", "metadataJson", "sessionId", "id"):
                        # Ensure string fields are strings
                        if pd.isna(val):
                            record[col] = ""
                        else:
                            record[col] = str(val)
                    else:
                        if pd.isna(val):
                            record[col] = None
                        else:
                            record[col] = val
                records.append(record)

            # Create new table with target schema
            db.create_table(new_table_name, schema=TARGET_SCHEMA, mode="overwrite")

            # Insert data using pa table for more control
            new_table = db.open_table(new_table_name)
            pa_table = pa.Table.from_pylist(records, schema=TARGET_SCHEMA)
            new_table.add(pa_table)

            # Drop old table
            db.drop_table(table_name)

            # Rename new table to original name - use same pa approach
            final_pa_table = new_table.to_arrow()
            db.create_table(table_name, schema=TARGET_SCHEMA, mode="overwrite")
            final_table = db.open_table(table_name)
            final_table.add(final_pa_table)

            # Drop the temp new table
            db.drop_table(new_table_name)

            # Remove backup on success
            shutil.rmtree(backup_dir)
            backup_dir = None  # Mark as cleaned up

            if verbose:
                print(f"    Successfully converted '{table_name}' ({row_count} rows)")
            return True

        except Exception as e:
            # Restore from backup on failure
            if backup_dir and backup_dir.exists():
                lance_path = db_path / f"{table_name}.lance"
                if lance_path.exists():
                    shutil.rmtree(lance_path)
                shutil.copytree(backup_dir, lance_path)
                shutil.rmtree(backup_dir)
                print(f"    Restored from backup due to error: {e}")
            raise  # Re-raise the original exception

    except Exception as e:
        print(f"    ERROR converting table '{table_name}': {e}")
        return False


def convert_memory_data_dir(mem_dir: Path, dry_run: bool = False, verbose: bool = False) -> tuple[bool, str]:
    """Convert all tables in a memory_data directory."""
    success = True
    message = ""

    if verbose:
        print(f"\nProcessing: {mem_dir}")

    try:
        # Find all .lance directories
        lance_dirs = list(mem_dir.glob("*.lance"))

        if not lance_dirs:
            # Check if it's a direct LanceDB storage
            if (mem_dir / "data").exists():
                # This might be a newer LanceDB format
                print(f"  Warning: Non-standard LanceDB format at {mem_dir}")
                return False, "Non-standard format"
            print("  No .lance directories found, skipping")
            return True, "No tables to convert"

        # Connect to LanceDB
        db = lancedb.connect(str(mem_dir))

        # Get table names
        table_names = [d.stem for d in lance_dirs]

        if verbose:
            print(f"  Found tables: {table_names}")

        for table_name in table_names:
            result = convert_table(db, mem_dir, table_name, dry_run=dry_run, verbose=verbose)
            if not result:
                success = False
                message = f"Failed to convert table '{table_name}'"
                break

        if success:
            message = f"Converted {len(table_names)} table(s)"

    except Exception as e:
        success = False
        message = str(e)
        print(f"  ERROR: {message}")

    return success, message


def main():
    parser = argparse.ArgumentParser(
        description="Convert legacy memory_data folders to new camelCase schema."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed progress",
    )
    parser.add_argument(
        "--base-path",
        default="/home/jcharles",
        help="Base path to search for memory_data directories (default: /home/jcharles)",
    )
    parser.add_argument(
        "--skip-trash",
        action="store_true",
        default=True,
        help="Skip directories in Trash (default: True)",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Memory Data Schema Converter")
    print("=" * 60)

    if args.dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***\n")

    # Find all memory_data directories
    print(f"Searching for memory_data directories under {args.base_path}...")
    memory_dirs = find_memory_data_dirs(args.base_path, skip_trash=args.skip_trash)

    if not memory_dirs:
        print("No memory_data directories found.")
        return 0

    print(f"Found {len(memory_dirs)} memory_data directory(s):")
    for d in memory_dirs:
        print(f"  - {d}")

    # Process each directory
    results = []
    for mem_dir in memory_dirs:
        success, message = convert_memory_data_dir(mem_dir, dry_run=args.dry_run, verbose=args.verbose)
        results.append((mem_dir, success, message))

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    success_count = sum(1 for _, s, _ in results if s)
    fail_count = len(results) - success_count

    for mem_dir, success, message in results:
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"{status}: {mem_dir}")
        if message:
            print(f"         {message}")

    print()
    print(f"Total: {len(results)} | Success: {success_count} | Failed: {fail_count}")

    if args.dry_run:
        print("\n*** DRY RUN COMPLETE - No changes were made ***")

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
