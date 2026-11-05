# Cierre técnico

> Registro de cierre de la migración de Angular RealWorld (etapas 00–15 más la etapa de cierre). Versión en inglés: [`technical-closure.md`](technical-closure.md).

## 1. Problema

El proyecto toma la aplicación Angular "Conduit" de RealWorld, fijada en el commit upstream `e28c896` (Angular 15.2.3, TypeScript 4.8, Node 18, Karma, zone.js), y la migra a Angular 22.2 de una versión mayor a la vez. Es una migración de referencia documentada: cada etapa registra qué se diagnosticó antes del cambio, qué hicieron las migraciones oficiales, qué se rompió, cómo se verificó el resultado y cómo se compara con el commit de actualización del propio proyecto upstream (la "hoja de respuestas").

El motivo de hacerlo por etapas, y no en un solo salto, es la atribución. Cuando un mismo cambio mueve a la vez el framework, las herramientas y las plantillas, una regresión puede venir de cualquiera de ellos. Mantener un concepto por cambio permite atribuir cada fallo a una sola causa y mantiene cada etapa lo bastante pequeña para revisarla.

La API pública de RealWorld y la hoja de estilos del tema de las que depende la aplicación ya no están disponibles, así que la aplicación no puede usarse en vivo. La validación se apoya en specs y en un flujo de extremo a extremo con la API simulada (ver [Limitaciones](../README.md#limitations)).

## 2. Enfoque

Cada etapa siguió el mismo ciclo (detalle en el [README](../README.md#approach)):

1. **Checklist de diagnóstico** antes de tocar nada: matriz de Node / TypeScript / zone.js, `peerDependencies` de terceros para el major objetivo, cobertura de specs sobre el código que toca la etapa, prueba de humo.
2. **Rama de feature + documento de tareas** (`docs/tasks/*.md`) con checklist, criterios de aceptación y la evidencia de verificación de cada paso.
3. **Build y tests**, más comprobaciones por mutación cuando la etapa dependía de los specs (romper el código a propósito, confirmar que un spec falla, revertir).
4. **Comparación con upstream** usando el commit de actualización correspondiente, mientras existió (no hay ninguno después de Angular 21).
5. **Registro de decisiones bilingüe** en `docs/migration-log/{en,es}/`.
6. **Merge con `--no-ff` y un tag** por etapa, tras aprobación explícita.

## 3. Decisiones más difíciles

### 3.1 Specs de caracterización antes de cada cambio arriesgado

La línea base no tenía specs. Antes de la primera actualización, 67 specs de caracterización congelaron el comportamiento existente, incluidos los bugs existentes, y cada uno se validó por mutación ([etapa 00](migration-log/es/00-tests-de-caracterizacion.md)). La misma regla se aplicó después cada vez que una etapa cambiaba algo que los specs no observaban: 44 specs de plantilla antes de la migración de control flow ([etapa 08](migration-log/es/08-migracion-control-flow.md), sección 2), un spec de integración de la cadena de interceptors ([etapa 04](migration-log/es/04-upgrade-angular-18.md), sección 8), specs del cableado del inicializador ([etapa 12](migration-log/es/12-provide-app-initializer.md)) y 21 specs zoneless que estaban en RED antes de la corrección ([etapa 15](migration-log/es/15-zoneless.md), sección 5). El coste es trabajo adicional antes de cada etapa arriesgada; el beneficio es que una suite en verde después del cambio tiene significado.

### 3.2 Migrar ≠ corregir

Los defectos encontrados durante la migración no se corrigieron dentro de una actualización. Se congelaron con specs `KNOWN BUG (locked)`, de modo que un cambio posterior en ese comportamiento aparece como un test que falla. Hay diez hallazgos congelados ([`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md#locked-findings-not-fixed)); el último, el formulario de ajustes que nunca se rellena, se encontró durante la auditoría zoneless ([etapa 15](migration-log/es/15-zoneless.md), sección 8). La contrapartida es que los defectos conocidos se mantienen sin cambios; el beneficio es que cada cambio de comportamiento del historial se puede atribuir a una corrección deliberada y no a una actualización.

### 3.3 La migración de control flow como etapa propia, sobre Angular 20

En `@angular/core@21`, `control-flow-migration` es obligatoria, y 7 de las 10 plantillas afectadas no tenían ningún spec de renderizado. Ejecutarla dentro de la actualización a v21 habría mezclado un cambio de framework, una subida de TypeScript y 10 plantillas reescritas en un solo diff. Se ejecutó antes, sobre Angular 20, después de añadir los specs que faltaban ([etapa 08](migration-log/es/08-migracion-control-flow.md)). La actualización a v21 ya no tuvo nada que convertir ([etapa 09](migration-log/es/09-upgrade-angular-21.md)).

### 3.4 Cambio de paquete del builder separado de la actualización de versión

Upstream cambió de `@angular-devkit/build-angular` a `@angular/build` dentro de su commit de Angular 20. Aquí fue una etapa separada sobre Angular 21, antes de que Angular 22 declarara obsoleto el paquete antiguo ([etapa 10](migration-log/es/10-paquete-angular-build.md)). Como los archivos de salida conservaron hashes de contenido idénticos, la etapa pudo mostrar que solo cambió el árbol instalado (1093 → 710 paquetes), y la etapa de Angular 22 quedó como una actualización de versión pura ([etapa 11](migration-log/es/11-upgrade-angular-22.md)).

### 3.5 Karma → Vitest: demostrar que la red de seguridad no cambió

Fue la única etapa en la que cambiaron los propios specs, así que una ejecución en verde con el nuevo runner solo demostraba que la nueva suite coincidía consigo misma. La equivalencia se demostró desde fuera de la herramienta: títulos de test idénticos antes y después (122) y una muestra de mutaciones anteriores que siguen detectándose ([etapa 14](migration-log/es/14-karma-a-vitest.md), sección 6). Los tests se ejecutan ahora en Node + jsdom en lugar de en un navegador real (decisión del usuario, sección 2). La cobertura usa istanbul en ambos lados, pero los números difieren con los mismos tests; la diferencia se documentó sin ajustarla, y la cobertura se considera no del todo comparable a través de esta etapa.

### 3.6 Zoneless con `markForCheck()` selectivo, sin refactor a signals

El [ADR de la etapa 15](migration-log/es/15-zoneless.md#2-adr-compatibilidad-zoneless-sin-un-refactor-simultáneo-del-estado) mantiene el modelo de estado y añade `ChangeDetectorRef.markForCheck()` solo en los 14 puntos donde la auditoría y un spec zoneless que fallaba mostraron que faltaba una notificación. Convertir el estado a signals se descartó para esta etapa porque cambiaría las plantillas y mezclaría dos objetivos en un mismo diff. El coste aceptado es código de notificación imperativo que una futura etapa de signals eliminaría, y la necesidad de recordar `markForCheck()` para nuevo estado asíncrono.

## 4. Resultados

La tabla antes / después está en el [README](../README.md#results-before--after). En resumen:

- La aplicación pasó de Angular 15.2 / TypeScript 4.8 / Node 18 / webpack / Karma / zone.js a Angular 22.2 / TypeScript 6.0 / Node 24 / `@angular/build` (esbuild) / Vitest / zoneless, en 16 etapas con tag.
- La suite creció de 67 a 143 specs. La cobertura subió del 44,78 % al 87,17 % de sentencias, como consecuencia de los specs añadidos antes de los cambios arriesgados, no como objetivo.
- El bundle inicial es menor que su primer valor registrado (332,17 → 319,70 kB sin comprimir); la mayor reducción individual fue la eliminación de zone.js en la etapa 15 (−37,98 kB sin comprimir). El árbol instalado bajó de 1093 a 460 paquetes; la mayor reducción individual fue retirar el paquete de builder que incluía webpack en la etapa 10 (1093 → 710).
- `npm audit` pasó de 65 hallazgos (2 críticos, registrados por primera vez en la etapa 06) a 4, todos en herramientas usadas solo por schematics, aceptados con motivo y en seguimiento.

## 5. Qué se haría distinto en un entorno de empresa

- **Medir todas las líneas base en la etapa 00.** El bundle inicial, el número de paquetes instalados y `npm audit` no se midieron sobre Angular 15; el README muestra en su lugar los primeros valores registrados, de las etapas 03, 10 y 06, y no quedó registrado el método detrás del tamaño de `dist` de la etapa 00. Una migración en empresa los capturaría, con sus comandos, antes del primer cambio.
- **Montar el entorno de extremo a extremo pronto.** El único flujo en navegador real se añadió en la etapa de cierre. La etapa 14 movió los tests unitarios de un navegador real a jsdom, y la etapa 15 cambió la detección de cambios, con solo una prueba de humo headless de la página de inicio anónima como evidencia en navegador. Un flujo E2E con API simulada desde la etapa 00 habría cubierto ambos casos.
- **Tener una política de auditoría de dependencias desde el inicio.** `npm audit` se registró por primera vez en la etapa 06 (65 hallazgos, 2 críticos) y solo se clasificó en el cierre. Un equipo definiría umbrales de severidad y una decisión por hallazgo (actualizar, aceptar con motivo, hacer seguimiento) en cada etapa.
- **Revisión humana independiente.** Cada paso lo aprobó una sola persona y se ejecutó con un asistente de IA. Las decisiones con coste duradero (el ADR de la etapa 15, aceptar Node + jsdom en la etapa 14, aceptar los hallazgos de auditoría) pasarían por revisión de otros ingenieros y de los responsables del código.
- **Mantener la documentación en los mismos commits que el cambio.** Los documentos de tareas y los registros se eliminaron del historial con `git filter-repo` y se añadieron en un solo commit antes de publicar ([`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md#decisions-do-not-re-ask)). En un repositorio compartido, la documentación se revisaría y se integraría junto con el cambio que describe.

## 6. Desarrollo asistido por IA

El trabajo se hizo con un asistente de programación con IA. Los incidentes siguientes son los que tienen evidencia en el repositorio o en la memoria del proyecto. Cada uno indica qué se afirmó o se hizo, cómo se detectó, qué control lo detectó y la lección.

### 6.1 "Angular 21 es el último major"

- **Afirmación:** al cerrar la etapa 09, el archivo de contexto decía "Angular 21 is the current latest major line for this project" (commit `32776f7`, `PROJECT_CONTEXT.md`).
- **Detección:** se consultó el registro con npm antes de planificar la etapa siguiente: Angular 22 ya estaba publicado (`latest` 22.2.4, 22.0.0 publicado el 2026-06-03), exigía TypeScript 6.0 y declaraba obsoleto `@angular-devkit/build-angular`.
- **Control:** consulta al registro (`npm view`) antes de planificar. La afirmación se sustituyó en el commit `68ffe76`, y las etapas 10 y 11 se añadieron al plan ([etapa 11](migration-log/es/11-upgrade-angular-22.md), introducción).
- **Lección:** los datos de versiones salen del registro en el momento de la decisión, no del conocimiento del asistente.

### 6.2 Hash incorrecto de la hoja de respuestas upstream

- **Afirmación:** `PROJECT_CONTEXT.md` indicaba el commit upstream `2351be8` como hoja de respuestas de Angular 20.
- **Detección:** al preparar la comparación con upstream de la etapa 07, resultó que `2351be8` era una actualización posterior del minor 20.3; el commit de actualización a Angular 20 es `a420aa2`.
- **Control:** el propio paso de comparación con upstream, que obliga a leer el commit referenciado. Corregido en el commit `c560d30` ([etapa 07](migration-log/es/07-upgrade-angular-20.md), sección 7).
- **Lección:** un hash registrado en un archivo de contexto es una afirmación como cualquier otra; se verifica contra `git` antes de usarlo como evidencia.

### 6.3 Informe de refactor automático: "No Manual Changes Required"

- **Afirmación:** el schematic `refactor-jasmine-vitest` informó de 12 de 19 archivos transformados, 0 TODOs y "No Manual Changes Required" ([informe](tasks/evidence/jasmine-vitest-20261105T190035550Z.md)). Es un schematic determinista de Angular, no un agente de IA, pero la lección es la misma.
- **Detección:** el build de tests falló a continuación con 16 errores de TypeScript, todos solo de tipos.
- **Control:** compilar y ejecutar la suite después del cambio automático. Los errores se corrigieron con 15 ediciones listadas ([etapa 14](migration-log/es/14-karma-a-vitest.md), sección 4).
- **Lección:** compilar y ejecutar los tests después de cada refactor automático; el resumen que una herramienta hace de su propio trabajo no es verificación.

### 6.4 Un `git checkout` revirtió una corrección sin commit

- **Qué pasó:** durante la etapa 15, al restaurar una mutación temporal, `git checkout` sobre `article-preview.component.spec.ts` revirtió también la corrección del entorno de pruebas, aún sin commit, en ese mismo archivo.
- **Detección y control:** se advirtió antes del commit; la corrección se volvió a aplicar y la suite se volvió a verificar antes de hacer commit ([etapa 15](migration-log/es/15-zoneless.md), sección 6; [`docs/tasks/zoneless.md`](tasks/zoneless.md), T5). El registro no detalla cómo se advirtió.
- **Lección:** no usar `git checkout <archivo>` para deshacer una mutación en un archivo con trabajo sin commit; hacer commit o stash antes, o revertir la mutación a mano.

### 6.5 Modelo de trabajo

La persona aprobó cada paso (alcance, merges, tags, riesgos aceptados); el asistente ejecutó tareas acotadas con límites de edición y criterios de éxito explícitos ([etapa 00](migration-log/es/00-tests-de-caracterizacion.md), secciones 4–5). Que un agente informara de "hecho" no se trató como evidencia: las afirmaciones sobre versiones se comprobaron contra el registro de npm, la documentación redactada por agentes se volvió a verificar contra `git`, y los cambios de código se comprobaron con build, tests y mutación. El control funcionó también en sentido inverso: en la etapa 00 el encargo humano tenía un tipo incorrecto para los fixtures de error, y el agente siguió el código fuente (sección 6, fila 3).
