import io
import csv
from decimal import Decimal
from typing import Dict, Any, List, Tuple
from django.db import transaction
from django.core.exceptions import ValidationError

import openpyxl
from apps.categories.models import InventoryCategory
from apps.brands.models import Brand
from apps.units.models import UnitOfMeasure
from apps.products.models import InventoryItem, ProductBarcode


TEMPLATE_HEADERS = [
    "Item Code",
    "Item Name",
    "Display Name",
    "Item Type",
    "Category Code",
    "Brand",
    "Base UOM",
    "Purchase UOM",
    "Sales UOM",
    "Standard Cost",
    "List Price",
    "Reorder Point",
    "Reorder Quantity",
    "Barcode",
    "Tracking",
    "Net Weight",
    "Short Description",
]

SAMPLE_ROWS = [
    [
        "BRG-6205-2RS",
        "Industrial Ball Bearing 6205-2RS",
        "SKF Ball Bearing 6205",
        "STOCK",
        "CAT-MECH",
        "SKF Precision",
        "EA",
        "BOX",
        "EA",
        "14.85",
        "28.50",
        "50",
        "100",
        "890123620521",
        "BATCH",
        "0.128",
        "Deep groove ball bearing with rubber seals",
    ],
    [
        "VALVE-SOL-24V",
        "Hydraulic Solenoid Valve 24V DC",
        "Bosch Rexroth Solenoid Valve",
        "STOCK",
        "CAT-HYD",
        "Bosch Rexroth",
        "EA",
        "EA",
        "EA",
        "128.50",
        "240.00",
        "15",
        "30",
        "890123240015",
        "SERIAL",
        "1.450",
        "Directional spool valve 24V DC coil",
    ],
]


