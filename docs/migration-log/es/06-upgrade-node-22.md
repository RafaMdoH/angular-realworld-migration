# 06 — Actualización del runtime Node 18 → Node 22 (Angular 19.2)

> Registro de decisiones: por qué el runtime se actualiza antes que el framework, cómo se eligió la versión destino (incluido un intento descartado con Node 24), qué cambió, cómo se verificó y qué habilitó el cambio.

**Rama:** `feature/upgrade-node-22` · **Commit:** `0294218`

---

## 1. Diagnóstico

### Por qué actualizar ahora

| Motivo                             | Detalle                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Node 18 y Node 20 están en EOL     | Ambos majors están fuera de soporte (Node 20 desde abril de 2026)                                                                   |
| Angular 20 deja de aceptar Node 18 | `engines` de Angular 20: `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`                                                                     |
| El tooling ya exige más            | La etapa 05 dejó un aviso `EBADENGINE`: el tooling de rx-angular 19 (`ng-morph@4.9.1` → `minimatch@10`) declara Node `20 \|\| >=22` |
| Un concepto por cambio             | Cambiar el runtime por separado, antes de Angular 20, mantiene el upgrade del framework libre de ruido del runtime                  |

### Qué depende de la versión de Node

| Elemento                    | Estado antes de esta etapa                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.nvmrc`                    | `18`                                                                                                   |
| `engines` de `package.json` | Sigue el rango de upstream de Angular 15 (`^14.20.0 \|\| ^16.13.0 \|\| ^18.10.0`), que excluye Node 22 |
| CI                          | Lee `.nvmrc` mediante `setup-node` (`node-version-file: .nvmrc`): el workflow no requiere cambios      |
| `.npmrc` / `engine-strict`  | No existen                                                                                             |
| Documentación               | README y `PROJECT_CONTEXT.md` mencionan Node 18 y `NG_DISABLE_VERSION_CHECK`                           |

> **Lección:** `engines` no se había tocado desde la línea base de upstream (`e28c896`). Pasaron cinco majors de Angular con un rango que ya no describía el proyecto; nada lo hacía cumplir porque no hay `engine-strict`.

---

## 2. Elección de la versión destino

| Node | Angular 19 (CLI 19)             | Angular 20 (CLI 20) | Notas                                   |
| ---- | ------------------------------- | ------------------- | --------------------------------------- |
| 20   | Soportado                       | Soportado           | Fuera de soporte desde abril de 2026    |
| 22   | Soportado                       | Soportado           | Único major vigente soportado por ambos |
| 24   | `(Unsupported)` en `ng version` | Soportado           | Aceptado por `engines`, no por el CLI   |

### El intento con Node 24 (descartado)

Con Node 24.19 / npm 11.17, build y tests quedaron en verde y el bundle fue idéntico byte a byte. Pero `ng version` mostró:

```text
Node: 24.19.0 (Unsupported)
```

El motivo es una discrepancia dentro del propio Angular CLI 19:

| Fuente                                                                         | Qué acepta                |
| ------------------------------------------------------------------------------ | ------------------------- |
| `engines` del CLI 19                                                           | `>=22.0.0` (Node 24 pasa) |
| `SUPPORTED_NODE_MAJORS` en `@angular/cli/src/commands/version/cli.js` (CLI 19) | `[18, 20, 22]`            |
| `SUPPORTED_NODE_MAJORS` en el CLI 20                                           | `[20, 22, 24]`            |

**Decisión:** Node 22 ahora; Node 24 en una etapa posterior, sobre Angular 20+. Se aplica el mismo criterio de la etapa 05 ("los peers deben coincidir"): una combinación que funciona pero no tiene soporte oficial no se acepta, aunque todas las comprobaciones estén en verde.

> **Lección:** `engines` es el piso que verifica npm, no la matriz de soporte oficial. La lista de majors soportados del propio CLI es más estricta, y un build en verde no revela la diferencia.

---

## 3. Cambios

| Archivo                          | Antes                                  | Después     |
| -------------------------------- | -------------------------------------- | ----------- |
| `.nvmrc`                         | `18`                                   | `22`        |
| `engines.node` de `package.json` | `^14.20.0 \|\| ^16.13.0 \|\| ^18.10.0` | `^22.12.0`  |
| `package-lock.json`              | —                                      | Sin cambios |
| `src/`                           | —                                      | Sin cambios |

**Por qué `^22.12.0`:** es el Node 22 mínimo que acepta Angular 20, así que el rango sigue siendo válido durante la próxima etapa sin otra edición.

`npm ci` con Node 22.23.4 / npm 10.9.9 terminó limpio y no reescribió el lockfile.

---

## 4. Verificación y métricas

**Método:** el mismo de las etapas anteriores (build de producción, 3 corridas). La línea base de Node 18 es la medición final de la etapa 05 sobre el mismo árbol.

| Métrica                                      | Node 18                           | Node 22                                                        | Cambio                |
| -------------------------------------------- | --------------------------------- | -------------------------------------------------------------- | --------------------- |
| Tests                                        | 76/76                             | 76/76                                                          | Sin cambios           |
| Cobertura (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36%    | 57.41% / 74% / 51.82% / 55.36%                                 | Sin cambios           |
| Build de producción (3 corridas)             | 2.9 / 2.5 / 2.4 s                 | 2.8 / 2.4 / 2.4 s                                              | Sin cambio apreciable |
| Bundle inicial (raw)                         | 333.23 kB                         | 333.23 kB                                                      | Sin cambios           |
| Bundle inicial (transfer)                    | 94.20 kB                          | 94.20 kB                                                       | Sin cambios           |
| `ng update` sin `NG_DISABLE_VERSION_CHECK`   | Workaround obligatorio (etapa 03) | Funciona; `ng version` muestra `Node: 22.23.4` sin advertencia | Workaround retirado   |

La salida es idéntica byte a byte: `main` y `polyfills` conservan los mismos hashes en ambos runtimes.

> **Honestidad sobre las cifras:** las diferencias de tiempo de build son de una décima de segundo y están dentro del ruido entre corridas; no se atribuyen a Node 22. El resultado relevante es el bundle idéntico: el cambio de runtime es invisible para la aplicación.

---

## 5. Efectos secundarios

| Efecto                               | Detalle                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Desaparece `EBADENGINE`              | El aviso del tooling de rx-angular (`minimatch@10`) de la etapa 05 ya no aparece en `npm ci` |
| Se retira `NG_DISABLE_VERSION_CHECK` | El workaround necesario en cada `ng update` desde la etapa 03 ya no hace falta               |
| `ng update` ve los siguientes majors | Ahora corre sin el workaround y lista Angular 20.3.9 y rx-angular 22.0.0                     |

---

## 6. Seguimiento

| Tema                                          | Detalle                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Node 24                                       | Una vez en Angular 20+ (el CLI 20 lo soporta). El LTS de mantenimiento de Node 22 termina en abril de 2027 |
| `npm audit`                                   | 65 hallazgos (2 críticos) en el árbol de dependencias; preexistentes, no causados por esta etapa           |
| `APP_INITIALIZER` → `provideAppInitializer()` | Sigue abierto desde la etapa 05. Usado en `app.module.ts` (`initAuth`)                                     |
| Imports standalone sin usar                   | Sigue abierto desde la etapa 05: `AsyncPipe` en `HomeComponent` y `ProfileComponent` (TS-998113)           |
