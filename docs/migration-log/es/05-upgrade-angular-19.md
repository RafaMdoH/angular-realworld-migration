# 05 — Upgrade Angular 18.2 → 19.2

> Registro de decisiones: diagnóstico, migraciones automáticas (con el concepto detrás del cambio de `standalone`), cómo se comprobó la red de seguridad, hallazgos, métricas y comparación con la migración de los mantenedores.

**Rama:** `feature/upgrade-angular-19` · **Commits:** `50343a8` (Angular 19), `05ba2dc` (rx-angular 19)

---

## 1. Diagnóstico antes de actualizar

| Pregunta                           | Cómo se respondió                                          | Resultado                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Sigue sirviendo mi Node?          | `engines` de Angular 19.2                                  | `^18.19.1 \|\| ^20.11.1 \|\| >=22` → Node 18.20.8 ✅. Es el **último major que acepta Node 18**                                          |
| ¿Qué TypeScript exige?             | `peerDependencies` del compilador                          | `>=5.5 <5.9` → el 5.4 actual **no sirve**, hay que subirlo                                                                               |
| ¿Qué zone.js?                      | `peerDependencies` de `@angular/core@19`                   | `~0.15.0` → hay que subir desde 0.14                                                                                                     |
| ¿Terceros acoplados al major?      | `npm view @rx-angular/{template,cdk}@19 peerDependencies`  | `cdk@19.1.0` y `template@19.2.2` → `@angular/core ^19`; `template@19.2.2` exige además `cdk ^19.1.0`                                     |
| ¿El CLI corre en Node 18?          | Gotcha conocido de la etapa 03                             | Cada `ng update` necesita `NG_DISABLE_VERSION_CHECK=true`                                                                                |
| ¿Qué riesgo nuevo trae este major? | Changelog de v19 + inventario de `standalone` en el código | `standalone` pasa a ser `true` por defecto. 20 archivos declaran `standalone: true`; `AppComponent` es el único declarado en un NgModule |

> **Lección:** el inventario de `standalone` decide el tamaño real del cambio. Con un solo componente declarado en un NgModule, el riesgo se concentra en un archivo; el resto es eliminación de un flag redundante.

---

## 2. Qué hizo `ng update @angular/core@19 @angular/cli@19`

```bash
NG_DISABLE_VERSION_CHECK=true npx ng update @angular/core@19 @angular/cli@19
```

| Cambio                         | Antes    | Después |
| ------------------------------ | -------- | ------- |
| `@angular/*`                   | 18.2.14  | 19.2.25 |
| `@angular/cli` / build-angular | 18.2.21  | 19.2.27 |
| `typescript`                   | ~5.4.5   | ~5.8.3  |
| `zone.js`                      | ~0.14.10 | ~0.15.1 |

### Migraciones automáticas

| Migración                              | Resultado                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| **`explicit-standalone-flag`**         | **19 archivos**: 18 × `standalone: true` eliminado, `AppComponent` → `standalone: false` |
| `pending-tasks`                        | Sin cambios (no se usa `ExperimentalPendingTasks`)                                       |
| `update-workspace-config`              | Sin cambios en `angular.json`                                                            |
| `update-ssr-imports`                   | Sin cambios (sin SSR)                                                                    |
| `add-bootstrap-context-to-server-main` | Sin cambios (sin `main.server.ts`)                                                       |

### Migraciones opcionales no ejecutadas

| Migración                 | Motivo                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `provide-initializer`     | `APP_INITIALIZER` → `provideAppInitializer()` es modernización, no requisito del upgrade (`APP_INITIALIZER` solo está deprecado) |
| `use-application-builder` | Ya hecho por separado en la etapa 03                                                                                             |

---

## 3. Cambio de `standalone`: `true` pasa a ser el valor por defecto

**Por qué:** desde v17 la documentación presenta los componentes standalone como el modelo por defecto, y en este repo 20 archivos ya declaraban `standalone: true`. En v19 el compilador asume `true` si el flag no está, así que declararlo pasa a ser **redundante**.

**La consecuencia que rompe el build:** un componente, directiva o pipe declarado en el `declarations` de un NgModule ahora tiene que **excluirse explícitamente** con `standalone: false`. Sin ese flag, el compilador lo trata como standalone y rechaza la declaración en el NgModule. La migración `explicit-standalone-flag` hace ambas cosas: agrega `standalone: false` donde hace falta y elimina `standalone: true` donde sobra.

```diff
// src/app/app.component.ts (50343a8)
 @Component({
   selector: "app-root",
   templateUrl: "./app.component.html",
+  standalone: false,
 })
```

```diff
// src/app/features/home/home.component.ts (50343a8) — mismo patrón en 16 archivos más
-  standalone: true,
```

La migración también reformateó algunos decoradores; ese ruido se normalizó con Prettier. **Diff final en `src/`: 1 inserción, 18 eliminaciones** (17 en código de producción y 1 en un spec).

---

## 4. Cómo se comprobó la red de seguridad

