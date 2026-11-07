from decimal import Decimal
from typing import Dict, Any, List, Optional
from django.db.models import Sum, F, Q
from django.core.exceptions import ValidationError
from apps.warehouses.models import (
    Warehouse,
    StorageLocation,
    WarehouseZone,
    Rack,
    Bin,
    WarehouseOperationalConfiguration,
)
from apps.stock.models import StockBalance
from apps.products.models import InventoryItem


class WarehouseCapacityService:
    @classmethod
    def get_warehouse_capacity(cls, warehouse: Warehouse) -> Dict[str, Any]:
        """
        Calculates independent weight, volume, and pallet footprint metrics
        from actual stock balances and product physical specifications.
        Never combines weight and volume into a misleading single percentage.
        """
        balances = StockBalance.objects.filter(
            warehouse=warehouse,
            on_hand_qty__gt=0
        ).select_related("item")

        total_weight = Decimal("0.0000")
        total_volume = Decimal("0.0000")
        total_units = Decimal("0.0000")

        for bal in balances:
            qty = bal.on_hand_qty
            total_units += qty
            item = bal.item
            if item.weight:
                total_weight += qty * item.weight
            if item.volume:
                total_volume += qty * item.volume

        max_weight = warehouse.max_weight_capacity or Decimal("100000.0000")
        max_volume = warehouse.max_volume_capacity or Decimal("5000.0000")
        max_pallets = warehouse.max_pallet_positions or (warehouse.bins.count() or 100)

        weight_pct = (total_weight / max_weight * 100) if max_weight > 0 else Decimal("0.0")
        volume_pct = (total_volume / max_volume * 100) if max_volume > 0 else Decimal("0.0")

        # Occupied bins calculation
        occupied_bins = (
            StockBalance.objects.filter(
                warehouse=warehouse,
                bin__isnull=False,
                on_hand_qty__gt=0
            )
            .values("bin_id")
            .distinct()
            .count()
        )
        pallet_pct = (Decimal(occupied_bins) / Decimal(max_pallets) * 100) if max_pallets > 0 else Decimal("0.0")

        # Capacity status determination
        max_pct = max(weight_pct, volume_pct, pallet_pct)
        if max_pct >= Decimal("95.0"):
            capacity_status = "CRITICAL"
        elif max_pct >= Decimal("80.0"):
            capacity_status = "WARNING"
        else:
            capacity_status = "OPTIMAL"

        return {
            "warehouse_id": warehouse.id,
            "warehouse_code": warehouse.code,
            "warehouse_name": warehouse.name,
            "total_units_on_hand": float(total_units),
            "weight": {
                "used_kg": float(round(total_weight, 2)),
                "max_kg": float(round(max_weight, 2)),
                "available_kg": float(round(max(Decimal("0.0"), max_weight - total_weight), 2)),
                "utilization_pct": float(round(weight_pct, 1)),
            },
            "volume": {
                "used_m3": float(round(total_volume, 3)),
                "max_m3": float(round(max_volume, 3)),
                "available_m3": float(round(max(Decimal("0.0"), max_volume - total_volume), 3)),
                "utilization_pct": float(round(volume_pct, 1)),
            },
            "pallet_positions": {
                "occupied": occupied_bins,
                "total": max_pallets,
                "available": max(0, max_pallets - occupied_bins),
                "utilization_pct": float(round(pallet_pct, 1)),
            },
            "capacity_status": capacity_status,
        }

    @classmethod
    def get_location_utilization(cls, warehouse: Warehouse) -> List[Dict[str, Any]]:
        """
        Returns granular capacity metrics per storage location.
        """
        locations = warehouse.locations.all().order_by("code")
        utilization_list = []

        for loc in locations:
            balances = StockBalance.objects.filter(location=loc, on_hand_qty__gt=0).select_related("item")
            loc_weight = Decimal("0.0000")
            loc_volume = Decimal("0.0000")
            loc_qty = Decimal("0.0000")
            skus_present = set()

            for b in balances:
                loc_qty += b.on_hand_qty
                skus_present.add(b.item.code)
                if b.item.weight:
                    loc_weight += b.on_hand_qty * b.item.weight
                if b.item.volume:
                    loc_volume += b.on_hand_qty * b.item.volume

            max_w = loc.max_weight or Decimal("5000.0000")
            max_v = loc.max_volume or Decimal("50.0000")

            w_pct = (loc_weight / max_w * 100) if max_w > 0 else Decimal("0.0")
            v_pct = (loc_volume / max_v * 100) if max_v > 0 else Decimal("0.0")

            utilization_list.append({
                "location_id": loc.id,
                "code": loc.code,
                "name": loc.name,
                "location_type": loc.location_type,
                "status": loc.status,
                "sku_count": len(skus_present),
                "total_quantity": float(loc_qty),
                "weight_used": float(round(loc_weight, 2)),
                "weight_max": float(round(max_w, 2)),
                "weight_pct": float(round(w_pct, 1)),
                "volume_used": float(round(loc_volume, 3)),
                "volume_max": float(round(max_v, 3)),
                "volume_pct": float(round(v_pct, 1)),
                "allow_receiving": loc.allow_receiving,
                "allow_picking": loc.allow_picking,
                "allow_putaway": loc.allow_putaway,
            })

        return utilization_list


