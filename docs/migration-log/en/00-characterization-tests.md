# 00 — Characterization tests (safety net before upgrading)

> Decision record: the steps taken, **why** each decision was made, **what went wrong** along the way, and **how the work (including the AI-assisted part) was validated**.

**Baseline:** Angular 15.2.3 · TypeScript 4.8 · Node 18 · Karma/Jasmine · tag `v15-baseline`
**Branch:** `feature/characterization-tests`

---

## 1. Initial diagnosis: four questions before touching anything

A legacy project is **not** upgraded first. Three questions are answered in order, because each one blocks the next:

| #   | Question                                 | How it was answered                                    | Result                                  |
| --- | ---------------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| 1   | Does it build?                           | `ng build`                                             | Yes (~6.4 s, 508 KB)                    |
| 2   | Are there tests? Do they pass?           | `find src -name "*.spec.ts" \| wc -l`                  | **0 tests**                             |
| 3   | Which runtime does it need?              | Angular compatibility matrix                           | Node ^14.20 / ^16.13 / ^18.10           |
| 4   | Does it run and look right? (smoke test) | `ng serve` + click through + `curl` external resources | **Theme CSS: 404 · API: 530** (see 1.1) |

**Node decision:** the machine had Node 24. Instead of "trying and seeing", the official matrix was checked **before** installing dependencies. Angular 15 does not support Node 24, so Node 18 was installed with `nvm` and pinned in `.nvmrc`, so anyone cloning the repo knows which version to `nvm use`.

> **Lesson:** checking the compatibility matrix prevents cryptic install/build errors that look like code bugs but are environment issues.

**Test decision:** with 0 tests there is no way to know whether an `ng update` broke something, other than clicking through the app manually. So the **first** migration work item is building the safety net.

### 1.1 Smoke test: dead external dependencies

**Added later:** this fourth question was **not asked at the start**. It surfaced when running `ng serve` already on Angular 16. Build and unit tests could not catch it:

- `ng build` does not download the external `<link>` tags in `index.html`.
- Specs use `HttpTestingController`, which **fakes** the API on purpose.

> **Lesson:** a green test suite does **not** prove the app works in a real environment. The smoke test belongs in the diagnosis, before migrating.

| External resource                          | Status  | Caused by the migration?                                     |
| ------------------------------------------ | ------- | ------------------------------------------------------------ |
| `demo.productionready.io/main.css` (theme) | **404** | No: `index.html` unchanged since `v15-baseline` (`git diff`) |
| `api.realworld.io` (backend)               | **530** | No: the server no longer exists                              |
| ionicons, Google Fonts                     | 200 ✅  | —                                                            |

**Decision: out of scope, left as is.** This is a **maintenance** problem (external services stopped existing), not a **version migration** problem. The project isn't ours, and the goal of the exercise is the Angular upgrade. Mixing them would break the migrating ≠ fixing rule. Reference: maintainers fixed it in `04db069` (CSS vendored into `styles.css`) and by moving the API to `api.realworld.show`.

**Accepted risk:** without styles or data, **visual and runtime** regressions can't be checked manually. The safety net relies on unit tests. Keep this in mind for the esbuild switch (v17), which changes how styles are processed.

#### In a real project: options presented to the client

In a real project this is not ignored. Usually the team already knows those services are alive, or has already decided how to replace them. If not, options are presented for them to decide:

| Option                                                | Pros                                               | Cons                                            |
| ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Vendor**: copy the CSS/resource into the repo       | No third-party dependency; versioned with the code | The team now owns that code; manual updates     |
| **npm package** (if one exists, e.g. `ionicons`)      | Versioned, updated via `npm`, part of the bundle   | Bigger bundle; integration must be adapted      |
| **Another CDN** (jsDelivr, cdnjs)                     | One-line change                                    | Still an external dependency that can die again |
| **Self-hosting / own backend** (for the API)          | Full control, no reliance on a public service      | Infrastructure and maintenance cost             |
| **Mock / fake API** (json-server, MSW) for dev and QA | Develop and test without a backend                 | Not for production; can drift from the real API |

**Good practice:** log it as a **finding with its own ticket**, separate from the migration ticket, with an owner and an explicit decision.

---

## 2. What a characterization test is

A characterization test describes what existing code **does today**, even if it is wrong. Unlike TDD, it passes on its first run; its usefulness is proven by **mutation**: break the code on purpose, the test must fail, then revert.

### Golden rule: migrating ≠ fixing

A bug found during the migration is **not fixed**; it is locked with a test.

- If one commit both migrates and fixes, and something breaks, **there is no way to tell which change caused it**.
- If `ng update` unintentionally changes a behavior (even a buggy one), a test should catch it.
- Fixes come later in separate `fix(...)` PRs, each flipping its locked test.

---

## 3. Deciding what to test: blast radius

The goal is not a coverage percentage. The goal is to test **what would hurt most if it broke**. CodeGraph was used to measure how many parts of the code depend on each piece:

