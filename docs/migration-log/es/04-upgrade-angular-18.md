# 04 — Upgrade Angular 17.3 → 18.2

> Registro de decisiones: diagnóstico, migraciones automáticas (con el concepto detrás del cambio de HTTP), cómo se protegió la red de seguridad, hallazgos, métricas y comparación con la migración de los mantenedores.

**Rama:** `feature/upgrade-angular-18` · **Commits:** `6eaa247` (Angular 18), `b3a85c0` (rx-angular 18)

---

## 1. Diagnóstico antes de actualizar

| Pregunta                           | Cómo se respondió                                        | Resultado                                                                                                          |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ¿Sigue sirviendo mi Node?          | `engines` de Angular 18.2.14                             | `^18.19.1 \|\| ^20.11.1 \|\| >=22` → Node 18.20.8 ✅                                                               |
| ¿Qué TypeScript exige?             | `peerDependencies` del compilador                        | `>=5.4 <5.6` → el 5.4 actual sirve, **no hace falta subirlo**                                                      |
| ¿Qué zone.js?                      | `peerDependencies` de `@angular/core@18`                 | `~0.14.10` → ya instalado desde la etapa 02 ✅                                                                     |
| ¿Terceros acoplados al major?      | `npm view @rx-angular/{template,cdk}@18 peerDeps`        | `template@18.0.3` y `cdk@18.0.0` → `@angular/core ^18`                                                             |
| ¿El CLI corre en Node 18?          | Gotcha conocido de la etapa 03                           | Cada `ng update` necesita `NG_DISABLE_VERSION_CHECK=true`                                                          |
| ¿Qué riesgo nuevo trae este major? | Changelog de v18 + búsqueda de `HttpClientTestingModule` | La migración de HTTP **reescribe specs**: home, user.service, 3 interceptors y routing. La red de seguridad cambia |

> **Lección:** el riesgo especial de este major no está en el código de producción sino en los **tests**. Si la migración toca los specs, lo que valida el upgrade también está cambiando, y hay que revisarlo con más cuidado que el resto.

---

## 2. Qué hizo `ng update @angular/core@18 @angular/cli@18`

```bash
NG_DISABLE_VERSION_CHECK=true npx ng update @angular/core@18 @angular/cli@18
```

| Cambio                         | Antes   | Después                                 |
| ------------------------------ | ------- | --------------------------------------- |
| `@angular/*`                   | 17.3.12 | 18.2.14                                 |
| `@angular/cli` / build-angular | 17.3.17 | 18.2.21                                 |
| `typescript`                   | 5.4     | 5.4 (sin cambio: entra en `>=5.4 <5.6`) |

### Migraciones automáticas

| Migración             | Resultado                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Two-way binding       | Sin cambios                                                                                                                  |
| Fase de `afterRender` | Sin cambios                                                                                                                  |
| `BootstrapContext`    | Sin cambios                                                                                                                  |
| **Providers de HTTP** | **10 archivos**: `app.module.ts`, 6 specs y 3 interceptors (estos últimos solo reformateados; Prettier revirtió ese formato) |

---

## 3. Cambio de HTTP: `HttpClientModule` → `provideHttpClient()`

`HttpClient` pasa de configurarse importando un NgModule a configurarse con **funciones provider**, la misma API para apps standalone y para apps con NgModules.

**Por qué se deprecó `HttpClientModule` (v18):** es una API de la era de los NgModules. Las funciones `provide*` con features `with*` son _tree-shakable_ (lo que no se usa no entra al bundle) y funcionan igual en `bootstrapApplication` y en el `providers` de un NgModule. Además, la documentación de v18 advierte que con `HttpClientModule` en varios inyectores el comportamiento de los interceptors queda "mal definido" y depende del orden de imports.

**Qué hace `withInterceptorsFromDi()`:** es el puente con los interceptors **de clase** registrados con el token `HTTP_INTERCEPTORS`, como los tres de este repo (`ApiInterceptor`, `TokenInterceptor`, `ErrorInterceptor`). `HttpClientModule` los leía automáticamente; `provideHttpClient()` **no**. Sin este feature, la app compila y arranca, pero los interceptors **dejan de ejecutarse en silencio**: sin URL base, sin token JWT y sin manejo de errores. Ese es el fallo real que evita, y por eso la documentación oficial declara `HttpClientModule` equivalente a `provideHttpClient(withInterceptorsFromDi())`.

