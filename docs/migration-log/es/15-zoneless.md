# 15 — Detección de cambios zoneless (Angular 22.2)

> Registro de decisiones: por qué se elimina zone.js ahora, la decisión de hacer la app compatible con zoneless sin refactorizar su estado, la auditoría de suscripciones, por qué los specs existentes no podían ver el problema y cómo se construyeron los specs de regresión zoneless, evidencia RED → GREEN, el cambio en sí, verificación, métricas, hallazgos y seguimiento.

**Rama:** `feature/zoneless` · **Commits:** `7faa49e` (specs RED + bug de settings bloqueado), `35e9874` (`markForCheck()` selectivo), `990252d` (cambio a zoneless, zone.js eliminado)

---

## 1. Por qué

Desde Angular 21, la detección de cambios zoneless es la opción por defecto. La etapa 09 ([sección 3](09-upgrade-angular-21.md#3-zoneless-por-defecto-y-por-qué-la-migración-añadió-providezonechangedetection)) registró que la migración oficial `bootstrap-options-migration` añadió `provideZoneChangeDetection()` a `src/main.ts`, de modo que la app siguió funcionando con zone.js exactamente igual que antes, y aplazó el paso a zoneless a un cambio propio porque tiene sus propios riesgos y su propia verificación. Este es ese cambio.

**Qué hacía zone.js:** parcheaba las APIs asíncronas del navegador, de modo que Angular ejecutaba la detección de cambios después de cada callback asíncrono. Un componente podía asignar un campo dentro de `subscribe` y la vista se actualizaba sin que el componente hiciera nada más.

**Qué notifica a Angular sin zone.js:** una vista solo se actualiza cuando Angular recibe una notificación. Las notificaciones son:

- un listener de evento en la plantilla;
- `AsyncPipe`;
- una señal leída en la plantilla;
- `ChangeDetectorRef.markForCheck()`;
- un cambio de input;
- una vista que se adjunta.

Una asignación dentro de `subscribe` no es ninguna de ellas. Sin zone.js, ese campo cambia y el DOM queda desactualizado.

Diagnóstico antes de cualquier cambio: 11 de 18 componentes asignan estado dentro de `subscribe` sin notificación (auth, article, editor, home, profile, profile-articles, profile-favorites, settings, article-list, favorite-button, follow-button). Ya notifican: header y article-comment (`| async`); home además usa `rxLet`; footer y article-meta son `OnPush` sin suscripciones. `ShowAuthedDirective` se suscribe al estado compartido de autenticación y crea o elimina vistas.

Estabilidad de la API, leída de las definiciones de tipos de `@angular/core@22.2.4`: `provideZonelessChangeDetection()` es `@publicApi` desde 20.2.

---

## 2. ADR: compatibilidad zoneless sin un refactor simultáneo del estado

**Estado:** Aceptada.

**Contexto.** Pasar a zoneless exige que toda vista que cambie después de trabajo asíncrono notifique a Angular. Hay dos tipos de cambio que lo consiguen: mantener el modelo de estado actual (campos simples asignados en `subscribe`) y añadir notificaciones explícitas donde faltan, o mover el estado a señales, que notifican por sí mismas cuando se leen en la plantilla. La regla del proyecto es un concepto por cambio, y las plantillas y las aserciones de los specs existentes son la red de seguridad de esta etapa.

**Decisión.** Se decidió añadir `ChangeDetectorRef.markForCheck()` solo en los puntos donde la auditoría (sección 3) y un spec zoneless que falla (sección 5) muestran que falta una notificación. Ni señales ni `toSignal()` en esta etapa; mover el estado a señales es una etapa de modernización aparte. Sin cambios en plantillas; aserciones de los specs existentes sin cambios.

**Alternativas consideradas.**

| Alternativa                                                     | Por qué no se eligió                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convertir el estado de los componentes a señales / `toSignal()` | Diff más grande; cambian las plantillas (los campos pasan a ser lecturas de señales); mezcla dos objetivos (eliminar zone.js y modernizar el estado) en un solo cambio, así que una regresión podría venir de cualquiera de los dos    |
| Añadir `markForCheck()` mecánicamente después de cada escritura | Descartada en favor de una ubicación guiada por la auditoría: cada llamada responde a una notificación concreta que falta, demostrada por un spec, en lugar de cubrir puntos que ya notifican o que nunca tocan estado de la plantilla |

**Consecuencias.**

- Positiva: diff pequeño y revisable (10 archivos, +52 / −12); sin cambios en plantillas; reversión sencilla, ya que el cambio es un cambio de provider más llamadas aisladas.
- Negativa: los componentes contienen código imperativo de notificación que habrá que eliminar cuando el estado pase a señales.
- Negativa: cualquier nuevo estado asíncrono escrito fuera de un camino notificado tiene que acordarse de llamar a `markForCheck()`; nada en la plantilla hace visible la omisión.

---

## 3. La auditoría

Se auditaron 20 suscripciones y continuaciones asíncronas en los 11 componentes y en `ShowAuthedDirective`: qué campos asignados lee la plantilla y si otro mecanismo ya notifica.

| Categoría                          | Puntos                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Necesita `markForCheck()`** (13) | auth `:95` (rama de error); article `:81` (carga), `:126` (añadir comentario, ambas ramas), `:143` (borrar comentario); editor `:60` (carga en modo edición, `tagList`), `:104` (error al crear); profile `:52`; profile-articles `:35`; profile-favorites `:35`; settings `:77` (error al actualizar); article-list `:67`; favorite-button `:60` (rama de error); follow-button `:59` (rama de error)                                     |
| Ya notificado                      | Outputs `(toggle)` de los hijos: los listeners de la plantilla marcan como sucia la vista hija y sus ancestros, y todos los usos de los botones enlazan `(toggle)`, así que sus ramas de éxito están cubiertas. `ShowAuthedDirective`: `createEmbeddedView` / `clear` notifican al planificador al adjuntar / separar la vista. Tags de home mediante `rxLet`. `\| async` en header, article-comment y el cuerpo en markdown (una Promise) |
| No es estado de la plantilla       | Suscripciones que solo navegan (borrar artículo; ramas de éxito de auth, editor y settings)                                                                                                                                                                                                                                                                                                                                                |
| Síncrono en el primer renderizado  | Estado de autenticación: `currentUser` es un `BehaviorSubject` y `provideAppInitializer` se resuelve antes del bootstrap                                                                                                                                                                                                                                                                                                                   |

Los 13 puntos se convierten en 14 llamadas, porque el punto de añadir comentario necesita una en cada rama.

### Un caso incidental: añadir comentario

El primer spec de la rama de éxito de añadir comentario (`article.component.ts:126`) pasaba sin corrección cuando el usuario escribía el comentario primero. `commentControl.reset("")` cambia el control entre pristine y dirty, y esas clases de estado del formulario se basan en señales, así que Angular recibe una notificación y la vista se actualiza. Esa notificación es un efecto secundario del estado del formulario, no de la lista de comentarios. Un segundo spec asigna el valor por código, de modo que el control sigue pristine: falló (`expected [ 'comment 1' ] to deeply equal [ 'new one', 'comment 1' ]`). Se mantuvo un `markForCheck()` defensivo en ambas ramas, como indicaba la auditoría, para que la lista no dependa de que el estado del formulario cambie por casualidad.

> **Lección:** un spec zoneless puede pasar por una notificación que no tiene relación con lo que comprueba. Variar cómo llega la entrada lo dejó al descubierto.

---

## 4. Por qué los specs existentes no podían ver el problema

Los specs existentes llaman a `fixture.detectChanges()` después de cada cambio. En los componentes con `ChangeDetectionStrategy.Eager`, esa llamada actualiza la vista tanto si Angular recibió una notificación como si no. Un componente que quedaría desactualizado en una app zoneless parece correcto en esos specs. Activar `provideCheckNoChangesConfig({ exhaustive: true })` no lo cambia (sección 8).

### Cómo se construyen los specs de regresión zoneless (`7faa49e`)

Reglas, aplicadas en 13 archivos de spec nuevos (`*.zoneless.spec.ts` junto a cada componente, más `settings.component.spec.ts`):

- `TestBed` con `provideZonelessChangeDetection()`;
- las fuentes asíncronas son `Subject`s que emiten después del primer renderizado;
- `await fixture.whenStable()`, nunca `detectChanges()`;
- la aserción lee el DOM.

```ts
fixture = TestBed.createComponent(ProfileComponent);
await fixture.whenStable();
expect(el().querySelector(".profile-page")).toBeNull();

response.next(bob);
await fixture.whenStable();

expect(el().querySelector(".user-info h4")?.textContent?.trim()).toBe("bob");
```

Hechos sobre el entorno de pruebas, descubiertos al escribirlos:

| Hecho                                                                                                  | Consecuencia                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Las fixtures zoneless detectan cambios automáticamente por defecto                                     | El primer renderizado no necesita `detectChanges()`                                                          |
| Una petición `HttpClient` sin resolver bloquea `whenStable()`                                          | Los servicios se sustituyen por stubs con `Subject`s                                                         |
| Terminar una petición `HttpClient` elimina una tarea pendiente, pero no marca ninguna vista como sucia | Una respuesta HTTP por sí sola no actualiza una vista                                                        |
| El renderizado de `rxLet` y una Promise en `AsyncPipe` no los rastrea `whenStable()`                   | Esos dos controles esperan con `vi.waitFor`                                                                  |
| Un texto estático en la vista de una directiva se vería igual antes y después de una actualización     | El control de `ShowAuthedDirective` renderiza un binding (`{{ label }}`), lo que demuestra una actualización |

> **Lección:** un test que fuerza la actualización que debería observar no puede detectar una actualización que falta. Los specs de regresión eliminan la actualización forzada y dejan que la propia planificación de Angular decida qué muestra el DOM.

---

## 5. Evidencia RED → GREEN

### RED (`7faa49e`, antes de cualquier corrección)

Este commit contiene specs que fallan de forma intencionada.

| Grupo                                         | Resultado                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs de regresión zoneless                   | **14 RED**, todos con DOM desactualizado, p. ej. `expected undefined to be 'My title'`, una clase de botón que sigue en `disabled`, y el caso de añadir comentario de la sección 3 |
| Controles (ya notificados)                    | 5 GREEN: mostrar / ocultar de `ShowAuthedDirective`, tags de home mediante `rxLet`, éxito de favorito mediante `(toggle)`, markdown `\| async`                                     |
| Formulario de settings (`KNOWN BUG (locked)`) | GREEN (sección 8)                                                                                                                                                                  |
| Specs existentes                              | 122 GREEN                                                                                                                                                                          |

Total: 143 tests. Mientras zone.js seguía cargado, el aviso esperado era `NG0914: The application is using zoneless change detection, but is still loading Zone.js`.

### GREEN (`35e9874`)

`ChangeDetectorRef` añadido como parámetro del constructor (los 10 componentes ya usan inyección por constructor) y `this.cdr.markForCheck()` en los 14 puntos de llamada auditados: auth 1, article 4, editor 2, profile 1, profile-articles 1, profile-favorites 1, settings 1, article-list 1, favorite-button 1, follow-button 1. 10 archivos, +52 / −12; sin cambios en plantillas ni en specs. Resultado: 143/143 en verde.

```diff
       .subscribe(([profile, user]) => {
         this.profile = profile;
         this.isUser = profile.username === user?.username;
+        this.cdr.markForCheck();
       });
```

**Comprobación por mutación:** al eliminar el `markForCheck()` de `profile.component.ts` falla exactamente un spec, "renders the profile after it emits asynchronously"; después se restauró.

---

## 6. El cambio en la app (`990252d`)

```diff
-import { provideZoneChangeDetection } from "@angular/core";
+import { provideZonelessChangeDetection } from "@angular/core";
 ...
   .bootstrapModule(AppModule, {
-    applicationProviders: [provideZoneChangeDetection()],
+    applicationProviders: [provideZonelessChangeDetection()],
   })
```

- `angular.json`: `polyfills` eliminado de las opciones de build y de la configuración `testing`.
- `zone.js` desinstalado (eliminado de `package.json` y `package-lock.json`).

### Tres specs existentes corregidos en el entorno de pruebas

Sin zone.js, `TestBed` funciona en modo zoneless para todos los specs, no solo para los nuevos. 3 specs de caracterización existentes fallaron con `NG0100 ExpressionChangedAfterItHasBeenChecked`:

| Archivo de spec                              | Qué hace                           |
| -------------------------------------------- | ---------------------------------- |
| `article.component.spec.ts` (2 specs)        | Escribe `component.comments = ...` |
| `article-preview.component.spec.ts` (1 spec) | Escribe `value.tagList = ...`      |

**Por qué:** cada spec escribe un campo directamente y después llama a `fixture.detectChanges()` sin notificar a Angular. En la app, esas escrituras ocurren dentro de suscripciones o manejadores de eventos que sí notifican, así que es una propiedad de la preparación del test, no de la app.

**Corrección (solo en los tests, aserciones sin cambios):** `fixture.componentRef.changeDetectorRef.markForCheck()` antes de `fixture.detectChanges()` en esos 3 specs.

**Nueva verificación:** la mutación V2 de la etapa 14 (`track $index`) sigue haciendo fallar 2 specs; asignar el mismo `tagList` en lugar de uno nuevo hace fallar el spec del preview. Los specs siguen detectando lo que detectaban antes.

**Nota de proceso:** al restaurar una mutación temporal, `git checkout` sobre `article-preview.component.spec.ts` revirtió también la corrección del entorno de pruebas, aún sin commit, en ese archivo. Se volvió a aplicar y a verificar antes del commit.

---

## 7. Verificación y métricas

| Métrica                                      | Antes (etapa 14)                  | Después                                                                                                                    |
| -------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tests                                        | 122/122 (19 archivos)             | 143/143 (32 archivos), sin aviso `NG0914`                                                                                  |
| Cobertura (stmts / branches / funcs / lines) | 80.55% / 71.18% / 68.48% / 78.78% | 87.17% / 79.66% / 77.45% / 85.82%                                                                                          |
| Bundle inicial (raw / transfer)              | 357.58 kB / 99.59 kB              | 319.70 kB / 87.46 kB (−37.88 kB raw / −12.13 kB transfer; el commit de `markForCheck()` por sí solo sumó +0.10 / +0.04 kB) |
| Chunk `polyfills`                            | Presente                          | Desaparece                                                                                                                 |
| Símbolo `__Zone_` en `dist/`                 | —                                 | Ninguno                                                                                                                    |
| Build de producción                          | —                                 | 1.6 / 1.5 / 1.5 s, sin avisos                                                                                              |

> **Honestidad sobre los números:** el aumento de cobertura se debe a los 21 specs nuevos, no al cambio a zoneless. Además hereda una fuente conocida de no determinismo de la etapa 14: `MarkdownPipe.transform` espera `import("marked")` y ningún spec espera al pipe, así que el que una de sus líneas se ejecute antes del teardown depende del tiempo (seguimiento).

**Prueba de humo:** `ng serve` devolvió HTTP 200. Chrome headless (`--dump-dom`) mostró que la app arranca en modo zoneless (`ng-version="22.2.4"`) y renderiza el header (`conduit`, `Sign in`, `Sign up` mediante `ShowAuthedDirective`), `Global Feed` y `Popular Tags`. Los datos del feed no cargan porque la API pública ya no existe (documentado desde la etapa 00).

---

## 8. Hallazgos

### a) El formulario de settings nunca se rellena (bloqueado, no corregido)

`settings.component.ts:57` pasa a `patchValue` el Observable que devuelve `getCurrentUser()`, y el cast `as Partial<User>` oculta la incompatibilidad de tipos. El formulario de settings nunca se rellena y la petición de actualización nunca se envía. Es un defecto previo, sin relación con zone.js. Siguiendo "migrar ≠ corregir", queda bloqueado con un spec `KNOWN BUG (locked)` en el nuevo `settings.component.spec.ts` y no se corrige en esta etapa.

### b) `provideCheckNoChangesConfig` considerado, no usado

`provideCheckNoChangesConfig({ exhaustive: true })` es `@developerPreview` desde 20.0. Aquí no ayuda: los specs existentes llaman a `detectChanges()` manualmente, lo que actualiza las vistas `Eager` de todos modos, así que las notificaciones que faltan seguirían ocultas. Los specs de regresión zoneless (sección 4) cubren ese hueco.

---

## 9. Seguimiento

| Tema                                                    | Detalle                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Modernización a señales                                 | Etapa aparte; mover el estado de los componentes a señales y eliminar los `markForCheck()` añadidos aquí (sección 2) |
| Spec que espere a `MarkdownPipe.transform`              | Elimina el no determinismo de cobertura heredado de la etapa 14                                                      |
| Adoptar la semántica de `?.` en plantillas de v22       | Eliminar el wrapper `$safeNavigationMigration` en `article.component.html`                                           |
| Revisar componentes con `ChangeDetectionStrategy.Eager` | Ahora que la notificación es explícita, son candidatos a `OnPush`                                                    |
