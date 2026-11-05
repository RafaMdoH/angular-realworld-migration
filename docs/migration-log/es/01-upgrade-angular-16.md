# 01 — Upgrade Angular 15.2 → 16.2

> Registro de decisiones: decisiones, errores, validación y comparación con la migración real de los mantenedores.

**Rama:** `feature/upgrade-angular-16` · **Commits:** `dad1951`, `6a52335`, `1b12adb`, `0dc3c0f`

---

## 1. Diagnóstico antes de actualizar

| Pregunta                                     | Cómo se respondió                       | Resultado                                                                    |
| -------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| ¿Sigue sirviendo mi Node?                    | Matriz de compatibilidad de Angular 16  | Node ^16.14 \|\| ^18.10 → Node 18 sigue siendo válido                        |
| ¿Qué TypeScript exige?                       | Matriz de compatibilidad                | >=4.9.3 <5.2 → hay que subir de 4.8 (lo hace `ng update`)                    |
| ¿Qué paquetes dependen del major de Angular? | `ng update` (sin argumentos) + `npm ls` | `@rx-angular/cdk` y `@rx-angular/template` (versión 15 = Angular 15)         |
| ¿Están cubiertos por tests?                  | CodeGraph: ¿dónde se usa rx-angular?    | **Solo en `HomeComponent`, y no tenía tests** → hueco en la red de seguridad |

### Decisión: cubrir el hueco ANTES de actualizar

`*rxLet` (rx-angular) se usa solo en la lista de tags del Home, y el Home no estaba en los tests de caracterización de la etapa 00. Si se actualiza rx-angular sin un test que mire ese template, una rotura pasa desapercibida. Por eso **T2 se hizo antes que el upgrade**: 5 tests nuevos y una mutación de validación.

> **Lección:** la red de seguridad no se diseña una sola vez. Antes de cada paso, pregúntate: "¿lo que voy a tocar está cubierto?".

---

## 2. Error 1 — `ng update` falla antes de empezar

```
✖ Migration failed: ... "packageManager":"bun" ...
Data path "/packageManager" must be equal to one of the allowed values: "npm", "yarn", "cnpm", "pnpm".
```

|                         |                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Causa**               | `~/.angular-config.json` (configuración **global** de la CLI) tenía `packageManager: "bun"`, quedó así al crear otro proyecto con bun. La CLI de Angular 15 no soporta bun.         |
| **Cómo se diagnosticó** | El mensaje decía `"packageManager":"bun"`, pero el repo tiene `package-lock.json` (npm). Si el valor no sale del repo, sale de la config global.                                    |
| **Solución**            | `ng config cli.packageManager npm` → se guarda en el `angular.json` **del repo**. No se tocó la config global para no afectar a otros proyectos.                                    |
| **Lección**             | Los errores de migración no siempre vienen del código: también del **entorno de la máquina**. Fijar la configuración en el repo hace que el build sea reproducible para cualquiera. |

---

## 3. Error 2 — `ng update` sugiere versiones equivocadas

```
@rx-angular/cdk        15.0.0 -> 21.1.1     ng update @rx-angular/cdk
@rx-angular/template   15.1.0 -> 21.2.1     ng update @rx-angular/template
```

`ng update` sugiere la **última** versión (21), no la que corresponde a Angular 16. Instalar la 21 sobre Angular 16 rompería todo.

**Cómo se eligió la versión correcta:** se buscó en npm la versión cuyos `peerDependencies` piden `@angular/core ^16`:

```bash
npm view @rx-angular/template@16 version          # → 16.1.2
npm view @rx-angular/template@16.1.2 peerDependencies
# { "@angular/core": "^16.0.0", "@rx-angular/cdk": "^16.0.0", ... }
```

> **Lección:** las librerías acopladas al major de Angular se actualizan **al mismo major**, no a la última. Los `peerDependencies` son la fuente de verdad.

---

## 4. Qué hizo `ng update @angular/core@16 @angular/cli@16`

| Cambio                         | Antes  | Después |
| ------------------------------ | ------ | ------- |
| `@angular/*`                   | 15.2.3 | 16.2.12 |
| `@angular/cli` / build-angular | 15.2   | 16.2.16 |
| `typescript`                   | 4.8    | **5.1** |
| `zone.js`                      | 0.12   | 0.13.3  |

