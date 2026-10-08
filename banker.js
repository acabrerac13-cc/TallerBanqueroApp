/**
 * Taller del Banquero - banker.js
 * Lógica matemática pura del Algoritmo del Banquero de Edsger Dijkstra.
 * Maneja matrices de Total, Asignado, Máximo, Necesidad, Disponible y Ensayo de Seguridad.
 */

class BankerEngine {
    constructor() {
        this.resourceNames = ['Martillo (A)', 'Taladro (B)', 'Llave (C)'];
        this.resourceIcons = ['🔨', '⚡', '🔧'];
        this.resourceShortNames = ['A', 'B', 'C'];
        this.reset();
    }

    reset() {
        this.numProcesses = 3;
        this.numResources = 2;
        this.total = [5, 3];
        this.allocated = [
            [1, 0],
            [1, 1],
            [1, 0]
        ];
        this.max = [
            [3, 2],
            [2, 1],
            [3, 2]
        ];
        this.finished = [false, false, false];
    }

    /**
     * Calcula la matriz de Necesidad: Need = Max - Allocated
     */
    getNeedMatrix() {
        const need = [];
        for (let i = 0; i < this.numProcesses; i++) {
            need[i] = [];
            for (let j = 0; j < this.numResources; j++) {
                need[i][j] = this.max[i][j] - this.allocated[i][j];
            }
        }
        return need;
    }

    /**
     * Calcula el vector Disponible: Available = Total - Sum(Allocated)
     */
    getAvailable() {
        const available = [...this.total];
        for (let j = 0; j < this.numResources; j++) {
            let sumAlloc = 0;
            for (let i = 0; i < this.numProcesses; i++) {
                sumAlloc += this.allocated[i][j];
            }
            available[j] -= sumAlloc;
        }
        return available;
    }

    /**
     * Verifica la conservación de recursos:
     * Para cada recurso j: Disponible[j] + Sum(Asignado[i][j]) === Total[j]
     */
    checkConservation() {
        const available = this.getAvailable();
        const details = [];
        let allValid = true;

        for (let j = 0; j < this.numResources; j++) {
            let sumAlloc = 0;
            for (let i = 0; i < this.numProcesses; i++) {
                sumAlloc += this.allocated[i][j];
            }
            const sum = available[j] + sumAlloc;
            const valid = sum === this.total[j] && available[j] >= 0;
            if (!valid) allValid = false;
            details.push({
                resourceIndex: j,
                resourceName: this.resourceShortNames[j],
                total: this.total[j],
                available: available[j],
                allocatedSum: sumAlloc,
                conserved: valid
            });
        }

        return { valid: allValid, details };
    }

