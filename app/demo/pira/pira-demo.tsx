"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, ChevronRight, CircleAlert, CircleCheck,
  ClipboardCheck, ClipboardList, Clock3, Download, FileText, History, LayoutDashboard,
  RotateCcw, ShieldCheck, Soup, Users, type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { renderQualityPdfDocument } from "@/services/quality-export";
import { formatDateTime } from "@/utils/date";
import {
  applyDemoAction, BRANCH_NAME, controlName, DEMO_DATE, DEMO_LOGS, entryFor, formatDemoDate,
  INITIAL_STATE, logStatus, needsTemperature, PREVIOUS_DATE, restoreDemoState, SHIFTS,
  shiftName, VIEWS, type DemoAction, type DemoLog, type DemoState, type DemoView,
} from "./demo-data";
import css from "./pira-demo.module.css";

const STORAGE_KEY = "kitchenmind.demo.pira.v1";
const CHANGE_EVENT = "kitchenmind:demo-pira";
const DAY_LOGS = DEMO_LOGS.filter((log) => log.date === DEMO_DATE);
const number = new Intl.NumberFormat("es-MX");
let stateCache = INITIAL_STATE;
let rawCache: string | null | undefined;
let memoryOnly = false;

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function readState(): DemoState {
  if (memoryOnly) return stateCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== rawCache) {
      stateCache = restoreDemoState(raw);
      rawCache = raw;
    }
  } catch {
    // Allow the demo to run in memory if the browser blocks storage.
  }
  return stateCache;
}

function saveState(state: DemoState): boolean {
  stateCache = state;
  try {
    const raw = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, raw);
    rawCache = raw;
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return !memoryOnly;
}

const SECTIONS = [
  { id: "resumen", name: "Resumen", icon: LayoutDashboard },
  { id: "bitacoras", name: "Bitácoras", icon: ClipboardList },
  { id: "turnos", name: "Turnos", icon: Clock3 },
  { id: "historial", name: "Historial", icon: History },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

function Status({ entry }: { entry: ReturnType<typeof entryFor> }) {
  const { label, tone } = logStatus(entry);
  return <span className={css.status} data-tone={tone}>{label}</span>;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div className={css.sectionTitle}><h1>{title}</h1><p>{description}</p></div>;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: ReactNode; detail: string; icon: LucideIcon; tone: string }) {
  return <article className={css.metric}>
    <div className={css.metricHeader}><span>{label}</span><span className={css.iconTile} data-tone={tone}><Icon size={19} aria-hidden="true" /></span></div>
    <strong>{value}</strong><p>{detail}</p>
  </article>;
}

function TurnOverview({ state, onTurn }: { state: DemoState; onTurn: (shift: string) => void }) {
  return <section className={css.panel}>
    <div className={css.panelHeader}><div><h2>Seguimiento por turno</h2><p>Bitácoras registradas de las programadas</p></div><span className={css.iconTile} data-tone="blue"><Clock3 size={19} aria-hidden="true" /></span></div>
    <div className={css.shiftOverview}>
      {SHIFTS.map((shift) => {
        const logs = DAY_LOGS.filter((log) => log.shift === shift.id);
        const registered = logs.filter((log) => entryFor(state, log)).length;
        return <button className={css.shiftRow} key={shift.id} type="button" onClick={() => onTurn(shift.id)} aria-label={`${shift.name}, ${registered} de ${logs.length} bitácoras registradas`}>
          <span className={css.shiftNumber}>{shift.id}</span>
          <span className={css.shiftText}><strong>{shift.name}</strong><small>{shift.staff}</small></span>
          <span className={css.progressTrack}><span style={{ width: `${100 * registered / logs.length}%` }} /></span>
          <b>{registered}/{logs.length}</b><ChevronRight size={16} aria-hidden="true" />
        </button>;
      })}
    </div>
  </section>;
}

