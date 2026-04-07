/**
 * @file buscar-pacientes.ts
 * @description Endpoint de búsqueda rápida de pacientes por nombre.
 * Usado por el modal de reportes para el buscador en tiempo real.
 *
 * GET /api/buscar-pacientes?q=texto
 * Devuelve: [{ id, nombre, edad }]
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const GET: APIRoute = async ({ url }) => {
    const q = url.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
        return new Response(JSON.stringify([]), { status: 200 });
    }

    const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_KEY
    );

    const { data, error } = await supabase
        .from("pacientes")
        .select("id, nombre, edad")
        .ilike("nombre", `%${q}%`)
        .eq("tipo_paciente", "sueno")
        .order("nombre")
        .limit(10);

    if (error) {
        return new Response(JSON.stringify({ error: "Error en búsqueda" }), {
        status: 500,
        });
    }

    return new Response(JSON.stringify(data ?? []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
};