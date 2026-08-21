import { useEffect, useMemo, useState } from "react";
import { Boxes, ClipboardList, Eye, Factory, Leaf, MoreVertical, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Table } from "../../components/Table";
import { Toast } from "../../components/Toast";
import { Input as UiInput, PageHeader, Select as UiSelect, Tabs } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

const emptyProduct = { name: "", categoryId: "", area: "RESTAURANTE", unit: "unidad", stock: 0, minStock: 0, cost: 0, price: 0 };
const emptyMove = { productId: "", inventoryLotId: "", expectedLotQty: "", quantity: "", cost: "", expiresAt: "", supplierLotCode: "", reason: "", reference: "" };
const inventoryAreas = [
  { value: "RESUMEN", label: "Todos", supported: true },
  { value: "RESTAURANTE", label: "Restaurante", supported: true },
  { value: "BARTENDER", label: "Bartender", supported: true },
  { value: "LIMPIEZA", label: "Limpieza", supported: true },
  { value: "MANTENIMIENTO", label: "Mantenimiento", supported: true }
];
const supportedAreas = inventoryAreas.filter((item) => item.supported && item.value !== "RESUMEN");

export function InventoryPage() {
  const location = useLocation();
  const { can } = useAuth();
  const isKardex = location.pathname.includes("kardex");
  const canCreate = can("INVENTARIO", "CREAR");
  const canEdit = can("INVENTARIO", "EDITAR");
  const canDelete = can("INVENTARIO", "ELIMINAR");
  const [area, setArea] = useState("RESUMEN");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [movementType, setMovementType] = useState("");
  const [activeSection, setActiveSection] = useState(isKardex ? "MOVIMIENTOS" : "ARTICULOS");
  const [wasteFilters, setWasteFilters] = useState({ productId: "", type: "", responsible: "", date: "" });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [moveForm, setMoveForm] = useState(emptyMove);
  const [mode, setMode] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [selectedWaste, setSelectedWaste] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [toast, setToast] = useState("");
  const areaSupported = inventoryAreas.find((item) => item.value === area)?.supported;
  const effectiveArea = areaSupported ? area : "RESUMEN";
  const areaQuery = effectiveArea === "RESUMEN" ? "" : `area=${effectiveArea}`;
  const productQuery = `/inventory?${[areaQuery].filter(Boolean).join("&")}`;
  const { data: products, loading, reload } = useFetch(productQuery, { initialData: [] });
  const { data: allProducts } = useFetch("/inventory", { initialData: [] });
  const { data: summary, reload: reloadSummary } = useFetch(`/inventory/summary${effectiveArea === "RESUMEN" ? "" : `?area=${effectiveArea}`}`, { initialData: { totalProducts: 0, lowStock: 0, noStock: 0, value: 0 } });
  const { data: categories } = useFetch("/inventory/categories", { initialData: [] });
  const movementQuery = `/inventory/movements?${[areaQuery, movementType ? `type=${movementType}` : ""].filter(Boolean).join("&")}`;
  const { data: movements, reload: reloadMovements } = useFetch(movementQuery, { initialData: [] });
  const { data: productions, loading: productionsLoading, reload: reloadProductions } = useFetch(`/production?area=${effectiveArea}`, { initialData: [], enabled: effectiveArea === "RESTAURANTE" });
  const { data: recipes, loading: recipesLoading } = useFetch(`/recipes?area=${effectiveArea}&active=true`, { initialData: [], enabled: effectiveArea === "BARTENDER" });

  const visibleProducts = useMemo(() => {
    if (!areaSupported) return [];
    const term = search.trim().toLowerCase();
    return (products || []).filter((product) => {
      const matchesSearch = !term || [product.name, product.area, product.category?.name, product.unit].filter(Boolean).join(" ").toLowerCase().includes(term);
      const matchesCategory = !categoryId || String(product.categoryId) === String(categoryId);
      const matchesStock = !stockStatus || product.stockStatus === stockStatus;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [areaSupported, categoryId, products, search, stockStatus]);
  const visibleMovements = areaSupported ? movements : [];
  const visibleSummary = areaSupported ? summary : { totalProducts: 0, lowStock: 0, noStock: 0, value: 0 };
  const selectedProduct = useMemo(() => visibleProducts?.find((product) => String(product.id) === String(moveForm.productId)), [visibleProducts, moveForm.productId]);
  const adjustmentLotsQuery = selectedProduct ? `/inventory/lots?productId=${selectedProduct.id}` : "/inventory/lots?productId=0";
  const { data: adjustmentLots, reload: reloadAdjustmentLots } = useFetch(adjustmentLotsQuery, { initialData: [], enabled: ["AJUSTE", "ENTRADA"].includes(mode) && Boolean(selectedProduct) });
  const sectionTabs = useMemo(() => sectionTabsFor(effectiveArea), [effectiveArea]);
  const productionRows = effectiveArea === "RESTAURANTE" ? productions || [] : [];
  const preparationRows = effectiveArea === "BARTENDER" ? recipes || [] : [];
  const wasteRows = useMemo(() => filterWasteRows(buildWasteRows(productionRows, visibleMovements), wasteFilters), [productionRows, visibleMovements, wasteFilters]);
  const activeDrawer = mode || (editingProduct ? "EDITAR" : "") || (selectedInventoryProduct ? "DETALLE" : "");

  useEffect(() => {
    if (mode === "PRODUCTO" && supportedAreas.some((item) => item.value === area)) {
      setProductForm((current) => ({ ...current, area }));
    }
  }, [area, mode]);

  useEffect(() => {
    if (!sectionTabs.some((item) => item.value === activeSection)) {
      setActiveSection(sectionTabs[0]?.value || "ARTICULOS");
    }
  }, [activeSection, sectionTabs]);

  async function createProduct(event) {
    event.preventDefault();
    if (!canCreate) return setToast("No tienes permiso para crear productos.");
    await api("/products", { method: "POST", body: { ...productForm, area: area === "RESUMEN" ? productForm.area : area } });
    setToast("Producto registrado.");
    setProductForm({ ...emptyProduct, area: supportedAreas.some((item) => item.value === area) ? area : "RESTAURANTE" });
    setMode("");
    reload();
    reloadSummary();
    reloadProductions();
  }

  function openCreateProduct() {
    closeInventoryDrawers();
    setProductForm({ ...emptyProduct, area: supportedAreas.some((item) => item.value === area) ? area : "RESTAURANTE" });
    setMode("PRODUCTO");
  }

  function openMovement(nextMode, product = null) {
    closeInventoryDrawers();
    setMoveForm({ ...emptyMove, productId: product?.id || "" });
    setMode(nextMode);
  }

  function openEditProduct(product) {
    closeInventoryDrawers();
    setEditingProduct(product);
  }

  function openProductDetail(product) {
    closeInventoryDrawers();
    setSelectedInventoryProduct(product);
  }

  function closeInventoryDrawers() {
    setMode("");
    setEditingProduct(null);
    setSelectedInventoryProduct(null);
  }

  async function movement(event) {
    event.preventDefault();
    if (!canCreate) return setToast("No tienes permiso para registrar movimientos.");
    const endpoint = mode === "ENTRADA" ? "/inventory/entries" : mode === "SALIDA" ? "/inventory/exits" : "/inventory/adjustments";
    const body = mode === "AJUSTE" ? { ...moveForm, countedQty: moveForm.quantity } : moveForm;
    try {
      await api(endpoint, { method: "POST", body });
      setToast(mode === "AJUSTE" ? "Ajuste registrado." : "Movimiento registrado.");
      setMoveForm(emptyMove);
      setMode("");
      reload();
      reloadSummary();
      reloadMovements();
      reloadProductions();
    } catch (error) {
      setToast(error.message || "No se pudo registrar el movimiento.");
      if (mode === "AJUSTE") {
        reloadAdjustmentLots();
        reload();
        reloadSummary();
        reloadMovements();
      }
    }
  }

  async function deactivateProduct() {
    if (!confirmDeactivate) return;
    if (!canDelete) return setToast("No tienes permiso para desactivar productos.");
    await api(`/products/${confirmDeactivate.id}`, { method: "DELETE" });
    setToast("Producto desactivado.");
    setConfirmDeactivate(null);
    closeInventoryDrawers();
    reload();
    reloadSummary();
    reloadMovements();
  }

  async function updateProduct(event) {
    event.preventDefault();
    if (!canEdit) return setToast("No tienes permiso para editar productos.");
    await api(`/products/${editingProduct.id}`, { method: "PUT", body: editingProduct });
    setToast("Producto actualizado.");
    setEditingProduct(null);
    reload();
    reloadSummary();
    reloadMovements();
  }

  if (loading || productionsLoading || recipesLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <PageHeader
        eyebrow="Administracion"
        title={isKardex ? "Kardex de Inventario" : "Inventario"}
        description="Control de stock por area."
      />
      <section className="rounded-card border border-park-border bg-white p-3 shadow-card">
        <p className="mb-2 px-1 text-xs font-black uppercase text-park-muted">Areas</p>
        <Tabs tabs={inventoryAreas.map((item) => ({ value: item.value, label: item.supported ? item.label : `${item.label} *` }))} value={area} onChange={(value) => { setArea(value); setActiveSection("ARTICULOS"); setCategoryId(""); setStockStatus(""); setMovementType(""); setMoveForm(emptyMove); setWasteFilters({ productId: "", type: "", responsible: "", date: "" }); setSelectedRecipe(null); setSelectedProduction(null); }} />
        {!inventoryAreas.find((item) => item.value === area)?.supported ? (
          <p className="mt-3 rounded-card bg-park-gold-soft px-3 py-2 text-sm font-semibold text-park-gold">El modelo actual de inventario aun no soporta esta area en PostgreSQL. Se muestra como seccion preparada, sin crear datos ni migraciones automaticamente.</p>
        ) : null}
      </section>
      <section className="rounded-card border border-park-border bg-white p-3 shadow-card">
        <Tabs tabs={sectionTabs} value={activeSection} onChange={setActiveSection} />
      </section>
      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric icon={<Boxes />} label="Productos" value={visibleSummary.totalProducts} />
          <Metric icon={<SlidersHorizontal />} label="Stock bajo" value={visibleSummary.lowStock} />
          <Metric icon={<Minus />} label="Sin stock" value={visibleSummary.noStock} />
          <Metric icon={<ClipboardList />} label="Valor" value={`S/ ${Number(visibleSummary.value).toFixed(2)}`} />
        </div>
      </section>

      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <UiInput label="Buscar" placeholder="Producto..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <UiSelect label="Categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas las categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</UiSelect>
          <UiSelect label="Stock" value={stockStatus} onChange={(event) => setStockStatus(event.target.value)}><option value="">Todos</option><option value="OK">Stock OK</option><option value="STOCK_BAJO">Stock Bajo</option><option value="SIN_STOCK">Sin Stock</option></UiSelect>
          {activeSection === "MOVIMIENTOS" ? <UiSelect label="Movimiento" value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option><option value="AJUSTE">Ajuste</option><option value="ENTRADA_COMPRA">Entrada compra</option></UiSelect> : <span />}
        </div>
        {canCreate && activeSection === "ARTICULOS" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Action icon={<Plus size={16} />} label="+ Producto" onClick={openCreateProduct} />
            <Action icon={<Plus size={16} />} label="Entrada" onClick={() => openMovement("ENTRADA")} />
            <Action icon={<Minus size={16} />} label="Salida" onClick={() => openMovement("SALIDA")} />
            <Action icon={<SlidersHorizontal size={16} />} label="Ajuste" onClick={() => openMovement("AJUSTE")} />
          </div>
        ) : null}
        {canCreate && activeSection === "PRODUCCION" && effectiveArea === "RESTAURANTE" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Action icon={<Minus size={16} />} label="Registrar merma manual" onClick={() => openMovement("SALIDA")} />
          </div>
        ) : null}
      </section>

      {activeSection === "ARTICULOS" ? <ProductsTable area={area} canCreate={canCreate} canDelete={canDelete} canEdit={canEdit} products={visibleProducts} onDeactivate={setConfirmDeactivate} onEdit={openEditProduct} onMove={openMovement} onSelect={openProductDetail} /> : null}
      {activeSection === "PRODUCCION" ? <ProductionTable movements={visibleMovements} productions={productionRows} onSelect={setSelectedProduction} /> : null}
      {activeSection === "PREPARACIONES" ? <PreparationsTable recipes={preparationRows} onSelect={setSelectedRecipe} /> : null}
      {activeSection === "MERMAS" ? <WasteSection filters={wasteFilters} products={visibleProducts} rows={wasteRows} setFilters={setWasteFilters} onSelect={setSelectedWaste} /> : null}
      {activeSection === "MOVIMIENTOS" ? <MovementsTable movements={visibleMovements} /> : null}
      {mode === "PRODUCTO" ? <ProductFormDrawer allProducts={allProducts} form={productForm} setForm={setProductForm} area={area} categories={categories} onSubmit={createProduct} onCancel={closeInventoryDrawers} /> : null}
      {["ENTRADA", "SALIDA", "AJUSTE"].includes(mode) ? <MovementFormDrawer mode={mode} form={moveForm} setForm={setMoveForm} products={visibleProducts} product={selectedProduct} lots={adjustmentLots || []} onSubmit={movement} onCancel={closeInventoryDrawers} /> : null}
      {editingProduct ? <EditProductDrawer allProducts={allProducts} product={editingProduct} setProduct={setEditingProduct} categories={categories} onClose={closeInventoryDrawers} onSubmit={updateProduct} /> : null}
      {selectedInventoryProduct ? <ProductDetailDrawer canCreate={canCreate} canDelete={canDelete} canEdit={canEdit} product={selectedInventoryProduct} onDeactivate={setConfirmDeactivate} onEdit={openEditProduct} onMove={openMovement} onClose={closeInventoryDrawers} /> : null}
      {selectedProduction ? <ProductionDetailDrawer production={selectedProduction} movements={visibleMovements} onClose={() => setSelectedProduction(null)} /> : null}
      {selectedWaste ? <WasteDetailDrawer row={selectedWaste} onClose={() => setSelectedWaste(null)} /> : null}
      {selectedRecipe ? <PreparationDetailDrawer recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} /> : null}
      {confirmDeactivate ? <ConfirmDeactivateModal onCancel={() => setConfirmDeactivate(null)} onConfirm={deactivateProduct} product={confirmDeactivate} /> : null}
    </div>
  );
}