class ProductImportExportService:
    @classmethod
    def generate_template(cls, format: str = "csv") -> Tuple[bytes, str, str]:
        """Returns (content_bytes, content_type, filename)"""
        if format.lower() in ["xlsx", "excel"]:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Item Catalog Template"
            ws.append(TEMPLATE_HEADERS)
            for row in SAMPLE_ROWS:
                ws.append(row)
            
            # Format header row
            for cell in ws[1]:
                cell.font = openpyxl.styles.Font(bold=True)
                cell.fill = openpyxl.styles.PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid")

            output = io.BytesIO()
            wb.save(output)
            return output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "items_import_template.xlsx"
        else:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(TEMPLATE_HEADERS)
            for row in SAMPLE_ROWS:
                writer.writerow(row)
            return output.getvalue().encode("utf-8"), "text/csv; charset=utf-8", "items_import_template.csv"

    @classmethod
    def parse_rows(cls, file_obj, filename: str) -> List[Dict[str, Any]]:
        raw_rows = []
        is_excel = filename.lower().endswith((".xlsx", ".xls"))

        if is_excel:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
            ws = wb.active
            rows_iter = ws.iter_rows(values_only=True)
            try:
                headers = [str(h or "").strip().lower() for h in next(rows_iter)]
            except StopIteration:
                return []
            for row in rows_iter:
                if not any(row):
                    continue
                row_dict = {}
                for idx, val in enumerate(row):
                    if idx < len(headers):
                        row_dict[headers[idx]] = str(val or "").strip()
                raw_rows.append(row_dict)
        else:
            content = file_obj.read()
            if isinstance(content, bytes):
                content = content.decode("utf-8-sig", errors="replace")
            reader = csv.DictReader(io.StringIO(content))
            for row in reader:
                clean_row = {str(k or "").strip().lower(): str(v or "").strip() for k, v in row.items()}
                if any(clean_row.values()):
                    raw_rows.append(clean_row)

        return raw_rows

    @classmethod
    def validate_and_preview(
        cls,
        raw_rows: List[Dict[str, Any]],
        context_id: str = "default",
        update_existing: bool = True,
    ) -> Dict[str, Any]:
        """Dry-run row-level validation."""
        errors = []
        validated_rows = []
        existing_codes_in_file = set()
        new_count = 0
        update_count = 0

        # Pre-cache database entities for fast lookup
        categories_map = {c.code.upper(): c for c in InventoryCategory.objects.all()}
        for c in InventoryCategory.objects.all():
            categories_map[c.name.upper()] = c
        brands_map = {b.code.upper(): b for b in Brand.objects.all()}
        for b in Brand.objects.all():
            brands_map[b.name.upper()] = b
        units_map = {u.code.upper(): u for u in UnitOfMeasure.objects.all()}
        for u in UnitOfMeasure.objects.all():
            units_map[u.name.upper()] = u

        # Existing items
        existing_items = {
            item.code.upper(): item
            for item in InventoryItem.objects.filter(context_id=context_id)
        }

        for idx, row in enumerate(raw_rows, start=2):  # 1-indexed header is row 1
            row_errors = []
            code = (
                row.get("item code")
                or row.get("code")
                or row.get("sku")
                or ""
            ).strip().upper()
            name = (
                row.get("item name")
                or row.get("name")
                or ""
            ).strip()

            if not code:
                row_errors.append({"field": "Item Code", "message": "Item code is required."})
            elif code in existing_codes_in_file:
                row_errors.append({"field": "Item Code", "message": f"Duplicate item code '{code}' within the file."})
            else:
                existing_codes_in_file.add(code)

            if not name:
                row_errors.append({"field": "Item Name", "message": "Item name is required."})

            # Category resolution
            cat_ref = (
                row.get("category code")
                or row.get("category")
                or ""
            ).strip().upper()
            category_obj = categories_map.get(cat_ref)
            if not category_obj:
                row_errors.append({
                    "field": "Category Code",
                    "message": f"Category '{cat_ref}' does not exist in master categories."
                })

            # Base UOM resolution
            uom_ref = (
                row.get("base uom")
                or row.get("unit")
                or row.get("uom")
                or "EA"
            ).strip().upper()
            uom_obj = units_map.get(uom_ref)
            if not uom_obj:
                row_errors.append({
                    "field": "Base UOM",
                    "message": f"Base Unit of Measure '{uom_ref}' does not exist."
                })

            # Purchase & Sales UOM (Optional)
            p_uom_ref = (row.get("purchase uom") or "").strip().upper()
            purchase_uom_obj = units_map.get(p_uom_ref) if p_uom_ref else None

            s_uom_ref = (row.get("sales uom") or "").strip().upper()
            sales_uom_obj = units_map.get(s_uom_ref) if s_uom_ref else None

            # Brand resolution
            brand_ref_str = (row.get("brand") or "").strip().upper()
            brand_obj = brands_map.get(brand_ref_str) if brand_ref_str else None

            # Numeric fields validation
            def parse_dec(val_str, default="0"):
                if not val_str:
                    return Decimal(default)
                try:
                    return Decimal(val_str.replace("$", "").replace(",", ""))
                except Exception:
                    return None

            std_cost = parse_dec(row.get("standard cost") or row.get("cost"), "0.0000")
            if std_cost is None or std_cost < 0:
                row_errors.append({"field": "Standard Cost", "message": "Invalid numeric value."})

            list_price = parse_dec(row.get("list price") or row.get("price"), "0.0000")
            if list_price is None or list_price < 0:
                row_errors.append({"field": "List Price", "message": "Invalid numeric value."})

            reorder_pt = parse_dec(row.get("reorder point") or row.get("reorder_point"), "0.0000")
            if reorder_pt is None or reorder_pt < 0:
                row_errors.append({"field": "Reorder Point", "message": "Invalid numeric value."})

            reorder_qty = parse_dec(row.get("reorder quantity") or row.get("reorder_quantity"), "0.0000")
            if reorder_qty is None or reorder_qty < 0:
                row_errors.append({"field": "Reorder Quantity", "message": "Invalid numeric value."})

            # Item type
            raw_type = (row.get("item type") or row.get("type") or "STOCK").strip().upper()
            valid_types = [c[0] for c in InventoryItem.ItemType.choices]
            if raw_type not in valid_types:
                raw_type = "STOCK"

            # Tracking
            raw_tracking = (row.get("tracking") or "NONE").strip().upper()
            valid_trackings = [t[0] for t in InventoryItem.Tracking.choices]
            if raw_tracking not in valid_trackings:
                raw_tracking = "NONE"

            barcode = (row.get("barcode") or "").strip()
            display_name = (row.get("display name") or name).strip()
            short_desc = (row.get("short description") or row.get("description") or "").strip()

            is_update = code in existing_items
            if is_update and not update_existing:
                row_errors.append({
                    "field": "Item Code",
                    "message": f"Item '{code}' already exists and overwrite is disabled."
                })

            if row_errors:
                for err in row_errors:
                    errors.append({
                        "row": idx,
                        "code": code,
                        "field": err["field"],
                        "message": err["message"],
                    })
            else:
                if is_update:
                    update_count += 1
                else:
                    new_count += 1

                validated_rows.append({
                    "row_index": idx,
                    "code": code,
                    "name": name,
                    "display_name": display_name,
                    "short_description": short_desc,
                    "item_type": raw_type,
                    "category": category_obj,
                    "brand": brand_obj.name if brand_obj else (row.get("brand") or ""),
                    "brand_ref": brand_obj,
                    "base_unit": uom_obj.code if uom_obj else "EA",
                    "base_uom": uom_obj,
                    "purchase_uom": purchase_uom_obj,
                    "sales_uom": sales_uom_obj,
                    "standard_cost": std_cost or Decimal("0.0000"),
                    "list_price": list_price or Decimal("0.0000"),
                    "reorder_point": reorder_pt or Decimal("0.0000"),
                    "reorder_quantity": reorder_qty or Decimal("0.0000"),
                    "barcode": barcode,
                    "tracking": raw_tracking,
                    "is_update": is_update,
                    "existing_id": existing_items[code].id if is_update else None,
                })

        return {
            "total_rows": len(raw_rows),
            "valid_rows_count": len(validated_rows),
            "error_rows_count": len(set(e["row"] for e in errors)),
            "new_count": new_count,
            "update_count": update_count,
            "errors": errors,
            "preview": [
                {
                    "row": r["row_index"],
                    "code": r["code"],
                    "name": r["name"],
                    "category": r["category"].name if r["category"] else "",
                    "brand": r["brand"],
                    "base_unit": r["base_unit"],
                    "cost": str(r["standard_cost"]),
                    "price": str(r["list_price"]),
                    "action": "UPDATE" if r["is_update"] else "CREATE",
                }
                for r in validated_rows[:20]
            ],
            "_validated_data": validated_rows,
        }

    @classmethod
    def parse_and_validate(cls, file_obj, filename: str = "items.csv", **kwargs):
        fn = getattr(file_obj, "name", filename) or filename
        rows = cls.parse_rows(file_obj, fn)
        res = cls.validate_and_preview(rows, **kwargs)
        res["valid_rows"] = res["valid_rows_count"]
        res["to_create"] = res["new_count"]
        res["to_update"] = res["update_count"]
        return res

    @classmethod
    def commit_import(
        cls,
        validated_data,
        context_id: str = "default",
        user: str = "system",
    ) -> Dict[str, Any]:
        if hasattr(validated_data, "read"):
            fn = getattr(validated_data, "name", "items.csv") or "items.csv"
            res = cls.parse_and_validate(validated_data, fn, context_id=context_id)
            if res.get("_validated_data"):
                return cls.commit_import(res["_validated_data"], context_id=context_id, user=user)
            return {"created_count": 0, "updated_count": 0, "errors": res.get("errors", [])}
        """Atomically creates and updates items."""
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for row in validated_data:
                code = row["code"]
                item = InventoryItem.objects.filter(context_id=context_id, code=code).first()

                if item:
                    item.name = row["name"]
                    item.display_name = row["display_name"]
                    item.short_description = row["short_description"]
                    item.item_type = row["item_type"]
                    item.category = row["category"]
                    item.brand = row["brand"]
                    item.brand_ref = row["brand_ref"]
                    item.base_unit = row["base_unit"]
                    item.base_uom = row["base_uom"]
                    item.purchase_uom = row["purchase_uom"]
                    item.sales_uom = row["sales_uom"]
                    item.standard_cost = row["standard_cost"]
                    item.list_price = row["list_price"]
                    item.reorder_point = row["reorder_point"]
                    item.reorder_quantity = row["reorder_quantity"]
                    item.tracking = row["tracking"]
                    item.updated_by = user
                    if row["barcode"]:
                        item.barcode = row["barcode"]
                    item.save()
                    updated_count += 1
                else:
                    item = InventoryItem.objects.create(
                        context_id=context_id,
                        code=code,
                        name=row["name"],
                        display_name=row["display_name"],
                        short_description=row["short_description"],
                        item_type=row["item_type"],
                        category=row["category"],
                        brand=row["brand"],
                        brand_ref=row["brand_ref"],
                        base_unit=row["base_unit"],
                        base_uom=row["base_uom"],
                        purchase_uom=row["purchase_uom"],
                        sales_uom=row["sales_uom"],
                        standard_cost=row["standard_cost"],
                        list_price=row["list_price"],
                        reorder_point=row["reorder_point"],
                        reorder_quantity=row["reorder_quantity"],
                        barcode=row["barcode"],
                        tracking=row["tracking"],
                        created_by=user,
                        updated_by=user,
                    )
                    created_count += 1

                # If barcode supplied, register in ProductBarcode table if not already present
                if row["barcode"]:
                    ProductBarcode.objects.get_or_create(
                        barcode_value=row["barcode"],
                        defaults={
                            "item": item,
                            "barcode_type": ProductBarcode.BarcodeType.PRIMARY,
                            "symbology": ProductBarcode.Symbology.EAN13 if len(row["barcode"]) == 13 else ProductBarcode.Symbology.CODE128,
                            "is_primary": True,
                            "is_active": True,
                        },
                    )

        batch_id = ""
        try:
            from apps.products.models import ProductImportHistory
            rec = ProductImportHistory.objects.create(
                file_name="bulk_product_import.csv",
                total_rows=created_count + updated_count,
                created_count=created_count,
                updated_count=updated_count,
                failed_count=0,
                status=ProductImportHistory.ImportStatus.COMPLETED,
                imported_by=user,
            )
            batch_id = str(rec.batch_id)
        except Exception:
            pass

        return {
            "status": "success",
            "batch_id": batch_id,
            "message": f"Successfully processed {created_count + updated_count} items ({created_count} created, {updated_count} updated).",
            "created_count": created_count,
            "updated_count": updated_count,
        }

    @classmethod
    def export_catalog(cls, queryset, format: str = "csv") -> Tuple[bytes, str, str]:
        headers = [
            "Item Code",
            "Item Name",
            "Display Name",
            "Item Type",
            "Category Code",
            "Category Name",
            "Brand",
            "Base UOM",
            "Purchase UOM",
            "Sales UOM",
            "Standard Cost",
            "List Price",
            "Reorder Point",
            "Reorder Quantity",
            "Barcode",
            "Status",
            "Tracking",
            "Has Variants",
        ]

        rows = []
        for item in queryset.select_related("category", "brand_ref", "base_uom", "purchase_uom", "sales_uom"):
            rows.append([
                item.code,
                item.name,
                item.display_name or item.name,
                item.item_type,
                item.category.code if item.category else "",
                item.category.name if item.category else "",
                item.brand or (item.brand_ref.name if item.brand_ref else ""),
                item.base_unit or (item.base_uom.code if item.base_uom else "EA"),
                item.purchase_uom.code if item.purchase_uom else "",
                item.sales_uom.code if item.sales_uom else "",
                str(item.standard_cost),
                str(item.list_price),
                str(item.reorder_point),
                str(item.reorder_quantity),
                item.barcode,
                item.status,
                item.tracking,
                "YES" if item.has_variants else "NO",
            ])

        if format.lower() in ["xlsx", "excel"]:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Item Catalog"
            ws.append(headers)
            for r in rows:
                ws.append(r)
            for cell in ws[1]:
                cell.font = openpyxl.styles.Font(bold=True)
                cell.fill = openpyxl.styles.PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
            buf = io.BytesIO()
            wb.save(buf)
            return buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "items_catalog_export.xlsx"
        else:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(headers)
            for r in rows:
                writer.writerow(r)
            return output.getvalue().encode("utf-8"), "text/csv; charset=utf-8", "items_catalog_export.csv"