    /**
     * Comprueba si un proceso ya reunió su máximo declarado
     */
    hasGatheredMax(pIdx) {
        if (this.finished[pIdx]) return false;
        for (let j = 0; j < this.numResources; j++) {
            if (this.allocated[pIdx][j] < this.max[pIdx][j]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Ensayo de Seguridad (Safety Algorithm)
     * Verifica si un estado hipotético dado es seguro o inseguro.
     * NOTA CLAVE: No modifica las matrices reales del taller.
     * Durante el ensayo:
     * - Trabajo empieza como una copia del Disponible provisional.
     * - Busca un proceso pendiente cuya Necesidad <= Trabajo en TODOS los recursos.
     * - Si puede terminar, Trabajo aumenta con su Asignado (NO suma Máximo ni Necesidad).
     * - Añade el proceso a la secuencia segura y continúa.
     * 
     * @param {number[]} workInitial - Vector inicial de Trabajo (copia de Disponible provisional)
     * @param {number[][]} allocMatrix - Matriz de Asignado a evaluar
     * @param {number[][]} needMatrix - Matriz de Necesidad a evaluar
     * @param {boolean[]} finishStatus - Array de booleanos que indica procesos ya terminados
     * @returns {Object} Resultado detallado del ensayo paso a paso
     */
    runSafetyCheck(workInitial, allocMatrix, needMatrix, finishStatus) {
        const work = [...workInitial];
        const finish = [...finishStatus];
        const safeSequence = [];
        const steps = [];

        // Registro del paso 0
        steps.push({
            stepNumber: 0,
            type: 'init',
            workState: [...work],
            finishState: [...finish],
            description: `Inicio del ensayo: Trabajo (Work) = [${work.join(', ')}].`,
            safeSeqSoFar: []
        });

        let foundNext = true;
        while (foundNext) {
            foundNext = false;

            for (let i = 0; i < this.numProcesses; i++) {
                if (!finish[i]) {
                    // Verificar si Need[i] <= Work para TODOS los recursos
                    let canProceed = true;
                    for (let j = 0; j < this.numResources; j++) {
                        if (needMatrix[i][j] > work[j]) {
                            canProceed = false;
                            break;
                        }
                    }

                    if (canProceed) {
                        // El proceso puede terminar hipotéticamente
                        const workBefore = [...work];
                        // REGLA CRUCIAL DEL ALGORITMO:
                        // Se simula que P[i] recibe su necesidad restante, trabaja y devuelve TODO su Asignado.
                        // Cambio neto en Trabajo = Trabajo previo + Asignado[i].
                        for (let j = 0; j < this.numResources; j++) {
                            work[j] += allocMatrix[i][j];
                        }
                        finish[i] = true;
                        safeSequence.push(i);
                        foundNext = true;

                        steps.push({
                            stepNumber: steps.length,
                            type: 'process_satisfied',
                            process: i,
                            need: [...needMatrix[i]],
                            allocated: [...allocMatrix[i]],
                            workBefore: workBefore,
                            workAfter: [...work],
                            finishState: [...finish],
                            safeSeqSoFar: [...safeSequence],
                            description: `P${i} califica: Necesidad [${needMatrix[i].join(', ')}] ≤ Trabajo [${workBefore.join(', ')}]. P${i} completa su tarea y libera su Asignado [${allocMatrix[i].join(', ')}]. Nuevo Trabajo = [${work.join(', ')}].`
                        });

                        // Reiniciar búsqueda para encontrar otro proceso con el nuevo Trabajo
                        break;
                    }
                }
            }
        }

        // Verificar si todos los procesos terminaron
        const allFinished = finish.every(status => status === true);
        const pendingProcesses = [];
        for (let i = 0; i < this.numProcesses; i++) {
            if (!finish[i]) pendingProcesses.push(i);
        }

        if (!allFinished) {
            steps.push({
                stepNumber: steps.length,
                type: 'stuck',
                workState: [...work],
                pendingProcesses: pendingProcesses,
                description: `Ensayo bloqueado: Ningún trabajador pendiente (${pendingProcesses.map(p => 'P' + p).join(', ')}) puede satisfacer su Necesidad con el Trabajo restante [${work.join(', ')}].`
            });
        }

        return {
            isSafe: allFinished,
            safeSequence: safeSequence,
            pendingProcesses: pendingProcesses,
            finalWork: [...work],
            steps: steps
        };
    }

    /**
     * Evalúa una solicitud de préstamo según las 4 condiciones del banquero:
     * 1. Solicitud > Necesidad: Inválida
     * 2. Solicitud > Disponible: Debe esperar por falta de recursos
     * 3. Ensayo Inseguro: Recursos disponibles, pero el préstamo hipotético dejaría un estado inseguro (debe esperar)
     * 4. Ensayo Seguro: Aprobada con secuencia segura
     */
    evaluateRequest(pIdx, requestVector) {
        if (this.finished[pIdx]) {
            return {
                status: 'invalid_finished',
                message: `El trabajador P${pIdx} ya está marcado como terminado y no puede solicitar más herramientas.`,
                code: 0
            };
        }

        const needMatrix = this.getNeedMatrix();
        const available = this.getAvailable();
        const pNeed = needMatrix[pIdx];

        // Paso 1: Solicitud > Necesidad declarada
        for (let j = 0; j < this.numResources; j++) {
            if (requestVector[j] > pNeed[j]) {
                return {
                    status: 'invalid_need',
                    code: 1,
                    message: `Solicitud inválida: P${pIdx} solicita ${requestVector[j]} de ${this.resourceNames[j]}, pero su Necesidad pendiente es solo ${pNeed[j]}. (Solicitud > Necesidad).`,
                    details: {
                        request: [...requestVector],
                        need: [...pNeed],
                        resourceIndex: j
                    }
                };
            }
        }

        // Paso 2: Solicitud > Disponible
        for (let j = 0; j < this.numResources; j++) {
            if (requestVector[j] > available[j]) {
                return {
                    status: 'wait_available',
                    code: 2,
                    message: `Recursos insuficientes en almacén: P${pIdx} solicita ${requestVector[j]} de ${this.resourceNames[j]}, pero solo hay ${available[j]} disponibles. P${pIdx} debe esperar a que otros trabajadores devuelvan herramientas.`,
                    details: {
                        request: [...requestVector],
                        available: [...available],
                        resourceIndex: j
                    }
                };
            }
        }

        // Paso 3: Asignación provisional e hipótesis de seguridad
        // Clonar estructuras para no modificar el taller real
        const provisionalAvailable = [...available];
        const provisionalAlloc = this.allocated.map(row => [...row]);
        const provisionalNeed = needMatrix.map(row => [...row]);

        for (let j = 0; j < this.numResources; j++) {
            provisionalAvailable[j] -= requestVector[j];
            provisionalAlloc[pIdx][j] += requestVector[j];
            provisionalNeed[pIdx][j] -= requestVector[j];
        }

        // Ejecutar algoritmo de seguridad en la hipótesis
        const safetyResult = this.runSafetyCheck(
            provisionalAvailable,
            provisionalAlloc,
            provisionalNeed,
            this.finished
        );

        if (!safetyResult.isSafe) {
            return {
                status: 'wait_unsafe',
                code: 3,
                message: `Préstamo denegado por seguridad: Hay herramientas en almacén, pero conceder este préstamo dejaría al taller en un ESTADO INSEGURO. No existiría garantía de evitar un interbloqueo. P${pIdx} debe esperar.`,
                safetyTrial: safetyResult,
                provisionalState: {
                    available: provisionalAvailable,
                    allocated: provisionalAlloc,
                    need: provisionalNeed
                }
            };
        }

        // Paso 4: Préstamo Aprobado
        return {
            status: 'approved',
            code: 4,
            message: `¡Préstamo aprobado! La asignación provisional es segura. Secuencia de finalización garantizada: <${safetyResult.safeSequence.map(p => 'P' + p).join(', ')}>.`,
            safetyTrial: safetyResult,
            provisionalState: {
                available: provisionalAvailable,
                allocated: provisionalAlloc,
                need: provisionalNeed
            }
        };
    }

    /**
     * Aplica el préstamo aprobado al taller real
     */
    applyLoan(pIdx, requestVector) {
        for (let j = 0; j < this.numResources; j++) {
            this.allocated[pIdx][j] += requestVector[j];
        }
        return {
            success: true,
            available: this.getAvailable(),
            allocated: this.allocated[pIdx],
            need: this.getNeedMatrix()[pIdx]
        };
    }

    /**
     * El trabajador concluye su tarea y devuelve TODAS sus herramientas asignadas
     */
    completeProcess(pIdx) {
        if (this.finished[pIdx]) {
            return { success: false, message: `P${pIdx} ya había terminado.` };
        }

        const releasedTools = [...this.allocated[pIdx]];
        // Liberar todas las herramientas al almacén
        for (let j = 0; j < this.numResources; j++) {
            this.allocated[pIdx][j] = 0;
        }
        this.finished[pIdx] = true;

        return {
            success: true,
            releasedTools: releasedTools,
            newAvailable: this.getAvailable(),
            allFinished: this.finished.every(f => f === true)
        };
    }

    /**
     * Cargar Escenarios predefinidos
     */
    loadScenario(scenarioId) {
        if (scenarioId === 'aprender') {
            // Escenario 1: "Aprender"
            // Total = (5, 3)
            // Asignado: P0=(1,0), P1=(1,1), P2=(1,0)
            // Máximo: P0=(3,2), P1=(2,1), P2=(3,2)
            // Disp inicial: (2,2)
            this.numProcesses = 3;
            this.numResources = 2;
            this.total = [5, 3];
            this.allocated = [
                [1, 0],
                [1, 1],
                [1, 0]
            ];
            this.max = [
                [3, 2],
                [2, 1],
                [3, 2]
            ];
            this.finished = [false, false, false];
            return {
                id: 'aprender',
                name: 'Escenario 1: Aprender (2 recursos, 3 trabajadores)',
                description: 'Ejemplo guiado clásico: Disponible inicial es (2, 2). Si P1 solicita (1, 0), el préstamo es seguro, reúne su máximo, termina y devuelve sus herramientas elevando el Disponible a (3, 3).'
            };
        } else if (scenarioId === 'prestamo_peligroso') {
            // Escenario 2: "Un préstamo peligroso"
            // Total = (10, 5, 7)
            // Asignado: P0=(0,1,0), P1=(2,0,0), P2=(3,0,2), P3=(2,1,1), P4=(0,0,2)
            // Máximo: P0=(7,5,3), P1=(3,2,2), P2=(9,0,2), P3=(2,2,2), P4=(4,3,3)
            // Disp inicial = (3, 3, 2)
            this.numProcesses = 5;
            this.numResources = 3;
            this.total = [10, 5, 7];
            this.allocated = [
                [0, 1, 0],
                [2, 0, 0],
                [3, 0, 2],
                [2, 1, 1],
                [0, 0, 2]
            ];
            this.max = [
                [7, 5, 3],
                [3, 2, 2],
                [9, 0, 2],
                [2, 2, 2],
                [4, 3, 3]
            ];
            this.finished = [false, false, false, false, false];
            return {
                id: 'prestamo_peligroso',
                name: 'Escenario 2: Un préstamo peligroso (3 recursos, 5 trabajadores)',
                description: 'Disponible inicial: (3, 3, 2). Permite demostrar: Si P4 pide (3, 3, 0) debe esperar por estado inseguro; en cambio, si P1 pide (1, 0, 2), se aprueba de inmediato.'
            };
        } else if (scenarioId === 'inicial_inseguro') {
            // Escenario 3: "Estado inicial inseguro"
            // Total = (4, 2)
            // Asignado: P0=(2, 1), P1=(1, 1)
            // Máximo: P0=(4, 2), P1=(3, 2)
            // Suma Asignado: (3, 2). Disp inicial = (1, 0).
            // Necesidad: P0=(2, 1), P1=(2, 1).
            // Ningún proceso puede terminar con Trabajo = (1, 0). Inseguro desde el inicio.
            this.numProcesses = 2;
            this.numResources = 2;
            this.total = [4, 2];
            this.allocated = [
                [2, 1],
                [1, 1]
            ];
            this.max = [
                [4, 2],
                [3, 2]
            ];
            this.finished = [false, false];
            return {
                id: 'inicial_inseguro',
                name: 'Escenario 3: Estado Inicial Inseguro',
                description: 'El taller comienza en un estado donde los recursos disponibles (1, 0) son insuficientes para satisfacer a cualquiera de los dos trabajadores. Muestra el comportamiento cuando no existe secuencia segura.'
            };
        }
    }

    /**
     * Valida y aplica una configuración personalizada desde el modal del usuario.
     */
    applyCustomConfiguration(config) {
        const errors = [];

        // Validar numProcesses y numResources
        const numP = parseInt(config.numProcesses, 10);
        const numR = parseInt(config.numResources, 10);

        if (isNaN(numP) || numP < 1 || numP > 5) {
            errors.push('El número de trabajadores debe ser un número entero entre 1 y 5.');
        }
        if (isNaN(numR) || numR < 1 || numR > 3) {
            errors.push('El número de tipos de herramientas debe ser un número entero entre 1 y 3.');
        }

        if (errors.length > 0) return { success: false, errors };

        // Validar totales
        const total = [];
        for (let j = 0; j < numR; j++) {
            const rawVal = config.total[j];
            const val = parseInt(rawVal, 10);
            if (rawVal === '' || rawVal === null || rawVal === undefined) {
                errors.push(`El recurso ${this.resourceShortNames[j]} tiene el campo Total vacío.`);
            } else if (isNaN(val) || val < 0 || String(rawVal).includes('.')) {
                errors.push(`El recurso ${this.resourceShortNames[j]} debe ser un entero no negativo.`);
            } else {
                total.push(val);
            }
        }

        if (errors.length > 0) return { success: false, errors };

        // Validar matrices
        const allocated = [];
        const max = [];

        for (let i = 0; i < numP; i++) {
            allocated[i] = [];
            max[i] = [];

            for (let j = 0; j < numR; j++) {
                const rawAlloc = config.allocated[i][j];
                const rawMax = config.max[i][j];
                const allocVal = parseInt(rawAlloc, 10);
                const maxVal = parseInt(rawMax, 10);

                if (rawAlloc === '' || isNaN(allocVal) || allocVal < 0 || String(rawAlloc).includes('.')) {
                    errors.push(`P${i} [${this.resourceShortNames[j]} Asignado]: Debe ser un entero no negativo.`);
                }
                if (rawMax === '' || isNaN(maxVal) || maxVal < 0 || String(rawMax).includes('.')) {
                    errors.push(`P${i} [${this.resourceShortNames[j]} Máximo]: Debe ser un entero no negativo.`);
                }

                if (allocVal > maxVal) {
                    errors.push(`P${i} [${this.resourceShortNames[j]}]: El Asignado (${allocVal}) no puede superar el Máximo (${maxVal}).`);
                }

                if (maxVal > total[j]) {
                    errors.push(`P${i} [${this.resourceShortNames[j]}]: El Máximo (${maxVal}) no puede superar el Total del taller (${total[j]}).`);
                }

                allocated[i][j] = allocVal;
                max[i][j] = maxVal;
            }
        }

        // Validar que la suma de asignados no supere el total
        for (let j = 0; j < numR; j++) {
            let sumAlloc = 0;
            for (let i = 0; i < numP; i++) {
                sumAlloc += allocated[i][j];
            }
            if (sumAlloc > total[j]) {
                errors.push(`Recurso ${this.resourceShortNames[j]}: La suma de asignados (${sumAlloc}) excede el Total del taller (${total[j]}).`);
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        // Aplicar la configuración
        this.numProcesses = numP;
        this.numResources = numR;
        this.total = total;
        this.allocated = allocated;
        this.max = max;
        this.finished = new Array(numP).fill(false);

        return { success: true };
    }
}

// Exportar para entorno navegador o Node si se requiere en pruebas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankerEngine;
}
