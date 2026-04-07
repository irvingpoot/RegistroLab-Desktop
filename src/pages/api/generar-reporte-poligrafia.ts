/**
 * @file generar-reporte-poligrafia.ts
 * @description Genera el reporte de poligrafía nocturna en PDF usando pdf-lib.
 *
 * - Sin dependencias externas (no LibreOffice, no CloudConvert)
 * - Compatible con Vercel free tier (~200ms de ejecución)
 * - La imagen de fondo debe estar en src/assets/fondo_sueno.png
 *
 * Dependencias:
 *   npm install pdf-lib
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

interface Noche {
  id: number;
  created_at: string;
  duracion_registro: string | null;
  duracion_evaluacion: string | null;
  iah: number | null;
  indice_apneas: number | null;
  indice_hipopnea: number | null;
  iai: number | null;
  iao: number | null;
  iac: number | null;
  iam: number | null;
  ido: number | null;
  saturacion_promedio: number | null;
  pulso_promedio: number | null;
  ronquidos: number | null;
  sat_90_min: number | null;
  sat_90_porc: number | null;
  sat_85_min: number | null;
  sat_85_porc: number | null;
}


const duracionAMinutos = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/(\d+)h\s*(\d+)m/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
};

const minutosATexto = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const ht = h === 1 ? "1 hora" : `${h} horas`;
  const mt = m === 1 ? "1 minuto" : `${m} minutos`;
  if (h === 0) return mt;
  if (m === 0) return ht;
  return `${ht} con ${mt}`;
};

const promedioN = (noches: Noche[], campo: keyof Noche): number | null => {
  const vals = noches
    .map((n) => n[campo] as number | null)
    .filter((v): v is number => v !== null && !isNaN(v));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
};


const clasificarEpworth = (p: number | null): string => {
  if (p === null) return "Sin datos";
  if (p <= 10) return "Sin somnolencia significativa";
  if (p <= 12) return "Somnolencia leve";
  if (p <= 15) return "Somnolencia moderada";
  return "Somnolencia diurna excesiva";
};

const clasificarPsqi = (p: number | null): { categoria: string; observaciones: string } => {
  if (p === null) return { categoria: "Sin datos", observaciones: "" };
  if (p <= 5)  return { categoria: "Sin alteración en la calidad de sueño", observaciones: "" };
  if (p <= 10) return { categoria: "Alteración leve en la calidad de sueño", observaciones: ", con posibles observaciones en la calidad subjetiva de sueño y disfunción diurna." };
  if (p <= 15) return { categoria: "Alteración moderada en la calidad de sueño", observaciones: ", con observaciones en la calidad subjetiva de sueño, latencia del sueño, eficiencia habitual del sueño y perturbación del sueño." };
  return { categoria: "Alteración de moderada a grave en la calidad de sueño", observaciones: ", con observaciones en la calidad subjetiva de sueño, latencia del sueño, eficiencia habitual del sueño, perturbación del sueño, uso de medicación hipnótica y disfunción diurna." };
};

const clasificarBerlin = (p: number | null): string => {
  if (p === null) return "Sin datos del cuestionario de Berlín.";
  if (p === 0) return "En el cuestionario de Berlín para SAOS no obtuvo categorías positivas, indicando bajo riesgo.";
  const cats = ["la 1) Síntomas persistentes de ronquidos y apneas", "la 2) Síntomas persistentes de somnolencia diurna", "la 3) Hipertensión"];
  return `En el cuestionario de Berlín para SAOS (síndrome de apnea obstructiva del sueño) obtuvo ${p === 1 ? "una categoría positiva" : `${p} categorías positivas`}, ${cats.slice(0, p).join(", ")}.`;
};

const clasificarSaos = (iah: number | null): string => {
  if (iah === null) return "indeterminado";
  if (iah < 5)  return "normal (sin SAOS)";
  if (iah < 15) return "leve";
  if (iah < 30) return "moderado";
  return "grave";
};

const tipoApneaPredominante = (noches: Noche[]): string => {
  const iao = promedioN(noches, "iao") ?? 0;
  const iac = promedioN(noches, "iac") ?? 0;
  const iam = promedioN(noches, "iam") ?? 0;
  const max = Math.max(iao, iac, iam);
  if (max === 0) return "apneas no clasificadas";
  if (max === iao) return "predominantemente de apneas obstructivas";
  if (max === iac) return "predominantemente de apneas centrales";
  return "predominantemente de apneas mixtas";
};


const PAGE_W        = 612;
const PAGE_H        = 792;
const MARGIN_LEFT   = 72;
const MARGIN_RIGHT  = 520;
const TEXT_WIDTH    = MARGIN_RIGHT - MARGIN_LEFT;
const START_Y_P1    = 648;
const START_Y       = 648;
const MARGIN_BOTTOM = 65;
const LINE_HEIGHT   = 22;
const COLOR_BLACK   = rgb(0, 0, 0);

interface Segment { text: string; bold: boolean }

const parsearSegmentos = (text: string): Segment[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map(p =>
    p.startsWith("**") && p.endsWith("**")
      ? { text: p.slice(2, -2), bold: true }
      : { text: p, bold: false }
  );

const dividirEnLineas = (words: string[], font: PDFFont, size: number, maxWidth: number, firstLineIndent: number = 0): string[] => {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const currentMaxWidth = lines.length === 0 ? maxWidth - firstLineIndent : maxWidth;

    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= currentMaxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const drawJustifiedText = (
  page: PDFPage,
  text: string,
  fontReg: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  firstLineIndent: number = 0
): void => {
  const segmentos = parsearSegmentos(text);
  const textoPlano = segmentos.map(s => s.text).join("");
  const words = textoPlano.split(" ");
  const lines = dividirEnLineas(words, fontReg, size, maxWidth, firstLineIndent);

  let currentY = y;
  lines.forEach((line, lineIdx) => {
    const isFirst = lineIdx === 0;
    const isLast = lineIdx === lines.length - 1;
    
    const lineX = isFirst ? x + firstLineIndent : x;
    const lineMaxWidth = isFirst ? maxWidth - firstLineIndent : maxWidth;
    const lineWords = line.split(" ");

    if (isLast || lineWords.length === 1) {
      let xCursor = lineX;
      let remaining = line;
      for (const seg of segmentos) {
        if (!remaining || !seg.text) continue;
        const segWords = seg.text.split(" ").filter(Boolean);
        let drawn = "";
        for (const sw of segWords) {
          if (remaining.startsWith(sw)) {
            drawn += (drawn ? " " : "") + sw;
            remaining = remaining.slice(sw.length).replace(/^ /, "");
          }
        }
        if (drawn) {
          const f = seg.bold ? fontBold : fontReg;
          page.drawText(drawn, { x: xCursor, y: currentY, size, font: f, color: COLOR_BLACK });
          xCursor += f.widthOfTextAtSize(drawn + " ", size);
        }
      }
      if (xCursor === lineX) {
        page.drawText(line, { x: lineX, y: currentY, size, font: fontReg, color: COLOR_BLACK });
      }
    } else {
      const textWidth = fontReg.widthOfTextAtSize(lineWords.join(""), size);
      const gap = (lineMaxWidth - textWidth) / (lineWords.length - 1);
      let xp = lineX;
      lineWords.forEach(word => {
        page.drawText(word, { x: xp, y: currentY, size, font: fontReg, color: COLOR_BLACK });
        xp += fontReg.widthOfTextAtSize(word, size) + gap;
      });
    }
    currentY -= LINE_HEIGHT;
  });
};

interface WriteContext {
  pdfDoc: PDFDocument;
  pages: PDFPage[];
  bgBytes: Buffer;
  fontReg: PDFFont;
  fontBold: PDFFont;
  y: number;
}

const addPage = async (ctx: WriteContext): Promise<void> => {
  const page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H]);
  const bg = await ctx.pdfDoc.embedPng(ctx.bgBytes);
  page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  ctx.pages.push(page);
  ctx.y = START_Y;
};

const currentPage = (ctx: WriteContext): PDFPage => ctx.pages[ctx.pages.length - 1];

const write = async (
  ctx: WriteContext,
  text: string,
  opts: {
    size?: number;
    indent?: number;
    firstLineIndent?: number;
    bold?: boolean;
    spaceBefore?: number;
    spaceAfter?: number;
  } = {}
): Promise<void> => {
  const { size = 11, indent = 0, firstLineIndent = 0, bold = false, spaceBefore = 0, spaceAfter = LINE_HEIGHT } = opts;
  const font = bold ? ctx.fontBold : ctx.fontReg;
  const maxWidth = TEXT_WIDTH - indent;
  const x = MARGIN_LEFT + indent;

  ctx.y -= spaceBefore;

  const words = text.split(" ");
  const lines = dividirEnLineas(words, font, size, maxWidth, firstLineIndent);
  const totalHeight = lines.length * LINE_HEIGHT;

  if (ctx.y - totalHeight < MARGIN_BOTTOM) {
    await addPage(ctx);
  }

  drawJustifiedText(currentPage(ctx), text, ctx.fontReg, ctx.fontBold, x, ctx.y, maxWidth, size, firstLineIndent);
  ctx.y -= totalHeight + spaceAfter;
};

const generarPDF = async (params: {
  nombre: string;
  edad: number;
  fechaReporte: string;
  totalNoches: number;
  duracionesTexto: string;
  duracionTotalEval: string;
  iahPorNoche: string;
  iahPromedio: number | null;
  tipoApnea: string;
  ronquidosPromedio: number | null;
  satPorNoche: string;
  satPromedio: number | null;
  idoPorNoche: string;
  idoPromedio: number | null;
  sat90PorNoche: string;
  sat85PorNoche: string;
  epworthPuntaje: number | null;
  epworthCat: string;
  psqiPuntaje: number | null;
  psqi: { categoria: string; observaciones: string };
  berlinTexto: string;
  saosNivel: string;
  recomendaciones: string[];
}): Promise<Uint8Array> => {

  const bgBytes = readFileSync(join(process.cwd(), "src", "assets", "fondo_sueno.png"));
  const pdfDoc  = await PDFDocument.create();
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Primera página
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const bgEmbed = await pdfDoc.embedPng(bgBytes);
  page1.drawImage(bgEmbed, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const ctx: WriteContext = { pdfDoc, pages: [page1], bgBytes, fontReg, fontBold, y: START_Y_P1 };
  const nl = params.totalNoches === 1 ? "noche" : "noches";
  const n = params.totalNoches;

  // ── ENCABEZADO ─────────────────────────────────────────────────────────────
  await write(ctx, `**NOMBRE: ${params.nombre}**`, { spaceAfter: 3 });
  await write(ctx, `**EDAD: ${params.edad} AÑOS.**`, { spaceAfter: 3 });
  await write(ctx, `**FECHA: ${params.fechaReporte}.**`, { spaceAfter: 20 });

  // ── SECCIÓN: Poligrafía nocturna ───────────────────────────────────────────
  await write(ctx, "**Poligrafía nocturna**", { spaceAfter: 8 });
  await write(ctx,
    "Se realizó un estudio de poligrafía nocturna para la detección de alteraciones de la respiración durante el sueño mediante el equipo Apnea Link, registrando 4 canales: flujo de aire, saturación de oxígeno, frecuencia cardíaca, esfuerzo respiratorio.",
    { firstLineIndent: 30, spaceAfter: 16 }
  );

  // ── SECCIÓN: Resultados ────────────────────────────────────────────────────
  await write(ctx, "**Resultados**", { spaceAfter: 8 });
  await write(ctx,
    `El estudio se realizó en ${n} ${nl}, en las cuales se registraron ${params.duracionesTexto} respectivamente, para dar un total de ${params.duracionTotalEval}.`,
    { firstLineIndent: 30, spaceAfter: 16 }
  );

  // ── SECCIÓN: Alteraciones ─────────────────────────────────────────────────
  await write(ctx, "**Alteraciones de la respiración**", { spaceAfter: 8 });
  await write(ctx,
    `Los índices de apnea e hipopnea (IAH) por noche fueron: ${params.iahPorNoche}. El promedio de las ${n} ${nl} fue de **IAH = ${params.iahPromedio ?? "—"} eventos por hora**. Los eventos fueron ${params.tipoApnea}. Durante el estudio se obtuvo un promedio de **${params.ronquidosPromedio ?? "—"} ronquidos** en las ${n} ${nl}.`,
    { firstLineIndent: 30, spaceAfter: 12 }
  );
  await write(ctx,
    `La **saturación promedio de oxígeno** durante el sueño fue del ${params.satPorNoche} respectivamente, con un promedio de ${params.satPromedio ?? "—"}%. Los **índices de desaturación de oxígeno** fueron de ${params.idoPorNoche}, promediando **${params.idoPromedio ?? "—"} eventos por hora** a lo largo de las ${n} ${nl}.`,
    { spaceAfter: 12 }
  );
  await write(ctx,
    `La saturación de **oxígeno menor al 90%** fue del ${params.sat90PorNoche} respectivamente. La saturación de **oxígeno menor al 85%** fue del ${params.sat85PorNoche} respectivamente.`,
    { spaceAfter: 12 }
  );

  // ── SECCIÓN: Datos de autoinforme ──────────────────────────────────────────
  await write(ctx, "**Datos de autoinforme**", { spaceAfter: 8 });
  await write(ctx,
    `En la escala de somnolencia de Epworth obtuvo ${params.epworthPuntaje ?? "—"} puntos de una puntuación máxima de 24, lo cual lo ubica en la categoría: **${params.epworthCat}.**`,
    { firstLineIndent: 30, spaceAfter: 12 }
  );
  await write(ctx,
    `En el cuestionario de calidad de sueño de Pittsburgh obtuvo ${params.psqiPuntaje ?? "—"} puntos, ubicándolo en la categoría: **${params.psqi.categoria}**${params.psqi.observaciones}`,
    { firstLineIndent: 30, spaceAfter: 12 }
  );
  await write(ctx, params.berlinTexto, { firstLineIndent: 30, spaceAfter: 16 });

  // ── SECCIÓN: Recomendaciones ───────────────────────────────────────────────
  await write(ctx, "**Recomendaciones**", { spaceAfter: 8 });
  await write(ctx,
    `- Con base al IAH promedio de las ${n} ${nl} (**IAH = ${params.iahPromedio ?? "—"} eventos**), se considera la **presencia de Síndrome de Apnea Obstructiva del Sueño (SAOS) en nivel ${params.saosNivel}, con predominio de ${params.tipoApnea}.** Se obtuvo un promedio de ${params.ronquidosPromedio ?? "—"} eventos relacionados con ronquidos, los cuales se pueden valorar clínicamente como posible causa de la alteración de la calidad del sueño y la somnolencia diurna excesiva.`,
    { spaceAfter: 10 }
  );

  if (params.recomendaciones.includes("cpap")) {
    await write(ctx,
      "- Se recomienda la valoración del uso de ventilación mecánica no invasiva, mediante presión positiva continua de la vía aérea superior (CPAP, por sus siglas en inglés). Realizar seguimiento mediante ensayo terapéutico con CPAP.",
      { spaceAfter: 10 }
    );
  }
  if (params.recomendaciones.includes("orl")) {
    await write(ctx,
      "- Se recomienda revisión de otorrinolaringología para valorar oclusiones en la vía aérea superior. Asimismo, se recomienda lograr un peso corporal saludable por su relación con las alteraciones de la respiración durante el sueño, como el ronquido y el SAOS.",
      { spaceAfter: 10 }
    );
  }
  if (params.recomendaciones.includes("posicion")) {
    await write(ctx,
      "- Se recomienda dormir en posición lateral evitando la posición supina (boca arriba). En algunos pacientes la posición supina contribuye a la aparición y gravedad de eventos obstructivos durante el sueño.",
      { spaceAfter: 10 }
    );
  }
  if (params.recomendaciones.includes("autoinforme")) {
    await write(ctx,
      "- Respecto a los resultados de auto informe del sueño, la somnolencia diurna excesiva suele ser un síntoma de la apnea obstructiva que puede mejorar después de la atención de los síntomas relacionados con el problema respiratorio. Asimismo, se recomienda psicoeducación y orientación sobre estrategias para la higiene de sueño y su ciclo circadiano.",
      { spaceAfter: 10 }
    );
  }

  await write(ctx, "Se anexan los datos del estudio de poligrafía respiratoria.", { spaceAfter: 36 });

  // ── FIRMA ──────────────────────────────────────────────────────────────────
  if (ctx.y < 160) await addPage(ctx);

  const pg   = currentPage(ctx);
  const cx   = PAGE_W / 2;
  const fw   = 200;
  const firmaBytes = readFileSync(join(process.cwd(), "src", "assets", "firma.png"));
  const firmaImg   = await pdfDoc.embedPng(firmaBytes)
  const firmaW = 100;
  const firmaH = firmaImg.height * (firmaW / firmaImg.width);

  const atenText = "A T E N T A M E N T E";
  const atenW = fontBold.widthOfTextAtSize(atenText, 11);
  pg.drawText(atenText, { x: cx - atenW / 2, y: ctx.y, size: 11, font: fontBold, color: COLOR_BLACK });
  ctx.y -= 80;

  pg.drawImage(firmaImg, {
    x: cx - firmaW / 2, 
    y: ctx.y + 5,       
    width: firmaW,
    height: firmaH,
  });

  pg.drawLine({ start: { x: cx - fw / 2, y: ctx.y }, end: { x: cx + fw / 2, y: ctx.y }, thickness: 1, color: COLOR_BLACK });
  ctx.y -= 14;

  for (const [txt] of [["DR. JESÚS MOO ESTRELLA"], ["Laboratorio del Sueño y Neurociencias"], ["jmestre@correo.uady.mx"]]) {
    const tw = fontBold.widthOfTextAtSize(txt, 10);
    pg.drawText(txt, { x: cx - tw / 2, y: ctx.y, size: 10, font: fontBold, color: COLOR_BLACK });
    ctx.y -= 14;
  }

  return pdfDoc.save();
};

export const POST: APIRoute = async ({ request }) => {
  let pacienteId: string;
  let recomendaciones: string[];

  try {
    const body = await request.json();
    pacienteId = String(body.paciente_id);
    recomendaciones = Array.isArray(body.recomendaciones) ? body.recomendaciones : [];
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 });
  }

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_KEY
  );

  const [{ data: paciente, error: errP }, { data: nochesRaw, error: errN }] = await Promise.all([
    supabase.from("pacientes").select("nombre, edad, epworth_pre, psqi_pre, berlin_pre").eq("id", pacienteId).single(),
    supabase.from("pacientes_reportes_sueno").select("*").eq("paciente_id", pacienteId).order("created_at", { ascending: true }),
  ]);

  if (errP || !paciente)
    return new Response(JSON.stringify({ error: "Paciente no encontrado" }), { status: 404 });
  if (errN)
    return new Response(JSON.stringify({ error: "Error al obtener noches" }), { status: 500 });

  const noches: Noche[] = nochesRaw ?? [];
  if (!noches.length)
    return new Response(JSON.stringify({ error: "El paciente no tiene noches de poligrafía registradas" }), { status: 422 });

  const totalNoches       = noches.length;
  const duracionesTexto   = noches.map(n => { const m = duracionAMinutos(n.duracion_evaluacion); return m ? minutosATexto(m) : "—"; }).join(", ");
  const totalMinEval      = noches.reduce((a, n) => a + (duracionAMinutos(n.duracion_evaluacion) ?? 0), 0);
  const iahPromedio       = promedioN(noches, "iah");
  const idoPromedio       = promedioN(noches, "ido");
  const satPromedio       = promedioN(noches, "saturacion_promedio");
  const ronquidosPromedio = promedioN(noches, "ronquidos");
  const iahPorNoche       = noches.map((n, i) => `IAH noche ${i + 1} = ${n.iah ?? "—"}`).join(", ");
  const satPorNoche       = noches.map((n, i) => `${n.saturacion_promedio ?? "—"}% (noche ${i + 1})`).join(", ");
  const idoPorNoche       = noches.map((n, i) => `${n.ido ?? "—"} (noche ${i + 1})`).join(", ");
  const sat90PorNoche     = noches.map((n, i) => `${n.sat_90_porc ?? "—"}% (${n.sat_90_min ?? "—"} min) en la noche ${i + 1}`).join(", ");
  const sat85PorNoche     = noches.map((n, i) => `${n.sat_85_porc ?? "—"}% (${n.sat_85_min ?? "—"} min) en la noche ${i + 1}`).join(", ");

  try {
    const pdfBytes = await generarPDF({
      nombre: paciente.nombre,
      edad: paciente.edad,
      fechaReporte: new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }),
      totalNoches,
      duracionesTexto,
      duracionTotalEval: minutosATexto(totalMinEval),
      iahPorNoche,
      iahPromedio,
      tipoApnea: tipoApneaPredominante(noches),
      ronquidosPromedio,
      satPorNoche,
      satPromedio,
      idoPorNoche,
      idoPromedio,
      sat90PorNoche,
      sat85PorNoche,
      epworthPuntaje: paciente.epworth_pre,
      epworthCat: clasificarEpworth(paciente.epworth_pre),
      psqiPuntaje: paciente.psqi_pre,
      psqi: clasificarPsqi(paciente.psqi_pre),
      berlinTexto: clasificarBerlin(paciente.berlin_pre),
      saosNivel: clasificarSaos(iahPromedio),
      recomendaciones,
    });

    const nombreArchivo = `reporte_poligrafia_${paciente.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err: any) {
    console.error("Error generando PDF:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Error al generar el PDF" }), { status: 500 });
  }
};