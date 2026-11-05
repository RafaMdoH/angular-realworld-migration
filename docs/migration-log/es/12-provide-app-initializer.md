# 12 — `APP_INITIALIZER` → `provideAppInitializer()` (Angular 22.2)

> Registro de decisiones: por qué el token deprecado se reemplaza a mano, el concepto detrás de la nueva API, el hueco de la red de seguridad que este cambio dejó al descubierto y cómo se cerró, qué cambió, cómo se verificó y qué sigue.

**Rama:** `feature/provide-app-initializer` · **Commits:** `054cc02` (spec de conexión), `57ee61b` (refactor)

---

## 1. Por qué

| Motivo                          | Detalle                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deprecado desde Angular 19      | `APP_INITIALIZER` está deprecado desde Angular 19; `provideAppInitializer()` es su reemplazo                                                                                       |
| Sin schematic en Angular 22     | La migración opcional `provide-initializer` solo existió en el update a v19. Los schematics de `@angular/core@22` no la incluyen (`control-flow-migration`, `inject-migration`, …) |
| Cambio manual, superficie chica | Un solo provider en `src/app/app.module.ts`. `initAuth` sigue exportada y sin cambios, así que su spec de caracterización se mantiene igual                                        |
| Un concepto por cambio          | Fuera de alcance: pasar `AppModule` a `bootstrapApplication`, Node 24 (siguiente etapa) y el resto de seguimientos                                                                 |

---

## 2. Concepto: token + factory vs función en un contexto de inyección

- **Antes:** `APP_INITIALIZER` es un **token** multi-provider. El provider indica una **factory** (`useFactory: initAuth`) y enumera sus dependencias en un **array `deps`** (`[JwtService, UserService]`). Angular resuelve esas dependencias, llama a la factory, y la factory devuelve la función que se ejecuta al arrancar.
- **Después:** `provideAppInitializer()` recibe una **función simple** que Angular ejecuta en un **contexto de inyección**. Las dependencias se obtienen con `inject()` dentro de la función, no con un array `deps`, y no hay token ni `multi: true` que escribir.
- **Qué se mantiene igual:** `initAuth(jwtService, userService)` sigue devolviendo la función de arranque, y esa función sigue devolviendo un Observable (`getCurrentUser()` con token, `EMPTY` sin él). La inicialización de la aplicación de Angular trata el Observable/valor devuelto de la misma forma.

| Aspecto      | `APP_INITIALIZER`                               | `provideAppInitializer()`                   |
| ------------ | ----------------------------------------------- | ------------------------------------------- |
| Registro     | `{ provide: APP_INITIALIZER, …, multi: true }`  | `provideAppInitializer(fn)`                 |
| Dependencias | `deps: [JwtService, UserService]`               | `inject(JwtService)`, `inject(UserService)` |
| Qué se pasa  | Una factory que devuelve la función de arranque | La propia función de arranque               |
| Estado       | Deprecado desde Angular 19                      | API actual                                  |

Como `initAuth` se conserva como factory, el nuevo provider la llama con los servicios inyectados y después llama a la función que devuelve: `initAuth(inject(JwtService), inject(UserService))()`.

---

## 3. Cerrar el hueco de la red de seguridad: el spec de conexión

### El hueco

`app.module.spec.ts` ya tenía 3 specs de caracterización para `initAuth`. Llaman a la función directamente con spies y comprueban qué hace con y sin token. Ninguno demostraba que `initAuth` está **registrada** como inicializador de la aplicación y que **se ejecuta al arrancar**, y ese registro es justo lo que este cambio reconecta. Un provider roto habría dejado esos 3 specs en verde.

| Nivel       | Qué llama                                                   | Qué demuestra                                                                 |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Unitario    | `initAuth(jwt, user)()` directamente                        | La lógica de la función con y sin token                                       |
| Integración | `AppModule` a través de `ApplicationInitStatus.donePromise` | Que la función está registrada, se ejecuta al arrancar y recibe sus servicios |

### El spec de conexión (`054cc02`)

