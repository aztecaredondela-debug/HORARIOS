// ===== Gestión de horarios del fin de semana (usa datos.js) =====
const GK = "sar_gestion_v1";
let G = { pin: "", aj: {} }, sab = null, items = [];
try { G = { ...G, ...JSON.parse(localStorage.getItem(GK)) }; } catch {}
const guardarG = () => { try { localStorage.setItem(GK, JSON.stringify(G)); } catch {} };
const DSEM = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const sumarDias = (s, n) => { const [y, m, d] = s.split("-").map(Number); return diaStr(new Date(y, m - 1, d + n)); };
const fechaTxt = s => s.split("-").reverse().join("/");
const diaTxt = s => { const [y, m, d] = s.split("-").map(Number); return DSEM[new Date(y, m - 1, d).getDay()]; };
const sabadoProximo = () => { const h = new Date(), d = h.getDay(); h.setDate(h.getDate() + (d === 6 ? 0 : d === 0 ? 6 : 6 - d)); return diaStr(h); };
function el(t, txt, cls, padre) {
  const e = document.createElement(t);
  if (txt != null) e.textContent = txt;
  if (cls) e.className = cls;
  if (padre) padre.appendChild(e);
  return e;
}
const msg = (t, error) => { $("gestado").textContent = t; $("gestado").className = "sub" + (error ? " error" : ""); };

