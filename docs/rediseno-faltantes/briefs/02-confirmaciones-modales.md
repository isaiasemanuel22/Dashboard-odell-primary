Leé primero docs/rediseno-faltantes/reglas-implementacion.md y seguilo. Nunca hagas git commit/add/stash.

Grupo 2 · Confirmaciones y modales chicos (desktop + mobile).

Artboards: RdPatrones.dc.html §1 y §2, RdImpreso.dc.html, RdModalesChicos.dc.html y los MobRd* (Confirmacion, ReemplazoInsumo, Tarea, ExportarPdf, PagoCuenta, Categoria, Impreso).

1. modals/confirm-dialog: patrón §2 (ícono en cuadro redondeado, título, mensaje, pie gris). Agregá una variante opcional «peligro» (ícono y botón rojos) e «info»; las llamadas que borran o no se pueden deshacer pasan a peligro, el resto queda igual. En mobile: hoja como MobRdConfirmacion.
2. modals/supply-replacement-dialog → §2 info + campos (MobRdReemplazoInsumo en mobile).
3. pages/wallet/components/wallet-void-form (Anular) → §2, conservando el campo Motivo.
4. modals/reset-database-dialog → §2 peligro.
5. modals/category-form-dialog → §1 (480). Reemplazá el template inline por db-form/db-input. Mobile: MobRdCategoria.
6. modals/impreso-form-dialog → RdImpreso (560) con db-*. Mobile: MobRdImpreso.
7. modals/independent-task-dialog → «Nueva tarea» de RdModalesChicos. Mobile: MobRdTarea.
8. modals/quote-document-export-dialog → «Generar presupuesto». Mobile: MobRdExportarPdf.
9. pages/wallet/components/wallet-repayment-form → «Registrar devolución». Mobile: MobRdPagoCuenta.
Si conviene, extraé un componente compartido de cabecera/pie de confirmación para no repetir markup.
