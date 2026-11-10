import logging
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class BaseMarketDataAdapter(ABC):
    """
    Abstract Base Adapter for Authorized External Market Data Feeds.
    Enforces standardized interfaces, error boundaries, rate-limiting,
    and schema validation across all market intelligence providers.
    """

    def __init__(self, provider_id: str, rate_limit_per_min: int = 60):
        self.provider_id = provider_id
        self.rate_limit_per_min = rate_limit_per_min
        self._last_call_timestamp: float = 0.0

    def _enforce_rate_limit(self):
        """Simple token throttle to ensure ERP does not breach third-party API quotas."""
        min_interval = 60.0 / max(1, self.rate_limit_per_min)
        elapsed = time.time() - self._last_call_timestamp
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self._last_call_timestamp = time.time()

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Validates provider connectivity, latency, credentials, and quota status."""
        pass

    @abstractmethod
    def get_trend_indicator(self, industry_code: str) -> Dict[str, Any]:
        """
        Fetches macro search or demand velocity indicators for the industry.
        Explicitly notes that search interest is not direct sales volume.
        """
        pass

    @abstractmethod
    def discover_products(
        self, industry_code: str, category: Optional[str] = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top observed products, listed market prices, and popularity signals.
        Returns sanitized dictionaries adhering to the standardized market observation schema.
        """
        pass

    @abstractmethod
    def get_price_history(self, external_id: str) -> List[Dict[str, Any]]:
        """Returns chronological price observations for volatility analysis."""
        pass

    @abstractmethod
    def get_supplier_offers(self, external_id: str) -> List[Dict[str, Any]]:
        """Returns verified supplier market quotes, MOQ, and landed delivery estimates."""
        pass

