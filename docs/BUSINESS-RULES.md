# Odell — Reglas de negocio

> **Fuente de verdad del dominio comercial de Odell.**
>
> Este documento contiene únicamente reglas de negocio confirmadas por el
> propietario del sistema durante el relevamiento.
>
> Si una funcionalidad necesita una regla que no esté definida aquí, la IA
> debe considerarla **POR DEFINIR** y solicitar aclaración antes de asumirla.

---

## 1. Concepto general

Odell es un negocio híbrido que comercializa productos propios, productos
personalizados y servicios.

Actualmente contempla, entre otras, las áreas de impresión 3D, estampado,
grabado, diseño gráfico, modelado 3D y ventas. Las áreas son configurables
por un administrador.

El dominio distingue:

- **Producto:** el bien que el cliente recibe.
- **Servicio:** un trabajo que debe realizar un área y que genera una tarea.
- **Ítem de pedido:** un producto o servicio incluido en una operación.
- **Tarea:** la ejecución concreta de un servicio o de una actividad interna.

Un producto puede estar vinculado con uno o varios servicios. Esos vínculos
representan opciones de trabajo posibles, pero no determinan automáticamente
qué servicios necesita cada pedido.

En productos personalizados, el vendedor determina si el trabajo solicitado
requiere agregar uno o más ítems de servicio independientes, por ejemplo
Diseño gráfico. Cada ítem de servicio confirmado genera su propia tarea.

La personalización que define al producto forma parte del producto elegido.
Por ejemplo, `Taza estampada` es el producto; si además se necesita crear el
diseño, `Diseño gráfico para taza estampada` es otro ítem del pedido.

---

## 2. Catálogo

Odell tiene un único catálogo unificado de productos.

Los productos del catálogo pueden estar publicados o no publicados.

### 2.1 Productos publicados

Un producto publicado:

- forma parte de la oferta directa de Odell;
- puede venderse directamente si existe stock;
- puede formar parte de un pedido si no existe stock suficiente.

Los productos publicados son productos que Odell vende de forma directa y
produce de forma continua.

### 2.2 Productos no publicados

Un producto no publicado puede ser:

- un producto personalizado creado para un cliente;
- una pieza o componente utilizado internamente para formar otros productos.

Las piezas internas no se venden directamente como productos individuales.

### 2.3 Publicado no significa disponible

Un producto puede estar publicado y no tener stock.

Por lo tanto:

- `publicado` indica que forma parte de la oferta directa;
- `stock` determina si puede realizarse una venta inmediata.

Cada producto mantiene su propia cantidad de stock terminado. Este stock es
distinto del inventario de materiales e insumos utilizados para producirlo.

No debe asumirse que:

```text
publicado = disponible
```

---

## 3. Producto

Cada producto contiene información comercial suficiente para determinar:

- precio;
- costo;
- ganancia.

El costo y el precio forman parte del objeto de producto.

La ganancia deriva de esos valores.

Los productos también pueden contener la información necesaria para su
producción y composición.

Un producto personalizado puede estar relacionado con servicios de distintas
áreas. Esas relaciones sirven como referencia para el vendedor, pero no
agregan trabajos automáticamente.

El vendedor determina qué servicios requiere el pedido del cliente y los
agrega como ítems independientes. Puede omitir un servicio, por ejemplo
Diseño gráfico cuando el cliente ya entrega el diseño.

---

## 4. Carrito

El carrito es el punto de partida de una operación comercial.

Un carrito puede contener:

- productos existentes del catálogo;
- productos nuevos que necesitan ser presupuestados;
- servicios independientes;
- servicios agregados manualmente como ítems relacionados con un producto.

Ejemplo:

```text
Carrito
├── Producto existente del catálogo
├── Producto existente del catálogo
├── Diseño personalizado
└── Producto nuevo a presupuestar
```

Un mismo carrito puede combinar productos de catálogo y productos
presupuestados.

---

## 5. Presupuestos

Cuando un carrito contiene un producto nuevo que no existe todavía en el
catálogo, ese producto debe ser presupuestado.

