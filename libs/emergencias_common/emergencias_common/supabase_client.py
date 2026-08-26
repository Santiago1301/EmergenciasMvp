"""Cliente compartido de Supabase para los 4 microservicios."""

from __future__ import annotations

import json
import os
from functools import lru_cache

from supabase import Client, create_client


class MissingSupabaseConfig(RuntimeError):
    pass


def _load_secrets_from_aws() -> tuple[str, str]:
    import boto3

    secret_name = os.environ.get("SUPABASE_SECRET_NAME", "emergencias/supabase")
    client = boto3.client("secretsmanager")
    raw = client.get_secret_value(SecretId=secret_name)["SecretString"]
    data = json.loads(raw)
    return data["SUPABASE_URL"], data["SUPABASE_SERVICE_ROLE_KEY"]


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            url, key = _load_secrets_from_aws()
        else:
            raise MissingSupabaseConfig(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no estan configurados. "
                "En local: crea un archivo .env con las variables. En AWS: deben "
                "venir de Secrets Manager, nunca de un archivo en el repo."
            )

    return create_client(url, key)
