import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Users, Wallet, Loader2, Plus, UserPlus, ListOrdered, Trophy, Star } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const FONT = 'Manrope, system-ui, sans-serif'
type Role = { id: string; title: string; rubric: string; state: string; app_count: number; order: string[]; scores: Record<string, number>; shortlist: string[]; note: string }
type App2 = { idx: string; candidate: string; pitch: string; score: number; shortlisted: boolean }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_roles: 0, screened: 0 })
  const [roles, setRoles] = useState<Role[]>([]); const [sel, setSel] = useState<string | null>(null)
  const [apps, setApps] = useState<App2[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''); const [rubric, setRubric] = useState('')
  const [ap, setAp] = useState({ c: '', p: '' }); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_roles: Number(s?.total_roles ?? 0), screened: Number(s?.screened ?? 0) })
      const total = Number(s?.total_roles ?? 0); const out: Role[] = []
      for (let i = total - 1; i >= 0 && i >= total - 14; i--) { try { const r = (await read('get_role', [String(i)])) as any; if (r?.exists) out.push({ ...r, id: String(i), order: r.order ?? [], shortlist: r.shortlist ?? [], scores: r.scores ?? {} }) } catch {} }
      setRoles(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  async function loadApps(r: Role) { const out: App2[] = []; for (let i = 0; i < Number(r.app_count); i++) { try { const a = (await read('get_application', [r.id, String(i)])) as any; if (a?.exists) out.push({ ...a, idx: String(i) }) } catch {} } setApps(out) }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])
  useEffect(() => { const r = roles.find((x) => x.id === sel); if (r) loadApps(r) /* eslint-disable-next-line */ }, [sel, roles])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function post() { if (!title.trim() || !rubric.trim()) return toast.error('Title + rubric.'); setCreating(true); const t = toast.loading('Posting…'); try { const id = (await write('post_role', [title.trim(), rubric.trim()])) as any; toast.success('Posted.', { id: t }); setTitle(''); setRubric(''); setOpen(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function apply(r: Role) { if (!ap.c.trim() || !ap.p.trim()) return toast.error('Candidate + pitch.'); setBusy('apply'); const t = toast.loading('Applying…'); try { await write('apply', [r.id, ap.c.trim(), ap.p.trim()]); setAp({ c: '', p: '' }); toast.success('Applied.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function screen(r: Role) { setBusy(r.id); const t = toast.loading('Screening… (30–60s)'); try { await write('screen', [r.id]); toast.success('Shortlist ready.', { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const r = roles.find((x) => x.id === sel) || null
  const ranked = [...apps].sort((a, b) => (r ? r.order.indexOf(a.idx) - r.order.indexOf(b.idx) : 0))
  const shortlisted = ranked.filter((a) => a.shortlisted)
  const considered = ranked.filter((a) => !a.shortlisted)

  const Card = ({ a, rank }: { a: App2; rank: number }) => (
    <div className={`rounded-xl border p-3 transition-colors ${a.shortlisted ? 'border-primary/40 bg-primary/5' : 'border-border bg-card/60 hover:border-border/80'}`}>
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background text-xs font-bold text-muted">{r?.state === 'screened' ? (a.shortlisted ? <Star className="h-3.5 w-3.5 text-primary" /> : rank + 1) : '·'}</div>
        <span className="truncate text-sm font-semibold">{a.candidate}</span>
        {r?.state === 'screened' && <span className="ml-auto font-mono text-sm tabular-nums text-primary">{a.score}</span>}
      </div>
      <p className="mt-1.5 line-clamp-3 text-xs text-muted">{a.pitch}</p>
    </div>
  )

  const StateBadge = ({ s }: { s: string }) =>
    s === 'screened'
      ? <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><Trophy className="h-3 w-3" /> screened</span>
      : <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">open</span>

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: FONT }}>
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(820px_circle_at_18%_-8%,#e879f91c,transparent_60%)]" />

      {/* ===== fixed LEFT sidebar ===== */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-border bg-surface/80 backdrop-blur-xl">
        {/* brand */}
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30"><Users className="h-[18px] w-[18px] text-primary" /></div>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">HireRank</div>
            <div className="font-mono text-[11px] text-muted"><b className="text-foreground"><NumberTicker value={stats.total_roles} /></b> roles · <b className="text-primary"><NumberTicker value={stats.screened} /></b> screened</div>
          </div>
        </div>

        {/* new role */}
        <div className="px-3">
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> New role</Button>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <div className="mt-2 grid gap-2 rounded-xl border border-border bg-card/60 p-2.5">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role title" className="rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-sm outline-none focus:border-primary/50" />
                <input value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="Scoring rubric" className="rounded-md border border-border bg-background/70 px-2.5 py-1.5 text-sm outline-none focus:border-primary/50" />
                <Button size="sm" onClick={post} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Post role</Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* roles nav list */}
        <div className="px-5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Roles</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {roles.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted">No roles yet.</div>
          ) : roles.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${sel === x.id ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-transparent text-muted hover:bg-white/[0.04] hover:text-foreground'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${x.state === 'screened' ? 'bg-primary' : 'bg-accent'}`} />
              <span className="truncate font-medium">{x.title}</span>
              <span className="ml-auto shrink-0 rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted">{Number(x.app_count)}</span>
            </button>
          ))}
        </nav>

        {/* bottom: explorer + Connect */}
        <div className="space-y-2 border-t border-border p-3">
          <a href={EXPLORER} target="_blank" rel="noreferrer" className="block truncate px-1 font-mono text-[11px] text-muted transition-colors hover:text-primary">{short(CONTRACT)} ↗</a>
          <Button className="w-full" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect wallet'}</Button>
        </div>
      </aside>

      {/* ===== main = kanban board ===== */}
      <main className="ml-72 min-h-screen">
        {!r ? (
          <div className="grid min-h-screen place-items-center px-8 text-center text-sm text-muted">
            <div><Users className="mx-auto mb-3 h-8 w-8 text-muted/60" /> No roles yet — create one from the sidebar.</div>
          </div>
        ) : (
          <div className="px-8 py-7">
            {/* role title (content, not a chrome bar) */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5"><h1 className="truncate text-2xl font-extrabold tracking-tight">{r.title}</h1><StateBadge s={r.state} /></div>
                <p className="mt-1 text-sm text-muted"><span className="text-accent">rubric:</span> {r.rubric}</p>
              </div>
              {r.state === 'open' && r.app_count >= 2 && <Button size="sm" className="ml-auto" disabled={busy === r.id} onClick={() => screen(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListOrdered className="h-4 w-4" />} Screen &amp; shortlist</Button>}
            </div>

            {/* apply row */}
            {r.state === 'open' && (
              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-3">
                <UserPlus className="ml-1 h-4 w-4 text-accent" />
                <input value={ap.c} onChange={(e) => setAp({ ...ap, c: e.target.value })} placeholder="Candidate" className="w-44 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                <input value={ap.p} onChange={(e) => setAp({ ...ap, p: e.target.value })} placeholder="Pitch / qualifications" className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
                <Button size="sm" variant="outline" disabled={busy === 'apply'} onClick={() => apply(r)}><UserPlus className="h-4 w-4" /> Apply</Button>
              </div>
            )}

            {/* kanban: Shortlist | Considered */}
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary"><Trophy className="h-3.5 w-3.5" /> Shortlist <span className="ml-auto font-mono text-muted">{shortlisted.length}</span></div>
                <div className="space-y-2">{shortlisted.length === 0 ? <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted">{r.state === 'screened' ? 'No one shortlisted.' : 'Run “Screen & shortlist” to rank.'}</div> : shortlisted.map((a, i) => <Card key={a.idx} a={a} rank={i} />)}</div>
              </section>

              <section className="rounded-2xl border border-border bg-card/30 p-4">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Users className="h-3.5 w-3.5" /> Considered <span className="ml-auto font-mono">{considered.length}</span></div>
                <div className="space-y-2">{considered.length === 0 ? <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted">No applicants yet.</div> : considered.map((a, i) => <Card key={a.idx} a={a} rank={shortlisted.length + i} />)}</div>
              </section>
            </div>

            {r.state === 'screened' && r.note && <p className="mt-5 max-w-3xl text-xs italic text-muted">{r.note}</p>}
          </div>
        )}
      </main>
    </div>
  )
}
