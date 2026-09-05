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

---

## 25. Anexo — Comportamiento implementado en la aplicación (estado actual)

> **Alcance de este anexo**
>
> Las secciones 1 a 23 describen reglas de negocio confirmadas por el
> propietario (comportamiento objetivo). La sección 24 define cómo debe
> interpretarlas la IA.
>
> **Este anexo no modifica ni reemplaza lo anterior.** Documenta únicamente
> funcionalidades y reglas que **existen hoy en el código** y que **no
> estaban contempladas** en las secciones previas.
>
> Cuando algo de este anexo difiera de las secciones 1–23, prevalece lo
> definido en este documento como regla objetivo; el anexo sirve para
> identificar brechas entre objetivo e implementación.

### 25.1 Billetera (tesorería operativa)

Odell incluye una pantalla **Billetera** (`/billetera`) y un saldo
**Disponible en cuenta** visible también en el Dashboard.

El saldo disponible se calcula así:

```text
Disponible =
    ingresos por ventas
  + ingresos manuales (billetera)
  − egresos (billetera)
```

Donde:

- **Ingresos por ventas:** suma del total de todas las ventas registradas
  (mostrador + pedidos entregados). Ver §25.3.
- **Ingresos manuales:** registros de billetera con dirección `Ingreso`.
- **Egresos:** registros de billetera con dirección `Egreso`, incluidas
  las compras de insumos.

La billetera permite **crear registros** (no editar ni eliminar registros
existentes en la implementación actual).

#### 25.1.1 Movimiento simple

Registro con nombre libre, monto, fecha y tipo:

- **Ingreso** — suma al saldo disponible.
- **Egreso** — resta del saldo disponible.

La fecha:

- es obligatoria;
- no puede ser posterior al día actual;
- se ingresa como fecha calendario (sin hora).

El formulario sugiere nombres usados previamente en movimientos simples
(categoría «otro»).

#### 25.1.2 Compra de insumos

Modo alternativo del formulario de billetera. Por cada insumo comprado se
registra:

- insumo (del catálogo de insumos);
- cantidad (en la unidad configurada del insumo);
- gasto real en la compra;
- valor unitario de lista del proveedor.

Si el insumo **no existe** en el catálogo, el usuario puede **crearlo desde
el mismo formulario de compra** (botón «Crear insumo»). Al guardarlo:

- se agrega al catálogo de insumos;
- se incorpora automáticamente como línea de la compra en curso, con
  cantidad 1 y precio unitario según lo definido en el alta;
- el usuario puede ajustar cantidad, gasto y valor unitario antes de
  confirmar la compra.

Reglas:

- Se crea **un egreso por cada insumo** de la compra.
- El monto total de la compra debe coincidir con la suma de los gastos por
  insumo.
- Al guardar, el **stock del insumo aumenta** en la cantidad comprada.
- Si el valor unitario informado difiere del registrado en el insumo, se
  **actualiza el precio unitario** del insumo y deja de tomarse desde
  Ajustes (`priceFromSettings = false`).
- Las compras de insumos **no se registran automáticamente** al editar stock
  manualmente en la pantalla de Insumos; el único flujo automático de
  stock + egreso es la compra desde Billetera.

En el formulario, por cada línea se muestra en vivo la diferencia:

```text
diferencia = gasto − cantidad × valor unitario
```

- Negativa → ahorro respecto al precio de lista.
- Positiva → sobrepago respecto al precio de lista.
- Cero → precio de lista (o precio editado que coincide con lo pagado).

Los registros de compra quedan vinculados al insumo (`referenceId`).

#### 25.1.2.1 Atomicidad de compras múltiples

Una compra puede incluir **varios insumos en una sola operación**. En ese
caso:

1. El sistema **valida todas las líneas** antes de aplicar cambios (insumos
   existentes, cantidades, montos, coherencia con el total).
2. Si alguna línea falla la validación, **no se registra ningún egreso ni
   se modifica ningún stock**.
