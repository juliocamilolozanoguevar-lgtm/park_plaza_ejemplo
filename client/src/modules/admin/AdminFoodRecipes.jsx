import { useMemo, useState } from "react";
import { BookOpen, ChefHat, Edit3, Eye, Plus, Save, X } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { StatusBadge } from "../../components/StatusBadge";
import { Toast } from "../../components/Toast";
import { Button, Input, Select, Tabs } from "../../components/ui";
import { api } from "../../services/api";
import { useFetch } from "../../hooks/useFetch";

const AREA = "RESTAURANTE";
const emptyRecipe = { id: null, name: "", active: true, items: [{ productId: "", quantity: "", unit: "" }] };

export function AdminFoodRecipes() {
  const [tab, setTab] = useState("PLATOS");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeForm, setRecipeForm] = useState(emptyRecipe);
  const [toast, setToast] = useState("");

  const { data: recipes, loading: recipesLoading, reload: reloadRecipes } = useFetch(`/recipes?area=${AREA}`, { initialData: [] });
  const { data: products, loading: productsLoading } = useFetch(`/inventory?area=${AREA}`, { initialData: [] });

  const tabs = [
    { value: "PLATOS", label: "Platos" },
    { value: "RECETAS", label: "Recetas" }
  ];

  async function saveRecipe(event) {
    event.preventDefault();
    const payload = {
      name: recipeForm.name,
      area: AREA,
      active: recipeForm.active,
      items: recipeForm.items.filter((item) => item.productId && Number(item.quantity) > 0)
    };
    if (!payload.items.length) return setToast("Agrega al menos un ingrediente.");
    await api(recipeForm.id ? `/recipes/${recipeForm.id}` : "/recipes", {
      method: recipeForm.id ? "PUT" : "POST",
      body: payload
    });
    setRecipeForm(emptyRecipe);
    setToast(recipeForm.id ? "Receta actualizada." : "Receta creada.");
    reloadRecipes();
  }

  async function toggleRecipe(recipe) {
    await api(`/recipes/${recipe.id}/active`, { method: "PATCH", body: { active: !recipe.active } });
    setToast(recipe.active ? "Receta desactivada." : "Receta activada.");
    reloadRecipes();
  }

  function editRecipe(recipe) {
    setRecipeForm({
      id: recipe.id,
      name: recipe.name,
      active: recipe.active,
      items: recipe.items?.length
        ? recipe.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unit: item.unit }))
        : emptyRecipe.items
    });
    setTab("RECETAS");
  }

  function updateItem(index, key, value) {
    setRecipeForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const selected = key === "productId" ? products.find((p) => String(p.id) === String(value)) : null;
        return { ...item, [key]: value, unit: selected?.unit || item.unit };
      })
    }));
  }

  if (recipesLoading || productsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <Toast message={toast} onClose={() => setToast("")} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "PLATOS" ? (
        <PlatosView recipes={recipes} onViewRecipe={(recipe) => { setSelectedRecipe(recipe); }} onEdit={editRecipe} onToggle={toggleRecipe} onNewPlato={() => setTab("RECETAS")} />
      ) : null}

      {tab === "RECETAS" ? (
        <RecetasView
          recipes={recipes}
          products={products}
          recipeForm={recipeForm}
          setRecipeForm={setRecipeForm}
          updateItem={updateItem}
          onSave={saveRecipe}
          onEdit={editRecipe}
          onToggle={toggleRecipe}
        />
      ) : null}

      {selectedRecipe ? (
        <RecipeDetailDrawer recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      ) : null}
    </div>
  );
}

