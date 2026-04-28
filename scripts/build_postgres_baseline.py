from __future__ import annotations

from pathlib import Path


ROOT = Path("/Users/leonardocruz/Documents/proyectos/abogado-soft")
SOURCE = ROOT / "infra" / "db" / "schema.sql"
TARGET = ROOT / "infra" / "postgres" / "baseline.sql"


def main() -> None:
    lines = SOURCE.read_text().splitlines()
    output: list[str] = []

    skip_policy = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("\\restrict") or stripped.startswith("\\unrestrict"):
            continue

        if stripped == "SET transaction_timeout = 0;":
            continue

        if stripped == "CREATE SCHEMA public;":
            continue

        if stripped.startswith("CREATE POLICY "):
            skip_policy = True
            continue

        if skip_policy:
            if stripped.endswith("));") or stripped.endswith(");"):
                skip_policy = False
            continue

        if "ENABLE ROW LEVEL SECURITY" in stripped:
            continue

        if "auth.uid()" in stripped:
            continue

        output.append(line)

    header = [
        "-- ============================================================================",
        "-- PostgreSQL baseline para self-hosted",
        "-- Fuente: infra/db/schema.sql",
        "-- Generado por: scripts/build_postgres_baseline.py",
        "-- Limpiezas aplicadas:",
        "--   - elimina metacomandos de pg_dump",
        "--   - elimina policies RLS dependientes de auth.uid()",
        "--   - elimina ENABLE ROW LEVEL SECURITY",
        "-- ============================================================================",
        "",
    ]

    TARGET.write_text("\n".join(header + output).rstrip() + "\n")


if __name__ == "__main__":
    main()
