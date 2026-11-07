import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  RotateCcw,
  Save,
  AlertCircle,
  Building2,
  MapPin,
  Calendar,
  Hash,
  DollarSign,
  FileText,
  Sparkles,
  CheckCircle2,
  Package,
  Send,
  Truck,
  CheckCheck,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import {
  postStockTransaction,
  fetchProducts,
  fetchWarehouses,
  fetchLocations,
  fetchUnits,
  playScanBeep,
} from "../services/api";

const SUPPLIER_PRESETS = [
  "Acme Industrial Supplies",
  "Apex Motion Bearings Ltd",
  "Global Dynamics Logistics",
  "Titan Precision Tech",
  "Continental Fluid Systems",
];

const PARTY_PRESETS = [
  "Apex Global Logistics",
  "Midwest Machinery Works",
  "Pacific Rail & Industrial",
  "Northstar Distribution Co",
  "Precision Automation Corp",
];

const ISSUE_TYPES = ["Sales", "Production", "Internal Consumption", "Other"];
const ADJUSTMENT_TYPES = ["Increase", "Decrease"];
const ADJUSTMENT_REASONS = [
  "Physical Count Difference",
  "Damage",
  "Loss",
  "Found Stock",
  "Data Correction",
  "Other",
];
const RETURN_TYPES = ["Customer Return", "Supplier Return"];
const PRODUCT_CONDITIONS = ["Good", "Damaged", "Defective"];
const RETURN_DISPOSITIONS = [
  "Restock",
  "Quarantine",
  "Repair",
  "Scrap",
  "Return to Supplier",
];

function getProductUnit(product, units) {
  const productUnit = product?.unit || product?.base_unit;
  const matchingUnit = units.find(
    (unit) => unit.code?.toLowerCase() === productUnit?.toLowerCase()
  );
  return matchingUnit?.code || units[0]?.code || "";
}

function generateDocNumber(type) {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  switch (type) {
    case "RECEIPT":
      return `GRN-${year}-${rand}`;
    case "ISSUE":
      return `ISS-${year}-${rand}`;
    case "TRANSFER":
      return `TRF-${year}-${rand}`;
    case "ADJUSTMENT":
      return `ADJ-${year}-${rand}`;
    case "RETURN":
      return `RET-${year}-${rand}`;
    default:
      return `INV-${year}-${rand}`;
  }
}