```diff
// src/app/app.module.ts (6eaa247)
-import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
+import {
+  HTTP_INTERCEPTORS,
+  provideHttpClient,
+  withInterceptorsFromDi,
+} from "@angular/common/http";
 ...
-  imports: [
-    BrowserModule,
-    FooterComponent,
-    HeaderComponent,
-    AppRoutingModule,
-    HttpClientModule,
-  ],
+  imports: [BrowserModule, FooterComponent, HeaderComponent, AppRoutingModule],
   providers: [
     { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
     { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
     { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
+    provideHttpClient(withInterceptorsFromDi()),
   ],
```

El orden de los tres `HTTP_INTERCEPTORS` no cambió, así que el orden de ejecución tampoco.

**En los tests**, `HttpClientTestingModule` (también deprecado) pasa a dos providers:

```diff
// src/app/core/services/user.service.spec.ts (6eaa247)
 TestBed.configureTestingModule({
-  imports: [HttpClientTestingModule],
-  providers: [{ provide: Router, useValue: router }],
+  imports: [],
+  providers: [
+    { provide: Router, useValue: router },
+    provideHttpClient(withInterceptorsFromDi()),
+    provideHttpClientTesting(),
+  ],
 });
```

**Por qué `provideHttpClient()` va ANTES de `provideHttpClientTesting()`:** el segundo **sobrescribe** el backend del primero con el backend falso que controla `HttpTestingController`. En el inyector gana el último provider registrado para un mismo token; con el orden invertido, el backend real vuelve a ganar y `HttpTestingController` deja de interceptar las peticiones. La documentación oficial de v18 lo advierte de forma explícita: invertir el orden "puede romper los tests".

---

## 4. Cómo se comprobó que la red de seguridad no se debilitó

Una migración que reescribe specs podría, en teoría, cambiar qué se verifica. Se revisó el diff línea por línea:

| Comprobación                                           | Resultado                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Conteo `it` + `expect` por spec, antes y después       | Sin cambios: routing 34, api 7, error 6, token 6, user.service 46, home 15 |
| Líneas de aserción modificadas                         | Ninguna: el diff solo toca imports y `configureTestingModule`              |
| Orden `provideHttpClient` → `provideHttpClientTesting` | Correcto en los 6 specs                                                    |
| Suite completa                                         | 72/72 ✅, cobertura 57.41% (igual que antes)                               |

> **Lección:** cuando una migración toca los tests, se revisa **con más rigor** que el código de producción. Un test que pasa porque se debilitó no protege nada, y "72/72 en verde" no lo detecta.

---

## 5. Hallazgo real: tests en verde ≠ combinación soportada

- **Síntoma:** después de T2, `ng update` y npm dejaron instalados Angular 18 y rx-angular 17, cuyo `peerDependencies` exige `@angular/core ^17.0.0`, **sin ningún error**. Build y tests pasaban.
- **Causa:** `ng update` solo actualiza los paquetes que se le piden, y en esta instalación ninguna herramienta señaló el desajuste de peers (no se investigó más por qué npm no lo bloqueó).
- **Arreglo (T3, `b3a85c0`):** `@rx-angular/cdk@18.0.0` y `@rx-angular/template@18.0.3` (peers `@angular/core ^18`). 72/72, 57.41%.
- **Lección:** "funciona" y "está soportado" son cosas distintas. La compatibilidad se verifica en los `peerDependencies`, no solo con tests en verde.

`npm audit` reporta vulnerabilidades: es mantenimiento de dependencias **previo** a esta etapa y queda fuera de alcance.

---

## 6. Métricas: v17 (esbuild) vs v18

**Método:** el mismo de la etapa 03 (Node 18, caché fría, 3 corridas).

| Métrica                   | v17 esbuild (etapa 03) | v18                  | Cambio                |
| ------------------------- | ---------------------- | -------------------- | --------------------- |
| Build de producción       | ~3.2 s                 | 3.21 / 3.27 / 3.19 s | Sin cambio apreciable |
| Build de desarrollo       | ~2.44 s                | 2.70 / 2.72 / 2.67 s | ≈ +0.25 s             |
| Bundle inicial (raw)      | 318.19 kB              | 335.06 kB            | +16.9 kB              |
| Bundle inicial (transfer) | 89.36 kB               | 93.72 kB             | +4.36 kB              |
| `main`                    | 8.53 kB                | 8.75 kB              | +0.22 kB              |
| Tests / cobertura         | 72/72, 57.41%          | 72/72, 57.41%        | Sin cambios           |

