import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { defaultRouteByRole } from "../constants/menu";
import logoParkPlaza from "../assets/park-plaza-logo.png";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "admin@parkplaza.com", password: "ParkPlaza123*" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(form.email, form.password);
      navigate(defaultRouteByRole[user.role] || "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-park-dark p-5">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-panel bg-white shadow-2xl lg:grid-cols-[1fr_0.8fr]">
        <div className="bg-park-dark p-10 text-white">
          <img
            className="h-40 w-40 rounded-full border border-white/15 bg-black object-cover shadow-card"
            src={logoParkPlaza}
            alt="Hotel Park Plaza"
          />
          <p className="mt-8 text-sm uppercase text-park-gold">Hotel</p>
          <h1 className="font-display text-5xl font-semibold uppercase leading-none text-park-gold">Park Plaza</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-white/70">La magia de Pucallpa</p>
          <p className="mt-6 max-w-md text-white/75">
            ERP hotelero con PostgreSQL, Prisma, API REST, roles, permisos y modulos operativos integrados.
          </p>
        </div>
        <form className="p-8 lg:p-12" onSubmit={submit}>
          <p className="text-xs font-black uppercase text-park-accent">Acceso seguro</p>
          <h2 className="mt-2 text-3xl font-black text-park-dark">Iniciar sesion</h2>
          <label className="mt-8 block text-sm font-bold">
            Correo
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-park-accent focus:ring-4 focus:ring-blue-100" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Contrasena
            <input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-park-accent focus:ring-4 focus:ring-blue-100" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" />
          </label>
          <div className="mt-4 min-h-[40px]">
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-park-danger">{error}</p> : null}
          </div>
          <button className="mt-2 inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-lg bg-park-accent px-4 py-3 font-black text-white hover:bg-park-accent/90 active:bg-park-accent/75 disabled:opacity-75 disabled:cursor-not-allowed transition-colors" disabled={loading} type="submit">
            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LogIn size={18} />}
            {loading ? "Ingresando..." : "Ingresar al ERP"}
          </button>
        </form>
      </section>
    </main>
  );
}