function ProductFormDrawer({ allProducts, form, setForm, area, categories, onSubmit, onCancel }) {
  const productArea = area === "RESUMEN" || !supportedAreas.some((item) => item.value === area) ? form.area : area;
  const areaCategories = categoriesForArea(categories, allProducts, productArea);
  return (
    <InventoryDrawer eyebrow="Inventario" title="Nuevo producto" onClose={onCancel}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="grid flex-1 gap-4 overflow-auto py-5">
          <Input label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Select label="Area" value={productArea} onChange={(nextArea) => setForm({ ...form, area: nextArea, categoryId: "" })}>{supportedAreas.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
          <Select label="Categoria" value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })}><option value="">Seleccionar</option>{areaCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
          <Input label="Unidad" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
          <Input label="Stock inicial" min="0" type="number" value={form.stock} onChange={(stock) => setForm({ ...form, stock })} />
          <Input label="Stock minimo" min="0" type="number" value={form.minStock} onChange={(minStock) => setForm({ ...form, minStock })} />
          <Input label="Costo" min="0" type="number" step="0.01" value={form.cost} onChange={(cost) => setForm({ ...form, cost })} />
          <Input label="Precio de venta" min="0" type="number" step="0.01" value={form.price} onChange={(price) => setForm({ ...form, price })} />
        </div>
        <DrawerFooter onCancel={onCancel} submitLabel="Guardar producto" />
      </form>
    </InventoryDrawer>
  );
}