3. Si la validación es correcta, se aplican **en un único paso** todos los
   egresos y todos los incrementos de stock.
4. Tras persistir, se emite **una sola notificación** de disponibilidad de
   insumos (para tareas bloqueadas), no una por línea.

Regla operativa:

```text
compra con N insumos = todo o nada
```

Si falla la línea 2 de 3, la línea 1 **no** debe quedar registrada ni con
stock actualizado.

#### 25.1.3 Categorías de movimiento (modelo de datos)

El sistema modela categorías adicionales (`supply_purchase`, `withdrawal`,
`salary`, `transport`, `payment`, `loan`, `other`). En la implementación
actual de la UI se utilizan explícitamente:

- `supply_purchase` — compra de insumos;
- `other` — movimientos simples (ingreso/egreso);
- `payment` — pago entregado a una persona (botón **Pagar**);
- `loan` — préstamo entregado a una persona (botón **Prestar**).

#### 25.1.4 Pago y préstamo a persona

Desde la pantalla Billetera, los botones **Pagar** y **Prestar** abren
formularios dedicados con:

- fecha (misma regla que §25.1.1);
- persona destinataria (autocompletado con nombres usados antes en pagos o
  préstamos);
- monto.

Ambos registran un **egreso** que descuenta del saldo disponible:

- **Pagar** → categoría `payment`, descripción «Pago a {persona}».
- **Prestar** → categoría `loan`, descripción «Préstamo a {persona}».

En la tabla de registros, la columna **Nombre** muestra la persona y
**Movimiento** indica «Pago» o «Préstamo».

Debajo de los registros, la tabla **Deudores** lista cada persona con saldo
pendiente de préstamo (`préstamos − devoluciones`). Solo aparecen quienes
deben un monto mayor a cero. Cada fila incluye el botón **Devolver**, que
abre un formulario con fecha y monto (parcial o total). La devolución:

- se registra como ingreso en billetera (`loan_repayment`);
- reduce la deuda de esa persona;
- aparece en la tabla de registros como movimiento «Devolución».

---

### 25.2 Dashboard

Además de las métricas de pedidos y producción, el Dashboard muestra:

- **Disponible en cuenta** — saldo de billetera (§25.1).
- **Ingresos del mes** — ventas del mes calendario actual (§25.3).
- **Tendencia mensual** — últimos 6 meses: cantidad de pedidos creados e
  ingresos por ventas en cada mes.
- **Pedidos recientes** — hasta 5 pedidos activos (excluye entregados,
  terminados y cancelados).
- **Insumos con stock bajo** — cantidad de insumos cuya cantidad es menor o
  igual al stock mínimo.

El acceso a Billetera está disponible desde el menú lateral y desde la
tarjeta de saldo en el Dashboard.

---

### 25.3 Ventas — implementación actual

Pantalla **Ventas** (`/ventas`) con:

- listado de operaciones del **mes calendario actual**;
- alta y edición de **ventas de mostrador**;
- exportación de **reporte mensual en PDF**.

#### 25.3.1 Fuentes de ingreso

```text
Ingreso total (billetera y acumulado histórico de ventas) =
    ventas de mostrador
  + pedidos en estado ENTREGADO
```

- **Mostrador:** ventas registradas en la pantalla Ventas → Nueva venta.
  Cliente mostrado como «Mostrador». Son editables y eliminables.
- **Pedidos:** solo los pedidos **entregados** cuentan como venta. La fecha
  de venta es la de la **última entrega** registrada (no la fecha pactada
  del pedido).

Los pedidos en cualquier otro estado **no** suman ingresos ni aparecen en
el listado mensual de ventas.

#### 25.3.2 Economía por operación

Por cada venta (mostrador o pedido entregado) se calculan:

```text
costo  = Σ (costo unitario del ítem × cantidad)
ganancia = total cobrado − costo
```

