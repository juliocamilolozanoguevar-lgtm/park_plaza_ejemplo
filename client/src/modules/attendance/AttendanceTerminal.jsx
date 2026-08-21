import { Clock, LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";

export function AttendanceTerminal() {
  const [identifier, setIdentifier] = useState("");
  const [clock, setClock] = useState(new Date());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const resetTimerRef = useRef(null);
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    return () => clearTimeout(resetTimerRef.current);
  }, []);

  function resetTerminal(delay = 2200) {
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setResult(null);
      setError("");
      setIdentifier("");
      inputRef.current?.focus();
    }, delay);
  }

  async function submit(event) {
    event.preventDefault();
    await markAttendance();
  }

  async function markAttendance() {
    const cleanIdentifier = identifier.trim();
    if (loading || !cleanIdentifier) {
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    clearTimeout(resetTimerRef.current);
    try {
      const data = await api("/asistencia/mark", { method: "POST", body: { identifier: cleanIdentifier } });
      setResult(data);
      resetTerminal(2800);
    } catch (err) {
      setError(err.message || "Error de lectura. Intente nuevamente.");
      resetTerminal(1800);
    } finally {
      setLoading(false);
    }
  }
  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      markAttendance();
    }
  }

  return <main className="min-h-screen bg-park-green p-4 text-white"><section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-4xl flex-col justify-center"><div className="mb-8 text-center"><img className="mx-auto h-24 w-24 rounded-full object-cover" src="/assets/park-plaza-logo.png" alt="Hotel Park Plaza" /><p className="mt-4 text-sm font-black uppercase text-park-gold">Hotel Park Plaza</p><h1 className="font-sans text-4xl font-black">Sistema de Asistencia</h1><p className="mt-2 text-white/75">{clock.toLocaleDateString("es-PE")} | {clock.toLocaleTimeString("es-PE")}</p></div><form className="rounded-card bg-white p-6 text-park-black shadow-drawer" onSubmit={submit}><div className="flex items-center gap-3 text-park-green"><Clock size={22} /><h2 className="font-sans text-2xl font-black">Registro de asistencia</h2></div><p className="mt-2 text-sm text-park-muted">Escanea tu DNI o ingresa tu codigo.</p><input ref={inputRef} className="mt-5 h-14 w-full rounded-input border border-park-border px-4 text-center text-2xl font-black outline-none focus:border-park-green focus:ring-2 focus:ring-park-green/15" value={identifier} onChange={(event) => setIdentifier(event.target.value)} onKeyDown={handleKeyDown} disabled={loading} placeholder="DNI / codigo" /><button className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-button bg-park-green font-black text-white disabled:opacity-60" disabled={loading || !identifier.trim()} type="submit"><LogIn size={18} />{loading ? "Registrando..." : "Registrar"}</button>{error ? <p className="mt-4 rounded-card bg-park-danger-soft p-3 text-center font-black text-park-danger">{error}</p> : null}{result ? <Confirmation result={result} /> : <p className="mt-4 rounded-card bg-park-green-soft p-3 text-center font-black text-park-green">LISTO PARA ESCANEAR</p>}</form></section></main>;
}
function Confirmation({ result }) { const record = result.record; const worker = record?.worker; const title = result.type === "SALIDA" ? "SALIDA REGISTRADA" : result.type === "REVISION" ? "REQUIERE REVISION" : "ENTRADA REGISTRADA"; return <section className="mt-4 rounded-card border border-park-green bg-park-green-soft p-4 text-center"><p className="font-sans text-2xl font-black text-park-green">{title}</p><p className="mt-2 font-black text-park-black">{[worker?.firstName, worker?.lastName].filter(Boolean).join(" ")}</p><p className="text-sm text-park-muted">{worker?.role?.name}</p><div className="mt-3 grid gap-2 text-sm md:grid-cols-3"><Info label="Entrada" value={format(record?.checkInAt)} /><Info label="Salida" value={format(record?.checkOutAt)} /><Info label="Duracion" value={duration(record?.durationMinutes)} /></div>{result.message ? <p className="mt-3 text-sm font-semibold text-park-gold">{result.message}</p> : null}</section>; }
function Info({ label, value }) { return <div className="rounded-card bg-white p-3"><span className="text-xs font-black uppercase text-park-muted">{label}</span><p className="font-black text-park-black">{value || "-"}</p></div>; }
function format(value) { return value ? new Date(value).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "-"; }
function duration(value) { if (!value) return "-"; const hours = Math.floor(value / 60); const minutes = value % 60; return hours ? `${hours} h ${minutes} min` : `${minutes} min`; }
