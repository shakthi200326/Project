from rest_framework import permissions
from apps.security_audit.authorization_service import CentralAuthorizationService

class RequiresPermission(permissions.BasePermission):
    """
    DRF permission class that validates granular permissions using CentralAuthorizationService.
    Usage:
        permission_classes = [RequiresPermission]
        required_permission = "inventory.items.view"
    """

    def has_permission(self, request, view):
        required_perm = getattr(view, "required_permission", None)
        if not required_perm:
            return True

        res = CentralAuthorizationService.check_permission(request.user, required_perm)
        return res.allowed

