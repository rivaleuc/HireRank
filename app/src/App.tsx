import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Users, Wallet, Loader2, Plus, UserPlus, ListOrdered, ChevronDown, Trophy,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Role = { id: string; poster: string; title: string; rubric: string; state: string; app_count: number; order: string[]; scores: Record<string, number>; shortlist: string[]; note: string }
type App = { idx: string; candidate: string; pitch: string; score: number; shortlisted: boolean }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_roles: 0, screened: 0 })
  const [roles, setRoles] = useState<Role[]>([])
  const [apps, setApps] = useState<Record<string, App[]>>({})
  const [open, setOpen] = useState(false); const [sel, setSel] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [rubric, setRubric] = useState('')
  const [ap, setAp] = useState<Record<string, { c: string; p: string }>>({})
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_roles: Number(s?.total_roles ?? 0), screened: Number(s?.screened ?? 0) })
      const total = Number(s?.total_roles ?? 0); const out: Role[] = []
      for (let i = total - 1; i >= 0 && i >= total - 10; i--) { try { const r = (await read('get_role', [String(i)])) as any; if (r?.exists) out.push({ ...r, id: String(i), order: r.order ?? [], shortlist: r.shortlist ?? [], scores: r.scores ?? {} }) } catch {} }
      setRoles(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])
  async function loadApps(r: Role) { const out: App[] = []; for (let i = 0; i < Number(r.app_count); i++) { try { const a = (await read('get_application', [r.id, String(i)])) as any; if (a?.exists) out.push({ ...a, idx: String(i) }) } catch {} } setApps((p) => ({ ...p, [r.id]: out })) }
  function toggle(r: Role) { const n = sel === r.id ? null : r.id; setSel(n); if (n) loadApps(r) }

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function post() { if (!title.trim() || !rubric.trim()) return toast.error('Title + rubric.'); setCreating(true); const t = toast.loading('Posting role…'); try { await write('post_role', [title.trim(), rubric.trim()]); toast.success('Role posted.', { id: t }); setTitle(''); setRubric(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function apply(r: Role) { const a = ap[r.id] ?? { c: '', p: '' }; if (!a.c.trim() || !a.p.trim()) return toast.error('Candidate + pitch.'); setBusy(r.id); const t = toast.loading('Applying…'); try { await write('apply', [r.id, a.c.trim(), a.p.trim()]); setAp({ ...ap, [r.id]: { c: '', p: '' } }); toast.success('Applied.', { id: t }); await load(); await loadApps({ ...r, app_count: r.app_count + 1 }) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function screen(r: Role) { setBusy(r.id); const t = toast.loading('Validators screening candidates… (30–60s)'); try { await write('screen', [r.id]); toast.success('Shortlist ready.', { id: t }); await load(); await loadApps(r) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#e879f91c,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Users className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">HireRank</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_roles} /></b> roles · <b className="text-primary"><NumberTicker value={stats.screened} /></b> screened</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Shortlists scored against your rubric</h1>
        <p className="mt-1 text-sm text-muted">Candidates apply, validators score every one against the rubric and agree on the top pick — the ranking is the shortlist.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Post a role'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role title" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={2} placeholder="Scoring rubric — what makes a strong candidate?" className="resize-none rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={post} disabled={creating} className="justify-self-end">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Post</Button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-2">
          {roles.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No roles yet.</div>}
          {roles.map((r) => {
            const list = (apps[r.id] ?? []).slice().sort((a, b) => (r.order.indexOf(a.idx) - r.order.indexOf(b.idx)))
            const a = ap[r.id] ?? { c: '', p: '' }; const screened = r.state === 'screened'
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card/50">
                <button onClick={() => toggle(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.title}</div><div className="text-[11px] text-muted">{r.app_count} applicants · {r.state}</div></div>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${sel === r.id ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {sel === r.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-border/60">
                      <div className="space-y-3 p-4">
                        <div className="text-xs text-muted"><span className="text-accent">rubric:</span> {r.rubric}</div>
                        <div className="space-y-1.5">
                          {list.length === 0 && <p className="text-xs text-muted">No applicants yet.</p>}
                          {list.map((x, rank) => {
                            const isShort = r.shortlist.includes(x.idx)
                            return (
                              <div key={x.idx} className={`flex items-center gap-2 rounded-lg border p-2.5 ${screened && isShort ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/40'}`}>
                                {screened ? <span className="w-5 text-center font-mono text-xs text-muted">{isShort ? <Trophy className="h-3.5 w-3.5 text-primary" /> : rank + 1}</span> : <span className="w-5" />}
                                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{x.candidate}</div><div className="truncate text-[11px] text-muted">{x.pitch}</div></div>
                                {screened && <span className="font-mono text-sm tabular-nums text-primary">{x.score}</span>}
                              </div>
                            )
                          })}
                        </div>
                        {screened && r.note && <p className="text-[11px] italic text-muted">{r.note}</p>}
                        {!screened && (
                          <div className="space-y-2">
                            <div className="flex gap-2"><input value={a.c} onChange={(e) => setAp({ ...ap, [r.id]: { ...a, c: e.target.value } })} placeholder="Candidate name" className="w-40 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><input value={a.p} onChange={(e) => setAp({ ...ap, [r.id]: { ...a, p: e.target.value } })} placeholder="Pitch / qualifications" className="flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" /><Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => apply(r)}><UserPlus className="h-4 w-4" /></Button></div>
                            {r.app_count >= 2 && <Button size="sm" disabled={busy === r.id} onClick={() => screen(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListOrdered className="h-4 w-4" />} Screen &amp; shortlist</Button>}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>HireRank · rubric-scored candidate shortlists on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
