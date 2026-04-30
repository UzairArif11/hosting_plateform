'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Status =
    | 'healthy'
    | 'orphaned'
    | 'foreign'
    | 'stale_user'
    | 'wrong_server'
    | 'wrong_role'
    | 'system';

interface UserInfo {
    email?: string;
    username?: string;
    role?: string;
    status?: string;
    assignedServer?: string;
}

interface Classification {
    status: Status;
    kind: 'user' | 'admin' | 'infra' | 'unknown';
    userId?: string;
    user?: UserInfo;
}

interface Stats {
    cpu?: string;
    memUsage?: string;
    memPerc?: string;
    netIO?: string;
}

interface ContainerItem {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    createdAt: string;
    classification: Classification;
    stats: Stats | null;
}

interface ServerBlock {
    host: string;
    reachable: boolean;
    error: string | null;
    summary: Record<string, number>;
    containers: ContainerItem[];
}

interface AuditPayload {
    success: boolean;
    servers: Record<string, ServerBlock>;
    totals: Record<string, number>;
}

const STATUS_META: Record<Status, { label: string; chip: string; pill: string; icon: string; meaning: string }> = {
    healthy: {
        label: 'Healthy',
        icon: '✅',
        chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        pill: 'bg-emerald-500/20 text-emerald-300',
        meaning: 'Container name EC{n}-{user|admin}-{ObjectId} matches a real user in the database. Role matches and the user account is active/trial. Nothing to do.'
    },
    orphaned: {
        label: 'Orphaned',
        icon: '🟠',
        chip: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        pill: 'bg-orange-500/20 text-orange-300',
        meaning: 'Name parses correctly but the embedded user ID does NOT exist in the User collection. This is an old container left behind after the user was deleted. Safe to delete.'
    },
    foreign: {
        label: 'Foreign',
        icon: '🚨',
        chip: 'bg-red-500/10 text-red-400 border-red-500/30',
        pill: 'bg-red-500/20 text-red-300',
        meaning: 'Container name does NOT match any known platform pattern (e.g. "pcpcat"). It was not created by this platform and is not recognised infrastructure. Treat as potential malware — review the image and delete if you do not recognise it.'
    },
    stale_user: {
        label: 'Stale User',
        icon: '⚠️',
        chip: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        pill: 'bg-yellow-500/20 text-yellow-300',
        meaning: 'The user exists in the database but their account is suspended or soft-deleted. The container should usually be stopped/removed to free resources.'
    },
    wrong_server: {
        label: 'Wrong Server',
        icon: '🔀',
        chip: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        pill: 'bg-purple-500/20 text-purple-300',
        meaning: "The user's assignedServer in the DB does NOT match the EC{n} prefix on this container. The user has been migrated, but this leftover container on the wrong node is still consuming resources. Safe to delete."
    },
    wrong_role: {
        label: 'Wrong Role',
        icon: '🔁',
        chip: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
        pill: 'bg-pink-500/20 text-pink-300',
        meaning: "Container is named EC{n}-admin-X but the matched user has role 'user' (or vice-versa). Often happens after demoting an old admin — the old admin container is still running. Decide whether to keep or delete."
    },
    system: {
        label: 'Platform Infra',
        icon: '🛠️',
        chip: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        pill: 'bg-blue-500/20 text-blue-300',
        meaning: 'Recognised platform infrastructure (mongo, redis, postgres, btcpay, tor, nginx, trading-*, sports-* …). Never auto-flagged for deletion. Only delete manually if you know what it is.'
    }
};

const FILTERS: { id: 'all' | Status; label: string }[] = [
    { id: 'all',          label: 'All' },
    { id: 'healthy',      label: 'Healthy' },
    { id: 'orphaned',     label: 'Orphaned' },
    { id: 'foreign',      label: 'Foreign / Unknown' },
    { id: 'stale_user',   label: 'Stale User' },
    { id: 'wrong_server', label: 'Wrong Server' },
    { id: 'wrong_role',   label: 'Wrong Role' },
    { id: 'system',       label: 'Platform Infra' }
];

