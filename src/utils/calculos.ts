/**
 * Contiene la lógica para puntuar los cuestionarios médicos.
 */

// --- EPWORTH ---
// Rango: 0-24. Suma simple de las 8 preguntas (0-3 cada una).
export const calcularEpworth = (datos: Record<string, any>): number => {
    let total = 0;
    // Iteramos por los IDs: epworth_1 hasta epworth_8
    for (let i = 1; i <= 8; i++) {
        // Convertimos el valor a entero (si viene vacío o nulo, cuenta como 0)
        const val = parseInt(datos[`epworth_${i}`] as string || '0', 10);
        // Sumamos solo si es un número válido
        total += isNaN(val) ? 0 : val;
    }
    return total;
};

// --- BERLIN (CORREGIDO) ---
// Categoría 1: 2 o más respuestas positivas en preguntas de ronquido
// Categoría 2: 2 o más respuestas positivas en somnolencia/fatiga
// Categoría 3: 1 respuesta positiva en hipertención
export const calcularBerlin = (datos: Record<string, any>): { puntaje: number, extraData: Record<string, string> } => {
    let cat1Positivas = 0;
    let cat2Positivas = 0;

    let esCat1 = false;
    let esCat2 = false;
    let esCat3 = false;

    // --- ANÁLISIS CATEGORÍA 1 (RONQUIDO) ---
    if (datos.ronca_volumen === 'positivo') cat1Positivas++;
    if (datos.ronca_frecuencia === 'positivo') cat1Positivas++;
    if (datos.ronca_molesta === 'positivo') cat1Positivas++;
    if (datos.ronca_deja_de_respirar === 'positivo') cat1Positivas++;
    
    esCat1 = cat1Positivas >= 2;

    // --- ANÁLISIS CATEGORÍA 2 (SOMNOLENCIA) ---
    if (datos.despierta_cansado === 'positivo') cat2Positivas++;
    if (datos.se_siente_mal === 'positivo') cat2Positivas++;
    if (datos.se_quedo_dormido_frecuencia === 'positivo') cat2Positivas++;

    esCat2 = cat2Positivas >= 2;

    // --- ANÁLISIS CATEGORÍA 3 (HIPERTENSIÓN) ---
    
    // 1. Calculamos IMC solo por registro
    const peso = parseFloat(datos.peso || '0');
    const alturaCm = parseFloat(datos.altura || '0');
    let imc = 0;
    
    if (peso > 0 && alturaCm > 0) {
        // Asumimos que la altura viene en CM, convertimos a Metros
        const alturaM = alturaCm / 100;
        imc = peso / (alturaM * alturaM);
    }

    // 2.La categoría solo es positiva si hay hipertensión.
    esCat3 = (datos.hipertension === 'positivo');

    // --- RESULTADO FINAL ---
    let totalScore = 0;
    if (esCat1) totalScore++;
    if (esCat2) totalScore++;
    if (esCat3) totalScore++;

    return {
        puntaje: totalScore,
        extraData: {
            "IMC": imc.toFixed(1),
            "Resultado Categoría 1 (Ronquido)": esCat1 ? "POSITIVA (Alto Riesgo)" : "Negativa",
            "Resultado Categoría 2 (Somnolencia)": esCat2 ? "POSITIVA (Alto Riesgo)" : "Negativa",
            "Resultado Categoría 3 (Presión Arterial)": esCat3 ? "POSITIVA (Alto Riesgo)" : "Negativa",
            "Riesgo Global": totalScore >= 2 ? "ALTO RIESGO (2 o más categorías)" : "Bajo Riesgo"
        }
    };
};

