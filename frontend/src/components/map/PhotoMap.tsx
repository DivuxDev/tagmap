'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MapPhoto } from '@/types';
import { getPhotoSrc } from '@/lib/utils';

interface Props {
  photos: MapPhoto[];
}

// Importamos Leaflet solo en cliente
export default function PhotoMap({ photos }: Props) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<ReturnType<typeof import('leaflet')['map']> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current) return;
    if (leafletMapRef.current) return; // Ya inicializado

    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    // Fix icono por defecto de Leaflet con Webpack
    delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    // Función global para navegación desde popup
    (window as unknown as { navigateToPhoto: (id: string) => void }).navigateToPhoto = (photoId: string) => {
      router.push(`/dashboard/map?photoId=${photoId}`);
    };

    // Icono personalizado (amber)
    const amberIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;background:#F59E0B;border:3px solid #fff;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });

    const map = L.map(mapRef.current, {
      center: [-34.6, -58.4], // Buenos Aires por defecto
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Agregar marcadores
    const markers: ReturnType<typeof L.marker>[] = [];

    photos.forEach(photo => {
      if (!photo.latitude || !photo.longitude) return;

      const marker = L.marker([photo.latitude, photo.longitude], { icon: amberIcon })
        .bindPopup(`
          <div style="min-width:160px;font-family:sans-serif;">
            ${photo.url ? `<img src="${getPhotoSrc(photo.url)}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />` : ''}
            <p style="font-weight:600;color:#1E293B;margin:0 0 2px;">${photo.user.name}</p>
            <p style="color:#64748B;font-size:11px;margin:0;">${(() => { const d = new Date(photo.takenAt || photo.createdAt); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES'); })()}</p>
            ${photo.notes ? `<p style="color:#475569;font-size:12px;margin:4px 0 0;">${photo.notes}</p>` : ''}
            <button 
              onclick="window.navigateToPhoto('${photo.id}')" 
              style="margin-top:8px;width:100%;padding:6px;background:#F59E0B;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;"
            >
              Ver foto completa
            </button>
          </div>
        `, {
          maxWidth: 200,
        })
        .addTo(map);

      markers.push(marker);
    });

    // Ajustar vista a los marcadores
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 13 });
    }

    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [router]);

  // Actualizar marcadores cuando cambian los datos
  useEffect(() => {
    if (!leafletMapRef.current || typeof window === 'undefined') return;
    const L = require('leaflet');
    const map = leafletMapRef.current;

    // Limpiar capas de marcadores anteriores
    map.eachLayer((layer: unknown) => {
      if ((layer as { options?: { pane?: string } }).options?.pane === 'markerPane') {
        map.removeLayer(layer as Parameters<typeof map.removeLayer>[0]);
      }
    });

    const amberIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;background:#F59E0B;border:3px solid #fff;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });

    const markers: ReturnType<typeof L.marker>[] = [];

    photos.forEach(photo => {
      if (!photo.latitude || !photo.longitude) return;
      const marker = L.marker([photo.latitude, photo.longitude], { icon: amberIcon })
        .bindPopup(`
          <div style="min-width:160px;font-family:sans-serif;">
            ${photo.url ? `<img src="${getPhotoSrc(photo.url)}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />` : ''}
            <p style="font-weight:600;color:#1E293B;margin:0 0 2px;">${photo.user.name}</p>
            <p style="color:#64748B;font-size:11px;margin:0;">${(() => { const d = new Date(photo.takenAt || photo.createdAt); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES'); })()}</p>
            ${photo.notes ? `<p style="color:#475569;font-size:12px;margin:4px 0 0;">${photo.notes}</p>` : ''}
            <button 
              onclick="window.navigateToPhoto('${photo.id}')" 
              style="margin-top:8px;width:100%;padding:6px;background:#F59E0B;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;"
            >
              Ver foto completa
            </button>
          </div>
        `)
        .addTo(map);
      markers.push(marker);
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 13 });
    }
  }, [photos]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