function EditProductDrawer({ allProducts, product, setProduct, categories, onClose, onSubmit }) {
  const areaCategories = categoriesForArea(categories, allProducts, product.area || "RESTAURANTE");
  return (
    <InventoryDrawer eyebrow="Inventario" title="Editar producto" subtitle={product.name} onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="grid flex-1 gap-4 overflow-auto py-5">
          <Input label="Nombre" value={product.name || ""} onChange={(name) => setProduct({ ...product, name })} />
          <Select label="Area" value={product.area || "RESTAURANTE"} onChange={(nextArea) => setProduct({ ...product, area: nextArea, categoryId: "" })}>{supportedAreas.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
          <Select label="Categoria" value={product.categoryId || ""} onChange={(categoryId) => setProduct({ ...product, categoryId })}><option value="">Seleccionar</option>{areaCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
          <Input label="Unidad" value={product.unit || ""} onChange={(unit) => setProduct({ ...product, unit })} />
          <ReadOnlyField label="Stock actual" value={`${formatSmartQty(product.stock, product.unit)} (solo lectura)`} />
          <Input label="Stock minimo" min="0" type="number" value={product.minStock || 0} onChange={(minStock) => setProduct({ ...product, minStock })} />
          <Input label="Costo" min="0" type="number" step="0.01" value={product.cost || 0} onChange={(cost) => setProduct({ ...product, cost })} />
          <Input label="Precio venta" min="0" type="number" step="0.01" value={product.price || 0} onChange={(price) => setProduct({ ...product, price })} />
          <Select label="Estado" value={product.status || "ACTIVO"} onChange={(status) => setProduct({ ...product, status })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></Select>
        </div>
        <DrawerFooter onCancel={onClose} submitLabel="Guardar cambios" />
      </form>
    </InventoryDrawer>
  );
}

function MovementFormDrawer({ mode, form, setForm, products, product, lots, onSubmit, onCancel }) {
  const selectedLot = ["AJUSTE", "ENTRADA"].includes(mode) ? lots.find((lot) => String(lot.id) === String(form.inventoryLotId)) : null;
  const quantity = Number(form.quantity || 0);
  const current = Number(mode === "AJUSTE" ? selectedLot?.currentQty || 0 : product?.stock || 0);
  const resulting = mode === "ENTRADA" ? current + quantity : mode === "SALIDA" ? current - quantity : quantity;
  const diff = mode === "AJUSTE" ? quantity - current : quantity;
  const title = mode === "ENTRADA" ? "Registrar entrada" : mode === "SALIDA" ? "Registrar salida" : "Ajustar inventario";
  const submitLabel = mode === "ENTRADA" ? "Registrar entrada" : mode === "SALIDA" ? "Registrar salida" : "Registrar ajuste";
  const hasCount = form.quantity !== "";
  const canSubmit = product && quantity >= 0 && resulting >= 0 && (mode === "AJUSTE" ? selectedLot && form.reason && hasCount : mode === "ENTRADA" ? quantity > 0 && form.reason && form.cost !== "" : quantity > 0);
  const handleProductChange = (productId) => setForm({ ...form, productId, inventoryLotId: "", expectedLotQty: "", quantity: "" });
  const handleLotChange = (inventoryLotId) => {
    const lot = lots.find((item) => String(item.id) === String(inventoryLotId));
    setForm({
      ...form,
      inventoryLotId,
      expectedLotQty: lot?.currentQty || "",
      cost: mode === "ENTRADA" && lot ? lot.unitCost : form.cost,
      expiresAt: mode === "ENTRADA" && lot?.expiresAt ? lot.expiresAt.slice(0, 10) : form.expiresAt,
      supplierLotCode: mode === "ENTRADA" && lot?.supplierLotCode ? lot.supplierLotCode : form.supplierLotCode
    });
  };
  return (
    <InventoryDrawer eyebrow="Inventario" title={title} onClose={onCancel}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="grid flex-1 gap-4 overflow-auto py-5">
          <Select label="Producto" value={form.productId} onChange={handleProductChange}><option value="">Seleccionar producto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} - {formatSmartQty(item.stock, item.unit)}</option>)}</Select>
          {mode === "AJUSTE" && product ? (
            <Select label="Lote" value={form.inventoryLotId} onChange={handleLotChange}>
              <option value="">Seleccionar lote</option>
              {lots.map((lot) => <option key={lot.id} value={lot.id}>{formatLotOption(lot, product.unit)}</option>)}
            </Select>
          ) : null}
          {mode === "ENTRADA" && product ? (
            <Select label="Lote existente opcional" value={form.inventoryLotId} onChange={handleLotChange} required={false}>
              <option value="">Crear lote nuevo</option>
              {lots.map((lot) => <option key={lot.id} value={lot.id}>{formatLotOption(lot, product.unit)}</option>)}
            </Select>
          ) : null}
          {mode === "AJUSTE" && selectedLot ? <ReadOnlyField label="Stock registrado del lote" value={formatSmartQty(selectedLot.currentQty, product?.unit)} /> : null}
          {mode === "ENTRADA" && selectedLot ? <ReadOnlyField label="Lote seleccionado" value={`${selectedLot.code} · ${formatSmartQty(selectedLot.currentQty, product?.unit)}`} /> : null}
          {product && mode !== "AJUSTE" ? <ReadOnlyField label={mode === "SALIDA" ? "Stock disponible" : "Stock actual"} value={formatSmartQty(product.stock, product.unit)} /> : null}
          <Input label={mode === "AJUSTE" ? "Stock fisico contado" : "Cantidad"} type="number" min={mode === "AJUSTE" ? "0" : "0.0001"} step={mode === "SALIDA" ? "0.01" : "0.0001"} value={form.quantity} onChange={(nextQuantity) => setForm({ ...form, quantity: nextQuantity })} />
          {mode === "ENTRADA" ? <Input label="Costo unitario" type="number" step="0.01" value={form.cost} onChange={(cost) => setForm({ ...form, cost })} /> : null}
          {mode === "ENTRADA" ? <Input label="Vencimiento" type="date" value={form.expiresAt} onChange={(expiresAt) => setForm({ ...form, expiresAt })} required={false} /> : null}
          {mode === "ENTRADA" ? <Input label="Codigo lote proveedor" value={form.supplierLotCode} onChange={(supplierLotCode) => setForm({ ...form, supplierLotCode })} required={false} /> : null}
          <Select label="Motivo" value={form.reason} onChange={(reason) => setForm({ ...form, reason })}>
            <option value="">Seleccionar</option>
            {movementReasons(mode).map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </Select>
          <Input label="Referencia" value={form.reference} onChange={(reference) => setForm({ ...form, reference })} required={false} />
          {product && (mode !== "AJUSTE" || selectedLot) ? <StockPreview current={current} diff={diff} mode={mode} result={resulting} unit={product.unit} /> : null}
        </div>
        <DrawerFooter disabled={!canSubmit} onCancel={onCancel} submitLabel={submitLabel} />
      </form>
    </InventoryDrawer>
  );
}

function ProductsTable({ area, products, canCreate, canDelete, canEdit, onDeactivate, onEdit, onMove, onSelect }) {
  if (!products.length) return <EmptyPanel title="Sin productos" description="No hay articulos que coincidan con los filtros." />;
  return (
    <Table columns={area === "RESUMEN" ? ["Producto", "Area", "Stock", "Unidad", "Estado", "Categoria", "Accion"] : ["Producto", "Stock", "Unidad", "Estado", "Categoria", "Accion"]} rows={products} renderRow={(product) => (
      <tr className="cursor-pointer transition hover:bg-park-bg" key={product.id} onClick={() => onSelect(product)}>
        <td className="px-4 py-3 font-bold text-park-black">{product.name}</td>
        {area === "RESUMEN" ? <td className="px-4 py-3">{areaLabel(product.area)}</td> : null}
        <td className="px-4 py-3 font-black">{formatQty(product.stock)}</td>
        <td className="px-4 py-3">{product.unit}</td>
        <td className="px-4 py-3"><StatusBadge value={product.stockStatus} /></td>
        <td className="px-4 py-3">{product.category?.name || "Sin categoria"}</td>
        <td className="px-4 py-3">
          <button
            className="grid h-8 w-8 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-green"
            onClick={(event) => { event.stopPropagation(); onSelect(product); }}
            title="Ver detalle"
            type="button"
          >
            <MoreVertical size={16} />
          </button>
        </td>
      </tr>
    )} />
  );
}

function ProductionTable({ productions, movements, onSelect }) {
  if (!productions.length) return <EmptyPanel title="Sin producciones" description="Los procesos de transformacion de cocina apareceran aqui." />;
  return (
    <Table columns={["Produccion", "Materia prima", "Entrada", "Resultado", "Salida", "Merma", "Rend.", "Estado", "Accion"]} rows={productions} renderRow={(item) => (
      <tr className="cursor-pointer transition hover:bg-park-bg" key={item.id} onClick={() => onSelect({ ...item, relatedMovements: relatedProductionMovements(item, movements) })}>
        <td className="px-4 py-3 font-black text-park-black">{item.code}</td>
        <td className="px-4 py-3 font-semibold">{item.inputProduct?.name || "-"}</td>
        <td className="px-4 py-3">{formatSmartQty(item.inputQty, item.inputProduct?.unit)}</td>
        <td className="px-4 py-3 font-semibold">{item.outputProduct?.name || "-"}</td>
        <td className="px-4 py-3">{formatSmartQty(item.outputQty, item.outputProduct?.unit)}</td>
        <td className="px-4 py-3 font-black text-park-gold">{formatSmartQty(item.wasteQty, item.inputProduct?.unit)}</td>
        <td className="px-4 py-3">{trimNumber(item.yieldPercent)}%</td>
        <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
        <td className="px-4 py-3"><button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-park-green" onClick={(event) => { event.stopPropagation(); onSelect({ ...item, relatedMovements: relatedProductionMovements(item, movements) }); }} type="button"><Eye size={14} />Detalle</button></td>
      </tr>
    )} />
  );
}

function PreparationsTable({ recipes, onSelect }) {
  if (!recipes.length) return <EmptyPanel title="Sin preparaciones" description="No hay recetas activas de bartender configuradas." />;
  return (
    <Table columns={["Producto final", "Receta", "Disponibilidad", "Estado", "Accion"]} rows={recipes} renderRow={(recipe) => {
      const availability = recipeAvailability(recipe);
      return (
        <tr className="cursor-pointer transition hover:bg-park-bg" key={recipe.id} onClick={() => onSelect(recipe)}>
          <td className="px-4 py-3 font-black text-park-black">{recipe.name}</td>
          <td className="px-4 py-3">{recipe.items?.length || 0} ingredientes</td>
          <td className="px-4 py-3"><StatusBadge value={availability.ok ? "OK" : "SIN_STOCK"} /></td>
          <td className="px-4 py-3"><StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} /></td>
          <td className="px-4 py-3"><button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-park-green" onClick={(event) => { event.stopPropagation(); onSelect(recipe); }} type="button"><Eye size={14} />Detalle</button></td>
        </tr>
      );
    }} />
  );
}

