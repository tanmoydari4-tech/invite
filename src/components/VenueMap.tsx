import React, { useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';

interface VenueMapProps {
  venueName: string;
  venueAddress: string;
  lat: number;
  lng: number;
  accentColor?: string;
  interactive?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

const MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (process.env.GOOGLE_MAPS_API_KEY as string | undefined) ||
  '';

function VenueMarkerWithInfo({
  lat,
  lng,
  venueName,
  venueAddress,
  accentColor = '#92400e',
}: {
  lat: number;
  lng: number;
  venueName: string;
  venueAddress: string;
  accentColor?: string;
}) {
  const [infoOpen, setInfoOpen] = useState(true);
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        onClick={() => setInfoOpen((prev) => !prev)}
        title={venueName}
      >
        <Pin background={accentColor} borderColor="#1c1917" glyphColor="#ffffff" scale={1.15} />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-1 text-stone-900">
            <p className="font-semibold text-xs leading-snug">{venueName}</p>
            <p className="text-[11px] text-stone-600 mt-0.5 leading-normal">{venueAddress}</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export const VenueMap: React.FC<VenueMapProps> = ({
  venueName,
  venueAddress,
  lat,
  lng,
  accentColor = '#92400e',
  interactive = false,
  onLocationChange,
}) => {
  const safeLat = Number.isFinite(lat) ? lat : 24.5764;
  const safeLng = Number.isFinite(lng) ? lng : 73.6835;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${venueName} ${venueAddress}`
  )}`;

  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden bg-stone-100">
      <div className="h-64 w-full relative">
        {MAPS_API_KEY ? (
          <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']}>
            <GoogleMap
              mapId="DEMO_MAP_ID"
              center={{ lat: safeLat, lng: safeLng }}
              defaultZoom={15}
              gestureHandling="cooperative"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              onClick={(ev) => {
                if (interactive && onLocationChange && ev.detail.latLng) {
                  onLocationChange(
                    Number(ev.detail.latLng.lat.toFixed(5)),
                    Number(ev.detail.latLng.lng.toFixed(5))
                  );
                }
              }}
            >
              <VenueMarkerWithInfo
                lat={safeLat}
                lng={safeLng}
                venueName={venueName}
                venueAddress={venueAddress}
                accentColor={accentColor}
              />
            </GoogleMap>
          </APIProvider>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-stone-100">
            <MapPin className="w-8 h-8 text-amber-800 mb-2" />
            <p className="text-sm font-semibold text-stone-900">{venueName}</p>
            <p className="text-xs text-stone-600 mt-1 max-w-md">{venueAddress}</p>
            <p className="text-[11px] font-mono-tabular text-stone-500 mt-2">
              {safeLat.toFixed(4)}° N, {safeLng.toFixed(4)}° E
            </p>
          </div>
        )}
      </div>
      <div className="px-4 py-3 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-stone-900 truncate">{venueName}</p>
          <p className="text-xs text-stone-500 truncate">{venueAddress}</p>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Navigation className="w-3.5 h-3.5" />
          Open in Google Maps
        </a>
      </div>
    </div>
  );
};
