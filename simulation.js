/**
 * Taller Banquero - simulation.js
 * Controlador de la escena 2D interactiva, renderizado SVG con rutas fijas visibles,
 * tienda central del Banquero, mesas 100% inmóviles y máquina de estados sincronizada.
 */

// Sintetizador de audio nativo opcional
class SoundFX {
    constructor() {
        this.enabled = true;
        this.ctx = null;
    }

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.08) {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio silenciado o no soportado
        }
    }

    approve() {
        this.playTone(523.25, 'triangle', 0.12, 0.08);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.08), 100);
    }

    deny() {
        this.playTone(330, 'sawtooth', 0.18, 0.06);
        setTimeout(() => this.playTone(260, 'sawtooth', 0.25, 0.06), 120);
    }

    work() {
        this.playTone(440, 'square', 0.08, 0.04);
        setTimeout(() => this.playTone(550, 'square', 0.08, 0.04), 90);
    }

    success() {
        this.playTone(523.25, 'triangle', 0.12, 0.08);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.12, 0.08), 110);
        setTimeout(() => this.playTone(783.99, 'triangle', 0.3, 0.09), 220);
    }
}

// Estados únicos de ejecución para la máquina de estados de control
const SIM_STATE = {
    IDLE: 'IDLE',           // Antes de comenzar -> Botón: "▶️ Iniciar", Pausar: disabled
    RUNNING: 'RUNNING',     // Ejecutándose -> Botón: "⏹️ Detener", Pausar: enabled ("⏸️ Pausar")
    STOPPED: 'STOPPED',     // Detenido manualmente -> Botón: "▶️ Continuar", Pausar: disabled
    PAUSED: 'PAUSED',       // Pausado -> Botón: "⏹️ Detener", Pausar: "▶️ Reanudar"
    FINISHED: 'FINISHED'    // Todos terminados -> Botón: "🔄 Volver a iniciar", Pausar: disabled
};

class SimulationApp {
    constructor() {
        this.engine = new BankerEngine();
        this.sound = new SoundFX();

        // Máquina de estados
        this.simState = SIM_STATE.IDLE;
        this.isAnimating = false;
        this.speedMultiplier = 1.0;
        this.activeTimeouts = [];
        this.activeAnimationFrames = [];

        // Selección e interacción manual
        this.selectedWorker = 0;
        this.lastEvaluation = null;
        this.pendingRequest = [0, 0, 0];
        this.currentScenario = 'aprender';

        this.cacheDOMElements();
        this.init();
    }

    cacheDOMElements() {
        // SVG y Escenario
        this.svgEl = document.getElementById('workshop-svg');
        this.statusBadge = document.getElementById('stage-status-badge');
        this.statusBadgeText = document.getElementById('status-badge-text');
        this.conservationBadgeText = document.getElementById('conservation-text');
        this.stageToast = document.getElementById('stage-toast');

        // Controles de Simulación
        this.scenarioSelect = document.getElementById('scenario-select');
        this.btnAutoDemo = document.getElementById('btn-auto-demo');
        this.btnPause = document.getElementById('btn-pause');
        this.btnStep = document.getElementById('btn-step');
        this.btnReset = document.getElementById('btn-reset');
        this.speedBtns = document.querySelectorAll('.speed-btn');
        this.btnConfigure = document.getElementById('btn-configure');
        this.btnToggleSound = document.getElementById('btn-toggle-sound');

        // Panel de Selección y Solicitud Manual
        this.workerTabsContainer = document.getElementById('worker-tabs');
        this.workerNameTitle = document.getElementById('selected-worker-title');
        this.metricAlloc = document.getElementById('metric-alloc');
        this.metricMax = document.getElementById('metric-max');
        this.metricNeed = document.getElementById('metric-need');
        this.resourceInputsContainer = document.getElementById('resource-inputs-grid');
        this.btnEvaluate = document.getElementById('btn-evaluate');
        this.btnApplyLoan = document.getElementById('btn-apply-loan');
        this.btnWorkFinish = document.getElementById('btn-work-finish');
        this.btnViewTrial = document.getElementById('btn-view-trial');

        // Dictamen del Banquero
        this.decisionBadge = document.getElementById('decision-badge');
        this.decisionText = document.getElementById('decision-text');

        // Almacén
        this.warehouseInvContainer = document.getElementById('warehouse-inventory');
        this.calcStatePill = document.getElementById('calc-state-pill');
        this.calcSequenceText = document.getElementById('calc-sequence-text');

        // Matrices Colapsables
        this.collapsibleTrigger = document.getElementById('matrices-toggle');
        this.matricesContent = document.getElementById('matrices-content');
        this.matrixTableBody = document.getElementById('matrix-table-body');
        this.matrixTableFoot = document.getElementById('matrix-table-foot');
        this.matrixResourceHeaders = document.getElementById('matrix-res-headers');

        // Modales
        this.modalTrial = document.getElementById('modal-trial');
        this.modalTrialClose = document.getElementById('modal-trial-close');
        this.trialStepsList = document.getElementById('trial-steps-list');
        this.trialResultBanner = document.getElementById('trial-result-banner');

        this.modalConfig = document.getElementById('modal-config');
        this.modalConfigClose = document.getElementById('modal-config-close');
        this.btnSaveConfig = document.getElementById('btn-save-config');
        this.configNumP = document.getElementById('config-num-p');
        this.configNumR = document.getElementById('config-num-r');
        this.configTableContainer = document.getElementById('config-table-container');
        this.configErrorBox = document.getElementById('config-error-box');

        this.modalGuide = document.getElementById('modal-guide');
        this.btnOpenGuide = document.getElementById('btn-open-guide');
        this.modalGuideClose = document.getElementById('modal-guide-close');
    }

    init() {
        this.loadScenario('aprender');
        this.attachEventListeners();
    }

    // =========================================================================
    // Temporizadores y Control de Tiempo
    // =========================================================================

    setTimeoutTracked(fn, delayMs) {
        const scaledDelay = Math.max(30, delayMs / this.speedMultiplier);
        const timeoutId = setTimeout(() => {
            const idx = this.activeTimeouts.indexOf(timeoutId);
            if (idx !== -1) this.activeTimeouts.splice(idx, 1);
            fn();
        }, scaledDelay);
        this.activeTimeouts.push(timeoutId);
        return timeoutId;
    }

    clearAllTimeouts() {
        for (const t of this.activeTimeouts) {
            clearTimeout(t);
        }
        this.activeTimeouts = [];
        for (const f of this.activeAnimationFrames) {
            cancelAnimationFrame(f);
        }
        this.activeAnimationFrames = [];
    }

    showStageToast(message, durationMs = 1800) {
        if (!this.stageToast) return;
        this.stageToast.textContent = message;
        this.stageToast.style.display = 'block';
        this.stageToast.style.opacity = '1';

        setTimeout(() => {
            this.stageToast.style.opacity = '0';
            setTimeout(() => {
                if (this.stageToast.style.opacity === '0') {
                    this.stageToast.style.display = 'none';
                }
            }, 300);
        }, durationMs / this.speedMultiplier);
    }

    // =========================================================================
    // Máquina de Estados de Control
    // =========================================================================

    setSimState(newState) {
        this.simState = newState;
        this.updateControlButtons();
    }

    updateControlButtons() {
        switch (this.simState) {
            case SIM_STATE.IDLE:
                this.btnAutoDemo.innerHTML = '▶️ Iniciar';
                this.btnAutoDemo.className = 'btn btn-primary';
                this.btnPause.innerHTML = '⏸️ Pausar';
                this.btnPause.disabled = true;
                break;
            case SIM_STATE.RUNNING:
                this.btnAutoDemo.innerHTML = '⏹️ Detener';
                this.btnAutoDemo.className = 'btn btn-warning';
                this.btnPause.innerHTML = '⏸️ Pausar';
                this.btnPause.disabled = false;
                break;
            case SIM_STATE.STOPPED:
                this.btnAutoDemo.innerHTML = '▶️ Continuar';
                this.btnAutoDemo.className = 'btn btn-primary';
                this.btnPause.innerHTML = '⏸️ Pausar';
                this.btnPause.disabled = true;
                break;
            case SIM_STATE.PAUSED:
                this.btnAutoDemo.innerHTML = '⏹️ Detener';
                this.btnAutoDemo.className = 'btn btn-warning';
                this.btnPause.innerHTML = '▶️ Reanudar';
                this.btnPause.disabled = false;
                break;
            case SIM_STATE.FINISHED:
                this.btnAutoDemo.innerHTML = '🔄 Volver a iniciar';
                this.btnAutoDemo.className = 'btn btn-success';
                this.btnPause.innerHTML = '⏸️ Pausar';
                this.btnPause.disabled = true;
                break;
        }
    }

    handleAutoDemoButton() {
        switch (this.simState) {
            case SIM_STATE.IDLE:
                this.setSimState(SIM_STATE.RUNNING);
                this.setDictamen('Demostración automática iniciada.', 'Listo');
                this.executeAutoStep();
                break;
            case SIM_STATE.RUNNING:
                this.clearAllTimeouts();
                this.setSimState(SIM_STATE.STOPPED);
                this.setDictamen('Demostración detenida. Pulsa "Continuar" para proseguir.', 'Detenido');
                break;
            case SIM_STATE.STOPPED:
                this.setSimState(SIM_STATE.RUNNING);
                this.setDictamen('Continuando demostración automática...', 'Listo');
                this.executeAutoStep();
                break;
            case SIM_STATE.PAUSED:
                this.clearAllTimeouts();
                this.setSimState(SIM_STATE.STOPPED);
                this.setDictamen('Demostración detenida desde pausa.', 'Detenido');
                break;
            case SIM_STATE.FINISHED:
                this.loadScenario(this.scenarioSelect.value === 'custom' ? 'custom' : this.scenarioSelect.value);
                this.setSimState(SIM_STATE.RUNNING);
                this.setDictamen('Reiniciando y comenzando nueva ejecución automática...', 'Listo');
                this.setTimeoutTracked(() => this.executeAutoStep(), 300);
                break;
        }
    }

