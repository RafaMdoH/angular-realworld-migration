# 04 — Upgrade Angular 17.3 → 18.2

> Decision record: diagnosis, automatic migrations (with the concept behind the HTTP change), how the safety net was protected, findings, metrics, and comparison with the maintainers' migration.

**Branch:** `feature/upgrade-angular-18` · **Commits:** `6eaa247` (Angular 18), `b3a85c0` (rx-angular 18)

---

## 1. Diagnosis before upgrading

| Question                             | How it was answered                                  | Result                                                                                                         |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Is my Node still valid?              | `engines` of Angular 18.2.14                         | `^18.19.1 \|\| ^20.11.1 \|\| >=22` → Node 18.20.8 ✅                                                           |
| Which TypeScript?                    | Compiler `peerDependencies`                          | `>=5.4 <5.6` → current 5.4 is fine, **no bump needed**                                                         |
| Which zone.js?                       | `@angular/core@18` peerDependencies                  | `~0.14.10` → already installed since stage 02 ✅                                                               |
| Third parties tied to the major?     | `npm view @rx-angular/{template,cdk}@18 peerDeps`    | `template@18.0.3` and `cdk@18.0.0` → `@angular/core ^18`                                                       |
| Does the CLI run on Node 18?         | Known gotcha from stage 03                           | Every `ng update` needs `NG_DISABLE_VERSION_CHECK=true`                                                        |
| What new risk does this major bring? | v18 changelog + search for `HttpClientTestingModule` | The HTTP migration **rewrites specs**: home, user.service, 3 interceptors, and routing. The safety net changes |

> **Lesson:** the special risk of this major is not in production code but in the **tests**. If the migration touches the specs, the thing that validates the upgrade is itself changing, so it must be reviewed more carefully than the rest.

---

## 2. What `ng update @angular/core@18 @angular/cli@18` did

```bash
NG_DISABLE_VERSION_CHECK=true npx ng update @angular/core@18 @angular/cli@18
```

| Change                         | Before  | After                                |
| ------------------------------ | ------- | ------------------------------------ |
| `@angular/*`                   | 17.3.12 | 18.2.14                              |
| `@angular/cli` / build-angular | 17.3.17 | 18.2.21                              |
| `typescript`                   | 5.4     | 5.4 (unchanged: within `>=5.4 <5.6`) |

### Automatic migrations

| Migration           | Result                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Two-way binding     | No changes                                                                                                     |
| `afterRender` phase | No changes                                                                                                     |
| `BootstrapContext`  | No changes                                                                                                     |
| **HTTP providers**  | **10 files**: `app.module.ts`, 6 specs, and 3 interceptors (the latter only reformatted; Prettier reverted it) |

---

## 3. HTTP change: `HttpClientModule` → `provideHttpClient()`

`HttpClient` moves from being configured by importing an NgModule to being configured with **provider functions**, the same API for standalone and NgModule apps.

**Why `HttpClientModule` was deprecated (v18):** it is an NgModule-era API. `provide*` functions with `with*` features are tree-shakable (what you don't use doesn't reach the bundle) and work the same in `bootstrapApplication` and in an NgModule's `providers`. The v18 docs also warn that with `HttpClientModule` in multiple injectors, interceptor behavior is "poorly defined" and depends on import ordering.

**What `withInterceptorsFromDi()` does:** it bridges the **class-based** interceptors registered with the `HTTP_INTERCEPTORS` token, like this repo's three (`ApiInterceptor`, `TokenInterceptor`, `ErrorInterceptor`). `HttpClientModule` picked them up automatically; `provideHttpClient()` does **not**. Without this feature the app compiles and boots, but the interceptors **silently stop running**: no base URL, no JWT token, no error handling. That is the real failure it prevents, and why the official docs state `HttpClientModule` is equivalent to `provideHttpClient(withInterceptorsFromDi())`.

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

The order of the three `HTTP_INTERCEPTORS` did not change, so the execution order did not either.

**In the tests**, `HttpClientTestingModule` (also deprecated) becomes two providers:

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

**Why `provideHttpClient()` must come BEFORE `provideHttpClientTesting()`:** the latter **overrides** the former's backend with the fake backend controlled by `HttpTestingController`. In the injector, the last provider registered for a token wins; with the order reversed, the real backend wins again and `HttpTestingController` stops intercepting requests. The official v18 docs warn about it explicitly: reversing the order "can potentially break your tests".

---

## 4. How we proved the safety net was not weakened

A migration that rewrites specs could, in theory, change what is being checked. The diff was reviewed line by line:

| Check                                                  | Result                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `it` + `expect` count per spec, before and after       | Unchanged: routing 34, api 7, error 6, token 6, user.service 46, home 15 |
| Assertion lines modified                               | None: the diff only touches imports and `configureTestingModule`         |
| `provideHttpClient` → `provideHttpClientTesting` order | Correct in all 6 specs                                                   |
| Full suite                                             | 72/72 ✅, coverage 57.41% (same as before)                               |

> **Lesson:** when a migration touches the tests, review it **harder** than production code. A test that passes because it was weakened protects nothing, and "72/72 green" won't tell you.

