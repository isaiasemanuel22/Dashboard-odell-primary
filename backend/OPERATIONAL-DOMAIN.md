# Dominio operativo: límite de identidad

El desbloqueo de una tarea de producción bloqueada por insumos exige:

- `responsibleUserId` asignado en la tarea;
- Firebase Auth habilitado;
- que el `uid` del token verificado coincida con `responsibleUserId`.

No se acepta identidad enviada en el body. Si Firebase Auth está deshabilitado o
la tarea no tiene responsable, el backend deniega el desbloqueo. El modelo
actual todavía no contiene usuarios, roles ni permisos por área; incorporar
esas autorizaciones queda fuera de esta etapa.

La reposición de insumos solo completa `suppliesAvailableNotifiedAt`. No cambia
automáticamente el estado `bloqueado`.
