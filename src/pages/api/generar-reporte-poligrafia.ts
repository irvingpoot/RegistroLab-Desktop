/**
 * @file generar-reporte-poligrafia.ts
 * @description Genera el reporte de poligrafía nocturna en PDF usando pdf-lib.
 *
 * - La firma debe estar en el bucket "assets" de Supabase Storage (fuera del repo)
 * - El fondo (fondo_sueno.png) también debe estar en el bucket "assets"
 *
 * Dependencias:
 *   npm install pdf-lib
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

const descargarDeStorage = async (path: string): Promise<Buffer> => {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_KEY
  );

  const { data, error } = await supabase.storage
    .from("assets")
    .download(path);

  if (error || !data) {
    throw new Error(`No se pudo descargar '${path}' de Supabase Storage: ${error?.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
};

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

const clasificarPsqi = (p: number | null): { categoria: string } => {
  if (p === null) return { categoria: "Sin datos" };
  if (p < 5)  return { categoria: "Sin alteración en la calidad de sueño" };
  if (p < 10) return { categoria: "Alteración leve en la calidad de sueño" };
  if (p < 15) return { categoria: "Alteración moderada en la calidad de sueño" };
  return { categoria: "Alteración de moderada a grave en la calidad de sueño" };
};

const clasificarBerlin = (cat1: boolean | null, cat2: boolean | null, cat3: boolean | null): string => {
  if (cat1 === null && cat2 === null && cat3 === null) return "Sin datos del cuestionario de Berlín.";
  const etiquetas = [
    cat1 ? "la 1) Síntomas persistentes de ronquidos y apneas" : null,
    cat2 ? "la 2) Síntomas persistentes de somnolencia diurna" : null,
    cat3 ? "la 3) Hipertensión" : null,
  ].filter((c): c is string => c !== null);
  if (etiquetas.length === 0) return "En el cuestionario de Berlín para SAOS no obtuvo categorías positivas, indicando bajo riesgo.";
  return `En el cuestionario de Berlín para SAOS (síndrome de apnea obstructiva del sueño) obtuvo ${etiquetas.length === 1 ? "una categoría positiva" : `${etiquetas.length} categorías positivas`}, ${etiquetas.join(", ")}.`;
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
const START_Y_P1    = 628;
const START_Y       = 628;
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

// Token: unidad mínima de texto con su estilo
interface Token { word: string; bold: boolean }

/**
 * Convierte texto con **negrita** en una lista plana de tokens palabra a palabra.
 */
const tokenizar = (text: string): Token[] => {
  const tokens: Token[] = [];
  for (const seg of parsearSegmentos(text)) {
    for (const word of seg.text.split(" ")) {
      if (word) tokens.push({ word, bold: seg.bold });
    }
  }
  return tokens;
};

// Línea lista para dibujar: lista de tokens + flag si es la última
interface LineTokens { tokens: Token[]; isLast: boolean }

/**
 * Divide los tokens en líneas respetando maxWidth.
 * Usa fontReg para medir (aproximación conservadora; la negrita es ligeramente
 * más ancha pero la diferencia es mínima para Helvetica/HelveticaBold).
 */