function WasteSection({ filters, products, rows, setFilters, onSelect }) {
  return (
    <div className="space-y-4">
      <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <UiInput label="Fecha" type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} />
          <UiSelect label="Producto" value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}>
            <option value="">Todos</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </UiSelect>
          <UiSelect label="Tipo" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">Todos</option>
            <option value="MERMA_PRODUCCION">Merma de produccion</option>
            <option value="MERMA_OPERATIVA">Merma operativa</option>
            <option value="DETERIORO">Deterioro</option>
            <option value="PERDIDA">Perdida</option>
          </UiSelect>
          <UiInput label="Responsable" placeholder="Usuario..." value={filters.responsible} onChange={(event) => setFilters({ ...filters, responsible: event.target.value })} />
        </div>
      </section>
      {!rows.length ? <EmptyPanel title="Sin mermas" description="No hay mermas que coincidan con los filtros." /> : (
        <Table columns={["Producto", "Cantidad", "Tipo", "Responsable", "Fecha", "Accion"]} rows={rows} renderRow={(row) => (
          <tr className="cursor-pointer transition hover:bg-park-bg" key={row.id} onClick={() => onSelect(row)}>
            <td className="px-4 py-3 font-bold">{row.productName}</td>
            <td className="px-4 py-3">{formatQty(row.quantity)} {row.unit}</td>
            <td className="px-4 py-3"><StatusBadge value={row.type} /></td>
            <td className="px-4 py-3">{row.responsible}</td>
            <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
            <td className="px-4 py-3"><button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-park-green" onClick={(event) => { event.stopPropagation(); onSelect(row); }} type="button"><Eye size={14} />Detalle</button></td>
          </tr>
        )} />
      )}
    </div>
  );
}