| Target                             | Data               | Why it was prioritized                                         |
| ---------------------------------- | ------------------ | -------------------------------------------------------------- |
| `UserService`                      | **23 callers**     | Auth state: used by guards, header, editor…                    |
| Interceptors (api, token, error)   | Every HTTP request | Newer versions move them from **class** to **function**        |
| `initAuth` (APP_INITIALIZER)       | App bootstrap      | Changes when moving from `AppModule` to `bootstrapApplication` |
| Route guards                       | Access control     | Guard API evolved across versions                              |
| `ShowAuthedDirective`              | 3 callers          | Candidate to be replaced by `@if` control flow                 |
| `AuthComponent`, `EditorComponent` | Reactive forms     | Uses `UntypedFormGroup`, exactly what migrations touch         |

**Deliberately left out** (low risk): footer, models (types only), markdown pipe, presentational components.

> **Criterion:** in a legacy app with no tests, prioritize by blast radius and by what the migration **will touch**, not by coverage.

---

## 4. AI-assisted work: prompt and boundaries

Writing the 9 spec files was delegated to an independent AI agent with a bounded assignment. The real prompt had these sections:

| Prompt section        | Excerpt                                                                                  | Why it exists                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Role and limit        | "Lock CURRENT behavior… DO NOT change any production code."                              | Without it, AI tends to "fix" the bug it finds, breaking the migrating ≠ fixing rule.                  |
| Environment           | "ALWAYS run with `nvm use 18`… default Node 24 breaks it."                               | The agent starts without the context already discovered in the session.                                |
| Already-mapped facts  | "UserService: BehaviorSubject… update PUT /user does NOT save token…"                    | Saves tokens (no full-repo exploration) and points at subtle behaviors to lock.                        |
| Suspected bugs        | "Lock this with a test named 'KNOWN BUG (locked)…'"                                      | Marks what NOT to fix and how to name it so it stays visible.                                          |
| Tasks + commits       | "One commit per task… `test(auth): …`"                                                   | One commit per block gives a readable, revertible history.                                             |
| Mutation validation   | "Temporarily break one line… confirm a test fails… revert."                              | The only way to prove a test that passes on first run **does** detect change.                          |
| Allowed edit surfaces | `src/app/**/*.spec.ts` and `docs/tasks/…md`                                              | A hard boundary: the agent cannot touch production code.                                               |
| Honest escape hatch   | "If the behavior you assumed is wrong, re-read the source and lock the ACTUAL behavior." | The brief could be wrong (and it was, see section 6): the source code takes precedence over the brief. |
| Return format         | "status, commits, mutation used, behavior that differed…"                                | A structured report can be **verified**; a narrative cannot.                                           |

> **Applied criterion:** the agent worked within explicit boundaries, verified context and measurable success criteria, and had to deliver verifiable **evidence**, not "done".

---

## 5. How correctness was validated (without trusting the agent)

The agent saying "done" **is not evidence**. Five validation layers were applied, cheapest to strongest:

| #   | Validation                                                 | What it proves                             | Result                           |
| --- | ---------------------------------------------------------- | ------------------------------------------ | -------------------------------- |
| 1   | Per-file mutation (agent)                                  | Each test detects real change              | All mutations failed as expected |
| 2   | **Independent re-run**                                     | The reported result is real, not invented  | 67/67 ✅, same coverage          |
| 3   | `ng build`                                                 | Tests did not break compilation            | ✅                               |
| 4   | `git diff v15-baseline..HEAD -- src ':(exclude)*.spec.ts'` | **No** production code was touched         | Empty ✅                         |
| 5   | `git log`                                                  | Reported commits exist with correct format | 6 `test(...)` commits ✅         |

### Mutation example

In `ShowAuthedDirective` the agent **fixed the bug** on purpose (`authRef = undefined` after `clear()`) and both `KNOWN BUG` tests **failed**. That proves that if an `ng update` or a refactor changes this behavior, the tests catch it.

### Real test example

```ts
it("adds an Authorization header with the Token scheme when a token exists", () => {
  jwt.saveToken("secret");
  http.get("/user").subscribe();

  const req = controller.expectOne("/user"); // captures the request, no real network
  expect(req.request.headers.get("Authorization")).toBe("Token secret");
  req.flush({}); // answers the fake request
});
```

Mutation applied: `Token` → `Bearer` in the interceptor → **2 tests fail**.

---

## 6. Errors and obstacles (what happened, why, how it was solved)