// ----- comunicación con el Worker (horarios compartidos) -----
async function api(metodo, cuerpo) {
  if (!PROXY) throw new Error("Falta la dirección del Worker en datos.js");
  const r = await fetch(PROXY + "/ajustes", {
    method: metodo,
    headers: { "X-Pin": G.pin, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { G.pin = ""; guardarG(); pedirPin(G.pin === "" && d.error ? "PIN incorrecto. Prueba otra vez:" : ""); throw new Error("PIN incorrecto"); }
  if (!r.ok) throw new Error(d.error || "error " + r.status);
  return d;
}
function pedirPin(texto) {
  $("panel").hidden = true; $("pinbox").hidden = false;
  $("pinmsg").textContent = texto || "Introduce el PIN del club:";
}

// ----- datos: partidos del SAR + ajustes del presidente -----
const clavePartido = r => `${r.cat}|${r.local}|${r.visitante}`;
function construir(rows) {
  return rows.map(r => {
    const k = clavePartido(r), o = G.aj[k] || {};
    const [f0 = "", h0 = ""] = r.ts ? r.ts.split(" ") : [];
    const hFed = h0 && h0 !== "00:00" ? h0 : "";
    const doble = r.sarL && r.sarV;
    return { r, k, o, casa: r.sarL, fFed: f0, hFed, fecha: o.fecha || f0, hora: o.hora || hFed, aplazado: !!o.aplazado, nota: o.nota || "",
      mio: doble ? `${r.local} / ${r.visitante}` : r.sarL ? r.local : r.visitante,
      riv: doble ? "(SAR vs SAR)" : r.sarL ? r.visitante : r.local };
  });
}
async function cargarG(refrescar) {
  msg("Cargando…");
  try { crudas = await datos(refrescar); } catch (e) { msg("Error con los partidos: " + e.message, true); return; }
  try { G.aj = (await api("GET")).ajustes; guardarG(); }
  catch (e) { if (e.message === "PIN incorrecto") return; msg("Sin conexión con el servidor de horarios: se muestran los últimos cambios guardados en este móvil. " + e.message, true); }
  $("pinbox").hidden = true; $("panel").hidden = false;
  items = construir(crudas);
  const sel = $("geq"), actual = sel.value;
  sel.length = 1;
  [...new Set(items.map(i => i.mio))].sort().forEach(n => el("option", n, null, sel).value = n);
  sel.value = actual;
  if ($("gestado").className.indexOf("error") < 0) msg("");
  pintar();
}

// ----- pantalla -----
function visibles() {
  const vie = sumarDias(sab, -1), dom = sumarDias(sab, 1), eq = $("geq").value;
  return items.filter(i => i.fecha >= vie && i.fecha <= dom && (!eq || i.mio === eq))
    .sort((a, b) => (a.fecha + (a.hora || "99:99")).localeCompare(b.fecha + (b.hora || "99:99")) || a.r.cat.localeCompare(b.r.cat));
}
const rangoTxt = () => `${fechaTxt(sumarDias(sab, -1)).slice(0, 5)} al ${fechaTxt(sumarDias(sab, 1))}`;
function pintar() {
  const l = visibles(), cont = $("glista"); cont.innerHTML = "";
  $("rango").textContent = "Vie–Dom " + rangoTxt();
  const casa = l.filter(i => i.casa), sinHora = casa.filter(i => !i.hora && !i.aplazado).length;
  $("gresumen").textContent = `${casa.length} en casa (${sinHora} sin hora) · ${l.length - casa.length} fuera · ${l.filter(i => i.aplazado).length} aplazados`;
  let dia = "";
  l.forEach(i => {
    if (i.fecha !== dia) { dia = i.fecha; el("h2", `${diaTxt(dia)} ${fechaTxt(dia)}`, null, cont); }
    tarjeta(i, cont);
  });
  if (!l.length) el("p", "No hay partidos de ese equipo en este fin de semana.", "sub", cont);
}
function tarjeta(i, cont) {
  const c = el("div", null, "p" + (i.aplazado ? " apl" : ""), cont), cab = el("div", null, "cab", c);
  el("span", i.casa ? "CASA" : "FUERA", "tag" + (i.casa ? " casa" : ""), cab);
  el("b", i.hora || "Sin hora", "hora" + (i.hora ? "" : " pend"), cab);
  if (i.aplazado) el("span", "APLAZADO", "tag apl", cab);
  el("div", `${i.r.cat} · ${i.mio} ${i.casa ? "vs" : "en"} ${i.riv}`, "tit", c);
  const cambios = [];
  if (i.o.hora && i.o.hora !== i.hFed) cambios.push("hora federación: " + (i.hFed || "sin hora"));
  if (i.o.fecha && i.o.fecha !== i.fFed) cambios.push("fecha federación: " + (i.fFed ? fechaTxt(i.fFed) : "sin fecha"));
  el("div", (i.r.pab || "Pabellón por confirmar") + (cambios.length ? " · ⚠ " + cambios.join(", ") : ""), "sub", c);
  if (i.nota && !i.casa) el("div", i.nota, "sub", c);
  if (!i.casa) return;
  const f = el("div", null, "fila", c);
  const campo = (t, tipo, val) => { const lb = el("label", t + " ", null, f), x = el("input", null, null, lb); x.type = tipo; if (tipo === "checkbox") x.checked = val; else x.value = val; return x; };
  const th = campo("Hora", "time", i.hora), tf = campo("Fecha", "date", i.fecha), ta = campo("Aplazado", "checkbox", i.aplazado), tn = campo("Nota", "text", i.nota);
  tn.maxLength = 200; tn.placeholder = "opcional";
  const guardar = async () => {
    const v = { hora: th.value === i.hFed ? "" : th.value, fecha: tf.value === i.fFed ? "" : tf.value, aplazado: ta.checked, nota: tn.value.trim() };
    msg("Guardando…");
    try {
      G.aj = (await api("POST", { key: i.k, valor: !v.hora && !v.fecha && !v.aplazado && !v.nota ? null : v })).ajustes; guardarG();
      items = construir(crudas); msg("Guardado ✓"); pintar();
    } catch (e) { msg("No se ha guardado: " + e.message, true); }
  };
  [th, tf, ta, tn].forEach(x => { x.onchange = guardar; });
}

// ----- compartir -----
function textoWA() {
  let t = `*PARTIDOS SAR · ${rangoTxt()}*\n`, dia = "";
  visibles().forEach(i => {
    if (i.fecha !== dia) { dia = i.fecha; t += `\n*${diaTxt(dia)} ${fechaTxt(dia).slice(0, 5)}*\n`; }
    t += `${i.casa ? "🏠" : "🚌"} ${i.hora || "hora por confirmar"} · ${i.r.cat} · ${i.mio} ${i.casa ? "vs" : "en"} ${i.riv}`
      + (i.aplazado ? " ⏸ APLAZADO" : "") + (i.casa ? "" : i.r.pab ? ` (${i.r.pab})` : "") + (i.nota ? ` · ${i.nota}` : "") + "\n";
  });
  return t.trim();
}
async function copiar() { try { await navigator.clipboard.writeText(textoWA()); return true; } catch { return false; } }
async function enviarWA(t) {
  const u = "https://wa.me/?text=" + encodeURIComponent(t);
  if (u.length > 6000) { msg((await navigator.clipboard.writeText(t).then(() => true, () => false)) ? "El mensaje es muy largo: lo he copiado. Pégalo en WhatsApp." : "El mensaje es muy largo."); return; }
  window.open(u, "_blank");
}
const whatsapp = () => enviarWA(textoWA());

// Mensaje corto para la cantina: solo partidos en casa del fin de semana (sin filtro de equipo)
function textoCantina() {
  const l = items.filter(i => i.casa && i.fecha >= sumarDias(sab, -1) && i.fecha <= sumarDias(sab, 1))
    .sort((a, b) => (a.fecha + (a.hora || "99:99")).localeCompare(b.fecha + (b.hora || "99:99")) || a.r.cat.localeCompare(b.r.cat));
  if (!l.length) return "";
  let t = "*CANTINA · PARTIDOS EN CASA*\n", dia = "";
  l.forEach(i => {
    if (i.fecha !== dia) { dia = i.fecha; t += `\n*${diaTxt(dia).toUpperCase()} ${fechaTxt(dia).slice(0, 5)}*\n`; }
    t += `${i.aplazado ? "⏸ APLAZADO" : "🕒 " + (i.hora || "hora por confirmar")} · ${i.r.cat} · ${i.mio} vs ${i.riv}\n`;
  });
  return t.trim();
}
function cantina() { const t = textoCantina(); if (t) enviarWA(t); else msg("No hay partidos en casa este fin de semana."); }
async function excelG() {
  const b = $("gexcel"), txt = b.textContent; b.textContent = "Generando…"; b.disabled = true;
  try {
    await cargarExcelJS();
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Fin de semana");
    ws.columns = [["Fecha", 12], ["Día", 11], ["Hora", 14], ["Casa/Fuera", 11], ["Categoría", 24], ["Equipo SAR", 24], ["Rival", 44], ["Pabellón", 44], ["Estado / nota", 36]].map(([header, width]) => ({ header, width }));
    ws.getRow(1).font = { bold: true };
    visibles().forEach(i => ws.addRow([fechaTxt(i.fecha), diaTxt(i.fecha), i.hora || "Por confirmar", i.casa ? "Casa" : "Fuera", i.r.cat, i.mio, i.riv,
      i.r.pab || "Por confirmar", [i.aplazado ? "APLAZADO" : "", i.nota].filter(Boolean).join(" · ")]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `Fin_de_semana_SAR_${sab}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (e) { msg("Error con el Excel: " + e.message, true); }
  b.textContent = txt; b.disabled = false;
}

// ===== Vestuarios: cuadrante de los partidos en casa =====
// Masculino / femenino según el patrocinador del equipo
const SEXO = [[/OPMOBILITY|GLOBALMAR|NOSATUN|GOYCAR|MARODRI/i, "M"], [/RODAVIGO|IMPERNOROESTE|BLUENEWABLES/i, "F"]];
const sexoDe = n => (SEXO.find(([re]) => re.test(n)) || [0, "?"])[1];
const ANTES = 45, DESPUES = 30;   // minutos que ocupa el vestuario antes y después del partido
// 1 = preferente (1ª Aut. masc. y DHP fem.), 2 = segunda opción (2ª Aut. masc. y 1ª Aut. fem.), 3 = base
function nivel(i) {
  const c = (i.r.cat + " " + i.r.comp).toUpperCase(), m = sexoDe(i.mio) === "M";
  if (/HONOR PLATA FEM/.test(c)) return 1;
  if (/1ª AUTON[OÓ]MICA/.test(c)) return m ? 1 : 2;
  if (/2ª AUTON[OÓ]MICA/.test(c)) return 2;
  return 3;
}
const durMin = i => { const c = i.r.cat.toUpperCase(); return /BENJAM/.test(c) ? 40 : /ALEV/.test(c) ? 50 : /INFANT/.test(c) ? 60 : 70; };
function asignarVestuarios(lista) {   // partidos de casa de un mismo día -> Map(partido -> 2 | 3 | null)
  const ocupado = { 2: [], 3: [] }, sol = new Map();
  const libre = (sala, [a, b]) => ocupado[sala].every(([c, d]) => b <= c || a >= d);
  lista.filter(i => i.hora && !i.aplazado).sort((x, y) => nivel(x) - nivel(y) || x.hora.localeCompare(y.hora)).forEach(i => {
    const [h, m] = i.hora.split(":").map(Number), t = h * 60 + m, w = [t - ANTES, t + durMin(i) + DESPUES];
    const pref = sexoDe(i.mio) === "F" ? 3 : 2, sala = [pref, pref === 2 ? 3 : 2].find(s => libre(s, w));
    if (sala) ocupado[sala].push(w);
    sol.set(i, sala || null);
  });
  return sol;
}
function pintarVest() {
  const cont = $("vlist"); cont.innerHTML = "";
  const vie = sumarDias(sab, -1), dom = sumarDias(sab, 1);
  $("vtitulo").textContent = `VESTUARIOS · partidos en casa · ${fechaTxt(sab).slice(0, 5)} y ${fechaTxt(dom)}`;
  const casa = items.filter(i => i.casa && i.fecha >= vie && i.fecha <= dom);
  if (!casa.length) { el("p", "No hay partidos en casa este fin de semana.", "sub", cont); return; }
  [...new Set(casa.map(i => i.fecha))].sort().forEach(dia => {
    const lista = casa.filter(i => i.fecha === dia), sol = asignarVestuarios(lista);
    el("h2", `${diaTxt(dia).toUpperCase()} ${fechaTxt(dia)}`, null, cont);
    const t = el("table", null, "vt", cont), tr0 = el("tr", null, null, el("thead", null, null, t));
    ["Hora", "Categoría", "Equipo SAR", "Vestuario SAR", "Rival", "Vestuario rival"].forEach(x => el("th", x, null, tr0));
    const tb = el("tbody", null, null, t);
    lista.sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99") || a.r.cat.localeCompare(b.r.cat)).forEach(i => {
      const sala = sol.get(i), tr = el("tr", null, null, tb);
      const aviso = i.aplazado ? "APLAZADO" : !i.hora ? "FALTA HORA" : !sala ? "SIN HUECO ⚠" : "";
      el("td", i.hora || "—", "b", tr); el("td", i.r.cat, null, tr); el("td", i.mio, "b", tr);
      el("td", aviso || sala, "sala" + (aviso ? " conf" : ""), tr);
      el("td", i.riv, null, tr); el("td", aviso ? "" : sala === 2 ? 1 : 4, "sala", tr);
    });
  });
}
function abrirVest() { $("panel").hidden = true; $("vest").hidden = false; pintarVest(); window.scrollTo(0, 0); }
function cerrarVest() { $("vest").hidden = true; $("panel").hidden = false; }

// ----- arranque -----
$("ant").onclick = () => { sab = sumarDias(sab, -7); pintar(); };
$("sig").onclick = () => { sab = sumarDias(sab, 7); pintar(); };
$("hoy").onclick = () => { sab = sabadoProximo(); pintar(); };
$("geq").onchange = pintar;
$("gact").onclick = () => cargarG(true);
$("gexcel").onclick = excelG;
$("gwa").onclick = whatsapp;
$("gcantina").onclick = cantina;
$("gvest").onclick = abrirVest;
$("vvolver").onclick = cerrarVest;
$("vprint").onclick = () => window.print();
$("gcopiar").onclick = async () => msg((await copiar()) ? "Texto copiado ✓" : "No se pudo copiar", false);
$("pinok").onclick = () => { G.pin = $("pin").value.trim(); guardarG(); $("pin").value = ""; if (G.pin) cargarG(false); };
$("pin").onkeydown = e => { if (e.key === "Enter") $("pinok").click(); };
sab = sabadoProximo();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
if (G.pin) cargarG(false); else pedirPin("");
