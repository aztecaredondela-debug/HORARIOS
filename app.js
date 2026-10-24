// ===== pantalla =====
const estado = $("estado"), tabla = $("tabla"), cuerpo = tabla.querySelector("tbody");
function celda(tr, txt, clase) { const td = document.createElement("td"); td.textContent = txt; if (clase) td.className = clase; tr.appendChild(td); }
async function cargar(refrescar) {
  estado.className = ""; estado.textContent = "Cargando partidos…"; tabla.hidden = true;
  try {
    crudas = await datos(refrescar);
    filas = aFilas(crudas);
    const prox = proximos(filas);
    cuerpo.innerHTML = "";
    prox.forEach(p => {
      const tr = document.createElement("tr");
      celda(tr, (p.dia ? p.dia + " " : "") + p.fecha);
      celda(tr, p.hora, p.hora === "Por confirmar" ? "pend" : "");
      celda(tr, p.cat); celda(tr, p.mio); celda(tr, p.riv);
      celda(tr, p.cf, p.cf === "Casa" ? "casa" : "");
      celda(tr, p.pab, p.pab === "Por confirmar" ? "pend" : "");
      cuerpo.appendChild(tr);
    });
    estado.textContent = `${prox.length} partidos en los próximos 7 días · ${filas.length} en toda la temporada (el Excel los incluye todos)` + (aviso ? " · ⚠ " + aviso : "");
    tabla.hidden = prox.length === 0;
    pintarViajes();
  } catch (e) { estado.className = "error"; estado.textContent = "Error: " + e.message; }
}