function Summary({ state, onTry, onTurn, onLog, onLogs }: { state: DemoState; onTry: () => void; onTurn: (shift: string) => void; onLog: (log: DemoLog) => void; onLogs: () => void }) {
  const completed = DAY_LOGS.filter((log) => entryFor(state, log)).length;
  const outstanding = DAY_LOGS.filter((log) => {
    const entry = entryFor(state, log);
    return entry?.result === "incident" && !entry.verification;
  });
  const present = SHIFTS.reduce((total, shift) => total + shift.present, 0);
  const expected = SHIFTS.reduce((total, shift) => total + shift.expected, 0);
  const meals = SHIFTS.reduce((total, shift) => total + shift.meals, 0);
  return <>
    <section className={css.hero} aria-labelledby="summary-title">
      <div className={css.heroMain}>
        <div className={css.heroDate}><CalendarDays size={15} aria-hidden="true" /> Jornada de muestra · {formatDemoDate(DEMO_DATE)}</div>
        <h1 id="summary-title">Operación de Maxion</h1>
        <p>Consulta qué se registró en cada turno y qué necesita atención.</p>
        <div className={css.buttonRow}>
          <button className={css.heroButton} type="button" onClick={onTry}>Probar una captura <ArrowRight size={17} aria-hidden="true" /></button>
          <button className={css.heroSecondary} type="button" onClick={onLogs}>Ver bitácoras</button>
        </div>
      </div>
      <div className={css.heroWorkflow}>
        <p>Seguimiento de Calidad</p>
        <ol>
          <li><ClipboardList size={17} aria-hidden="true" /> Captura del turno</li>
          <li><ClipboardCheck size={17} aria-hidden="true" /> Corrección documentada</li>
          <li><ShieldCheck size={17} aria-hidden="true" /> Verificación de Calidad</li>
        </ol>
      </div>
    </section>
    <section className={css.metrics} aria-label="Indicadores de la jornada">
      <Metric label="Bitácoras registradas" value={<>{completed}<small> / {DAY_LOGS.length}</small></>} detail={`${DAY_LOGS.length - completed} por registrar`} icon={ClipboardCheck} tone="green" />
      <Metric label="Acciones por atender" value={outstanding.length} detail="Corrección o verificación" icon={CircleAlert} tone="amber" />
      <Metric label="Asistencia de ejemplo" value={<>{present}<small> / {expected}</small></>} detail="Personas registradas" icon={Users} tone="blue" />
      <Metric label="Servicios de ejemplo" value={number.format(meals)} detail="Comidas registradas" icon={Soup} tone="violet" />
    </section>
    <div className={css.summaryGrid}>
      <TurnOverview state={state} onTurn={onTurn} />
      <section className={css.panel}>
        <div className={css.panelHeader}><div><h2>Requiere atención</h2><p>Incidencias sin verificar</p></div><span className={css.iconTile} data-tone="amber"><CircleAlert size={19} aria-hidden="true" /></span></div>
        <div className={css.alerts}>
          {outstanding.length === 0 ? <div className={css.empty}><CircleCheck size={23} aria-hidden="true" /><p>Las correcciones están verificadas.</p></div> : outstanding.map((log) => <button type="button" className={css.alert} key={log.id} onClick={() => onLog(log)}>
            <span><strong>{controlName(log)}</strong><small>{log.area} · {shiftName(log.shift)}</small></span><Status entry={entryFor(state, log)} /><ChevronRight size={16} aria-hidden="true" />
          </button>)}
        </div>
      </section>
    </div>
  </>;
}

function LogList({ logs, state, onLog }: { logs: readonly DemoLog[]; state: DemoState; onLog: (log: DemoLog) => void }) {
  if (logs.length === 0) return <div className={css.empty}><FileText size={23} aria-hidden="true" /><p>No hay bitácoras para esta selección.</p></div>;
  return <ul className={css.logs}>
    {logs.map((log) => <li key={log.id}>
      <button type="button" className={css.logRow} onClick={() => onLog(log)}>
        <span className={css.iconTile} data-tone="blue"><ClipboardList size={18} aria-hidden="true" /></span>
        <span className={css.logText}><strong>{controlName(log)}</strong><small>{log.area} · {shiftName(log.shift)} · {log.due}</small></span>
        <Status entry={entryFor(state, log)} /><ChevronRight size={17} aria-hidden="true" />
      </button>
    </li>)}
  </ul>;
}

