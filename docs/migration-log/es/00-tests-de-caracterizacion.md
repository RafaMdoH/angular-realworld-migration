# 00 — Tests de caracterización (red de seguridad antes de migrar)

> Registro de decisiones: los pasos seguidos, **por qué** se tomó cada decisión, **qué falló** en el camino y **cómo se validó** que el trabajo (incluido el asistido por IA) es correcto.

**Línea base:** Angular 15.2.3 · TypeScript 4.8 · Node 18 · Karma/Jasmine · tag `v15-baseline`
**Rama:** `feature/characterization-tests`

---

## 1. Diagnóstico inicial: las 4 preguntas antes de tocar nada

Al recibir un proyecto legacy, **no se empieza actualizando**. Se responden tres preguntas, en este orden, porque cada una bloquea a la siguiente:

| #   | Pregunta                                 | Cómo se respondió                                                    | Resultado                                  |
| --- | ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| 1   | ¿Compila?                                | `ng build`                                                           | Sí (~6.4 s, 508 KB)                        |
| 2   | ¿Hay tests? ¿Pasan?                      | `find src -name "*.spec.ts" \| wc -l`                                | **0 tests**                                |
| 3   | ¿Con qué entorno corre?                  | Matriz de compatibilidad de Angular                                  | Node ^14.20 / ^16.13 / ^18.10              |
| 4   | ¿La app corre y se ve bien? (smoke test) | `ng serve` + recorrerla en el navegador + `curl` a recursos externos | **CSS del tema: 404 · API: 530** (ver 1.1) |

**Decisión sobre Node:** la máquina tenía Node 24. En vez de "probar a ver si funciona", se revisó la matriz oficial **antes** de instalar dependencias. Angular 15 no soporta Node 24, así que se instaló Node 18 con `nvm` y se fijó en `.nvmrc`. Así cualquier persona que clone el repo sabe qué versión usar con `nvm use`.

> **Lección:** consultar la matriz de compatibilidad evita errores crípticos de instalación o compilación que parecen bugs de código, pero son del entorno.

**Decisión sobre tests:** con 0 tests no hay forma de saber si un `ng update` rompe algo, salvo probando la app a mano pantalla por pantalla. Por eso el **primer** trabajo de la migración es crear la red de seguridad.

### 1.1 Smoke test: dependencias externas muertas

**Agregado después:** esta cuarta pregunta **no se hizo al inicio**. Se detectó al levantar `ng serve` ya en Angular 16. El build y los tests unitarios no podían detectarlo:

- `ng build` no descarga los `<link>` externos de `index.html`.
- Los tests usan `HttpTestingController`, que **simula** la API a propósito.

> **Lección:** una suite de tests en verde **no** prueba que la app funcione en un entorno real. El smoke test va en el diagnóstico, antes de migrar.

| Recurso externo                           | Estado  | ¿Lo causó la migración?                                      |
| ----------------------------------------- | ------- | ------------------------------------------------------------ |
| `demo.productionready.io/main.css` (tema) | **404** | No: `index.html` no cambió desde `v15-baseline` (`git diff`) |
| `api.realworld.io` (backend)              | **530** | No: el servidor dejó de existir                              |
| ionicons, Google Fonts                    | 200 ✅  | —                                                            |

**Decisión: fuera de alcance, se deja como está.** Es un problema de **mantenimiento** (los servicios externos dejaron de existir), no de **migración de versiones**. Este proyecto no es nuestro, y el objetivo del ejercicio es el upgrade de Angular. Mezclarlo rompería la regla migrar ≠ arreglar. Referencia: los mantenedores lo resolvieron en `04db069` (CSS copiado a `styles.css`) y moviendo la API a `api.realworld.show`.

**Riesgo aceptado:** sin estilos ni datos, las regresiones **visuales y de runtime** no se pueden verificar a mano. La red de seguridad depende de los tests unitarios. Es importante tenerlo presente en el paso a esbuild (v17), que cambia cómo se procesan los estilos.

#### En un proyecto real: opciones que se le presentarían al cliente

En un caso real esto no se ignora. Normalmente el equipo ya sabe que esos servicios siguen vivos o ya decidió con qué reemplazarlos. Si no, se le presentan opciones para que decida:

