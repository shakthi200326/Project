from decimal import Decimal
from typing import Tuple, Optional
from django.core.exceptions import ValidationError
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem, ProductUnitConversion


class UOMConversionService:
    @classmethod
    def resolve_uom(cls, uom_ref) -> UnitOfMeasure:
        if isinstance(uom_ref, UnitOfMeasure):
            return uom_ref
        if not uom_ref:
            raise ValidationError("Unit of Measure reference cannot be empty.")
        if str(uom_ref).isdigit():
            uom = UnitOfMeasure.objects.filter(pk=int(uom_ref)).first()
        else:
            uom = UnitOfMeasure.objects.filter(code__iexact=str(uom_ref).strip()).first()
        if not uom:
            raise ValidationError(f"Unit of Measure not found: '{uom_ref}'.")
        return uom

    @classmethod
    def validate_fractional_allowed(cls, uom_ref, quantity: Decimal):
        uom = cls.resolve_uom(uom_ref)
        if not uom.allow_fractional_quantity:
            if Decimal(str(quantity)) % Decimal("1") != Decimal("0"):
                raise ValidationError(
                    f"Fractional quantities are not permitted for UOM '{uom.code}'. Received: {quantity}"
                )

    @classmethod
    def convert_quantity(
        cls,
        item: Optional[InventoryItem] = None,
        quantity: Optional[Decimal] = None,
        from_uom_ref = None,
        to_uom_ref = None,
        **kwargs,
    ) -> Tuple[Decimal, Decimal]:
        """
        Converts quantity from `from_uom` to `to_uom` (defaults to item's Base UOM).
        Returns: (converted_quantity, effective_conversion_factor)
        Where: converted_quantity = quantity * effective_conversion_factor
        """
        target_item = item or kwargs.get("product")
        target_qty = quantity if quantity is not None else kwargs.get("qty", Decimal("1"))
        target_qty = Decimal(str(target_qty))

        from_ref = from_uom_ref or kwargs.get("from_uom")
        to_ref = to_uom_ref or kwargs.get("to_uom")

        from_uom = cls.resolve_uom(from_ref)
        if to_ref is None:
            if target_item and target_item.base_uom:
                to_uom = target_item.base_uom
            elif target_item and target_item.base_unit:
                to_uom = cls.resolve_uom(target_item.base_unit)
            else:
                to_uom = from_uom
        else:
            to_uom = cls.resolve_uom(to_ref)

        if from_uom.pk == to_uom.pk:
            return target_qty, Decimal("1.000000")

        # 1. Check Direct Product-Specific UOM Conversions
        if target_item:
            direct_conv = ProductUnitConversion.objects.filter(
                item=target_item, from_uom=from_uom, to_uom=to_uom, is_active=True
            ).first()
            if direct_conv:
                factor = direct_conv.conversion_factor
                return target_qty * factor, factor

            reverse_conv = ProductUnitConversion.objects.filter(
                item=target_item, from_uom=to_uom, to_uom=from_uom, is_active=True
            ).first()
            if reverse_conv and reverse_conv.conversion_factor > Decimal("0"):
                factor = Decimal("1.000000") / reverse_conv.conversion_factor
                return target_qty * factor, factor

            # Multi-step packaging conversion (e.g. CTN -> BOX -> EA)
            step1 = ProductUnitConversion.objects.filter(
                item=target_item, from_uom=from_uom, is_active=True
            ).first()
            if step1:
                step2 = ProductUnitConversion.objects.filter(
                    item=target_item, from_uom=step1.to_uom, to_uom=to_uom, is_active=True
                ).first()
                if step2:
                    factor = step1.conversion_factor * step2.conversion_factor
                    return target_qty * factor, factor

        # 2. Check Global Standard UOM Conversion
        if from_uom.dimension != to_uom.dimension:
            item_code = target_item.code if target_item else "N/A"
            raise ValidationError(
                f"Cannot convert between incompatible UOM dimensions '{from_uom.dimension}' ({from_uom.code}) "
                f"and '{to_uom.dimension}' ({to_uom.code}) without a product-specific conversion rule for item '{item_code}'."
            )

        # Convert through base unit in same dimension
        from_factor = from_uom.conversion_factor if not from_uom.is_base else Decimal("1.0000")
        to_factor = to_uom.conversion_factor if not to_uom.is_base else Decimal("1.0000")

        if to_factor <= Decimal("0"):
            raise ValidationError(f"Invalid target conversion factor ({to_factor}) for UOM '{to_uom.code}'.")

        effective_factor = Decimal(str(from_factor)) / Decimal(str(to_factor))
        converted_qty = target_qty * effective_factor
        return converted_qty, effective_factor