function MovementsTable({ movements }) {
  return (
    <Table columns={["Fecha", "Producto", "Tipo", "Cantidad", "Usuario", "Referencia"]} rows={movements || []} renderRow={(move) => (
      <tr key={move.id}>
        <td className="px-4 py-3">{formatDate(move.createdAt)}</td>
        <td className="px-4 py-3 font-bold">{move.product?.name}</td>
        <td className="px-4 py-3"><StatusBadge value={move.type} /></td>
        <td className="px-4 py-3">{formatSmartQty(move.quantity, move.product?.unit)}</td>
        <td className="px-4 py-3">{movementUser(move)}</td>
        <td className="px-4 py-3">{formatReference(move.reference) || move.reason || "-"}</td>
      </tr>
    )} />
  );
}

function ProductionDetailDrawer({ production, movements, onClose }) {
  const related = production.relatedMovements || relatedProductionMovements(production, movements);
  const wasteLines = productionWasteLines(production);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <DrawerHeader eyebrow="Detalle de produccion" title={production.code} onClose={onClose} />
        <Panel title="Informacion general">
          <DetailLine label="Codigo" value={production.code} />
          <DetailLine label="Estado" value={<StatusBadge value={production.status} />} />
          <DetailLine label="Fecha" value={formatDate(production.createdAt)} />
          <DetailLine label="Responsable" value={productionUser(production)} />
        </Panel>
        <Panel title="Materia prima">
          <DetailLine label="Producto" value={production.inputProduct?.name} />
          <DetailLine label="Entrada" value={formatSmartQty(production.inputQty, production.inputProduct?.unit)} />
        </Panel>
        <Panel title="Resultado">
          <DetailLine label="Producto" value={production.outputProduct?.name} />
          <DetailLine label="Salida" value={formatSmartQty(production.outputQty, production.outputProduct?.unit)} />
        </Panel>
        <Panel title="Rendimiento">
          <DetailLine label="Entrada" value={formatSmartQty(production.inputQty, production.inputProduct?.unit)} />
          <DetailLine label="Resultado" value={formatSmartQty(production.outputQty, production.outputProduct?.unit)} />
          <DetailLine label="Merma" value={formatSmartQty(production.wasteQty, production.inputProduct?.unit)} />
          <DetailLine label="Rendimiento" value={`${trimNumber(production.yieldPercent)}%`} />
        </Panel>
        {Number(production.wasteQty || 0) > 0 ? (
          <Panel title="Desglose de merma">
            {wasteLines.map((line) => <DetailLine key={line.label} label={line.label} value={line.value} />)}
          </Panel>
        ) : null}
        {production.notes ? (
          <Panel title="Observacion">
            <p className="text-sm font-semibold text-park-muted">{production.notes}</p>
          </Panel>
        ) : null}
        <Panel title="Movimientos generados">
          {related.length ? related.map((move) => <DetailLine key={move.id} label={movementProductionLabel(move, production)} value={`${move.product?.name}: ${formatSmartQty(move.quantity, move.product?.unit)} (${formatReference(move.reference) || "-"})`} />) : <p className="text-sm text-park-muted">No se encontraron movimientos relacionados.</p>}
        </Panel>
      </aside>
    </div>
  );
}

