# Future Cross-Module Integration ERD

This diagram illustrates the decoupling between the **Current Production Inventory Engine** and the **Future Purchase & Sales Modules**. Integration occurs strictly through standardized contract interfaces and transactional events.

```mermaid
erDiagram
    PURCHASE_ORDERS ||--o{ PURCHASE_RECEIPTS : "generates"
    PURCHASE_RECEIPTS }o--|| INV_TRANSACTIONS : "maps to Inbound RECEIPT"
    
    SALES_ORDERS ||--o{ SALES_PICK_PACK : "fulfills"
    SALES_ORDERS }o--|| INV_RESERVATIONS : "locks stock hold"
    SALES_PICK_PACK }o--|| INV_TRANSACTIONS : "maps to Outbound ISSUE"

    INV_TRANSACTIONS ||--o{ INV_BALANCES : "mutates with lock"
    INV_TRANSACTIONS ||--o{ INV_LEDGER : "appends immutable entry"

    PURCHASE_ORDERS {
        string po_number PK
        string vendor_id
        string currency
        string status
    }

    PURCHASE_RECEIPTS {
        string receipt_number PK
        string po_number FK
        decimal received_qty
        decimal landed_unit_cost
    }

    SALES_ORDERS {
        string so_number PK
        string customer_id
        string status
    }

    INV_RESERVATIONS {
        uuid id PK
        string reference_doc
        uuid item_id
        uuid warehouse_id
        decimal quantity
        string status
    }

    INV_TRANSACTIONS {
        uuid id PK
        string document_number UK
        string transaction_type
        uuid warehouse_id
        string status
    }
```