// --- PITTSBURGH (PSQI) ---
// Rango: 0-21. > 5 indica mala calidad de sueño.
export const calcularpsqi = (datos: Record<string, any>): { puntaje: number, extraData: Record<string, string> } => {
    
    // Función auxiliar para mapear respuestas de frecuencia (0-3)
    const val = (key: string) => parseInt(datos[key] || '0', 10);

    // --- COMPONENTE 1: Calidad Subjetiva ---
    // Pregunta 6 (0-3 directo)
    const comp1 = val('calidad_sueno');

    // --- COMPONENTE 2: Latencia de Sueño ---
    // 1. Puntuación de minutos (Pregunta 2)
    const scoreLatenciaMin = val('tiempo_dormir'); 
    
    // 2. Frecuencia de no poder dormir (Pregunta 5a -> alteracion_1)
    const freqNoDormir = val('alteracion_1'); // 0-3
    
    // Suma y re-mapeo (Igual que antes)
    const sumaC2 = scoreLatenciaMin + freqNoDormir;
    let comp2 = 0;
    if (sumaC2 >= 5) comp2 = 3;
    else if (sumaC2 >= 3) comp2 = 2;
    else if (sumaC2 >= 1) comp2 = 1;

    // --- COMPONENTE 3: Duración del Sueño ---
    // *** AQUÍ ESTÁ TU REQUERIMIENTO ESPECIAL ***
    // Si existe 'horas_sueno_estudio' (dato médico), úsalo. Si no, usa lo que dijo el paciente.
    const horasPaciente = parseFloat(datos.horas_sueno || '0');
    const horasEstudio = parseFloat(datos.horas_sueno_estudio || '0'); 
    
    // Usamos el del estudio si es mayor a 0, sino el del paciente
    const horasReales = horasEstudio > 0 ? horasEstudio : horasPaciente;

    let comp3 = 0;
    if (horasReales < 5) comp3 = 3;
    else if (horasReales < 6) comp3 = 2;
    else if (horasReales < 7) comp3 = 1;
    else comp3 = 0;

    // --- COMPONENTE 4: Eficiencia Habitual ---
    // Calculamos horas en cama (Diferencia entre Levantarse y Acostarse)
    let horasEnCama = 0;
    if (datos.hora_acostarse && datos.hora_levantarse) {
        // Creamos fechas dummy para comparar horas
        const hA = new Date(`2000-01-01T${datos.hora_acostarse}`);
        const hL = new Date(`2000-01-01T${datos.hora_levantarse}`);
        
        // Si se levanta antes de acostarse (ej: acostarse 23:00, levantarse 07:00), sumamos 1 día a levantarse
        if (hL <= hA) {
            hL.setDate(hL.getDate() + 1);
        }
        
        const diffMs = hL.getTime() - hA.getTime();
        horasEnCama = diffMs / (1000 * 60 * 60); // Convertir ms a horas
    }

    // Fórmula: (Horas Dormidas / Horas en Cama) * 100
    let eficiencia = 100;
    if (horasEnCama > 0) {
        eficiencia = (horasReales / horasEnCama) * 100;
    }

    let comp4 = 0;
    if (eficiencia < 65) comp4 = 3;
    else if (eficiencia < 75) comp4 = 2;
    else if (eficiencia < 85) comp4 = 1;
    else comp4 = 0;

    // --- COMPONENTE 5: Perturbaciones ---
    // Suma de preguntas 5b a 5j (alteracion_2 a 9 + otra causa)
    let sumaC5 = 0;
    for (let i = 2; i <= 9; i++) {
        sumaC5 += val(`alteracion_${i}`);
    }
    sumaC5 += val('frecuencia_otra_alteracion');

    let comp5 = 0;
    if (sumaC5 >= 19) comp5 = 3;
    else if (sumaC5 >= 10) comp5 = 2;
    else if (sumaC5 >= 1) comp5 = 1;

    // --- COMPONENTE 6: Medicación ---
    const comp6 = val('tomo_medicinas');

    // --- COMPONENTE 7: Disfunción Diurna ---
    // Dificultad despierto + Entusiasmo
    const sumaC7 = val('dificultad_despierto') + val('problema_entusiasmo');
    let comp7 = 0;
    if (sumaC7 >= 5) comp7 = 3;
    else if (sumaC7 >= 3) comp7 = 2;
    else if (sumaC7 >= 1) comp7 = 1;

    // --- RESULTADO GLOBAL ---
    const totalScore = comp1 + comp2 + comp3 + comp4 + comp5 + comp6 + comp7;

    return {
        puntaje: totalScore,
        extraData: {
            "C1 Calidad": `${comp1}`,
            "C2 Latencia": `${comp2}`,
            "C3 Duración": `${comp3} (${horasReales}h reales)`,
            "C4 Eficiencia": `${comp4} (${eficiencia.toFixed(0)}% - en cama: ${horasEnCama.toFixed(1)}h)`,
            "C5 Perturbaciones": `${comp5}`,
            "C6 Medicación": `${comp6}`,
            "C7 Disfunción": `${comp7}`,
            "Dato Usado": horasEstudio > 0 ? "Estudio Médico" : "Reporte Paciente"
        }
    };
};