// Statuses that are safe / common to bulk-delete.
const RECOMMENDED_DELETE: Status[] = ['orphaned', 'wrong_server', 'wrong_role', 'foreign'];

export default function ContainersAuditPage() {
    const [data, setData] = useState<AuditPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | Status>('all');
    const [selected, setSelected] = useState<Record<string, Set<string>>>({}); // serverKey → Set of names
    const [deleting, setDeleting] = useState(false);
    const [legendOpen, setLegendOpen] = useState(false);

    const fetchAudit = async (silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const res = await api.get('/admin/containers/audit');
            setData(res.data);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to load container audit');
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudit(); }, []);

    const toggleOne = (server: string, name: string) => {
        setSelected(prev => {
            const next = { ...prev };
            const set = new Set(next[server] || []);
            if (set.has(name)) set.delete(name); else set.add(name);
            next[server] = set;
            return next;
        });
    };

    const toggleAllInServer = (server: string, items: ContainerItem[], currentlyAll: boolean) => {
        setSelected(prev => {
            const next = { ...prev };
            next[server] = currentlyAll ? new Set() : new Set(items.map(i => i.name));
            return next;
        });
    };

    const selectRecommended = (server: string, items: ContainerItem[]) => {
        const targets = items
            .filter(i => RECOMMENDED_DELETE.includes(i.classification.status))
            .map(i => i.name);
        setSelected(prev => ({ ...prev, [server]: new Set(targets) }));
    };

    const clearSelection = () => setSelected({});

    const totalSelected = useMemo(
        () => Object.values(selected).reduce((sum, set) => sum + set.size, 0),
        [selected]
    );

    const bulkDelete = async () => {
        const items: { server: string; name: string }[] = [];
        for (const [server, set] of Object.entries(selected)) {
            for (const name of set) items.push({ server, name });
        }
        if (items.length === 0) {
            toast.error('No containers selected');
            return;
        }
        const danger = items.filter(i => /^EC\d+-(user|admin)-/i.test(i.name)).length;
        const ok = confirm(
            `Delete ${items.length} container(s)?\n` +
            (danger > 0 ? `⚠️ ${danger} of these are platform user/admin containers — make sure the matching users have been migrated.\n\n` : '\n') +
            `This stops and force-removes them on the worker servers. Cannot be undone.`
        );
        if (!ok) return;

        setDeleting(true);
        try {
            const res = await api.post('/admin/containers/bulk-delete', { items });
            toast.success(res.data.message || 'Deletion complete');
            const failed = (res.data.results || []).filter((r: any) => !r.success);
            if (failed.length) {
                console.warn('Some deletions failed', failed);
                toast.error(`${failed.length} item(s) failed — see console`);
            }
            clearSelection();
            await fetchAudit(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Bulk delete failed');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-gray-400">Loading container audit…</div>
            </div>
        );
    }

    const totals = data?.totals || {};
    const totalContainers = totals.containers || 0;
    const dangerCount = (totals.orphaned || 0) + (totals.foreign || 0) + (totals.wrong_server || 0) + (totals.wrong_role || 0);

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">🐳 Container Audit</h1>
                    <p className="text-gray-400 mt-1 text-sm">
                        Cross-references every container on every worker against the user database. Spot orphaned, foreign, or misplaced containers and prune them in bulk.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchAudit()}
                        disabled={refreshing}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                    >
                        {refreshing ? '⏳ Refreshing…' : '🔄 Refresh'}
                    </button>
                    <button
                        onClick={bulkDelete}
                        disabled={deleting || totalSelected === 0}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                        {deleting ? '⏳ Deleting…' : `🗑 Delete Selected (${totalSelected})`}
                    </button>
                </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <Tile label="Containers"   value={totalContainers}            tone="bg-gray-800/60 border-gray-700"                            tip="Total containers across all worker servers (running + stopped)." />
                <Tile label="Healthy"      value={totals.healthy      || 0}   tone="bg-emerald-500/10 border-emerald-500/30 text-emerald-300"  tip={STATUS_META.healthy.meaning} />
                <Tile label="Orphaned"     value={totals.orphaned     || 0}   tone="bg-orange-500/10 border-orange-500/30 text-orange-300"     tip={STATUS_META.orphaned.meaning} />
                <Tile label="Foreign"      value={totals.foreign      || 0}   tone="bg-red-500/10 border-red-500/30 text-red-300"              tip={STATUS_META.foreign.meaning} />
                <Tile label="Stale User"   value={totals.stale_user   || 0}   tone="bg-yellow-500/10 border-yellow-500/30 text-yellow-300"     tip={STATUS_META.stale_user.meaning} />
                <Tile label="Wrong Server" value={totals.wrong_server || 0}   tone="bg-purple-500/10 border-purple-500/30 text-purple-300"     tip={STATUS_META.wrong_server.meaning} />
                <Tile label="Wrong Role"   value={totals.wrong_role   || 0}   tone="bg-pink-500/10 border-pink-500/30 text-pink-300"           tip={STATUS_META.wrong_role.meaning} />
                <Tile label="Infra"        value={totals.system       || 0}   tone="bg-blue-500/10 border-blue-500/30 text-blue-300"           tip={STATUS_META.system.meaning} />
            </div>

            {/* Legend (collapsible) */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl">
                <button
                    onClick={() => setLegendOpen(o => !o)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-900/60 transition"
                >
                    <span className="text-sm text-gray-300">
                        <span className="font-semibold text-white">What do these statuses mean?</span>
                        <span className="text-gray-500 ml-2">Hover any badge for a quick reminder.</span>
                    </span>
                    <span className={`text-gray-400 transition-transform ${legendOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {legendOpen && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(Object.keys(STATUS_META) as Status[]).map(s => {
                            const m = STATUS_META[s];
                            return (
                                <div key={s} className="bg-black/30 border border-gray-800 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${m.chip}`}>
                                            {m.icon} {m.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">{m.meaning}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(f => {
                    const isAll = f.id === 'all';
                    const count = isAll ? totalContainers : (totals[f.id] || 0);
                    const active = filter === f.id;
                    const tooltip = isAll ? 'Show every container across all worker servers.' : STATUS_META[f.id as Status].meaning;
                    return (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            title={tooltip}
                            className={`px-3 py-1.5 rounded-full text-xs border transition ${
                                active
                                    ? 'bg-white text-gray-900 border-white'
                                    : 'bg-gray-900/50 text-gray-300 border-gray-700 hover:border-gray-500'
                            }`}
                        >
                            {f.label} <span className={`ml-1 ${active ? 'text-gray-600' : 'text-gray-500'}`}>{count}</span>
                        </button>
                    );
                })}
                {dangerCount > 0 && (
                    <span className="ml-auto text-xs text-orange-300">
                        ⚠ {dangerCount} container(s) need review
                    </span>
                )}
            </div>

            {/* Per-server tables */}
            {data && Object.keys(data.servers).length === 0 && (
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-12 text-center text-gray-400">
                    No worker servers configured yet. Add one in <span className="text-white">Admin → Servers</span>.
                </div>
            )}

            {data && Object.entries(data.servers).map(([sKey, srv]) => {
                const visible = filter === 'all'
                    ? srv.containers
                    : srv.containers.filter(c => c.classification.status === filter);
                const sel = selected[sKey] || new Set<string>();
                const allSelected = visible.length > 0 && visible.every(c => sel.has(c.name));

                return (
                    <div key={sKey} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                        {/* Server header */}
                        <div className="px-5 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-white font-bold text-lg">{sKey}</span>
                                <span className="text-xs text-gray-500 font-mono">{srv.host}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${srv.reachable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {srv.reachable ? '● online' : '● offline'}
                                </span>
                                {!srv.reachable && srv.error && (
                                    <span className="text-xs text-red-400 truncate max-w-md">{srv.error}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-gray-400">
                                    {srv.containers.length} total · {visible.length} shown · {sel.size} selected
                                </span>
                                <button
                                    onClick={() => selectRecommended(sKey, srv.containers)}
                                    className="px-2 py-1 rounded border border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
                                >
                                    Select recommended
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        {visible.length === 0 ? (
                            <div className="px-5 py-10 text-center text-gray-500 italic">
                                No containers match the current filter on this server.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-900/80 text-gray-400 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-2 text-left w-8">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={() => toggleAllInServer(sKey, visible, allSelected)}
                                                />
                                            </th>
                                            <th className="px-4 py-2 text-left">Container</th>
                                            <th className="px-4 py-2 text-left">Status</th>
                                            <th className="px-4 py-2 text-left">Matched User</th>
                                            <th className="px-4 py-2 text-left">CPU</th>
                                            <th className="px-4 py-2 text-left">Memory</th>
                                            <th className="px-4 py-2 text-left">Net I/O</th>
                                            <th className="px-4 py-2 text-left">State</th>
                                            <th className="px-4 py-2 w-12" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {visible.map(c => {
                                            const meta = STATUS_META[c.classification.status];
                                            const isSel = sel.has(c.name);
                                            return (
                                                <tr key={c.name} className={isSel ? 'bg-white/5' : 'hover:bg-white/5'}>
                                                    <td className="px-4 py-2">
                                                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(sKey, c.name)} />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="text-white font-mono text-xs break-all">{c.name}</div>
                                                        <div className="text-gray-500 text-[10px] font-mono">{c.id} · {c.image}</div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span
                                                            title={meta.meaning}
                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] border cursor-help ${meta.chip}`}
                                                        >
                                                            {meta.icon} {meta.label}
                                                        </span>
                                                        {c.classification.kind && (
                                                            <div className="text-[10px] text-gray-500 mt-0.5 uppercase">
                                                                {c.classification.kind}
                                                                {c.classification.userId && (
                                                                    <span className="ml-1 font-mono normal-case text-gray-400" title={`Embedded user ID: ${c.classification.userId}`}>
                                                                        {c.classification.userId.slice(0, 8)}…
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs">
                                                        {c.classification.user ? (
                                                            <div>
                                                                <div className="text-white">{c.classification.user.email || '(no email)'}</div>
                                                                <div className="text-gray-500 text-[10px]">
                                                                    {c.classification.user.username && `${c.classification.user.username} · `}
                                                                    role={c.classification.user.role}
                                                                    {c.classification.user.status && ` · ${c.classification.user.status}`}
                                                                    {c.classification.user.assignedServer && ` · on ${c.classification.user.assignedServer}`}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-gray-300 font-mono">{c.stats?.cpu || '—'}</td>
                                                    <td className="px-4 py-2 text-xs text-gray-300 font-mono">
                                                        {c.stats ? <>{c.stats.memUsage} <span className="text-gray-500">({c.stats.memPerc})</span></> : '—'}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-gray-300 font-mono">{c.stats?.netIO || '—'}</td>
                                                    <td className="px-4 py-2 text-xs">
                                                        <span className={`inline-block px-2 py-0.5 rounded ${c.state === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                                                            {c.state}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button
                                                            onClick={() => {
                                                                if (!confirm(`Force-delete ${c.name} on ${sKey}?`)) return;
                                                                api.post('/admin/containers/bulk-delete', { items: [{ server: sKey, name: c.name }] })
                                                                    .then(() => { toast.success(`Deleted ${c.name}`); fetchAudit(true); })
                                                                    .catch((e: any) => toast.error(e?.response?.data?.error || 'Delete failed'));
                                                            }}
                                                            className="text-red-400 hover:text-red-300 text-xs"
                                                            title="Force delete"
                                                        >
                                                            🗑
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function Tile({ label, value, tone, tip }: { label: string; value: number; tone: string; tip?: string }) {
    return (
        <div title={tip} className={`border rounded-lg p-3 ${tip ? 'cursor-help' : ''} ${tone}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
    );
}