function PreparationDetailDrawer({ recipe, onClose }) {
  const availability = recipeAvailability(recipe);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <DrawerHeader eyebrow="Preparacion bartender" title={recipe.name} onClose={onClose} />
        <Panel title="Producto final">
          <DetailLine label="Producto" value={recipe.name} />
          <DetailLine label="Estado" value={<StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} />} />
        </Panel>
        <Panel title="Ingredientes">
          <div className="space-y-3">
            {(recipe.items || []).map((item) => {
              const status = ingredientAvailability(item);
              return (
                <div className="rounded-button border border-park-border bg-park-bg p-3" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-park-black">{item.product?.name || "Ingrediente"}</strong>
                      <p className="text-sm text-park-muted">Requiere {formatSmartQty(item.quantity, item.unit)}</p>
                      <p className="text-xs font-semibold text-park-muted">Disponible: {formatSmartQty(item.product?.stock, item.product?.unit)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status.ok ? "bg-park-green-soft text-park-green" : "bg-park-danger-soft text-park-danger"}`}>{status.ok ? "OK" : "Falta"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Disponibilidad">
          <DetailLine label="Resultado" value={availability.ok ? "Ingredientes suficientes" : "Ingredientes insuficientes"} />
          {!availability.ok ? <DetailLine label="Faltantes" value={availability.missing.map((item) => item.product?.name).join(", ")} /> : null}
          <p className="mt-3 rounded-card bg-park-light p-3 text-sm font-semibold text-park-green">El descuento real de ingredientes se ejecuta desde Pedidos al preparar/entregar, usando la receta y el Kardex existente.</p>
          <button className="mt-4 w-full rounded-button bg-slate-200 px-4 py-2 text-sm font-black text-slate-500" disabled type="button">Preparar desde pedido</button>
        </Panel>
      </aside>
    </div>
  );
}

function WasteDetailDrawer({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <DrawerHeader eyebrow="Merma" title={row.productName} onClose={onClose} />
        <Panel title="Informacion general">
          <DetailLine label="Tipo" value={row.type.replaceAll("_", " ")} />
          <DetailLine label="Cantidad" value={`${formatQty(row.quantity)} ${row.unit}`} />
          <DetailLine label="Costo estimado" value={`S/ ${Number(row.cost || 0).toFixed(2)}`} />
          <DetailLine label="Motivo" value={row.reason || "-"} />
          <DetailLine label="Observacion" value={row.notes || "-"} />
          <DetailLine label="Responsable" value={row.responsible} />
          <DetailLine label="Fecha/hora" value={formatDate(row.createdAt)} />
        </Panel>
        {row.production ? (
          <Panel title="Produccion asociada">
            <DetailLine label="Produccion" value={row.production.code} />
            <DetailLine label="Materia prima procesada" value={`${row.production.inputProduct?.name} - ${formatQty(row.production.inputQty)} ${row.production.inputProduct?.unit}`} />
            <DetailLine label="Producto aprovechable" value={`${row.production.outputProduct?.name} - ${formatQty(row.production.outputQty)} ${row.production.outputProduct?.unit}`} />
            <DetailLine label="Rendimiento" value={`${Number(row.production.yieldPercent || 0).toFixed(1)}%`} />
            <DetailLine label="Lote" value={row.production.code} />
          </Panel>
        ) : null}
      </aside>
    </div>
  );
}

function ProductDetailDrawer({ canCreate, canDelete, canEdit, product, onDeactivate, onEdit, onMove, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3">
      <aside className="ml-auto flex h-full w-full max-w-lg flex-col overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <DrawerHeader eyebrow="Articulo" title={product.name} onClose={onClose} />
        <Panel title="Resumen">
          <DetailLine label="Area" value={areaLabel(product.area)} />
          <DetailLine label="Categoria" value={product.category?.name || "Sin categoria"} />
          <DetailLine label="Estado" value={<StatusBadge value={product.stockStatus} />} />
        </Panel>
        <Panel title="Stock">
          <DetailLine label="Stock actual" value={formatSmartQty(product.stock, product.unit)} />
          <DetailLine label="Stock minimo" value={formatSmartQty(product.minStock, product.unit)} />
          <DetailLine label="Diferencia" value={formatSmartQty(Number(product.stock || 0) - Number(product.minStock || 0), product.unit, true)} />
        </Panel>
        <Panel title="Informacion comercial">
          <DetailLine label="Costo" value={`S/ ${Number(product.cost || 0).toFixed(2)}`} />
          <DetailLine label="Precio venta" value={`S/ ${Number(product.price || 0).toFixed(2)}`} />
          <DetailLine label="Estado del articulo" value={product.status || "ACTIVO"} />
        </Panel>
        <div className="mt-5 grid gap-2 border-t border-park-border pt-4 sm:grid-cols-2">
          {canCreate ? <button className="rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-green" onClick={() => onMove("ENTRADA", product)} type="button">Registrar entrada</button> : null}
          {canCreate ? <button className="rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-green" onClick={() => onMove("SALIDA", product)} type="button">Registrar salida</button> : null}
          {canCreate ? <button className="rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-green" onClick={() => onMove("AJUSTE", product)} type="button">Ajustar</button> : null}
          {canEdit ? <button className="rounded-button bg-park-green px-4 py-2 text-sm font-black text-white" onClick={() => onEdit(product)} type="button">Editar</button> : null}
          {canDelete ? <button className="rounded-button border border-red-200 px-4 py-2 text-sm font-black text-park-danger sm:col-span-2" onClick={() => { onClose(); onDeactivate(product); }} type="button">Desactivar</button> : null}
        </div>
      </aside>
    </div>
  );
}

function sectionTabsFor(area) {
  if (area === "RESTAURANTE") {
    return [
      { value: "ARTICULOS", label: "Articulos" },
      { value: "PRODUCCION", label: "Produccion" },
      { value: "MOVIMIENTOS", label: "Movimientos" }
    ];
  }
  if (area === "BARTENDER") {
    return [
      { value: "ARTICULOS", label: "Articulos" },
      { value: "PREPARACIONES", label: "Preparaciones" },
      { value: "MOVIMIENTOS", label: "Movimientos" }
    ];
  }
  return [
    { value: "ARTICULOS", label: "Articulos" },
    { value: "MOVIMIENTOS", label: "Movimientos" }
  ];
}

function buildWasteRows(productions, movements) {
  const productionWaste = (productions || [])
    .filter((item) => Number(item.wasteQty) > 0)
    .map((item) => ({
      id: `production-${item.id}`,
      source: "PRODUCCION",
      productId: item.inputProductId,
      productName: item.inputProduct?.name || "Materia prima",
      type: "MERMA_PRODUCCION",
      quantity: Number(item.wasteQty || 0),
      unit: item.inputProduct?.unit || "",
      cost: Number(item.wasteQty || 0) * Number(item.inputProduct?.cost || 0),
      reason: item.notes || `Merma generada por produccion ${item.code}`,
      notes: item.notes,
      responsible: productionUser(item),
      createdAt: item.createdAt,
      productionCode: item.code,
      production: item
    }));

  const operationalWaste = (movements || [])
    .filter((item) => isWasteMovement(item))
    .map((item) => ({
      id: `movement-${item.id}`,
      source: "MOVIMIENTO",
      productId: item.productId,
      productName: item.product?.name || "Producto",
      type: classifyWasteMovement(item),
      quantity: Math.abs(Number(item.quantity || 0)),
      unit: item.product?.unit || "",
      cost: Math.abs(Number(item.quantity || 0)) * Number(item.product?.cost || 0),
      reason: item.reason || item.reference || "-",
      notes: item.reference,
      responsible: movementUser(item),
      createdAt: item.createdAt,
      productionCode: productionCodeFromReference(item.reference),
      production: null
    }));

  return [...productionWaste, ...operationalWaste].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function filterWasteRows(rows, filters) {
  const responsible = filters.responsible.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesProduct = !filters.productId || String(row.productId) === String(filters.productId);
    const matchesType = !filters.type || row.type === filters.type;
    const matchesResponsible = !responsible || row.responsible.toLowerCase().includes(responsible);
    const matchesDate = !filters.date || new Date(row.createdAt).toISOString().slice(0, 10) === filters.date;
    return matchesProduct && matchesType && matchesResponsible && matchesDate;
  });
}

function isWasteMovement(item) {
  if (item.reference?.includes("PRODUCCION:")) return false;
  const text = [item.reason, item.reference, item.type].filter(Boolean).join(" ").toLowerCase();
  return text.includes("perdida") || text.includes("pérdida") || text.includes("merma") || text.includes("deterioro");
}

function classifyWasteMovement(item) {
  const text = [item.reason, item.reference].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("deterioro") || text.includes("vencid")) return "DETERIORO";
  if (text.includes("merma")) return "MERMA_OPERATIVA";
  return "PERDIDA";
}

function relatedProductionMovements(production, movements) {
  const token = `PRODUCCION:${production.id}`;
  return (movements || []).filter((move) => move.reference?.includes(token));
}

function productionCodeFromReference(reference) {
  if (!reference?.includes("PRODUCCION:")) return null;
  return reference;
}

function productionUser(item) {
  if (item.createdBy) return `${item.createdBy.firstName} ${item.createdBy.lastName}`;
  return item.createdById ? `Usuario ${item.createdById}` : "Sistema";
}

function MiniPanel({ title, action, onAction, children }) {
  return (
    <section className="rounded-card border border-park-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-sans text-lg font-black text-park-black">{title}</h3>
        <button className="text-xs font-black text-park-green" onClick={onAction} type="button">{action}</button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MiniRow({ left, middle, right }) {
  return <div className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-button bg-park-bg px-3 py-2 text-sm"><strong className="text-park-black">{left}</strong><span className="text-park-muted">{middle}</span><span className="font-black text-park-gold">{right}</span></div>;
}

function InventoryDrawer({ eyebrow, title, subtitle, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 p-3" onMouseDown={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-card bg-white p-5 shadow-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DrawerHeader eyebrow={eyebrow} title={title} onClose={onClose} />
        {subtitle ? <p className="mt-2 text-sm font-semibold text-park-muted">{subtitle}</p> : null}
        {children}
      </aside>
    </div>
  );
}

function DrawerFooter({ disabled = false, onCancel, submitLabel }) {
  return (
    <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-park-border pt-4">
      <button className="rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-muted" onClick={onCancel} type="button">Cancelar</button>
      <button
        className="rounded-button bg-park-green px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={disabled}
        type="submit"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <Label text={label} />
      <div className="flex h-11 items-center rounded-input border border-park-border bg-park-bg px-3 text-sm font-black text-park-black">{value || "-"}</div>
    </div>
  );
}

function StockPreview({ current, diff, mode, result, unit }) {
  const movementLabel = mode === "AJUSTE" ? "Diferencia" : mode === "SALIDA" ? "Salida" : "Entrada";
  const movementValue = mode === "AJUSTE" ? diff : (mode === "SALIDA" ? -Math.abs(diff) : Math.abs(diff));
  return (
    <div className={`rounded-card border p-4 ${result < 0 ? "border-red-200 bg-red-50" : "border-park-border bg-park-light"}`}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <MiniStock label="Stock actual" value={formatSmartQty(current, unit)} />
        <MiniStock label={movementLabel} value={formatSmartQty(movementValue, unit, true)} />
        <MiniStock label="Stock resultante" value={formatSmartQty(result, unit)} />
      </div>
      {result < 0 ? <p className="mt-3 text-xs font-black text-park-danger">La salida no puede dejar stock negativo.</p> : null}
      {mode === "AJUSTE" ? <p className="mt-3 text-xs font-semibold text-park-muted">El ajuste registra el stock fisico contado como nuevo stock final y genera un solo movimiento Kardex.</p> : null}
    </div>
  );
}

function MiniStock({ label, value }) {
  return <div><p className="text-xs font-black uppercase text-park-muted">{label}</p><strong className="text-base text-park-black">{value}</strong></div>;
}

function ConfirmDeactivateModal({ product, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-4" onMouseDown={onCancel}>
      <section className="w-full max-w-md rounded-card bg-white p-5 shadow-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Confirmacion</p>
            <h2 className="font-sans text-xl font-black text-park-black">Desactivar producto</h2>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-button border border-park-border" onClick={onCancel} type="button" aria-label="Cerrar"><X size={16} /></button>
        </div>
        <p className="mt-4 text-sm text-park-muted">El producto <strong className="text-park-black">{product.name}</strong> dejara de estar disponible para nuevas operaciones. Si tiene movimientos, se conservara su historial.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-muted" onClick={onCancel} type="button">Cancelar</button>
          <button className="rounded-button bg-park-danger px-4 py-2 text-sm font-black text-white" onClick={onConfirm} type="button">Desactivar</button>
        </div>
      </section>
    </div>
  );
}

function Panel({ title, children }) {
  return <section className="mt-5 rounded-card border border-park-border bg-white p-4"><h3 className="mb-3 text-xs font-black uppercase text-park-green">{title}</h3>{children}</section>;
}

function DrawerHeader({ eyebrow, title, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-park-border pb-4">
      <div>
        <p className="text-xs font-black uppercase text-park-gold">{eyebrow}</p>
        <h2 className="font-sans text-2xl font-black text-park-black">{title}</h2>
      </div>
      <button className="grid h-9 w-9 place-items-center rounded-button border border-park-border" onClick={onClose} type="button" aria-label="Cerrar"><X size={18} /></button>
    </div>
  );
}

function DetailLine({ label, value }) {
  return <div className="mb-3 grid grid-cols-[150px_1fr] gap-3 text-sm last:mb-0"><span className="font-semibold text-park-muted">{label}</span><strong className="text-park-black">{value || "-"}</strong></div>;
}

function EmptyPanel({ title, description }) {
  return <section className="rounded-card border border-park-border bg-white p-8 text-center shadow-card"><h3 className="font-sans text-lg font-black text-park-black">{title}</h3><p className="mt-1 text-sm text-park-muted">{description}</p></section>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("es-PE") : "-";
}

function formatQty(value) {
  return Number(value || 0).toFixed(2);
}

function formatSmartQty(value, unit = "", signed = false) {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  const normalizedUnit = unit.toLowerCase();
  const prefix = signed && number > 0 ? "+" : number < 0 ? "-" : "";
  if (normalizedUnit === "kg" && abs > 0 && abs < 1) return `${prefix}${trimNumber(abs * 1000)} g`;
  return `${prefix}${trimNumber(abs)} ${unit || ""}`.trim();
}

function formatLotOption(lot, unit = "") {
  const expiry = lot.expiresAt ? new Date(lot.expiresAt).toLocaleDateString("es-PE") : "sin vencimiento";
  return `${lot.code} · ${formatSmartQty(lot.currentQty, unit)} · vence ${expiry}`;
}

function trimNumber(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/\.?0+$/, "");
}

function categoriesForArea(categories, products, area) {
  const ids = new Set((products || []).filter((product) => !area || product.area === area).map((product) => String(product.categoryId)));
  const filtered = categories.filter((category) => ids.has(String(category.id)));
  return filtered.length ? filtered : categories;
}

function movementReasons(mode) {
  if (mode === "ENTRADA") return ["Compra", "Reposicion", "Devolucion", "Otro"];
  if (mode === "SALIDA") return ["Consumo operativo", "Deterioro", "Perdida", "Otro"];
  return ["Conteo fisico", "Diferencia de inventario", "Correccion administrativa"];
}

function recipeAvailability(recipe) {
  const missing = (recipe.items || []).filter((item) => !ingredientAvailability(item).ok);
  return { ok: !missing.length && Boolean(recipe.items?.length), missing };
}

function ingredientAvailability(item) {
  const required = convertPresentationQty(item.quantity, item.unit, item.product?.unit);
  if (required === null) return { ok: false, required: Number(item.quantity || 0) };
  return { ok: Number(item.product?.stock || 0) >= required, required };
}

function convertPresentationQty(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  const value = Number(quantity || 0);
  if (!from || !to || from === to) return value;
  if (from === "g" && to === "kg") return value / 1000;
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "ml" && to === "l") return value / 1000;
  if (from === "l" && to === "ml") return value * 1000;
  return null;
}

function normalizeUnit(unit = "") {
  const value = String(unit).trim().toLowerCase();
  if (["l", "lt", "lts", "litro", "litros"].includes(value)) return "l";
  if (["ml", "mililitro", "mililitros"].includes(value)) return "ml";
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(value)) return "kg";
  if (["g", "gr", "gramo", "gramos"].includes(value)) return "g";
  if (["und", "unidad", "unidades"].includes(value)) return "unidad";
  return value;
}

function productionWasteLines(production) {
  return [{ label: "Total", value: formatSmartQty(production.wasteQty, production.inputProduct?.unit) }];
}

function movementProductionLabel(move, production) {
  if (move.productId === production.inputProductId && move.type === "SALIDA") return "Salida produccion";
  if (move.productId === production.outputProductId && move.type === "ENTRADA") return "Entrada produccion";
  return move.type;
}

function formatReference(reference) {
  if (!reference) return "";
  if (reference.startsWith("PRODUCCION:")) return `Produccion ${reference.replace("PRODUCCION:", "#")}`;
  if (reference.startsWith("CONSUMO_RECETA:")) return `Consumo receta pedido #${reference.replace("CONSUMO_RECETA:", "")}`;
  return reference;
}

function Metric({ icon, label, value }) { return <div className="rounded-card border border-park-border bg-park-bg p-4"><div className="flex items-center gap-2 text-park-green">{icon}<span className="text-xl font-black">{value}</span></div><p className="mt-1 text-xs font-black uppercase text-park-muted">{label}</p></div>; }
function Action({ icon, label, onClick }) { return <button className="inline-flex items-center gap-2 rounded-button border border-park-border px-4 py-2 text-sm font-black text-park-green hover:bg-park-light" onClick={onClick}>{icon}{label}</button>; }
function Label({ text }) { return <label className="mb-1 block text-xs font-black uppercase text-park-muted">{text}</label>; }
function Input({ label, value, onChange, ...props }) { return <div><Label text={label} /><input className="h-11 w-full rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green focus:ring-2 focus:ring-park-green/15" value={value} onChange={(event) => onChange(event.target.value)} required {...props} /></div>; }
function Select({ label, value, onChange, children, ...props }) { return <div><Label text={label} /><select className="h-11 w-full rounded-input border border-park-border px-3 text-sm outline-none focus:border-park-green focus:ring-2 focus:ring-park-green/15" value={value} onChange={(event) => onChange(event.target.value)} required {...props}>{children}</select></div>; }
function areaLabel(value) { return value ? value.replaceAll("_", " ") : "-"; }
function movementUser(move) {
  if (move.createdBy) return `${move.createdBy.firstName} ${move.createdBy.lastName}`;
  return move.createdById ? `Usuario ${move.createdById}` : "Sistema";
}
