# 03 — Builder webpack → esbuild `application` (Angular 17.3)

> Registro de decisiones: concepto, diagnóstico, métricas, fallos reales y comparación con la migración de los mantenedores.

**Rama:** `feature/esbuild-application-builder` · **Commits:** `2fab99f` (migración), `9d978af` (limpieza de `tsconfig.json`)

---

## 1. Concepto (resumen)

- **En una frase:** el _builder_ es la herramienta que convierte el código TypeScript, los templates y los estilos en los archivos que descarga el navegador; cambiarlo cambia la velocidad del build y la forma de la salida, no la lógica de la app.
- **Confusión común:** _"Actualicé a v17, así que ya uso esbuild."_ **No.** `ng update` a v17 deja el `angular.json` apuntando a webpack (`browser`). Cambiar de builder es una migración opcional y separada.
- **Por qué webpack era lento y frágil aquí:** está escrito en JavaScript y procesa mucho en un solo hilo; su fragilidad real es la configuración acumulada (plugins, opciones propias como `buildOptimizer` o `vendorChunk`) que pocos entienden.
- **Por qué esbuild + Vite es mejor:** esbuild está escrito en Go y compila en paralelo; Vite acelera `ng serve`; `application` es un solo builder para navegador y SSR, con menos opciones propias.
- **Cuándo NO conviene (todavía):** si el proyecto depende de plugins o configuración custom de webpack (`@angular-builders/custom-webpack`, loaders propios), porque esbuild no los soporta. En ese caso, `browser-esbuild` o quedarse en webpack hasta reemplazarlos.

---

## 2. Diagnóstico antes de migrar

| Pregunta                                    | Cómo se respondió                                   | Resultado                                                   |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| ¿Sirve mi Node?                             | `.nvmrc` y requisitos ya verificados en la etapa 02 | Node 18.20.8 ✅ (sin cambios)                               |
| ¿Cambia la versión de Angular?              | `package.json`                                      | No: 17.3.12 (un solo concepto por PR)                       |
| ¿Hay configuración custom de webpack?       | Revisión de `angular.json`                          | Ninguna ✅                                                  |
| ¿Algún deploy depende de la ruta de salida? | Búsqueda en el repo                                 | Ninguno; solo el asset `_redirects` (convención de Netlify) |
| ¿Lo que voy a tocar está cubierto?          | Tests existentes                                    | Karma no se ve afectado: en v17 sigue usando webpack        |
| ¿Árbol de trabajo limpio?                   | `ng update` lo exige                                | Se hizo commit del documento de tareas antes de migrar      |

---

## 3. Métricas: antes (T1) vs después (T3)

**Método:** Node 18, caché fría (`dist/` y `.angular/cache` borrados antes de cada corrida), 3 corridas, tiempo real medido con `/usr/bin/time`.

| Métrica                    | webpack (`browser`) | esbuild (`application`) | Cambio                        |
| -------------------------- | ------------------- | ----------------------- | ----------------------------- |
| Build de producción (real) | 6.4 s               | 3.2 s                   | ≈ −50%                        |
| Build de desarrollo (real) | 4.85 s              | 2.44 s                  | ≈ −50%                        |
| Bundle inicial (raw)       | 332.17 kB           | 318.19 kB               | −14 kB                        |
| Bundle inicial (transfer)  | 92.64 kB            | 89.36 kB                | −3.28 kB                      |
| `main`                     | 295.29 kB           | 8.53 kB                 | Ver nota                      |
| Tests                      | 72/72               | 72/72                   | Sin cambios                   |
| Cobertura de sentencias    | 57.41%              | 57.41%                  | Sin cambios (Karma = webpack) |

**Nota sobre `main`:** no es que el código haya desaparecido. esbuild separa el código compartido en archivos `chunk-*.js` que también son iniciales; por eso el total inicial casi no cambia aunque `main` sea mucho más pequeño.

> **Honestidad sobre las cifras:** la app es pequeña, así que la ganancia absoluta son **segundos**. Lo que escala es el **porcentaje**: en un proyecto con builds de minutos, −50% sí cambia la forma de trabajar del equipo y el costo del CI.

---

## 4. Qué cambió la migración y por qué

```diff
// angular.json
- "builder": "@angular-devkit/build-angular:browser",
+ "builder": "@angular-devkit/build-angular:application",
- "outputPath": "dist/angular-conduit",
+ "outputPath": { "base": "dist/angular-conduit" },
- "main": "src/main.ts",
+ "browser": "src/main.ts"
  // configuración development
- "buildOptimizer": false,
- "vendorChunk": true,
```

```diff
// tsconfig.json
+ "esModuleInterop": true,
- "downlevelIteration": true,
```