| Opción                                                | Pros                                                  | Contras                                                       |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Vendorizar**: copiar el CSS/recurso dentro del repo | Sin dependencia de terceros; versionado con el código | El equipo ahora mantiene ese código; actualizaciones manuales |
| **Paquete npm** (si existe, p. ej. `ionicons`)        | Versionado, se actualiza con `npm`, entra al bundle   | Aumenta el bundle; hay que adaptar la integración             |
| **Otro CDN** (jsDelivr, cdnjs)                        | Cambio de una línea                                   | Sigue siendo una dependencia externa que puede morir otra vez |
| **Self-hosting / backend propio** (para la API)       | Control total, sin depender de un servicio público    | Costo de infraestructura y mantenimiento                      |
| **Mock / API falsa** (json-server, MSW) para dev y QA | Permite desarrollar y probar sin backend              | No sirve para producción; puede divergir de la API real       |

**Buena práctica:** registrarlo como **hallazgo con su propio ticket**, separado del ticket de migración, con dueño y decisión explícita.

---

## 2. Qué es un test de caracterización

Un test de caracterización describe lo que el código existente **hace hoy**, aunque esté mal. A diferencia de TDD, pasa en la primera ejecución; su utilidad se demuestra por **mutación**: se rompe el código a propósito, el test debe fallar y luego se revierte.

### Regla de oro: migrar ≠ arreglar

Un bug encontrado durante la migración **no se corrige**: se congela con un test.

- Si un mismo commit migra y arregla, y algo se rompe, **no se puede saber cuál de los dos cambios lo causó**.
- Si `ng update` cambia sin querer un comportamiento (aunque sea un bug), un test debe detectarlo.
- Los arreglos van después, en PRs `fix(...)` separados. Cada uno invierte su test congelado.

---

## 3. Cómo se decidió qué testear: radio de impacto (blast radius)

No se busca un porcentaje de cobertura. Se testea **lo que más daño haría si se rompe**. Para medirlo se usó CodeGraph, que indica cuántas partes del código dependen de cada pieza:

| Objetivo                           | Dato                   | Por qué se priorizó                                                |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `UserService`                      | **23 llamadas**        | Estado de autenticación: lo usan los guards, el header, el editor… |
| Interceptors (api, token, error)   | Todo request HTTP pasa | Además, en versiones nuevas cambian de **clase** a **función**     |
| `initAuth` (APP_INITIALIZER)       | Arranque de la app     | Cambia al migrar de `AppModule` a `bootstrapApplication`           |
| Guards de rutas                    | Control de acceso      | La API de guards evolucionó entre versiones                        |
| `ShowAuthedDirective`              | 3 llamadas             | Candidata a reemplazarse por `@if` (control flow)                  |
| `AuthComponent`, `EditorComponent` | Formularios reactivos  | Usa `UntypedFormGroup`, que es justo lo que las migraciones tocan  |

**Lo que se dejó fuera a propósito** (bajo riesgo): footer, modelos (solo son tipos), pipe de markdown y componentes de presentación.

> **Criterio:** en un legacy sin tests se prioriza por radio de impacto y por lo que la migración **va a tocar**, no por cobertura.

---

## 4. Trabajo asistido por IA: prompt y límites

La escritura de los 9 archivos de tests se delegó a un agente de IA independiente, con un encargo acotado. El prompt real tenía estas secciones:

| Sección del prompt      | Extracto                                                                                 | Por qué existe                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rol y límite            | "Lock CURRENT behavior… DO NOT change any production code."                              | Sin esto, la IA tiende a "arreglar" el bug que encuentra, y se rompe la regla migrar ≠ arreglar.          |
| Entorno                 | "ALWAYS run with `nvm use 18`… default Node 24 breaks it."                               | El agente arranca sin el contexto ya descubierto en la sesión.                                            |
| Hechos ya mapeados      | "UserService: BehaviorSubject… update PUT /user does NOT save token…"                    | Ahorra tokens (no explora todo el repo) y le dice qué comportamientos sutiles congelar.                   |
| Bugs sospechosos        | "Lock this with a test named 'KNOWN BUG (locked)…'"                                      | Le marca qué NO corregir y cómo nombrarlo, para que sea visible.                                          |
| Tareas + commits        | "One commit per task… `test(auth): …`"                                                   | Un commit por bloque deja un historial legible y fácil de revertir.                                       |
| Validación por mutación | "Temporarily break one line… confirm a test fails… revert."                              | Es la única forma de demostrar que un test que pasa a la primera **sí** detecta cambios.                  |
| Superficie de edición   | `src/app/**/*.spec.ts` y `docs/tasks/…md`                                                | Pone un límite físico: el agente no puede tocar código de producción.                                     |
| Escape honesto          | "If the behavior you assumed is wrong, re-read the source and lock the ACTUAL behavior." | El encargo podía tener errores (y los tenía, ver sección 6): el código fuente prevalece sobre el encargo. |
| Formato de retorno      | "status, commits, mutation used, behavior that differed…"                                | Un reporte estructurado se puede **verificar**; una narración no.                                         |

