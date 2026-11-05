# 14 — Tests: Karma + Jasmine → Vitest (Angular 22.2)

> Registro de decisiones: por qué cambia el runner de tests, por qué esta etapa es más arriesgada que los upgrades anteriores (reescribe la propia red de seguridad), la decisión sobre el entorno de tests, los dos pasos oficiales y las correcciones manuales, los cambios de dependencias, cómo se demostró que la nueva suite es la misma red de seguridad, métricas y la situación de upstream.

**Rama:** `feature/karma-to-vitest` · **Commits:** `cce577a` (configuración), `394050f` (refactor de specs + dependencias), `c23271b` (CI + evidencia de equivalencia)

---

## 1. Por qué, y por qué esta etapa es distinta

Karma es un proyecto deprecado. El paquete `@angular/build` de Angular incluye el builder `unit-test`, con Vitest como runner por defecto, y Angular 22 ofrece `migrate-karma-to-vitest` como migración opcional.

Todas las etapas anteriores cambiaron código de producción o herramientas, y los 122 specs se mantuvieron sin cambios para juzgar el resultado. Esta etapa es lo contrario: el código de producción no cambia y los specs sí. Todos usan APIs de Jasmine, así que la red de seguridad construida en la etapa 00 tiene que reescribirse. Mientras se convierten los specs, ningún test sin cambios los vigila.

Uso de APIs de Jasmine antes del cambio, en 19 archivos de spec:

| API                                                            | Apariciones |
| -------------------------------------------------------------- | ----------- |
| `jasmine.createSpyObj`                                         | 13          |
| `jasmine.SpyObj`                                               | 13          |
| `.and.returnValue`                                             | 28          |
| `spyOn(`                                                       | 3           |
| `.calls.`                                                      | 3           |
| `toHaveBeenCalled*`                                            | 31          |
| `fakeAsync`, `waitForAsync`, callbacks `done`, `jasmine.clock` | 0           |

Las restricciones se fijaron antes de empezar:

- Los títulos de los tests (`describe` / `it`) deben ser idénticos antes y después, y el total debe seguir siendo 122.
- Las aserciones deben conservar su significado; cada edición manual queda listada.
- Una muestra de mutaciones anteriores debe seguir siendo detectada por la suite de Vitest.
- Sin cambios en código de producción; sin tests nuevos; los bugs fijados siguen fijados.

> **Lección:** una suite de caracterización demuestra su valor detectando mutaciones (etapa 00). Cuando lo que cambia es la propia suite, una ejecución en verde solo demuestra que la nueva suite está de acuerdo consigo misma. La prueba tiene que venir de fuera de ella (sección 6).

---

## 2. Decisión: Node + jsdom frente a un navegador real

El builder `unit-test` ejecuta Vitest en Node salvo que se configure `browsers`. Karma ejecutaba los specs en un navegador real (CI usaba `--browsers=ChromeHeadless`).

| Opción                     | Qué requiere                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| **Node + jsdom** (elegida) | Valor por defecto del builder cuando no hay `browsers`; un paquete de entorno DOM (`jsdom`) |
| Navegador real             | `browsers` configurado en el target de test                                                 |

**Decisión (del usuario): Node + jsdom.** Las aserciones sobre el DOM se ejecutan ahora contra jsdom en lugar de Chrome. Que ese entorno sea suficiente para estos specs no se da por hecho: la sección 6 lo comprueba con las mismas mutaciones que Karma detectaba.

---

## 3. Dos pasos oficiales

El trabajo usa dos herramientas oficiales distintas, y hacen cosas diferentes.

### Paso 1 — configuración (`cce577a`)

```bash
npx ng update @angular/cli --name migrate-karma-to-vitest
```

| Hizo                                                                                                                    | No hizo                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Target de test `@angular/build:karma` → `@angular/build:unit-test`, `runner: "vitest"`, `buildTarget: ":build:testing"` | Eliminar ninguna dependencia de Karma / Jasmine          |
| Nueva configuración de build `testing` (sin AOT, sin optimización, polyfills `zone.js` + `zone.js/testing`, assets)     | Añadir un entorno DOM                                    |
| Tipos de `tsconfig.spec.json` `jasmine` → `vitest/globals`                                                              | Añadir un proveedor de cobertura                         |
| Añadió `vitest ^5.0.0`                                                                                                  | Tocar el código de los specs (solo recomienda el paso 2) |

La migración requiere el builder `@angular/build:application`, adoptado en la etapa 10.

### Paso 2 — código de los specs (`394050f`)

```bash
npx ng g @schematics/angular:refactor-jasmine-vitest --project=angular-conduit
```