El costo unitario se resuelve con la calculadora de costos vigente al
momento de la consulta (insumos, ajustes, tipo de producto/servicio).

#### 25.3.3 Balance por área (vista de ventas)

La pantalla de Ventas muestra desglose por **área de ganancia**:

- Impresión 3D
- Estampado
- Diseño gráfico
- Modelado 3D

Para cada área: ingresos, costos y ganancia del mes, separados entre
**mostrador** y **pedidos**.

Reglas de asignación implementadas:

- Productos tipo **estampado** → área Estampado.
- Resto de productos con `productId` → área Impresión 3D.
- Ítems de servicio → área según `serviceType` del ítem.
- Servicios de diseño (diseño gráfico / modelado) computan costo con
  multiplicador de cantidad = 1 (no por unidades del ítem).

> **Nota:** Este desglose es **informativo para ventas del mes**. No
> implementa el libro de movimientos `DEVENGADO` / `DISPONIBLE`, retiros,
> préstamos ni balance «Deudas y préstamos» descritos en §21.

#### 25.3.4 Reporte mensual PDF

El botón de exportación genera un PDF con:

1. Balance del mes (ingresos, costos, ganancia).
2. Balance por área.
3. Detalle por área y producto/servicio (cantidad, costo, ganancia, total).

Solo incluye operaciones del mes calendario en curso.

#### 25.3.5 Descuentos

Ventas de mostrador, pedidos y presupuestos admiten **un solo tipo** de
descuento por operación:

- porcentaje (0–100 %), **o**
- monto fijo en pesos.

No se permiten ambos simultáneamente. El total se calcula sobre el subtotal
de ítems.

#### 25.3.6 Venta de mostrador y stock

Al crear, editar o eliminar una venta de mostrador, el stock del producto
publicado se descuenta o revierte automáticamente según los ítems del
carrito.

---

### 25.4 Presupuestos — implementación actual

Pantalla **Presupuestos** (`/presupuestos`) con listado y detalle.

Estados implementados (alineados con §5):

```text
borrador → enviado → aceptado | rechazado | cancelado
```

Reglas codificadas:

- Un presupuesto **cerrado** (aceptado, rechazado o cancelado) no se puede
  editar ni cambiar de estado.
- Un presupuesto **aceptado** no se puede eliminar.
- Desde un presupuesto **aceptado** se puede generar **un pedido** (si aún
  no tiene uno vinculado).
- El pedido generado hereda ítems, descuento y cliente del presupuesto.
- La fecha de entrega pactada del pedido generado se fija a **7 días** desde
  la conversión.
- El presupuesto puede crearse sin cliente (nombre «Sin cliente»).

La conversión presupuesto → pedido **copia los ítems**; la creación
automática de productos de catálogo no publicados al aceptar queda sujeta
a lo definido en §5 (comportamiento de producto al aceptar).

---

### 25.5 Insumos — implementación ampliada

Pantalla **Insumos** (`/insumos`). La ruta `/materiales` redirige a
Insumos.

#### 25.5.1 Categorías

**Categorías del insumo:** FDM, Resina, Estampado, General.

La categoría es la **única clasificación** del insumo. No existe un campo
«tipo» separado en el modelo ni en el formulario.

| Categoría  | Campos relevantes |
|------------|-------------------|
| FDM        | tipo de filamento, marca, color |
| Resina     | tipo de resina, marca, color (alcohol: categoría Resina sin tipo de resina) |
| Estampado  | precio manual; puede requerir color |
| General    | precio manual |

Filamento y resina requieren marca desde Ajustes; FDM, Resina y Estampado
pueden requerir color del catálogo.

#### 25.5.2 Unidad de medida

Cada insumo tiene una **unidad de medida** configurable: unidad, kg, g, L,
ml, m, cm, hoja, rollo.

Al cambiar la categoría se sugiere una unidad por defecto (ej. FDM → kg,
Resina → L). El usuario puede elegir otra.

