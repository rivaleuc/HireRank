import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Users, Wallet, Loader2, Plus, UserPlus, ListOrdered, Trophy, Star } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
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
    <div className={`rounded-xl border p-3 ${a.shortlisted ? 'border-primary/40 bg-primary/5' : 'border-border bg-card/50'}`}>
      <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-full bg-background text-xs font-bold text-muted">{r?.state === 'screened' ? (a.shortlisted ? <Star className="h-3.5 w-3.5 text-primary" /> : rank + 1) : '·'}</div><span className="truncate text-sm font-semibold">{a.candidate}</span>{r?.state === 'screened' && <span className="ml-auto font-mono text-sm tabular-nums text-primary">{a.score}</span>}</div>
      <p className="mt-1.5 line-clamp-3 text-xs text-muted">{a.pitch}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#e879f91c,transparent_60%)]" />
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-5">
        <Users className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">HireRank</span>
        <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_roles} /></b> roles · <b className="text-primary"><NumberTicker value={stats.screened} /></b> screened</div>
        <Button size="sm" className="ml-auto" variant="outline" onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> Role</Button>
        <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
      </div></header>

      <div className="mx-auto max-w-6xl px-5 pt-5">
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role title" className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <div className="flex gap-2"><input value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="Scoring rubric" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" onClick={post} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Post</Button></div>
            </div>
          </motion.div>
        )}
        <div className="flex flex-wrap gap-2">
          {roles.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-lg border px-3 py-1.5 text-xs ${sel === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground'}`}>{x.title}</button>)}
        </div>
      </div>

      {!r ? <div className="mx-auto max-w-6xl px-5 py-24 text-center text-sm text-muted">No roles yet.</div> : (
        <main className="mx-auto max-w-6xl px-5 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-muted"><span className="text-accent">rubric:</span> {r.rubric}</div>
            {r.state === 'open' && r.app_count >= 2 && <Button size="sm" className="ml-auto" disabled={busy === r.id} onClick={() => screen(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListOrdered className="h-4 w-4" />} Screen &amp; shortlist</Button>}
          </div>

          {/* apply row */}
          {r.state === 'open' && (
            <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card/40 p-3">
              <input value={ap.c} onChange={(e) => setAp({ ...ap, c: e.target.value })} placeholder="Candidate" className="w-40 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={ap.p} onChange={(e) => setAp({ ...ap, p: e.target.value })} placeholder="Pitch / qualifications" className="min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" variant="outline" disabled={busy === 'apply'} onClick={() => apply(r)}><UserPlus className="h-4 w-4" /> Apply</Button>
            </div>
          )}

          {/* kanban */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {r.state === 'open' ? (
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Users className="h-3.5 w-3.5" /> applicants · {apps.length}</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{apps.length === 0 ? <div className="text-sm text-muted">No applicants yet.</div> : ranked.map((a, i) => <Card key={a.idx} a={a} rank={i} />)}</div>
              </div>
            ) : (<>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary"><Trophy className="h-3.5 w-3.5" /> shortlist · {shortlisted.length}</div>
                <div className="space-y-2">{shortlisted.map((a, i) => <Card key={a.idx} a={a} rank={i} />)}</div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">considered · {considered.length}</div>
                <div className="space-y-2">{considered.map((a, i) => <Card key={a.idx} a={a} rank={shortlisted.length + i} />)}</div>
              </div>
            </>)}
          </div>
          {r.state === 'screened' && r.note && <p className="mt-4 text-xs italic text-muted">{r.note}</p>}
        </main>
      )}
      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted"><span>HireRank · rubric-scored candidate shortlists</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