---

## 5. Real finding: green tests ≠ supported combination

- **Symptom:** after T2, `ng update` and npm left Angular 18 installed alongside rx-angular 17, whose `peerDependencies` require `@angular/core ^17.0.0`, **without any error**. Build and tests passed.
- **Cause:** `ng update` only updates the packages it is asked to, and in this install no tool flagged the peer mismatch (why npm did not block it was not investigated further).
- **Fix (T3, `b3a85c0`):** `@rx-angular/cdk@18.0.0` and `@rx-angular/template@18.0.3` (peers `@angular/core ^18`). 72/72, 57.41%.
- **Lesson:** "it works" and "it's supported" are different things. Compatibility is verified in `peerDependencies`, not only with green tests.

`npm audit` reports vulnerabilities: that is **pre-existing** dependency maintenance, out of scope for this stage.

---

## 6. Metrics: v17 (esbuild) vs v18

**Method:** same as stage 03 (Node 18, cold cache, 3 runs).

| Metric                    | v17 esbuild (stage 03) | v18                  | Change               |
| ------------------------- | ---------------------- | -------------------- | -------------------- |
| Production build          | ~3.2 s                 | 3.21 / 3.27 / 3.19 s | No noticeable change |
| Development build         | ~2.44 s                | 2.70 / 2.72 / 2.67 s | ≈ +0.25 s            |
| Initial bundle (raw)      | 318.19 kB              | 335.06 kB            | +16.9 kB             |
| Initial bundle (transfer) | 89.36 kB               | 93.72 kB             | +4.36 kB             |
| `main`                    | 8.53 kB                | 8.75 kB              | +0.22 kB             |
| Tests / coverage          | 72/72, 57.41%          | 72/72, 57.41%        | Unchanged            |

`ng serve` smoke: `<app-root>` present, `main.js` 200, 0 warnings.

> **Honesty about the numbers:** the bundle grew 16.9 kB and the development build ~0.25 s. The cause was not investigated beyond "the framework version changed"; attributing it to a specific feature would be speculation. What matters: an upgrade is **not free by default**, and it is measured rather than assumed.

---

## 7. Comparison with the "answer key" (upstream `932dff0`)

|                | Maintainers (`932dff0`)                                     | This migration                            |
| -------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Angular        | 18.0.0, TS 5.4.5                                            | 18.2.14, TS 5.4                           |
| Builder        | `use-application-builder` applied **inside** the v18 commit | Already done separately in stage 03       |
| `src/` changes | None (they were already on `provideHttpClient`)             | HTTP migration: `app.module.ts` + 6 specs |

Upstream applied, in the same commit, exactly our stage 03 changes (`browser-esbuild` → `application`, `outputPath.base`, `browser`, `esModuleInterop`, no `downlevelIteration`).

> **Lesson:** the end state is the same. The difference is the **history**: here upgrade and modernization are separate, so if something breaks you know whether it was the version or the builder.

---

## 7.1 v18 features

Official reference: [Angular blog](https://blog.angular.dev/) and [Angular documentation](https://angular.dev/).

---

## 8. Follow-up: interceptor chain coverage

**Branch:** `feature/interceptor-chain-spec` · **Commit:** `8b57920` · **File:** `src/app/app.module.interceptors.spec.ts`

### Concept

- **The gap:** each interceptor spec registers **only its own** interceptor. They prove each piece works, not that `AppModule` wires them together.
- **Why it matters right here:** the v18 upgrade rewrote exactly that wiring (`HttpClientModule` → `provideHttpClient(withInterceptorsFromDi())`). If `withInterceptorsFromDi()` is lost, the app compiles and all 72 tests stay green, but no interceptor runs.
- **The fix:** a spec that imports the real `AppModule` and replaces only the backend with `provideHttpClientTesting()`, so the production provider graph handles a real request.

### What it checks

| Test                                               | What it protects                          |
| -------------------------------------------------- | ----------------------------------------- |
| Registration order `Api → Token → Error`           | Nobody removes or reorders an interceptor |
| Prefixed URL + `Token abc` header                  | Api and Token applied on the same request |
| No token → no `Authorization`                      | Token does not invent an empty header     |
| 422 error → body received, not `HttpErrorResponse` | Error wraps the backend                   |

### Proof that it catches breakage (mutations)

The behavior already existed, so RED was shown by breaking `AppModule` on purpose and reverting afterwards:

| Mutation in `AppModule`                                  | Result                     |
| -------------------------------------------------------- | -------------------------- |
| `provideHttpClient()` without `withInterceptorsFromDi()` | 3 failures (new spec only) |
| Remove `TokenInterceptor`                                | 2 failures (new spec only) |
| Move `ApiInterceptor` last                               | 1 failure (new spec only)  |

In all three mutations **the 72 existing specs stayed green**: proof the gap was real. Final result: 76/76, no production code changes.

> **Lesson:** unit tests prove pieces; wiring needs at least one integration test. A test you never saw fail may protect nothing: manual mutation is the cheap way to check.