Las migraciones automáticas (quitar `defaultProject`, interfaces de guards obsoletas, `moduleId`…) dijeron **"No changes made"**: el código ya era moderno (standalone, guards funcionales). En un legacy "real" estas migraciones sí cambian archivos, y hay que revisar el diff una por una.

> **Ojo:** `ng update` NO hace commit por defecto. Se hizo commit a mano después de verificar.

---

## 5. Observación — "funciona" ≠ "está soportado"

Con Angular 16 y **rx-angular 15** el build pasó y los 72 tests también. Aun así se actualizó rx-angular. ¿Por qué?

- rx-angular 15 declara soporte para Angular 15, no para 16. Que funcione hoy es **suerte**, no un contrato.
- Esa deuda explota en un major posterior, mezclada con otros errores, y es mucho más difícil de diagnosticar.

---

## 6. Error 3 — breaking change en rx-angular 16

```
error TS2305: Module '"@rx-angular/template/let"' has no exported member 'LetDirective'.
export 'LetDirective' was not found ... (possible exports: RxLet)
error NG1010: 'imports' must be an array of components, directives, pipes, or NgModules.
```

|                                    |                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Causa**                          | rx-angular 16 renombró el export público `LetDirective` → `RxLet`.                                                                                                        |
| **Cómo se diagnosticó**            | El propio error de webpack dice `possible exports: RxLet`. El `NG1010` es **consecuencia** del primero: al no existir el import, el array `imports` contiene `undefined`. |
| **Verificación antes de corregir** | En `node_modules/@rx-angular/template/fesm2022/template-let.mjs` se confirmó que el selector sigue siendo `[rxLet]` → el template **no** cambia, solo el import.          |
| **Solución**                       | 2 líneas en `home.component.ts`: `import { RxLet }` y `imports: [..., RxLet]`.                                                                                            |
| **Lección**                        | Cuando aparecen varios errores juntos, busca el **primero en la cadena**: los demás suelen ser efectos secundarios.                                                       |

---

## 7. Validación

| #   | Validación                                       | Resultado                                        |
| --- | ------------------------------------------------ | ------------------------------------------------ |
| 1   | Mutación sobre el nuevo test del Home            | Al corregir el bug, el test `KNOWN BUG` falla ✅ |
| 2   | `ng build` después de cada paso                  | ✅ (falló en T4 → se corrigió → ✅)              |
| 3   | 72 tests de caracterización                      | 72/72 ✅ en cada paso                            |
| 4   | Comparación con la migración de los mantenedores | Ver sección 9                                    |

---

## 8. Nuevo hallazgo congelado

| #   | Comportamiento                                                                                                                                                                                              | Estado               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 7   | `HomeComponent`: un usuario **autenticado** es redirigido a `/login` al entrar. `tap()` llama a `setListTo("feed")` **antes** de que `subscribe()` asigne `this.isAuthenticated`, que todavía vale `false`. | KNOWN BUG, congelado |

Es un bug clásico de **orden de ejecución en RxJS**: `tap` corre antes que el callback de `subscribe`.

---

## 9. Comparación con la "hoja de respuestas" (upstream)

|                | Mantenedores                                   | Esta migración                  |
| -------------- | ---------------------------------------------- | ------------------------------- |
| Upgrade a 16   | `0d28f5c` (30-oct-2023): solo `package.json`   | Igual en Angular/TS/zone.js     |
| rx-angular     | **No lo actualizaron** en ese commit           | Actualizado en el mismo upgrade |
| Rename `RxLet` | `bd914dc` (18-dic-2023), **7 semanas después** | Detectado y corregido en T4     |
| Tests          | Ninguno                                        | 72 tests de caracterización     |

> **Observación:** incluso los mantenedores dejaron una dependencia desalineada. Revisar los `peerDependencies` de terceros en cada major es justo el trabajo "humano" que la herramienta automática no hace.

---

## 10. Métricas

| Métrica         | v15 (base) | v16        | Nota                                            |
| --------------- | ---------- | ---------- | ----------------------------------------------- |
| Tests           | 67         | 72         | +5 del Home                                     |
| Sentencias      | 44.78%     | 57.41%     | Sube por los tests nuevos, no por el upgrade    |
| Ramas           | 56%        | 74%        | Ídem                                            |
| Build           | ~6.4 s     | ~3.6–5.4 s | Varía con la caché; no es una medición rigurosa |
| Bundle (`dist`) | 508 KB     | 516 KB     | +8 KB                                           |
