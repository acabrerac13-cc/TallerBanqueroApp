# Taller Banquero 🔨⚙️
### Simulador Educativo 2D del Algoritmo del Banquero (Dijkstra)

**Taller Banquero** es una aplicación web interactiva que modela visual y matemáticamente el **Algoritmo del Banquero** de Edsger Dijkstra para la prevención de interbloqueos (*deadlocks*) en Sistemas Operativos.

Ambientado en un taller artesanal y mecánico:
- **Trabajadores (P0 a P4):** Procesos del sistema operativo.
- **Herramientas (Martillo A, Taladro B, Llave C):** Recursos reutilizables.
- **Tienda / Almacén Central (Don Ramón):** Único punto central de entrega y devolución de herramientas con mostrador unificado y estante de herramientas libres (*Disponible*).
- **Rutas Fijas Marcadas en el Suelo:** Cada trabajador tiene su propia ruta delimitada y visible que conecta su puesto directamente con el mostrador central sin atravesar las mesas de sus compañeros ni salir de la pantalla.
- **Mesas de Trabajo Fijas:** Cada trabajador tiene su mesa fija con su tornillo de banco, herramientas asignadas y el cartel con el nombre de su profesión claramente visible **ARRIBA** de la mesa.

---

## 🚀 Cómo Abrir el Proyecto Localmente

El proyecto es **100% estático** (HTML, CSS y JavaScript nativo con gráficos vectoriales SVG). **No requiere Node.js, npm, compilación ni instalación de dependencias**.

### Opción 1: Apertura Directa en el Navegador
1. Dirígete a la carpeta del proyecto:
   ```
   c:\Users\allan\Desktop\TallerBanquero\index.html
   ```
2. Haz doble clic sobre [index.html](file:///c:/Users/allan/Desktop/TallerBanquero/index.html) para abrirlo en Google Chrome, Microsoft Edge, Firefox, etc.

### Opción 2: Usando Servidor Local
```bash
npx serve .
# o
python -m http.server 8000
```
Y abre `http://localhost:8000` en tu navegador.

---

## 📋 Estructura de Archivos

```
TallerBanquero/
├── index.html        # Estructura semántica, cabecera limpia, controles y modales.
├── styles.css        # Sistema de diseño, capas fijas, animaciones y diseño responsive.
├── banker.js         # Lógica pura del algoritmo del banquero, ensayo hipotético y validaciones.
├── simulation.js     # Controlador 2D SVG, rutas marcadas, tienda central y máquina de estados.
├── test_banker.js    # Suite de pruebas automatizadas para verificación algorítmica.
└── README.md         # Documentación completa y guía para exposición en clase.
```

---

## 🎨 Rutas Fijas y Escena 2D

1. **Tienda Central Unificada:**
   - Ubicada en el centro superior del escenario (`X = 500`).
   - Alberga a Don Ramón en el mostrador central y el estante con todas las herramientas disponibles (*Disponible*).
   - Funciona como el **único punto de recogida y devolución de herramientas**.

2. **Rutas Marcadas en el Suelo:**
   - **P0:** Sale de su puesto, sigue su pasillo marcado hasta el mostrador central, interactúa con Don Ramón y regresa por su misma ruta.
   - **P1:** Cuenta con su ruta independiente central directa a la tienda sin cruzar la mesa de P0.
   - **P2:** Dispone de su ruta propia derecha sin atravesar las demás mesas.
   - Todos los trayectos son cortos, directos y permanecen holgadamente dentro del escenario, sin salirse de la pantalla.

3. **Giro al Trabajar y Devolución:**
   - Al completar el préstamo, el trabajador regresa a su mesa fija.
   - Al pulsar *"Trabajar y Terminar"*, se da la vuelta 180° hacia su mesa para trabajar con martilleo y chispas.
   - Al concluir, se da la vuelta hacia el frente, empaca todas sus herramientas y camina por su ruta a la tienda central a devolverlas.
   - Tras entregarlas a Don Ramón, regresa solo a su mesa marcado como `✅ Terminado`.

4. **Mesas 100% Inmóviles y Cartel Superior:**
   - Las mesas, bancos y carteles permanecen siempre fijos.
   - Arriba de cada mesa se muestra de forma destacada el nombre de la profesión (`P0 • CARPINTERO`, `P1 • MECÁNICO`, etc.).

---

## 🎯 Guión de Exposición (2 Minutos)

1. **Introducción (15 seg):**
   - *"Profesor, este es el Taller Banquero. Modela el algoritmo de Dijkstra en un taller 2D donde los procesos son trabajadores con rutas visibles en el suelo hacia la tienda central del banquero."*
2. **Caso 1: Escenario "Aprender" (45 seg):**
   - Con Disponible = `(2, 2)`, selecciona a P1 y solicita `[1, 0]`.
   - Pulsa **`🔍 Evaluar Solicitud`**: el banquero aprueba con la secuencia segura `<P1, P0, P2>`.
   - Pulsa **`🤝 Aplicar Préstamo`**: P1 camina por su ruta marcada hacia la tienda central, recibe su herramienta en el mostrador y regresa por su misma ruta a su mesa fija.
   - Pulsa **`⚙️ Trabajar y Terminar`**: P1 se da la vuelta hacia su mesa, trabaja con chispas, se da la vuelta otra vez, camina por su ruta a la tienda a devolver todas sus herramientas (el Disponible sube a `(3, 3)`) y regresa a su mesa terminado.
3. **Caso 2: Escenario "Préstamo Peligroso" (45 seg):**
   - Cambia a **"2: Préstamo Peligroso (10, 5, 7)"**.
   - Selecciona a P4 y solicita `[3, 3, 0]`. Al evaluar, Don Ramón indica que debe esperar por **estado inseguro**.
   - Pulsa **`🧪 Ver Ensayo de Seguridad`** para mostrar la simulación hipotética en el libro de cuentas.
   - Luego selecciona a P1 y pide `[1, 0, 2]`: se aprueba y P1 viaja por su ruta a recoger las herramientas.
4. **Configuración y Matrices (15 seg):**
   - Muestra **"Configurar Taller"** y **"Ver Matrices y Cálculos"** para evidenciar que las tablas matemáticas corresponden fielmente con la escena.

---

## ⚖️ Verificaciones Automatizadas

Ejecuta en consola:
```bash
node test_banker.js
```
- ✅ **100% pruebas unitarias superadas.**
- ✅ **Invariante de conservación estricta:** $\text{Disponible} + \sum \text{Asignado} = \text{Total}$.