Se crea un presupuesto por cada producto que requiera presupuestación.

No se debe asumir que existe un único presupuesto para todo el carrito.

`Presupuesto` y `cotización` representan la misma entidad. En este documento
se utiliza únicamente el término `presupuesto`.

Un presupuesto tiene los siguientes estados:

```text
BORRADOR
ENVIADO
ACEPTADO
RECHAZADO
CANCELADO
```

Cuando el cliente acepta el presupuesto de un producto nuevo:

- el producto se crea en el catálogo como no publicado;
- el producto se incorpora al pedido.

Una operación puede contener varios presupuestos. El cliente puede aceptar
unos y rechazar otros. Se crea un único pedido con los productos
presupuestados aceptados y los demás ítems válidos de la operación; los
presupuestos rechazados quedan excluidos.

Un presupuesto inicial rechazado no genera un ítem de pedido.

Si un cliente solicita cambios sobre un ítem ya cotizado, se considera una
actualización del mismo ítem y puede requerir una recotización. Cuando la
recotización cambia el valor, únicamente las tareas del ítem modificado y sus
dependencias quedan bloqueadas hasta que el cliente acepte el nuevo precio.
Si el cliente rechaza la recotización, se cancelan el ítem afectado y sus
tareas; los demás ítems del pedido continúan.

---

## 6. Comercialización

Odell tiene dos formas principales de comercializar productos:

1. Venta directa.
2. Pedido.

Son conceptos diferentes.

---

## 7. Venta directa

La venta directa ocurre cuando un cliente llega, solicita un producto del
catálogo que está disponible y se lo lleva en el momento.

Flujo:

```text
Cliente
  ↓
Producto publicado
  ↓
Hay stock
  ↓
Venta
  ↓
Descuento de stock
  ↓
Cobro
  ↓
Finaliza la operación
```

Una venta directa solamente puede realizarse sobre productos del catálogo.

Los productos no publicados no participan de la venta directa.

Una venta directa puede ser anónima; no requiere obligatoriamente un cliente
identificado.

---

## 8. Producto publicado sin stock

Si un cliente solicita un producto publicado pero no hay stock suficiente,
no se realiza una venta directa.

La interfaz debe permitir crear un pedido utilizando el producto solicitado.

Ejemplo:

```text
Cliente solicita:
Taza Mickey Mouse

Stock:
0

Resultado:
Crear pedido
└── Taza Mickey Mouse
```

El producto sigue siendo el mismo producto del catálogo. No se convierte en
un producto personalizado solamente porque no haya stock.

---

## 9. Stock parcial

Si un pedido solicita una cantidad mayor que el stock disponible, se utiliza
todo el stock existente y solamente se produce la cantidad faltante.

Ejemplo:

```text
Solicitado: 5
Stock:      2

Desde stock:       2
A producir:       3
```

La producción nunca debe generarse innecesariamente para unidades que ya
están disponibles.

Las unidades fabricadas específicamente para un pedido quedan vinculadas
directamente a ese pedido y no ingresan al stock general.

El stock previsto para un pedido no se reserva al confirmar la operación. La
reserva ocurre cuando la tarea `Preparar pedido` pasa a `EN PROGRESO`:

- las unidades reservadas continúan formando parte del stock físico;
- dejan de estar disponibles para otras operaciones;
- el stock físico se descuenta cuando se registra la entrega.

Como el stock puede cambiar antes de comenzar la preparación, en ese momento
se recalculan las cantidades provenientes de stock y las cantidades que deben
producirse. Si aparece un faltante, se crea una tarea:

```text
Hacer {cantidad faltante} {nombre del producto}
```

Esa tarea representa la fabricación completa del producto. El sistema no
genera automáticamente subtareas técnicas. Si fueran necesarias, los usuarios
las crean manualmente.

Los incrementos y ajustes del stock general se cargan manualmente. Odell
puede crear tareas internas sin pedido asociado para producir stock, pero
terminar una tarea interna no incrementa el stock automáticamente. El usuario
debe cargar manualmente las unidades producidas. La entrega de productos sí
descuenta automáticamente las unidades reservadas.

