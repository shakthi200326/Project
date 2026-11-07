import re
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db import IntegrityError, transaction

from apps.products.models import (
    InventoryItem,
    InventoryItemVariant,
    ItemAttributeValue,
    ProductAttribute,
    ProductAttributeValue,
)


class VariantCatalogService:
    @staticmethod
    def normalize_sku_part(value):
        return re.sub(r"[^A-Z0-9]+", "-", str(value).strip().upper()).strip("-")

    @classmethod
    def validate_selection(cls, item, selections, lock=False):
        if not item.is_active or not item.has_variants:
            raise ValidationError({"item": "Select an active Item Master record that supports variants."})
        if not isinstance(selections, list) or not selections:
            raise ValidationError({"selected_attributes": "Select at least one attribute and value."})

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
                {"selected_attributes": "Assign variant attributes to the parent item first."}
            )

        attribute_ids = []
        normalized_selections = []
        for selection in selections:
            if not isinstance(selection, dict):
                raise ValidationError({"selected_attributes": "Each selection must include an attribute and value."})
            try:
                attribute_id = int(selection.get("attribute_id"))
                value_id = int(selection.get("value_id"))
            except (TypeError, ValueError):
                raise ValidationError(
                    {"selected_attributes": "Choose a valid attribute and value."}
                )
            if attribute_id <= 0 or value_id <= 0:
                raise ValidationError({"selected_attributes": "Each selected attribute needs one value."})
            if attribute_id in attribute_ids:
                raise ValidationError({"selected_attributes": "An attribute cannot be selected more than once."})
            if attribute_id not in assigned_attribute_ids:
                raise ValidationError(
                    {"selected_attributes": "Choose attributes assigned to the parent item."}
                )
            attribute_ids.append(attribute_id)
            normalized_selections.append(
                {"attribute_id": attribute_id, "value_id": value_id}
            )

        validated = []
        for selection in normalized_selections:
            attributes = ProductAttribute.objects.filter(
                pk=selection["attribute_id"],
                is_active=True,
                is_variant_generator=True,
            )
            values = ProductAttributeValue.objects.filter(
                pk=selection["value_id"],
                attribute_id=selection["attribute_id"],
                is_active=True,
            )
            if lock:
                attribute = attributes.select_for_update().first()
                value = values.select_for_update().first()
            else:
                attribute = attributes.first()
                value = values.first()
            if not attribute or not value:
                raise ValidationError(
                    {"selected_attributes": "Choose active values from active variant attributes."}
                )
            validated.append((attribute, value))
        return validated

    @classmethod
    def build_sku(cls, item, selected, exclude_variant_id=None):
        parts = [cls.normalize_sku_part(item.code)]
        parts.extend(cls.normalize_sku_part(value.value) for _, value in selected)
        base = "-".join(part for part in parts if part)[:80].rstrip("-")
        if not base:
            raise ValidationError({"sku": "A SKU could not be generated from the item and attributes."})

        suffix = 1
        while True:
            suffix_text = "" if suffix == 1 else f"-{suffix}"
            candidate = f"{base[:80 - len(suffix_text)].rstrip('-')}{suffix_text}"
            existing = InventoryItemVariant.objects.filter(sku__iexact=candidate)
            if exclude_variant_id:
                existing = existing.exclude(pk=exclude_variant_id)
            if not existing.exists():
                return candidate
            suffix += 1

    @classmethod
    def build_name(cls, item, selected):
        return " - ".join([item.name, *(value.value for _, value in selected)])[:150]

    @staticmethod
    def selection_key(selected):
        return tuple(sorted((attribute.pk, value.value.casefold()) for attribute, value in selected))

    @classmethod
    def existing_selection_key(cls, variant):
        assignments = list(
            variant.attribute_assignments.select_related("attribute", "attribute_value").all()
        )
        if assignments:
            return tuple(
                sorted(
                    (
                        assignment.attribute_id,
                        (
                            assignment.attribute_value.value
                            if assignment.attribute_value_id
                            else assignment.custom_value
                        ).casefold(),
                    )
                    for assignment in assignments
                )
            )

        values_by_name = {
            attribute.name.casefold(): attribute.pk
            for attribute in ProductAttribute.objects.filter(
                is_variant_generator=True
            )
        }
        values_by_name.update(
            {
                attribute.code.casefold(): attribute.pk
                for attribute in ProductAttribute.objects.filter(
                    is_variant_generator=True
                )
            }
        )
        try:
            return tuple(
                sorted((values_by_name[name.casefold()], value.casefold()) for name, value in variant.attributes.items())
            )
        except (AttributeError, KeyError, TypeError):
            return ()

    @classmethod
    def create_variant(
        cls,
        *,
        item_id,
        selections,
        variant_name="",
        barcode="",
        description="",
        image_id="",
        status="ACTIVE",
        additional_cost=Decimal("0"),
        additional_price=Decimal("0"),
        weight=None,
    ):
        with transaction.atomic():
            item = InventoryItem.objects.select_for_update().filter(pk=item_id).first()
            if not item:
                raise ValidationError({"item": "The selected parent item does not exist."})

            selected = cls.validate_selection(item, selections, lock=True)
            selected_key = cls.selection_key(selected)
            for existing in item.variants.all():
                if cls.existing_selection_key(existing) == selected_key:
                    raise ValidationError(
                        {"selected_attributes": "This attribute combination already exists for the parent item."}
                    )

            attributes = {}
            for attribute, value in selected:
                key = attribute.name
                if key in attributes:
                    key = f"{attribute.name} ({attribute.code})"
                attributes[key] = value.value
            variant_code = "-".join(
                cls.normalize_sku_part(value.value) for _, value in selected
            )[:60]
            name = cls.build_name(item, selected)
            if not name:
                raise ValidationError({"variant_name": "Variant name is required."})
            is_active = status == "ACTIVE"

            while True:
                sku = cls.build_sku(item, selected)
                try:
                    with transaction.atomic():
                        variant = InventoryItemVariant.objects.create(
                            item=item,
                            sku=sku,
                            variant_code=variant_code,
                            variant_name=name,
                            barcode=barcode,
                            description=description,
                            image_id=image_id,
                            attributes=attributes,
                            additional_cost=additional_cost,
                            additional_price=additional_price,
                            weight=weight,
                            status="ACTIVE" if is_active else "DISCONTINUED",
                            is_active=is_active,
                        )
                except IntegrityError:
                    if InventoryItemVariant.objects.filter(sku__iexact=sku).exists():
                        continue
                    raise
                break

            ItemAttributeValue.objects.bulk_create(
                [
                    ItemAttributeValue(
                        item=item,
                        variant=variant,
                        attribute=attribute,
                        attribute_value=value,
                    )
                    for attribute, value in selected
                ]
            )
            return variant
