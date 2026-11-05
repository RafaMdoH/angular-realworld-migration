# 11 — Upgrade Angular 21.2 → 22.2 (+ TypeScript 6.0)

> Registro de decisiones: diagnóstico, qué cambió `ng update` (con el concepto detrás de las migraciones que conservan el comportamiento anterior cuando cambia un valor por defecto), la deprecación de `baseUrl` en TypeScript 6.0, cómo se comprobó la red de seguridad, métricas y la situación de upstream.

**Rama:** `feature/upgrade-angular-22` · **Commits:** `978e3f5` (Angular 22 + TypeScript 6.0), `bd17f0e` (rx-angular 22)

---

## 1. Diagnóstico antes de actualizar

Angular 22 es la línea `latest` actual (22.2.4; 22.0.0 se publicó el 2026-06-03). El plan del proyecto se corrigió para incluir esta etapa tras consultar npm al cierre de la etapa 09; la etapa 10 cambió primero el paquete del builder para que esta etapa pudiera ser solo un cambio de versión.

| Pregunta                                | Cómo se respondió                                         | Resultado                                                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Sigue siendo válido mi Node?           | `engines` de Angular 22.2                                 | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` → Node 22.23.4 ✅                                                                                                                                                                                          |
| ¿Qué TypeScript?                        | `peerDependencies` del compilador                         | `>=6.0 <6.1` → actual 5.9.3 ❌, se requiere un major de TypeScript                                                                                                                                                                                |
| ¿Qué zone.js?                           | peerDependencies de `@angular/core@22`                    | `~0.15.0 \|\| ~0.16.0` → actual 0.15.1 ✅                                                                                                                                                                                                         |
| ¿Terceros atados al major?              | `npm view @rx-angular/{template,cdk}@22 peerDependencies` | `cdk@22.0.0` → `@angular/core >=22.0.0`; `template@22.0.0` requiere cdk `^22.0.0` (ya no una versión exacta)                                                                                                                                      |
| ¿Qué migraciones ejecutará `ng update`? | Catálogo de migraciones de v22                            | Candidatas para esta app: `change-detection-eager` (18 componentes, 2 ya `OnPush`), `safe-optional-chaining` (2 apariciones de `?.` en 1 template), `strict-safe-navigation-narrow`, `http-xhr-backend`, `add-istanbul-instrumenter`, entre otras |
| ¿Qué significa `Eager`?                 | Enum `ChangeDetectionStrategy` en `@angular/core@22`      | `OnPush = 0`, `Eager = 1`, `Default = 1`: `Eager` es el nuevo nombre del antiguo valor por defecto                                                                                                                                                |
| ¿Se quejará TypeScript 6.0?             | `tsconfig.json`                                           | Todavía define `baseUrl`, candidato a un error de deprecación                                                                                                                                                                                     |

> **Lección:** este major trae varios valores por defecto nuevos a la vez. Leer el catálogo de migraciones y los valores del enum antes de ejecutar `ng update` convirtió un diff grande en una lista de cambios esperados que verificar uno por uno.

---

## 2. Qué hizo `ng update @angular/core@22 @angular/cli@22`

```bash
npx ng update @angular/core@22 @angular/cli@22
```

| Cambio                                 | Antes   | Después                        |
| -------------------------------------- | ------- | ------------------------------ |
| `@angular/*`                           | 21.2.26 | 22.2.4                         |
| `@angular/cli` / `@angular/build`      | 21.2.29 | 22.2.6                         |
| `typescript`                           | 5.9.3   | 6.0.3 (fijado por `ng update`) |
| `zone.js`                              | 0.15.1  | Sin cambios                    |
| `@rx-angular/cdk`                      | 21.1.1  | 22.0.0                         |
| `@rx-angular/template`                 | 21.2.1  | 22.0.0                         |
| `istanbul-lib-instrument` (dev, nuevo) | —       | `^6.0.3`                       |

rx-angular se instaló por separado (`bd17f0e`), con rangos caret como antes. Sin `EBADENGINE` ni `ERESOLVE`.

### Migraciones automáticas con cambios

| Migración                           | Resultado                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`change-detection-eager`**        | `changeDetection: ChangeDetectionStrategy.Eager` añadido a los 16 componentes sin estrategia y a un componente host de test                 |
| **`http-xhr-backend`**              | `provideHttpClient(withXhr(), withInterceptorsFromDi())` en `app.module.ts` y en los providers de `TestBed` de 6 specs                      |
| **`safe-optional-chaining`**        | `currentUser?.image` en `article.component.html` envuelto en `$safeNavigationMigration(...)` (dos veces)                                    |
| **`strict-safe-navigation-narrow`** | `tsconfig.app.json` y `tsconfig.spec.json` suprimen los diagnósticos extendidos `nullishCoalescingNotNullable` y `optionalChainNotNullable` |
| **`add-istanbul-instrumenter`**     | `istanbul-lib-instrument` añadido a `devDependencies` (cobertura de Karma)                                                                  |

### Migraciones automáticas sin cambios

| Migración                     | Resultado                         |
| ----------------------------- | --------------------------------- |
| `can-match-snapshot-required` | Sin cambios                       |
| `incremental-hydration`       | Sin cambios                       |
| `model-output`                | Sin cambios                       |
| `strict-templates-default`    | Ya estaba `strictTemplates: true` |
| `trust-proxy-headers`         | Sin cambios                       |
| `update-workspace-config`     | Sin cambios                       |

### Migraciones opcionales no ejecutadas

| Migración                 | Motivo                                       |
| ------------------------- | -------------------------------------------- |
| `migrate-karma-to-vitest` | Karma → Vitest sigue siendo un cambio aparte |
| `use-application-builder` | Ya hecho en la etapa 10                      |

---

## 3. Concepto: nuevos valores por defecto, comportamiento anterior conservado

Las migraciones de v22 que tocaron esta app comparten un patrón: donde v22 cambia un valor por defecto, la migración escribe en el código el comportamiento anterior de forma explícita. Cada una se revisa a continuación.

### a) `ChangeDetectionStrategy.Eager`

```diff
// src/app/core/layout/header.component.ts (978e3f5)
-import { Component, inject } from "@angular/core";
+import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
 ...
+  changeDetection: ChangeDetectionStrategy.Eager,
```

- **Qué hace la migración:** añade `ChangeDetectionStrategy.Eager` a cada componente que no declaraba estrategia (16 componentes más el host de test en `show-authed.directive.spec.ts`).
- **Por qué el comportamiento no cambia:** en el enum de v22, `Eager` y el antiguo `Default` tienen el mismo valor (`1`). La migración hace explícito el comportamiento anterior, así que los componentes existentes conservan su detección de cambios.
- **Qué no toca:** los 2 componentes ya marcados como `OnPush` quedan intactos.

### b) `withXhr()`

```diff
// src/app/app.module.ts (978e3f5)
-    provideHttpClient(withInterceptorsFromDi()),
+    provideHttpClient(withXhr(), withInterceptorsFromDi()),
```

La migración añade `withXhr()` para que la app conserve el backend XHR de `HttpClient`. La misma línea se añadió a los providers de `TestBed` de 6 specs, de modo que los specs siguen ejecutándose contra el mismo backend que la app.

### c) `$safeNavigationMigration` en un template

```diff
// src/app/features/article/article.component.html (978e3f5)
-                  [src]="currentUser?.image === null ? '' : currentUser?.image"
+                  [src]="
+                    $safeNavigationMigration(currentUser?.image) === null
+                      ? ''
+                      : $safeNavigationMigration(currentUser?.image)
+                  "
```

- **Qué hace la migración:** envuelve las dos expresiones `?.` del avatar del formulario de comentarios para que conserven el resultado de `?.` en templates anterior a v22.
- **Por qué importa aquí:** la expresión compara el resultado con `null`, así que el valor que produce `?.` cuando `currentUser` es null decide qué rama se toma. El wrapper conserva ese valor tal como era antes de v22.
- **Nota honesta:** la expresión envuelta solo difiere de `?.` sin envolver cuando `currentUser` es null. El bloque está dentro de `*appShowAuthed="true"`, así que ese caso no se alcanza en uso normal, y no está cubierto por ningún spec. Adoptar la semántica de v22 y eliminar el wrapper queda como seguimiento.

### d) Diagnósticos extendidos suprimidos

```diff
// tsconfig.app.json (978e3f5); mismo cambio en tsconfig.spec.json
-  "include": ["src/**/*.d.ts"]
+  "include": ["src/**/*.d.ts"],
+  "angularCompilerOptions": {
+    "extendedDiagnostics": {
+      "checks": {
+        "nullishCoalescingNotNullable": "suppress",
+        "optionalChainNotNullable": "suppress"
+      }
+    }
+  }
```

`strict-safe-navigation-narrow` suprime dos diagnósticos extendidos sobre `??` y `?.` aplicados a valores que el compilador considera no anulables. El build no reporta advertencias del compilador.

> **Lección:** en este major las migraciones tocaron más de 25 archivos sin cambiar el comportamiento. Un diff grande no es necesariamente un diff arriesgado, pero cada tipo de cambio debe revisarse: aquí hubo cuatro tipos, y cada uno se contrastó con el comportamiento que conserva.

---

## 4. TypeScript 6.0 y `baseUrl`

Tras `ng update`, el build falló:

```text
TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0
```

Ninguna migración lo resolvió. La corrección fue un cambio manual de una línea en `978e3f5`:

```diff
// tsconfig.json (978e3f5)
-    "baseUrl": "./",
```

- **Por qué eliminarlo es seguro aquí:** ningún import depende de `baseUrl`. Todos los imports son rutas relativas o nombres de paquete, y no hay mapeo `paths`.
- **Por qué no `ignoreDeprecations: "6.0"`:** esa opción solo silencia el error, y la configuración dejaría de funcionar en TypeScript 7.0 de todos modos. Eliminar una opción que no se usa corrige la causa en lugar de aplazarla.
- **Upstream:** el `tsconfig.json` de upstream tampoco tiene `baseUrl`.

> **Lección:** un error de deprecación es un aviso con fecha sobre el próximo major. Cuando la opción deprecada no se usa, eliminarla cuesta menos que silenciarla y arrastrar el problema al siguiente upgrade.

---

## 5. Cómo se comprobó la red de seguridad

| Comprobación                                      | Resultado                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Cambios en specs                                  | Solo configuración de providers (`withXhr()`, `Eager` en un host de test) |
| Aserciones modificadas                            | Ninguna                                                                   |
| Suite completa                                    | 120/120 ✅                                                                |
| Cobertura (statements / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%, igual que en v21                          |
| Advertencias del compilador                       | Ninguna                                                                   |

> **Lección:** se tocaron specs, pero solo en cómo se configura el módulo de test, reflejando el cambio de producción. Las aserciones son las mismas que pasaban en v21, así que el verde sigue indicando que el upgrade es invisible para el comportamiento que fijan.

---

## 6. Métricas: v21 vs v22

**Método:** el mismo de etapas anteriores (build de producción, 3 corridas). La línea base de v21 es la medición final de la etapa 10 (Angular 21.2 + `@angular/build`).

| Métrica                                      | v21 (etapa 10)                 | v22                            | Cambio                |
| -------------------------------------------- | ------------------------------ | ------------------------------ | --------------------- |
| Tests                                        | 120/120                        | 120/120                        | Sin cambios           |
| Cobertura (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Sin cambios           |
| Build de producción (3 corridas)             | 2.5 / 2.3 / 2.4 s              | 1.7 / 1.7 / 1.7 s              | No se saca conclusión |
| Bundle inicial (raw)                         | 346.08 kB                      | 357.60 kB                      | +11.52 kB             |
| Bundle inicial (transfer)                    | 97.59 kB                       | 99.56 kB                       | +1.97 kB              |
| `main`                                       | 8.51 kB                        | 10.92 kB                       | +2.41 kB              |
| Chunk compartido del framework               | 299.67 kB                      | 311.42 kB                      | +11.75 kB             |
| `polyfills`                                  | Mismo hash                     | Mismo hash                     | Sin cambios           |
| Chunks JS iniciales                          | 7                              | 3                              | Cambió la estructura  |
| Paquetes instalados                          | 710                            | 595                            | −115                  |
| Hallazgos de `npm audit`                     | 35                             | 20 (ninguno crítico)           | −15                   |

La estructura de salida también cambió: los hashes de los chunks ahora mezclan mayúsculas y minúsculas (por ejemplo `chunk-DhfQOmZR.js`).

> **Honestidad sobre las cifras:** los tiempos de build varían entre corridas y no se usan como evidencia (el primer build tras `ng update` tardó 2.8 s). El crecimiento del bundle es real pero pequeño, y no se investigó su causa. La reducción de paquetes instalados y de hallazgos de auditoría llega con las nuevas versiones; se reporta, no se atribuye a ningún cambio concreto.

---

## 7. Upstream: sin hoja de respuestas para esta etapa

No hay un commit de Angular 22 en upstream con el que comparar. El `main` de upstream sigue en Angular 21.2.12 con TypeScript ~5.9.3.

|            | `main` de upstream         | Esta migración          |
| ---------- | -------------------------- | ----------------------- |
| Angular    | 21.2.12                    | 22.2.4                  |
| TypeScript | ~5.9.3                     | 6.0.3                   |
| `baseUrl`  | No está en `tsconfig.json` | Eliminado en esta etapa |

> **Lección:** este proyecto va ahora por delante de su hoja de respuestas. A partir de aquí, cada etapa tiene que justificarse con su propio diagnóstico, sus migraciones y su red de seguridad, sin un commit de referencia con el que comparar.

---

## 8. Seguimiento

| Tema                                                        | Detalle                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Adoptar la semántica de `?.` en templates de v22            | Eliminar el wrapper `$safeNavigationMigration` en `article.component.html` |
| Revisar los componentes con `ChangeDetectionStrategy.Eager` | Al pasar a `OnPush` / zoneless                                             |
| `APP_INITIALIZER` → `provideAppInitializer()`, Node 24      | Siguiente etapa planificada                                                |
| Karma → Vitest                                              | `migrate-karma-to-vitest` está disponible como migración opcional          |
| Detección de cambios zoneless                               | Después de Vitest                                                          |
