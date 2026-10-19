'use client';

import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import {
  Camera,
  Users,
  TrendingUp,
  Activity,
  Download,
  Calendar,
} from 'lucide-react';
import type { StatsOverview, WorkerStats, DailyActivity } from '@/types';
import ActivityChart from '@/components/charts/ActivityChart';
import WorkerChart from '@/components/charts/WorkerChart';
import SyncStatus from '@/components/admin/SyncStatus';
import { useState } from 'react';

type Period = 'week' | 'month' | 'year';

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('week');

  const { data: overview } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => {
      const res = await statsApi.overview();
      return res.data.data as StatsOverview;
    },
    refetchInterval: 60 * 1000, // Refrescar cada minuto
  });

  const { data: activityData } = useQuery({
    queryKey: ['stats-activity', period],
    queryFn: async () => {
      const res = await statsApi.activity(period);
      return res.data.data as DailyActivity[];
    },
  });

  const { data: workerStats } = useQuery({
    queryKey: ['stats-workers'],
    queryFn: async () => {
      const res = await statsApi.workers();
      return res.data.data as WorkerStats[];
    },
  });

  // Top 8 por número de fotos (workerStats viene ordenado por nombre)
  const topWorkers = [...(workerStats ?? [])]
    .sort((a, b) => b.totalPhotos - a.totalPhotos)
    .slice(0, 8);

  const kpis = [
    {
      label: 'Total fotos',
      value: overview?.totalPhotos ?? '—',
      icon: Camera,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
      delta: `+${overview?.photosToday ?? 0} hoy`,
    },
    {
      label: 'Trabajadores activos',
      value: overview?.totalWorkers ?? '—',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      delta: `${overview?.activeToday ?? 0} activos hoy`,
    },
    {
      label: 'Fotos esta semana',
      value: overview?.photosThisWeek ?? '—',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      delta: `${overview?.photosThisMonth ?? 0} este mes`,
    },
    {
      label: 'Fotos hoy',
      value: overview?.photosToday ?? '—',
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      delta: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
    },
  ];

  const periodLabels: Record<Period, string> = {
    week: 'Semana',
    month: 'Mes',
    year: 'Año',
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-navy-300 text-sm">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={async () => {
              const res = await statsApi.export('xlsx');
              const url = URL.createObjectURL(new Blob([res.data]));
              const a = document.createElement('a');
              a.href = url;
              a.download = `fotos_campo_${new Date().toISOString().split('T')[0]}.xlsx`;
              a.click();
            }}
            className="self-start sm:self-auto flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar datos
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="admin-card">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <p className="font-display text-3xl font-bold text-white mb-0.5">{kpi.value}</p>
              <p className="text-navy-200 text-sm font-medium">{kpi.label}</p>
              <p className="text-navy-300 text-xs mt-1">{kpi.delta}</p>
            </div>
          );
        })}
      </div>

      {/* Folder Watcher Status */}
      <div className="mb-8">
        <SyncStatus />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Actividad */}
        <div className="xl:col-span-2 admin-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Actividad</h2>
              <p className="text-navy-300 text-xs mt-0.5">Fotos subidas por día</p>
            </div>
            <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
              {(Object.keys(periodLabels) as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-brand-500 text-white'
                      : 'text-navy-300 hover:text-white'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <ActivityChart data={activityData ?? []} />
        </div>

        {/* Resumen de trabajadores */}
        <div className="admin-card flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">Resumen de trabajadores</h2>
            <span className="text-navy-300 text-xs">{workerStats?.length ?? 0} empleados</span>
          </div>
          <div className="overflow-auto max-h-72 -mx-1 px-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-700">
                <tr className="border-b border-navy-500">
                  <th className="pb-3 text-left text-navy-300 font-medium">Trabajador</th>
                  <th className="pb-3 text-right text-navy-300 font-medium">Fotos</th>
                  <th className="pb-3 text-right text-navy-300 font-medium hidden md:table-cell">Última actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600">
                {(workerStats ?? []).map((worker: WorkerStats) => (
                  <tr key={worker.userId} className="hover:bg-navy-600/30 transition-colors">
                    <td className="py-3 text-white font-medium truncate max-w-[10rem]" title={worker.userName}>
                      {worker.userName.split(' ')[0]}
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-display text-lg text-brand-400 font-bold">
                        {worker.totalPhotos}
                      </span>
                    </td>
                    <td className="py-3 text-right text-navy-300 text-xs hidden md:table-cell whitespace-nowrap">
                      {worker.lastActivity ? timeAgo(worker.lastActivity) : 'Sin actividad'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!workerStats?.length && (
              <p className="text-center text-navy-300 text-sm py-8">
                Sin datos de trabajadores
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Top trabajadores */}
      <div className="admin-card">
        <div className="mb-5">
          <h2 className="font-semibold text-white">Top trabajadores</h2>
          <p className="text-navy-300 text-xs mt-0.5">Total de fotos subidas</p>
        </div>
        <WorkerChart data={topWorkers} />
      </div>
    </div>
  );
}