const dividirTokensEnLineas = (
  tokens: Token[],
  fontReg: PDFFont,
  fontBold: PDFFont,
  size: number,
  maxWidth: number,
  firstLineIndent: number = 0
): LineTokens[] => {
  const lines: Token[][] = [];
  let currentLine: Token[] = [];
  let currentWidth = 0;

  for (const token of tokens) {
    const f = token.bold ? fontBold : fontReg;
    const wordWidth = f.widthOfTextAtSize(token.word, size);
    const spaceWidth = fontReg.widthOfTextAtSize(" ", size);
    const lineMaxWidth = lines.length === 0 ? maxWidth - firstLineIndent : maxWidth;

    const neededWidth = currentLine.length === 0
      ? wordWidth
      : currentWidth + spaceWidth + wordWidth;

    if (neededWidth <= lineMaxWidth) {
      currentLine.push(token);
      currentWidth = neededWidth;
    } else {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [token];
      currentWidth = wordWidth;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return lines.map((toks, i) => ({ tokens: toks, isLast: i === lines.length - 1 }));
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

/**
 * Dibuja texto con soporte para **negrita**, justificado, línea a línea,
 * con salto de página automático. No pierde palabras.
 */
const drawJustifiedText = async (
  ctx: WriteContext,
  text: string,
  x: number,
  maxWidth: number,
  size: number,
  firstLineIndent: number = 0
): Promise<void> => {
  const tokens = tokenizar(text);
  const lineas = dividirTokensEnLineas(tokens, ctx.fontReg, ctx.fontBold, size, maxWidth, firstLineIndent);

  for (const [lineIdx, { tokens: lineToks, isLast }] of lineas.entries()) {
    if (ctx.y < MARGIN_BOTTOM) await addPage(ctx);

    const page    = currentPage(ctx);
    const isFirst = lineIdx === 0;
    const lineX   = isFirst ? x + firstLineIndent : x;
    const lineMaxWidth = isFirst ? maxWidth - firstLineIndent : maxWidth;
    const spaceW  = ctx.fontReg.widthOfTextAtSize(" ", size);

    if (isLast || lineToks.length === 1) {
      // Última línea: alineada a la izquierda, respetando bold por token
      let xCursor = lineX;
      for (const tok of lineToks) {
        const f = tok.bold ? ctx.fontBold : ctx.fontReg;
        page.drawText(tok.word, { x: xCursor, y: ctx.y, size, font: f, color: COLOR_BLACK });
        xCursor += f.widthOfTextAtSize(tok.word, size) + spaceW;
      }
    } else {
      // Líneas intermedias: justificadas
      // Calcular ancho total de palabras para distribuir el espacio sobrante
      const totalWordWidth = lineToks.reduce((acc, tok) => {
        const f = tok.bold ? ctx.fontBold : ctx.fontReg;
        return acc + f.widthOfTextAtSize(tok.word, size);
      }, 0);
      const gap = lineToks.length > 1
        ? (lineMaxWidth - totalWordWidth) / (lineToks.length - 1)
        : 0;

      let xCursor = lineX;
      for (const tok of lineToks) {
        const f = tok.bold ? ctx.fontBold : ctx.fontReg;
        page.drawText(tok.word, { x: xCursor, y: ctx.y, size, font: f, color: COLOR_BLACK });
        xCursor += f.widthOfTextAtSize(tok.word, size) + gap;
      }
    }

    ctx.y -= LINE_HEIGHT;
  }
};

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
    align?: "left" | "center";
  } = {}
): Promise<void> => {
  const { size = 11, indent = 0, firstLineIndent = 0, bold = false, spaceBefore = 0, spaceAfter = LINE_HEIGHT } = opts;
  const font = bold ? ctx.fontBold : ctx.fontReg;
  const maxWidth = TEXT_WIDTH - indent;
  const x = MARGIN_LEFT + indent;

  ctx.y -= spaceBefore;

  // Salto de página preventivo si la primera línea ya no cabe
  if (ctx.y < MARGIN_BOTTOM) {
    await addPage(ctx);
  }

  if (opts.align === "center") {
    const textW = font.widthOfTextAtSize(text, size);
    const xCentered = PAGE_W / 2 - textW / 2;
    currentPage(ctx).drawText(text, { x: xCentered, y: ctx.y, size, font, color: COLOR_BLACK });
    ctx.y -= LINE_HEIGHT + spaceAfter;
    return;
  }

  await drawJustifiedText(ctx, text, x, maxWidth, size, firstLineIndent);
  ctx.y -= spaceAfter;
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

  // Fondo descargado desde Supabase Storage (compatible con Vercel)
  const [bgBytes, firmaBytes] = await Promise.all([
    descargarDeStorage("fondo_sueno.png"),
    descargarDeStorage("firma.png"),
  ]);
  const pdfDoc   = await PDFDocument.create();
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page1   = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const bgEmbed = await pdfDoc.embedPng(bgBytes);
  page1.drawImage(bgEmbed, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const ctx: WriteContext = { pdfDoc, pages: [page1], bgBytes, fontReg, fontBold, y: START_Y_P1 };
  const nl = params.totalNoches === 1 ? "noche" : "noches";
  const n  = params.totalNoches;

  await write(ctx, `**NOMBRE: ${params.nombre}**`, { spaceAfter: 3 });
  await write(ctx, `**EDAD: ${params.edad} AÑOS.**`, { spaceAfter: 3 });
  await write(ctx, `**FECHA: ${params.fechaReporte}.**`, { spaceAfter: 20 });

  await write(ctx, "Reporte técnico", { spaceAfter: 8, align: "center", bold: true });
  await write(ctx, "POLIGRAFÍA NOCTURNA", { spaceAfter: 8, align: "center", bold: true });
  await write(ctx,
    "Se realizó un estudio de poligrafía nocturna para la detección de alteraciones de la respiración durante el sueño mediante el equipo Apnea Link, registrando 4 canales: flujo de aire, saturación de oxígeno, frecuencia cardíaca, esfuerzo respiratorio.",
    { firstLineIndent: 30, spaceAfter: 16 }
  );

  await write(ctx, "RESULTADOS", { align: "center", bold: true, spaceAfter: 8 });
  await write(ctx,
    `El estudio se realizó en ${n} ${nl}, en las cuales se registraron ${params.duracionesTexto} respectivamente, para dar un total de ${params.duracionTotalEval}.`,
    { firstLineIndent: 30, spaceAfter: 16 }
  );

  await write(ctx, "**Alteraciones de la respiración**", { spaceAfter: 8 });
  await write(ctx,
    `Los índices de apnea e hipopnea (IAH) por noche fueron: ${params.iahPorNoche}. El promedio de las ${n} ${nl} fue de **IAH = ${params.iahPromedio ?? "—"} eventos por hora**. Los eventos fueron ${params.tipoApnea}. Durante el estudio se obtuvo un promedio de **${params.ronquidosPromedio ?? "—"} ronquidos** en las ${n} ${nl}.`,
    { firstLineIndent: 30, spaceAfter: 12 }
  );
  await write(ctx,
    `La **saturación promedio de oxígeno** durante el sueño fue del ${params.satPorNoche} respectivamente, con un promedio de ${params.satPromedio ?? "—"}%. Los **índices de desaturación de oxígeno** fueron de ${params.idoPorNoche}, promediando **${params.idoPromedio ?? "—"} eventos por hora** a lo largo de las ${n} ${nl}.`,
    { spaceAfter: 10 }
  );
  await write(ctx,
    `La saturación de **oxígeno menor al 90%** fue del ${params.sat90PorNoche} respectivamente. La saturación de **oxígeno menor al 85%** fue del ${params.sat85PorNoche} respectivamente.`,
    { spaceAfter: 16 }
  );

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

  await write(ctx, "RECOMENDACIONES", { spaceAfter: 8, align: "center", bold: true });
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

  if (ctx.y < 160) await addPage(ctx);

  const pg  = currentPage(ctx);
  const cx  = PAGE_W / 2;
  const fw  = 200;
  const firmaImg   = await pdfDoc.embedPng(firmaBytes);
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

  const [{ data: paciente, error: errP }, { data: nochesRaw, error: errN }, { data: berlinRaw }, { data: psqiRaw }] = await Promise.all([
    supabase.from("pacientes").select("nombre, edad, epworth_pre, psqi_pre").eq("id", pacienteId).single(),
    supabase.from("pacientes_reportes_sueno").select("*").eq("paciente_id", pacienteId).order("created_at", { ascending: true }),
    supabase.from("respuestas_cuestionarios").select("datos").eq("paciente_id", pacienteId).eq("fase", "pre").eq("cuestionario", "berlin").maybeSingle(),
    supabase.from("respuestas_cuestionarios").select("datos").eq("paciente_id", pacienteId).eq("fase", "pre").eq("cuestionario", "psqi").maybeSingle(),
  ]);

  const berlinDatos = berlinRaw?.datos as Record<string, string> | null ?? null;
  const esPositiva  = (v: string | undefined) => typeof v === "string" && v.toUpperCase().includes("POSITIVA");
  const berlin = berlinDatos ? {
    cat1: esPositiva(berlinDatos["Resultado Categoría 1 (Ronquido)"]),
    cat2: esPositiva(berlinDatos["Resultado Categoría 2 (Somnolencia)"]),
    // Compatible con registros nuevos (Hipertensión) y antiguos (Presión Arterial)
    cat3: esPositiva(berlinDatos["Resultado Categoría 3 (Hipertensión)"]) ||
          esPositiva(berlinDatos["Resultado Categoría 3 (Presión Arterial)"]),
  } : null;

  const PSQI_COMPONENTES: [string, string][] = [
    ["C1 Calidad",        "calidad subjetiva de sueño"],
    ["C2 Latencia",       "latencia del sueño"],
    ["C3 Duración",       "duración del sueño"],
    ["C4 Eficiencia",     "eficiencia habitual del sueño"],
    ["C5 Perturbaciones", "perturbación del sueño"],
    ["C6 Medicación",     "uso de medicación hipnótica"],
    ["C7 Disfunción",     "disfunción diurna"],
  ];
  const psqiDatos = psqiRaw?.datos as Record<string, string> | null ?? null;
  const psqiObservaciones = (() => {
    if (!psqiDatos) return "";
    const alteradas = PSQI_COMPONENTES
      .filter(([key]) => parseInt(psqiDatos[key] ?? "0") >= 3)
      .map(([, label]) => label);
    if (!alteradas.length) return "";
    return `, con observaciones en ${alteradas.join(", ")}.`;
  })();

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
      psqi: { ...clasificarPsqi(paciente.psqi_pre), observaciones: psqiObservaciones },
      berlinTexto: clasificarBerlin(berlin?.cat1 ?? null, berlin?.cat2 ?? null, berlin?.cat3 ?? null),
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