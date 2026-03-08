import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async () => {
    const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_KEY
    );

    try {
        const { data: pacientes, error } = await supabase
        .from('pacientes')
        .select('nombre, donde_duerme, epworth_pre, psqi_pre, berlin_pre')
        .neq('donde_duerme', null) 
        .order('nombre');

        if (error) throw error;

        let csvContent = "Nombre,Lugar de Sueno,Epworth (Pre),PSQI (Pre),Berlin (Pre)\n";

        pacientes.forEach((p) => {
        const nombre = `"${p.nombre || 'Anónimo'}"`;
        const lugar = p.donde_duerme || 'No especificado';
        const epworth = p.epworth_pre !== null ? p.epworth_pre : '';
        const psqi = p.psqi_pre !== null ? p.psqi_pre : '';
        const berlin = p.berlin_pre !== null ? p.berlin_pre : '';

        csvContent += `${nombre},${lugar},${epworth},${psqi},${berlin}\n`;
        });

        return new Response("\uFEFF" + csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="reporte_sueno_habit.csv"',
                "Cache-Control": "private, max-age=30"
            },
        });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Error generando reporte" }), {
        status: 500,
        });
    }
};