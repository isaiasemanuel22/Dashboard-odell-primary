# DashboardForm

Biblioteca de componentes de formulario con prefijo `db-` para Odell Dashboard.

Ubicación: `frontend/src/app/components/dashboard-form/`

## Uso

```typescript
import { DashboardFormModule } from '@dashboard-form';
// o importar componentes standalone:
import { DbInputComponent, DbSelectComponent } from '@dashboard-form';
```

## Componentes

| Selector | Descripción |
|---|---|
| `db-form` | Contenedor de formulario |
| `db-form-grid` | Grilla 2 o 3 columnas |
| `db-form-grid-full` | Celda ancho completo |
| `db-form-field` | Label + hint + error + slot |
| `db-input` | Input text/number/search (CVA) |
| `db-select` | Select con opciones (CVA) |
| `db-textarea` | Textarea (CVA) |
| `db-checkbox` | Checkbox (CVA o controlado) |
| `db-checkbox-group` | Grupo de checkboxes |
| `db-fieldset` | Fieldset con legend |
| `db-form-footer` | Footer de acciones |
| `db-file-upload` | Subida de archivos con preview (CVA) |
| `db-form-hint` | Texto de ayuda |
| `db-form-error` | Mensaje de error |
