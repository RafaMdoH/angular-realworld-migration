# 08 — Control flow integrado (Angular 20.3)

> Registro de decisiones: por qué la conversión se hace antes del upgrade a Angular 21, cómo se extendió la red de seguridad a los templates afectados, el concepto detrás del cambio, qué hizo la migración, verificación, métricas y comparación con el enfoque de los mantenedores.

**Rama:** `feature/migrate-control-flow` · **Commits:** `a2826c7` (specs de caracterización), `59ae6a4` (migración)

---

## 1. Por qué ahora y por qué como etapa separada

| Pregunta                              | Cómo se respondió                                | Resultado                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Angular 21 obliga a esta conversión? | `migrations.json` de `@angular/core@21`          | `control-flow-migration` no tiene la marca `optional`: `ng update` a v21 la ejecuta como migración obligatoria                                                                       |
| ¿Cuánto código toca?                  | Inventario de directivas estructurales en `src/` | 27 apariciones de `*ngIf` / `*ngFor` en 10 templates (auth 3, header 2, article-comment 2, article 7, editor 1, home 1, profile 3, article-list 5, article-preview 1, list-errors 2) |
| ¿Ese código está protegido por tests? | Specs que renderizan cada template               | Solo 3 de 10 (auth, editor, home)                                                                                                                                                    |
| ¿Qué más exige el upgrade a v21?      | `peerDependencies` y `engines` de Angular 21.2   | TypeScript `>=5.9 <6.1` (actual 5.8.3), zone.js `~0.15.0 \|\| ~0.16.0`, Node `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`                                                                  |

Hacer la conversión dentro del upgrade a v21 mezclaría en un mismo diff un cambio de versión del framework, una subida de TypeScript y 10 templates reescritos. Hacerla antes, sobre Angular 20, mantiene un concepto por cambio: cuando `ng update` a v21 ejecute `control-flow-migration`, no quedará nada por convertir.

> **Lección:** una migración opcional en un major puede volverse obligatoria en el siguiente. Leer el `migrations.json` de la versión destino antes de actualizar muestra qué cambios se van a forzar y permite hacerlos antes, por separado y en condiciones controladas.

---

## 2. Cerrar el hueco de la red de seguridad

La migración reescribe templates. Un template reescrito puede renderizar algo distinto y seguir compilando, así que los specs que importan aquí son los que renderizan el template y comprueban el DOM. Siete de los diez templates afectados no tenían ninguno.

### Specs de caracterización añadidos (`a2826c7`)

44 specs en 7 archivos, escritos antes de cualquier cambio de producción. Cada uno fija el renderizado actual de una rama de `*ngIf` / `*ngFor` a través del DOM, incluidos los alias `as`.

| Template          | Specs | Qué se fija                                             |
| ----------------- | ----- | ------------------------------------------------------- |
| `header`          | 5     | Todas las ramas, incluido el alias `async as`           |
| `article`         | 12    | Todas las ramas, incluida la identidad DOM de `trackBy` |
| `article-comment` | 7     | Todas las ramas                                         |
| `profile`         | 5     | Todas las ramas                                         |
| `article-list`    | 7     | Todas las ramas                                         |
| `article-preview` | 4     | Todas las ramas                                         |
| `list-errors`     | 4     | Todas las ramas, incluido un bug fijado (2 specs)       |

### Fijar `trackBy` a través del DOM

La lista de comentarios de `article.component.html` usaba `*ngFor ... trackBy: trackById`. `trackBy` no cambia lo que se renderiza; cambia **qué elementos del DOM se reutilizan**. Un spec que solo comprobara texto pasaría con o sin él.

Por eso el spec comprueba la identidad de los elementos: guarda una referencia a los elementos de comentario renderizados, reemplaza la lista por **objetos nuevos con los mismos ids** (y, por separado, la reordena) y verifica que siguen ahí los mismos elementos del DOM. Sin `trackBy`, objetos nuevos implican elementos nuevos y el spec falla.

### Un bug encontrado y fijado, no corregido

`ListErrorsComponent` siempre renderiza un `ul.error-messages` vacío: `errorList` es siempre un array y `[]` es truthy, así que el `*ngIf` que protege la lista siempre es verdadero. Dos specs lo fijan como `KNOWN BUG (locked)`. La migración debe conservarlo; corregirlo es otro cambio.

### Pruebas de mutación

Cada spec nuevo demostró su utilidad rompiendo el template a propósito y confirmando que fallaban los specs esperados; después se restauró.

| Tipo de mutación                               | Resultado                           |
| ---------------------------------------------- | ----------------------------------- |
| Rama del template invertida                    | Fallan los specs esperados          |
| Rama del template eliminada                    | Fallan los specs esperados          |
| Lista renderizada recortada                    | Fallan los specs esperados          |
| `trackBy` eliminado de la lista de comentarios | Fallan los specs esperados          |
| **Total**                                      | **21 mutaciones, todas detectadas** |

