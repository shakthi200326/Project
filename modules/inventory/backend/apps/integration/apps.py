from django.apps import AppConfig


class IntegrationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integration"
    verbose_name = "Integration Engine & Outbox"

    def ready(self):
        # Register in-memory handlers and subscriptions
        try:
            from apps.integration.services.subscription_service import initialize_subscriptions
            initialize_subscriptions()
        except Exception:
            pass

