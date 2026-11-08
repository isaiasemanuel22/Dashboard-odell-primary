# QA del rediseño de las piezas que faltaban (2026-11-07/08)

- QA visual desktop: 3 rondas (briefs 06 y 07 más las correcciones de la ronda 3). Todo cerrado salvo las diferencias aceptadas que figuran en el inventario.
- QA visual mobile: MobRd* revisados. MobRdReemplazoInsumo no se verificó porque dispararlo exige guardar datos.
- Prueba funcional (odell-tester): 12 de 12 casos OK. Las correcciones posteriores son:
  - pedido: «Falta: …» en el pie y error de precio al salir del campo;
  - cliente: el email ya no se exige (bug que venía de main);
  - texto del pie del presupuesto;
  - gap de Nueva tarea.
- Datos QA en la base local: sale-11, quo-16, quo-17, ord-19, cust-6 («QA-rd cliente»), «QA-rd combo», «QA-rd cat», «QA-rd cat combo», «QA-rd impreso», «QA-rd tarea», «QA-rd evento», y un movimiento «QA-rd» de $1, anulado.

## Por definir con el usuario

- ¿Un Combo puede ser pieza de otro Combo? Hoy el selector lo ofrece.
- Un mismo producto muestra costos distintos: QA-Revalid FDM figura con $490 como pieza y con $350 en venta y en la lista.
- El desplegable «Responsable» de Nueva tarea aparece vacío: `listOrderResponsibles()` falla o devuelve vacío. Igual en main.
- Evento semanal cuya fecha de inicio no cae en los días elegidos: conviene aclararlo en el texto.
