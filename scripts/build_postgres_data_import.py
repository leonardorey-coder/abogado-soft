from __future__ import annotations

from pathlib import Path


ROOT = Path("/Users/leonardocruz/Documents/proyectos/abogado-soft")
SOURCE = ROOT / "infra" / "db" / "full_dump.sql"
TARGET = ROOT / "infra" / "postgres" / "data_import.sql"


def main() -> None:
    lines = SOURCE.read_text().splitlines()
    output: list[str] = []
    collecting = False
    statement_parts: list[str] = []

    for line in lines:
        stripped = line.strip()
        if collecting:
            statement_parts.append(line)
            if stripped.endswith(";"):
                output.append(" ".join(part.strip() for part in statement_parts))
                statement_parts = []
                collecting = False
            continue

        if stripped.startswith("INSERT INTO public."):
            if stripped.endswith(";"):
                output.append(line)
            else:
                collecting = True
                statement_parts = [line]

    header = [
        "-- ============================================================================",
        "-- Datos para PostgreSQL self-hosted",
        "-- Fuente: infra/db/full_dump.sql",
        "-- Generado por: scripts/build_postgres_data_import.py",
        "-- Contenido:",
        "--   - solo INSERT INTO public.*",
        "-- ============================================================================",
        "",
        "BEGIN;",
        "SET statement_timeout = 0;",
        "SET lock_timeout = 0;",
        "SET idle_in_transaction_session_timeout = 0;",
        "SET client_encoding = 'UTF8';",
        "SET standard_conforming_strings = on;",
        "SET check_function_bodies = false;",
        "SET client_min_messages = warning;",
        "SET row_security = off;",
        "-- Confiamos en el dump fuente; desactivamos triggers/FKs durante la carga.",
        "SET session_replication_role = replica;",
        "",
    ]
    footer = ["", "SET session_replication_role = origin;", "COMMIT;"]

    TARGET.write_text("\n".join(header + output + footer).rstrip() + "\n")


if __name__ == "__main__":
    main()
