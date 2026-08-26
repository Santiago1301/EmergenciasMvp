"""Cliente compartido de Supabase para los 4 microservicios."""

from __future__ import annotations

import os
from functools import lru_cache

from supabase import Client, create_client


class MissingSupabaseConfig(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise MissingSupabaseConfig(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no estan configurados. "
            "En local: copia .env.example a .env. En AWS: deben venir de "
            "Secrets Manager, nunca de un archivo .env en el repo."
        )

    return create_client(url, key)
