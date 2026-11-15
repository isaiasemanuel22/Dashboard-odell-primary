# Costos y precios en Odell

Cómo calcula hoy la app el costo y el precio de cada cosa.
Relevado del código el 2026-11-14. Actualizado el 2026-11-15 con insumos +50 %, mínimo mayorista y venta a pérdida.

**Índice**

1. [La idea en 30 segundos](#1-la-idea-en-30-segundos)
2. [Qué forma el costo](#2-qué-forma-el-costo)
3. [Del costo al precio](#3-del-costo-al-precio)
4. [Mayorista](#4-mayorista)
5. [Descuento](#5-descuento)
6. [Productos: un ejemplo por tipo](#6-productos-un-ejemplo-por-tipo)
7. [Pedidos y presupuestos: cada tipo de línea](#7-pedidos-y-presupuestos-cada-tipo-de-línea)
8. [Un pedido completo en 4 casos](#8-un-pedido-completo-en-4-casos)
9. [Presupuesto → pedido](#9-presupuesto--pedido)
10. [Venta a pérdida](#10-venta-a-pérdida)
11. [Cosas para decidir](#11-cosas-para-decidir)

---

## 1. La idea en 30 segundos

- El **costo** es lo que te sale hacer algo: material, luz, máquina, un colchón por errores, tu tiempo y los insumos.
- El **precio** es el costo más tu margen de ganancia. Tu tiempo **no** lleva margen: se cobra tal cual. Los insumos se cobran con un **50 %** encima de su costo.
- El **mayorista** es un descuento en % sobre el precio de lista, para revendedores. Nunca baja del costo + 10 %.
- El **descuento** es una rebaja sobre el total del pedido o presupuesto.
- Ni el mayorista ni el descuento bajan el costo: salen de tu ganancia.
- Si algo se vende por debajo del costo, la app pide un motivo antes de guardar.

Todo se redondea al peso.

---

## 2. Qué forma el costo

| Parte | Cómo se calcula |
|---|---|
| Material | Lo que usa la pieza: gramos de filamento, ml de resina o papel de estampado |
| Purga | Solo FDM con AMS: los gramos que se tiran al cambiar de color |
| Luz | Consumo de cada máquina × horas de uso × precio del kWh |
| Máquina | Precio por hora de la máquina × horas de uso (su desgaste) |
| Margen de error | Un % sobre material + purga + luz + máquina |
| Mano de obra | Horas de trabajo × precio de tu hora |
| Insumos | Taza, cadena, imán, caja… a su precio |

**Para tener en cuenta**

- El margen de error **no** se calcula sobre la mano de obra, los insumos ni el alcohol de lavado de la resina.
- El precio del material sale del promedio de lo que cargaste en Insumos. Si no hay nada cargado, usa el de Ajustes.
- Cada máquina suma su luz y su desgaste por el tiempo que trabaja: impresora, lavadora, curadora o plancha.

---

## 3. Del costo al precio

> **Precio = (costo − mano de obra − insumos) × (1 + margen) + mano de obra + insumos × 1,5**

En palabras: el margen se aplica a material, purga, luz, máquina y margen de error. La mano de obra se suma al final, sin ganancia. Los insumos se suman con un 50 % fijo encima de su costo.

**Qué margen usa cada tipo**

| Tipo | Margen de Ajustes |
|---|---|
| FDM, resina y combo | Impresión 3D |
| Estampado | Estampado |
| Diseño gráfico | Diseño |
| Modelado | Modelado |

**Precio fijo.** Si le cargás un precio a mano a un producto, ese manda sobre el calculado.

**El precio no se actualiza solo.** Si cambian los Ajustes o los insumos, el precio guardado sigue igual hasta que uses «Actualizar precios».

**El margen que ves en pantalla** es la ganancia dividida por el costo sin la mano de obra. Si el precio es el calculado, te muestra justo el margen del área.

**Avisos.** Aparece un aviso en rojo si el precio queda por debajo del costo.

---

## 4. Mayorista

- Es un **% de descuento** sobre el precio de lista. Se configura en Ajustes y no hay un precio mayorista por producto.
- Se elige **para todo el pedido o presupuesto**. Viene marcado solo si el cliente es *Revendedor*.
- Solo se aplica si el pedido llega al **mínimo mayorista** del cliente (si tiene uno).

**Precio mínimo.** El precio mayorista nunca baja del **costo + 10 %** ni pasa del de lista. Si el % lo deja más abajo, la app usa el mínimo y muestra «Mayorista ajustado al mínimo (costo + 10 %)».

*Ejemplo:* costo $ 1.000, lista $ 1.200. El 20 % daría $ 960, así que se cobra $ 1.100.

**Precio a mano.** Si cambiás a mano el precio de una línea, se respeta tal cual: no se le aplica el mayorista ni el mínimo.

**A qué líneas se aplica**

| Línea | ¿Recibe mayorista? |
|---|---|
| Impresión 3D y estampado | Sí, de fábrica |
| Diseño y modelado | Solo si los activás en Ajustes |
| Insumo suelto | Nunca |
| Servicio de tercero | Nunca |

---

## 5. Descuento

- Hay **un solo descuento** por pedido o presupuesto: un % (hasta 99 %) o un monto fijo. No los dos a la vez.
- No hay descuento por línea ni descuento propio del combo.
- Se aplica **después** del mayorista. Si el pedido es mayorista y además tiene descuento, se acumulan.

> **Total = suma de las líneas − descuento**

La app no calcula IVA ni envío. Un envío se carga como línea de *Servicio de tercero*.

---

### Descuento del producto

Desde el 2026-11-15 un producto o combo puede tener su propio descuento, en % o monto fijo.

- El precio guardado sigue siendo la **lista**. Se vende a **lista − descuento**.
- *Ejemplo:* lista $ 10.000 con 15 % → se vende a $ 8.500. En mayorista (−20 %) → $ 6.800.
- Se acumula con el mayorista y con el descuento general del pedido, siempre con el mínimo de costo + 10 %.

---

## 6. Productos: un ejemplo por tipo

El catálogo tiene 4 tipos: **FDM, Resina, Estampado y Combo**.

Valores de ejemplo usados (en tus Ajustes pueden ser otros):

- Mano de obra $ 800/h · luz $ 85/kWh · margen de error 30 %.
- Margen de ganancia 100 % · mayorista 20 %.

### FDM

*100 g de PLA, 4 h de impresión, media hora de trabajo.*

| | $ |
|---|---:|
| Material | 1.800 |
| Luz | 41 |
| Máquina | 600 |
| Margen de error | 732 |
| Mano de obra | 400 |
| **Costo** | **3.573** |
| **Precio de lista** | **6.746** |
| **Precio mayorista** | **5.397** |

### Resina

*50 ml, 2 h de impresión, 10 min de lavado, 20 min de curado, un cuarto de hora de trabajo.*

| | $ |
|---|---:|
| Resina | 1.600 |
| Alcohol de lavado | 40 |
| Luz (impresora, lavadora y curadora) | 12 |
| Máquina (las tres) | 433 |
| Margen de error | 614 |
| Mano de obra | 200 |
| **Costo** | **2.899** |
| **Precio de lista** | **5.598** |
| **Precio mayorista** | **4.478** |

### Estampado

*Taza sublimada: una impresión de 10 × 20 cm, 5 min de plancha, un cuarto de hora de trabajo y la taza blanca de $ 1.500.*

| | $ |
|---|---:|
| Papel | 200 |
| Luz y máquina de la plancha | 10 |
| Margen de error | 63 |
| Mano de obra | 200 |
| Taza (insumo) | 1.500 |
| **Costo** | **1.973** |
| **Precio de lista** | **2.996** (proceso 746 + taza 1.500 × 1,5) |
| **Precio mayorista** | **2.397** |

La ganancia es de 58 % a precio de lista y de 24 % en mayorista. Antes del cambio del 2026-11-15, la taza iba sin margen y en mayorista se vendía a pérdida.

### Combo

El combo no tiene proceso propio:

- **Costo** = costo de sus piezas + tiempo de armado.
- **Precio de lista** = suma de los **precios** de sus piezas + armado sin margen (desde el 2026-11-15).
- Si tiene descuento, se resta de esa lista.

*Una pieza FDM como la de arriba (lista $ 6.746, costo $ 3.573), dos piezas de lista $ 2.000 y costo $ 1.000, media hora de armado y 10 % de descuento.*

| | Costo | Precio |
|---|---:|---:|
| Pieza FDM | 3.573 | 6.746 |
| 2 piezas | 2.000 | 4.000 |
| Armado | 400 | 400 |
| **Total / precio de lista** | **5.973** | **11.146** |
| Descuento 10 % | | −1.115 |
| **Precio de venta** | | **10.031** |
| **Precio mayorista** (−20 %) | | **8.025** |

**Para tener en cuenta**

- El costo de las piezas se recalcula con los Ajustes de hoy.
- El precio sale de sumar los precios de lista de las piezas; el armado se suma al costo.
- Los combos que ya existían mantienen su precio guardado hasta que toques «Usar precio calculado».

---

## 7. Pedidos y presupuestos: cada tipo de línea

Presupuestos y pedidos calculan igual. Cada línea guarda su precio y su costo.

### Producto del catálogo

- **Precio:** el de lista del producto. Se puede cambiar.
- **Costo:** el del producto el día que cargaste la línea. Queda fijo.
- **Línea:** cantidad × precio.

Si después cambia el producto en el catálogo, la línea te avisa y te deja actualizar el costo o el precio con un botón.

### Impresión 3D o estampado a medida (sin producto)

Se cargan los gramos, horas, impresiones e insumos en la misma línea. Costo y precio se calculan igual que un producto (secciones 2 y 3), con los insumos +50 %.

### Diseño gráfico y modelado

- **Costo:** tarifa por hora × horas presupuestadas, o un monto fijo que cargás vos.
- **Precio:** costo + margen del área.
- **Se cobra una sola vez**, no se multiplica por la cantidad.

*Ejemplo:* logo de 3 h a $ 5.000/h. Costo $ 15.000, precio $ 22.500.

**Con impresos:** se suma el papel de cada impreso, al costo y sin margen. *Ejemplo:* 100 flyers con papel de $ 30 c/u suman $ 3.000. Total $ 25.500.

### Insumo suelto

- **Precio:** el del insumo.
- **Costo:** igual al precio. No deja ganancia, salvo que cambies alguno de los dos.

### Servicio de tercero

- **Precio:** lo cargás vos.
- Se considera plata que se le paga entera al tercero, así que no suma ganancia.

### Ganancia del pedido

> **Ganancia = total − costo de las líneas − lo cobrado por terceros**

Si hay descuento, se reparte entre todas las líneas, también la del tercero.

---

## 8. Un pedido completo en 4 casos

**Las líneas**

| Línea | Cant. | Precio | Costo c/u |
|---|---:|---:|---:|
| Pieza FDM | 4 | 6.746 | 3.573 |
| Taza estampada | 2 | 2.996 | 1.973 |
| Diseño de logo | 1 | 22.500 | 15.000 |
| Cadena (insumo) | 10 | 100 | 100 |
| Envío (tercero) | 1 | 3.000 | — |

Costo total del pedido: **$ 34.238**.

**Resultados**

| Caso | Total | Ganancia |
|---|---:|---:|
| Minorista | 59.476 | 22.238 |
| Minorista con 10 % de descuento | 53.528 | 16.590 |
| Mayorista | 52.882 | 15.644 |
| Mayorista con 10 % de descuento | 47.594 | 10.656 |

**Qué cambia en mayorista**

- La pieza FDM baja de $ 6.746 a $ 5.397.
- La taza baja de $ 2.996 a $ 2.397. Sigue arriba de su costo.
- El diseño, la cadena y el envío no cambian.

---

## 9. Presupuesto → pedido

- Solo pasa a pedido un presupuesto **aceptado y no vencido**. Vence a los 15 días y se puede renovar.
- Se copian las líneas con sus precios y costos, el mayorista, el descuento, la descripción y los adjuntos.
- **Se respetan los precios presupuestados:** no se vuelve a calcular el mayorista.
- Si el presupuesto tenía motivo de venta a pérdida, pasa al pedido.

---

## 10. Venta a pérdida

Se puede vender por debajo del costo, pero hay que decir por qué.

**Cuándo avisa.** Al guardar un pedido, un presupuesto o una venta de mostrador, si pasa alguna de estas cosas:

- una línea tiene precio menor que su costo;
- la ganancia total queda negativa, por ejemplo por un descuento grande.

**Qué pide.** Muestra cuánto pierde cada línea y pide elegir un motivo:

1. Liquidación de stock o producto discontinuado
2. Producto con falla o segunda selección
3. Compensación por un error o reclamo
4. Muestra o prueba para un cliente nuevo
5. Promoción o lanzamiento
6. Cliente frecuente o fidelización
7. Pedido grande que trae más trabajo
8. Canje o colaboración (difusión, sorteo, influencer)
9. Igualar el precio de la competencia
10. El costo cargado está mal (el real es menor)
11. Otro (con texto obligatorio)

**Dónde queda.** El motivo se ve en el detalle del pedido, presupuesto o venta, y en el historial del pedido. Si después subís el precio y deja de haber pérdida, el aviso se va solo.

---

## 11. Cosas para decidir

1. **Costo fijo en pedidos.** La regla de negocio §17 dice que se actualiza solo; la app lo deja fijo y lo actualizás con un botón.
2. **Diseño con cantidad mayor a 1.** El formulario lo cuenta una vez, pero la ganancia estimada del presupuesto multiplica el costo por la cantidad.
3. **Actualizar precios en masa.** El margen que muestra no descuenta la mano de obra, y no coincide con el del detalle.
4. **Estampados viejos.** Los que no tienen la lista de impresiones pueden dar un costo de papel distinto según dónde se mire.
5. **Reglas desactualizadas.** En `BUSINESS-RULES.md`, §16.2 dice margen 0 % por defecto (el código usa 40/50/50/35) y §25.6 dice que algo no está hecho cuando ya está.