### 9.1 Materiales e insumos

`Material` se utiliza únicamente para materiales de producción FDM y resina.
`Insumo` representa la cantidad disponible tanto de esos materiales como de
otros consumibles necesarios para estampado.

Para determinar la disponibilidad de FDM o resina, se suma la cantidad de
todos los insumos compatibles con el material requerido por el producto.

Cuando una reposición vuelve a cubrir los insumos faltantes, el sistema
notifica la disponibilidad pero no desbloquea la tarea automáticamente.
Únicamente el responsable actual de la tarea puede desbloquearla.

**POR DEFINIR:**

- la relación exacta entre cada Material y sus registros de Insumo;
- qué datos propios mantiene cada existencia, marca o compra.

Regla conceptual:

```text
cantidadDesdeStock = min(cantidadPendiente, stockDisponibleAlPreparar)

cantidadAProducir =
    max(cantidadPendiente - stockDisponibleAlPreparar, 0)
```

---

## 10. Pedido

El pedido se crea cuando un cliente identificado confirma una operación que
no se resuelve completamente mediante una venta directa inmediata.

Todo pedido requiere un cliente asociado. El pedido contiene ítems de
productos y servicios, sus cantidades y los ítems de servicio agregados
manualmente por el vendedor.

A partir de sus ítems se determina:

- valor total;
- costo total;
- ganancia total;
- cantidades provenientes de stock;
- cantidades que deben producirse;
- cantidades entregadas y pendientes.

Los productos que pueden satisfacerse mediante stock reservan las unidades
correspondientes al iniciar la preparación y las descuentan al entregarlas.
Cada ítem de servicio genera automáticamente su tarea al confirmarse el
pedido.

### 10.1 Modificación

Un pedido puede modificarse mientras esté `PENDIENTE` o `EN PROGRESO`.

- Agregar un ítem crea las tareas correspondientes.
- Cambiar una cantidad actualiza las tareas correspondientes.
- Quitar un ítem cancela sus tareas no terminadas y conserva el historial.

Si cualquiera de las tareas asociadas al ítem ya está terminada, el pedido
original no se modifica: se crea un pedido nuevo con los cambios.

No se modifican ítems de pedidos `TERMINADOS`, `PARCIALMENTE ENTREGADOS`,
`ENTREGADOS` o `CANCELADOS`.

### 10.2 Clonación

Un pedido puede clonarse para crear otro pedido independiente. El clon:

- comienza en `PENDIENTE`;
- genera tareas nuevas;
- copia cliente, ítems, cantidades y valores configurables;
- no copia pagos, entregas ni historial.

---

## 11. Servicios, productos y tareas

Un servicio representa trabajo y genera una tarea. Cuando un producto
personalizado necesita un servicio adicional, el vendedor lo agrega como un
ítem independiente del pedido.

Ejemplo:

```text
Producto: Taza estampada
└── Ítem adicional: Diseño gráfico para taza estampada
                     → tarea del área Diseño
```

El vendedor evalúa el pedido del cliente y agrega manualmente los ítems de
servicio necesarios. El sistema no infiere ni agrega automáticamente esos
trabajos.

Al confirmar el pedido:

- cada ítem de servicio genera una tarea;
- varias unidades iguales se agrupan en una sola tarea con la cantidad
  total;
- una tarea de servicio no mezcla productos o servicios distintos.

Cuando un producto debe fabricarse por falta de stock, el sistema genera una
única tarea `Hacer {cantidad} {producto}`. Las subtareas que el usuario cree
manualmente se consideran dependencias de esa tarea principal: la tarea
principal no puede terminar hasta que todas sus subtareas hayan terminado.

Cuando se confirma un pedido que incluye uno o más productos, se crea una
única tarea general `Preparar pedido #ID`, perteneciente al área Ventas. Esta
tarea abarca el pedido completo, tanto para productos de catálogo como
personalizados, aunque provengan de distintas áreas.

