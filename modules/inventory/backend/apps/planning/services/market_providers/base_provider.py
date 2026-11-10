import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class BaseMarketProvider(ABC):
    """
    Abstract interface for all external market data providers.
    Supports E-commerce marketplaces, Search Trends, Wholesale Mandis, and Commodity Exchanges.
    """

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Validates connection, API keys, latency, and status."""
        pass

    @abstractmethod
    def get_trend_indicator(self, industry_code: str) -> Dict[str, Any]:
        """Fetches macro search/demand trend indicator for the specified industry."""
        pass

    @abstractmethod
    def discover_products(
        self, industry_code: str, category: Optional[str] = None, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Discovers trending or new products in the specified industry."""
        pass

    @abstractmethod
    def get_price_history(self, external_id: str) -> List[Dict[str, Any]]:
        """Returns price observation history for an external product ID."""
        pass

    @abstractmethod
    def get_supplier_offers(self, external_id: str) -> List[Dict[str, Any]]:
        """Fetches available supplier market offers, landed cost, and lead times."""
        pass
