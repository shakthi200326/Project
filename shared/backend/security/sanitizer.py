"""
Shared Security Utilities
Input sanitization, parameter validation, and protection against injection vectors.
"""
import re
import html


class SecuritySanitizer:
    @staticmethod
    def sanitize_string(val: str) -> str:
        if not isinstance(val, str):
            return str(val)
        cleaned = html.escape(val.strip())
        return cleaned

    @staticmethod
    def is_safe_sku(sku: str) -> bool:
        """
        Validates SKU contains only safe alphanumeric, dash, and underscore characters.
        """
        return bool(re.match(r"^[A-Za-z0-9_\-\.]{1,64}$", sku))

