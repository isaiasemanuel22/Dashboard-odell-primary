import { test, expect, type Page } from "./fixtures";
import {
  apiGet,
  api,
  cleanupCreated,
  createCustomer,
  createOrder,
  createProduct,
  e2eName,
} from "./helpers/api";
import { gotoApp } from "./helpers/nav";

interface ProductDto {
  id: string;
  name: string;
  price: number;
  cost: number;
  suggestedPrice?: number | null;
  description?: string;
}

/** Categoria FDM existente del catalogo local (se resuelve por API, no se crea nada). */
let categoryId = "";

/** Cuerpo minimo valido de un producto FDM "Calculado" (sin suggestedPrice). */
function fdmBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "fdm",
    grams: 50,
    printTimeHours: 2,
    workTimeHours: 0,
    filamentType: "pla",
    price: 5000,
    cost: 3000,
    size: "E2E",
    categoryIds: [categoryId],
    ...overrides,
  };
}

const money = (text: string): number =>
  Number(text.replace(/[^\d,-]/g, "").replace(",", ".")) || 0;

async function postRaw(path: string, body: unknown) {
  const res = await (await api()).post(path, { data: body });
  let json: { message?: string | string[] } = {};
  try {
    json = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status(), json };
}

async function openNewProduct(page: Page) {
  await gotoApp(page, "/productos");
  await page
    .getByRole("button", { name: /Nuevo producto/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Nuevo producto" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function search(page: Page, text: string) {
  await page.getByRole("searchbox", { name: "Buscar productos" }).fill(text);
}

async function openEdit(page: Page, name: string) {
  await gotoApp(page, "/productos");
  await search(page, name);
  const card = page.locator(".product-card", { hasText: name });
  await expect(card).toHaveCount(1);
  const dialog = page.getByRole("dialog");
  // El menu se puede cerrar si la lista se recarga: reintenta abrir y elegir Editar.
  await expect(async () => {
    if (!(await card.getByRole("button", { name: "Editar" }).isVisible())) {
      await card.getByRole("button", { name: "Más acciones" }).click();
    }
    await card
      .getByRole("button", { name: "Editar" })
      .click({ timeout: 2_000 });
    await expect(
      dialog.getByRole("button", { name: "Guardar cambios" }),
    ).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 20_000 });
  return dialog;
}

test.beforeAll(async () => {
  const cats =
    await apiGet<Array<{ id: string; productTypes: string[] }>>("categories");
  const cat = cats.find((c) => c.productTypes.includes("fdm"));
  if (!cat) throw new Error("No hay categorias FDM en la base local");
  categoryId = cat.id;
});

test.afterAll(async () => {
  await cleanupCreated();
});

test.describe("Productos - regresion de reglas corregidas", () => {
  test("A-4: crear un producto no cambia el precio guardado de otro", async () => {
    const a = await createProduct(
      fdmBody({ name: e2eName("A4 existente"), price: 4321 }),
    );
    const antes = await apiGet<ProductDto>(`products/${a.id}`);
    const b = await createProduct(
      fdmBody({ name: e2eName("A4 nuevo"), price: 6789, grams: 200 }),
    );
    expect(b.id).not.toBe(a.id);
    const despues = await apiGet<ProductDto>(`products/${a.id}`);
    expect(despues.price).toBe(antes.price);
    expect(despues.cost).toBe(antes.cost);
    // Y tampoco al crear un combo con A como pieza.
    const combo = await createProduct({
      name: e2eName("A4 combo"),
      type: "combo",
      workTimeHours: 0,
      price: 9000,
      cost: 5000,
      categoryIds: [await comboCategory()],
      components: [{ productId: a.id, quantity: 1 }],
    });
    expect(combo.id).toBeTruthy();
    const final = await apiGet<ProductDto>(`products/${a.id}`);
    expect(final.price).toBe(antes.price);
  });

  test("A-8: editar un producto Calculado solo con la descripcion mantiene el precio", async ({
    page,
  }) => {
    const p = await createProduct(
      fdmBody({ name: e2eName("A8 calculado"), price: 4777 }),
    );
    const antes = await apiGet<ProductDto>(`products/${p.id}`);
    expect(antes.suggestedPrice ?? null).toBeNull();

    const dialog = await openEdit(page, p.name);
    await dialog.getByLabel("Descripción").fill("Descripcion editada por E2E");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    // Si la app pidiera confirmar un cambio de precio, lo rechazamos: la regla es que no cambia solo.
    const confirmDialog = page
      .getByRole("dialog")
      .filter({ hasText: /Al guardar pasa a/ });
    if (await confirmDialog.isVisible().catch(() => false)) {
      throw new Error(
        "La app intento cambiar el precio al guardar un producto Calculado",
      );
    }
    await expect
      .poll(
        async () => (await apiGet<ProductDto>(`products/${p.id}`)).description,
      )
      .toBe("Descripcion editada por E2E");
    const despues = await apiGet<ProductDto>(`products/${p.id}`);
    expect(despues.price).toBe(antes.price);
  });

  test("A-3: no se puede eliminar un producto que esta en un pedido abierto", async ({
    page,
  }) => {
    const p = await createProduct(
      fdmBody({ name: e2eName("A3 en pedido"), price: 5000 }),
    );
    const customer = await createCustomer();
    const users =
      await apiGet<Array<{ firebaseUid: string }>>("user-access/users");
    const order = await createOrder({
      customerId: customer.id,
      dueDate: "2030-12-30",
      responsibleUserId: users[0].firebaseUid,
      items: [
        {
          serviceType: "impresion_3d",
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    });
    expect(order.id).toBeTruthy();

    const res = await (await api()).delete(`products/${p.id}`);
    expect(res.status()).toBe(409);
    const body = (await res.json()) as { message: string | string[] };
    const msg = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message;
    expect(msg.length).toBeGreaterThan(10);
    expect((await apiGet<ProductDto>(`products/${p.id}`)).id).toBe(p.id);

    // UI
    await gotoApp(page, "/productos");
    await search(page, p.name);
    const card = page.locator(".product-card", { hasText: p.name });
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "Más acciones" }).click();
    await card.getByRole("button", { name: "Eliminar" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar", exact: true })
      .click();
    const err = page
      .getByRole("dialog")
      .filter({ hasText: "No se pudo eliminar" });
    await expect(err).toBeVisible();
    await expect(err).toContainText(msg.slice(0, 20));
    await err.getByRole("button", { name: "Entendido" }).click();
  });

  test("M-2: nombre duplicado (otra mayuscula o tilde) devuelve 409", async () => {
    const base = e2eName("Árbol Único");
    await createProduct(fdmBody({ name: base }));
    for (const variant of [
      base.toUpperCase(),
      base.toLowerCase(),
      base.replace("Á", "A"),
    ]) {
      const r = await postRaw("products", { ...fdmBody(), name: variant });
      expect(r.status, `variante "${variant}"`).toBe(409);
    }
    const r = await postRaw("products", { ...fdmBody(), name: `  ${base}  ` });
    expect(r.status).toBe(409);
  });

  test("M-3: la busqueda ignora tildes y mayusculas; sin resultados ofrece limpiar", async ({
    page,
  }) => {
    const p = await createProduct(fdmBody({ name: e2eName("Búsqueda Árbol") }));
    await gotoApp(page, "/productos");
    for (const term of ["busqueda arbol", "BÚSQUEDA ÁRBOL", "busqueda árbol"]) {
      await search(
        page,
        `${p.name.split(" ")[0]} ${term}`.toLowerCase().replace("e2e-", "e2e-"),
      );
      await expect(
        page.locator(".product-card", { hasText: p.name }),
      ).toHaveCount(1);
    }
    await search(page, "zzz-sin-coincidencias-e2e");
    await expect(
      page
        .getByText(/Sin resultados para/)
        .locator("visible=true")
        .first(),
    ).toBeVisible();
    const limpiar = page
      .getByRole("button", { name: "Limpiar búsqueda" })
      .locator("visible=true")
      .first();
    await expect(limpiar).toBeVisible();
    await limpiar.click();
    await expect(
      page.getByRole("searchbox", { name: "Buscar productos" }),
    ).toHaveValue("");
  });

  test('E40: el material PLA del producto 3D dice "promedio de Insumos"', async ({
    page,
  }) => {
    const dialog = await openNewProduct(page);
    const pla = dialog
      .locator("select option")
      .filter({ hasText: /^\s*PLA\b/ });
    await expect(pla).toHaveCount(1);
    await expect(pla).toContainText("promedio de Insumos");
  });

  test("Mano de obra sin margen: el desglose lo dice y el precio cumple la formula", async ({
    page,
  }) => {
    const dialog = await openNewProduct(page);
    await dialog.getByLabel("Gramos").first().fill("100");
    await dialog.locator('input[name="print-hours-0"]').fill("3");
    await dialog.locator('input[name="labor-hours-0"]').fill("2");

    const aside = dialog.locator(".price-card");
    await expect(aside.getByText(/Mano de obra \(sin margen\)/)).toBeVisible();

    const row = (label: RegExp) =>
      aside
        .locator("dl > div, .price-margin > div")
        .filter({ hasText: label })
        .first();
    const read = async () => {
      const cost = money(
        await row(/^Costo total/)
          .locator("dd")
          .innerText(),
      );
      const labor = money(
        await row(/Mano de obra \(sin margen\)/)
          .locator("dd")
          .innerText(),
      );
      const marginText = await row(/Margen objetivo/).innerText();
      const margin =
        Number(marginText.match(/:\s*([\d.,]+)\s*%/)?.[1].replace(",", ".")) /
        100;
      const price = money(
        await aside.locator(".price-margin__sale strong").innerText(),
      );
      const expected = (cost - labor) * (1 + margin) + labor;
      return { cost, labor, margin, price, expected };
    };
    // Espera a que el calculo (asincrono) termine y se estabilice.
    await expect
      .poll(
        async () => {
          const r = await read();
          return (
            r.labor > 0 &&
            r.margin > 0 &&
            r.price > 0 &&
            Math.abs(r.price - r.expected) <= Math.max(60, r.expected * 0.01)
          );
        },
        { message: "precio = (costo - MO) x (1 + margen) + MO" },
      )
      .toBe(true);
    // Y no es el calculo viejo con margen sobre la mano de obra.
    const r = await read();
    expect(Math.abs(r.price - r.cost * (1 + r.margin))).toBeGreaterThan(
      Math.abs(r.price - r.expected),
    );
  });

  test('E90: al editar, "Guardar cambios" esta visible sin scrollear', async ({
    page,
  }) => {
    const p = await createProduct(fdmBody({ name: e2eName("E90 pie") }));
    const dialog = await openEdit(page, p.name);
    const guardar = dialog.getByRole("button", { name: "Guardar cambios" });
    await expect(guardar).toBeInViewport({ ratio: 1 });
  });
});

let comboCat = "";
async function comboCategory(): Promise<string> {
  if (comboCat) return comboCat;
  const cats =
    await apiGet<Array<{ id: string; productTypes: string[] }>>("categories");
  const cat = cats.find((c) => c.productTypes.includes("combo"));
  if (!cat) throw new Error("No hay categorias de combo en la base local");
  comboCat = cat.id;
  return comboCat;
}
