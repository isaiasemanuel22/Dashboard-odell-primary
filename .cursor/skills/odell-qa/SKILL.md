---
name: odell-qa
description: >-
  Prueba la app Odell en el navegador local siguiendo solo los pasos indicados
  en esta skill, y entrega un informe con fallos, flujos confusos y desvíos
  de las reglas de negocio. Usar cuando el usuario pida probar, testear, hacer
  QA o seguir los pasos de testing. El primer paso es cargar y editar los
  ajustes del dashboard.
---

# QA de Odell

Probar la app local como un usuario. No modificar código de la app. El informe es el entregable. Quien repara es el agente `odell-correcciones`, no este.

Hacer en el momento las requests y las acciones del navegador que pidan estos pasos. No pedir permiso, no confirmar antes de guardar, recargar ni llamar al API local.

## Antes de probar

1. Confirmar que responden `http://localhost:4200` y `http://localhost:3000/api/health`. Si no, parar y decir qué falta. No levantar producción ni apuntar a Heroku o Netlify.
2. En local, entrar con `testing@test.com` y `123456`. Ese ingreso no llama a Firebase. Si no deja pasar, informar la pantalla y parar. No usar otras credenciales ni saltar el guard.
3. Crear datos solo con el prefijo `QA-` (clientes, productos, pedidos, presupuestos, ventas). No borrar ni editar registros que no lleven ese prefijo.
4. Leer `docs/BUSINESS-RULES.md` antes de la sección de negocio. Las secciones 1 a 23 son la regla. La sección 25 describe lo que el código hace hoy y no la reemplaza. Si algo no está definido, marcarlo **POR DEFINIR**. No inventar impuestos, vencimientos, descuentos ni reglas contables (sección 23).

## Pasos

Ejecutar solo estos pasos, en orden. No recorrer otras pantallas.

### 1. Verificar los ajustes cargados

1. Abrir `/ajustes/valores-generales`, Filamento, Colores, Resina, Impresos y Ganancias.
2. Confirmar que ya hay costo de luz, mano de obra, margen de error, precios de filamento, precios de resina, colores, pliegos y márgenes de ganancia.
3. No borrar ni volver a cero esos valores. Si falta una lista, anotarlo como fallo y seguir.

### 2. Probar insumos y dejarlos cargados

1. Abrir `/insumos`.
2. Crear insumos con prefijo `QA-` usando las marcas y los precios que ya están en Ajustes (filamento y resina). Cargar al menos un filamento y una resina, con color del catálogo, cantidad y stock mínimo.
3. Editar uno y comprobar que el cambio queda después de recargar.
4. Dejarlos cargados. No eliminarlos al terminar.

### 3. Probar productos solo si los insumos ya están cargados

1. Confirmar por pantalla o por `GET /api/supplies` que existe al menos un insumo `QA-`. Si no existe, no crear productos: anotarlo en **No probado** y parar este paso.
2. Abrir `/productos` y crear productos con prefijo `QA-` que usen esos insumos.
3. Editar uno y comprobar que el cambio queda después de recargar.
4. Dejarlos cargados. No eliminarlos al terminar.

## Tres secciones del informe

Hacer las tres en el mismo informe. No mezclar un fallo de compilación con una opinión de diseño.

**Funcional.** La pantalla no carga, el botón no hace lo que dice, hay un error de consola o de red, o los datos creados no vuelven a aparecer. Evidencia: URL, acción, resultado esperado, resultado real.

**Flujos.** El camino se puede completar, pero obliga a adivinar: dos botones parecen lo mismo, falta estado vacío o de error, la etiqueta no dice qué va a pasar, o hay que salir y volver para ver el resultado.

**Negocio.** Comparar lo visto con `docs/BUSINESS-RULES.md`. Revisar al menos:

- publicado no significa que haya stock (secciones 2 y 8);
- un producto personalizado no agrega servicios solo; el vendedor los agrega como ítems (secciones 3 y 11);
- el carrito es el inicio de la operación (sección 4);
- presupuesto, venta directa y pedido son caminos distintos (secciones 5 a 7);
- el costo y el precio viven en el producto; la ganancia se deriva (secciones 3 y 16).

Si el código contradice el documento, reportar la discrepancia. No corregirla en silencio.

## Formato

```markdown
# QA Odell

## Resumen
- Fallos:
- Flujos confusos:
- Desvíos de negocio:
- No probado y por qué:

## Hallazgos
### [Fallo | Confuso | Negocio] Título
- Pantalla:
- Qué hice:
- Qué esperaba:
- Qué pasó:
- Regla: (solo Negocio; sección del documento, o POR DEFINIR)
```

Un hallazgo por problema. Si no hay ninguno en una sección, escribir "Ninguno" y decir qué rutas se recorrieron.

## Entrega

Guardar el mismo informe en `.cursor/qa/informe.md`. Crear la carpeta si no existe. Ese archivo es el mensaje para el agente `odell-correcciones`. No reparar los hallazgos.

## Cuando llama el agente de correcciones

Reprobar solo las pantallas que indique. Mismas reglas de datos, login y formato. Volver a escribir `.cursor/qa/informe.md`. No repetir un hallazgo que ya no se reproduce.