Stock, stock mínimo y precio unitario se expresan en esa unidad.

#### 25.5.3 Precio desde Ajustes

Filamentos y resinas pueden tomar el **precio unitario desde las listas de
Ajustes** (por tipo de material y marca). En ese caso:

- el precio en el formulario de insumo es de solo lectura;
- la unidad se alinea a kg (filamento) o L (resina);
- si el precio se modifica manualmente o por una compra en Billetera, pasa a
  precio manual.

#### 25.5.4 Stock bajo

Un insumo está en stock bajo cuando `cantidad ≤ stock mínimo`. El Dashboard
cuenta cuántos insumos cumplen esa condición.

#### 25.5.5 Entidad Material (legacy)

Existe además una entidad **Material** en el modelo de datos (módulo
Materials) con stock y proveedor. La UI principal de inventario operativo
usa **Insumos**. La relación exacta Material ↔ Insumo sigue **POR DEFINIR**
(§9.1).

#### 25.5.6 Sincronización de stock en la interfaz

El catálogo de insumos se mantiene en un **store centralizado** (NgRx) en
el frontend. Todas las pantallas que consumen insumos se suscriben a ese
store (`watchSupplies`), no a lecturas aisladas que quedan obsoletas.

Comportamiento implementado:

- **Carga inicial:** al abrir una pantalla que necesita insumos, el store
  carga el listado completo desde la API si aún no estaba cargado.
- **Refresh global:** el layout principal escucha eventos de sincronización
  en tiempo real del scope `supplies` y dispara un refresh del store. Todas
  las pantallas abiertas reciben el stock actualizado sin recargar la página.
- **Compra desde Billetera:** tras guardar una compra, la pantalla de
  Billetera fuerza además un refresh explícito del store de insumos.
- **Alta, edición o eliminación en Insumos:** el store se actualiza con la
  respuesta del API (`upsert` / `remove`); no requiere refetch completo.
- **Formularios de producto y Ajustes:** filamentos, resinas, insumos de
  estampado, componentes y selectores de insumo en Valores generales usan
  la misma suscripción persistente; ven cambios de stock y precio cuando el
  store se refresca.

El refresh siempre trae el **listado completo** de insumos (sin filtros en
API) para no vaciar el store con subconjuntos parciales.

---

### 25.6 Productos — tipos implementados

Los productos del catálogo se clasifican en:

```text
fdm | resina | estampado | combo
```

- **FDM / Resina:** impresión 3D; costos con filamento/resina, tiempos de
  máquina, mano de obra y margen.
- **Estampado:** insumos de estampado, ciclos de prensa, impresiones.
- **Combo:** producto compuesto por otros productos (piezas); el stock
  disponible puede derivar del ensamblaje de piezas.

Campo **publicado** (`published`): controla visibilidad en venta directa
y listados públicos. El API puede incluir no publicados con parámetro
`all=true`.

Productos pueden tener **componentes** (otros productos del catálogo) para
ensamblaje y recálculo de costo/precio de combos.

---

### 25.7 Cola de tareas (print jobs)

La pantalla **Cola** (`/cola`) gestiona las tareas de producción y servicio
vinculadas a pedidos.

Estados de tarea en código:

```text
por_hacer → en_proceso → en_revision → terminado
           ↘ bloqueado ↗
           → cancelado
```

Tipos de tarea:

```text
PREPARE_ORDER | PRODUCTION | SERVICE | INTERNAL
```

Comportamiento implementado relevante:

- Las tareas se **sincronizan automáticamente** al crear o modificar
  pedidos.
- Pedido **entregado** → tareas archivadas (salen del tablero activo).
- Pedido **cancelado** → tareas abiertas pasan a canceladas; terminadas se
  conservan.
- Tarea **bloqueada** por falta de insumos: notificación al repone stock,
  pero **no se desbloquea sola**; el responsable debe avanzarla.