    handlePauseButton() {
        if (this.simState === SIM_STATE.RUNNING) {
            this.clearAllTimeouts();
            this.setSimState(SIM_STATE.PAUSED);
            this.setDictamen('Demostración pausada. Pulsa "Reanudar" para continuar.', 'Pausa');
        } else if (this.simState === SIM_STATE.PAUSED) {
            this.setSimState(SIM_STATE.RUNNING);
            this.setDictamen('Reanudando demostración...', 'Listo');
            this.executeAutoStep();
        }
    }

    handleResetButton() {
        this.clearAllTimeouts();
        this.isAnimating = false;
        this.loadScenario(this.scenarioSelect.value === 'custom' ? 'aprender' : this.scenarioSelect.value);
        this.setSimState(SIM_STATE.IDLE);
        this.setDictamen('Escenario reiniciado al estado inicial. Pulsa "Iniciar" para comenzar.', 'Listo');
    }

    // =========================================================================
    // Carga de Escenarios
    // =========================================================================

    loadScenario(scenarioId) {
        this.clearAllTimeouts();
        this.isAnimating = false;
        this.lastEvaluation = null;
        this.selectedWorker = 0;
        this.currentScenario = scenarioId;

        const info = this.engine.loadScenario(scenarioId);
        if (scenarioId !== 'custom') {
            this.scenarioSelect.value = scenarioId;
        }

        this.setSimState(SIM_STATE.IDLE);
        this.syncUI();
        this.setDictamen(`Escenario cargado: ${info.name}. Selecciona un trabajador o pulsa "Iniciar".`, 'Listo');
    }

    setRequestInputs(values) {
        for (let j = 0; j < this.engine.numResources; j++) {
            const input = document.getElementById(`req-input-${j}`);
            if (input) {
                input.value = values[j] !== undefined ? values[j] : 0;
            }
        }
    }

    setDictamen(message, badgeText = 'Listo', badgeType = '') {
        this.decisionText.innerHTML = message;
        this.decisionBadge.textContent = badgeText;
        this.decisionBadge.className = `decision-badge-pill ${badgeType}`;
    }

    // =========================================================================
    // Coordenadas Geométricas de Mesas, Rutas y Tienda Central
    // =========================================================================

    getBenchPositions(numP, width = 1000) {
        if (numP === 1) return [500];
        if (numP === 2) return [300, 700];
        if (numP === 3) return [220, 500, 780];
        if (numP === 4) return [170, 390, 610, 830];
        return [130, 315, 500, 685, 870];
    }

    getCounterArrivalPositions(numP) {
        const spacing = numP > 3 ? 42 : 55;
        const positions = [];
        for (let i = 0; i < numP; i++) {
            positions.push(500 + (i - (numP - 1) / 2) * spacing);
        }
        return positions;
    }

    getWorkerColor(pIdx) {
        const colors = ['#38bdf8', '#34d399', '#fb923c', '#c084fc', '#22d3ee'];
        return colors[pIdx % colors.length];
    }

    // =========================================================================
    // Renderizado SVG 2D: Tienda Central, Rutas Marcadas y Mesas Fijas
    // =========================================================================

