# Inventory Management Module Design Specification

## 1. Domain Model Hierarchy

```
[InventoryCategory] ◄── [InventoryItem] ◄── [InventoryItemVariant]
                             │
                             ├──── [InventoryBatch]
                             ├──── [InventorySerial]
                             ├──── [InventoryReorderRule]
                             └──── [InventoryValuation]

[Warehouse] ◄── [StorageLocation]
       │                 │
       ▼                 ▼
[StockBalance] ◄── [StockTransactionLine] ──► [StockTransaction]
       │                                              │
       ▼                                              ▼
[StockLedgerEntry] (Immutable)               [StockReservation]
                                             [StockCount] (Reconciliation)
```

## 2. Core Stock Invariant

$$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock} - \text{Blocked Stock}$$

- **On-Hand Stock**: Physical count currently within the warehouse/location.
- **Reserved Stock**: Stock committed to unfulfilled sales orders, internal requisitions, or transfers.
- **Blocked Stock**: Stock in quarantine, pending quality control, or marked as damaged.
- **Available Stock**: Stock immediately free for reservation or dispatch. Must never drop below zero.

## 3. Valuation Engine: Moving Weighted Average (WAV)

For every inbound receipt of quantity $q$ with unit cost $c$:
$$\text{New WAV} = \frac{(Q_{\text{prior}} \times WAV_{\text{prior}}) + (q \times c)}{Q_{\text{prior}} + q}$$
- If prior on-hand quantity is $\le 0$, the receipt cost becomes the new WAV.
- Outbound transactions (issues, scrap write-offs) are costed at the current WAV, retaining total inventory value consistency.

## 4. Concurrency & Posting Safety

All inventory postings strictly execute under `django.db.transaction.atomic()` with row-level locks:
```python
balances = StockBalance.objects.select_for_update().filter(
    item_id=item_id, warehouse_id=warehouse_id, location_id=location_id
)
```
Balances are locked in primary key order to eliminate deadlock risks.
All postings generate an immutable, write-only `StockLedgerEntry` record. Reversals create compensating entries with opposite signs.
