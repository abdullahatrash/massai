#!/bin/sh
set -eu

python3 - <<'PY'
import json
import os
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "massai")
KEYCLOAK_ADMIN = os.environ.get("KEYCLOAK_ADMIN", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")
SEED_USERS_FILE = os.environ.get("SEED_USERS_FILE", "/work/seed-users.json")
USER_PROFILE_CONFIG = {
    "attributes": [
        {
            "name": "username",
            "displayName": "${username}",
            "permissions": {"view": ["admin", "user"], "edit": ["admin", "user"]},
            "validations": {
                "length": {"min": 3, "max": 255},
                "username-prohibited-characters": {},
                "up-username-not-idn-homograph": {},
            },
        },
        {
            "name": "email",
            "displayName": "${email}",
            "required": {"roles": ["user"]},
            "permissions": {"view": ["admin", "user"], "edit": ["admin", "user"]},
            "validations": {"email": {}, "length": {"max": 255}},
        },
        {
            "name": "firstName",
            "displayName": "${firstName}",
            "permissions": {"view": ["admin", "user"], "edit": ["admin", "user"]},
            "validations": {
                "length": {"max": 255},
                "person-name-prohibited-characters": {},
            },
        },
        {
            "name": "lastName",
            "displayName": "${lastName}",
            "permissions": {"view": ["admin", "user"], "edit": ["admin", "user"]},
            "validations": {
                "length": {"max": 255},
                "person-name-prohibited-characters": {},
            },
        },
        {
            "name": "contract_ids",
            "displayName": "Contract IDs",
            "permissions": {"view": ["admin"], "edit": ["admin"]},
            "multivalued": True,
            "validations": {"length": {"max": 255}},
        },
    ]
}


def http_json(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: Any | None = None,
    form: dict[str, str] | None = None,
    expected: tuple[int, ...] = (200,),
) -> Any:
    headers: dict[str, str] = {"Accept": "application/json"}
    data = None

    if token:
      headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
      headers["Content-Type"] = "application/json"
      data = json.dumps(payload).encode("utf-8")
    elif form is not None:
      headers["Content-Type"] = "application/x-www-form-urlencoded"
      data = urlencode(form).encode("utf-8")

    request = Request(url, data=data, headers=headers, method=method)

    try:
      with urlopen(request) as response:
        status = response.getcode()
        if status not in expected:
          raise RuntimeError(f"{method} {url} returned unexpected status {status}")

        body = response.read().decode("utf-8").strip()
        if not body:
          return None
        return json.loads(body)
    except HTTPError as exc:
      body = exc.read().decode("utf-8", errors="replace")
      raise RuntimeError(f"{method} {url} failed with {exc.code}: {body}") from exc


def wait_for_realm() -> None:
    ready_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/.well-known/openid-configuration"
    for attempt in range(1, 61):
      try:
        http_json("GET", ready_url)
        print(f"Keycloak realm {KEYCLOAK_REALM} is ready after {attempt} attempt(s).")
        return
      except (RuntimeError, URLError):
        time.sleep(2)
    raise SystemExit(f"Keycloak realm {KEYCLOAK_REALM} did not become ready in time.")


def get_admin_token() -> str:
    token_url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    token_response = http_json(
      "POST",
      token_url,
      form={
        "client_id": "admin-cli",
        "grant_type": "password",
        "username": KEYCLOAK_ADMIN,
        "password": KEYCLOAK_ADMIN_PASSWORD,
      },
    )
    token = token_response.get("access_token")
    if not token:
      raise SystemExit("Failed to obtain Keycloak admin access token.")
    return token


def ensure_user_profile(admin_token: str) -> None:
    http_json(
      "PUT",
      f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/profile",
      token=admin_token,
      payload=USER_PROFILE_CONFIG,
      expected=(200, 204),
    )
    print("Applied Keycloak user profile configuration.")


def load_seed_users() -> list[dict[str, Any]]:
    with open(SEED_USERS_FILE, "r", encoding="utf-8") as handle:
      data = json.load(handle)
    if not isinstance(data, list):
      raise SystemExit("seed-users.json must contain a JSON array.")
    return data


def get_user(admin_token: str, username: str) -> dict[str, Any] | None:
    encoded_username = quote(username, safe="")
    users = http_json(
      "GET",
      f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users?exact=true&username={encoded_username}",
      token=admin_token,
    )
    return users[0] if users else None


def sync_user(admin_token: str, user: dict[str, Any]) -> str:
    user_payload = {
      "username": user["username"],
      "email": user["email"],
      "firstName": user.get("firstName", ""),
      "lastName": user.get("lastName", ""),
      "enabled": True,
      "emailVerified": True,
      "attributes": user.get("attributes", {}),
    }

    existing = get_user(admin_token, user["username"])
    if existing is None:
      http_json(
        "POST",
        f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users",
        token=admin_token,
        payload=user_payload,
        expected=(201,),
      )
      existing = get_user(admin_token, user["username"])
      if existing is None:
        raise SystemExit(f"User {user['username']} could not be created.")
      print(f"Created user {user['username']}.")
    else:
      http_json(
        "PUT",
        f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{existing['id']}",
        token=admin_token,
        payload=user_payload,
        expected=(204,),
      )
      print(f"Updated user {user['username']}.")

    user_id = existing["id"]

    http_json(
      "PUT",
      f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{user_id}/reset-password",
      token=admin_token,
      payload={
        "type": "password",
        "value": user["password"],
        "temporary": False,
      },
      expected=(204,),
    )

    existing_roles = http_json(
      "GET",
      f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{user_id}/role-mappings/realm",
      token=admin_token,
    )
    existing_role_names = {role["name"] for role in existing_roles}
    missing_role_names = [name for name in user.get("roles", []) if name not in existing_role_names]
    if missing_role_names:
      role_payload = [
        http_json(
          "GET",
          f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/roles/{role_name}",
          token=admin_token,
        )
        for role_name in missing_role_names
      ]
      http_json(
        "POST",
        f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{user_id}/role-mappings/realm",
        token=admin_token,
        payload=role_payload,
        expected=(204,),
      )
      print(f"Granted roles {', '.join(missing_role_names)} to {user['username']}.")
    else:
      print(f"Roles already in sync for {user['username']}.")

    return user_id


def main() -> int:
    wait_for_realm()
    admin_token = get_admin_token()
    ensure_user_profile(admin_token)
    users = load_seed_users()

    for user in users:
      sync_user(admin_token, user)

    print(f"Seeded {len(users)} Keycloak users into realm {KEYCLOAK_REALM}.")
    return 0


sys.exit(main())
PY