Un pedido compuesto únicamente por servicios no genera `Preparar pedido`.
Sin embargo, terminar sus tareas no equivale a entregarlo: puede permanecer
`TERMINADO` hasta que Ventas registre la entrega.

---

## 12. Tablero de tareas

Las tareas tienen un listado general fuera del tablero diario.

Una tarea puede permanecer fuera del tablero diario hasta que llegue el día
en que corresponde realizarla.

Cuando llega ese día, la tarea entra al tablero diario en:

```text
PENDIENTE
```

Luego puede avanzar por:

```text
PENDIENTE
    ↓
EN PROGRESO
    ↓
REVISION
    ↓
TERMINADO
```

`REVISION` es un estado de tarea.

`REVISION` no es un estado de pedido.

Las tareas también pueden estar `CANCELADAS`.

Una tarea también puede estar `BLOQUEADA`. Una tarea bloqueada no puede pasar
a `EN PROGRESO` hasta que se resuelva la condición que produjo el bloqueo.

### 12.1 Dependencias

Una tarea puede depender de una o varias tareas. Las dependencias se asignan
manualmente; el sistema no las infiere.

Una tarea dependiente no puede pasar a `EN PROGRESO` hasta que todas sus
dependencias estén en estado `TERMINADO`.

### 12.2 Área, permisos y responsable

Cada tarea pertenece a un área y solo puede ser vista o modificada por
usuarios cuyos roles otorguen la acción correspondiente para esa área.

Una tarea tiene un único responsable actual opcional. La asignación y la
reasignación son manuales. Al transferirla, el responsable actual debe
seleccionar al nuevo usuario. Solo se conserva el responsable actual, no el
historial de responsables.

### 12.3 Tareas internas

Odell puede crear tareas internas sin pedido asociado, por ejemplo producir
unidades para stock. Estas tareas utilizan el mismo flujo de estados, pero
no modifican el stock automáticamente.

Si faltan materiales o insumos necesarios para fabricar un producto, el
pedido puede confirmarse y debe mostrar una alerta. La tarea de producción
queda `BLOQUEADA` hasta que exista disponibilidad suficiente.

### 12.4 Preparación del pedido

`Preparar pedido` pertenece exclusivamente al área Ventas. Producción se
encarga de fabricar; Ventas se encarga de preparar y entregar.

La tarea se crea automáticamente al confirmar el pedido y comienza
`BLOQUEADA`.

Ventas puede pasar `Preparar pedido` a `EN PROGRESO` cuando exista al menos
un ítem disponible, ya sea proveniente del stock que puede reservarse o de
una tarea de producción terminada o parcialmente completada. En ese momento
se reserva el stock disponible y se recalcula cualquier faltante que deba
producirse. Ventas no necesita esperar toda la producción y puede gestionar
entregas parciales.

La tarea permanece activa durante las entregas parciales y pasa a
`TERMINADO` únicamente cuando todos los ítems están completos y todo el
pedido está preparado para la entrega final.

---

## 13. Estados del pedido

Los pedidos tienen los siguientes estados:

```text
PENDIENTE
EN PROGRESO
TERMINADO
PARCIALMENTE ENTREGADO
ENTREGADO
CANCELADO
```

No debe agregarse `REVISION` como estado de pedido.

Los estados normales del pedido se calculan automáticamente a partir de sus
tareas y entregas. Los usuarios no los cambian manualmente. `CANCELADO` es la
excepción y se origina mediante una acción manual autorizada.

Cuando coinciden condiciones de distintos estados, se aplica esta prioridad:

```text
CANCELADO
    ↓
ENTREGADO
    ↓
PARCIALMENTE ENTREGADO
    ↓
TERMINADO / EN PROGRESO / PENDIENTE según tareas
```

### 13.1 Pedido pendiente

Un pedido está `PENDIENTE` cuando ninguna tarea asociada está en progreso o
revisión y todavía existe al menos una tarea necesaria en estado `PENDIENTE`
o `BLOQUEADA`, incluidas las tareas de producción, servicio o preparación.

