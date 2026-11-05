# 13 — Actualización del runtime Node 22 → Node 24 (Angular 22.2)

> Registro de decisiones: por qué el runtime se actualiza ahora, cómo esta etapa cierra el intento con Node 24 descartado en la etapa 06, qué cambió, cómo se verificó y qué efectos secundarios aparecieron con npm 11.

**Rama:** `feature/upgrade-node-24` · **Commit:** `027f333`

---

## 1. Diagnóstico

### Por qué actualizar ahora

| Motivo                                | Detalle                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Ventana de soporte                    | Node 22 está en LTS de mantenimiento hasta abril de 2027; Node 24 tiene soporte hasta abril de 2028                             |
| Angular 22.2 declara Node 24          | `engines` de `@angular/core@22.2.4` y `@angular/build@22.2.6`: `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`                           |
| El motivo de la etapa 06 ya no aplica | Node 24 se descartó en la etapa 06 solo porque Angular CLI 19 no lo listaba como soportado. El proyecto ya está en Angular 22.2 |
| Un concepto por cambio                | Solo el runtime. Fuera de alcance: Vitest, detección de cambios zoneless y actualización de dependencias                        |

### Etapa 06 frente a ahora

| Etapa           | Angular / CLI | Build y tests con Node 24 | Soporte oficial de Node 24                                             | Decisión         |
| --------------- | ------------- | ------------------------- | ---------------------------------------------------------------------- | ---------------- |
| 06              | 19.2 / 19     | En verde, bundle idéntico | No: `ng version` mostró `Node: 24.19.0 (Unsupported)`                  | Mantener Node 22 |
| 13 (esta etapa) | 22.2 / 22     | En verde, bundle idéntico | Sí: declarado en `engines`; `ng version` no lo marca como no soportado | Pasar a Node 24  |

El mismo Node 24.19.0 que se descartó en la etapa 06 ahora tiene soporte oficial. No cambió nada en el runtime; cambió la matriz de soporte del framework.

### Qué depende de la versión de Node

| Elemento                    | Estado antes de esta etapa                                          |
| --------------------------- | ------------------------------------------------------------------- |
| `.nvmrc`                    | `22`                                                                |
| `engines` de `package.json` | `^22.12.0`                                                          |
| CI                          | Lee `.nvmrc` mediante `setup-node`: el workflow no requiere cambios |
| Runtime instalado           | Node 24.19.0 mediante nvm                                           |

> **Hallazgo:** el antiguo `^22.12.0` ya estaba por debajo del piso de Node 22 del propio Angular 22 (`^22.22.3`). Se eligió en la etapa 06 como el Node 22 mínimo para Angular 20, y nada lo señaló cuando las siguientes versiones de Angular subieron el piso.

---

## 2. Cambios (`027f333`)

| Archivo                          | Antes      | Después     |
| -------------------------------- | ---------- | ----------- |
| `.nvmrc`                         | `22`       | `24`        |
| `engines.node` de `package.json` | `^22.12.0` | `^24.15.0`  |
| `package-lock.json`              | —          | Sin cambios |
| `src/`                           | —          | Sin cambios |

**Por qué `^24.15.0`:** es el piso de Node 24 que declara Angular 22.2 (`@angular/core` y `@angular/build`), así que `engines` ahora describe el rango que el framework realmente soporta.

`npm ci` con Node 24.19.0 / npm 11.17.0 terminó limpio: sin `EBADENGINE`, sin `ERESOLVE` y sin reescribir el lockfile.

---

## 3. Verificación y métricas

**Método:** el mismo de las etapas anteriores. La línea base de Node 22 es la medición final de la etapa 12 (Node 22.23.4) sobre el mismo árbol.

| Métrica                                      | Node 22                        | Node 24                        | Cambio      |
| -------------------------------------------- | ------------------------------ | ------------------------------ | ----------- |
| Tests                                        | 122/122                        | 122/122                        | Sin cambios |
| Cobertura (stmts / branches / funcs / lines) | 76.98% / 74% / 68.48% / 75.72% | 76.98% / 74% / 68.48% / 75.72% | Sin cambios |
| Bundle inicial (raw)                         | 357.58 kB                      | 357.58 kB                      | Sin cambios |
| Bundle inicial (transfer)                    | 99.59 kB                       | 99.59 kB                       | Sin cambios |
| Build de producción (3 corridas)             | No registrado                  | 2.8 / 1.4 / 1.5 s              | —           |
| Advertencias del compilador                  | Ninguna                        | Ninguna                        | Sin cambios |
| `npm audit`                                  | 20                             | 20                             | Sin cambios |
| Paquetes instalados por `npm ci`             | 595 (npm 10)                   | 586 (npm 11)                   | Ver §4      |

### Salida idéntica entre runtimes

Compilar con Node 22 y con Node 24 sobre el mismo `node_modules` produce los mismos 16 archivos JavaScript de salida con hashes de contenido idénticos (`main-FIQHQIDM.js`, `polyfills-5CFQRCPP.js`, `chunk-DvJnFojZ.js`, …). El cambio de runtime es invisible para la aplicación.

### Comprobación de soporte con `ng version`

En la etapa 06 la comprobación de soporte se basó en la constante `SUPPORTED_NODE_MAJORS` del código fuente del CLI. Esa constante no se encontró en el código fuente de `@angular/cli@22`, así que esta etapa usa el resultado observable: `ng version` informa `Node.js: 24.19.0` sin marca de no soportado.

---

## 4. Efectos secundarios de npm 11

Node 24 incluye npm 11, que trae dos diferencias ajenas a la aplicación.

| Efecto                    | Detalle                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avisos de `allow-scripts` | npm 11 advierte sobre 5 paquetes con scripts de instalación: `@parcel/watcher`, `esbuild`, `fsevents`, `lmdb`, `msgpackr-extract`. Build y tests no se ven afectados |
| Cantidad de paquetes      | `npm ci` instala 586 paquetes con npm 11 frente a 595 con npm 10 en Node 22, a partir del mismo lockfile sin cambios                                                 |

> **Lección:** una versión descartada por un motivo documentado debe reevaluarse cuando ese motivo cambia, no recordarse como "no funciona". La etapa 06 registró _por qué_ se descartó Node 24 (la lista de soporte del CLI 19), y eso permitió ver exactamente cuándo el descarte dejó de aplicar.

---

## 5. Seguimiento

| Tema                                   | Detalle                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Karma → Vitest                         | Próxima etapa (14)                                                                                         |
| Detección de cambios zoneless          | Después de Vitest, como cambio de modernización propio                                                     |
| Limpieza de `$safeNavigationMigration` | Sigue abierto desde la etapa 11: adoptar la semántica de `?.` de las plantillas de v22 y quitar el wrapper |
| `ChangeDetectionStrategy.Eager`        | Sigue abierto desde la etapa 11: revisar esos componentes al pasar a OnPush / zoneless                     |
| Configuración de `allow-scripts`       | Investigar solo si npm empieza a bloquear los scripts de instalación; hoy son solo avisos                  |
