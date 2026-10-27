---
name: odell-redisenio
description: >-
  Rediseña pantallas o modales de Odell hasta que queden iguales al mock
  que envió el usuario. Usar cuando el usuario manda una foto o captura
  de diseño, pide ajustar al diseño, o pide un rediseño visual. Lanza un
  bucle de implementar → abrir en Playwright → capturar → comparar →
  corregir hasta que coincida.
---

# Rediseño visual de Odell

El entregable es la UI local igual al mock. No alcanza con “parecido”.
No hacer commits. No matar `npm run dev`. No inventar reglas de negocio
ni cambiar nombres de `ngModel` / payloads.

## Antes de tocar código

1. Confirmar `http://localhost:4200`. Si no responde, parar y decirlo.
2. Leer la imagen del diseño con la herramienta Read (es imagen: mirá
   layout, tipografía, colores, espaciados, textos, estados).
3. Localizar en el frontend la pantalla o modal correspondiente.
4. Respetar componentes existentes: `dashboard-form` (`db-input`,
   `db-select`, `db-button`, etc.), `db-data-table` si es tabla de
   listado, prefijo `db`, Angular standalone.

## Bucle obligatorio

Repetir hasta que el veredicto sea **IGUAL** o se llegue a **5 vueltas**:

### 1. Implementar
Aplicar el rediseño. Cambios localizados. Reutilizar patrones del repo.

### 2. Abrir en el navegador
Usar el MCP Playwright (`user-playwright`):

- Navegar a la ruta correcta.
- Abrir el modal o la sección del mock (clic en el botón que lo dispara).
- Si hace falta login local: `testing@test.com` / `123456`.

### 3. Capturar
Sacar screenshot del elemento relevante (el modal o la sección), no
solo del viewport entero si el mock es un trozo.

### 4. Comparar
Leer el screenshot con Read. Comparar lado a lado con el mock.
Anotar diferencias concretas:

- textos / placeholders / hints
- orden y layout (filas, columnas, anchos)
- tipografía y pesos
- colores y bordes
- espaciado y alineación
- footer, botones, estados vacíos o disabled

### 5. Decidir
- Si hay diferencias: corregir solo eso y volver al paso 1.
- Si no hay diferencias relevantes: marcar **IGUAL** y salir.

## Criterio de “igual”

Coincide la composición: mismos bloques, mismos textos visibles del
mock, mismos roles (título, subtítulo, campos, hints, pie, botones) y
proporciones cercanas. No exigir pixel-perfect de sombras o antialiasing.
Sí exigir que un hint no esté arriba si en el mock está abajo, que dos
campos estén en fila si el mock los muestra en fila, etc.

## Al terminar

Responder en español, breve:

- **IGUAL** o **CERCANO** (si se llegó al tope de vueltas).
- Qué se cambió (archivos clave).
- Si quedó **CERCANO**, listar las diferencias que faltan.

## Prohibido

- Parar después de la primera implementación sin capturar y comparar.
- Decir que “está listo” sin haber leído un screenshot propio.
- Rediseñar pantallas que no están en el mock.
- Instalar librerías nuevas sin necesidad.
