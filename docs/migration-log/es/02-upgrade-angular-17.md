# 02 — Upgrade Angular 16.2 → 17.3

> Registro de decisiones: decisiones, cambios, validación y comparación con la migración de los mantenedores.

**Rama:** `feature/upgrade-angular-17` · **Commits:** `3f66480` (Angular 17), `1e6ad58` (rx-angular 17)

---

## 1. Diagnóstico antes de actualizar

| Pregunta                           | Cómo se respondió                                                     | Resultado                                                                    |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ¿Sigue sirviendo mi Node?          | `npm view @angular/core@17 engines.node`                              | `^18.13.0 \|\| >=20.9.0` → Node 18.20.8 ✅                                   |
| ¿Qué TypeScript exige?             | `npm view @angular/compiler-cli@17 peerDependencies`                  | `>=5.2 <5.5` → hay que subir desde 5.1 (lo hace `ng update`)                 |
| ¿Qué zone.js?                      | peerDependencies de `@angular/core@17`                                | `~0.14.0`                                                                    |
| ¿Terceros acoplados al major?      | `ng update` + `npm view @rx-angular/template@17.3.1 peerDependencies` | rx-angular → `17.3.1` / cdk `17.1.0` (`ng update` sugería otra vez la 21 ❌) |
| ¿Lo que voy a tocar está cubierto? | Tests de caracterización existentes                                   | Sí: el Home (`*rxLet`) se cubrió en la etapa 01                              |
| ¿La app corre? (smoke test)        | Ya documentado en 00 §1.1                                             | CSS y API externos caídos: riesgo aceptado                                   |

> **Lección:** este diagnóstico ya se hizo en 5 minutos porque es el **mismo checklist** de la etapa 01. Esa repetibilidad es la que después se automatiza en la skill-agente.

---

## 2. Qué hizo `ng update @angular/core@17 @angular/cli@17`

| Cambio                         | Antes   | Después |
| ------------------------------ | ------- | ------- |
| `@angular/*`                   | 16.2.12 | 17.3.12 |
| `@angular/cli` / build-angular | 16.2.16 | 17.3.17 |
| `typescript`                   | 5.1     | **5.4** |
| `zone.js`                      | 0.13    | 0.14.10 |

### Primera migración automática que SÍ cambió código

```diff
- "browserTarget": "angular-conduit:build:production"
+ "buildTarget": "angular-conduit:build:production"
```

**Por qué:** `browserTarget` asumía que el build siempre es "para navegador". Con el nuevo builder `application`, que sirve tanto para navegador como para SSR, el nombre genérico `buildTarget` es el correcto. La opción vieja estaba deprecada.

**Las demás migraciones** (escape de `@` y `}` en templates por la nueva sintaxis de control flow, imports de `TransferState`, opciones del compilador JIT, two-way bindings inválidos) reportaron **"No changes made"**.

> **Dato para entender:** la migración que escapa `@` y `}` existe porque en v17 esos caracteres pasan a ser **sintaxis** del template (`@if`, `@for`). Un texto como `contacto@empresa.com` en un template se rompería si no se escapa (`&#64;`).

---

## 3. Lo que NO hizo `ng update` (a propósito)

- **No cambió el builder a esbuild.** El proyecto sigue en `build-angular:browser` (webpack). El builder `application` es el default solo para proyectos **nuevos**; en los existentes es una migración opcional (`ng update @angular/cli --name use-application-builder`).
- **No migró a control flow** (`@if/@for`). Es un schematic opcional (`ng generate @angular/core:control-flow`).

**Decisión:** ambos son **modernización** y van en features separadas, con un concepto por PR. Mezclarlos con el upgrade impediría saber qué rompió qué.

---

## 4. rx-angular 16 → 17

- Se eligió por `peerDependencies` (`@angular/core ^17`), igual que en la etapa 01.
- Esta vez **sin breaking changes**: build y 72/72 tests en verde a la primera.

> **Lección:** no todos los majors de terceros rompen. Lo importante es **comprobarlo** con build y tests, no suponerlo.

---

## 5. Validación

| #   | Validación                    | Resultado                                              |
| --- | ----------------------------- | ------------------------------------------------------ |
| 1   | `ng build` tras `ng update`   | ✅                                                     |
| 2   | 72 tests tras `ng update`     | 72/72 ✅                                               |
| 3   | `ng build` tras rx-angular 17 | ✅                                                     |
| 4   | 72 tests + cobertura          | 72/72 ✅, cobertura sin cambios (57.41%)               |
| 5   | `git diff` de producción      | Solo `angular.json` (migración oficial) y dependencias |

---

## 6. Comparación con la "hoja de respuestas" (upstream)

|            | Mantenedores (`6d97f15`, 19-feb-2024)                    | Esta migración                                                   |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| Angular    | 17.0.7 → 17.2.1 (lo hicieron en dos pasos dentro de v17) | 16.2 → 17.3 directo a la última minor                            |
| TypeScript | 5.2                                                      | 5.4                                                              |
| rx-angular | 17.0.0 (alineado en `e0a5940`, 18-dic-2023)              | 17.3.1 / cdk 17.1.0                                              |
| Builder    | **`browser-esbuild`** (ya habían cambiado a esbuild)     | webpack (`browser`): el cambio se hará como modernización aparte |

> **Lección:** `browser-esbuild` es el builder **de transición**: usa esbuild con la misma configuración del builder `browser`, sin adoptar el builder `application` completo (Vite, salida en `/browser`, SSR unificado). Es una opción intermedia válida cuando el builder `application` rompe algo.

---

## 7. Métricas

| Métrica         | v16        | v17        | Nota                                 |
| --------------- | ---------- | ---------- | ------------------------------------ |
| Tests           | 72         | 72         | Sin cambios                          |
| Sentencias      | 57.41%     | 57.41%     | Sin cambios                          |
| Build           | ~3.6–5.4 s | ~4.1–5.9 s | Sigue en webpack; varía con la caché |
| Bundle (`dist`) | 516 KB     | 532 KB     | +16 KB (runtime de Angular 17)       |

---

## 7.1 Novedades de v17

Referencia oficial: [blog de Angular](https://blog.angular.dev/) y [documentación de Angular](https://angular.dev/).