2 specs de integración en un `describe` nuevo ("AppModule app initializer wiring"). `TestBed` importa el `AppModule` real, sustituye `JwtService` / `UserService` por spies y espera `ApplicationInitStatus.donePromise`, que se resuelve cuando los inicializadores de la aplicación terminaron:

```ts
// app.module.spec.ts (054cc02)
function bootstrapAppModule(): Promise<unknown> {
  TestBed.configureTestingModule({
    imports: [AppModule],
    providers: [
      { provide: JwtService, useValue: jwt },
      { provide: UserService, useValue: user },
    ],
  });
  return TestBed.inject(ApplicationInitStatus).donePromise;
}
```

- Con token, el usuario actual se carga una vez (`getToken` y `getCurrentUser` se llaman una vez cada uno).
- Sin token, no se llama a la API (`getCurrentUser` no se llama).

### Comprobaciones de mutación

El spec se escribió y ejecutó **antes** del refactor, sobre la conexión anterior, y se comprobó contra ambas versiones.

| Conexión                        | Resultado del spec antes de mutar | Mutación                                             | Resultado                                            |
| ------------------------------- | --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Anterior (`APP_INITIALIZER`)    | Verde (122/122)                   | Se elimina el provider de `APP_INITIALIZER`          | La suite falla                                       |
| Nueva (`provideAppInitializer`) | Verde (122/122)                   | Se elimina la llamada a `provideAppInitializer(...)` | Fallan los dos specs de conexión (`TOTAL: 2 FAILED`) |

El archivo se restauró después de cada mutación.

> **Lección:** un test unitario de una función no protege su registro. Un refactor que cambia cómo se conecta el código al framework necesita un test a nivel de conexión, escrito y probado contra la conexión anterior antes del cambio.

---

## 4. Qué cambió (`57ee61b`)

```diff
// app.module.ts (57ee61b)
-import { APP_INITIALIZER, NgModule } from "@angular/core";
+import { inject, NgModule, provideAppInitializer } from "@angular/core";
 ...
   providers: [
-    {
-      provide: APP_INITIALIZER,
-      useFactory: initAuth,
-      deps: [JwtService, UserService],
-      multi: true,
-    },
+    provideAppInitializer(() =>
+      initAuth(inject(JwtService), inject(UserService))()
+    ),
```

`initAuth` y sus specs de caracterización no cambian. No queda ninguna aparición de `APP_INITIALIZER` en `src/`.

---

## 5. Verificación y métricas

**Método:** `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage` y `npx ng build`. La referencia es el cierre de la etapa 11.

| Métrica                                      | Etapa 11                       | Etapa 12                       | Cambio                           |
| -------------------------------------------- | ------------------------------ | ------------------------------ | -------------------------------- |
| Tests                                        | 120/120                        | 122/122                        | +2 de integración (conexión)     |
| Cobertura (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.98% / 74% / 68.48% / 75.72% | Ligeramente mayor                |
| Bundle inicial (raw / transfer)              | 357.60 kB / 99.56 kB           | 357.58 kB / 99.59 kB           | −0.02 kB raw / +0.03 kB transfer |
| Warnings del compilador                      | Ninguno                        | Ninguno                        | Sin cambios                      |
| `APP_INITIALIZER` en `src/`                  | 1 provider + import            | 0                              | Eliminado                        |

**Nota de proceso:** el documento de la feature de esta etapa (`docs/tasks/provide-app-initializer.md`) se creó después del refactor, no antes de la primera escritura como en las etapas anteriores. La evidencia que contiene se registró durante el trabajo.

---

## 6. Seguimiento

| Tema                                                        | Detalle                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node 22 → 24                                                | Siguiente etapa                                                            |
| Karma → Vitest                                              | Cambio separado                                                            |
| Detección de cambios zoneless                               | Cambio de modernización separado                                           |
| Adoptar la semántica de `?.` en templates de v22            | Eliminar el wrapper `$safeNavigationMigration` en `article.component.html` |
| Revisar los componentes con `ChangeDetectionStrategy.Eager` | Al pasar a `OnPush` / zoneless                                             |
