# 10 — Paquete del builder: `@angular-devkit/build-angular` → `@angular/build` (Angular 21.2)

> Registro de decisiones: por qué el paquete del builder cambia antes de Angular 22, la diferencia entre un builder y el paquete que lo provee, qué cambió, cómo se verificó y qué hizo upstream.

**Rama:** `feature/angular-build-package` · **Commit:** `8a1f5ff`

---

## 1. Por qué

| Motivo                                       | Detalle                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La etapa 03 cambió el builder, no el paquete | Desde la etapa 03 la aplicación se compila con el builder esbuild `application`, pero seguía cargándose desde `@angular-devkit/build-angular`                                                                 |
| El paquete anterior incluye webpack          | `@angular-devkit/build-angular` también trae los builders basados en webpack y sus dependencias, aunque no se use ninguno                                                                                     |
| Deprecado en Angular 22                      | `npm view @angular-devkit/build-angular@latest deprecated` (22.2.6): "Angular's Webpack support is deprecated. Use the esbuild and Vite-based "@angular/build" package instead."                              |
| Un concepto por cambio                       | `@angular/build` provee los mismos builders (`application`, `dev-server`, `extract-i18n`, `karma`) sin webpack. Hacer el cambio en Angular 21 mantiene la etapa de Angular 22 como un upgrade de versión puro |

---

## 2. Concepto: builder vs paquete

- **En una frase:** `angular.json` nombra cada builder como `<paquete>:<builder>`; la parte antes de los dos puntos indica desde dónde se carga el código, la parte después indica qué builder se ejecuta.
- **Qué cambió la etapa 03:** la parte después de los dos puntos, `browser` → `application` (webpack → esbuild).
- **Qué cambia esta etapa:** la parte antes de los dos puntos, `@angular-devkit/build-angular` → `@angular/build`. El mismo builder `application` se carga ahora desde un paquete que no incluye webpack.
- **Consecuencia:** nada cambia en cómo se compila la aplicación; por eso la salida del build es idéntica: los siete archivos generados conservan en el nombre el mismo hash de contenido que en la etapa 09 (`main-U5C3E52R.js`, `polyfills-5CFQRCPP.js`, `chunk-WTYHNFYV.js`, …). La diferencia aparece en lo que instala `npm ci`.

---

## 3. Qué cambió

Comando: `ng update @angular/cli --name use-application-builder` (la migración opcional oficial).

| Target (`angular.json`) | Antes                                        | Después                       |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| `build`                 | `@angular-devkit/build-angular:application`  | `@angular/build:application`  |
| `serve`                 | `@angular-devkit/build-angular:dev-server`   | `@angular/build:dev-server`   |
| `extract-i18n`          | `@angular-devkit/build-angular:extract-i18n` | `@angular/build:extract-i18n` |
| `test`                  | `@angular-devkit/build-angular:karma`        | `@angular/build:karma`        |

Dependencia de desarrollo en `package.json`: `@angular-devkit/build-angular ^21.2.29` → `@angular/build ^21.2.29`. No cambió ningún otro archivo; sin cambios en `src/` ni en los specs.

---

## 4. Verificación y métricas

**Método:** `npm ci` limpio y luego las mismas comprobaciones de las etapas anteriores (tests con cobertura, build de producción en 3 corridas, servidor de desarrollo). La línea base es la medición final de la etapa 09.

| Métrica                                      | `@angular-devkit/build-angular` | `@angular/build`               | Cambio           |
| -------------------------------------------- | ------------------------------- | ------------------------------ | ---------------- |
| Paquetes instalados (`npm ci`)               | 1093                            | 710                            | −35%             |
| Tamaño de `node_modules`                     | 511 MB                          | 381 MB                         | −130 MB          |
| `webpack` instalado                          | Sí                              | No                             | Eliminado        |
| Tests                                        | 120/120                         | 120/120                        | Sin cambios      |
| Cobertura (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%  | 76.92% / 74% / 68.29% / 75.65% | Sin cambios      |
| Build de producción (3 corridas)             | 2.3 / 2.3 / 2.3 s               | 2.5 / 2.3 / 2.4 s              | Dentro del ruido |
| Bundle inicial (raw / transfer)              | 346.08 kB / 97.59 kB            | 346.08 kB / 97.59 kB           | Idéntico         |
| `ng serve`                                   | —                               | Sirve `index.html` (HTTP 200)  | Arranca          |
| Hallazgos de `npm audit`                     | 40                              | 35                             | Moderados 27→22  |

Sin advertencias del compilador. Los hallazgos altos de `npm audit` siguen en 12; no hay hallazgos críticos. Los "65 hallazgos (2 críticos)" registrados en la etapa 06 ya habían bajado a 40 con los upgrades de Angular.

> **Lección:** la mayor ganancia de esta etapa está en el árbol de instalación, no en el bundle. La aplicación se compila con el mismo builder, así que la salida no cambia; lo que cambia es que un tercio de los paquetes instalados, webpack entre ellos, ya no se descarga.

---

## 5. Upstream

Upstream ya usa `@angular/build`: hizo el cambio en su commit de Angular 20 [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2), junto con el upgrade de versión. Esta migración mantuvo ambos como cambios separados.

---

## 6. Seguimiento

| Tema                                          | Detalle                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Angular 21 → 22 + TypeScript 6.0              | Próxima etapa, ahora un upgrade de versión puro                          |
| `APP_INITIALIZER` → `provideAppInitializer()` | Sigue abierto; previsto junto con Node 24                                |
| Karma → Vitest                                | Cambio separado; el builder `karma` sigue disponible en `@angular/build` |
| Zoneless change detection                     | Cambio de modernización separado                                         |
