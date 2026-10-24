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
async function whatsapp() {
  const t = textoWA(), u = "https://wa.me/?text=" + encodeURIComponent(t);
  if (u.length > 6000) { msg((await copiar()) ? "El mensaje es muy largo: lo he copiado. Pégalo en WhatsApp." : "El mensaje es muy largo: usa «Copiar texto»."); return; }
  window.open(u, "_blank");
}
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

// ----- arranque -----
$("ant").onclick = () => { sab = sumarDias(sab, -7); pintar(); };
$("sig").onclick = () => { sab = sumarDias(sab, 7); pintar(); };
$("hoy").onclick = () => { sab = sabadoProximo(); pintar(); };
$("geq").onchange = pintar;
$("gact").onclick = () => cargarG(true);
$("gexcel").onclick = excelG;
$("gwa").onclick = whatsapp;
$("gcopiar").onclick = async () => msg((await copiar()) ? "Texto copiado ✓" : "No se pudo copiar", false);
$("pinok").onclick = () => { G.pin = $("pin").value.trim(); guardarG(); $("pin").value = ""; if (G.pin) cargarG(false); };
$("pin").onkeydown = e => { if (e.key === "Enter") $("pinok").click(); };
sab = sabadoProximo();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
if (G.pin) cargarG(false); else pedirPin("");
