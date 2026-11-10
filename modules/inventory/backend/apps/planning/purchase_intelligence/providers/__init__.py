"""
External Market Data Providers Package.
Standardized adapters for Search Trends, E-commerce Marketplaces, and Mandi Commodities.
"""

from apps.planning.purchase_intelligence.providers.base_adapter import BaseMarketDataAdapter
from apps.planning.purchase_intelligence.providers.google_trends_adapter import GoogleTrendsAdapter
from apps.planning.purchase_intelligence.providers.amazon_adapter import AmazonMarketplaceAdapter
from apps.planning.purchase_intelligence.providers.mandi_adapter import MandiMarketAdapter

__all__ = [
    "BaseMarketDataAdapter",
    "GoogleTrendsAdapter",
    "AmazonMarketplaceAdapter",
    "MandiMarketAdapter",
]

