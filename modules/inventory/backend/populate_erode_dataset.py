"""
Step 2: Realistic Erode FMCG / Supermarket Seed Dataset Generator.
Populates:
1. Categories (Grains & Staples, Edible Oils, Dals & Pulses, Spices & Masala, Personal Care, Festival Confectionery).
2. Realistic SKUs (Ponni Boiled Rice, Toor Dal, Cold Pressed Groundnut Oil, Sunflower Oil, Sambar Powder, Ghee, Filter Coffee, Jaggery, etc.).
3. Tamil Nadu & Erode Festival / Regional Events Calendar.
4. Stock Balances & Historical Ledger Transactions across 90 days.
5. Supplier profiles with lead times, prices, and reliability scores.
"""
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from apps.categories.models import InventoryCategory
from apps.products.models import InventoryItem
from apps.warehouses.models import Warehouse, StorageLocation
from apps.stock.models import StockBalance, StockLedgerEntry
from apps.planning.models import (
    SupplierProductProfile,
    RegionalFestivalEvent,
    IndustrySeasonalRule,
    MarketIntelligenceRecord,
)

def populate_erode_fmcg_dataset():
    print("Populating Erode FMCG / Supermarket dataset...")

    # 1. Main Warehouse in Erode
    warehouse, _ = Warehouse.objects.get_or_create(
        code="WH-ERODE-01",
        defaults={
            "name": "Erode Central FMCG Distribution Hub",
            "warehouse_type": "Main Warehouse",
            "city": "Erode",
            "state": "Tamil Nadu",
            "country": "IN",
            "status": "ACTIVE",
            "max_weight_capacity": Decimal("250000.00"),
        }
    )
    loc, _ = StorageLocation.objects.get_or_create(
        warehouse=warehouse,
        code="LOC-ERD-MAIN",
        defaults={
            "name": "Erode Main Storage Bay A",
            "location_type": "Storage",
            "status": "Active",
        }
    )

    # 2. FMCG Categories
    categories_data = [
        ("Grains & Staples", "CAT-GRN"),
        ("Edible Oils & Ghee", "CAT-OIL"),
        ("Dals & Pulses", "CAT-DAL"),
        ("Spices & Masala", "CAT-SPC"),
        ("Beverages & Snacks", "CAT-BEV"),
        ("Festival Special Groceries", "CAT-FEST"),
    ]
    cat_objs = {}
    for name, code in categories_data:
        c, _ = InventoryCategory.objects.get_or_create(code=code, defaults={"name": name})
        cat_objs[name] = c

    # 3. 15 Representative FMCG / Supermarket SKUs in Erode
    products_data = [
        # code, name, category, standard_cost, list_price, reorder_point, reorder_qty, moq, lead_time, initial_on_hand, returns_pct, is_dead
        ("FMCG-RIC-001", "Bhavani Deluxe Ponni Boiled Rice 25kg", "Grains & Staples", 1350.0, 1550.0, 40.0, 100.0, 20.0, 4, 18.0, 2.0, False),
        ("FMCG-DAL-002", "Unpolished Erode Toor Dal Premium 1kg", "Dals & Pulses", 145.0, 175.0, 150.0, 400.0, 50.0, 3, 45.0, 1.5, False),
        ("FMCG-OIL-003", "Kangeyam Cold Pressed Groundnut Oil 5L", "Edible Oils & Ghee", 980.0, 1150.0, 30.0, 80.0, 10.0, 5, 12.0, 0.8, False),
        ("FMCG-OIL-004", "SunGold Refined Sunflower Oil 1L Pouch", "Edible Oils & Ghee", 115.0, 135.0, 200.0, 600.0, 100.0, 3, 85.0, 1.0, False),
        ("FMCG-SPC-005", "Erode Native Golden Turmeric Powder 500g", "Spices & Masala", 85.0, 110.0, 100.0, 300.0, 50.0, 2, 60.0, 0.5, False),
        ("FMCG-SPC-006", "Traditional Chettinad Sambar Powder 200g", "Spices & Masala", 55.0, 75.0, 80.0, 250.0, 40.0, 4, 30.0, 3.0, False),
        ("FMCG-FEST-007", "Organic Vellore Jaggery Round 1kg", "Festival Special Groceries", 65.0, 90.0, 50.0, 200.0, 25.0, 3, 20.0, 1.0, False),
        ("FMCG-BEV-008", "Nilgiris Roasted Peaberry Filter Coffee 500g", "Beverages & Snacks", 280.0, 340.0, 60.0, 150.0, 20.0, 6, 22.0, 4.0, False),
        ("FMCG-DAL-009", "Urad Dal Gota White Premium 1kg", "Dals & Pulses", 130.0, 160.0, 120.0, 350.0, 50.0, 3, 40.0, 2.0, False),
        ("FMCG-OIL-010", "Aavin Pure Cow Ghee Tin 1L", "Edible Oils & Ghee", 610.0, 690.0, 40.0, 120.0, 15.0, 4, 15.0, 0.5, False),
        ("FMCG-GRN-011", "Organic Seeraga Samba Biryani Rice 5kg", "Grains & Staples", 480.0, 580.0, 35.0, 100.0, 20.0, 5, 10.0, 1.2, False),
        ("FMCG-SPC-012", "Dry Guntur Red Chilli Stemless 500g", "Spices & Masala", 160.0, 210.0, 70.0, 200.0, 25.0, 4, 25.0, 16.5, False), # High returns penalty
        ("FMCG-BEV-013", "Mettupalayam Cardamom Pods Grade-A 100g", "Beverages & Snacks", 240.0, 310.0, 30.0, 80.0, 10.0, 7, 8.0, 0.5, False),
        ("FMCG-FEST-014", "Diwali Special Assorted Ghee Sweets Gift Box", "Festival Special Groceries", 380.0, 520.0, 50.0, 250.0, 30.0, 5, 5.0, 0.0, False),
        ("FMCG-OBS-015", "Old Packaging Herbal Hair Dye 50ml (Discontinued)", "Festival Special Groceries", 45.0, 65.0, 20.0, 50.0, 10.0, 7, 45.0, 2.0, True), # Dead stock (no movement 90d)
    ]

    now = timezone.now()
    today = timezone.localdate()

    for item_t in products_data:
        code, name, cat_name, std_cost, list_price, reorder_pt, reorder_qty, moq, lead_time, on_hand, ret_pct, is_dead = item_t
        cat = cat_objs[cat_name]

        prod, _ = InventoryItem.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "category": cat,
                "standard_cost": Decimal(str(std_cost)),
                "list_price": Decimal(str(list_price)),
                "reorder_point": Decimal(str(reorder_pt)),
                "reorder_quantity": Decimal(str(reorder_qty)),
                "min_order_qty": Decimal(str(moq)),
                "lead_time_days": lead_time,
                "is_active": True,
            }
        )

        # Set StockBalance
        bal, _ = StockBalance.objects.get_or_create(
            item=prod,
            warehouse=warehouse,
            defaults={
                "location": loc,
                "on_hand_qty": Decimal(str(on_hand)),
                "reserved_qty": Decimal("0.0000"),
            }
        )
        bal.on_hand_qty = Decimal(str(on_hand))
        bal.save()

        # Seed historical ledger outbound demand if not dead stock
        if not is_dead:
            # Create synthetic outbound ledger issues over 90 days
            # Period 1 (last 30d): 3 issues
            StockLedgerEntry.objects.get_or_create(
                transaction_ref=f"SO-ERD-{code}-01",
                defaults={
                    "item": prod,
                    "warehouse": warehouse,
                    "location": loc,
                    "movement_type": StockLedgerEntry.MovementType.ISSUE,
                    "quantity_delta": Decimal(str(-1 * (reorder_qty * 0.4))),
                    "balance_after": Decimal(str(on_hand)),
                    "created_at": now - timedelta(days=10),
                }
            )
            # Period 2 (31-60d)
            StockLedgerEntry.objects.get_or_create(
                transaction_ref=f"SO-ERD-{code}-02",
                defaults={
                    "item": prod,
                    "warehouse": warehouse,
                    "location": loc,
                    "movement_type": StockLedgerEntry.MovementType.ISSUE,
                    "quantity_delta": Decimal(str(-1 * (reorder_qty * 0.35))),
                    "balance_after": Decimal(str(on_hand + 20)),
                    "created_at": now - timedelta(days=45),
                }
            )
            # Period 3 (61-90d)
            StockLedgerEntry.objects.get_or_create(
                transaction_ref=f"SO-ERD-{code}-03",
                defaults={
                    "item": prod,
                    "warehouse": warehouse,
                    "location": loc,
                    "movement_type": StockLedgerEntry.MovementType.ISSUE,
                    "quantity_delta": Decimal(str(-1 * (reorder_qty * 0.30))),
                    "balance_after": Decimal(str(on_hand + 40)),
                    "created_at": now - timedelta(days=75),
                }
            )

        # Seed realistic supplier profile
        SupplierProductProfile.objects.get_or_create(
            supplier_name=f"Erode Agro Merchants Co ({prod.code})",
            product=prod,
            defaults={
                "unit_price": Decimal(str(std_cost)),
                "lead_time_days": lead_time,
                "minimum_order_qty": Decimal(str(moq)),
                "on_time_delivery_rate": Decimal("96.00") if not is_dead else Decimal("70.00"),
                "quality_acceptance_rate": Decimal("99.20"),
                "is_preferred": True,
            }
        )
        SupplierProductProfile.objects.get_or_create(
            supplier_name=f"Salem & Coimbatore Wholesale Mandi ({prod.code})",
            product=prod,
            defaults={
                "unit_price": Decimal(str(round(std_cost * 1.05, 2))),
                "lead_time_days": max(1, lead_time - 2),
                "minimum_order_qty": Decimal(str(moq * 0.5)),
                "on_time_delivery_rate": Decimal("98.50"),
                "quality_acceptance_rate": Decimal("99.80"),
                "is_preferred": False,
            }
        )

    # 4. Regional Festival Events for Tamil Nadu / Erode
    current_year = today.year
    events = [
        ("Deepavali / Diwali Festival Rush", "Tamil Nadu", "Erode", "Festival Special Groceries", f"{current_year}-10-25", f"{current_year}-11-05", 21, Decimal("2.10")),
        ("Karthigai Deepam Lamp Lighting", "Tamil Nadu", "Erode", "Edible Oils & Ghee", f"{current_year}-11-20", f"{current_year}-11-26", 14, Decimal("1.75")),
        ("Pongal & Bogi Harvest Celebration", "Tamil Nadu", "Erode", "Grains & Staples", f"{current_year + 1}-01-10", f"{current_year + 1}-01-17", 25, Decimal("2.40")),
        ("Erode Mariamman Jaathirai Festival", "Tamil Nadu", "Erode", "Festival Special Groceries", f"{current_year}-12-10", f"{current_year}-12-22", 18, Decimal("1.85")),
        ("Aadi Perukku River Feast", "Tamil Nadu", "Erode", "Spices & Masala", f"{current_year}-08-01", f"{current_year}-08-05", 10, Decimal("1.40")),
        ("School & College Reopening Rush", "Tamil Nadu", "Erode", "Beverages & Snacks", f"{current_year}-06-01", f"{current_year}-06-15", 14, Decimal("1.35")),
    ]

    for ev_name, reg, loc_name, cat, s_date, e_date, rampup, mult in events:
        RegionalFestivalEvent.objects.get_or_create(
            event_name=ev_name,
            defaults={
                "region": reg,
                "location": loc_name,
                "category": cat,
                "start_date": s_date,
                "end_date": e_date,
                "demand_rampup_days": rampup,
                "historical_multiplier": mult,
                "description": f"Annual peak demand surge in {loc_name} for {cat}.",
                "is_active": True,
            }
        )

    print("Successfully populated Erode FMCG / Supermarket dataset with 15 SKUs, regional events, and supplier mandi profiles!")

if __name__ == "__main__":
    populate_erode_fmcg_dataset()
