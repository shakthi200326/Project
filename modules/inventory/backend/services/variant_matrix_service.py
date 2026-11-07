import itertools
from decimal import Decimal
from typing import List, Dict, Any
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.products.models import (
    InventoryItem,
    InventoryItemVariant,
    ProductAttribute,
    ProductAttributeValue,
    ItemAttributeValue,
    ProductBarcode,
)


class VariantMatrixService:
    @classmethod
    def generate_matrix(
        cls,
        item: InventoryItem,
        attribute_value_selection: Dict[str, List[str]] = None,
        base_sku_prefix: str = "",
        cost_delta: Decimal = Decimal("0.0000"),
        price_delta: Decimal = Decimal("0.0000"),
        attributes_config: List[Dict[str, Any]] = None,
        sku_prefix: str = "",
    ) -> List[InventoryItemVariant]:
        """
        Computes Cartesian product of attribute options and creates unique variants.
        Prevents duplicate combinations and auto-generates SKUs and barcodes.
        """
        if not attribute_value_selection and attributes_config:
            attribute_value_selection = {}
            for entry in attributes_config:
                code = entry.get("attribute_code") or entry.get("code") or entry.get("name")
                attribute_value_selection[code] = entry.get("values", [])

        if not base_sku_prefix and sku_prefix:
            base_sku_prefix = sku_prefix

        if not attribute_value_selection:
            raise ValidationError("Attribute selection cannot be empty to generate variants.")

        attribute_keys = list(attribute_value_selection.keys())
        attribute_lists = []
        attribute_objs = {}

        for attr_ref in attribute_keys:
            if str(attr_ref).isdigit():
                attr = ProductAttribute.objects.filter(
                    pk=int(attr_ref), is_active=True, is_variant_generator=True
                ).first()
            else:
                attr = ProductAttribute.objects.filter(
                    code__iexact=str(attr_ref),
                    is_active=True,
                    is_variant_generator=True,
                ).first()
            if not attr:
                raise ValidationError(
                    f"Active variant attribute '{attr_ref}' not found."
                )
            if attr.pk in [existing.pk for existing in attribute_objs.values()]:
                raise ValidationError(f"Attribute '{attr.code}' is selected more than once.")
            attribute_objs[attr_ref] = attr

            values = attribute_value_selection[attr_ref]
            if not values:
                raise ValidationError(f"Attribute '{attr.name}' has no values selected.")
            validated_values = []
            for value in values:
                value_obj = ProductAttributeValue.objects.filter(
                    attribute=attr, value__iexact=str(value).strip(), is_active=True
                ).first()
                if not value_obj:
                    raise ValidationError(
                        f"'{value}' is not an active value for attribute '{attr.name}'."
                    )
                validated_values.append(value_obj.value)
            attribute_lists.append(validated_values)

        # Cartesian product of all options
        combinations = list(itertools.product(*attribute_lists))
        if not combinations:
            raise ValidationError("No valid combinations generated.")

        created_variants = []
        sku_prefix = (base_sku_prefix or item.code).strip().upper()

        with transaction.atomic():
            item = InventoryItem.objects.select_for_update().get(pk=item.pk)
            if not item.is_active or not item.has_variants:
                raise ValidationError(
                    "Select an active Item Master record that supports variants."
                )
            assigned_attribute_ids = set(
                ItemAttributeValue.objects.filter(
                    item=item,
                    variant__isnull=True,
                    attribute__is_active=True,
                    attribute__is_variant_generator=True,
                ).values_list("attribute_id", flat=True)
            )
            if not assigned_attribute_ids:
                raise ValidationError(
                    "Assign variant attributes to the parent item first."
                )
            if any(attr.pk not in assigned_attribute_ids for attr in attribute_objs.values()):
                raise ValidationError(
                    "Choose attributes assigned to the parent item."
                )
            item.has_variants = True
            item.save(update_fields=["has_variants", "updated_at"])

            for combo in combinations:
                attr_dict = {}
                name_parts = []
                code_parts = []

                for i, val in enumerate(combo):
                    attr = attribute_objs[attribute_keys[i]]
                    clean_val = str(val).strip()
                    attr_dict[attr.name] = clean_val
                    name_parts.append(clean_val)
                    clean_code = "".join(ch for ch in clean_val.upper() if ch.isalnum())
                    code_parts.append(clean_code)

                variant_name = f"{item.name} ({', '.join(name_parts)})"
                candidate_sku = f"{sku_prefix}-{'-'.join(code_parts)}"

                # Ensure uniqueness
                counter = 1
                unique_sku = candidate_sku
                while InventoryItemVariant.objects.filter(sku=unique_sku).exists():
                    unique_sku = f"{candidate_sku}-{counter}"
                    counter += 1

                # Prevent duplicate combinations on same item
                existing_variant = None
                for v in item.variants.all():
                    if v.attributes == attr_dict:
                        existing_variant = v
                        break

                if existing_variant:
                    continue  # Skip existing exact combination

                # Auto-generate EAN-13 compatible barcode value
                seed = "".join(ch for ch in f"{item.id}{unique_sku}" if ch.isdigit())
                if len(seed) < 9:
                    seed = (seed + str(abs(hash(unique_sku)))).ljust(9, "0")[:9]
                else:
                    seed = seed[:9]
                auto_barcode = f"890{seed}"[:12]
                checksum = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(auto_barcode)) % 10
                checksum = (10 - checksum) % 10
                final_barcode = f"{auto_barcode}{checksum}"

                # Ensure barcode uniqueness
                while ProductBarcode.objects.filter(barcode_value=final_barcode).exists() or InventoryItemVariant.objects.filter(barcode=final_barcode).exists():
                    auto_num = str(abs(hash(unique_sku + str(counter))))[:9].ljust(9, "0")
                    auto_barcode = f"890{auto_num}"[:12]
                    checksum = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(auto_barcode)) % 10
                    checksum = (10 - checksum) % 10
                    final_barcode = f"{auto_barcode}{checksum}"
                    counter += 1

                variant = InventoryItemVariant.objects.create(
                    item=item,
                    sku=unique_sku,
                    variant_code="-".join(code_parts),
                    variant_name=variant_name,
                    barcode=final_barcode,
                    attributes=attr_dict,
                    additional_cost=cost_delta,
                    additional_price=price_delta,
                    status="ACTIVE",
                    is_active=True,
                )

                # Create primary barcode record for variant
                ProductBarcode.objects.create(
                    item=item,
                    variant=variant,
                    barcode_value=final_barcode,
                    barcode_type=ProductBarcode.BarcodeType.PRIMARY,
                    symbology=ProductBarcode.Symbology.EAN13,
                    is_primary=True,
                    is_active=True,
                )

                # Link concrete attribute assignments
                for i, val in enumerate(combo):
                    attr = attribute_objs[attribute_keys[i]]
                    clean_val = str(val).strip()
                    val_obj = ProductAttributeValue.objects.filter(attribute=attr, value__iexact=clean_val).first()
                    ItemAttributeValue.objects.create(
                        item=item,
                        variant=variant,
                        attribute=attr,
                        attribute_value=val_obj,
                        custom_value=clean_val if not val_obj else "",
                    )

                created_variants.append(variant)

        return created_variants