| Comprobación                                      | Resultado                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Specs tocados por la migración                    | Uno: el host component de `show-authed.directive.spec.ts`                      |
| Qué cambió en ese spec                            | Solo se eliminó `standalone: true`; `imports`, template y aserciones idénticos |
| Suite completa                                    | 76/76 ✅                                                                       |
| Cobertura (statements / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36%, idéntica a v18                                 |

> **Lección:** aquí la migración tocó un spec, pero solo en la configuración del componente de prueba, no en lo que se verifica. La revisión es la misma que en la etapa 04: confirmar que ninguna aserción cambió antes de confiar en el verde.

---

## 5. Hallazgos

### a) `standalone: true` que la migración no eliminó

- **Observación:** `ShowAuthedDirective` y `MarkdownPipe` conservan `standalone: true` después de la migración.
- **Contraste:** upstream `a6f16d0` muestra el mismo resultado en esos dos archivos.
- **Causa:** no se investigó.
- **Decisión:** se deja como está. El flag es redundante pero inofensivo, y quitarlo a mano sería un cambio fuera de la migración oficial.

### b) Nuevo diagnóstico TS-998113: imports standalone sin usar

- **Observación:** el compilador de v19 advierte que `AsyncPipe` está en `imports` de `HomeComponent` y `ProfileComponent` sin usarse en sus templates.
- **Decisión:** son advertencias, no errores. La limpieza queda como seguimiento para mantener un concepto por cambio.

### c) Peers compatibles ≠ todos los `engines` transitivos compatibles

- **Síntoma:** al instalar rx-angular 19 (`05ba2dc`), npm muestra `EBADENGINE`: `ng-morph@4.9.1` depende de `minimatch@10`, que declara Node `20 || >=22`.
- **Alcance:** solo tooling (schematics de rx-angular); no entra al bundle. Build y tests pasan en Node 18.
- **Lección:** que los `peerDependencies` coincidan no garantiza que cada dependencia transitiva acepte el Node instalado. Es una razón más para que la próxima etapa pase a Node 20.

---

## 6. Métricas: v18 vs v19

**Método:** el mismo de las etapas anteriores (Node 18, build de producción, 3 corridas). La línea base de v18 se volvió a medir al inicio de esta etapa.

| Métrica                                      | v18                            | v19                            | Cambio                |
| -------------------------------------------- | ------------------------------ | ------------------------------ | --------------------- |
| Tests                                        | 76/76                          | 76/76                          | Sin cambios           |
| Cobertura (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 57.41% / 74% / 51.82% / 55.36% | Sin cambios           |
| Build de producción (3 corridas)             | 3.6 / 2.4 / 2.4 s              | 2.9 / 2.5 / 2.4 s              | Sin cambio apreciable |
| Bundle inicial (raw)                         | 335.06 kB                      | 333.23 kB                      | −1.83 kB              |
| Bundle inicial (transfer)                    | 93.72 kB                       | 94.20 kB                       | +0.48 kB              |
| `polyfills`                                  | 34.52 kB                       | 34.59 kB                       | +0.07 kB              |
| `main`                                       | 8.75 kB                        | 8.68 kB                        | −0.07 kB              |

> **Honestidad sobre las cifras:** la primera corrida es más lenta en ambas versiones (caché fría) y las demás coinciden. Las diferencias de tamaño son de décimas de kB; no se investigó su causa y no se atribuyen a ninguna feature concreta.

---

## 7. Comparación con la "hoja de respuestas" (upstream [`a6f16d0`](https://github.com/gothinkster/angular-realworld-example-app/commit/a6f16d0))

|                        | Mantenedores (`a6f16d0`)                                    | Esta migración                       |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------ |
| Angular                | 19.2.14                                                     | 19.2.25                              |
| TypeScript / zone.js   | ~5.8.3 / ~0.15.1                                            | ~5.8.3 / ~0.15.1                     |
| Resultado `standalone` | Igual (incluidos `ShowAuthedDirective` y `MarkdownPipe`)    | Igual                                |
| rx-angular             | 18.0.0 (peer `@angular/core ^18`: combinación no soportada) | 19 (`cdk@19.1.0`, `template@19.2.2`) |
| Imports sin usar       | Eliminados en el mismo commit                               | Fuera de alcance; seguimiento aparte |

> **Lección:** el estado de Angular es el mismo. Las diferencias son de criterio: aquí se exige que los peers coincidan (hallazgo de la etapa 04) y se mantiene un concepto por cambio, aunque la limpieza de imports sea pequeña.

---

## 7.1 Novedades de v19

Referencia oficial: [blog de Angular](https://blog.angular.dev/) y [documentación de Angular](https://angular.dev/).

---

## 8. Seguimiento

| Tema                                          | Detalle                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `APP_INITIALIZER` → `provideAppInitializer()` | Deprecado en v19; migración opcional `provide-initializer`. Usado en `app.module.ts` (`initAuth`) |
| Imports standalone sin usar                   | Eliminar `AsyncPipe` en `HomeComponent` y `ProfileComponent` (TS-998113)                          |
| Node 20                                       | Requerido por Angular 20 y ya por el tooling de rx-angular 19                                     |