Las tareas también pueden encontrarse fuera del tablero diario.

### 13.2 Pedido en progreso

Un pedido pasa a `EN PROGRESO` cuando al menos una de sus tareas está en:

- `EN PROGRESO`; o
- `REVISION`.

Por lo tanto:

```text
alguna tarea EN PROGRESO
        O
alguna tarea REVISION
        ↓
PEDIDO EN PROGRESO
```

### 13.3 Pedido terminado

Un pedido pasa a `TERMINADO` cuando todas las tareas necesarias para
satisfacerlo están terminadas.

Un pedido de productos de catálogo cuenta con la tarea `Preparar pedido`, por
lo que no debe considerarse terminado únicamente por no requerir producción.

Un pedido compuesto únicamente por servicios también puede quedar
`TERMINADO` cuando finalizan todas sus tareas y permanecer así hasta que se
registre su entrega.

### 13.4 Pedido parcialmente entregado

Un pedido está `PARCIALMENTE ENTREGADO` cuando se registró al menos una
entrega, pero todavía quedan cantidades pendientes.

### 13.5 Pedido entregado

El pedido pasa a `ENTREGADO` únicamente cuando todas las cantidades pedidas
fueron entregadas.

```text
ENTREGADO
```

Al producirse la entrega:

- las tareas dejan de formar parte del tablero diario;
- las tareas se archivan;
- las tareas no se eliminan físicamente.

### 13.6 Pedido cancelado y reapertura

La cancelación es una acción manual. Al cancelar un pedido:

- el pedido pasa a `CANCELADO`;
- sus tareas pendientes, en progreso o revisión pasan automáticamente a
  `CANCELADAS`;
- sus tareas terminadas conservan su estado;
- no se elimina físicamente el pedido ni sus tareas;
- se conserva el historial.

Un pedido cancelado puede reabrirse. Al reabrirlo:

- las tareas canceladas vuelven a `PENDIENTE`;
- las tareas terminadas permanecen en `TERMINADO`;
- se registra la reapertura en el historial.

---

## 14. Relación entre pedido y tareas

El estado del pedido depende del estado de las tareas que necesita para
cumplirlo.

Conceptualmente:

```text
Pedido
│
├── Producto A → stock
│
├── Producto B → tarea
│
└── Producto C → tarea
```

Las tareas representan ítems de servicio, fabricación de productos,
preparación de pedidos o trabajo interno de Odell.

El pedido no tiene un estado `REVISION`, aunque una tarea sí puede estar en
`REVISION`.

Una tarea terminada de producción para un pedido asigna las unidades
directamente al pedido; no incrementa el stock general.

---

## 15. Entregas

Odell permite entregas parciales, incluso de una parte de la cantidad de un
mismo ítem.

Cada ítem registra:

```text
cantidad pedida
cantidad entregada
cantidad pendiente
```

Una entrega puede registrarse aunque el pedido tenga saldo pendiente. La
deuda resultante se rige por las reglas de las secciones 20 y 21.

El botón `Entrega parcial` permite seleccionar ítems y cantidades, registra
el evento en el historial y actualiza las cantidades pendientes. No se crean
tareas nuevas por cada entrega parcial.

El sistema debe impedir:

- entregar más unidades que las pedidas;
- entregar más unidades de catálogo que las disponibles/asignadas;
- entregar más unidades fabricadas que las correspondientes a tareas
  terminadas.

---

## 16. Precio, costo y ganancia

Cada producto contiene:

```text
precio
costo
ganancia
```

Cuando se crea un pedido, el pedido contiene sus productos y servicios y a
partir de ellos obtiene:

```text
precio total
costo total
ganancia total
```

No debe asumirse que el pedido necesita recalcular desde cero la estructura
de costos del producto para obtener estos valores: la información comercial
del producto ya contiene precio, costo y ganancia.

### 16.1 Precio de servicios

Cada servicio configura una tarifa interna por hora. Diseño gráfico y
modelado 3D utilizan inicialmente tres horas presupuestadas, que luego puede
ajustar el diseñador o modelador.

