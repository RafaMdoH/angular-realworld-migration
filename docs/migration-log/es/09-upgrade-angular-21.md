# 09 — Upgrade Angular 20.3 → 21.2

> Registro de decisiones: diagnóstico, qué cambió `ng update` (con el concepto detrás del provider de detección de cambios añadido en `main.ts`), cómo se comprobó la red de seguridad, hallazgos, métricas y comparación con la migración de los mantenedores.

**Rama:** `feature/upgrade-angular-21` · **Commits:** `0ca3bc5` (Angular 21), `9e50562` (rx-angular 21)

---

## 1. Diagnóstico antes de actualizar

| Pregunta                                | Cómo se respondió                                         | Resultado                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Sigue sirviendo mi Node?               | `engines` de Angular 21.2                                 | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` → Node 22.23.4 ✅                                                                                                              |
| ¿Qué TypeScript exige?                  | `peerDependencies` del compilador                         | `>=5.9 <6.1` → el 5.8.3 actual ❌, hay que subir a 5.9                                                                                                                |
| ¿Qué zone.js?                           | `peerDependencies` de `@angular/core@21`                  | `~0.15.0 \|\| ~0.16.0` → el 0.15.1 actual ✅                                                                                                                          |
| ¿Terceros acoplados al major?           | `npm view @rx-angular/{template,cdk}@21 peerDependencies` | `cdk@21.1.1` y `template@21.2.1` → `@angular/core ^21.0.0`; `template@21.2.1` exige además `@rx-angular/cdk` exactamente `21.1.1`                                     |
| ¿Qué migraciones ejecutará `ng update`? | `migrations.json` de `@angular/core@21` (etapa 08)        | `control-flow-migration` es obligatoria; se ejecutó por separado en la etapa 08, así que no debería quedar nada por convertir                                         |
| ¿Cómo arranca la app?                   | `src/main.ts` y polyfills                                 | `platformBrowserDynamic().bootstrapModule(AppModule)` con `zone.js` cargado como polyfill: revisar qué hace `bootstrap-options-migration` con la detección de cambios |

> **Lección:** la etapa 08 rindió aquí. La única migración obligatoria que habría reescrito templates ya estaba hecha, con su propia red de seguridad, así que esta etapa solo tuvo que ocuparse de la versión del framework y de TypeScript.

---

## 2. Qué hizo `ng update @angular/core@21 @angular/cli@21`

```bash
npx ng update @angular/core@21 @angular/cli@21
```

| Cambio                 | Antes   | Después                     |
| ---------------------- | ------- | --------------------------- |
| `@angular/*`           | 20.3.35 | 21.2.26                     |
| `@angular/cli`         | 20.3.42 | 21.2.29                     |
| `typescript`           | 5.8.3   | 5.9.3 (lo fija `ng update`) |
| `zone.js`              | 0.15.1  | Sin cambios                 |
| `@rx-angular/cdk`      | 20.1.1  | 21.1.1                      |
| `@rx-angular/template` | 20.1.0  | 21.2.1                      |

rx-angular se instaló por separado (`9e50562`), con rangos caret como antes. Sin `EBADENGINE` y sin `ERESOLVE`.

### Migraciones automáticas con cambios

| Migración                         | Resultado                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| **`bootstrap-options-migration`** | `src/main.ts` ahora pasa `applicationProviders: [provideZoneChangeDetection()]` a `bootstrapModule` |
| **`update-typescript-lib`**       | `tsconfig.json`: se elimina `"lib": ["ES2022", "dom"]`                                              |

### Migraciones automáticas sin cambios

| Migración                              | Resultado                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| `control-flow-migration`               | Ya hecha en la etapa 08: no quedan directivas estructurales |
| `remove-default-karma-config`          | Sin cambios                                                 |
| `update-module-resolution`             | Sin cambios                                                 |
| `add-bootstrap-context-to-server-main` | Sin cambios                                                 |
| `application-config-core`              | Sin cambios                                                 |
| `router-last-successful-navigation`    | Sin cambios                                                 |

### Migraciones opcionales no ejecutadas

| Migración                   | Motivo                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `use-application-builder`   | Cambiaría el paquete del builder a `@angular/build`; sigue pospuesta a un cambio propio |
| `router-current-navigation` | Opcional; no se ejecutó en esta etapa                                                   |

---

## 3. Zoneless por defecto, y por qué la migración añadió `provideZoneChangeDetection()`

**Qué cambia en v21:** la detección de cambios sin zone.js (zoneless) pasa a ser el valor por defecto. Una aplicación que depende de zone.js para disparar la detección de cambios ya no la obtiene de forma implícita; tiene que activarla explícitamente.

**De qué depende esta app:** arranca un `NgModule` con `bootstrapModule(AppModule)` y carga `zone.js` como polyfill. Su detección de cambios siempre ha estado impulsada por zone.js.

**Qué hace la migración:** añade a la llamada de arranque el provider de detección de cambios basada en zone.js, para que la app siga funcionando sobre zone.js exactamente como antes. El comportamiento no cambia.

```diff
// src/main.ts (0ca3bc5)
+import { provideZoneChangeDetection } from "@angular/core";
 import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

 import { AppModule } from "./app/app.module";

 platformBrowserDynamic()
-  .bootstrapModule(AppModule)
+  .bootstrapModule(AppModule, {
+    applicationProviders: [provideZoneChangeDetection()],
+  })
   .catch((err) => console.error(err));
```

**Qué no hace:** no convierte la app en zoneless. Quitar zone.js es una modernización con sus propios riesgos y su propia verificación, así que va en un cambio aparte (ver seguimiento).

### `lib` eliminado de `tsconfig.json`

```diff
// tsconfig.json (0ca3bc5)
-    "useDefineForClassFields": false,
-    "lib": ["ES2022", "dom"]
+    "useDefineForClassFields": false
```

Con `target: ES2022`, el `lib` por defecto es el mismo que el valor explícito eliminado, así que el chequeo de tipos ve el mismo conjunto de APIs.

> **Lección:** cuando un framework cambia un valor por defecto, la migración oficial conserva explícitamente el comportamiento anterior en lugar de cambiar la app en silencio. El nuevo valor por defecto se hace visible en el diff como una línea, y adoptarlo queda como una decisión deliberada y separada.

---

## 4. Cómo se comprobó la red de seguridad

| Comprobación                                      | Resultado                                      |
| ------------------------------------------------- | ---------------------------------------------- |
| Archivos de specs tocados por el upgrade          | Ninguno                                        |
| Suite completa                                    | 120/120 ✅                                     |
| Cobertura (statements / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%, idéntica a v20 |
| Advertencias del compilador                       | Ninguna                                        |

Es el primer upgrade de major que se ejecuta con los specs de templates añadidos en la etapa 08, así que cada template está renderizado por al menos un spec mientras el framework cambia por debajo.

> **Lección:** los únicos cambios en código de producción son las dos migraciones oficiales, y los specs son los mismos que pasaban en v20, aserciones incluidas. El verde indica que el cambio de versión, incluida la activación explícita de zone.js, es invisible para el comportamiento que fijan.

---

## 5. Hallazgos

### a) La migración obligatoria de control flow no tuvo nada que hacer

- **Observación:** `control-flow-migration` se ejecuta como obligatoria en v21 y no reportó cambios.
- **Por qué:** las 27 directivas estructurales de los 10 templates se convirtieron en la etapa 08, con specs de caracterización escritos antes.
- **Efecto:** el diff de v21 se limita a la versión del framework y a TypeScript; en esta etapa no se reescribió ningún template.

> **Lección:** leer la lista de migraciones de la versión destino antes de actualizar convirtió un cambio forzado y mezclado en uno anterior y aislado. Cuando llegó el upgrade, la migración forzada no tuvo efecto.

### b) rx-angular template fija cdk a una versión exacta

- **Observación:** `@rx-angular/template@21.2.1` exige `@rx-angular/cdk` exactamente `21.1.1`, mientras que `package.json` declara `^21.1.1`.
- **Riesgo:** si se publica un cdk 21.1.x posterior a 21.1.1, un `npm install` futuro podría resolverlo y entrar en conflicto con el peer exacto de template.
- **Protección actual:** el lockfile fija 21.1.1, así que `npm ci` (el que usa CI) no se ve afectado.
- **Decisión:** seguimiento: fijar cdk exactamente en `21.1.1`, o esperar una versión de template con un peer compatible.

### c) El bundle inicial crece +8.50 kB raw / +1.57 kB transfer

- **Observación:** el total inicial pasa de 337.58 kB a 346.08 kB raw (96.02 → 97.59 kB transfer).
- **Dónde:** casi por completo en el chunk compartido del framework (291.21 → 299.67 kB); `main` cambia 0.04 kB y `polyfills` no cambia.
- **Causa:** no se investigó. No se atribuye a ninguna feature concreta.

---

## 6. Métricas: v20 vs v21

**Método:** el mismo de las etapas anteriores (build de producción, 3 corridas). La línea base de v20 es la medición final de la etapa 08 (Angular 20.3 + control flow integrado).

| Métrica                                      | v20                            | v21                            | Cambio         |
| -------------------------------------------- | ------------------------------ | ------------------------------ | -------------- |
| Tests                                        | 120/120                        | 120/120                        | Sin cambios    |
| Cobertura (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Sin cambios    |
| Build de producción (3 corridas)             | 2.4 / 1.7 / 1.7 s              | 2.3 / 2.3 / 2.3 s              | Sin conclusión |
| Bundle inicial (raw)                         | 337.58 kB                      | 346.08 kB                      | +8.50 kB       |
| Bundle inicial (transfer)                    | 96.02 kB                       | 97.59 kB                       | +1.57 kB       |
| `main`                                       | 8.47 kB                        | 8.51 kB                        | +0.04 kB       |
| Chunk compartido del framework               | 291.21 kB                      | 299.67 kB                      | +8.46 kB       |
| `polyfills`                                  | 34.59 kB                       | 34.59 kB                       | Sin cambios    |

> **Honestidad sobre las cifras:** los tiempos de build varían entre corridas y no se usan como evidencia (el primer build tras `ng update` tardó 2.6 s). El crecimiento del bundle es real pero pequeño, está en el chunk compartido del framework y no se investigó su causa.

---

## 7. Comparación con la "hoja de respuestas" (upstream [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3))

El commit de v21 de upstream ("chore: upgrade to Angular 21 and latest dependencies") solo cambió `package.json` y el lockfile. Las diferencias de arquitectura de la tabla ya estaban en la app de upstream antes de ese commit.

|                      | Mantenedores (`33bf8c3`)                                          | Esta migración                                                  |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Angular              | 21.1.1                                                            | 21.2.26                                                         |
| TypeScript           | ~5.9.3                                                            | 5.9.3 (igual)                                                   |
| rx-angular           | 21.0.0 (esta vez los peers coinciden)                             | `cdk@21.1.1`, `template@21.2.1`                                 |
| zone.js              | ~0.16.0                                                           | 0.15.1                                                          |
| Paquete del builder  | `@angular/build` 21.1.1                                           | `@angular-devkit/build-angular`                                 |
| Ejecutor de tests    | Vitest (`"test": "vitest"`)                                       | Karma + Jasmine                                                 |
| Arranque             | `bootstrapApplication` + `app.config.ts`, `provideAppInitializer` | `bootstrapModule(AppModule)`, `APP_INITIALIZER`                 |
| Detección de cambios | Sin `provideZoneChangeDetection` en `app.config.ts`               | `provideZoneChangeDetection()` añadido por la migración oficial |

> **Lección:** en versiones de dependencias los dos proyectos ahora coinciden bastante, incluidos peers de rx-angular compatibles. En arquitectura han divergido: upstream adoptó el arranque standalone, un builder nuevo y Vitest por el camino, mientras que esta migración los mantiene como cambios de modernización separados y documentados. Comparar solo los commits de v21 ocultaría esa diferencia.

---

## 8. Seguimiento

| Tema                                                                   | Detalle                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Detección de cambios zoneless                                          | Valor por defecto en v21; esta app activa zone.js con `provideZoneChangeDetection()` |
| Karma → Vitest                                                         | Upstream ya usa Vitest                                                               |
| Paquete del builder `@angular-devkit/build-angular` → `@angular/build` | Pendiente desde la etapa 07 (`use-application-builder`)                              |
| `APP_INITIALIZER` → `provideAppInitializer()`                          | Pendiente desde la etapa 05                                                          |
| Fijar `@rx-angular/cdk` exactamente en `21.1.1`                        | O esperar una versión de template con un peer compatible (hallazgo b)                |
| Node 24                                                                | Pendiente desde la etapa 07                                                          |
