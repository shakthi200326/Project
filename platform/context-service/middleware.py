from django.utils.deprecation import MiddlewareMixin
from .context import DefaultContextResolver

class ContextMiddleware(MiddlewareMixin):
    """Attaches unified RequestContext to every incoming HTTP request."""

    def process_request(self, request):
        request.context = DefaultContextResolver.resolve(request)