| Cambio                               | Por qué existe                                                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser` → `application`            | El builder nuevo, el mismo que usa `ng new` desde v17, para navegador y SSR.                                                                                                                                                                 |
| `main` → `browser`                   | `application` puede tener varios puntos de entrada (`browser`, `server`); el nombre indica para qué entorno es.                                                                                                                              |
| `outputPath` → `{ base }`            | La salida se divide en subcarpetas (`browser/`, y `server/` con SSR) dentro de `base`.                                                                                                                                                       |
| Sin `buildOptimizer` / `vendorChunk` | Eran opciones exclusivas de webpack; esbuild optimiza y divide chunks por su cuenta.                                                                                                                                                         |
| `+esModuleInterop`                   | esbuild trata los imports por defecto de módulos CommonJS como lo hacen los bundlers modernos; con esta opción `tsc` verifica tipos con la misma semántica (interpretación nuestra: el código de la migración lo fija sin explicar por qué). |
| `-downlevelIteration`                | Solo sirve al compilar a ES5/ES3; con `target: ES2022` no tenía efecto.                                                                                                                                                                      |

**Salida:** ahora en `dist/angular-conduit/browser/` (con `index.html` y `_redirects` juntos). Existe la alternativa `outputPath.browser: ""` para conservar la estructura vieja; **mantuvimos el valor por defecto** porque no hay pipeline de deploy en el repo que dependa de la ruta.

---

## 5. Fallos reales encontrados

### 5a. `ng update` instaló un CLI 22 que exige Node 22

| Paso             | Detalle                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Síntoma          | `ng update @angular/cli --name use-application-builder` instaló un CLI temporal 22.2.5 que requiere Node >=22 y abortó.                                                                          |
| Causa            | La verificación de versión de `ng update` ejecuta siempre el CLI **más reciente**.                                                                                                               |
| Intento          | Fijar `@angular/cli@17.3.17` falló con _"Package is not installed"_: con `--name` el comando solo migra, y el especificador se interpreta como parte del nombre del paquete.                     |
| Arreglo          | `NG_DISABLE_VERSION_CHECK=true npx ng update @angular/cli --name use-application-builder`                                                                                                        |
| Cómo se encontró | El propio CLI define esa variable al lanzar su binario temporal (`node_modules/@angular/cli/src/commands/update/cli.js`).                                                                        |
| Lección          | La migración viene en `@schematics/angular` 17.3.17, pero está registrada como opcional para **18.0.0**: solo aparece sola al actualizar a v18. Para usarla en v17 hay que invocarla por nombre. |

### 5b. esbuild mostró una advertencia que webpack ocultaba

- **Síntoma:** advertencia por un `"useDefineForClassFields"` suelto en la raíz de `tsconfig.json`.
- **Causa:** duplicado de la entrada que ya existe dentro de `compilerOptions`; `tsc` lo ignoraba desde la base v15 (upstream lo eliminó después).
- **Arreglo:** eliminado en un commit separado (`9d978af`); 0 advertencias en build y serve después.
- **Lección:** una herramienta más estricta saca a la luz **deuda de configuración latente**. Se corrige aparte para que el historial distinga "migración" de "limpieza".

---

## 6. Comparación con la "hoja de respuestas" (upstream `00a5b80`)

Los mantenedores (Angular 17.0.7) cambiaron una sola línea: `browser` → `browser-esbuild`.

|                          | `browser-esbuild` (upstream) | `application` (esta migración)            |
| ------------------------ | ---------------------------- | ----------------------------------------- |
| Cambio en `angular.json` | Una línea                    | Varias opciones (migración oficial)       |
| Estructura de salida     | Igual que webpack            | Subcarpeta `browser/`                     |
| Punto de entrada         | Conserva `main`              | `browser`                                 |
| Vite en `ng serve`       | Sí                           | Sí                                        |
| SSR unificado            | No                           | Sí                                        |
| A futuro                 | Transición                   | Builder por defecto para proyectos nuevos |

**Por qué elegimos `application`:** es el destino final (el que usan los proyectos nuevos y SSR); hacerlo ahora evita una segunda migración de builder. El costo, la carpeta `browser/`, no afecta a nada en este repo.

---

## 7. Comandos de verificación

```bash
rm -rf dist .angular/cache && /usr/bin/time npx ng build                              # 3 corridas
rm -rf dist .angular/cache && /usr/bin/time npx ng build --configuration development  # 3 corridas
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage                   # 72/72, 57.41%
ls dist/angular-conduit/browser                                                        # index.html + _redirects
npx ng serve                                                                           # smoke: index.html con <app-root>, main.js 200
```
