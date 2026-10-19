'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { photosApi, usersApi, statsApi } from '@/lib/api';
import { formatDate, formatCoords, formatBytes, getPhotoSrc } from '@/lib/utils';
import {
  Filter,
  Trash2,
  MapPin,
  Calendar,
  X,
  SlidersHorizontal,
  Download,
  User as UserIcon,
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
  CheckCircle2,
  Circle,
  ChevronDown,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import Pagination from '@/components/Pagination';
import type { Photo, PaginatedPhotos, User, WorkerStats } from '@/types';
import { downloadBlob } from '@/lib/utils';

export default function PhotosPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoIdParam = searchParams.get('photoId');

  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showWorkerFilter, setShowWorkerFilter] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // Workers con conteo de fotos (para los chips)
  const { data: workerStats } = useQuery({
    queryKey: ['admin-worker-stats'],
    queryFn: async () => {
      const res = await statsApi.workers();
      return res.data.data as WorkerStats[];
    },
  });

  // Lista completa de workers activos (para el selector dentro del filtro de fechas)
  const { data: users } = useQuery({
    queryKey: ['admin-users-filter'],
    queryFn: async () => {
      const res = await usersApi.list();
      return (res.data.data as User[]).filter(u => u.role === 'WORKER' && u.active);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-photos', userId, startDate, endDate, page],
    queryFn: async () => {
      const res = await photosApi.list({
        userId: userId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 24,
      });
      return res.data as PaginatedPhotos;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => photosApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-photos'] });
      qc.invalidateQueries({ queryKey: ['admin-worker-stats'] });
      setDeleteId(null);
      setSelectedPhoto(null);
    },
  });

  // Abrir modal automáticamente si hay photoId en URL
  useEffect(() => {
    if (photoIdParam) {
      // Primero buscar en los datos actuales
      const photo = data?.data?.find(p => p.id === photoIdParam);
      if (photo) {
        setSelectedPhoto(photo);
        // Limpiar parámetro de URL
        router.replace('/dashboard/photos', { scroll: false });
      } else {
        // Si no está en la página actual, hacer petición directa
        photosApi.getById(photoIdParam)
          .then(res => {
            setSelectedPhoto(res.data.data as Photo);
            router.replace('/dashboard/photos', { scroll: false });
          })
          .catch(() => {
            // Si la foto no existe, limpiar parámetro
            router.replace('/dashboard/photos', { scroll: false });
          });
      }
    }
  }, [photoIdParam, data, router]);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const downloadSelectedPhotos = async () => {
    const selected = photos.filter(p => selectedPhotos.has(p.id));
    for (const photo of selected) {
      const link = document.createElement('a');
      link.href = getPhotoSrc(photo.url);
      link.download = photo.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Pequeña pausa entre descargas
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const selectWorker = (id: string) => {
    setUserId(prev => (prev === id ? '' : id));
    setPage(1);
  };

  const resetFilters = () => {
    setUserId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setShowDateFilter(false);
  };

  const hasFilters = userId || startDate || endDate;
  const photos = data?.data ?? [];
  const pagination = data?.pagination;

  // Nombre del worker seleccionado (para el título)
  const selectedWorkerName = userId
    ? (workerStats?.find(w => w.userId === userId)?.userName ?? users?.find(u => u.id === userId)?.name ?? '')
    : '';

  const handleExport = async () => {
    const res = await statsApi.export('xlsx', {
      userId: userId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    downloadBlob(new Blob([res.data]), 'fotos_campo.xlsx');
  };

  // Colores de avatar para workers (rotativo)
  const avatarColors = [
    'bg-brand-500', 'bg-purple-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  ];

  return (
    <div className="p-6 lg:p-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">
            {selectedWorkerName ? `Fotos de ${selectedWorkerName}` : 'Fotos de campo'}
          </h1>
          <p className="text-navy-300 text-sm">
            {selectedPhotos.size > 0 
              ? `${selectedPhotos.size} fotos seleccionadas`
              : pagination 
              ? `${pagination.total} fotos encontradas` 
              : 'Todas las fotos subidas'
            }
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {selectedPhotos.size > 0 ? (
            <>
              <button
                onClick={() => setSelectedPhotos(new Set())}
                className="flex items-center gap-2 border border-navy-500 text-navy-200 hover:text-white hover:border-navy-400 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={downloadSelectedPhotos}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-brand-500/20"
              >
                <Download className="w-4 h-4" />
                Descargar ({selectedPhotos.size})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (photos.length > 0) {
                    setSelectedPhotos(new Set(photos.map(p => p.id)));
                  }
                }}
                className="flex items-center gap-2 border border-navy-500 text-navy-200 hover:text-white hover:border-navy-400 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                disabled={photos.length === 0}
              >
                <CheckCircle2 className="w-4 h-4" />
                Seleccionar
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 border border-navy-500 text-navy-200 hover:text-white hover:border-navy-400 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => setShowDateFilter(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  showDateFilter || startDate || endDate
                    ? 'bg-brand-500 text-white'
                    : 'border border-navy-500 text-navy-200 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Fecha {(startDate || endDate) && '•'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Chips de trabajadores ────────────────────────────────────────── */}
      {workerStats && workerStats.length > 0 && (
        <div className="admin-card mb-5 !p-0 overflow-hidden">
          <button
            onClick={() => setShowWorkerFilter(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-navy-600/30 transition-colors"
            aria-expanded={showWorkerFilter}
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserIcon className="w-4 h-4 text-navy-300 shrink-0" />
              <span className="text-sm font-medium text-white">Filtrar por trabajador</span>
              <span className="text-xs text-navy-300 shrink-0">({workerStats.length})</span>
              {selectedWorkerName && (
                <span className="ml-1 truncate text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-medium">
                  {selectedWorkerName}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-navy-300 shrink-0 transition-transform ${showWorkerFilter ? 'rotate-180' : ''}`}
            />
          </button>

          {showWorkerFilter && (
          <div className="border-t border-navy-500 p-4">
          {workerStats.length > 8 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <input
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                placeholder="Buscar trabajador..."
                className="input-dark pl-9 w-full"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
          <button
            onClick={() => { setUserId(''); setPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border ${
              !userId
                ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'bg-navy-700/50 border-navy-500 text-navy-200 hover:border-navy-300 hover:text-white'
            }`}
          >
            <span>Todos</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              !userId ? 'bg-white/20 text-white' : 'bg-navy-600 text-navy-200'
            }`}>
              {workerStats.reduce((s, w) => s + w.totalPhotos, 0)}
            </span>
          </button>

          {workerStats
            .map((w, idx) => ({ w, idx }))
            .filter(({ w }) => w.userName.toLowerCase().includes(workerSearch.toLowerCase()))
            .map(({ w, idx }) => {
            const active = userId === w.userId;
            const initials = w.userName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
            const colorCls = avatarColors[idx % avatarColors.length];
            return (
              <button
                key={w.userId}
                onClick={() => selectWorker(w.userId)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  active
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                    : 'bg-navy-700/50 border-navy-500 text-navy-200 hover:border-navy-300 hover:text-white'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${colorCls}`}>
                  {initials}
                </span>
                <span>{w.userName}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-navy-600 text-navy-200'
                }`}>
                  {w.totalPhotos}
                </span>
              </button>
            );
          })}

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ── Filtro de fechas (colapsable) ────────────────────────────────── */}
      {showDateFilter && (
        <div className="admin-card mb-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy-200 mb-1.5">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy-200 mb-1.5">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="input-dark w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Grid de fotos ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="aspect-square bg-navy-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="admin-card text-center py-16">
          <Filter className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <p className="text-navy-200 font-medium">Sin fotos encontradas</p>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-3 text-brand-400 text-sm hover:text-brand-300">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {photos.map((photo: Photo) => {
              const isSelected = selectedPhotos.has(photo.id);
              const selectionMode = selectedPhotos.size > 0;

              return (
                <div key={photo.id} className="relative">
                  <button
                    onClick={() => selectionMode ? togglePhotoSelection(photo.id) : setSelectedPhoto(photo)}
                    className="relative aspect-square photo-item group w-full"
                  >
                    <Image
                      src={getPhotoSrc(photo.url)}
                      alt="Foto de campo"
                      fill
                      unoptimized
                      className="object-cover rounded-xl"
                      sizes="(max-width: 1024px) 25vw, 16vw"
                    />
                    
                    {/* Checkbox overlay */}
                    {selectionMode && (
                      <div className={`absolute inset-0 flex items-center justify-center rounded-xl transition-all ${
                        isSelected ? 'bg-brand-500/40 backdrop-blur-[1px]' : 'bg-black/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100'
                      }`}>
                        {isSelected ? (
                          <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
                        ) : (
                          <Circle className="w-10 h-10 text-white/80" strokeWidth={2} />
                        )}
                      </div>
                    )}

                    {/* Info overlay (solo cuando NO está en modo selección) */}
                    {!selectionMode && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col justify-end p-2">
                        <p className="text-white text-xs font-medium truncate">{photo.user.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {photo.latitude && (
                            <div className="flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-green-400" />
                              <span className="text-green-300 text-[10px]">GPS</span>
                            </div>
                          )}
                          {photo.takenAt && (
                            <div className="flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5 text-brand-400" />
                              <span className="text-brand-300 text-[10px]">EXIF</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Botón de selección individual (siempre visible en esquina) */}
                  {!selectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePhotoSelection(photo.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/80"
                      title="Seleccionar foto"
                    >
                      <Circle className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {pagination && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </>
      )}

      {/* ── Modal metadatos ──────────────────────────────────────────────── */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
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
              {/* Enlace abrir original */}
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
                <button
                  onClick={() => setDeleteId(selectedPhoto.id)}
                  className="p-2 text-navy-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Eliminar foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

      {/* ── Confirmar borrado ────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-navy-700 border border-navy-500 rounded-2xl p-6 max-w-sm w-full text-center animate-slide-up">
            <p className="text-white font-semibold mb-2">¿Eliminar foto?</p>
            <p className="text-navy-300 text-sm mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-navy-500 text-navy-200 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Velocidad de obturación legible ────────────────────────────────────── */
function formatShutter(seconds: number): string {
  if (seconds >= 1) return `${seconds.toFixed(1)}s`;
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}

/* ── Componente auxiliar MetaRow ──────────────────────────────────────── */
function MetaRow({
  icon,
  label,
  value,
  highlight = false,
  mono = false,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-navy-400 leading-none mb-0.5">{label}</p>
        <p className={`text-sm break-all leading-snug ${
          muted ? 'text-navy-500' : highlight ? 'text-white font-medium' : 'text-navy-200'
        } ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