function CaptureForm({ log, onSubmit }: { log: DemoLog; onSubmit: (action: DemoAction) => void }) {
  const [result, setResult] = useState<"ok" | "incident">("ok");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ type: "capture", input: { result, value: needsTemperature(log) && value !== "" ? Number(value) : null, note } });
  }
  return <form className={css.form} onSubmit={submit}>
    <div className={css.panelHeader}><div><h2>Capturar bitácora</h2><p>Usa una lectura y observaciones ficticias.</p></div><button type="button" className={css.secondary} onClick={() => {
      setValue(log.control === "CUARTO_FRIO" ? "4.2" : "63.5");
      setNote(result === "incident" ? "En el ejercicio se detectó una condición que requiere revisión." : "Se registró la revisión de ejemplo.");
    }}>Usar ejemplo</button></div>
    {needsTemperature(log) ? <label>Temperatura medida (°C)<input name="temperature" type="number" step="any" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required /></label> : null}
    <label>Resultado del ejercicio<select value={result} onChange={(event) => setResult(event.target.value === "incident" ? "incident" : "ok")}><option value="ok">Sin incidencia</option><option value="incident">Reportar incidencia</option></select></label>
    <label>{result === "incident" ? "Descripción de la incidencia" : "Observaciones (opcional)"}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={480} minLength={result === "incident" ? 3 : undefined} rows={3} required={result === "incident"} /></label>
    <button type="submit" className={css.primary}><CircleCheck size={17} aria-hidden="true" /> Guardar bitácora</button>
  </form>;
}

function FollowUpForm({ action, onSubmit }: { action: "correct" | "verify"; onSubmit: (action: DemoAction) => void }) {
  const label = action === "correct" ? "Corrección realizada" : "Nota de verificación";
  return <form className={css.form} onSubmit={(event) => {
    event.preventDefault();
    onSubmit({ type: action, note: String(new FormData(event.currentTarget).get("note") ?? "") });
  }}>
    <label>{label}<textarea name="note" minLength={3} maxLength={480} rows={3} required placeholder={action === "correct" ? "¿Qué se hizo para corregir la incidencia?" : "¿Qué revisaste para dar por atendida la corrección?"} /></label>
    <button type="submit" className={css.primary}><ShieldCheck size={17} aria-hidden="true" /> {action === "correct" ? "Guardar corrección" : "Verificar corrección"}</button>
  </form>;
}

function Trace({ title, actor, at, note }: { title: string; actor: DemoView; at: string; note: string }) {
  return <li className={css.trace}><span className={css.traceDot} /><div><strong>{title}</strong><small>{VIEWS[actor]} · {formatDateTime(at)}</small>{note ? <p>{note}</p> : null}</div></li>;
}

