# 🌐 OrgRise Web — Versión HTML5 / CSS3 / JS para GitHub Pages

Esta carpeta contiene la versión web 100% funcional e idéntica al proyecto original de Unity (**OrgRise - Puzzle de Diseño Organizacional**), lista para desplegar en **GitHub Pages** sin necesidad de compilación ni dependencias externas.

## 🚀 Cómo desplegar en GitHub Pages

1. Subí los archivos de esta carpeta (`index.html`, `styles.css`, `app.js`, `assets/` y `.nojekyll`) a la raíz de tu repositorio en GitHub (o dentro de una carpeta `/docs`).
2. En tu repositorio de GitHub, entrá a **Settings → Pages**.
3. En **Build and deployment → Source**, elegí **Deploy from a branch**.
4. Seleccioná la rama `main` (o `master`) y la carpeta `/ (root)`, y presioná **Save**.
5. En unos segundos tu juego estará disponible online en `https://<tu-usuario>.github.io/<tu-repositorio>/`.

## 📁 Estructura de Archivos
- `index.html`: Estructura semántica del simulador (Menú Principal, Selector de 5 Casos, Marco Teórico, Tablero interactivo, Barra de Comodín y Modales).
- `styles.css`: Estilos responsivos en proporción móvil vertical (`9:16`), colores originales por departamento, animaciones de rebote (`pop`) y vibración de error (`shake`).
- `app.js`: Motor completo portado desde los scripts C# de Unity (`LevelManager`, `ProceduralLevelGenerator`, `EmployeeNode`, `OrgValidator`, `WildcardManager`, `DailyStreakManager`, `TutorialManager`, `FeedbackManager`, `UINodeInteraction`).
- `assets/icon.png` y `assets/sounds/`: Ícono oficial y efectos de sonido originales del proyecto.

---

# 🏢 OrgRise - Puzzle de Diseño Organizacional

## 📌 Resumen del Proyecto
**OrgRise** es un juego de puzzles en 2D para dispositivos móviles desarrollado en **Unity 6 (`6000.3.10f1`)** donde el jugador debe diseñar organigramas funcionales conectando distintos roles empresariales bajo restricciones reales de gestión.

Este proyecto funciona como **Trabajo Final Integrador para la materia Gestión de la Organización**, traduciendo conceptos clásicos de diseño estructural (Mintzberg, Fayol, Robbins) en mecánicas interactivas con validación en tiempo real.

---

## 📚 Articulación Teórico-Práctica (Gestión de la Organización)

Cada regla de validación del motor de juego responde directamente a un principio de la asignatura:

| Concepto Académico | Implementación en el Juego (Mecánica) | Script Responsable |
| :--- | :--- | :--- |
| **Cadena de Mando y Jerarquía** | Los reportes solo pueden fluir desde el Nivel Operativo (`EmpleadoBase`) hacia el Nivel Táctico (`Gerente`), Nivel Ejecutivo (`Director`) y Nivel Estratégico (`CEO`), respetando el conducto regular. | `EmployeeNode.cs`, `OrgValidator.cs` |
| **Unidad de Mando** | Cada subordinado posee un único jefe directo (`manager`) a la vez, evitando la dualidad de mando (salvo coordinación transversal en el modo Matricial). | `EmployeeNode.cs` |
| **Tramo de Control (*Span of Control*)** | Cada mando posee un límite estricto de reportes directos (`Tramo: X/Max`). Al completarse el cupo, el indicador cambia de verde a rojo e impide la sobrecarga de supervisión (cuellos de botella). | `EmployeeNode.cs`, `ProceduralLevelGenerator.cs` |
| **Departamentalización** | Los niveles cambian dinámicamente el criterio de agrupamiento de las unidades: **Funcional** (Finanzas, Comercial, Operaciones, Tecnología), **Por Producto** (PyMEs, Consumo, Industria, Cloud), **Geográfica** (Regiones Norte, Centro, Sur, Exterior) y **Matricial** (Proyectos). | `LevelManager.cs`, `ProceduralLevelGenerator.cs` |
| **Centralización vs. Descentralización** | **Estructura Centralizada (Chata):** Tramo de control amplio en la cúpula y menos niveles intermedios.<br>**Estructura Descentralizada (Vertical):** Tramo de control estrecho que obliga al CEO a delegar autoridad en Directores y Gerentes. | `LevelManager.cs`, `ProceduralLevelGenerator.cs` |
| **Costo de Reestructuración** | Cuando un mando medio ya tiene personal a cargo, su rama queda consolidada. Para reasignar toda la unidad sin desarmarla se requiere un **Comodín de Reestructuración** (Consultoría Organizacional). | `WildcardManager.cs`, `UINodeInteraction.cs` |

---

## 🎮 Flujo de Niveles de la Entrega Académica

El juego incluye una campaña progresiva de **5 niveles demostrativos** seguida de un **Modo Desafío Diario Procedural**:

1. **Nivel 1 — Cadena de Mando y Tramo de Control:** Introducción a la estructura jerárquica lineal-funcional.
2. **Nivel 2 — Departamentalización por Producto:** Agrupamiento divisional por líneas de negocio.
3. **Nivel 3 — Departamentalización Geográfica:** Organización territorial por zonas.
4. **Nivel 4 — Estructura Centralizada (Horizontal / Chata):** Tramo de control amplio y supervisión directa desde la cúpula.
5. **Nivel 5 — Estructura Descentralizada (Vertical / Alta):** Tramo de control estrecho con delegación táctica obligatoria.
6. **Modo Desafío Diario Infinito:** Generación procedural con semilla determinista diaria (`yyyyMMdd`) y solubilidad matemática 100% garantizada.

---

## 🕹️ Controles e Interacción

* **Conectar roles:** Arrastrar desde un subordinado hacia su superior (o desde el superior hacia el subordinado).
* **Desconectar un rol:** Hacer **doble clic / doble toque** (o clic derecho en PC) sobre el nodo subordinado.
* **Comodín de Reestructuración:** Presionar el botón **Comodín** para habilitar el traslado o desconexión de un mando que ya tiene subordinados a cargo.
* **Feedback Teórico en Tiempo Real:** Cada conexión válida o rechazada muestra en la parte inferior la justificación teórica exacta (ej. *Tramo de control excedido*, *Incompatibilidad de departamentalización* o *Salto en la cadena de mando*).

---

## ⚙️ Especificaciones Técnicas
* **Motor:** Unity `6000.3.10f1` (Universal Render Pipeline 2D).
* **Interfaz:** Unity uGUI + TextMeshPro con escalado automático (`1080x1920` Portrait).
* **Persistencia:** Sistema de racha diaria con `PlayerPrefs` e `InvariantCulture` (`yyyy-MM-dd`).