> **Criterio aplicado:** el agente trabajó con límites explícitos, contexto verificado y criterios de éxito medibles, y debía entregar **evidencia** verificable, no un "listo".

---

## 5. Cómo se validó que el trabajo es correcto (sin confiar en el agente)

Que el agente diga "done" **no es evidencia**. Se aplicaron cinco capas de validación, de la más barata a la más fuerte:

| #   | Validación                                                 | Qué demuestra                                            | Resultado                                      |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| 1   | Mutación por archivo (agente)                              | Cada test detecta cambios reales                         | Todas las mutaciones fallaron como se esperaba |
| 2   | **Re-ejecución independiente**                             | Que el resultado reportado es real, no inventado         | 67/67 ✅, misma cobertura                      |
| 3   | `ng build`                                                 | Que los tests no rompieron la compilación                | ✅                                             |
| 4   | `git diff v15-baseline..HEAD -- src ':(exclude)*.spec.ts'` | Que **no** se tocó código de producción                  | Vacío ✅                                       |
| 5   | `git log`                                                  | Que existen los commits reportados, con formato correcto | 6 commits `test(...)` ✅                       |

### Ejemplo de mutación

En `ShowAuthedDirective` el agente **corrigió el bug** a propósito (`authRef = undefined` después de `clear()`) y los 2 tests `KNOWN BUG` **fallaron**. Eso demuestra que, si un `ng update` o una refactorización cambia ese comportamiento, los tests lo detectan.

### Ejemplo de test real

```ts
it("adds an Authorization header with the Token scheme when a token exists", () => {
  jwt.saveToken("secret");
  http.get("/user").subscribe();

  const req = controller.expectOne("/user"); // intercepta el request, sin red real
  expect(req.request.headers.get("Authorization")).toBe("Token secret");
  req.flush({}); // responde el request falso
});
```

Mutación aplicada: cambiar `Token` por `Bearer` en el interceptor → **2 tests fallan**.

---

## 6. Errores y obstáculos encontrados (qué pasó, por qué, cómo se resolvió)

| #   | Síntoma                                                           | Causa                                                                                               | Solución                                                                       | Lección                                                                                      |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | `TS18003: No inputs were found in config file tsconfig.spec.json` | No existía ningún `*.spec.ts`; el `include` del tsconfig no encontró archivos                       | Ninguna: era el resultado esperado y confirmaba que la infraestructura existía | No todo error es un problema. Primero hay que entender qué dice.                             |
| 2   | `ChunkLoadError` en los tests de rutas                            | `fakeAsync` + `flush()` adelanta el reloj y dispara el _timeout_ de carga de chunks lazy de webpack | Tests de rutas con `async/await` en tiempo real                                | Rutas con `loadComponent` + `fakeAsync` no se llevan bien.                                   |
| 3   | Error de tipos en los fixtures de errores                         | El brief decía `string[]`, pero el modelo `Errors` usa `string`                                     | El agente leyó el código real y ajustó los tests                               | La descripción del humano también puede estar mal. **El código manda.**                      |
| 4   | Jasmine: "Spec has no expectations"                               | Tests que solo usaban `expectOne` (que valida implícitamente)                                       | Agregar un `expect` explícito sobre el request                                 | Un test sin `expect` explícito es ambiguo para quien lo lee.                                 |
| 5   | El documento de tareas no podía incluir su propio hash            | Un commit no puede contener su propio hash (el hash depende del contenido)                          | Registrar el hash en el commit siguiente                                       | Limitación de git, no del proceso.                                                           |
| 6   | Archivos "modificados" después de cada commit                     | El repo tiene un _hook_ de lint-staged que corre Prettier al hacer commit                           | Ninguna: es lo deseado                                                         | Revisar los hooks del repo antes de commitear (`.husky`, `lint-staged`).                     |
| 7   | Exploración del código consumiendo muchos tokens                  | Se leyeron archivos completos en vez de usar CodeGraph                                              | Inicializar CodeGraph y consultar el grafo                                     | Con IA, el contexto es un recurso limitado: hay que explorar con herramientas estructurales. |

---

## 7. Hallazgos: comportamientos congelados (NO corregidos)

