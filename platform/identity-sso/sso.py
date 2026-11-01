"""
Platform Identity & SSO Service
Provides OpenID Connect (OIDC), SAML 2.0, and JWT token decoding adapters
for resolving enterprise identities without tight coupling to a single IdP.
"""
import jwt
from typing import Optional, Dict, Any


class IdentityContext:
    def __init__(self, user_id: str, email: str, tenant_id: str, roles: list = None):
        self.user_id = user_id
        self.email = email
        self.tenant_id = tenant_id
        self.roles = roles or []

    @classmethod
    def from_jwt(cls, token: str, secret_key: str, algorithms: list = None) -> "IdentityContext":
        algorithms = algorithms or ["HS256", "RS256"]
        payload = jwt.decode(token, secret_key, algorithms=algorithms, options={"verify_exp": True})
        return cls(
            user_id=payload.get("sub") or payload.get("user_id"),
            email=payload.get("email", ""),
            tenant_id=payload.get("tenant_id", "default-tenant"),
            roles=payload.get("roles", []),
        )

    @classmethod
    def anonymous(cls) -> "IdentityContext":
        return cls(user_id="anonymous", email="anonymous@internal", tenant_id="default-tenant", roles=["GUEST"])