```text
importe del área = tarifa interna × horas presupuestadas
precio al cliente = importe del área × (1 + margen)
ganancia de Odell = precio al cliente - importe del área
```

El margen predeterminado es `0%` y solo un administrador puede modificarlo.
El vendedor utiliza el margen configurado.

Cuando el cliente acepta el presupuesto, las horas, tarifas y precio del
servicio quedan fijos. Solo se recotizan si el cliente cambia el alcance. Por
ahora Odell no registra el tiempo real trabajado, únicamente el
presupuestado.

---

## 17. Costos dinámicos

Los costos de los productos pueden cambiar como consecuencia de cambios en
los costos de los insumos que utilizan.

Cuando cambia el costo de un insumo:

```text
Insumo
  ↓
Productos que utilizan ese insumo
  ↓
Cambio de costo del producto
  ↓
Pedidos relacionados
  ↓
Cambio de valores calculados
```

Los productos del catálogo deben verse afectados por los cambios de costo
de los insumos que utilizan.

En pedidos confirmados:

- el precio acordado con el cliente no cambia automáticamente;
- el costo interno se actualiza con los valores actuales;
- la ganancia interna se recalcula como precio acordado menos costo actual;
- el cambio del precio vigente del producto se registra en el historial del
  pedido, sin reemplazar el total acordado.

---

## 18. Precio acordado y valores dinámicos del pedido

Odell distingue entre el valor comercial acordado y los valores internos
dinámicos:

- el precio del pedido aceptado por el cliente permanece fijo;
- el pedido conserva el precio acordado como su total comercial;
- el costo de los productos se obtiene de sus valores actuales;
- la ganancia interna se recalcula cuando cambia el costo;
- el precio vigente del producto puede diferir del precio acordado y esa
  diferencia se registra en el historial.

Los servicios aceptados conservan las horas, tarifas y precio acordados,
salvo una recotización por cambio de alcance.

---

## 19. Historial de cambios del pedido

Aunque el precio comercial acordado no cambia automáticamente, el pedido
mantiene un historial de las variaciones posteriores de los productos e
insumos relacionados.

Cuando el precio vigente de un producto difiere del utilizado al aceptar el
pedido, se genera un registro histórico sin modificar el total que debe pagar
el cliente. Los cambios de costo también actualizan el costo y la ganancia
internos.

El historial debe indicar:

- fecha del cambio;
- valores involucrados;
- diferencia producida.

El cambio debe permitir determinar si el valor:

- aumentó;
- disminuyó.

### Presentación visual

En la interfaz:

- aumento → verde;
- disminución → rojo.

El color es una decisión de presentación y no debe considerarse una regla
de negocio almacenada como tal.

---

## 20. Pagos

Odell debe representar:

- importe total del pedido;
- importe pagado;
- saldo pendiente;
- pagos parciales;
- pedido totalmente pagado.

El estado de pago se determina a partir del total y los pagos registrados:

```text
NO PAGADO
PARCIALMENTE PAGADO
PAGADO
```

Una seña es un pago parcial identificado como tal y no tiene efectos
adicionales. Odell no registra el medio de pago.

Los pagos parciales o totales no liberan por sí mismos los importes de las
áreas. La liberación ocurre al registrar la entrega.

Se permite entregar un pedido con saldo pendiente. En ese caso:

- se registra una deuda a nombre del cliente;
- la deuda se vincula con el ID del pedido;
- el importe de la deuda es únicamente el saldo impago;
- si existieron pagos parciales previos, se descuentan antes de calcularla.

Si se cancela un pedido con pagos registrados, un usuario autorizado decide
caso por caso cuánto se devuelve y cuánto queda como crédito. No existe una
regla automática de devolución.

---

## 21. Ventas y balances

Odell mantiene un libro de movimientos por área, separado al menos entre 3D,
Estampados, Diseño gráfico y Modelado 3D. Las áreas adicionales configuradas
por el administrador pueden tener su propio balance.

