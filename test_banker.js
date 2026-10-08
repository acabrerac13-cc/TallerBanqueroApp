/**
 * test_banker.js
 * Suite de pruebas unitarias y de integración para banker.js
 */

const BankerEngine = require('./banker.js');
const assert = require('assert');

console.log('=== INICIANDO PRUEBAS DE TALLER DEL BANQUERO ===\n');

// 1. Prueba de Escenario 1: Aprender
console.log('--- 1. Escenario 1: Aprender ---');
const b1 = new BankerEngine();
b1.loadScenario('aprender');

assert.deepStrictEqual(b1.total, [5, 3], 'Total debe ser [5, 3]');
assert.deepStrictEqual(b1.getAvailable(), [2, 2], 'Disponible inicial debe ser [2, 2]');
assert.strictEqual(b1.checkConservation().valid, true, 'Invariante de conservación debe ser válida');

// Evaluar solicitud guiada P1 -> [1, 0]
const evalP1 = b1.evaluateRequest(1, [1, 0]);
assert.strictEqual(evalP1.status, 'approved', 'Solicitud P1 [1, 0] debe ser aprobada');
assert.strictEqual(evalP1.safetyTrial.isSafe, true, 'Ensayo de seguridad debe ser seguro');
assert.deepStrictEqual(evalP1.safetyTrial.safeSequence, [1, 0, 2], 'Secuencia segura debe ser <P1, P0, P2>');

// Aplicar préstamo
b1.applyLoan(1, [1, 0]);
assert.deepStrictEqual(b1.getAvailable(), [1, 2], 'Disponible tras préstamo debe ser [1, 2]');
assert.deepStrictEqual(b1.allocated[1], [2, 1], 'P1 asignado debe ser [2, 1]');
assert.strictEqual(b1.hasGatheredMax(1), true, 'P1 ya reunió su máximo');
assert.strictEqual(b1.checkConservation().valid, true, 'Conservación debe mantenerse');

// P1 trabaja y termina
const compP1 = b1.completeProcess(1);
assert.strictEqual(compP1.success, true, 'P1 debe completar exitosamente');
assert.deepStrictEqual(b1.getAvailable(), [3, 3], 'Disponible tras devolver debe ser [3, 3]');
assert.deepStrictEqual(b1.allocated[1], [0, 0], 'P1 asignado debe quedar en [0, 0]');
assert.strictEqual(b1.finished[1], true, 'P1 debe estar marcado como terminado');
assert.strictEqual(b1.checkConservation().valid, true, 'Conservación debe mantenerse tras devolución');

// Intentar pedir con proceso terminado
const evalFin = b1.evaluateRequest(1, [1, 0]);
assert.strictEqual(evalFin.status, 'invalid_finished', 'Proceso terminado no puede solicitar');

console.log('✓ Escenario 1 superó todas las pruebas.');

// 2. Prueba de Escenario 2: Un Préstamo Peligroso
console.log('\n--- 2. Escenario 2: Un Préstamo Peligroso ---');
const b2 = new BankerEngine();
b2.loadScenario('prestamo_peligroso');

assert.deepStrictEqual(b2.total, [10, 5, 7]);
assert.deepStrictEqual(b2.getAvailable(), [3, 3, 2]);

// Caso A: P4 solicita [3, 3, 0] -> Debe esperar por estado inseguro
const evalP4 = b2.evaluateRequest(4, [3, 3, 0]);
assert.strictEqual(evalP4.status, 'wait_unsafe', 'P4 [3, 3, 0] debe resultar en wait_unsafe');
assert.strictEqual(evalP4.safetyTrial.isSafe, false, 'Ensayo debe resultar inseguro');
// Verificar que el taller real NO se modificó
assert.deepStrictEqual(b2.getAvailable(), [3, 3, 2], 'El Disponible real NO debe alterarse tras denegar');
assert.deepStrictEqual(b2.allocated[4], [0, 0, 2], 'El Asignado real NO debe alterarse');

// Caso B: Desde el estado inicial, P1 solicita [1, 0, 2] -> Aprobado
const evalP1_2 = b2.evaluateRequest(1, [1, 0, 2]);
assert.strictEqual(evalP1_2.status, 'approved', 'P1 [1, 0, 2] debe ser aprobado');
assert.strictEqual(evalP1_2.safetyTrial.isSafe, true, 'Ensayo debe ser seguro');
assert.deepStrictEqual(evalP1_2.safetyTrial.safeSequence, [1, 3, 0, 2, 4], 'Secuencia segura esperada');

