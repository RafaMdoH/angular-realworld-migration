# 07 — Upgrade Angular 19.2 → 20.3

> Registro de decisiones: diagnóstico, migraciones automáticas (con el concepto detrás de los dos cambios de configuración), cómo se comprobó la red de seguridad, hallazgos, métricas y comparación con la migración de los mantenedores.

**Rama:** `feature/upgrade-angular-20` · **Commits:** `abd10b3` (Angular 20), `c5389c3` (rx-angular 20)

---

## 1. Diagnóstico antes de actualizar

| Pregunta                               | Cómo se respondió                                         | Resultado                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Sigue sirviendo mi Node?              | `engines` de Angular 20.3                                 | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` → Node 22.23.4 ✅ (etapa 06)                                                                                              |
| ¿Qué TypeScript exige?                 | `peerDependencies` del compilador                         | `>=5.8 <6.0` → el 5.8.3 actual ✅, no hay que subirlo                                                                                                            |
| ¿Qué zone.js?                          | `peerDependencies` de `@angular/core@20`                  | `~0.15.0` → el 0.15.1 actual ✅                                                                                                                                  |
| ¿Terceros acoplados al major?          | `npm view @rx-angular/{template,cdk}@20 peerDependencies` | `cdk@20.1.1` y `template@20.1.0` → `@angular/core ^20`; `template@20.1.0` exige además `cdk ^20.1.0`. `ng update` sugiere 22.0.0, que exige `@angular/core >=22` |
| ¿Se usan APIs eliminadas en v20?       | Búsqueda de `TestBed.get`, `InjectFlags`, `ng-reflect-*`  | Ninguna                                                                                                                                                          |
| ¿Qué está deprecado y se sigue usando? | Inventario de templates + `app.module.ts`                 | `*ngIf` / `*ngFor` en 10 templates (todavía sin `@if` / `@for`); `APP_INITIALIZER` sigue en `app.module.ts`                                                      |
| ¿Cómo está la configuración?           | `tsconfig.json`                                           | `moduleResolution: "node"`: revisar qué hace con él la migración de v20                                                                                          |

> **Lección:** Node, TypeScript y zone.js ya coincidían antes de ejecutar `ng update`. Mover el runtime en su propia etapa (06) dejó para esta solo el framework y sus peers.

---

## 2. Qué hizo `ng update @angular/core@20 @angular/cli@20`

```bash
npx ng update @angular/core@20 @angular/cli@20
```

Ya no hace falta `NG_DISABLE_VERSION_CHECK` (retirado en la etapa 06).

| Cambio                         | Antes   | Después     |
| ------------------------------ | ------- | ----------- |
| `@angular/*`                   | 19.2.25 | 20.3.35     |
| `@angular/cli` / build-angular | 19.2.27 | 20.3.42     |
| `typescript`                   | 5.8.3   | Sin cambios |
| `zone.js`                      | 0.15.1  | Sin cambios |
| `@rx-angular/cdk`              | 19.1.0  | 20.1.1      |
| `@rx-angular/template`         | 19.2.2  | 20.1.0      |

rx-angular se instaló por separado (`c5389c3`), con rangos caret como antes. Sin `EBADENGINE` y sin `ERESOLVE`.

### Migraciones automáticas

| Migración                                           | Resultado                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Valores por defecto de generación del workspace** | `angular.json` recibe un bloque `schematics` que conserva el nombrado de archivos anterior a v20 (`type: component\|directive\|service`, `typeSeparator: "."`) |
| **`moduleResolution`**                              | `tsconfig.json`: `node` → `bundler`                                                                                                                            |
| Imports/rutas de `provideServerRendering`           | Sin cambios                                                                                                                                                    |
| Eliminación de la config de karma por defecto       | Sin cambios                                                                                                                                                    |
| Cambio de origen del import de `DOCUMENT`           | Sin cambios                                                                                                                                                    |
| `InjectFlags`, `TestBed.get`, `BootstrapContext`    | Sin cambios                                                                                                                                                    |

### Migraciones opcionales no ejecutadas

| Migración                   | Motivo                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `control-flow-migration`    | `*ngIf` / `*ngFor` → `@if` / `@for` es modernización, no requisito del upgrade (las directivas solo están deprecadas) |
| `router-current-navigation` | No se usa `getCurrentNavigation`                                                                                      |
| `use-application-builder`   | Cambiaría el paquete del builder a `@angular/build`; se pospone a un cambio propio (ver seguimiento)                  |

---

## 3. Las dos migraciones de configuración

### `moduleResolution: "bundler"`

**Qué controla:** cómo TypeScript encuentra el archivo detrás de un `import` de un paquete.

**Por qué cambia:** desde la etapa 03 la app se compila con el builder esbuild `application`, así que quien realmente resuelve los imports es un bundler. El modo `bundler` modela cómo los bundlers resuelven módulos, incluido el campo `exports` de `package.json`. Con `node`, el chequeo de tipos seguía un modelo de resolución distinto del que usa el build; con `bundler`, ambos leen los paquetes de la misma forma.

```diff
// tsconfig.json (abd10b3)
-    "moduleResolution": "node",
+    "moduleResolution": "bundler",
```

### Valores por defecto de generación que conservan el nombrado anterior

**Qué cambia en v20:** la guía de estilo actualizada elimina los sufijos de tipo en los nombres de los archivos nuevos que se generan.

**Qué hace la migración:** fija el estilo anterior en `angular.json`, para que los archivos que se generen a partir de ahora coincidan con los existentes. No renombra nada.

```diff
// angular.json (abd10b3) — extracto
+  "schematics": {
+    "@schematics/angular:component": {
+      "type": "component"
+    },
+    "@schematics/angular:guard": {
+      "typeSeparator": "."
+    },
```

El bloque completo cubre `component`, `directive` y `service` (`type`) y `guard`, `interceptor`, `module`, `pipe` y `resolver` (`typeSeparator`).

> **Lección:** ninguna de las dos migraciones toca código de la aplicación. Alinean la configuración con cómo se compila hoy el proyecto (bundler) y con cómo se escribió hasta ahora (nombrado de archivos), para que el upgrade no cambie convenciones por accidente.

---

## 4. Cómo se comprobó la red de seguridad

| Comprobación                                      | Resultado                                          |
| ------------------------------------------------- | -------------------------------------------------- |
| Archivos de `src/` tocados por el upgrade         | Ninguno (código de producción y specs sin cambios) |
| Suite completa                                    | 76/76 ✅                                           |
| Cobertura (statements / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36%, idéntica a v19     |

> **Lección:** sin cambios en `src/`, los specs son los mismos que pasaban en v19, aserciones incluidas. El verde indica que el cambio de framework es invisible para el comportamiento que fijan.

---

## 5. Hallazgos

### a) El diagnóstico de imports sin usar cambió de código: TS-998113 → NG8113

- **Observación:** la advertencia sobre imports standalone sin usar ahora se reporta como `NG8113` (en v19 era TS-998113).
- **Alcance:** los mismos dos imports de `AsyncPipe` que en la etapa 05.
- **Decisión:** sigue siendo una advertencia y sigue como seguimiento. Al buscar en logs o documentación, ambos códigos se refieren a la misma limpieza pendiente.

### b) Directivas estructurales deprecadas en 10 templates

- **Observación:** `*ngIf` y `*ngFor` están deprecadas en v20; 10 templates las usan y ninguno usa todavía `@if` / `@for`.
- **Estado:** siguen soportadas; nada falla.
- **Decisión:** convertirlas es modernización, no requisito del upgrade. Va en un cambio propio con la migración opcional `control-flow-migration`.

### c) El bundle inicial crece +8.22 kB raw / +2.32 kB transfer

- **Observación:** el total inicial pasa de 333.23 kB a 341.45 kB raw (94.20 → 96.52 kB transfer).
- **Dónde:** `main` (8.68 kB) y `polyfills` (34.59 kB, mismo hash) no cambian, así que el crecimiento está en el chunk compartido del framework (`chunk-*`, 294.87 kB raw en v20).
- **Límite de la evidencia:** no se registró el tamaño de ese chunk en v19, así que el crecimiento no se puede desglosar más.
- **Causa:** no se investigó. No se atribuye a ninguna feature concreta.

---

## 6. Métricas: v19 vs v20

**Método:** el mismo de las etapas anteriores (build de producción, 3 corridas). La línea base de v19 es la medición final de la etapa 06 sobre el mismo árbol (v19 + Node 22).

| Métrica                                      | v19                            | v20                            | Cambio                |
| -------------------------------------------- | ------------------------------ | ------------------------------ | --------------------- |
| Tests                                        | 76/76                          | 76/76                          | Sin cambios           |
| Cobertura (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 57.41% / 74% / 51.82% / 55.36% | Sin cambios           |
| Build de producción (3 corridas)             | 2.8 / 2.4 / 2.4 s              | 2.3 / 2.4 / 2.4 s              | Sin cambio apreciable |
| Bundle inicial (raw)                         | 333.23 kB                      | 341.45 kB                      | +8.22 kB              |
| Bundle inicial (transfer)                    | 94.20 kB                       | 96.52 kB                       | +2.32 kB              |
| `polyfills`                                  | 34.59 kB                       | 34.59 kB (mismo hash)          | Sin cambios           |
| `main`                                       | 8.68 kB                        | 8.68 kB                        | Sin cambios           |

> **Honestidad sobre las cifras:** las diferencias de tiempo de build están dentro del ruido entre corridas. El crecimiento del bundle es real pero pequeño, está por completo en el chunk compartido del framework y no se investigó su causa.

---

## 7. Comparación con la "hoja de respuestas" (upstream [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2))

|                     | Mantenedores (`a420aa2`)                                                                      | Esta migración                              |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Angular             | 20.0.0                                                                                        | 20.3.35                                     |
| `moduleResolution`  | `bundler`                                                                                     | `bundler` (igual)                           |
| Paquete del builder | Cambiado a `@angular/build` (builders `@angular/build:*`)                                     | Se mantiene `@angular-devkit/build-angular` |
| rx-angular          | 18.0.0 (peer `@angular/core ^18`: combinación no soportada en 20)                             | 20 (`cdk@20.1.1`, `template@20.1.0`)        |
| Templates e imports | Un `*ngIf` convertido a mano a `@if` en el header; `NgIf` y otros imports sin usar eliminados | Fuera de alcance; seguimientos aparte       |

> **Lección:** el resultado de configuración de Angular es el mismo. Las diferencias vuelven a ser de criterio: los peers deben coincidir, y el cambio de paquete del builder y la modernización de templates son conceptos distintos, así que cada uno va en su propio cambio.

---

## 8. Seguimiento

| Tema                                                                   | Detalle                                                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Paquete del builder `@angular-devkit/build-angular` → `@angular/build` | Migración opcional `use-application-builder`; upstream lo hizo en su commit de v20 |
| `*ngIf` / `*ngFor` → control flow integrado                            | Migración opcional `control-flow-migration`; 10 templates                          |
| `APP_INITIALIZER` → `provideAppInitializer()`                          | Pendiente desde la etapa 05. Usado en `app.module.ts`                              |
| Imports standalone sin usar                                            | Pendiente desde la etapa 05: `AsyncPipe` (ahora reportado como NG8113)             |
| Node 24                                                                | Ahora con soporte oficial en Angular 20                                            |