- El estado del pedido se **recalcula** a partir de tareas y entregas
  (prioridad de entregado / parcial / progreso según tareas).

La reserva de stock al preparar pedido, entregas parciales y cantidades
(`reservedQuantity`, `deliveredQuantity`, etc.) están implementadas en
pedidos y tareas conforme a §9–§15.

---

### 25.8 Retención de pedidos

El sistema **elimina automáticamente** pedidos en estado terminal
(**entregado** o **cancelado**) cuya fecha de cierre supera **1 mes**.

- La purga corre al iniciar el servidor y luego cada 24 horas.
- Las tareas asociadas se eliminan con el pedido.

Esta regla no estaba documentada en las secciones anteriores.

---

### 25.9 Sincronización de precios de productos

Servicio de **pricing sync** recalcula precios y costos de productos cuando:

- cambian ajustes generales o precios de insumos;
- se guarda un producto cuyo precio cambió;
- se actualizan componentes de combos.

En pedidos **no entregados ni cancelados**, si cambia el precio vigente de
un producto del catálogo, se registra entrada en el **historial de precios
del pedido** (`priceHistory`) sin alterar el total acordado con el cliente,
en línea con §17–§19.

Triggers registrados: `settings`, `supply_price`, `product_update`.

---

### 25.10 Ajustes generales (configuración)

Sección **Ajustes** con subpáginas:

| Ruta | Contenido |
|------|-----------|
| Valores generales | Mano de obra, márgenes de error, electricidad, etc. |
| Filamento | Precios por kg según tipo y marca |
| Resina | Precios por litro según tipo y marca |
| Colores | Catálogo de colores (hex, nombre) |
| Impresos | Papeles / impresos para estampado (tipo, costo) |
| Ganancias | Márgenes de ganancia por servicio |

Márgenes predeterminados implementados (%):

```text
Impresión 3D:  40 %
Diseño gráfico: 50 %
Modelado 3D:   50 %
Estampado:     35 %
```

Los márgenes se usan al calcular precio de venta a partir del costo /
importe del área. Rango permitido al guardar: 0–999 %.

Perfiles de **máquina** (impresión, lavado, curado, prensa) intervienen en
el cálculo de overhead energético y de máquina por tipo de producto.

---

### 25.11 Autenticación y sincronización

- Acceso protegido por **login**; rutas internas requieren sesión activa.
- **Sincronización en tiempo real** opcional (polling): cuando está activa,
  las pantallas recargan datos al recibir eventos del servidor (dashboard,
  insumos, pedidos, etc.).

Al registrar una **compra de insumos** desde Billetera, el backend emite
eventos de realtime con scopes `dashboard`, `supplies` y `print-jobs`, de
modo que el saldo disponible, el stock de insumos y las tareas bloqueadas
por falta de material puedan actualizarse en las pantallas abiertas (ver
§25.1.2.1 y §25.5.6).

---

### 25.12 Persistencia

Con **MySQL** configurado (`DATABASE_URL`), el estado se persiste en base
de datos (productos, pedidos, insumos, ventas, egresos de billetera,
presupuestos, ajustes, etc.).

Sin base de datos, el backend opera en **memoria** con datos de seed (no
persisten entre reinicios).

---

### 25.13 Brecha respecto a reglas objetivo ya documentadas

Las secciones **20 (Pagos)** y **21 (Ventas y balances)** describen
deudas, pagos parciales, retiros, préstamos y libro `DEVENGADO` /
`DISPONIBLE`. **Esa funcionalidad no está implementada** en la aplicación
actual; lo implementado hoy es la billetera operativa (§25.1) y el reporte
de ventas por área (§25.3.3).

Otras reglas objetivo (§10 modificación/clonación de pedidos, §22 roles
dinámicos, recotización bloqueante, etc.) pueden estar **parcialmente**
implementadas o pendientes; este anexo no las modifica — solo registra lo
que el código expone hoy y que no figuraba antes en el documento.