class WarehousePutawayService:
    @classmethod
    def validate_putaway_to_location(
        cls,
        location: StorageLocation,
        item: InventoryItem,
        quantity: Decimal,
        batch_number: str = ""
    ) -> bool:
        """
        Validates mixing rules, capacity limits, and operational gates before putaway.
        """
        if not location.is_active or location.status != "Active":
            raise ValidationError(f"Storage location '{location.code}' is inactive or blocked.")

        if not location.allow_putaway:
            raise ValidationError(f"Storage location '{location.code}' does not allow putaway operations.")

        # Check product mixing rule
        existing_balances = StockBalance.objects.filter(location=location, on_hand_qty__gt=0).exclude(item=item)
        if not location.allow_product_mixing and existing_balances.exists():
            raise ValidationError(
                f"Location '{location.code}' disallows product mixing. Already contains other SKUs."
            )

        # Check batch mixing rule
        if batch_number and not location.allow_batch_mixing:
            from apps.batches.models import Batch
            existing_batches = (
                Batch.objects.filter(location=location, item=item, remaining_quantity__gt=0)
                .exclude(batch_number=batch_number)
            )
            if existing_batches.exists():
                raise ValidationError(
                    f"Location '{location.code}' disallows batch mixing. Already contains a different batch."
                )

        # Check weight capacity limit
        if location.max_weight and item.weight:
            loc_balances = StockBalance.objects.filter(location=location, on_hand_qty__gt=0).select_related("item")
            current_weight = sum(
                (b.on_hand_qty * (b.item.weight or Decimal("0.0000")))
                for b in loc_balances
            )
            additional_weight = quantity * item.weight
            if current_weight + additional_weight > location.max_weight:
                wh_config = getattr(location.warehouse, "operational_config", None)
                if wh_config and wh_config.capacity_enforcement == "STRICT_BLOCK":
                    raise ValidationError(
                        f"Location '{location.code}' weight capacity exceeded: "
                        f"Current {current_weight}kg + New {additional_weight}kg > Max {location.max_weight}kg."
                    )

        return True

    @classmethod
    def validate_bin_transfer(
        cls,
        warehouse: Warehouse,
        source_bin: Bin,
        dest_bin: Bin,
        item: InventoryItem,
        quantity: Decimal,
        batch_number: str = ""
    ) -> bool:
        """
        Validates an intra-warehouse transfer between two bins in the same facility.
        Guarantees that total warehouse stock remains 100% unchanged.
        """
        if source_bin.warehouse_id != warehouse.id or dest_bin.warehouse_id != warehouse.id:
            raise ValidationError("Both source and destination bins must belong to the specified warehouse.")

        if source_bin.id == dest_bin.id:
            raise ValidationError("Source and destination bins cannot be identical.")

        if not dest_bin.status == "Active":
            raise ValidationError(f"Destination bin '{dest_bin.code}' is not active.")

        # Check mixing rules on destination bin
        if not dest_bin.allow_mixing_products:
            other_items = StockBalance.objects.filter(bin=dest_bin, on_hand_qty__gt=0).exclude(item=item)
            if other_items.exists():
                raise ValidationError(f"Destination bin '{dest_bin.code}' disallows mixing different products.")

        if batch_number and not dest_bin.allow_mixing_batches:
            from apps.batches.models import Batch
            other_batches = (
                Batch.objects.filter(location=dest_bin.location, item=item, remaining_quantity__gt=0)
                .exclude(batch_number=batch_number)
            )
            if other_batches.exists():
                raise ValidationError(f"Destination bin '{dest_bin.code}' disallows mixing different batches.")

        return True