| #   | Symptom                                                           | Cause                                                                                  | Fix                                                     | Lesson                                                                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `TS18003: No inputs were found in config file tsconfig.spec.json` | No `*.spec.ts` existed; the tsconfig `include` matched nothing                         | None: expected, and it confirmed the test infra existed | Not every error is a problem. Read what it says first.                 |
| 2   | `ChunkLoadError` in routing specs                                 | `fakeAsync` + `flush()` advances the clock and fires webpack's lazy-chunk load timeout | Routing specs use real-time `async/await`               | `loadComponent` routes and `fakeAsync` don't mix.                      |
| 3   | Type error in error fixtures                                      | The brief said `string[]`; the `Errors` model uses `string`                            | The agent read the real code and adjusted               | The human's brief can be wrong too. **The code rules.**                |
| 4   | Jasmine: "Spec has no expectations"                               | Specs only used `expectOne` (implicit assertion)                                       | Add an explicit `expect` on the request                 | A test without an explicit `expect` is ambiguous to readers.           |
| 5   | Task doc could not include its own commit hash                    | A commit cannot contain its own hash (the hash depends on the content)                 | Record the hash in the next commit                      | Git limitation, not a process flaw.                                    |
| 6   | Files "modified" after every commit                               | The repo has a lint-staged hook running Prettier on commit                             | None: desired behavior                                  | Check repo hooks (`.husky`, `lint-staged`) before committing.          |
| 7   | Code exploration burning many tokens                              | Full files were read instead of using CodeGraph                                        | Initialize CodeGraph and query the graph                | With AI, context is a limited resource: explore with structural tools. |

---

## 7. Findings: locked behaviors (NOT fixed)

| #   | Behavior                                                                              | Status            |
| --- | ------------------------------------------------------------------------------------- | ----------------- |
| 1   | `ShowAuthedDirective` never re-renders after auth toggles back (both modes)           | KNOWN BUG, locked |
| 2   | `EditorComponent.submitForm` always calls `create`, never `update`, when editing      | KNOWN BUG, locked |
| 3   | `ApiInterceptor` prefixes absolute URLs too (`https://api.realworld.io/apihttps://…`) | Locked            |
| 4   | `ErrorInterceptor` rethrows `null` when the error response has no body                | Locked            |
| 5   | `JwtService.getToken` returns `undefined` (not `null`) without a token                | Locked            |
| 6   | `EditorComponent.addTag` stores untrimmed tags                                        | Locked            |

Only the first 2 were visible by reading the code. **The other 4 were revealed by the characterization process itself.** That is the real value of this stage.

---

## 8. Baseline metrics (the "before")

| Metric          | Value                 |
| --------------- | --------------------- |
| Specs           | 67 passing, 0 failing |
| Statements      | 44.78% (163/364)      |
| Branches        | 56% (28/50)           |
| Functions       | 41.46% (68/164)       |
| Lines           | 42.02% (145/345)      |
| Build time      | ~6.4 s                |
| Bundle (`dist`) | 508 KB                |

Coverage is intentionally partial: it targets high-blast-radius code, not a percentage.

---

## Appendix — Deep dive: why `fakeAsync` + lazy loading causes `ChunkLoadError`

**Reproduced and verified** with a temporary spec (deleted afterwards): navigating to `/article/x` inside `fakeAsync` and calling `flush()` yields `ChunkLoadError: Loading chunk src_app_features_article_article_component_ts failed.`

### The 3 pieces

1. **Lazy loading = loading a JS file on demand.** `loadComponent: () => import("./article.component")` is not in the main bundle. Webpack splits it into a _chunk_ and, on navigation, appends a `<script src="chunk.js">` and **waits for the browser to download it**.
2. **Webpack guards itself with a timer.** In case the script never arrives, it schedules a 120 s `setTimeout`; if it fires before the script loads, the promise rejects with `ChunkLoadError`. Source: `node_modules/webpack/lib/runtime/LoadScriptRuntimeModule.js:151` → `var timeout = setTimeout(onScriptComplete…, ${loadTimeout})`.
3. **`fakeAsync` fakes the clock.** Inside `fakeAsync`, Zone.js replaces `setTimeout` with a **virtual** timer. `tick(ms)` / `flush()` advance it instantly. But the `<script>` download is a **real** browser event — the fake clock neither controls nor speeds it up.

### The race you lose

```
real time ───────────────────────────────────────────►
  navigate()  → webpack creates <script> + setTimeout(120 s)  (virtual)
  flush()     → virtual clock jumps +120 s IN 0 real ms
              → timeout fires → ChunkLoadError ❌
  (the real script would have arrived a few ms later — too late)
```

`flush()` means "run **all** pending timers", including webpack's, which fires before the browser finishes downloading the file.

### Solutions

| Option                                                                                             | When to use it                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Real-time `async/await` (the one used)                                                             | Specs that navigate to real lazy routes                     |
| Test routes with **non-lazy** components (`RouterTestingModule.withRoutes([{ path, component }])`) | When testing guards/logic only, not lazy loading            |
| `fakeAsync` + short `tick()` (not `flush()`)                                                       | Sometimes works, but brittle: depends on real download time |

> **Why it matters for the migration:** in Angular 17 the **application** builder moves to esbuild, but `ng test` with Karma **still uses webpack**, so this issue remains. It changes when we migrate the test runner (e.g. to Vitest, the default in recent versions): chunk loading will no longer go through webpack's `setTimeout`. A good example of why characterization tests are re-run at every step.
