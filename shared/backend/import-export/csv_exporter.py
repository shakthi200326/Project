"""
Shared Streaming CSV / Excel Importer & Exporter
Efficient streaming processing for large dataset exports (stock balances, ledger).
"""
import csv
import io
from typing import List, Dict, Any, Generator


class CSVStreamExporter:
    @staticmethod
    def export_to_string(headers: List[str], rows: List[List[Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
        return output.getvalue()
