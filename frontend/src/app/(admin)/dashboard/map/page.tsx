'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { photosApi, usersApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import {
  MapPin,
  SlidersHorizontal,
  X,
  UserIcon,
  Calendar,
  Clock,
  HardDrive,
  FileImage,
  Mountain,
  Hash,
  ChevronRight,
  ExternalLink,
  Camera,
  Gauge,
  Navigation,
  Trash2,
} from 'lucide-react';
import type { MapPhoto, User, Photo } from '@/types';
import Image from 'next/image';
import { formatDate, formatCoords, formatBytes, getPhotoSrc } from '@/lib/utils';

// Importación dinámica — Leaflet no funciona con SSR
const PhotoMap = dynamic(() => import('@/components/map/PhotoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-navy-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-navy-300 text-sm">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoIdParam = searchParams.get('photoId');
  
  // Calcular fechas por defecto: últimos 30 días
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState(formatDateForInput(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDateForInput(today));
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { data: users } = useQuery({
    queryKey: ['admin-users-filter'],
    queryFn: async () => {
      const res = await usersApi.list();
      return (res.data.data as User[]).filter(u => u.role === 'WORKER' && u.active);
    },
  });

  const { data: photosData, isLoading } = useQuery({
    queryKey: ['map-photos', userId, startDate, endDate],
    queryFn: async () => {
      const res = await photosApi.getMapPhotos({
        userId: userId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      return res.data.data as MapPhoto[];
    },
  });

  // Abrir modal automáticamente si hay photoId en URL
  useEffect(() => {
    if (photoIdParam) {
      photosApi.getById(photoIdParam)
        .then(res => {
          setSelectedPhoto(res.data.data as Photo);
          router.replace('/dashboard/map', { scroll: false });
        })
        .catch(() => {
          router.replace('/dashboard/map', { scroll: false });
        });
    }
  }, [photoIdParam, router]);

  // Considerar filtros activos si hay userId o si las fechas difieren de los defaults
  const defaultStartDate = formatDateForInput(thirtyDaysAgo);
  const defaultEndDate = formatDateForInput(today);
  const hasFilters = userId || (startDate !== defaultStartDate) || (endDate !== defaultEndDate);
  
  const resetFilters = () => {
    setUserId('');
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="bg-navy-800 border-b border-navy-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 shrink-0" />
          <div>
            <h1 className="font-display text-base sm:text-xl font-bold text-white">Mapa de actividad</h1>
            <p className="text-navy-300 text-xs">
              {photosData?.length ?? 0} ubicaciones geolocalizadas
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            showFilters || hasFilters
              ? 'bg-brand-500 text-white'
              : 'border border-navy-500 text-navy-200 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtrar</span> {hasFilters && '•'}
        </button>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="bg-navy-700 border-b border-navy-600 px-6 py-4 shrink-0 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-navy-300 mb-1">Trabajador</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="input-dark w-full"
              >
                <option value="">Todos</option>
                {(users ?? []).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-navy-300 mb-1">Fecha desde</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-navy-300 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input-dark w-full"
              />
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-2.5 rounded-xl transition-colors w-full justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                  Restaurar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapa - ocupa el espacio restante */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 bg-navy-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-navy-300 text-sm">Cargando ubicaciones...</p>
            </div>
          </div>
        ) : (
          <PhotoMap photos={photosData ?? []} />
        )}
      </div>

      {/* ── Modal metadatos ──────────────────────────────────────────────── */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-navy-800 border border-navy-600 rounded-2xl overflow-hidden w-full max-w-3xl animate-slide-up flex flex-col md:flex-row max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Imagen */}
            <div className="relative md:w-1/2 aspect-square md:aspect-auto bg-black flex-shrink-0">
              <Image
                src={getPhotoSrc(selectedPhoto.url)}
                alt="Foto de campo"
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <a
                href={getPhotoSrc(selectedPhoto.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="absolute bottom-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
                title="Abrir original"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Panel de metadatos */}
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Cabecera */}
              <div className="p-5 border-b border-navy-600 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedPhoto.user.name}</p>
                    <p className="text-navy-400 text-xs">Trabajador</p>
                  </div>
                </div>
              </div>

              {/* Metadatos */}
              <div className="p-5 space-y-3 flex-1">
                {/* Fechas */}
                <div className="admin-card !p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Fechas</p>
                  {selectedPhoto.takenAt && (
                    <MetaRow
                      icon={<Clock className="w-3.5 h-3.5 text-brand-400" />}
                      label="Capturada (EXIF)"
                      value={formatDate(selectedPhoto.takenAt)}
                      highlight
                    />
                  )}
                  <MetaRow
                    icon={<Calendar className="w-3.5 h-3.5 text-navy-400" />}
                    label="Subida al sistema"
                    value={formatDate(selectedPhoto.createdAt)}
                  />
                </div>

                {/* Ubicación GPS */}
                {selectedPhoto.latitude != null ? (
                  <div className="admin-card !p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Ubicación GPS</p>
                    <MetaRow
                      icon={<MapPin className="w-3.5 h-3.5 text-green-400" />}
                      label="Coordenadas"
                      value={formatCoords(selectedPhoto.latitude, selectedPhoto.longitude)}
                      highlight
                    />
                    {selectedPhoto.altitude != null && (
                      <MetaRow
                        icon={<Mountain className="w-3.5 h-3.5 text-navy-400" />}
                        label="Altitud"
                        value={`${selectedPhoto.altitude.toFixed(1)} m`}
                      />
                    )}
                    {selectedPhoto.gpsSpeed != null && (
                      <MetaRow
                        icon={<Gauge className="w-3.5 h-3.5 text-navy-400" />}
                        label="Velocidad"
                        value={`${selectedPhoto.gpsSpeed.toFixed(1)} km/h`}
                      />
                    )}
                    {selectedPhoto.gpsBearing != null && (
                      <MetaRow
                        icon={<Navigation className="w-3.5 h-3.5 text-navy-400" />}
                        label="Orientación"
                        value={`${selectedPhoto.gpsBearing.toFixed(1)}°`}
                      />
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 mt-1 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <ChevronRight className="w-3 h-3" />
                      Ver en Google Maps
                    </a>
                  </div>
                ) : (
                  <div className="admin-card !p-4">
                    <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Ubicación GPS</p>
                    <p className="text-navy-500 text-sm">Sin datos GPS</p>
                  </div>
                )}

                {/* Cámara EXIF */}
                {(selectedPhoto.exifMake || selectedPhoto.exifModel || selectedPhoto.exifIso != null) && (
                  <div className="admin-card !p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Cámara</p>
                    {(selectedPhoto.exifMake || selectedPhoto.exifModel) && (
                      <MetaRow
                        icon={<Camera className="w-3.5 h-3.5 text-navy-400" />}
                        label="Modelo"
                        value={[selectedPhoto.exifMake, selectedPhoto.exifModel].filter(Boolean).join(' ')}
                      />
                    )}
                    {selectedPhoto.exifIso != null && (
                      <MetaRow
                        icon={<Hash className="w-3.5 h-3.5 text-navy-400" />}
                        label="ISO"
                        value={String(selectedPhoto.exifIso)}
                      />
                    )}
                    {selectedPhoto.exifAperture != null && (
                      <MetaRow
                        icon={<Hash className="w-3.5 h-3.5 text-navy-400" />}
                        label="Apertura"
                        value={`f/${selectedPhoto.exifAperture.toFixed(1)}`}
                      />
                    )}
                    {selectedPhoto.exifShutter != null && (
                      <MetaRow
                        icon={<Clock className="w-3.5 h-3.5 text-navy-400" />}
                        label="Velocidad obturación"
                        value={formatShutter(selectedPhoto.exifShutter)}
                      />
                    )}
                    {selectedPhoto.exifFocalLen != null && (
                      <MetaRow
                        icon={<Hash className="w-3.5 h-3.5 text-navy-400" />}
                        label="Focal"
                        value={`${selectedPhoto.exifFocalLen.toFixed(1)} mm`}
                      />
                    )}
                  </div>
                )}

                {/* Archivo */}
                <div className="admin-card !p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Archivo</p>
                  <MetaRow
                    icon={<Hash className="w-3.5 h-3.5 text-navy-400" />}
                    label="Nombre"
                    value={selectedPhoto.filename}
                    mono
                  />
                  <MetaRow
                    icon={<FileImage className="w-3.5 h-3.5 text-navy-400" />}
                    label="Tipo"
                    value={selectedPhoto.mimetype}
                  />
                  {selectedPhoto.sizeBytes != null && (
                    <MetaRow
                      icon={<HardDrive className="w-3.5 h-3.5 text-navy-400" />}
                      label="Tamaño"
                      value={formatBytes(selectedPhoto.sizeBytes)}
                    />
                  )}
                  <MetaRow
                    icon={<Hash className="w-3.5 h-3.5 text-navy-500" />}
                    label="ID"
                    value={selectedPhoto.id}
                    mono
                    muted
                  />
                </div>

                {/* Notas */}
                {selectedPhoto.notes && (
                  <div className="admin-card !p-4">
                    <p className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">Notas del trabajador</p>
                    <p className="text-navy-100 text-sm leading-relaxed">{selectedPhoto.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente auxiliar para fila de metadatos ─────────────────────────── */
interface MetaRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  muted?: boolean;
}

function MetaRow({ icon, label, value, highlight, mono, muted }: MetaRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${muted ? 'text-navy-500' : 'text-navy-400'}`}>{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${
          highlight ? 'text-white' : muted ? 'text-navy-400' : 'text-navy-200'
        } ${mono ? 'font-mono text-xs' : ''} break-all`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ── Velocidad de obturación legible ────────────────────────────────────── */
function formatShutter(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(1)}s`;
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}
