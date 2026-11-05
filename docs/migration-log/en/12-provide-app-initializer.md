# 12 — `APP_INITIALIZER` → `provideAppInitializer()` (Angular 22.2)

> Decision record: why the deprecated token is replaced by hand, the concept behind the new API, the safety-net gap this change exposed and how it was closed, what changed, how it was verified, and what comes next.

**Branch:** `feature/provide-app-initializer` · **Commits:** `054cc02` (wiring spec), `57ee61b` (refactor)

---

## 1. Why

| Reason                       | Detail                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deprecated since Angular 19  | `APP_INITIALIZER` has been deprecated since Angular 19; `provideAppInitializer()` is its replacement                                                                                  |
| No schematic in Angular 22   | The optional `provide-initializer` migration only existed in the v19 update. The schematics of `@angular/core@22` do not include it (`control-flow-migration`, `inject-migration`, …) |
| Manual change, small surface | One provider in `src/app/app.module.ts`. `initAuth` stays exported and unchanged, so its characterization spec stays as is                                                            |
| One concept per change       | Out of scope: moving `AppModule` to `bootstrapApplication`, Node 24 (next stage) and the other follow-ups                                                                             |

---

## 2. Concept: token + factory vs function in an injection context

- **Before:** `APP_INITIALIZER` is a multi-provider **token**. The provider names a **factory** (`useFactory: initAuth`) and lists its dependencies in a **`deps` array** (`[JwtService, UserService]`). Angular resolves those dependencies, calls the factory, and the factory returns the function that runs at startup.
- **After:** `provideAppInitializer()` takes a **plain function** that Angular runs in an **injection context**. Dependencies come from `inject()` inside the function, not from a `deps` array, and there is no token or `multi: true` to write.
- **What stays the same:** `initAuth(jwtService, userService)` still returns the startup function, and that function still returns an Observable (`getCurrentUser()` with a token, `EMPTY` without one). The returned Observable/value is handled by Angular's app initialization the same way.

| Aspect         | `APP_INITIALIZER`                              | `provideAppInitializer()`                   |
| -------------- | ---------------------------------------------- | ------------------------------------------- |
| Registration   | `{ provide: APP_INITIALIZER, …, multi: true }` | `provideAppInitializer(fn)`                 |
| Dependencies   | `deps: [JwtService, UserService]`              | `inject(JwtService)`, `inject(UserService)` |
| What is passed | A factory that returns the startup function    | The startup function itself                 |
| Status         | Deprecated since Angular 19                    | Current API                                 |

Because `initAuth` is kept as a factory, the new provider calls it with the injected services and then calls the function it returns: `initAuth(inject(JwtService), inject(UserService))()`.

---

## 3. Closing the safety-net gap: the wiring spec

### The gap

`app.module.spec.ts` already had 3 characterization specs for `initAuth`. They call the function directly with spies and check what it does with and without a token. None of them proved that `initAuth` is **registered** as an app initializer and **runs at startup**, and that registration is exactly what this change rewires. A broken provider would have left those 3 specs green.

| Level       | What it calls                                           | What it proves                                                 |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Unit        | `initAuth(jwt, user)()` directly                        | The function's logic with and without a token                  |
| Integration | `AppModule` through `ApplicationInitStatus.donePromise` | The function is registered, runs at startup, gets its services |

### The wiring spec (`054cc02`)

2 integration specs in a new `describe` ("AppModule app initializer wiring"). `TestBed` imports the real `AppModule`, replaces `JwtService` / `UserService` with spies, and awaits `ApplicationInitStatus.donePromise`, which resolves once the app initializers have run:

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

- With a token, the current user is loaded once (`getToken` and `getCurrentUser` called once each).
- Without a token, the API is not called (`getCurrentUser` not called).

### Mutation checks

The spec was written and run **before** the refactor, on the old wiring, and checked against both versions.

| Wiring                        | Spec result before mutation | Mutation                                  | Result                                     |
| ----------------------------- | --------------------------- | ----------------------------------------- | ------------------------------------------ |
| Old (`APP_INITIALIZER`)       | Green (122/122)             | `APP_INITIALIZER` provider removed        | Suite fails                                |
| New (`provideAppInitializer`) | Green (122/122)             | `provideAppInitializer(...)` call removed | Both wiring specs fail (`TOTAL: 2 FAILED`) |

The file was restored after each mutation.

> **Lesson:** a unit test of a function does not protect its registration. A refactor that rewires how code is plugged into the framework needs a test at the wiring level, written and proven against the old wiring before the change.

---

## 4. What changed (`57ee61b`)

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

`initAuth` and its characterization specs are unchanged. No `APP_INITIALIZER` occurrences remain in `src/`.

---

## 5. Verification and metrics

**Method:** `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage` and `npx ng build`. The baseline is the end of stage 11.

| Metric                                      | Stage 11                       | Stage 12                       | Change                           |
| ------------------------------------------- | ------------------------------ | ------------------------------ | -------------------------------- |
| Tests                                       | 120/120                        | 122/122                        | +2 integration (wiring spec)     |
| Coverage (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.98% / 74% / 68.48% / 75.72% | Slightly higher                  |
| Initial bundle (raw / transfer)             | 357.60 kB / 99.56 kB           | 357.58 kB / 99.59 kB           | −0.02 kB raw / +0.03 kB transfer |
| Compiler warnings                           | None                           | None                           | Unchanged                        |
| `APP_INITIALIZER` in `src/`                 | 1 provider + import            | 0                              | Removed                          |

**Process note:** the feature document for this stage (`docs/tasks/provide-app-initializer.md`) was created after the refactor, not before the first write as in earlier stages. The evidence in it was recorded during the work.

---

## 6. Follow-ups

| Topic                                                 | Detail                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Node 22 → 24                                          | Next stage                                                                |
| Karma → Vitest                                        | Separate change                                                           |
| Zoneless change detection                             | Separate modernization change                                             |
| Adopt v22 template `?.` semantics                     | Remove the `$safeNavigationMigration` wrapper in `article.component.html` |
| Review the `ChangeDetectionStrategy.Eager` components | When moving to `OnPush` / zoneless                                        |