// ===== Excel (ExcelJS, se carga solo al pulsar el botón) =====
// "2026-10-24 09:45" -> "24/10/202609:45:00" (el mismo texto que usa la federación; sin fecha = vacío)
function textoFecha(ts) {
  if (!ts) return "";
  const [f, h] = ts.split(" "), [y, m, d] = f.split("-");
  return `${d}/${m}/${y}${h}:00`;
}
async function descargarExcel() {
  const b = $("descarga"), txt = b.textContent;
  b.textContent = "Generando…"; b.disabled = true;
  try {
    if (!crudas.length) await cargar(false);
    await cargarExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.columns = COLS.map((c, j) => ({ header: c, width: ANCHOS[j] }));
    ws.getRow(1).font = { bold: true };
    crudas.forEach(r => ws.addRow([r.local, r.visitante, r.pab, r.comp, r.cat, textoFecha(r.ts)]));
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `Partidos_SAR_${diaStr()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch (e) { estado.className = "error"; estado.textContent = "Error con el Excel: " + e.message; }
  b.textContent = txt; b.disabled = false;
}

// ===== Viajes: partidos fuera de DHP Femenina =====
const ISLAS = [[/PERDOMA/, "Tenerife", "TFN"], [/ROMADE|ROCASA|VALSEQUILLO|GRAN CANARIA/, "Gran Canaria", "LPA"]];
const VK = "sar_viajes_v1";
let VG = { n: 15, o: "VGO", f: {} };
try { VG = { ...VG, ...JSON.parse(localStorage.getItem(VK)) }; } catch {}
const guardarV = () => { try { localStorage.setItem(VK, JSON.stringify(VG)); } catch {} };
const sumar = (s, n) => { const [y, m, d] = s.split("-").map(Number); return diaStr(new Date(y, m - 1, d + n)); };
const ymd = s => s.slice(2).replace(/-/g, "");
function el(t, txt, cls, padre) {
  const e = document.createElement(t);
  if (txt != null) e.textContent = txt;
  if (cls) e.className = cls;
  if (padre) padre.appendChild(e);
  return e;
}
function enlaces(d, ida, vuelta) {
  const o = (VG.o || "VGO").toUpperCase(), n = Math.min(Math.max(+VG.n || 1, 1), 9); // los buscadores admiten 9 como máximo
  return [
    ["Google Flights", `https://www.google.com/travel/flights?hl=es&curr=EUR&q=${encodeURIComponent(`Flights from ${o} to ${d} on ${ida} through ${vuelta} for ${n} adults`)}`],
    ["Skyscanner", `https://www.skyscanner.es/transporte/vuelos/${o.toLowerCase()}/${d.toLowerCase()}/${ymd(ida)}/${ymd(vuelta)}/?adultsv2=${n}&cabinclass=economy`],
    ["Kayak", `https://www.kayak.es/flights/${o}-${d}/${ida}/${vuelta}/${n}adults`],
  ];
}
function pintarViajes() {
  const hoy = diaStr(), caja = $("viajes");
  const fuera = filas.filter(f => /PLATA FEM/i.test(f.cat + " " + f.comp) && f.cf === "Fuera" && f.clave && f.clave >= hoy);
  caja.hidden = !fuera.length;
  if (!fuera.length) return;
  const isla = f => ISLAS.find(([re]) => re.test(f.riv.toUpperCase()));
  const islas = fuera.filter(isla), pen = fuera.filter(f => !isla(f));
  $("vresumen").textContent = `${fuera.length} partidos fuera por jugar · ${islas.length} a las islas · ${pen.length} en la península`;
  $("vn").value = VG.n; $("vo").value = VG.o;
  $("vaviso").hidden = !(VG.n > 9);
  const lista = $("vlista"); lista.innerHTML = "";
  if (islas.length) el("h3", "✈ A las islas (billete de avión)", "vtit", lista);
  islas.forEach(f => {
    const [, nombre, ap] = isla(f), k = f.clave + f.riv, fe = VG.f[k] || {};
    const ida = fe.ida || sumar(f.clave, -1), vuelta = fe.vuelta || sumar(f.clave, 1);
    const c = el("div", null, "viaje", lista);
    el("b", `${f.dia} ${f.fecha} · ${f.riv} (${nombre}) · ${f.hora}`, null, c);
    el("div", `${f.pab}`, "sub", c);
    const fila = el("div", null, "fila", c);
    [["Ida", "ida", ida], ["Vuelta", "vuelta", vuelta]].forEach(([t, campo, val]) => {
      const lb = el("label", t + " ", null, fila), i = el("input", null, null, lb);
      i.type = "date"; i.value = val;
      i.onchange = () => { VG.f[k] = { ida, vuelta, [campo]: i.value }; guardarV(); pintarViajes(); };
    });
    const f2 = el("div", null, "fila", c);
    enlaces(ap, ida, vuelta).forEach(([n, u]) => { const a = el("a", "Buscar en " + n, "btn sec peq", f2); a.href = u; a.target = "_blank"; a.rel = "noopener"; });
  });
  if (pen.length) el("h3", "🚌 Península (autobús o furgoneta)", "vtit", lista);
  pen.forEach(f => {
    const c = el("div", null, "viaje", lista);
    el("b", `${f.dia} ${f.fecha} · ${f.riv} · ${f.hora}`, null, c);
    const p = el("div", f.pab + " ", "sub", c);
    if (f.pab !== "Por confirmar") { const a = el("a", "Ver ruta", null, p); a.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(f.pab); a.target = "_blank"; a.rel = "noopener"; }
  });
}

// ===== arranque, instalación y modo sin conexión =====
$("vn").onchange = () => { VG.n = Math.max(1, Math.min(60, +$("vn").value || 1)); guardarV(); pintarViajes(); };
$("vo").onchange = () => { VG.o = $("vo").value.trim().toUpperCase().slice(0, 3) || "VGO"; guardarV(); pintarViajes(); };
$("actualizar").onclick = () => cargar(true);
$("descarga").onclick = descargarExcel;
let invitacion = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); invitacion = e; $("instalar").hidden = false; });
$("instalar").onclick = async () => { if (invitacion) { invitacion.prompt(); invitacion = null; $("instalar").hidden = true; } };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
cargar(false);