Smoke de `ng serve`: `<app-root>` presente, `main.js` 200, 0 advertencias.

> **Honestidad sobre las cifras:** el bundle creció 16.9 kB y el build de desarrollo ~0.25 s. No se investigó la causa más allá de "cambió la versión del framework"; atribuirlo a una feature concreta sería especular. Lo relevante: un upgrade **no es gratis por defecto**, y se mide en vez de suponerlo.

---

## 7. Comparación con la "hoja de respuestas" (upstream `932dff0`)

|                   | Mantenedores (`932dff0`)                                        | Esta migración                               |
| ----------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Angular           | 18.0.0, TS 5.4.5                                                | 18.2.14, TS 5.4                              |
| Builder           | `use-application-builder` aplicado **dentro** del commit de v18 | Ya hecho por separado en la etapa 03         |
| Cambios en `src/` | Ninguno (ya usaban `provideHttpClient`)                         | Migración de HTTP: `app.module.ts` + 6 specs |

Upstream aplicó en el mismo commit exactamente los cambios de nuestra etapa 03 (`browser-esbuild` → `application`, `outputPath.base`, `browser`, `esModuleInterop`, sin `downlevelIteration`).

> **Lección:** el estado final es el mismo. La diferencia está en el **historial**: aquí upgrade y modernización están separados, así que si algo se rompe se sabe si fue la versión o el builder.

---

## 7.1 Novedades de v18

Referencia oficial: [blog de Angular](https://blog.angular.dev/) y [documentación de Angular](https://angular.dev/).

---

## 8. Seguimiento: cobertura de la cadena de interceptors

**Rama:** `feature/interceptor-chain-spec` · **Commit:** `8b57920` · **Archivo:** `src/app/app.module.interceptors.spec.ts`

### Concepto

- **El hueco:** cada spec de interceptor registra **solo su propio** interceptor. Prueban que cada pieza funciona, pero no que `AppModule` las conecta.
- **Por qué importa justo aquí:** el upgrade a v18 reescribió exactamente ese cableado (`HttpClientModule` → `provideHttpClient(withInterceptorsFromDi())`). Si se pierde `withInterceptorsFromDi()`, la app compila y los 72 tests siguen en verde, pero ningún interceptor se ejecuta.
- **La solución:** un spec que importa el `AppModule` real y solo reemplaza el backend con `provideHttpClientTesting()`. Así se ejercita el grafo de providers de producción con una request real.

### Qué verifica

| Test                                                     | Qué protege                                 |
| -------------------------------------------------------- | ------------------------------------------- |
| Orden registrado `Api → Token → Error`                   | Que nadie elimine o reordene un interceptor |
| URL con prefijo + header `Token abc`                     | Api y Token aplicados en la misma request   |
| Sin token → sin `Authorization`                          | Token no inventa un header vacío            |
| Error 422 → se recibe el body, no el `HttpErrorResponse` | Error envuelve al backend                   |

### Prueba de que detecta roturas (mutaciones)

El comportamiento ya existía, así que el RED se demostró rompiendo `AppModule` a propósito y revirtiendo después:

| Mutación en `AppModule`                              | Resultado                        |
| ---------------------------------------------------- | -------------------------------- |
| `provideHttpClient()` sin `withInterceptorsFromDi()` | 3 fallos (solo en el spec nuevo) |
| Eliminar `TokenInterceptor`                          | 2 fallos (solo en el spec nuevo) |
| Mover `ApiInterceptor` al final                      | 1 fallo (solo en el spec nuevo)  |

En las tres mutaciones, **los 72 specs anteriores siguieron en verde**: esa es la prueba de que el hueco era real. Resultado final: 76/76, sin cambios en código de producción.

> **Lección:** los tests unitarios prueban piezas; el cableado necesita al menos un test de integración. Un test que nunca viste fallar no sabes si protege algo: la mutación manual es la forma barata de comprobarlo.