Tras las pruebas, `git diff -- '*.html'` quedó vacío: ningún template quedó modificado.

| Métrica                                      | Antes de los specs nuevos      | Después de los specs nuevos    |
| -------------------------------------------- | ------------------------------ | ------------------------------ |
| Tests                                        | 76/76                          | 120/120                        |
| Cobertura (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 76.92% / 74% / 68.29% / 75.65% |

> **Lección:** statements subió casi 20 puntos, pero Branches se quedó en 74%. Las ramas de template (`*ngIf`, `*ngFor`) no se cuentan en la métrica Branches, así que un informe de cobertura puede parecer sano mientras la mayoría de las ramas de template no tienen tests. Si un template está protegido lo responden los specs que lo renderizan, no el porcentaje.

### Límites honestos

| No cubierto                                                    | Por qué                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `RangeError` de `article-list` cuando `limit` no está definido | Código del componente, no una rama de template; no se fija aquí |
| Rutas de navegación de `catchError` en article / profile       | No hay rama de template implicada                               |

---

## 3. El concepto: directivas estructurales vs control flow integrado

**Antes:** `*ngIf` y `*ngFor` son **directivas** (`NgIf`, `NgForOf`) de `@angular/common`. El `*` es una abreviatura de un `<ng-template>` que la directiva crea o elimina en tiempo de ejecución. Como cualquier directiva en un componente standalone, deben figurar en `imports`.

**Después:** `@if` y `@for` son **sintaxis de template**, que procesa el compilador de templates. No son directivas, así que no hay nada que importar.

| Aspecto                    | Directiva estructural                                 | Control flow integrado                   |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Condición                  | `<li *ngIf="cond">`                                   | `@if (cond) { <li> }`                    |
| Alias de un `async`        | `*ngIf="user$ \| async as user"`                      | `@if (user$ \| async; as user) { … }`    |
| Bucle                      | `*ngFor="let item of items"`                          | `@for (item of items; track item) { … }` |
| Seguimiento                | `trackBy` opcional; por defecto, identidad del objeto | `track` es **obligatorio**               |
| Seguimiento personalizado  | `trackBy: trackById`                                  | `track trackById($index, item)`          |
| Imports en los componentes | `NgIf`, `NgForOf` en `imports`                        | Ninguno                                  |

**Por qué `track` es obligatorio:** cómo reutiliza una lista los elementos del DOM es una decisión con consecuencias de rendimiento y de estado. Con `*ngFor`, omitir `trackBy` significaba en silencio "seguir por identidad del objeto". `@for` hace explícita la decisión en cada bucle.

**Qué significa para esta migración:** un bucle sin `trackBy` pasa a `track <item>`, que es identidad del objeto, igual que el valor por defecto de `*ngFor`. Un bucle con `trackBy` pasa a una llamada a la misma función con los mismos argumentos. En ambos casos el seguimiento es el mismo que antes; el template solo lo declara.

---

## 4. Qué hizo la migración (`59ae6a4`)

```bash
npx ng g @angular/core:control-flow --path=src --format=true
```

Se ejecutó sobre Angular 20.3.35. Actualizó 10 templates y los 10 archivos `.ts` de sus componentes; no tocó ningún spec.

| Antes                                                  | Después                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `*ngIf="cond"`                                         | `@if (cond) { … }`                                                   |
| `*ngIf="x \| async as y"`                              | `@if (x \| async; as y) { … }`                                       |
| `*ngFor="let item of items"`                           | `@for (item of items; track item) { … }`                             |
| `*ngFor="let comment of comments; trackBy: trackById"` | `@for (comment of comments; track trackById($index, comment)) { … }` |
| `NgIf` / `NgForOf` en `imports` y en los imports de TS | Eliminados                                                           |

Dos extractos reales. El header, con el alias `async as` y una condición anidada:

```diff
// header.component.html (59ae6a4)
-      <li class="nav-item" *ngIf="currentUser$ | async as currentUser">
+      @if (currentUser$ | async; as currentUser) {
+      <li class="nav-item">
 ...
-          <img
-            [src]="currentUser.image"
-            *ngIf="currentUser.image"
-            class="user-pic"
-          />
+          @if (currentUser.image) {
+          <img [src]="currentUser.image" class="user-pic" />
+          }
```

La lista de comentarios, el único bucle con seguimiento personalizado:

```diff
// article.component.html (59ae6a4)
+        @for (comment of comments; track trackById($index, comment)) {
         <app-article-comment
-          *ngFor="let comment of comments; trackBy: trackById"
           [comment]="comment"
```

El formato que genera la propia migración se normalizó con Prettier, de modo que el diff sigue el estilo del proyecto. Diff final: 20 archivos, +84 / −99. No queda ningún `*ngIf` / `*ngFor` en `src/`.

> **Lección:** la única conversión que requería criterio era la de `trackBy`, y quedó fijada por un spec de identidad DOM antes de ejecutar la migración. La revisión tuvo entonces una pregunta concreta que responder (¿misma función, mismos argumentos?) en lugar de una general.

---

## 5. Verificación y métricas

| Comprobación                              | Resultado                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| Archivos de spec tocados por la migración | Ninguno (aserciones idénticas antes y después)           |
| Suite completa                            | 120/120 ✅, incluidos los dos specs `KNOWN BUG (locked)` |
| `grep -rnE '\*ng(If\|For\|Switch)' src`   | Sin coincidencias                                        |
| Warnings del compilador                   | Ninguno                                                  |

**Método:** build de producción, 3 ejecuciones. La columna "antes" es la medición final de la etapa 07 (Angular 20.3, directivas estructurales), más los specs nuevos en tests y cobertura.

| Métrica                                      | Antes (directivas)             | Después (control flow)         | Cambio         |
| -------------------------------------------- | ------------------------------ | ------------------------------ | -------------- |
| Tests                                        | 120/120                        | 120/120                        | Sin cambios    |
| Cobertura (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Sin cambios    |
| Build de producción (3 ejecuciones)          | 2.3 / 2.4 / 2.4 s              | 2.4 / 1.7 / 1.7 s              | Sin conclusión |
| Bundle inicial (raw)                         | 341.45 kB                      | 337.58 kB                      | −3.87 kB       |
| Bundle inicial (transfer)                    | 96.52 kB                       | 96.02 kB                       | −0.50 kB       |
| `main`                                       | 8.68 kB                        | 8.47 kB                        | −0.21 kB       |
| Chunk compartido del framework               | 294.87 kB                      | 291.21 kB                      | −3.66 kB       |
| `polyfills`                                  | 34.59 kB                       | 34.59 kB                       | Sin cambios    |

> **Honestidad sobre los números:** los tiempos de build varían entre ejecuciones y no se usan como evidencia. La reducción del bundle es pequeña pero coherente con el cambio: ningún componente importa ya `NgIf` / `NgForOf`, así que esas directivas dejan de incluirse.

---

## 6. Hallazgos

### a) El bundle se redujo

- **Observación:** total inicial −3.87 kB raw / −0.50 kB transfer; la reducción está en `main` y en el chunk compartido del framework.
- **Causa:** las directivas `NgIf` / `NgForOf` dejan de incluirse porque ningún componente las importa.
- **Contexto:** la etapa 07 añadió +8.22 kB raw; esta etapa devuelve una parte, por un motivo distinto.

### b) El comportamiento es idéntico, hasta donde ven los specs

- **Observación:** los mismos 120 specs, con aserciones sin cambios, pasan antes y después, incluidos el spec de identidad DOM de `trackBy` y los dos specs de bugs fijados.
- **Límite:** esto cubre lo que observan los specs. Los puntos de "Límites honestos" (sección 2) no están fijados y no hay validación manual en ejecución (la API pública no está disponible).

---

## 7. Comparación con la "hoja de respuestas" (upstream)

|                     | Mantenedores                                                                                                                                | Esta migración                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Control flow en v20 | [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2): un `*ngIf` convertido a mano a `@if` en el header | Las 27 apariciones convertidas con la migración oficial                 |
| Upgrade a v21       | [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3): solo cambiaron `package.json` y el lockfile       | Siguiente etapa; la conversión de control flow ya está hecha antes      |
| Red de seguridad    | —                                                                                                                                           | 44 specs de caracterización + 21 pruebas de mutación antes de convertir |

> **Lección:** en los dos commits de upstream comparados aquí, el control flow aparece solo como una condición convertida a mano. Aquí es una etapa propia, protegida primero por specs, para que el diff del upgrade a v21 trate solo de la versión del framework.

---

## 8. Pendientes

| Tema                                                                   | Detalle                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Angular 20 → 21                                                        | Siguiente etapa; exige TypeScript 5.8 → 5.9                          |
| `ListErrorsComponent` renderiza un `ul.error-messages` vacío           | Fijado como `KNOWN BUG`; se corregirá en su propio cambio `fix(...)` |
| `RangeError` de `article-list` cuando `limit` no está definido         | Identificado al escribir los specs; código del componente, no fijado |
| Paquete del builder `@angular-devkit/build-angular` → `@angular/build` | Sigue abierto desde la etapa 07 (`use-application-builder`)          |
| `APP_INITIALIZER` → `provideAppInitializer()`                          | Sigue abierto desde la etapa 05                                      |
| Node 24                                                                | Sigue abierto desde la etapa 07                                      |