function downloadLog(log: DemoLog, entry: NonNullable<ReturnType<typeof entryFor>>) {
  const wrapNote = (value: string) => value.trim().replace(/\s+/g, " ").match(/.{1,78}(?:\s|$)|.{1,78}/g) ?? [];
  const lines = [
    "KITCHENMIND | BITÁCORA DE DEMOSTRACIÓN", "PIRA Comedores Industriales | Maxion Wheels", "Datos ficticios para presentación", "",
    `${controlName(log)} | ${log.id}`, `${formatDemoDate(log.date)} | ${shiftName(log.shift)} | ${log.area}`, `Hora programada: ${log.due}`,
    `Estado: ${logStatus(entry).label}`, `Capturada: ${formatDateTime(entry.at)} | Jefatura de turno`,
    ...(entry.value !== null ? [`Lectura de ejemplo: ${entry.value} °C`] : []),
    ...wrapNote(entry.note),
    ...(entry.correction ? ["", `Corrección: ${formatDateTime(entry.correction.at)} | Jefatura de turno`, ...wrapNote(entry.correction.note)] : []),
    ...(entry.verification ? ["", `Verificación: ${formatDateTime(entry.verification.at)} | Calidad`, ...wrapNote(entry.verification.note)] : []),
  ];
  const blob = new Blob([renderQualityPdfDocument(lines)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `KitchenMind-demo-${log.id}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LogDetail({ log, state, view, onView, onSubmit, onBack }: { log: DemoLog; state: DemoState; view: DemoView; onView: (view: DemoView) => void; onSubmit: (action: DemoAction) => void; onBack: () => void }) {
  const entry = entryFor(state, log);
  const followUp = entry?.result === "incident" && !entry.verification ? entry.correction ? "verify" : "correct" : null;
  const requiredView = followUp === "verify" ? "quality" : "shift";
  return <>
    <button type="button" className={css.back} onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Volver a la lista</button>
    <div className={css.detailHeading}><SectionTitle title={controlName(log)} description={`${log.area} · ${shiftName(log.shift)} · ${formatDemoDate(log.date)}`} /><Status entry={entry} /></div>
    <section className={`${css.panel} ${css.detail}`}>
      <div className={css.detailMeta}><span>Folio <strong>{log.id}</strong></span><span>Hora programada <strong>{log.due}</strong></span><span>Sucursal <strong>{BRANCH_NAME}</strong></span></div>
      {entry ? <>
        <div className={css.panelHeader}><div><h2>Registro y seguimiento</h2><p>{entry.value === null ? "Historial de esta bitácora" : `Temperatura de ejemplo: ${entry.value.toLocaleString("es-MX")} °C`}</p></div><button type="button" className={css.secondary} onClick={() => downloadLog(log, entry)}><Download size={17} aria-hidden="true" /> Descargar PDF</button></div>
        <ol className={css.timeline}>
          <Trace title={entry.result === "incident" ? "Incidencia registrada" : "Bitácora registrada"} actor="shift" at={entry.at} note={entry.note} />
          {entry.correction ? <Trace title="Corrección documentada" actor="shift" at={entry.correction.at} note={entry.correction.note} /> : null}
          {entry.verification ? <Trace title="Corrección verificada" actor="quality" at={entry.verification.at} note={entry.verification.note} /> : null}
        </ol>
        {followUp ? view === requiredView ? <FollowUpForm key={followUp} action={followUp} onSubmit={onSubmit} /> :
          <div className={css.nextStep}><p>{followUp === "verify" ? "Calidad puede verificar la corrección." : "Jefatura de turno puede documentar la corrección."}</p><button type="button" className={css.secondary} onClick={() => onView(requiredView)}>Cambiar a {VIEWS[requiredView]} <ArrowRight size={16} aria-hidden="true" /></button></div> : null}
      </> : view === "shift" ? <CaptureForm key={log.id} log={log} onSubmit={onSubmit} /> :
        <div className={css.nextStep}><p>Esta bitácora está pendiente de captura.</p><button type="button" className={css.primary} onClick={() => onView("shift")}>Cambiar a Jefatura de turno <ArrowRight size={16} aria-hidden="true" /></button></div>}
    </section>
  </>;
}

function TurnDetails({ onTurn }: { onTurn: (shift: string) => void }) {
  return <>
    <SectionTitle title="Turnos de Maxion" description="Horarios de referencia para la presentación y conteos ficticios de la jornada." />
    <div className={css.schedule}>
      {SHIFTS.map((shift) => <article className={`${css.panel} ${css.scheduleCard}`} key={shift.id}>
        <div className={css.panelHeader}><div><h2>{shift.name}</h2><p>{shift.id === "1" ? "Con cobertura de Calidad" : "Seguimiento de Jefatura de turno"}</p></div><span className={css.shiftNumber}>{shift.id}</span></div>
        <dl><div><dt>Horario de personal</dt><dd>{shift.staff}</dd></div><div><dt>Ventana de servicio</dt><dd>{shift.service}</dd></div><div><dt>Asistencia de ejemplo</dt><dd>{shift.present} de {shift.expected}</dd></div><div><dt>Servicios de ejemplo</dt><dd>{shift.meals}</dd></div></dl>
        <button type="button" className={css.secondary} onClick={() => onTurn(shift.id)}>Ver bitácoras <ArrowRight size={16} aria-hidden="true" /></button>
      </article>)}
    </div>
    <p className={css.footnote}>El horario de fin de semana queda pendiente de confirmar.</p>
  </>;
}

export function PiraDemo() {
  const state = useSyncExternalStore(subscribe, readState, () => INITIAL_STATE);
  const [section, setSection] = useState<Section>("resumen");
  const [view, setView] = useState<DemoView>("direction");
  const [shift, setShift] = useState("all");
  const [historyDate, setHistoryDate] = useState(DEMO_DATE);
  const [selected, setSelected] = useState<DemoLog | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
  const main = useRef<HTMLElement>(null);

  function moveToContent() {
    requestAnimationFrame(() => {
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
  }

  function goTo(next: Section, nextShift = "all") {
    setSection(next);
    setSelected(null);
    setFeedback(null);
    setShift(nextShift);
    moveToContent();
  }

  function openLog(log: DemoLog, from: Section = "bitacoras") {
    setSection(from);
    setSelected(log);
    setFeedback(null);
    moveToContent();
  }

  function changeView(next: DemoView) {
    setView(next);
    setFeedback(null);
  }

  function tryCapture() {
    const pending = DAY_LOGS.find((log) => !entryFor(state, log));
    if (!pending) {
      goTo("bitacoras");
      setFeedback({ message: "Ya se registraron todas las bitácoras. Puedes reiniciar la demostración para repetir el ejercicio." });
      return;
    }
    changeView("shift");
    openLog(pending);
  }

  function commitAction(action: DemoAction) {
    if (!selected) return;
    try {
      const next = applyDemoAction(readState(), selected, view, action);
      const persisted = saveState(next);
      const message = action.type === "capture" ? "Bitácora guardada." : action.type === "correct" ? "Corrección guardada. Calidad ya puede verificarla." : "Corrección verificada.";
      setFeedback({ message: persisted ? message : `${message} El navegador conservará este cambio durante la sesión actual.` });
    } catch (error) {
      setFeedback({ message: error instanceof Error && error.name !== "ZodError" ? error.message : "Revisa que los campos del ejercicio estén completos.", error: true });
    }
  }

  function reset() {
    if (!window.confirm("¿Reiniciar la demostración y borrar las capturas de ejemplo de este navegador?")) return;
    saveState(INITIAL_STATE);
    setView("direction");
    setHistoryDate(DEMO_DATE);
    goTo("resumen");
    setFeedback({ message: "Demostración lista para empezar de nuevo." });
  }

  const filtered = section === "historial" ? DEMO_LOGS.filter((log) => log.date === historyDate && entryFor(state, log)) : DAY_LOGS;
  return <div className={css.shell}>
    <aside className={css.sidebar}>
      <div className={css.brand}><BrandMark /></div>
      <div className={css.site}><span className={css.siteIcon}><Building2 size={19} aria-hidden="true" /></span><div><strong>PIRA Comedores</strong><small>{BRANCH_NAME}</small></div></div>
      <nav aria-label="Secciones de la demostración" className={css.nav}>
        {SECTIONS.map(({ id, name, icon: Icon }) => <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => goTo(id)}><Icon size={19} aria-hidden="true" /><span>{name}</span></button>)}
      </nav>
      <div className={css.sideFooter}><span><span className={css.demoDot} /> Modo demostración</span><button type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" /> Reiniciar demo</button></div>
    </aside>
    <div className={css.workspace}>
      <header className={css.header}>
        <div className={css.desktopLocation}><Building2 size={19} aria-hidden="true" /><span>PIRA Comedores</span><ChevronRight size={15} aria-hidden="true" /><strong>{BRANCH_NAME}</strong></div>
        <div className={css.mobileBrand}><BrandMark compact /><div><strong>KitchenMind</strong><small>{BRANCH_NAME}</small></div></div>
        <div className={css.headerActions}><label className={css.role}>Vista <select aria-label="Vista de demostración" value={view} onChange={(event) => changeView(event.target.value as DemoView)}>{Object.entries(VIEWS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className={css.mobileReset} type="button" aria-label="Reiniciar demo" onClick={reset}><RotateCcw size={19} aria-hidden="true" /></button></div>
      </header>
      <main ref={main} tabIndex={-1} className={css.main}>
        <div className={css.demoNotice}><span className={css.demoDot} /><strong>Demostración</strong><span>Datos ficticios · Guardado en este dispositivo</span></div>
        {feedback ? <p className={css.feedback} data-error={feedback.error ?? false} role={feedback.error ? "alert" : "status"}>{feedback.message}</p> : null}
        {selected ? <LogDetail key={selected.id} log={selected} state={state} view={view} onView={changeView} onSubmit={commitAction} onBack={() => goTo(section, shift)} /> :
          section === "resumen" ? <Summary state={state} onTry={tryCapture} onTurn={(id) => goTo("bitacoras", id)} onLog={openLog} onLogs={() => goTo("bitacoras")} /> :
          section === "turnos" ? <TurnDetails onTurn={(id) => goTo("bitacoras", id)} /> : <>
            <SectionTitle title={section === "historial" ? "Historial de bitácoras" : "Bitácoras de la jornada"} description={section === "historial" ? "Consulta registros por fecha y descarga una copia de ejemplo." : `${BRANCH_NAME} · ${formatDemoDate(DEMO_DATE)}`} />
            <section className={css.panel}>
              <div className={css.filters}>
                {section === "historial" ? <label>Fecha de muestra<select value={historyDate} onChange={(event) => setHistoryDate(event.target.value)}><option value={DEMO_DATE}>{formatDemoDate(DEMO_DATE)}</option><option value={PREVIOUS_DATE}>{formatDemoDate(PREVIOUS_DATE)}</option></select></label> : null}
                <label>Turno<select value={shift} onChange={(event) => setShift(event.target.value)}><option value="all">Todos los turnos</option>{SHIFTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              </div>
              <LogList logs={filtered.filter((log) => shift === "all" || log.shift === shift)} state={state} onLog={(log) => openLog(log, section)} />
            </section>
          </>}
      </main>
    </div>
  </div>;
}