19 archivos analizados, 12 transformados, 7 sin cambios, 0 TODOs (informe: `docs/tasks/evidence/jasmine-vitest-20261105T190035550Z.md`).

| Jasmine                       | Vitest                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `jasmine.createSpyObj(...)`   | Objeto de `vi.fn().mockName(...)`                      |
| `jasmine.SpyObj<T>`           | `MockedObject<T>`                                      |
| `.and.returnValue(...)`       | `.mockReturnValue(...)`                                |
| `.and.resolveTo(...)`         | `.mockResolvedValue(...)`                              |
| `toBeTrue()` / `toBeFalse()`  | `toBe(true)` / `toBe(false)`                           |
| `toHaveBeenCalledOnceWith(x)` | `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(x)` |
| `calls.mostRecent().args`     | `vi.mocked(fn).mock.lastCall`                          |

Ejemplo de `editor.component.spec.ts`, antes:

```ts
router = jasmine.createSpyObj<Router>("Router", ["navigate"]);
router.navigate.and.resolveTo(true);
```

Después (incluida la conversión de tipo manual de la sección 4):

```ts
router = {
  navigate: vi.fn().mockName("Router.navigate"),
} as unknown as MockedObject<Router>;
router.navigate.mockResolvedValue(true);
```

No cambió el entorno ni las dependencias: el entorno DOM, el proveedor de cobertura y la eliminación de Karma se hicieron a mano (sección 5).

---

## 4. Correcciones manuales

El informe del refactor indica que no se requieren cambios manuales. Después, el build de test falló con 16 errores de TypeScript, todos solo de tipos. Se corrigieron con 15 ediciones, aplicadas mediante script y listadas aquí.

| Corrección                                                                            | Ediciones | Archivos                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Literal de objeto mock asignado a `MockedObject<T>` → `as unknown as MockedObject<T>` | 12        | `app.module.spec.ts` (4), `auth.component.spec.ts` (1), `user.service.spec.ts` (1), `article.component.spec.ts` (2), `editor.component.spec.ts` (3), `profile.component.spec.ts` (1), `article-list.component.spec.ts` (1) |
| `mock.lastCall[0]` → `mock.lastCall![0]`                                              | 3         | `editor.component.spec.ts` (2), `article-list.component.spec.ts` (1)                                                                                                                                                       |

### Por qué difiere el tipado

`createSpyObj<T>` de Jasmine estaba tipado como el `T` completo, independientemente de los métodos listados. El código convertido es un literal de objeto que solo tiene los métodos simulados, por lo que TypeScript lo rechaza como `MockedObject<T>`. La conversión de tipo restaura el tipado anterior; no cambia nada en tiempo de ejecución.

### `lastCall!` y la equivalencia en tiempo de ejecución

`mock.lastCall` está tipado como posiblemente `undefined` (todavía sin llamadas). La aserción de no nulo solo satisface al compilador:

```ts
// antes
expect(articles.create.calls.mostRecent().args[0]).toEqual({
// después
expect(vi.mocked(articles.create).mock.lastCall![0]).toEqual({
```

Sin una llamada, el test sigue fallando en tiempo de ejecución, como ocurría con `calls.mostRecent()`. La aserción conserva su significado.

---

## 5. Dependencias