export function StockTransactionModal({
  isOpen,
  initialType = "RECEIPT",
  onClose,
  onPosted,
}) {
  const [txType, setTxType] = useState(initialType);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [verifiedProduct, setVerifiedProduct] = useState(null);

  // Form states per operation
  const [docNumber, setDocNumber] = useState(generateDocNumber(initialType));
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplier, setSupplier] = useState(SUPPLIER_PRESETS[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  const [destWarehouse, setDestWarehouse] = useState("");
  const [destLocation, setDestLocation] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState(14.85);
  const [batchNumber, setBatchNumber] = useState("BATCH-2026-X1");
  const [expiryDate, setExpiryDate] = useState("2027-12-31");
  const [serialNumber, setSerialNumber] = useState("SN-2026-001");
  const emptyIssueLine = () => ({
    key: `${Date.now()}-${Math.random()}`,
    product_id: "",
    variant_id: "",
    quantity: "",
    unit: "",
    available: 0,
    batch_number: "",
    serial_numbers: [],
  });
  const [issueLines, setIssueLines] = useState([emptyIssueLine()]);
  const emptyAdjustmentLine = () => ({
    key: `${Date.now()}-${Math.random()}`,
    product_id: "",
    variant_id: "",
    unit: "",
    system_quantity: 0,
    actual_quantity: "",
    difference_quantity: 0,
    batch_number: "",
    serial_numbers: [],
  });
  const [adjustmentLines, setAdjustmentLines] = useState([emptyAdjustmentLine()]);
  const emptyReturnLine = () => ({
    key: `${Date.now()}-${Math.random()}`,
    product_id: "",
    variant_id: "",
    quantity: "",
    unit: "",
    available: 0,
    batch_number: "",
    serial_numbers: [],
  });
  const [returnLines, setReturnLines] = useState([emptyReturnLine()]);
  const [issueType, setIssueType] = useState("Production");
  const [issuedTo, setIssuedTo] = useState("Assembly Line 1");
  const [adjustmentType, setAdjustmentType] = useState("Increase");
  const [systemQuantity, setSystemQuantity] = useState(50);
  const [actualQuantity, setActualQuantity] = useState(50);
  const [adjustmentReason, setAdjustmentReason] = useState(ADJUSTMENT_REASONS[0]);
  const [returnType, setReturnType] = useState(RETURN_TYPES[0]);
  const [partyName, setPartyName] = useState(PARTY_PRESETS[0]);
  const [productCondition, setProductCondition] = useState(PRODUCT_CONDITIONS[0]);
  const [returnDisposition, setReturnDisposition] = useState(RETURN_DISPOSITIONS[0]);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Sync operation type when the initialType prop changes.
  useEffect(() => {
    if (initialType) {
      setTxType(initialType);
      setDocNumber(generateDocNumber(initialType));
    }
  }, [initialType]);

  useEffect(() => {
    if (isOpen && initialType === "ISSUE" && issueLines.length === 0) {
      setIssueLines([emptyIssueLine()]);
    }
  }, [isOpen, initialType]);

  // Load master data
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [prodRes, whRes, locRes, unitRes] = await Promise.all([
          fetchProducts(),
          fetchWarehouses(),
          fetchLocations(),
          fetchUnits(),
        ]);
        const prodList = prodRes.results || prodRes || [];
        const whList = Array.isArray(whRes) ? whRes : whRes.results || [];
        const locList = Array.isArray(locRes) ? locRes : locRes.results || [];
        const unitList = Array.isArray(unitRes) ? unitRes : unitRes.results || [];

        setProducts(prodList);
        setWarehouses(whList);
        setLocations(locList);
        setUnits(unitList);

        if (whList.length > 0 && !warehouse) {
          setWarehouse(whList[0].code || whList[0].name);
          if (whList.length > 1) {
            setDestWarehouse(whList[1].code || whList[1].name);
          } else {
            setDestWarehouse(whList[0].code || whList[0].name);
          }
        }

        if (prodList.length > 0 && !selectedSku) {
          const initProd = prodList[0];
          setSelectedSku(initProd.sku || initProd.code);
          setVerifiedProduct(initProd);
          setSelectedUnit(getProductUnit(initProd, unitList));
          setUnitCost(initProd.unit_cost !== undefined ? Number(initProd.unit_cost) : 14.85);
          const avail = initProd.available ?? initProd.on_hand ?? 50;
          setSystemQuantity(avail);
          setActualQuantity(avail);
        }
      } catch (e) {
        console.error("Failed to load master data", e);
      }
    }
    loadMasterData();
  }, []);

  // Filter locations for selected warehouse
  const availableLocations = useMemo(() => {
    if (!locations.length) return [];
    const matched = locations.filter(
      (l) =>
        !warehouse ||
        l.warehouse === warehouse ||
        l.warehouse_code === warehouse ||
        l.warehouse_name === warehouse
    );
    return matched.length > 0 ? matched : locations;
  }, [locations, warehouse]);

  const availableDestLocations = useMemo(() => {
    if (!locations.length) return [];
    const matched = locations.filter(
      (l) =>
        !destWarehouse ||
        l.warehouse === destWarehouse ||
        l.warehouse_code === destWarehouse ||
        l.warehouse_name === destWarehouse
    );
    return matched.length > 0 ? matched : locations;
  }, [locations, destWarehouse]);

  // Auto-set initial location when warehouse changes
  useEffect(() => {
    if (availableLocations.length > 0 && (!location || !availableLocations.some(l => (l.code || l.name) === location))) {
      setLocation(availableLocations[0].code || availableLocations[0].name);
    }
  }, [availableLocations, location]);

  useEffect(() => {
    if (availableDestLocations.length > 0 && (!destLocation || !availableDestLocations.some(l => (l.code || l.name) === destLocation))) {
      setDestLocation(availableDestLocations[0].code || availableDestLocations[0].name);
    }
  }, [availableDestLocations, destLocation]);

  if (!isOpen) return null;

  const handleApplyProduct = (product) => {
    if (!product) return;
    playScanBeep();
    setVerifiedProduct(product);
    setSelectedSku(product.sku || product.code);
    setSelectedUnit(getProductUnit(product, units));
    setUnitCost(product.unit_cost !== undefined ? Number(product.unit_cost) : 14.85);
    const avail = product.available ?? product.on_hand ?? 50;
    setSystemQuantity(avail);
    setActualQuantity(avail);
    setError("");
  };

  const handleProductSelect = (sku) => {
    setSelectedSku(sku);
    const found = products.find((p) => (p.sku || p.code) === sku);
    if (found) {
      handleApplyProduct(found);
    }
  };

  const updateIssueLine = (key, patch) => {
    setIssueLines((lines) =>
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const selectIssueProduct = (key, productId) => {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      updateIssueLine(key, { product_id: "", variant_id: "", quantity: "", unit: "", available: 0 });
      return;
    }
    updateIssueLine(key, {
      product_id: String(product.id),
      variant_id: "",
      quantity: "",
      unit: product.unit || product.base_uom || "EA",
      available: Number(product.available ?? product.on_hand ?? 0),
    });
  };

  const selectIssueVariant = (key, variantId) => {
    const line = issueLines.find((item) => item.key === key);
    const product = products.find((item) => String(item.id) === String(line?.product_id));
    const variant = product?.variants?.find((item) => String(item.id) === String(variantId));
    updateIssueLine(key, {
      variant_id: variantId,
      unit: variant?.base_uom || variant?.uom || product?.base_uom || product?.unit || "EA",
      available: Number(variant?.available ?? variant?.on_hand ?? product?.available ?? product?.on_hand ?? 0),
    });
  };

  const updateAdjustmentLine = (key, patch) => {
    setAdjustmentLines((lines) =>
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const selectAdjustmentProduct = (key, productId) => {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      updateAdjustmentLine(key, {
        product_id: "",
        variant_id: "",
        unit: "",
        system_quantity: 0,
        actual_quantity: "",
        difference_quantity: 0,
      });
      return;
    }
    const systemQuantityForProduct = Number(product.available ?? product.on_hand ?? 0);
    updateAdjustmentLine(key, {
      product_id: String(product.id),
      variant_id: "",
      unit: product.unit || product.base_uom || "EA",
      system_quantity: systemQuantityForProduct,
      actual_quantity: systemQuantityForProduct,
      difference_quantity: 0,
    });
  };

  const selectAdjustmentVariant = (key, variantId) => {
    const line = adjustmentLines.find((item) => item.key === key);
    const product = products.find((item) => String(item.id) === String(line?.product_id));
    const variant = product?.variants?.find((item) => String(item.id) === String(variantId));
    const systemQuantityForVariant = Number(
      variant?.available ?? variant?.on_hand ?? product?.available ?? product?.on_hand ?? 0
    );
    updateAdjustmentLine(key, {
      variant_id: variantId,
      unit: variant?.base_uom || variant?.uom || product?.base_uom || product?.unit || "EA",
      system_quantity: systemQuantityForVariant,
      actual_quantity: systemQuantityForVariant,
      difference_quantity: 0,
    });
  };

  const updateReturnLine = (key, patch) => {
    setReturnLines((lines) =>
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const selectReturnProduct = (key, productId) => {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      updateReturnLine(key, {
        product_id: "",
        variant_id: "",
        quantity: "",
        unit: "",
        available: 0,
      });
      return;
    }
    updateReturnLine(key, {
      product_id: String(product.id),
      variant_id: "",
      quantity: "",
      unit: product.unit || product.base_uom || "EA",
      available: Number(product.available ?? product.on_hand ?? 0),
    });
  };

  const selectReturnVariant = (key, variantId) => {
    const line = returnLines.find((item) => item.key === key);
    const product = products.find((item) => String(item.id) === String(line?.product_id));
    const variant = product?.variants?.find((item) => String(item.id) === String(variantId));
    updateReturnLine(key, {
      variant_id: variantId,
      unit: variant?.base_uom || variant?.uom || product?.base_uom || product?.unit || "EA",
      available: Number(variant?.available ?? variant?.on_hand ?? product?.available ?? product?.on_hand ?? 0),
    });
  };

  // Stock Adjustment calculation
  const differenceQuantity = Number(actualQuantity) - Number(systemQuantity);

  const handleActualQuantityChange = (val) => {
    const num = Number(val);
    setActualQuantity(num);
    const diff = num - Number(systemQuantity);
    if (diff > 0) {
      setAdjustmentType("Increase");
    } else if (diff < 0) {
      setAdjustmentType("Decrease");
    }
  };

  const isBatchTracked = verifiedProduct?.tracking === "BATCH" || verifiedProduct?.tracking === "Batch / Lot";
  const isSerialTracked = verifiedProduct?.tracking === "SERIAL" || verifiedProduct?.tracking === "Serial";
  const handleAction = async (actionType) => {
    setError("");

    // Required field validation per operation
    if (!docNumber.trim()) {
      setError("Document number is required.");
      return;
    }
    if (!txDate) {
      setError("Transaction date is required.");
      return;
    }
    if (!warehouse) {
      setError("Warehouse is required.");
      return;
    }
    if (!location) {
      setError("Storage location is required.");
      return;
    }
    if (!["ISSUE", "ADJUSTMENT", "RETURN"].includes(txType) && !selectedSku) {
      setError("Product is required.");
      return;
    }

    if (txType === "RECEIPT") {
      if (!quantity || Number(quantity) <= 0) {
        setError("Received Quantity must be greater than zero.");
        return;
      }
      if (isBatchTracked && !batchNumber.trim()) {
        setError("Batch Number is required for this product.");
        return;
      }
    } else if (txType === "ISSUE") {
      if (!reason.trim()) {
        setError("Reason is required for Stock Issue.");
        return;
      }
      if (issueLines.length === 0) {
        setError("Add at least one product to the Stock Issue.");
        return;
      }
      const seenIssueProducts = new Set();
      for (let index = 0; index < issueLines.length; index++) {
        const line = issueLines[index];
        const product = products.find((item) => String(item.id) === String(line.product_id));
        if (!product) {
          setError(`Line ${index + 1}: Product is required.`);
          return;
        }
        if (product.variants?.length && !line.variant_id) {
          setError(`Line ${index + 1}: Variant is required.`);
          return;
        }
        const productKey = `${line.product_id}:${line.variant_id || "base"}`;
        if (seenIssueProducts.has(productKey)) {
          setError(`Line ${index + 1}: Duplicate product/variant is not allowed.`);
          return;
        }
        seenIssueProducts.add(productKey);
        if (!Number(line.quantity) || Number(line.quantity) <= 0) {
          setError(`Line ${index + 1}: Issue Quantity must be greater than zero.`);
          return;
        }
        if (Number(line.quantity) > Number(line.available || 0)) {
          setError(`Line ${index + 1}: Issue Quantity exceeds available stock (${line.available}).`);
          return;
        }
        const tracking = product.tracking;
        if ((tracking === "BATCH" || tracking === "Batch / Lot") && !line.batch_number.trim()) {
          setError(`Line ${index + 1}: Batch Number is required.`);
          return;
        }
        if ((tracking === "SERIAL" || tracking === "Serial") && (!line.serial_numbers || line.serial_numbers.length !== Number(line.quantity))) {
          setError(`Line ${index + 1}: Enter one serial number for each issued quantity.`);
          return;
        }
      }
    } else if (txType === "TRANSFER") {
      if (!destWarehouse) {
        setError("Destination Warehouse is required.");
        return;
      }
      if (!destLocation) {
        setError("Destination Location is required.");
        return;
      }
      if (!quantity || Number(quantity) <= 0) {
        setError("Transfer Quantity must be greater than zero.");
        return;
      }
      if (isBatchTracked && !batchNumber.trim()) {
        setError("Batch Number is required for this product.");
        return;
      }
      if (isSerialTracked && !serialNumber.trim()) {
        setError("Serial Number is required for this product.");
        return;
      }
    } else if (txType === "ADJUSTMENT") {
      if (!adjustmentLines.length) {
        setError("Add at least one product to the Stock Adjustment.");
        return;
      }
      if (!adjustmentReason) {
        setError("Adjustment Reason is required.");
        return;
      }
      const seenAdjustmentProducts = new Set();
      for (let index = 0; index < adjustmentLines.length; index++) {
        const line = adjustmentLines[index];
        const product = products.find((item) => String(item.id) === String(line.product_id));
        if (!product) {
          setError(`Line ${index + 1}: Product is required.`);
          return;
        }
        if (product.variants?.length && !line.variant_id) {
          setError(`Line ${index + 1}: Variant is required.`);
          return;
        }
        const productKey = `${line.product_id}:${line.variant_id || "base"}`;
        if (seenAdjustmentProducts.has(productKey)) {
          setError(`Line ${index + 1}: Duplicate product/variant is not allowed.`);
          return;
        }
        seenAdjustmentProducts.add(productKey);
        if (line.actual_quantity === "" || isNaN(Number(line.actual_quantity)) || Number(line.actual_quantity) < 0) {
          setError(`Line ${index + 1}: Valid Actual Quantity is required.`);
          return;
        }
        const tracking = product.tracking;
        if ((tracking === "BATCH" || tracking === "Batch / Lot") && !line.batch_number.trim()) {
          setError(`Line ${index + 1}: Batch Number is required.`);
          return;
        }
        if (
          (tracking === "SERIAL" || tracking === "Serial") &&
          (!line.serial_numbers || line.serial_numbers.length !== Number(line.actual_quantity))
        ) {
          setError(`Line ${index + 1}: Enter one serial number for each actual quantity.`);
          return;
        }
      }
    } else if (txType === "RETURN") {
      if (!partyName.trim()) {
        setError("Party Name is required for Stock Return.");
        return;
      }
      if (!returnLines.length) {
        setError("Add at least one product to the Stock Return.");
        return;
      }
      const seenReturnProducts = new Set();
      for (let index = 0; index < returnLines.length; index++) {
        const line = returnLines[index];
        const product = products.find((item) => String(item.id) === String(line.product_id));
        if (!product) {
          setError(`Line ${index + 1}: Product is required.`);
          return;
        }
        if (product.variants?.length && !line.variant_id) {
          setError(`Line ${index + 1}: Variant is required.`);
          return;
        }
        const productKey = `${line.product_id}:${line.variant_id || "base"}`;
        if (seenReturnProducts.has(productKey)) {
          setError(`Line ${index + 1}: Duplicate product/variant is not allowed.`);
          return;
        }
        seenReturnProducts.add(productKey);
        if (!Number(line.quantity) || Number(line.quantity) <= 0) {
          setError(`Line ${index + 1}: Return Quantity must be greater than zero.`);
          return;
        }
        const tracking = product.tracking;
        if ((tracking === "BATCH" || tracking === "Batch / Lot") && !line.batch_number.trim()) {
          setError(`Line ${index + 1}: Batch Number is required.`);
          return;
        }
        if (
          (tracking === "SERIAL" || tracking === "Serial") &&
          (!line.serial_numbers || line.serial_numbers.length !== Number(line.quantity))
        ) {
          setError(`Line ${index + 1}: Enter one serial number for each returned quantity.`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      // Find IDs if available
      const whObj = warehouses.find((w) => (w.code || w.name) === warehouse);
      const destWhObj = warehouses.find((w) => (w.code || w.name) === destWarehouse);
      const locObj = locations.find((l) => (l.code || l.name) === location);
      const destLocObj = locations.find((l) => (l.code || l.name) === destLocation);

      const payload = {
        document_number: docNumber,
        type: txType,
        transaction_type: txType,
        transaction_date: txDate,
        warehouse: warehouse,
        warehouse_id: whObj?.id || 1,
        warehouse_name: whObj?.name || warehouse,
        location: location,
        location_id: locObj?.id || null,
        location_name: locObj?.name || location,
        destination_warehouse: destWarehouse,
        destination_warehouse_id: destWhObj?.id || null,
        destination_warehouse_name: destWhObj?.name || destWarehouse,
        destination_location: destLocation,
        destination_location_id: destLocObj?.id || null,
        destination_location_name: destLocObj?.name || destLocation,
        item: verifiedProduct?.name || selectedSku,
        itemSku: selectedSku,
        item_code: selectedSku,
        item_id: verifiedProduct?.id || 1,
        quantity: txType === "ADJUSTMENT" ? Math.abs(differenceQuantity) : Number(quantity),
        unit: selectedUnit,
        unit_cost: Number(unitCost) || 0,
        lines: txType === "ISSUE"
          ? issueLines.map((line) => ({
              item_id: Number(line.product_id),
              item: Number(line.product_id),
              variant_id: line.variant_id ? Number(line.variant_id) : null,
              variant: line.variant_id ? Number(line.variant_id) : null,
              location_id: locObj?.id || null,
              location: locObj?.id || null,
              quantity: Number(line.quantity),
              unit: line.unit,
              batch_number: line.batch_number || "",
              serial_numbers: line.serial_numbers || [],
              unit_cost: 0,
            }))
          : txType === "ADJUSTMENT"
            ? adjustmentLines.map((line) => {
                const difference = Number(line.actual_quantity) - Number(line.system_quantity);
                return {
                  item_id: Number(line.product_id),
                  item: Number(line.product_id),
                  variant_id: line.variant_id ? Number(line.variant_id) : null,
                  variant: line.variant_id ? Number(line.variant_id) : null,
                  location_id: locObj?.id || null,
                  location: locObj?.id || null,
                  quantity: Math.abs(difference),
                  unit: line.unit,
                  batch_number: line.batch_number || "",
                  serial_numbers: line.serial_numbers || [],
                  unit_cost: 0,
                  system_quantity: Number(line.system_quantity),
                  actual_quantity: Number(line.actual_quantity),
                  difference_quantity: difference,
                };
              })
            : txType === "RETURN"
              ? returnLines.map((line) => ({
                  item_id: Number(line.product_id),
                  item: Number(line.product_id),
                  variant_id: line.variant_id ? Number(line.variant_id) : null,
                  variant: line.variant_id ? Number(line.variant_id) : null,
                  location_id: locObj?.id || null,
                  location: locObj?.id || null,
                  quantity: Number(line.quantity),
                  unit: line.unit,
                  batch_number: line.batch_number || "",
                  serial_numbers: line.serial_numbers || [],
                  unit_cost: 0,
                }))
            : undefined,
        supplier: txType === "RECEIPT" ? supplier : "",
        reference_number: referenceNumber,
        issue_type: txType === "ISSUE" ? issueType : "",
        issued_to: txType === "ISSUE" ? issuedTo : "",
        party_name: txType === "RETURN" ? partyName : "",
        return_type: txType === "RETURN" ? returnType : "",
        product_condition: txType === "RETURN" ? productCondition : "",
        return_disposition: txType === "RETURN" ? returnDisposition : "",
        adjustment_type: txType === "ADJUSTMENT" ? adjustmentType : "",
        reason: txType === "ADJUSTMENT" ? adjustmentReason : (txType === "ISSUE" ? reason : remarks),
        system_quantity: Number(systemQuantity),
        actual_quantity: Number(actualQuantity),
        difference_quantity: Number(differenceQuantity),
        batch_number: isBatchTracked ? batchNumber : "",
        expiry_date: isBatchTracked ? expiryDate : null,
        serial_number: isSerialTracked ? serialNumber : "",
        remarks: remarks,
        notes: remarks,
      };

      const result = await postStockTransaction(payload, actionType);
      if (onPosted) onPosted(result);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to execute stock transaction. Check server connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white shadow-2xl dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl text-white font-bold shadow-md ${
                txType === "RECEIPT"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
                  : txType === "ISSUE"
                  ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20"
                  : txType === "TRANSFER"
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20"
                  : txType === "ADJUSTMENT"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20"
                  : "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20"
              }`}
            >
              {txType === "RECEIPT" && <ArrowDownLeft className="h-5 w-5" />}
              {txType === "ISSUE" && <ArrowUpRight className="h-5 w-5" />}
              {txType === "TRANSFER" && <ArrowLeftRight className="h-5 w-5" />}
              {txType === "ADJUSTMENT" && <SlidersHorizontal className="h-5 w-5" />}
              {txType === "RETURN" && <RotateCcw className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {txType === "RECEIPT" && "1. Goods Receipt (Stock In)"}
                  {txType === "ISSUE" && "2. Stock Issue (Stock Out)"}
                  {txType === "TRANSFER" && "3. Stock Transfer (Stock Movement)"}
                  {txType === "ADJUSTMENT" && "4. Stock Adjustment (Stock Correction)"}
                  {txType === "RETURN" && "5. Stock Return (Return Movement)"}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {txType === "RECEIPT" && "Record incoming verified stock into a facility storage location."}
                {txType === "ISSUE" && "Remove stock from warehouse for sales, production or internal consumption."}
                {txType === "TRANSFER" && "Move stock across warehouse facilities via dispatch and receiving stages."}
                {txType === "ADJUSTMENT" && "Reconcile system inventory balances with physical audit counts."}
                {txType === "RETURN" && "Record stock returned by customers or returned to suppliers."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 shrink-0 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 text-xs space-y-4">
            {/* Document Header Row: Number & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  {txType === "RECEIPT" && "Receipt Number"}
                  {txType === "ISSUE" && "Issue Number"}
                  {txType === "TRANSFER" && "Transfer Number"}
                  {txType === "ADJUSTMENT" && "Adjustment Number"}
                  {txType === "RETURN" && "Return Number"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={docNumber}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-200 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  {txType === "RECEIPT" && "Receipt Date"}
                  {txType === "ISSUE" && "Issue Date"}
                  {txType === "TRANSFER" && "Transfer Date"}
                  {txType === "ADJUSTMENT" && "Adjustment Date"}
                  {txType === "RETURN" && "Return Date"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  required
                />
              </div>
            </div>

            {/* OPERATION 1: GOODS RECEIPT SPECIFIC FIELDS */}
            {txType === "RECEIPT" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    list="supplier-options"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Select or enter supplier..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs"
                  />
                  <datalist id="supplier-options">
                    {SUPPLIER_PRESETS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. PO-2026-8812"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* OPERATION 2: STOCK ISSUE SPECIFIC FIELDS */}
            {txType === "ISSUE" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Issue Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. WO-9941 / SO-442"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Issued To
                  </label>
                  <input
                    type="text"
                    value={issuedTo}
                    onChange={(e) => setIssuedTo(e.target.value)}
                    placeholder="Dept or Personnel..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs"
                  />
                </div>
              </div>
            )}

            {/* OPERATION 4: STOCK ADJUSTMENT SPECIFIC FIELDS */}
            {txType === "ADJUSTMENT" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Adjustment Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  >
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Reason <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  >
                    {ADJUSTMENT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* OPERATION 5: STOCK RETURN SPECIFIC FIELDS */}
            {txType === "RETURN" && (
              <div className="space-y-3 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      Return Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={returnType}
                      onChange={(e) => setReturnType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    >
                      {RETURN_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. RMA-2026-004"
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      Party Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="party-options"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      placeholder="Customer or Supplier Name..."
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs"
                      required
                    />
                    <datalist id="party-options">
                      {PARTY_PRESETS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-200/60 dark:border-purple-900/40">
                  <div>
                    <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      Product Condition <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={productCondition}
                      onChange={(e) => setProductCondition(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    >
                      {PRODUCT_CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-purple-900 dark:text-purple-200 mb-1">
                      Return Disposition <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={returnDisposition}
                      onChange={(e) => setReturnDisposition(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    >
                      {RETURN_DISPOSITIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Warehouse & Storage Location Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  {txType === "TRANSFER" ? "Source Warehouse" : "Warehouse"} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  required
                >
                  {warehouses.length > 0 ? (
                    warehouses.map((w) => (
                      <option key={w.id || w.code} value={w.code || w.name}>
                        {w.code ? `${w.code} - ${w.name}` : w.name}
                      </option>
                    ))
                  ) : (
                    <option value="WH-MAIN">WH-MAIN - Main Central Fulfillment Hub</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  {txType === "TRANSFER" ? "Source Location" : "Storage Location"} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                  required
                >
                  {availableLocations.length > 0 ? (
                    availableLocations.map((loc) => (
                      <option key={loc.id || loc.code} value={loc.code || loc.name}>
                        {loc.code ? `${loc.code} - ${loc.name} (${loc.location_type || "Storage"})` : loc.name}
                      </option>
                    ))
                  ) : (
                    <option value="Aisle 3 - Rack B">Aisle 3 - Rack B</option>
                  )}
                </select>
              </div>
            </div>

            {/* TRANSFER DESTINATION FIELDS */}
            {txType === "TRANSFER" && (
              <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
                <div>
                  <label className="block font-semibold text-blue-900 dark:text-blue-200 mb-1">
                    Destination Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={destWarehouse}
                    onChange={(e) => setDestWarehouse(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    required
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map((w) => (
                        <option key={w.id || w.code} value={w.code || w.name}>
                          {w.code ? `${w.code} - ${w.name}` : w.name}
                        </option>
                      ))
                    ) : (
                      <option value="WH-DIST">WH-DIST - Distribution Warehouse</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-blue-900 dark:text-blue-200 mb-1">
                    Destination Location <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={destLocation}
                    onChange={(e) => setDestLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    required
                  >
                    {availableDestLocations.length > 0 ? (
                      availableDestLocations.map((loc) => (
                        <option key={loc.id || loc.code} value={loc.code || loc.name}>
                          {loc.code ? `${loc.code} - ${loc.name} (${loc.location_type || "Storage"})` : loc.name}
                        </option>
                      ))
                    ) : (
                      <option value="LOC-DIST-STORE">LOC-DIST-STORE - Storage</option>
                    )}
                  </select>
                </div>
              </div>
            )}

            {/* Product Item & SKU Selection */}
            {txType === "ISSUE" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-zinc-200">Products</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">Add one or more products to this stock issue</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIssueLines((lines) => [...lines, emptyIssueLine()])}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </button>
                </div>

                {issueLines.map((line, index) => {
                  const product = products.find((item) => String(item.id) === String(line.product_id));
                  const variants = product?.variants || [];
                  const variant = variants.find((item) => String(item.id) === String(line.variant_id));
                  const sku = variant?.sku || variant?.code || product?.sku || product?.code || "";
                  const tracking = product?.tracking;
                  const isLineBatch = tracking === "BATCH" || tracking === "Batch / Lot";
                  const isLineSerial = tracking === "SERIAL" || tracking === "Serial";

                  return (
                    <div key={line.key} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Product {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIssueLines((lines) => lines.filter((item) => item.key !== line.key))}
                          disabled={issueLines.length === 1}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Product *</label>
                          <select
                            value={line.product_id}
                            onChange={(e) => selectIssueProduct(line.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                          >
                            <option value="">Select product</option>
                            {products.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                            Variant {variants.length > 0 && "*"}
                          </label>
                          <select
                            value={line.variant_id}
                            onChange={(e) => selectIssueVariant(line.key, e.target.value)}
                            disabled={!product || variants.length === 0}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs disabled:opacity-60"
                          >
                            <option value="">No variant</option>
                            {variants.map((item) => (
                              <option key={item.id} value={item.id}>{item.name || item.code || item.sku}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">SKU</label>
                          <input value={sku} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono" />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Available Quantity</label>
                          <input value={`${line.available || 0}`} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Issue Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            max={line.available || undefined}
                            value={line.quantity}
                            onChange={(e) => updateIssueLine(line.key, { quantity: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">UOM</label>
                          <input value={line.unit || ""} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-semibold" />
                        </div>
                        {isLineBatch && (
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Batch Number *</label>
                            <input
                              value={line.batch_number}
                              onChange={(e) => updateIssueLine(line.key, { batch_number: e.target.value })}
                              placeholder="Batch / lot number"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                            />
                          </div>
                        )}
                        {isLineSerial && (
                          <div className="col-span-2">
                            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Serial Numbers * (comma separated)</label>
                            <input
                              value={(line.serial_numbers || []).join(",")}
                              onChange={(e) => updateIssueLine(line.key, { serial_numbers: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                              placeholder="SN-001, SN-002"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : txType === "ADJUSTMENT" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-zinc-200">Products</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">Add multiple products and enter their counted quantities</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdjustmentLines((lines) => [...lines, emptyAdjustmentLine()])}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </button>
                </div>

                {adjustmentLines.map((line, index) => {
                  const product = products.find((item) => String(item.id) === String(line.product_id));
                  const variants = product?.variants || [];
                  const variant = variants.find((item) => String(item.id) === String(line.variant_id));
                  const sku = variant?.sku || variant?.code || product?.sku || product?.code || "";
                  const difference = Number(line.actual_quantity || 0) - Number(line.system_quantity || 0);
                  const tracking = product?.tracking;
                  const isLineBatch = tracking === "BATCH" || tracking === "Batch / Lot";
                  const isLineSerial = tracking === "SERIAL" || tracking === "Serial";

                  return (
                    <div key={line.key} className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Product {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAdjustmentLines((lines) => lines.filter((item) => item.key !== line.key))}
                          disabled={adjustmentLines.length === 1}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Product *</label>
                          <select
                            value={line.product_id}
                            onChange={(e) => selectAdjustmentProduct(line.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                          >
                            <option value="">Select product</option>
                            {products.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                            Variant {variants.length > 0 && "*"}
                          </label>
                          <select
                            value={line.variant_id}
                            onChange={(e) => selectAdjustmentVariant(line.key, e.target.value)}
                            disabled={!product || variants.length === 0}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs disabled:opacity-60"
                          >
                            <option value="">No variant</option>
                            {variants.map((item) => (
                              <option key={item.id} value={item.id}>{item.name || item.code || item.sku}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">SKU</label>
                          <input value={sku} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono" />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">System Quantity *</label>
                          <input value={line.system_quantity} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Actual Quantity *</label>
                          <input
                            type="number"
                            min="0"
                            value={line.actual_quantity}
                            onChange={(e) => updateAdjustmentLine(line.key, { actual_quantity: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Difference Quantity *</label>
                          <input
                            value={difference > 0 ? `+${difference}` : difference}
                            readOnly
                            className={`w-full px-3 py-2 rounded-xl border font-mono font-bold text-xs ${
                              difference > 0
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : difference < 0
                                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                  : "border-slate-300 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">UOM</label>
                          <input value={line.unit || ""} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-semibold" />
                        </div>
                      </div>

                      {(isLineBatch || isLineSerial) && (
                        <div className="grid grid-cols-4 gap-3">
                          {isLineBatch && (
                            <div>
                              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Batch Number *</label>
                              <input
                                value={line.batch_number}
                                onChange={(e) => updateAdjustmentLine(line.key, { batch_number: e.target.value })}
                                placeholder="Batch / lot number"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                              />
                            </div>
                          )}
                          {isLineSerial && (
                            <div className="col-span-2">
                              <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Serial Numbers * (comma separated)</label>
                              <input
                                value={(line.serial_numbers || []).join(",")}
                                onChange={(e) => updateAdjustmentLine(line.key, { serial_numbers: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                                placeholder="SN-001, SN-002"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : txType === "RETURN" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-zinc-200">Products</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">Add one or more products to this stock return</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReturnLines((lines) => [...lines, emptyReturnLine()])}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </button>
                </div>

                {returnLines.map((line, index) => {
                  const product = products.find((item) => String(item.id) === String(line.product_id));
                  const variants = product?.variants || [];
                  const variant = variants.find((item) => String(item.id) === String(line.variant_id));
                  const sku = variant?.sku || variant?.code || product?.sku || product?.code || "";
                  const tracking = product?.tracking;
                  const isLineBatch = tracking === "BATCH" || tracking === "Batch / Lot";
                  const isLineSerial = tracking === "SERIAL" || tracking === "Serial";

                  return (
                    <div key={line.key} className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          Product {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReturnLines((lines) => lines.filter((item) => item.key !== line.key))}
                          disabled={returnLines.length === 1}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Product *</label>
                          <select
                            value={line.product_id}
                            onChange={(e) => selectReturnProduct(line.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                          >
                            <option value="">Select product</option>
                            {products.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                            Variant {variants.length > 0 && "*"}
                          </label>
                          <select
                            value={line.variant_id}
                            onChange={(e) => selectReturnVariant(line.key, e.target.value)}
                            disabled={!product || variants.length === 0}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs disabled:opacity-60"
                          >
                            <option value="">No variant</option>
                            {variants.map((item) => (
                              <option key={item.id} value={item.id}>{item.name || item.code || item.sku}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">SKU</label>
                          <input value={sku} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono" />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Available Quantity</label>
                          <input value={`${line.available || 0}`} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Return Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateReturnLine(line.key, { quantity: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">UOM</label>
                          <input value={line.unit || ""} readOnly className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-semibold" />
                        </div>
                        {isLineBatch && (
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Batch Number *</label>
                            <input
                              value={line.batch_number}
                              onChange={(e) => updateReturnLine(line.key, { batch_number: e.target.value })}
                              placeholder="Batch / lot number"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                            />
                          </div>
                        )}
                        {isLineSerial && (
                          <div className="col-span-2">
                            <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Serial Numbers * (comma separated)</label>
                            <input
                              value={(line.serial_numbers || []).join(",")}
                              onChange={(e) => updateReturnLine(line.key, { serial_numbers: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                              placeholder="SN-001, SN-002"
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedSku}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs font-medium"
                    required
                  >
                    {products.length > 0 ? (
                      products.map((p) => (
                        <option key={p.id || p.sku} value={p.sku || p.code}>{p.name}</option>
                      ))
                    ) : (
                      <option value="BRG-6205-2RS">Industrial Ball Bearing 6205-2RS</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    SKU (Auto-filled) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={selectedSku}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-200 font-mono font-bold text-xs"
                  />
                </div>
              </div>
            )}

            {/* Quantity Metrics */}
            {txType === "ISSUE" || txType === "ADJUSTMENT" || txType === "RETURN" ? null : (
              /* Quantities for Receipt, Issue, Transfer, Return */
              <div className="grid grid-cols-3 gap-3">
                {(txType === "ISSUE" || txType === "TRANSFER") && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Available Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={`${verifiedProduct?.available ?? verifiedProduct?.on_hand ?? 50} ${verifiedProduct?.unit || "EA"}`}
                      readOnly
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-200 font-mono font-bold text-xs"
                    />
                  </div>
                )}

                <div className={(txType === "RECEIPT" || txType === "RETURN") ? "col-span-2" : ""}>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {txType === "RECEIPT" && "Received Quantity"}
                    {txType === "ISSUE" && "Issue Quantity"}
                    {txType === "TRANSFER" && "Transfer Quantity"}
                    {txType === "RETURN" && "Return Quantity"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono font-bold text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Unit of Measure <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    disabled={units.length === 0}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono font-semibold text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  >
                    {units.length > 0 ? (
                      units.map((unit) => (
                        <option key={unit.id || unit.code} value={unit.code}>
                          {unit.code} - {unit.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No registered units available</option>
                    )}
                  </select>
                </div>

                {txType === "RECEIPT" && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 font-mono text-xs font-semibold"
                    />
                  </div>
                )}
              </div>
            )}

            {/* CONDITIONAL TRACKING FIELDS (Batch / Expiry / Serial) */}
            {!["ISSUE", "ADJUSTMENT", "RETURN"].includes(txType) && (isBatchTracked || isSerialTracked) && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Conditional Tracking Parameters
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {isBatchTracked && (
                    <>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Batch Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={batchNumber}
                          onChange={(e) => setBatchNumber(e.target.value)}
                          placeholder="e.g. BATCH-2026-X1"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-mono text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                          Expiry Date {txType === "RECEIPT" && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-xs"
                        />
                      </div>
                    </>
                  )}

                  {isSerialTracked && (
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                        Serial Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder="e.g. SN-2026-9921"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-mono text-xs"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reason for Stock Issue */}
            {txType === "ISSUE" && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mandatory justification for stock issuance..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs"
                  required
                />
              </div>
            )}

            {/* Remarks (Optional for Receipt, Transfer, Adjustment, Return) */}
            {txType !== "ISSUE" && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional operational notes or audit comments..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 text-xs"
                />
              </div>
            )}
          </div>

          {/* Operation Specific Action Buttons Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/80 p-4 px-6 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {/* Common Save Draft */}
              <button
                type="button"
                onClick={() => handleAction("save_draft")}
                disabled={submitting}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Save Draft
              </button>

              {/* Submit for All */}
              <button
                type="button"
                onClick={() => handleAction("submit")}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit</span>
              </button>

              {/* Specific Workflow Actions per operation */}
              {txType === "RECEIPT" && (
                <button
                  type="button"
                  onClick={() => handleAction("post")}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs hover:shadow-emerald-500/25 transition-all cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Post Receipt</span>
                </button>
              )}

              {txType === "ISSUE" && (
                <button
                  type="button"
                  onClick={() => handleAction("post")}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs hover:shadow-rose-500/25 transition-all cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Post Issue</span>
                </button>
              )}

              {txType === "TRANSFER" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction("dispatch")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs hover:shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Dispatch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("receive")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Receive</span>
                  </button>
                </>
              )}

              {txType === "ADJUSTMENT" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction("approve")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs hover:shadow-purple-500/25 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("post")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs hover:shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Post Adjustment</span>
                  </button>
                </>
              )}

              {txType === "RETURN" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction("inspect")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs hover:shadow-indigo-500/25 transition-all cursor-pointer"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Inspect</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("post")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs hover:shadow-purple-500/25 transition-all cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Post Return</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