/* ─── VISTA PLATOS ─────────────────────────────────────────── */
function PlatosView({ recipes, onViewRecipe, onEdit, onToggle, onNewPlato }) {
  return (
    <section className="rounded-card border border-park-border bg-white shadow-card">
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b border-park-border px-5 py-4">
        <div>
          <h2 className="font-sans text-base font-black text-park-black">Platos del restaurante</h2>
          <p className="mt-0.5 text-xs text-park-muted">Listado de platos con sus recetas asociadas.</p>
        </div>
        <Button icon={Plus} onClick={onNewPlato} type="button">
          Nueva receta
        </Button>
      </div>

      {/* Tabla */}
      {!recipes.length ? (
        <div className="p-5">
          <EmptyState
            title="Sin platos registrados"
            description="Registra recetas para que los platos aparezcan aquí."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-park-muted bg-park-bg">
              <tr>
                <th className="py-3 px-5">Nombre del plato</th>
                <th className="px-3">Estado</th>
                <th className="px-3">Ingredientes</th>
                <th className="px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-park-border">
              {recipes.map((recipe) => (
                <tr key={recipe.id} className="transition hover:bg-park-bg">
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-button bg-park-green-soft text-park-green">
                        <ChefHat size={14} />
                      </span>
                      <span className="font-black text-park-black">{recipe.name}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} />
                  </td>
                  <td className="px-3 text-park-muted">
                    {recipe.items?.length
                      ? `${recipe.items.length} ingrediente${recipe.items.length !== 1 ? "s" : ""}`
                      : "Sin ingredientes"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        icon={Eye}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => onViewRecipe(recipe)}
                      >
                        Ver receta
                      </Button>
                      <Button
                        icon={Edit3}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => onEdit(recipe)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant={recipe.active ? "danger" : "secondary"}
                        onClick={() => onToggle(recipe)}
                      >
                        {recipe.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─── VISTA RECETAS ─────────────────────────────────────────── */
function RecetasView({ recipes, products, recipeForm, setRecipeForm, updateItem, onSave, onEdit, onToggle }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      {/* Lista de recetas */}
      <div className="rounded-card border border-park-border bg-white shadow-card">
        <div className="border-b border-park-border px-5 py-4">
          <h2 className="font-sans text-base font-black text-park-black">Recetas registradas</h2>
          <p className="mt-0.5 text-xs text-park-muted">
            {recipes.length} receta{recipes.length !== 1 ? "s" : ""} en el sistema.
          </p>
        </div>
        {!recipes.length ? (
          <div className="p-5">
            <EmptyState
              title="Sin recetas"
              description="Registra recetas para conectar pedidos con ingredientes."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-park-muted bg-park-bg">
                <tr>
                  <th className="py-3 px-5">Receta</th>
                  <th className="px-3">Ingredientes</th>
                  <th className="px-3">Estado</th>
                  <th className="px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-park-border">
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="transition hover:bg-park-bg">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-park-muted flex-shrink-0" />
                        <span className="font-black text-park-black">{recipe.name}</span>
                      </div>
                    </td>
                    <td className="px-3 text-park-muted">
                      {recipe.items?.length ? (
                        <ul className="space-y-0.5">
                          {recipe.items.slice(0, 3).map((item, idx) => (
                            <li key={idx} className="text-xs">
                              {item.product?.name || "—"} — {Number(item.quantity)} {item.unit}
                            </li>
                          ))}
                          {recipe.items.length > 3 && (
                            <li className="text-xs text-park-green font-semibold">
                              +{recipe.items.length - 3} más…
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-xs">Sin ingredientes</span>
                      )}
                    </td>
                    <td className="px-3">
                      <StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          icon={Edit3}
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => onEdit(recipe)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant={recipe.active ? "danger" : "secondary"}
                          onClick={() => onToggle(recipe)}
                        >
                          {recipe.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulario */}
      <form className="rounded-card border border-park-border bg-white p-5 shadow-card self-start" onSubmit={onSave}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-sans text-base font-black text-park-black">
            {recipeForm.id ? "Editar receta" : "Nueva receta"}
          </h2>
          {recipeForm.id ? (
            <Button icon={X} type="button" variant="secondary" onClick={() => setRecipeForm(emptyRecipe)}>
              Cancelar
            </Button>
          ) : null}
        </div>
        <Input
          label="Nombre de la receta / plato"
          value={recipeForm.name}
          onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
          required
        />
        <div className="mt-4 space-y-3">
          {recipeForm.items.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-card border border-park-border bg-park-bg p-3 sm:grid-cols-[1fr_80px_80px_auto]"
            >
              <Select
                label="Ingrediente"
                value={item.productId}
                onChange={(e) => updateItem(index, "productId", e.target.value)}
                required
              >
                <option value="">Seleccionar</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.unit})
                  </option>
                ))}
              </Select>
              <Input
                label="Cantidad"
                min="0.01"
                step="0.01"
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                required
              />
              <Input
                label="Unidad"
                value={item.unit}
                onChange={(e) => updateItem(index, "unit", e.target.value)}
                required
              />
              <div className="flex items-end">
                <Button
                  className="w-full"
                  icon={X}
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setRecipeForm({
                      ...recipeForm,
                      items: recipeForm.items.filter((_, i) => i !== index).length
                        ? recipeForm.items.filter((_, i) => i !== index)
                        : emptyRecipe.items
                    })
                  }
                >
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button
            icon={Plus}
            type="button"
            variant="secondary"
            onClick={() =>
              setRecipeForm({ ...recipeForm, items: [...recipeForm.items, { productId: "", quantity: "", unit: "" }] })
            }
          >
            Agregar ingrediente
          </Button>
          <Button icon={Save} type="submit">
            Guardar receta
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ─── DRAWER DETALLE DE RECETA ──────────────────────────────── */
function RecipeDetailDrawer({ recipe, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 p-4">
      <aside className="ml-auto h-full max-w-md overflow-auto rounded-card bg-white p-5 shadow-drawer">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-park-gold">Detalle de receta</p>
            <h3 className="font-sans text-xl font-black text-park-black">{recipe.name}</h3>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-button border border-park-border text-park-muted hover:text-park-black"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3">
          <StatusBadge value={recipe.active ? "ACTIVO" : "INACTIVO"} />
        </div>

        <section className="mt-5 rounded-card border border-park-border bg-park-bg p-4">
          <h4 className="mb-4 text-xs font-black uppercase text-park-green">Ingredientes</h4>
          {recipe.items?.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-park-muted">
                <tr>
                  <th className="pb-2 text-left">Ingrediente</th>
                  <th className="pb-2 text-right">Cantidad</th>
                  <th className="pb-2 text-right">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-park-border">
                {recipe.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 font-semibold text-park-black">{item.product?.name || "—"}</td>
                    <td className="py-2 text-right text-park-muted">{Number(item.quantity)}</td>
                    <td className="py-2 text-right text-park-muted">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-park-muted">Sin ingredientes registrados.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