| Cambio           | Paquetes                                                                                                                                                        | Por qué                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Eliminados       | `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `karma-jasmine-html-reporter`, `jasmine-core`, `@types/jasmine`, `istanbul-lib-instrument` | El paso 1 los dejó instalados; 167 paquetes eliminados                                                          |
| Añadido (paso 1) | `vitest ^5.0.0`                                                                                                                                                 | Runner de tests                                                                                                 |
| Añadido          | `jsdom ^31.0.0`                                                                                                                                                 | El builder requiere un entorno DOM cuando se ejecuta en Node                                                    |
| Añadido          | `@vitest/coverage-istanbul ^5.1.0`                                                                                                                              | Istanbul es la misma familia de instrumentador que usaba Karma; se eligió para mantener la cobertura comparable |

---

## 6. Demostrar que la red de seguridad sigue siendo la misma

Tres comprobaciones independientes; ninguna depende solo de que la nueva suite esté en verde.

### a) Títulos idénticos

Los títulos de los tests se inventariaron de forma estática antes del cambio (`docs/tasks/evidence/karma-to-vitest-titles-before.txt`, formato `archivo | tipo | título`) y de nuevo después (`docs/tasks/evidence/karma-to-vitest-titles-after.txt`).

- `diff` entre ambos archivos: vacío.
- 122 `it`, 29 `describe`, antes y después.
- El reporter detallado de Vitest lista 122 tests superados.

No se perdió, fusionó, renombró ni añadió ningún test.

### b) Las mutaciones se siguen detectando

Se aplicó al código de producción una muestra de mutaciones de etapas anteriores, se ejecutó la suite de Vitest y se restauró el archivo. La tabla muestra el número de tests que fallan.

| ID  | Origen       | Mutación                                            | Karma         | Vitest |
| --- | ------------ | --------------------------------------------------- | ------------- | ------ |
| V1  | etapa 08 M03 | `@if (article)` → `@if (!article)`                  | 11            | 11     |
| V2  | etapa 08 M07 | `track trackById($index, comment)` → `track $index` | 2             | 2      |
| V3  | etapa 08 M08 | comentarios iterados en orden inverso               | 5             | 5      |
| V4  | etapa 08 M02 | condición del avatar del header invertida           | 3             | 3      |
| V5  | etapa 08 M20 | `@if (errorList)` → `@if (errorList.length)`        | 2             | 2      |
| V6  | etapa 08 M12 | condición del botón de seguir del perfil invertida  | 3             | 3      |
| V7  | etapa 12     | `provideAppInitializer(...)` eliminado              | 2             | 2      |
| V8  | etapa 00     | orden de los interceptores Token / Error invertido  | no registrado | 1      |
| V9  | etapa 00     | logout sin `destroyToken()`                         | no registrado | 3      |

Cada mutación con un conteo de Karma registrado hace fallar el mismo número de tests en Vitest, incluida V2, que depende de la identidad de los elementos del DOM bajo jsdom. V8 y V9 se detectan; sus conteos en Karma no se registraron, así que para ellas solo se afirma la detección.

### c) Cobertura

| Métrica    | Karma (istanbul) | Vitest (`@vitest/coverage-istanbul`) |
| ---------- | ---------------- | ------------------------------------ |
| Statements | 76.98%           | 80.55%                               |
| Branches   | 74%              | 71.18%                               |
| Functions  | 68.48%           | 68.48%                               |
| Lines      | 75.72%           | 78.78%                               |

> **Honestidad sobre las cifras:** las funciones son idénticas. Las otras tres métricas difieren, en ambas direcciones, con los mismos tests (sección 6a) detectando las mismas mutaciones (sección 6b). Eso apunta a una instrumentación distinta del mismo código, no a tests distintos. La diferencia se documenta, no se ajusta.

> **Lección:** cuando se migra la herramienta que te protege, la migración se protege con evidencia de fuera de esa herramienta: títulos idénticos y las mismas mutaciones detectadas. Un "todo en verde" en la nueva herramienta no mostraría por sí solo si la red sigue teniendo los mismos huecos.

---

## 7. Métricas

| Métrica                                      | Karma                                                                 | Vitest                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Tests                                        | 122/122                                                               | 122/122 (19 archivos)                                                   |
| Tiempo de tests                              | No registrado                                                         | 1.44 s (unos 3 s de reloj incluyendo el build)                          |
| Cobertura (stmts / branches / funcs / lines) | 76.98% / 74% / 68.48% / 75.72%                                        | 80.55% / 71.18% / 68.48% / 78.78%                                       |
| Build de producción (bundle inicial, raw)    | 357.58 kB                                                             | 357.58 kB (sin cambios)                                                 |
| Paquetes                                     | —                                                                     | 167 eliminados; añadidos `vitest`, `jsdom`, `@vitest/coverage-istanbul` |
| Comando de tests en CI                       | `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage` | `npx ng test --watch=false --coverage` (`c23271b`)                      |

La ruta del artefacto de cobertura en CI (`coverage/`) no necesitó cambios.

---

## 8. Upstream

Upstream ya usa Vitest: su commit de Angular 21 [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3) tiene `"test": "vitest"` en lugar de Karma (registrado en la etapa 09). No se comparó aquí cómo configuró upstream su entorno ni cómo convirtió sus specs.

|                  | Upstream | Esta migración                                                    |
| ---------------- | -------- | ----------------------------------------------------------------- |
| Runner de tests  | Vitest   | Vitest mediante `@angular/build:unit-test`                        |
| Red de seguridad | —        | Diff de títulos, 9 mutaciones, comparación de cobertura con Karma |

---

## 9. Seguimiento

| Tema                                                        | Detalle                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Detección de cambios zoneless                               | Siguiente etapa (15)                                                       |
| Adoptar la semántica de `?.` en templates de v22            | Eliminar el wrapper `$safeNavigationMigration` en `article.component.html` |
| Revisar los componentes con `ChangeDetectionStrategy.Eager` | Al pasar a `OnPush` / zoneless                                             |