Al terminar una tarea de servicio se genera un importe `DEVENGADO` para el
área correspondiente. El importe pasa a `DISPONIBLE` únicamente cuando se
registra la entrega correspondiente, aunque el pedido ya estuviera pagado o
permanezca con deuda.

Cuando se entrega con saldo pendiente:

- Odell acredita a las áreas los importes disponibles;
- registra el mismo monto impago como saldo deudor central en el balance
  `Deudas y préstamos`;
- la deuda pertenece al cliente y conserva su vínculo con el pedido;
- cuando se cobra posteriormente, el importe queda en Odell y disminuye ese
  saldo deudor central.

Cada movimiento se vincula con su pedido, tarea, área, importe y fecha. Los
movimientos son históricos y no deben reemplazarse por un total editable.

### 21.1 Retiros

Un usuario puede solicitar un retiro para un área. La solicitud registra
área, persona, importe y motivo. Un administrador debe aprobarla o
rechazarla. Solo la aprobación genera el movimiento contable.

### 21.2 Préstamos

Un usuario puede solicitar un préstamo. La deuda pertenece a la persona, no
al área, aunque la solicitud registre el área desde la que se originó.

- No existe un límite automático para el importe solicitado o aprobado.
- Puede superar el saldo del área, la ganancia general o el balance total de
  Odell.
- El sistema debe advertir al administrador, pero no bloquear la aprobación.
- La devolución se registra manualmente.
- Se permiten devoluciones parciales hasta marcar el préstamo como pagado.
- Los préstamos no se compensan automáticamente con saldos futuros.

Los balances deben mostrar por separado saldo disponible, total retirado,
deuda pendiente por persona y un neto informativo.

Las deudas de clientes por pedidos entregados y los préstamos solicitados por
personas comparten el balance general `Deudas y préstamos`, pero mantienen
origen, responsable y movimientos diferenciados.

---

## 22. Usuarios, roles, permisos y áreas

Odell contempla múltiples usuarios. Un administrador puede crear y modificar
roles, permisos y áreas.

Un usuario puede tener varios roles y acumula los permisos de todos ellos.
Además, pueden configurarse excepciones de permisos para un usuario concreto.
Los permisos se definen por:

- acción, por ejemplo ver, crear, modificar, cancelar o aprobar;
- área o tipo de trabajo, por ejemplo Sublimación, 3D, Grabado, Diseño,
  Modelado o Ventas.

Los permisos se aplican incluso a la visualización. Por ejemplo, un usuario
con acceso únicamente a Sublimación no puede ver tareas de 3D.

Las áreas son configurables: un administrador puede crearlas, renombrarlas,
activarlas y desactivarlas.

No se puede desactivar un área mientras tenga tareas pendientes, bloqueadas,
en progreso o revisión. Antes deben terminarse o reasignarse todas sus tareas
activas.

---

## 23. Reglas que no deben inferirse

La IA no debe inventar reglas no definidas sobre:

- fechas de vencimiento;
- impuestos;
- descuentos;
- devoluciones no cubiertas por una decisión manual autorizada al cancelar;
- costos financieros;
- reglas contables no definidas expresamente en este documento;
- cualquier otra regla de negocio no definida en este documento.

Cuando una implementación dependa de una de estas decisiones, la IA debe
detenerse y solicitar aclaración.

---

## 24. Principio general para la IA

Cuando exista una diferencia entre:

1. lo que parece indicar una convención de programación;
2. lo que actualmente hace el código;
3. lo que está definido como regla de negocio en este documento;

la IA debe distinguir claramente los tres conceptos.

El código describe el comportamiento técnico actual.

Este documento describe el comportamiento objetivo y es la fuente de verdad
de las reglas de negocio. Cuando lo contradiga, el código actual debe
adaptarse de forma explícita y validada.

Si el código contradice una regla de negocio documentada, no debe cambiarse
silenciosamente: debe señalarse la discrepancia y proponer una solución.

Si este documento no define una regla necesaria para implementar una
funcionalidad, la IA debe pedir aclaración en lugar de inventarla.
