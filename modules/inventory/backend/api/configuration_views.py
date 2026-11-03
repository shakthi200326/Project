from rest_framework import serializers, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.configuration.models import (
    InventoryConfiguration,
    DocumentNumberingRule,
    ConfigurationAuditLog,
)
from apps.warehouses.models import Warehouse


class InventoryConfigurationSerializer(serializers.ModelSerializer):
    default_warehouse_name = serializers.CharField(source="default_warehouse.name", read_only=True, default="")
    default_warehouse_code = serializers.CharField(source="default_warehouse.code", read_only=True, default="")

    class Meta:
        model = InventoryConfiguration
        fields = "__all__"


class DocumentNumberingRuleSerializer(serializers.ModelSerializer):
    example_number = serializers.SerializerMethodField()

    class Meta:
        model = DocumentNumberingRule
        fields = "__all__"

    def get_example_number(self, obj):
        seq = str(obj.current_number or obj.starting_number or 1).zfill(obj.number_length or 5)
        return f"{obj.prefix}-{seq}"


class ConfigurationAuditLogSerializer(serializers.ModelSerializer):
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = ConfigurationAuditLog
        fields = "__all__"

    def get_formatted_date(self, obj):
        return obj.timestamp.strftime("%Y-%m-%d %H:%M:%S")


class InventoryConfigurationView(APIView):
    """
    Endpoints to read and update Inventory Configuration across:
    1. General Settings
    2. Stock Settings
    3. Product Tracking Settings
    4. Valuation Settings
    6. Approval Settings
    """
    def get(self, request):
        config = InventoryConfiguration.get_solo()
        serializer = InventoryConfigurationSerializer(config)
        return Response(serializer.data)

    def put(self, request):
        return self.update_config(request, partial=False)

    def patch(self, request):
        return self.update_config(request, partial=True)

    def update_config(self, request, partial=True):
        config = InventoryConfiguration.get_solo()
        prev_data = InventoryConfigurationSerializer(config).data
        serializer = InventoryConfigurationSerializer(config, data=request.data, partial=partial)
        if serializer.is_valid():
            new_instance = serializer.save()
            new_data = serializer.data

            # Detect section changed & log to ConfigurationAuditLog (Rule 6)
            changes = {}
            for k, v in request.data.items():
                if k in prev_data and str(prev_data[k]) != str(v):
                    changes[k] = {"previous": prev_data[k], "new": v}

            if changes:
                section_name = request.data.get("_section", "General Settings")
                changed_by = request.data.get("changed_by", "Operations Admin")
                ConfigurationAuditLog.objects.create(
                    section=section_name,
                    action="UPDATE",
                    changed_by=changed_by,
                    previous_values={k: v["previous"] for k, v in changes.items()},
                    new_values={k: v["new"] for k, v in changes.items()},
                )

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DocumentNumberingViewSet(viewsets.ModelViewSet):
    """
    5. Document Numbering Management
    """
    queryset = DocumentNumberingRule.objects.all()
    serializer_class = DocumentNumberingRuleSerializer

    def get_queryset(self):
        # Auto-seed default rules if none exist
        if not DocumentNumberingRule.objects.exists():
            default_rules = [
                ("Warehouse", "WH", 1, 4, "Never"),
                ("Storage Location", "LOC", 1, 4, "Never"),
                ("Rack", "RACK", 1, 4, "Never"),
                ("Bin", "BIN", 1, 4, "Never"),
                ("Goods Receipt", "GRN", 1, 5, "Never"),
                ("Stock Issue", "ISS", 1, 5, "Never"),
                ("Stock Transfer", "TRF", 1, 5, "Never"),
                ("Stock Adjustment", "ADJ", 1, 5, "Never"),
                ("Stock Return", "RET", 1, 5, "Never"),
                ("Stock Reservation", "RES", 1, 5, "Never"),
                ("Stock Reconciliation", "REC", 1, 5, "Never"),
            ]
            for doc, pfx, start, length, freq in default_rules:
                DocumentNumberingRule.objects.get_or_create(
                    document_type=doc,
                    defaults={
                        "prefix": pfx,
                        "starting_number": start,
                        "current_number": start,
                        "number_length": length,
                        "reset_frequency": freq,
                    }
                )
        return DocumentNumberingRule.objects.all()

    @action(detail=False, methods=["get", "post"], url_path="generate-next")
    def generate_next(self, request):
        doc_type = request.query_params.get("document_type") or request.data.get("document_type", "Goods Receipt")
        number = DocumentNumberingRule.generate_next_number(doc_type)
        return Response({"document_type": doc_type, "generated_number": number})


class ConfigurationAuditLogListView(APIView):
    def get(self, request):
        logs = ConfigurationAuditLog.objects.all()[:100]
        serializer = ConfigurationAuditLogSerializer(logs, many=True)
        return Response({"count": len(logs), "results": serializer.data})