| #   | Comportamiento                                                                                         | Estado         |
| --- | ------------------------------------------------------------------------------------------------------ | -------------- |
| 1   | `ShowAuthedDirective` no vuelve a mostrar el elemento cuando la auth cambia y regresa (en ambos modos) | BUG, congelado |
| 2   | `EditorComponent.submitForm` siempre llama a `create`, nunca a `update`, al editar                     | BUG, congelado |
| 3   | `ApiInterceptor` le pone prefijo a URLs absolutas (`https://api.realworld.io/apihttps://…`)            | Congelado      |
| 4   | `ErrorInterceptor` relanza `null` si la respuesta de error no tiene body                               | Congelado      |
| 5   | `JwtService.getToken` devuelve `undefined` (no `null`) sin token                                       | Congelado      |
| 6   | `EditorComponent.addTag` guarda los tags sin hacer `trim`                                              | Congelado      |

Solo los 2 primeros eran visibles leyendo el código. **Los otros 4 los reveló el proceso de caracterización.** Ese es el valor real de esta etapa.

---

## 8. Métricas de la línea base (el "antes")

| Métrica         | Valor              |
| --------------- | ------------------ |
| Tests           | 67 pasan, 0 fallan |
| Sentencias      | 44.78% (163/364)   |
| Ramas           | 56% (28/50)        |
| Funciones       | 41.46% (68/164)    |
| Líneas          | 42.02% (145/345)   |
| Tiempo de build | ~6.4 s             |
| Bundle (`dist`) | 508 KB             |

La cobertura es parcial **a propósito**: cubre lo de mayor impacto, no busca un porcentaje.

---

## Anexo — A fondo: por qué `fakeAsync` + lazy loading da `ChunkLoadError`

**Reproducido y verificado** con un test temporal (luego borrado): navegar a `/article/x` dentro de `fakeAsync` y llamar `flush()` devuelve `ChunkLoadError: Loading chunk src_app_features_article_article_component_ts failed.`

### Las 3 piezas

1. **Lazy loading = cargar un archivo JS bajo demanda.** `loadComponent: () => import("./article.component")` no tiene el código en el bundle principal. Webpack lo separa en un _chunk_ y, cuando se navega a la ruta, agrega un `<script src="chunk.js">` al documento y **espera a que el navegador lo descargue**.
2. **Webpack se protege con un temporizador.** Por si el script nunca llega, programa un `setTimeout` de 120 s; si vence antes de que el script cargue, rechaza la promesa con `ChunkLoadError`. Está en el código fuente: `node_modules/webpack/lib/runtime/LoadScriptRuntimeModule.js:151` → `var timeout = setTimeout(onScriptComplete…, ${loadTimeout})`.
3. **`fakeAsync` falsifica el reloj.** Dentro de `fakeAsync`, Zone.js reemplaza `setTimeout` por un temporizador **virtual**. `tick(ms)` o `flush()` adelantan ese reloj al instante, sin esperar de verdad. Pero la descarga del `<script>` es un evento **real** del navegador: el reloj falso no la controla ni la acelera.

### La carrera que se pierde

```
tiempo real ─────────────────────────────────────────►
  navigate()  → webpack crea <script> + setTimeout(120 s)  (virtual)
  flush()     → el reloj virtual salta +120 s EN 0 ms reales
              → se dispara el timeout → ChunkLoadError ❌
  (el script real hubiera llegado unos ms después, pero ya es tarde)
```

`flush()` significa "ejecuta **todos** los temporizadores pendientes". Entre ellos está el de webpack, que se dispara antes de que el navegador termine de descargar el archivo.

### Soluciones

| Opción                                                                                                | Cuándo usarla                                                              |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `async/await` en tiempo real (la que se usó)                                                          | Tests que navegan a rutas lazy de verdad                                   |
| Rutas de prueba con componentes **no lazy** (`RouterTestingModule.withRoutes([{ path, component }])`) | Cuando solo pruebas guards o lógica, no la carga lazy                      |
| `fakeAsync` + `tick()` con un tiempo corto (no `flush()`)                                             | Funciona a veces, pero es frágil: depende de lo que tarde la descarga real |

> **Por qué importa en la migración:** en Angular 17 el builder **de la app** pasa a esbuild, pero `ng test` con Karma **sigue usando webpack**, así que este problema continúa. Cambiará cuando migremos el _runner_ de tests (por ejemplo, a Vitest, que es el default en versiones recientes): la carga de chunks dejará de pasar por ese `setTimeout` de webpack. Es un buen ejemplo de por qué los tests de caracterización se vuelven a correr en cada paso.