console.log('✓ Escenario 2 superó todas las pruebas.');

// 3. Prueba de Escenario 3: Estado Inicial Inseguro
console.log('\n--- 3. Escenario 3: Estado Inicial Inseguro ---');
const b3 = new BankerEngine();
b3.loadScenario('inicial_inseguro');

assert.deepStrictEqual(b3.getAvailable(), [1, 0]);
const safetyInit = b3.runSafetyCheck(b3.getAvailable(), b3.allocated, b3.getNeedMatrix(), b3.finished);
assert.strictEqual(safetyInit.isSafe, false, 'El estado inicial debe ser inseguro');
assert.deepStrictEqual(safetyInit.pendingProcesses, [0, 1], 'Todos los procesos quedan pendientes');

console.log('✓ Escenario 3 superó todas las pruebas.');

// 4. Casos límite y Validación de Solicitudes
console.log('\n--- 4. Casos Límite y Validaciones de Solicitud ---');
const b4 = new BankerEngine();
b4.loadScenario('aprender');

// Solicitud excede necesidad
const evalExceedNeed = b4.evaluateRequest(0, [99, 0]);
assert.strictEqual(evalExceedNeed.status, 'invalid_need', 'Debe rechazar solicitud > necesidad');

// Solicitud excede disponible (pero dentro de necesidad)
// P0 necesidad es [2, 2], Disponible es [2, 2]. Si pide [3, 0] excede necesidad; si cambiamos Disp a [1, 1], pedir [2, 2] excede disponible.
b4.allocated[1] = [1, 1]; // Disp es [2, 2]
const evalExceedAvail = b4.evaluateRequest(0, [2, 3]); // pide 3 de recurso B cuando hay 2 disponible y max es 2 (need es 2)
// [2, 3] excede necesidad de B (need=2).
const evalExceedAvail2 = b4.evaluateRequest(0, [2, 2]); // need es [2, 2], avail es [2, 2]. Probemos con [3, ...]
// Para probar que excede disponible pero no necesidad:
b4.allocated = [[0, 0], [1, 1], [1, 0]]; // Total [5, 3], Alloc sum = [2, 1], Avail = [3, 2].
b4.max = [[4, 3], [2, 1], [3, 2]]; // P0 need = [4, 3].
// P0 pide [4, 1]: need es [4, 3] (4 <= 4 OK, 1 <= 3 OK), pero Avail es [3, 2] (4 > 3 excede disponible!).
const evalWaitAvail = b4.evaluateRequest(0, [4, 1]);
assert.strictEqual(evalWaitAvail.status, 'wait_available', 'Debe esperar por recursos insuficientes en almacén');

console.log('✓ Validaciones de protocolo superaron todas las pruebas.');

// 5. Validación de Configuración Personalizada
console.log('\n--- 5. Validación de Configuración Dinámica ---');
const b5 = new BankerEngine();

// Asignado > Max
const badConfig1 = b5.applyCustomConfiguration({
    numProcesses: 2,
    numResources: 2,
    total: [5, 5],
    allocated: [[3, 1], [1, 1]],
    max: [[2, 1], [1, 1]] // P0 alloc(3) > max(2)
});
assert.strictEqual(badConfig1.success, false);
assert(badConfig1.errors.some(e => e.includes('no puede superar el Máximo')));

// Suma asignados > Total
const badConfig2 = b5.applyCustomConfiguration({
    numProcesses: 2,
    numResources: 1,
    total: [3],
    allocated: [[2], [2]], // Sum = 4 > 3
    max: [[3], [3]]
});
assert.strictEqual(badConfig2.success, false);
assert(badConfig2.errors.some(e => e.includes('excede el Total')));

// Valores negativos o decimales
const badConfig3 = b5.applyCustomConfiguration({
    numProcesses: 1,
    numResources: 1,
    total: ['3.5'],
    allocated: [[1]],
    max: [[2]]
});
assert.strictEqual(badConfig3.success, false);
assert(badConfig3.errors.some(e => e.includes('entero no negativo')));

console.log('✓ Validaciones de configuración dinámica superaron todas las pruebas.');

console.log('\n======================================================');
console.log('🎉 ¡TODAS LAS PRUEBAS MATEMÁTICAS Y ALGORÍTMICAS PASARON!');
console.log('======================================================\n');