    renderScene() {
        const svg = this.svgEl;
        svg.innerHTML = '';

        const width = 1000;
        const height = 510;
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="wallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#181e2b"/>
                <stop offset="65%" stop-color="#232b3d"/>
                <stop offset="100%" stop-color="#1a202e"/>
            </linearGradient>

            <linearGradient id="floorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b2413"/>
                <stop offset="30%" stop-color="#2b1a0e"/>
                <stop offset="100%" stop-color="#1a0f08"/>
            </linearGradient>

            <linearGradient id="counterWood" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#8c4b18"/>
                <stop offset="50%" stop-color="#ab622b"/>
                <stop offset="100%" stop-color="#733b10"/>
            </linearGradient>

            <g id="icon-hammer">
                <rect x="-3" y="-12" width="6" height="26" rx="2" fill="#d97706"/>
                <rect x="-3" y="6" width="6" height="8" rx="1" fill="#78350f"/>
                <path d="M -12 -12 L 12 -12 C 14 -12, 14 -4, 12 -4 L -8 -4 L -14 -8 Z" fill="#94a3b8"/>
                <rect x="-10" y="-14" width="22" height="4" rx="1" fill="#cbd5e1"/>
            </g>

            <g id="icon-drill">
                <rect x="-10" y="-10" width="20" height="15" rx="3" fill="#0284c7"/>
                <rect x="-6" y="5" width="8" height="12" rx="2" fill="#1e293b"/>
                <rect x="10" y="-5" width="10" height="5" fill="#94a3b8"/>
                <polygon points="20,-6 26,-2.5 20,1" fill="#e2e8f0"/>
                <circle cx="-2" cy="-2" r="3" fill="#f59e0b"/>
            </g>

            <g id="icon-wrench">
                <rect x="-3" y="-10" width="6" height="24" rx="2" fill="#94a3b8" transform="rotate(25)"/>
                <circle cx="-5" cy="-10" r="7" fill="#cbd5e1"/>
                <polygon points="-7,-15 -2,-10 -9,-8" fill="#1e2430"/>
                <circle cx="5" cy="12" r="5" fill="#cbd5e1"/>
                <circle cx="5" cy="12" r="2.5" fill="#1e2430"/>
            </g>
        `;
        svg.appendChild(defs);

        // 1. Fondo de Muros y Lámparas
        const bgWall = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgWall.setAttribute('width', width);
        bgWall.setAttribute('height', height * 0.72);
        bgWall.setAttribute('fill', 'url(#wallGradient)');
        svg.appendChild(bgWall);

        this.drawWallLamps(svg, width, height);

        // 2. Piso de Madera con Perspectiva
        const floor = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        floor.setAttribute('points', `0,${height * 0.65} ${width},${height * 0.65} ${width},${height} 0,${height}`);
        floor.setAttribute('fill', 'url(#floorGradient)');
        svg.appendChild(floor);

        for (let x = 70; x < width; x += 110) {
            const plank = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            plank.setAttribute('x1', x);
            plank.setAttribute('y1', height * 0.65);
            plank.setAttribute('x2', x - 40);
            plank.setAttribute('y2', height);
            plank.setAttribute('stroke', '#190f07');
            plank.setAttribute('stroke-width', '2');
            svg.appendChild(plank);
        }

        // 3. CAPA DE RUTAS FIJAS MARCADAS EN EL SUELO (Conectan cada puesto con la tienda central)
        const pathsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pathsLayer.setAttribute('id', 'floor-paths-layer');
        this.drawFloorRoutes(pathsLayer, width);
        svg.appendChild(pathsLayer);

        // 4. TIENDA / ALMACÉN CENTRAL DEL BANQUERO (Único punto central de entrega y devolución)
        this.drawCentralStore(svg);

        // 5. CAPA FIJA DE MESAS DE TRABAJO (100% inmóviles con cartel superior de profesión)
        const benchesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        benchesLayer.setAttribute('id', 'workbenches-layer');
        this.drawFixedWorkbenches(benchesLayer, width);
        svg.appendChild(benchesLayer);

        // 6. CAPA MÓVIL DE TRABAJADORES (Se mueven únicamente a lo largo de su ruta marcada)
        const workersLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        workersLayer.setAttribute('id', 'workers-layer');
        this.drawWorkerCharacters(workersLayer, width);
        svg.appendChild(workersLayer);

        // 7. Capa de Efectos (Chispas)
        const effectsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        effectsLayer.setAttribute('id', 'effects-layer');
        svg.appendChild(effectsLayer);
    }

    drawWallLamps(svg, width, height) {
        const lampX = [180, 500, 820];
        lampX.forEach(x => {
            const wire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            wire.setAttribute('x1', x);
            wire.setAttribute('y1', 0);
            wire.setAttribute('x2', x);
            wire.setAttribute('y2', 26);
            wire.setAttribute('stroke', '#475569');
            wire.setAttribute('stroke-width', '2');
            svg.appendChild(wire);

            const lamp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lamp.setAttribute('d', `M ${x - 16} 34 L ${x + 16} 34 L ${x + 8} 26 L ${x - 8} 26 Z`);
            lamp.setAttribute('fill', '#334155');
            svg.appendChild(lamp);

            const bulb = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bulb.setAttribute('cx', x);
            bulb.setAttribute('cy', 36);
            bulb.setAttribute('r', '4');
            bulb.setAttribute('fill', '#fef08a');
            svg.appendChild(bulb);

            const cone = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            cone.setAttribute('points', `${x - 10},36 ${x + 10},36 ${x + 80},280 ${x - 80},280`);
            cone.setAttribute('fill', 'rgba(254, 240, 138, 0.025)');
            svg.appendChild(cone);
        });
    }

    /**
     * Dibuja las rutas fijas y visibles en el suelo para cada trabajador.
     * Conectan la mesa de cada trabajador directamente con la ventanilla central del Almacén.
     * Ninguna ruta atraviesa la mesa de otro trabajador ni se sale de la pantalla.
     */
    drawFloorRoutes(layer, width) {
        const numP = this.engine.numProcesses;
        const benchX = this.getBenchPositions(numP, width);
        const counterX = this.getCounterArrivalPositions(numP);

        for (let i = 0; i < numP; i++) {
            const startX = benchX[i];
            const startY = 455;  // Frente a la mesa (mesas en y=410), abajo de ellas
            const endX = 500;    // Centro real del almacén
            const endY = 165;    // Mostrador visible del almacén (translate(500,115) + local y=50)
            const color = this.getWorkerColor(i);

            const routeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            routeGroup.setAttribute('id', `floor-route-p${i}`);

            // 1. Franja suave de pasillo en el piso
            const corridor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            corridor.setAttribute('x1', startX);
            corridor.setAttribute('y1', startY);
            corridor.setAttribute('x2', endX);
            corridor.setAttribute('y2', endY);
            corridor.setAttribute('stroke', 'rgba(255, 255, 255, 0.06)');
            corridor.setAttribute('stroke-width', '24');
            corridor.setAttribute('stroke-linecap', 'round');
            routeGroup.appendChild(corridor);

            // 2. Línea guía punteada con el color del trabajador
            const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            guideLine.setAttribute('x1', startX);
            guideLine.setAttribute('y1', startY);
            guideLine.setAttribute('x2', endX);
            guideLine.setAttribute('y2', endY);
            guideLine.setAttribute('stroke', color);
            guideLine.setAttribute('stroke-width', '2.5');
            guideLine.setAttribute('stroke-dasharray', '6 6');
            guideLine.setAttribute('opacity', '0.75');
            routeGroup.appendChild(guideLine);

            // 3. Marcador en la salida de la mesa
            const markerStart = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            markerStart.setAttribute('cx', startX);
            markerStart.setAttribute('cy', startY);
            markerStart.setAttribute('r', '5');
            markerStart.setAttribute('fill', color);
            markerStart.setAttribute('stroke', '#0f172a');
            markerStart.setAttribute('stroke-width', '1.5');
            routeGroup.appendChild(markerStart);

            // 4. Marcador en la llegada a la tienda central
            const markerEnd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            markerEnd.setAttribute('cx', endX);
            markerEnd.setAttribute('cy', endY);
            markerEnd.setAttribute('r', '4');
            markerEnd.setAttribute('fill', color);
            markerEnd.setAttribute('stroke', '#0f172a');
            markerEnd.setAttribute('stroke-width', '1.5');
            routeGroup.appendChild(markerEnd);

            // 5. Etiqueta discreta de la ruta en el suelo
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const textTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textTag.setAttribute('x', midX);
            textTag.setAttribute('y', midY);
            textTag.setAttribute('text-anchor', 'middle');
            textTag.setAttribute('fill', color);
            textTag.setAttribute('font-size', '8');
            textTag.setAttribute('font-weight', '700');
            textTag.setAttribute('opacity', '0.8');
            textTag.textContent = `P${i}`;
            routeGroup.appendChild(textTag);

            layer.appendChild(routeGroup);
        }
    }

    /**
     * Tienda / Almacén Central del Banquero.
     * Situada en el centro superior (X = 500, Y = 60..195), claramente visible y unificada.
     * Don Ramón atiende en la ventanilla central y las herramientas libres están visibles en su estante.
     */
    drawCentralStore(svg) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('id', 'central-store-building');
        group.setAttribute('transform', 'translate(500, 115)');

        const numR = this.engine.numResources;
        const avail = this.engine.getAvailable();
        const total = this.engine.total;

        // Estructura de la tienda central
        const storeWidth = 460;
        const storeX = -storeWidth / 2;

        // Tejado / Toldo artesanal
        const awning = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        awning.setAttribute('d', `M ${storeX - 15} -70 L ${storeX + storeWidth + 15} -70 L ${storeX + storeWidth + 25} -45 L ${storeX - 25} -45 Z`);
        awning.setAttribute('fill', '#d97706');
        awning.setAttribute('stroke', '#78350f');
        awning.setAttribute('stroke-width', '2');
        group.appendChild(awning);

        // Cartel de la Tienda Central
        const sign = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        sign.setAttribute('x', storeX);
        sign.setAttribute('y', '-45');
        sign.setAttribute('width', storeWidth);
        sign.setAttribute('height', '20');
        sign.setAttribute('rx', '3');
        sign.setAttribute('fill', '#1e293b');
        sign.setAttribute('stroke', '#f59e0b');
        sign.setAttribute('stroke-width', '1.5');
        group.appendChild(sign);

        const signText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        signText.setAttribute('x', '0');
        signText.setAttribute('y', '-31');
        signText.setAttribute('text-anchor', 'middle');
        signText.setAttribute('fill', '#fde68a');
        signText.setAttribute('font-size', '11');
        signText.setAttribute('font-weight', '700');
        signText.setAttribute('letter-spacing', '1.5');
        signText.textContent = 'ALMACÉN CENTRAL • DON RAMÓN (EL BANQUERO)';
        group.appendChild(signText);

        // Fachada interior de la tienda
        const storeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        storeBg.setAttribute('x', storeX);
        storeBg.setAttribute('y', '-22');
        storeBg.setAttribute('width', storeWidth);
        storeBg.setAttribute('height', '95');
        storeBg.setAttribute('fill', '#0f172a');
        storeBg.setAttribute('stroke', '#334155');
        storeBg.setAttribute('stroke-width', '2');
        storeBg.setAttribute('rx', '4');
        group.appendChild(storeBg);

        // ESTANTE DE HERRAMIENTAS LIBRES EN LA TIENDA (A la izquierda / centro)
        const shelfWidth = 260;
        const shelfX = storeX + 16;
        const binW = (shelfWidth - (numR - 1) * 8) / numR;

        for (let j = 0; j < numR; j++) {
            const bx = shelfX + j * (binW + 8);
            const iconId = j === 0 ? '#icon-hammer' : j === 1 ? '#icon-drill' : '#icon-wrench';

            const bin = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bin.setAttribute('x', bx);
            bin.setAttribute('y', '-14');
            bin.setAttribute('width', binW);
            bin.setAttribute('height', '60');
            bin.setAttribute('rx', '3');
            bin.setAttribute('fill', '#1e293b');
            bin.setAttribute('stroke', '#475569');
            group.appendChild(bin);

            const iconRef = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            iconRef.setAttribute('href', iconId);
            iconRef.setAttribute('x', bx + 16);
            iconRef.setAttribute('y', '6');
            group.appendChild(iconRef);

            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.setAttribute('x', bx + binW - 22);
            countText.setAttribute('y', '12');
            countText.setAttribute('text-anchor', 'middle');
            countText.setAttribute('fill', '#38bdf8');
            countText.setAttribute('font-size', '14');
            countText.setAttribute('font-weight', '800');
            countText.textContent = `x${avail[j]}`;
            group.appendChild(countText);

            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', bx + binW / 2);
            nameText.setAttribute('y', '32');
            nameText.setAttribute('text-anchor', 'middle');
            nameText.setAttribute('fill', '#94a3b8');
            nameText.setAttribute('font-size', '8.5');
            nameText.setAttribute('font-weight', '600');
            nameText.textContent = this.engine.resourceNames[j];
            group.appendChild(nameText);

            const totalText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            totalText.setAttribute('x', bx + binW / 2);
            totalText.setAttribute('y', '42');
            totalText.setAttribute('text-anchor', 'middle');
            totalText.setAttribute('fill', '#64748b');
            totalText.setAttribute('font-size', '7.5');
            totalText.textContent = `Total: ${total[j]}`;
            group.appendChild(totalText);
        }

        // PERSONAJE: Don Ramón (El Banquero) tras la ventanilla de atención (En el centro-derecha de la tienda)
        const bankerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        bankerGroup.setAttribute('id', 'banker-character');
        bankerGroup.setAttribute('transform', 'translate(135, 14)');
        bankerGroup.innerHTML = `
            <rect x="-18" y="2" width="36" height="30" rx="6" fill="#1e3a8a"/>
            <polygon points="-3,10 3,10 0,22" fill="#dc2626"/>
            
            <circle cx="0" cy="-8" r="14" fill="#fbcfe8"/>
            <path d="M -7 -3 Q 0 1 7 -3 Q 0 -3 -7 -3" fill="#475569"/>
            <rect x="-9" y="-12" width="7" height="5" rx="1" fill="none" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="2" y="-12" width="7" height="5" rx="1" fill="none" stroke="#0f172a" stroke-width="1.5"/>
            <line x1="-2" y1="-9" x2="2" y2="-9" stroke="#0f172a" stroke-width="1.5"/>
            
            <path d="M -15 -10 C -15 -24 15 -24 15 -10 Z" fill="#f8fafc"/>
            <rect x="-17" y="-10" width="34" height="3" rx="1" fill="#cbd5e1"/>
            <rect x="-4" y="-22" width="8" height="10" fill="#f59e0b"/>
            
            <rect x="-14" y="20" width="28" height="15" rx="2" fill="#047857"/>
            <line x1="-10" y1="26" x2="10" y2="26" stroke="#a7f3d0" stroke-width="1"/>
        `;
        group.appendChild(bankerGroup);

        // Mostrador frontal amplio de la tienda central
        const counter = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        counter.setAttribute('x', storeX - 5);
        counter.setAttribute('y', '50');
        counter.setAttribute('width', storeWidth + 10);
        counter.setAttribute('height', '26');
        counter.setAttribute('rx', '4');
        counter.setAttribute('fill', 'url(#counterWood)');
        counter.setAttribute('stroke', '#451a03');
        counter.setAttribute('stroke-width', '2');
        group.appendChild(counter);

        const counterBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        counterBase.setAttribute('x', storeX);
        counterBase.setAttribute('y', '76');
        counterBase.setAttribute('width', storeWidth);
        counterBase.setAttribute('height', '10');
        counterBase.setAttribute('rx', '2');
        counterBase.setAttribute('fill', '#5c2b09');
        group.appendChild(counterBase);

        const counterLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        counterLabel.setAttribute('x', '0');
        counterLabel.setAttribute('y', '67');
        counterLabel.setAttribute('text-anchor', 'middle');
        counterLabel.setAttribute('fill', '#fde68a');
        counterLabel.setAttribute('font-size', '9');
        counterLabel.setAttribute('font-weight', '700');
        counterLabel.textContent = 'MOSTRADOR CENTRAL DE ENTREGA Y DEVOLUCIÓN';
        group.appendChild(counterLabel);

        svg.appendChild(group);
    }

    /**
     * Dibuja las MESAS FIJAS con cartel de profesión ARRIBA de cada mesa.
     */
    drawFixedWorkbenches(layer, width) {
        const numP = this.engine.numProcesses;
        const positions = this.getBenchPositions(numP, width);
        const roles = ['Carpintero', 'Mecánico', 'Herrero', 'Electricista', 'Tornero'];

        for (let i = 0; i < numP; i++) {
            const x = positions[i];
            const y = 410;

            const benchGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            benchGroup.setAttribute('id', `fixed-bench-p${i}`);
            benchGroup.setAttribute('transform', `translate(${x}, ${y})`);

            // Sombra en el suelo
            const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            shadow.setAttribute('cx', '0');
            shadow.setAttribute('cy', '45');
            shadow.setAttribute('rx', '62');
            shadow.setAttribute('ry', '16');
            shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.45)');
            benchGroup.appendChild(shadow);

            // =================================================================
            // CARTEL DE PROFESIÓN ARRIBA DE CADA MESA RESPECTIVA
            // =================================================================
            const signAbove = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            signAbove.innerHTML = `
                <line x1="-46" y1="-20" x2="-46" y2="-65" stroke="#475569" stroke-width="2.5"/>
                <line x1="46" y1="-20" x2="46" y2="-65" stroke="#475569" stroke-width="2.5"/>
                <circle cx="-46" cy="-65" r="3" fill="#f59e0b"/>
                <circle cx="46" cy="-65" r="3" fill="#f59e0b"/>

                <rect x="-62" y="-80" width="124" height="22" rx="4" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
                <rect x="-59" y="-77" width="118" height="16" rx="2" fill="#1e293b"/>
                <text x="0" y="-65" text-anchor="middle" fill="#fde68a" font-size="10" font-weight="800" letter-spacing="0.8">
                    P${i} • ${roles[i % roles.length].toUpperCase()}
                </text>
            `;
            benchGroup.appendChild(signAbove);

            // Patas de la mesa
            const legs = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            legs.innerHTML = `
                <rect x="-50" y="0" width="9" height="44" fill="#5c2b09" stroke="#2e1402" stroke-width="1.5"/>
                <rect x="41" y="0" width="9" height="44" fill="#5c2b09" stroke="#2e1402" stroke-width="1.5"/>
                <line x1="-46" y1="22" x2="46" y2="22" stroke="#451a03" stroke-width="4"/>
            `;
            benchGroup.appendChild(legs);

            // Tablón de la mesa
            const topBoard = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            topBoard.setAttribute('x', '-58');
            topBoard.setAttribute('y', '-16');
            topBoard.setAttribute('width', '116');
            topBoard.setAttribute('height', '18');
            topBoard.setAttribute('rx', '3');
            topBoard.setAttribute('fill', '#a0522d');
            topBoard.setAttribute('stroke', '#5c2b09');
            topBoard.setAttribute('stroke-width', '2');
            benchGroup.appendChild(topBoard);

            // Tornillo de banco
            const vice = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            vice.innerHTML = `
                <rect x="-56" y="-26" width="12" height="11" fill="#64748b" rx="2"/>
                <circle cx="-50" cy="-21" r="2.5" fill="#94a3b8"/>
            `;
            benchGroup.appendChild(vice);

            // Indicadores de Herramientas sobre la mesa
            const toolsRack = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            toolsRack.setAttribute('id', `bench-tools-p${i}`);
            toolsRack.setAttribute('transform', 'translate(0, -25)');

            const resStep = 32;
            const startX = -((this.engine.numResources - 1) * resStep) / 2;

            for (let j = 0; j < this.engine.numResources; j++) {
                const rx = startX + j * resStep;
                const allocVal = this.engine.allocated[i][j];
                const maxVal = this.engine.max[i][j];

                const badge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                badge.setAttribute('transform', `translate(${rx}, 0)`);
                badge.innerHTML = `
                    <rect x="-14" y="-10" width="28" height="18" rx="3" fill="#0f172a" stroke="${allocVal > 0 ? '#38bdf8' : '#334155'}" stroke-width="1"/>
                    <text x="0" y="0" text-anchor="middle" fill="${allocVal > 0 ? '#38bdf8' : '#94a3b8'}" font-size="8.5" font-weight="700">
                        ${this.engine.resourceShortNames[j]}:${allocVal}
                    </text>
                    <text x="0" y="7" text-anchor="middle" fill="#64748b" font-size="7" font-weight="600">
                        /${maxVal}
                    </text>
                `;
                toolsRack.appendChild(badge);
            }
            benchGroup.appendChild(toolsRack);

            layer.appendChild(benchGroup);
        }
    }

    /**
     * Dibuja los personajes trabajadores con capacidad de girarse.
     */
    drawWorkerCharacters(layer, width) {
        const numP = this.engine.numProcesses;
        const positions = this.getBenchPositions(numP, width);

        for (let i = 0; i < numP; i++) {
            const x = positions[i];
            const y = 455; // De pie FRENTE a su mesa (mesas fijas en y=410), sin taparlas

            const isSelected = this.selectedWorker === i;
            const isFinished = this.engine.finished[i];
            const hasGatheredAll = this.engine.hasGatheredMax(i);

            const walkerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            walkerGroup.setAttribute('id', `worker-walker-p${i}`);
            walkerGroup.setAttribute('class', `worker-walker-group ${isSelected ? 'selected' : ''}`);
            walkerGroup.setAttribute('transform', `translate(${x}, ${y})`);
            walkerGroup.onclick = () => this.selectWorker(i);

            // Anillo de selección
            if (isSelected) {
                const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                ring.setAttribute('cx', '0');
                ring.setAttribute('cy', '25');
                ring.setAttribute('rx', '34');
                ring.setAttribute('ry', '11');
                ring.setAttribute('fill', 'rgba(245, 158, 11, 0.25)');
                ring.setAttribute('stroke', '#f59e0b');
                ring.setAttribute('stroke-width', '2');
                ring.setAttribute('stroke-dasharray', '5 3');
                walkerGroup.appendChild(ring);
            }

            const charShadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            charShadow.setAttribute('cx', '0');
            charShadow.setAttribute('cy', '24');
            charShadow.setAttribute('rx', '18');
            charShadow.setAttribute('ry', '6');
            charShadow.setAttribute('fill', 'rgba(0, 0, 0, 0.4)');
            walkerGroup.appendChild(charShadow);

            const charContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            charContainer.setAttribute('id', `worker-char-body-${i}`);
            charContainer.innerHTML = this.createWorkerSVG(i, isFinished, hasGatheredAll);
            walkerGroup.appendChild(charContainer);

            // Caja de herramientas en las manos
            const carriedTools = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            carriedTools.setAttribute('id', `carried-tools-p${i}`);
            carriedTools.setAttribute('style', 'display: none;');
            carriedTools.setAttribute('transform', 'translate(0, -6)');
            carriedTools.innerHTML = `
                <rect x="-14" y="0" width="28" height="14" rx="3" fill="#d97706" stroke="#78350f" stroke-width="1.5"/>
                <line x1="-10" y1="0" x2="0" y2="-6" stroke="#92400e" stroke-width="1.5"/>
                <line x1="10" y1="0" x2="0" y2="-6" stroke="#92400e" stroke-width="1.5"/>
                <text x="0" y="10" text-anchor="middle" fill="#fff" font-size="9" font-weight="800">🧰</text>
            `;
            walkerGroup.appendChild(carriedTools);

            // Insignia de estado
            const statusTag = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            statusTag.setAttribute('id', `worker-tag-p${i}`);
            statusTag.setAttribute('transform', 'translate(0, -56)');

            let tagBg = '#334155';
            let tagText = 'En espera';
            let tagIcon = '⏳';

            if (isFinished) {
                tagBg = '#059669';
                tagText = 'Terminado';
                tagIcon = '✅';
            } else if (hasGatheredAll) {
                tagBg = '#d97706';
                tagText = 'Listo p/ terminar';
                tagIcon = '⚡';
            } else if (this.engine.allocated[i].some(v => v > 0)) {
                tagBg = '#0284c7';
                tagText = 'Con herramientas';
                tagIcon = '🔨';
            }

            statusTag.innerHTML = `
                <rect x="-42" y="-9" width="84" height="18" rx="9" fill="${tagBg}" stroke="#ffffff" stroke-width="1" opacity="0.95"/>
                <text x="0" y="3" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="700">
                    ${tagIcon} ${tagText}
                </text>
            `;
            walkerGroup.appendChild(statusTag);

            layer.appendChild(walkerGroup);
        }
    }

    createWorkerSVG(pIdx, isFinished, hasGatheredAll) {
        const shirtColors = ['#1d4ed8', '#15803d', '#ea580c', '#7e22ce', '#0891b2'];
        const shirtColor = shirtColors[pIdx % shirtColors.length];

        return `
            <!-- VISTA FRONTAL -->
            <g id="worker-front-${pIdx}">
                <rect class="worker-leg-left" x="-9" y="3" width="6" height="19" rx="2" fill="#1e293b"/>
                <rect class="worker-leg-right" x="3" y="3" width="6" height="19" rx="2" fill="#1e293b"/>
                <rect x="-11" y="18" width="9" height="6" rx="2" fill="#78350f"/>
                <rect x="2" y="18" width="9" height="6" rx="2" fill="#78350f"/>

                <rect x="-12" y="-18" width="24" height="24" rx="4" fill="${shirtColor}"/>
                <line x1="-7" y1="-18" x2="-7" y2="4" stroke="#0f172a" stroke-width="2"/>
                <line x1="7" y1="-18" x2="7" y2="4" stroke="#0f172a" stroke-width="2"/>
                <rect x="-5" y="-10" width="10" height="9" rx="2" fill="#0f172a"/>
                
                <g class="worker-arm-left" transform="translate(-13, -16)">
                    <rect x="-4" y="0" width="5" height="16" rx="2.5" fill="${shirtColor}"/>
                    <circle cx="-1.5" cy="16" r="3" fill="#fbcfe8"/>
                </g>

                <g id="worker-arm-p${pIdx}" class="worker-arm-right" transform="translate(13, -16)">
                    <rect x="-1" y="0" width="5" height="16" rx="2.5" fill="${shirtColor}"/>
                    <circle cx="1.5" cy="16" r="3" fill="#fbcfe8"/>
                </g>

                <circle cx="0" cy="-28" r="11" fill="#fbcfe8"/>
                <circle cx="-3.5" cy="-29" r="1.5" fill="#1e293b"/>
                <circle cx="3.5" cy="-29" r="1.5" fill="#1e293b"/>
                ${isFinished
                ? '<path d="M -3 -24 Q 0 -21 3 -24" stroke="#047857" stroke-width="1.8" fill="none"/>'
                : hasGatheredAll
                    ? '<circle cx="0" cy="-23" r="2" fill="#ea580c"/>'
                    : '<line x1="-3" y1="-24" x2="3" y2="-24" stroke="#334155" stroke-width="1.5"/>'
            }

                <path d="M -13 -30 C -13 -42 13 -42 13 -30 Z" fill="#eab308"/>
                <rect x="-15" y="-30" width="30" height="3" rx="1.5" fill="#ca8a04"/>
                <rect x="-3" y="-39" width="6" height="8" fill="#fef08a"/>
            </g>

            <!-- VISTA DE ESPALDA (Para trabajar hacia su mesa) -->
            <g id="worker-back-${pIdx}" style="display: none;">
                <rect x="-9" y="3" width="6" height="19" rx="2" fill="#1e293b"/>
                <rect x="3" y="3" width="6" height="19" rx="2" fill="#1e293b"/>
                <rect x="-11" y="18" width="9" height="6" rx="2" fill="#582508"/>
                <rect x="2" y="18" width="9" height="6" rx="2" fill="#582508"/>

                <rect x="-12" y="-18" width="24" height="24" rx="4" fill="${shirtColor}"/>
                <line x1="-8" y1="-18" x2="8" y2="4" stroke="#0f172a" stroke-width="2.5"/>
                <line x1="8" y1="-18" x2="-8" y2="4" stroke="#0f172a" stroke-width="2.5"/>

                <g transform="translate(-13, -16) rotate(-25)">
                    <rect x="-3" y="0" width="5" height="18" rx="2.5" fill="${shirtColor}"/>
                    <rect x="-5" y="14" width="8" height="8" rx="2" fill="#94a3b8"/>
                </g>
                <g id="worker-back-arm-${pIdx}" class="is-working-arm" transform="translate(13, -16) rotate(25)">
                    <rect x="-2" y="0" width="5" height="18" rx="2.5" fill="${shirtColor}"/>
                    <rect x="-3" y="14" width="4" height="12" fill="#d97706"/>
                    <rect x="-8" y="22" width="14" height="6" rx="1" fill="#cbd5e1"/>
                </g>

                <circle cx="0" cy="-28" r="11" fill="#ca8a04"/>
                <path d="M -13 -28 C -13 -42 13 -42 13 -28 Z" fill="#eab308"/>
                <rect x="-14" y="-28" width="28" height="3" rx="1.5" fill="#a16207"/>
                <rect x="-8" y="-36" width="16" height="4" fill="#fef08a" rx="1"/>
            </g>
        `;
    }

    // =========================================================================
    // Sincronización de UI y Tablas
    // =========================================================================

    syncUI() {
        this.renderScene();
        this.updateStatusBadges();
        this.renderWorkerTabs();
        this.renderSelectedWorkerPanel();
        this.renderWarehouseInventory();
        this.renderMatricesTable();
    }

    /**
     * Actualiza únicamente los badges de herramientas sobre las mesas (elementos SVG existentes)
     * SIN reconstruir la escena completa. Esto preserva el elemento walkerGroup activo
     * para que la animación de caminar no se interrumpa.
     */
    updateBenchToolBadges() {
        for (let i = 0; i < this.engine.numProcesses; i++) {
            const toolsRack = document.getElementById(`bench-tools-p${i}`);
            if (!toolsRack) continue;
            toolsRack.innerHTML = '';

            const resStep = 32;
            const startX = -((this.engine.numResources - 1) * resStep) / 2;

            for (let j = 0; j < this.engine.numResources; j++) {
                const rx = startX + j * resStep;
                const allocVal = this.engine.allocated[i][j];
                const maxVal = this.engine.max[i][j];

                const ns = 'http://www.w3.org/2000/svg';
                const badge = document.createElementNS(ns, 'g');
                badge.setAttribute('transform', `translate(${rx}, 0)`);
                badge.innerHTML = `
                    <rect x="-14" y="-10" width="28" height="18" rx="3" fill="#0f172a" stroke="${allocVal > 0 ? '#38bdf8' : '#334155'}" stroke-width="1"/>
                    <text x="0" y="0" text-anchor="middle" fill="${allocVal > 0 ? '#38bdf8' : '#94a3b8'}" font-size="8.5" font-weight="700">
                        ${this.engine.resourceShortNames[j]}:${allocVal}
                    </text>
                    <text x="0" y="7" text-anchor="middle" fill="#64748b" font-size="7" font-weight="600">
                        /${maxVal}
                    </text>
                `;
                toolsRack.appendChild(badge);
            }

            // Actualizar también el almacén central en el SVG
            const store = document.getElementById('central-store-building');
            if (store) {
                // Actualizar contadores de disponible en la tienda
                const avail = this.engine.getAvailable();
                const countTexts = store.querySelectorAll('text[fill="#38bdf8"]');
                countTexts.forEach((el, j) => {
                    if (j < avail.length) el.textContent = `x${avail[j]}`;
                });
            }
        }
    }


    updateStatusBadges() {
        const avail = this.engine.getAvailable();
        const safety = this.engine.runSafetyCheck(
            avail,
            this.engine.allocated,
            this.engine.getNeedMatrix(),
            this.engine.finished
        );

        if (safety.isSafe) {
            this.statusBadge.className = 'status-badge safe';
            this.statusBadgeText.textContent = `ESTADO SEGURO (Secuencia: <${safety.safeSequence.map(p => 'P' + p).join(', ')}>)`;
            this.calcStatePill.className = 'status-badge safe';
            this.calcStatePill.textContent = 'SEGURO';
            this.calcSequenceText.textContent = `<${safety.safeSequence.map(p => 'P' + p).join(', ')}>`;
        } else {
            this.statusBadge.className = 'status-badge unsafe';
            this.statusBadgeText.textContent = `ESTADO INSEGURO`;
            this.calcStatePill.className = 'status-badge unsafe';
            this.calcStatePill.textContent = 'INSEGURO';
            this.calcSequenceText.textContent = 'Sin secuencia segura';
        }

        const cons = this.engine.checkConservation();
        this.conservationBadgeText.textContent = cons.valid
            ? `Conservación: 100% Correcta`
            : `Alerta: Recursos alterados`;
    }

    renderWorkerTabs() {
        this.workerTabsContainer.innerHTML = '';
        for (let i = 0; i < this.engine.numProcesses; i++) {
            const btn = document.createElement('button');
            btn.className = `worker-tab-btn ${this.selectedWorker === i ? 'active' : ''}`;
            const isFin = this.engine.finished[i];
            btn.innerHTML = `${isFin ? '✅' : '👷'} P${i}`;
            btn.onclick = () => this.selectWorker(i);
            this.workerTabsContainer.appendChild(btn);
        }
    }

    selectWorker(idx) {
        if (this.isAnimating) return;
        this.selectedWorker = idx;
        this.lastEvaluation = null;
        this.syncUI();
    }

    renderSelectedWorkerPanel() {
        const p = this.selectedWorker;
        const isFin = this.engine.finished[p];
        const need = this.engine.getNeedMatrix()[p];
        const alloc = this.engine.allocated[p];
        const max = this.engine.max[p];
        const hasAll = this.engine.hasGatheredMax(p);

        this.workerNameTitle.textContent = `Trabajador P${p} ${isFin ? '(Terminado)' : ''}`;
        this.metricAlloc.textContent = `[${alloc.join(', ')}]`;
        this.metricMax.textContent = `[${max.join(', ')}]`;
        this.metricNeed.textContent = `[${need.join(', ')}]`;

        this.resourceInputsContainer.innerHTML = '';
        const avail = this.engine.getAvailable();

        for (let j = 0; j < this.engine.numResources; j++) {
            const card = document.createElement('div');
            card.className = 'resource-input-card';
            card.innerHTML = `
                <div class="resource-card-label">
                    <span>${this.engine.resourceIcons[j]}</span>
                    <span>${this.engine.resourceNames[j]}</span>
                </div>
                <div class="stepper-control">
                    <button class="stepper-btn" onclick="app.stepInput(${j}, -1)" ${isFin ? 'disabled' : ''}>-</button>
                    <input type="number" id="req-input-${j}" class="resource-number-input" value="0" min="0" max="${need[j]}" ${isFin ? 'disabled' : ''}>
                    <button class="stepper-btn" onclick="app.stepInput(${j}, 1)" ${isFin ? 'disabled' : ''}>+</button>
                </div>
                <div class="resource-limits-hint">
                    <span>Necesita: ${need[j]}</span>
                    <span>Libre: ${avail[j]}</span>
                </div>
            `;
            this.resourceInputsContainer.appendChild(card);
        }

        this.btnEvaluate.disabled = isFin || this.isAnimating;
        this.btnApplyLoan.disabled = true;
        this.btnWorkFinish.disabled = !hasAll || isFin || this.isAnimating;
        this.btnViewTrial.disabled = !this.lastEvaluation || !this.lastEvaluation.safetyTrial;

        if (!this.lastEvaluation) {
            if (isFin) {
                this.setDictamen(`P${p} ya concluyó su labor y devolvió todas sus herramientas a la tienda.`, 'Terminado', 'approved');
            } else if (hasAll) {
                this.setDictamen(`¡P${p} ya reunió su máximo declarado! Pulsa "Trabajar y Terminar".`, 'Listo', 'approved');
            } else {
                this.setDictamen(`Ingresa cuántas herramientas solicita P${p} y pulsa "Evaluar Solicitud".`, 'Pendiente');
            }
        }
    }

    stepInput(resourceIdx, delta) {
        const input = document.getElementById(`req-input-${resourceIdx}`);
        if (!input) return;
        const need = this.engine.getNeedMatrix()[this.selectedWorker][resourceIdx];
        let val = parseInt(input.value, 10) || 0;
        val = Math.max(0, Math.min(need, val + delta));
        input.value = val;
    }

    renderWarehouseInventory() {
        this.warehouseInvContainer.innerHTML = '';
        const avail = this.engine.getAvailable();

        for (let j = 0; j < this.engine.numResources; j++) {
            let sumAlloc = 0;
            for (let i = 0; i < this.engine.numProcesses; i++) {
                sumAlloc += this.engine.allocated[i][j];
            }

            const item = document.createElement('div');
            item.className = 'inv-item';
            item.innerHTML = `
                <div class="inv-icon">${this.engine.resourceIcons[j]}</div>
                <div class="inv-data">
                    <span class="inv-name">${this.engine.resourceNames[j]}</span>
                    <span class="inv-counts">Libres: <span>${avail[j]}</span> / Total: ${this.engine.total[j]}</span>
                    <span style="font-size: 0.68rem; color: var(--text-dim);">Asignados: ${sumAlloc}</span>
                </div>
            `;
            this.warehouseInvContainer.appendChild(item);
        }
    }

    renderMatricesTable() {
        const numR = this.engine.numResources;
        const avail = this.engine.getAvailable();
        const needMatrix = this.engine.getNeedMatrix();

        this.matrixResourceHeaders.innerHTML = `
            <th>Proceso</th>
            <th colspan="${numR}">Asignado (C)</th>
            <th colspan="${numR}">Máximo (M)</th>
            <th colspan="${numR}">Necesidad (N = M - C)</th>
            <th>Estado</th>
        `;

        this.matrixTableBody.innerHTML = '';
        for (let i = 0; i < this.engine.numProcesses; i++) {
            const tr = document.createElement('tr');
            if (this.engine.finished[i]) tr.className = 'finished-row';

            let allocCells = '';
            let maxCells = '';
            let needCells = '';

            for (let j = 0; j < numR; j++) {
                allocCells += `<td><strong>${this.engine.allocated[i][j]}</strong></td>`;
                maxCells += `<td>${this.engine.max[i][j]}</td>`;
                needCells += `<td><strong>${needMatrix[i][j]}</strong></td>`;
            }

            const statusText = this.engine.finished[i]
                ? '<span style="color: #34d399; font-weight: 700;">Terminado</span>'
                : this.engine.hasGatheredMax(i)
                    ? '<span style="color: #fbbf24; font-weight: 700;">Listo p/ Terminar</span>'
                    : '<span style="color: #94a3b8;">Activo</span>';

            tr.innerHTML = `
                <td><strong>P${i}</strong></td>
                ${allocCells}
                ${maxCells}
                ${needCells}
                <td>${statusText}</td>
            `;
            this.matrixTableBody.appendChild(tr);
        }

        let dispCells = '';
        let totCells = '';
        for (let j = 0; j < numR; j++) {
            dispCells += `<td><span style="color: var(--primary); font-size: 1.05rem;">${avail[j]}</span></td>`;
            totCells += `<td>${this.engine.total[j]}</td>`;
        }

        this.matrixTableFoot.innerHTML = `
            <tr>
                <td><strong>DISPONIBLE (A)</strong></td>
                <td colspan="${numR * 3}">${dispCells}</td>
                <td><strong>Total: [${this.engine.total.join(', ')}]</strong></td>
            </tr>
        `;
    }

    evaluateCurrentRequest() {
        if (this.isAnimating) return;
        const p = this.selectedWorker;
        const req = [];

        for (let j = 0; j < this.engine.numResources; j++) {
            const input = document.getElementById(`req-input-${j}`);
            const val = parseInt(input ? input.value : 0, 10);
            if (isNaN(val) || val < 0) {
                alert('Ingresa cantidades enteras no negativas.');
                return;
            }
            req.push(val);
        }

        if (req.every(v => v === 0)) {
            alert('Ingresa al menos 1 herramienta para solicitar.');
            return;
        }

        this.pendingRequest = req;
        const result = this.engine.evaluateRequest(p, req);
        this.lastEvaluation = result;
        this.btnViewTrial.disabled = !result.safetyTrial;

        if (result.status === 'approved') {
            this.sound.approve();
            this.btnApplyLoan.disabled = false;
            this.setDictamen(
                `<strong>¡Préstamo Aprobado!</strong> ${result.message} <br>Pulsa "Aplicar Préstamo" para que P${p} camine por su ruta hacia la tienda central a recoger sus herramientas.`,
                'Aprobado',
                'approved'
            );
            this.showStageToast(`P${p}: Solicitud aprobada`);
        } else if (result.status === 'wait_available') {
            this.sound.deny();
            this.btnApplyLoan.disabled = true;
            this.setDictamen(
                `<strong>En Espera (Recursos Insuficientes):</strong> ${result.message}`,
                'En Espera',
                'wait'
            );
            this.showStageToast(`P${p}: Recursos insuficientes`);
        } else if (result.status === 'wait_unsafe') {
            this.sound.deny();
            this.btnApplyLoan.disabled = true;
            this.setDictamen(
                `<strong>En Espera Preventiva (Estado Inseguro):</strong> ${result.message} <br><em>(Pulsa "Ver Ensayo de Seguridad" para observar el análisis paso a paso)</em>`,
                'En Espera',
                'wait'
            );
            this.showStageToast(`P${p}: Espera preventiva por estado inseguro`);
        } else if (result.status === 'invalid_need') {
            this.sound.deny();
            this.btnApplyLoan.disabled = true;
            this.setDictamen(
                `<strong>Solicitud Inválida:</strong> ${result.message}`,
                'Inválida',
                'invalid'
            );
            this.showStageToast(`P${p}: Excede necesidad declarada`);
        }
    }

    // =========================================================================
    // Animación 2D: Caminar por la RUTA ASIGNADA hacia la TIENDA CENTRAL
    // =========================================================================

    executeApplyLoan() {
        if (this.isAnimating || !this.lastEvaluation || this.lastEvaluation.status !== 'approved') return;

        const p = this.selectedWorker;
        const req = [...this.pendingRequest];
        this.isAnimating = true;
        this.lockControls(true);

        const walkerGroup = document.getElementById(`worker-walker-p${p}`);
        const charBody = document.getElementById(`worker-char-body-${p}`);
        const carriedTools = document.getElementById(`carried-tools-p${p}`);

        if (!walkerGroup) {
            this.engine.applyLoan(p, req);
            this.finishAnimation();
            return;
        }

        const numP = this.engine.numProcesses;
        const benchX = this.getBenchPositions(numP, 1000);

        // Ruta fija: Desde su mesa hasta el mostrador REAL de la tienda central
        const startX = benchX[p];
        const startY = 455;   // Misma Y que la posición dibujada del trabajador
        const endX = 500;     // Centro X del almacén visible
        const endY = 165;     // Mostrador del almacén: translate(500,115) + local y=50

        // Orientación hacia la tienda central
        const walkToDir = endX >= startX ? 1 : -1;
        if (charBody) charBody.setAttribute('transform', `scale(${walkToDir}, 1)`);

        this.setDictamen(`P${p} sigue su ruta marcada hacia la tienda central para recoger [${req.join(', ')}]...`, 'En Ruta');
        walkerGroup.classList.add('is-walking');

        const duration = 850;
        const startTime = performance.now();

        // 1. Caminar hasta el mostrador central
        const walkToStore = (currentTime) => {
            const elapsed = (currentTime - startTime) * this.speedMultiplier;
            const progress = Math.min(1, elapsed / duration);

            const curX = startX + (endX - startX) * progress;
            const curY = startY + (endY - startY) * progress;
            walkerGroup.setAttribute('transform', `translate(${curX}, ${curY})`);

            if (progress < 1) {
                const fid = requestAnimationFrame(walkToStore);
                this.activeAnimationFrames.push(fid);
            } else {
                // Llegó al mostrador de la tienda central
                this.sound.approve();
                if (carriedTools) carriedTools.style.display = 'block';

                // Aplicar el préstamo al motor (solo datos, sin reconstruir la escena)
                this.engine.applyLoan(p, req);

                // Actualizar solo los paneles de datos SIN reconstruir el SVG
                this.updateStatusBadges();
                this.renderWorkerTabs();
                this.renderSelectedWorkerPanel();
                this.renderWarehouseInventory();
                this.renderMatricesTable();
                // También actualizar los badges en las mesas sin destruir el personaje
                this.updateBenchToolBadges();

                this.showStageToast(`P${p} recogió herramientas en la tienda`);
                this.setDictamen(`P${p} recibió sus herramientas y regresa a su mesa.`, 'En Ruta');

                // 2. Regresar por la misma ruta a su mesa
                this.setTimeoutTracked(() => {
                    const walkBackDir = startX >= endX ? 1 : -1;
                    if (charBody) charBody.setAttribute('transform', `scale(${walkBackDir}, 1)`);

                    const returnStart = performance.now();
                    const walkBack = (time2) => {
                        const el2 = (time2 - returnStart) * this.speedMultiplier;
                        const returnProg = Math.min(1, el2 / duration);

                        const bx = endX + (startX - endX) * returnProg;
                        const by = endY + (startY - endY) * returnProg;
                        walkerGroup.setAttribute('transform', `translate(${bx}, ${by})`);

                        if (returnProg < 1) {
                            const fid2 = requestAnimationFrame(walkBack);
                            this.activeAnimationFrames.push(fid2);
                        } else {
                            // De regreso frente a su mesa
                            walkerGroup.setAttribute('transform', `translate(${startX}, ${startY})`);
                            walkerGroup.classList.remove('is-walking');
                            if (charBody) charBody.setAttribute('transform', 'scale(1, 1)');
                            if (carriedTools) carriedTools.style.display = 'none';

                            this.finishAnimation(); // Ahora sí reconstruye la escena completa
                            this.setDictamen(`P${p} regresó a su posición frente a su mesa con las nuevas herramientas asignadas.`, 'Listo');
                        }
                    };
                    const fid2 = requestAnimationFrame(walkBack);
                    this.activeAnimationFrames.push(fid2);
                }, 350);
            }
        };

        const fid = requestAnimationFrame(walkToStore);
        this.activeAnimationFrames.push(fid);
    }

    // =========================================================================
    // Animación 2D: Trabajar y Devolver herramientas a la Tienda Central
    // =========================================================================

    executeWorkAndFinish(pIdx) {
        if (this.isAnimating) return;
        const p = pIdx !== undefined ? pIdx : this.selectedWorker;

        if (!this.engine.hasGatheredMax(p)) {
            alert(`P${p} aún no reúne su máximo declarado para terminar.`);
            return;
        }

        this.isAnimating = true;
        this.lockControls(true);

        const walkerGroup = document.getElementById(`worker-walker-p${p}`);
        const charBody = document.getElementById(`worker-char-body-${p}`);
        const frontView = document.getElementById(`worker-front-${p}`);
        const backView = document.getElementById(`worker-back-${p}`);
        const carriedTools = document.getElementById(`carried-tools-p${p}`);
        const effectsLayer = document.getElementById('effects-layer');

        const numP = this.engine.numProcesses;
        const benchX = this.getBenchPositions(numP, 1000);

        const startX = benchX[p];
        const startY = 455;   // Misma Y que la posición dibujada del trabajador
        const endX = 500;     // Centro X del almacén
        const endY = 165;     // Mostrador del almacén: 115 (base) + 50 (local y del counter)

        // 1. El trabajador se da la vuelta para trabajar hacia su mesa fija
        if (frontView) frontView.style.display = 'none';
        if (backView) backView.style.display = 'block';

        this.setDictamen(`P${p} se dio la vuelta y está trabajando en su mesa...`, 'Trabajando');
        this.sound.work();

        const spark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        spark.setAttribute('x', startX);
        spark.setAttribute('y', 415); // Sobre la mesa del trabajador (y=410)
        spark.setAttribute('text-anchor', 'middle');
        spark.setAttribute('font-size', '22');
        spark.textContent = '✨';
        spark.classList.add('spark-effect');
        if (effectsLayer) effectsLayer.appendChild(spark);

        // 2. Al terminar el trabajo, se da la vuelta hacia el frente
        this.setTimeoutTracked(() => {
            if (spark && spark.parentNode) spark.parentNode.removeChild(spark);

            if (backView) backView.style.display = 'none';
            if (frontView) frontView.style.display = 'block';

            this.sound.success();
            this.showStageToast(`¡P${p} terminó su labor!`);
            this.setDictamen(`P${p} completó su labor y camina hacia la tienda central a devolver sus herramientas.`, 'Devolviendo');

            if (carriedTools) carriedTools.style.display = 'block';
            walkerGroup.classList.add('is-walking');

            const walkToDir = endX >= startX ? 1 : -1;
            if (charBody) charBody.setAttribute('transform', `scale(${walkToDir}, 1)`);

            const duration = 850;
            const startTime = performance.now();

            // 3. Camina a la tienda central
            const walkToReturn = (currTime) => {
                const elapsed = (currTime - startTime) * this.speedMultiplier;
                const prog = Math.min(1, elapsed / duration);

                const cx = startX + (endX - startX) * prog;
                const cy = startY + (endY - startY) * prog;
                walkerGroup.setAttribute('transform', `translate(${cx}, ${cy})`);

                if (prog < 1) {
                    const fid = requestAnimationFrame(walkToReturn);
                    this.activeAnimationFrames.push(fid);
                } else {
                    // 4. Deja las herramientas en la tienda (solo datos, sin reconstruir la escena)
                    const compRes = this.engine.completeProcess(p);
                    if (carriedTools) carriedTools.style.display = 'none';

                    // Actualizar paneles SIN reconstruir el SVG
                    this.updateStatusBadges();
                    this.renderWorkerTabs();
                    this.renderSelectedWorkerPanel();
                    this.renderWarehouseInventory();
                    this.renderMatricesTable();
                    this.updateBenchToolBadges();

                    this.sound.approve();
                    this.showStageToast(`P${p} devolvió sus herramientas a la tienda`);
                    this.setDictamen(`P${p} devolvió [${compRes.releasedTools.join(', ')}] a la tienda. Herramientas libres = [${compRes.newAvailable.join(', ')}].`, 'Terminado');

                    // 5. Regresa a su mesa por la misma ruta
                    this.setTimeoutTracked(() => {
                        const walkBackDir = startX >= endX ? 1 : -1;
                        if (charBody) charBody.setAttribute('transform', `scale(${walkBackDir}, 1)`);

                        const backTime = performance.now();
                        const walkBack = (time2) => {
                            const el2 = (time2 - backTime) * this.speedMultiplier;
                            const prog2 = Math.min(1, el2 / duration);

                            const bx = endX + (startX - endX) * prog2;
                            const by = endY + (startY - endY) * prog2;
                            walkerGroup.setAttribute('transform', `translate(${bx}, ${by})`);

                            if (prog2 < 1) {
                                const fid2 = requestAnimationFrame(walkBack);
                                this.activeAnimationFrames.push(fid2);
                            } else {
                                // De vuelta frente a su mesa
                                walkerGroup.setAttribute('transform', `translate(${startX}, ${startY})`);
                                walkerGroup.classList.remove('is-walking');
                                if (charBody) charBody.setAttribute('transform', 'scale(1, 1)');

                                this.finishAnimation(); // Reconstruye la escena al final

                                if (compRes.allFinished) {
                                    this.setSimState(SIM_STATE.FINISHED);
                                    this.setDictamen('🎉 ¡FELICITACIONES! Todos los trabajadores han concluido sus labores sin interbloqueos.', 'Finalizado', 'approved');
                                } else {
                                    this.setDictamen(`P${p} terminó y sus herramientas están disponibles en la tienda central.`, 'Listo');
                                }
                            }
                        };
                        const fid2 = requestAnimationFrame(walkBack);
                        this.activeAnimationFrames.push(fid2);
                    }, 350);
                }
            };

            const fid = requestAnimationFrame(walkToReturn);
            this.activeAnimationFrames.push(fid);
        }, 1400);
    }

    finishAnimation() {
        this.isAnimating = false;
        this.lockControls(false);
        this.lastEvaluation = null;
        this.syncUI();
    }

    lockControls(locked) {
        this.btnEvaluate.disabled = locked;
        this.btnApplyLoan.disabled = locked;
        this.btnWorkFinish.disabled = locked;
        this.btnStep.disabled = locked;
        this.scenarioSelect.disabled = locked;
    }

    // =========================================================================
    // Ejecución de Paso Automático
    // =========================================================================

    executeAutoStep() {
        if (this.simState !== SIM_STATE.RUNNING || this.isAnimating) return;

        if (this.engine.finished.every(f => f === true)) {
            this.setSimState(SIM_STATE.FINISHED);
            this.setDictamen('Demostración concluida: Todos los trabajadores han finalizado con éxito.', 'Finalizado', 'approved');
            return;
        }

        // 1. Trabajar y terminar si tiene su máximo
        for (let i = 0; i < this.engine.numProcesses; i++) {
            if (!this.engine.finished[i] && this.engine.hasGatheredMax(i)) {
                this.selectWorker(i);
                this.setDictamen(`Auto-Demo: P${i} ya reunió su máximo [${this.engine.max[i].join(', ')}]. Procediendo a trabajar...`, 'Trabajando');
                this.setTimeoutTracked(() => {
                    this.executeWorkAndFinish(i);
                    this.setTimeoutTracked(() => this.executeAutoStep(), 3000);
                }, 600);
                return;
            }
        }

        // 2. Buscar solicitud segura
        const avail = this.engine.getAvailable();
        const needMatrix = this.engine.getNeedMatrix();
        let foundSafeMove = false;

        for (let i = 0; i < this.engine.numProcesses; i++) {
            if (!this.engine.finished[i]) {
                const req = [];
                let canRequest = false;

                for (let j = 0; j < this.engine.numResources; j++) {
                    const toReq = Math.min(needMatrix[i][j], avail[j]);
                    req.push(toReq);
                    if (toReq > 0) canRequest = true;
                }

                if (canRequest) {
                    const evalRes = this.engine.evaluateRequest(i, req);
                    if (evalRes.status === 'approved') {
                        foundSafeMove = true;
                        this.selectWorker(i);
                        this.setRequestInputs(req);
                        this.pendingRequest = req;
                        this.lastEvaluation = evalRes;
                        this.syncUI();

                        this.setDictamen(`Auto-Demo: P${i} solicita [${req.join(', ')}]. Ensayo confirma estado seguro &lt;${evalRes.safetyTrial.safeSequence.map(p => 'P' + p).join(', ')}&gt;. Aplicando...`, 'Aprobado', 'approved');

                        this.setTimeoutTracked(() => {
                            this.executeApplyLoan();
                            this.setTimeoutTracked(() => this.executeAutoStep(), 3000);
                        }, 1000);
                        return;
                    }
                }
            }
        }

        if (!foundSafeMove) {
            this.setSimState(SIM_STATE.STOPPED);
            this.setDictamen('Auto-Demo: Ninguna solicitud puede ser aprobada de forma segura en este momento. Taller en espera o estado inseguro.', 'Detenido', 'wait');
        }
    }

    // =========================================================================
    // Modales y Demás Lógicas
    // =========================================================================

    showTrialModal(safetyResult, customTitle) {
        if (!safetyResult) return;
        this.modalTrial.classList.add('active');

        const titleEl = document.getElementById('modal-trial-title');
        if (titleEl) {
            titleEl.textContent = customTitle || 'Ensayo de Seguridad del Banquero (Hipotético)';
        }

        this.trialStepsList.innerHTML = '';

        if (safetyResult.isSafe) {
            this.trialResultBanner.className = 'trial-step-card success';
            this.trialResultBanner.innerHTML = `
                <div class="trial-step-header">
                    <span>🛡️ RESULTADO DEL ENSAYO: ESTADO SEGURO</span>
                    <span class="trial-sequence-pill">&lt;${safetyResult.safeSequence.map(p => 'P' + p).join(', ')}&gt;</span>
                </div>
                <p>Existe al menos una secuencia donde todos los trabajadores pueden concluir y devolver sus herramientas sin riesgo de interbloqueo.</p>
            `;
        } else {
            this.trialResultBanner.className = 'trial-step-card fail';
            this.trialResultBanner.innerHTML = `
                <div class="trial-step-header">
                    <span>⚠️ RESULTADO DEL ENSAYO: ESTADO INSEGURO</span>
                    <span style="color: #fca5a5; font-weight: 700;">No existe secuencia segura</span>
                </div>
                <p>Los recursos libres no alcanzan para garantizar que los procesos restantes (${safetyResult.pendingProcesses.map(p => 'P' + p).join(', ')}) terminen. El banquero debe ordenar esperar.</p>
            `;
        }

        safetyResult.steps.forEach(step => {
            const card = document.createElement('div');
            card.className = `trial-step-card ${step.type === 'process_satisfied' ? 'success' : step.type === 'stuck' ? 'fail' : ''}`;
            card.innerHTML = `
                <div class="trial-step-header">
                    <span>Paso ${step.stepNumber}: ${step.type === 'init' ? 'Condición Inicial' : step.type === 'process_satisfied' ? `P${step.process} Puede Concluir` : 'Bloqueo en el Ensayo'}</span>
                </div>
                <p style="margin-top: 4px; color: #cbd5e1;">${step.description}</p>
            `;
            this.trialStepsList.appendChild(card);
        });
    }

    openConfigModal() {
        this.modalConfig.classList.add('active');
        this.configNumP.value = this.engine.numProcesses;
        this.configNumR.value = this.engine.numResources;
        this.renderConfigTable();
    }

    renderConfigTable() {
        const numP = parseInt(this.configNumP.value, 10);
        const numR = parseInt(this.configNumR.value, 10);
        const resShort = ['A', 'B', 'C'].slice(0, numR);

        let html = `
            <table class="config-table">
                <thead>
                    <tr>
                        <th rowspan="2">Proceso</th>
                        <th colspan="${numR}">Asignado</th>
                        <th colspan="${numR}">Máximo</th>
                    </tr>
                    <tr>
                        ${resShort.map(r => `<th>${r}</th>`).join('')}
                        ${resShort.map(r => `<th>${r}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        for (let i = 0; i < numP; i++) {
            html += `<tr><td><strong>P${i}</strong></td>`;
            for (let j = 0; j < numR; j++) {
                const curVal = (this.engine.allocated[i] && this.engine.allocated[i][j] !== undefined) ? this.engine.allocated[i][j] : 0;
                html += `<td><input type="number" id="cfg-alloc-${i}-${j}" value="${curVal}" min="0"></td>`;
            }
            for (let j = 0; j < numR; j++) {
                const curVal = (this.engine.max[i] && this.engine.max[i][j] !== undefined) ? this.engine.max[i][j] : 2;
                html += `<td><input type="number" id="cfg-max-${i}-${j}" value="${curVal}" min="0"></td>`;
            }
            html += `</tr>`;
        }

        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td><strong>TOTAL TALLER</strong></td>
                        <td colspan="${numR * 2}">
                            <div style="display: flex; justify-content: center; gap: 12px;">
                                ${resShort.map((r, j) => {
            const totVal = this.engine.total[j] !== undefined ? this.engine.total[j] : 5;
            return `<span>Total ${r}: <input type="number" id="cfg-total-${j}" value="${totVal}" min="1" style="width: 50px;"></span>`;
        }).join('')}
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        `;

        this.configTableContainer.innerHTML = html;
        this.configErrorBox.style.display = 'none';
    }

    saveConfigFromModal() {
        const numP = parseInt(this.configNumP.value, 10);
        const numR = parseInt(this.configNumR.value, 10);

        const total = [];
        for (let j = 0; j < numR; j++) {
            const el = document.getElementById(`cfg-total-${j}`);
            total.push(el ? el.value.trim() : '');
        }

        const allocated = [];
        const max = [];

        for (let i = 0; i < numP; i++) {
            allocated[i] = [];
            max[i] = [];
            for (let j = 0; j < numR; j++) {
                const allocEl = document.getElementById(`cfg-alloc-${i}-${j}`);
                const maxEl = document.getElementById(`cfg-max-${i}-${j}`);
                allocated[i][j] = allocEl ? allocEl.value.trim() : '';
                max[i][j] = maxEl ? maxEl.value.trim() : '';
            }
        }

        const res = this.engine.applyCustomConfiguration({
            numProcesses: numP,
            numResources: numR,
            total,
            allocated,
            max
        });

        if (!res.success) {
            this.configErrorBox.innerHTML = `<strong>Errores en los datos:</strong><ul style="margin-left: 18px; margin-top: 4px;">${res.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
            this.configErrorBox.style.display = 'block';
        } else {
            this.modalConfig.classList.remove('active');
            this.scenarioSelect.value = 'custom';
            this.selectedWorker = 0;
            this.setSimState(SIM_STATE.IDLE);
            this.syncUI();
            this.setDictamen(`Configuración personalizada aplicada (${numP} trabajadores, ${numR} recursos).`, 'Listo');
        }
    }

    attachEventListeners() {
        this.scenarioSelect.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                this.loadScenario(e.target.value);
            }
        });

        this.btnAutoDemo.addEventListener('click', () => this.handleAutoDemoButton());
        this.btnPause.addEventListener('click', () => this.handlePauseButton());
        this.btnReset.addEventListener('click', () => this.handleResetButton());
        this.btnStep.addEventListener('click', () => {
            if (this.simState !== SIM_STATE.RUNNING) {
                const prevState = this.simState;
                this.simState = SIM_STATE.RUNNING;
                this.executeAutoStep();
                if (this.simState === SIM_STATE.RUNNING) {
                    this.simState = prevState;
                    this.updateControlButtons();
                }
            }
        });

        this.speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.speedMultiplier = parseFloat(btn.dataset.speed);
            });
        });

        this.btnConfigure.addEventListener('click', () => this.openConfigModal());
        this.modalConfigClose.addEventListener('click', () => this.modalConfig.classList.remove('active'));
        this.btnSaveConfig.addEventListener('click', () => this.saveConfigFromModal());
        this.configNumP.addEventListener('change', () => this.renderConfigTable());
        this.configNumR.addEventListener('change', () => this.renderConfigTable());

        this.btnEvaluate.addEventListener('click', () => this.evaluateCurrentRequest());
        this.btnApplyLoan.addEventListener('click', () => this.executeApplyLoan());
        this.btnWorkFinish.addEventListener('click', () => this.executeWorkAndFinish());
        this.btnViewTrial.addEventListener('click', () => {
            if (this.lastEvaluation && this.lastEvaluation.safetyTrial) {
                this.showTrialModal(this.lastEvaluation.safetyTrial);
            }
        });

        this.modalTrialClose.addEventListener('click', () => this.modalTrial.classList.remove('active'));
        this.btnOpenGuide.addEventListener('click', () => this.modalGuide.classList.add('active'));
        this.modalGuideClose.addEventListener('click', () => this.modalGuide.classList.remove('active'));

        this.collapsibleTrigger.addEventListener('click', () => {
            const isCollapsed = this.matricesContent.classList.toggle('collapsed');
            const arrow = document.getElementById('matrices-arrow');
            if (arrow) arrow.textContent = isCollapsed ? '▼' : '▲';
        });

        this.btnToggleSound.addEventListener('click', () => {
            this.sound.enabled = !this.sound.enabled;
            this.btnToggleSound.textContent = this.sound.enabled ? '🔊 Sonido' : '🔇 Silencio';
        });
    }
}

let app = null;
window.addEventListener('DOMContentLoaded', () => {
    app = new SimulationApp();
});
