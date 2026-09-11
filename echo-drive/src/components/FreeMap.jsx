import { useEffect, useRef } from 'react';
import './FreeMap.css';

// Official OpenFreeMap "Liberty" style — free, no key, no billing.
// https://openfreemap.org/quick_start/
const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER = [18.5204, 73.8567];

function waitForGlobals(cb) {
  const ready = () => window.L && window.maplibregl && window.L.maplibreGL;
  if (ready()) {
    cb();
    return () => {};
  }
  const timer = window.setInterval(() => {
    if (ready()) {
      window.clearInterval(timer);
      cb();
    }
  }, 50);
  return () => window.clearInterval(timer);
}

function pinIcon(kind) {
  const L = window.L;
  return L.divIcon({
    className: 'fm-marker-wrap',
    html:
      `<span class="fm-pin fm-pin--${kind}">` +
      `<span class="fm-pin-halo"></span>` +
      `<span class="fm-pin-core"></span>` +
      `</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 16],
    popupAnchor: [0, -16],
  });
}

// Small, non-pulsing marker used for POI-style pins (charging stations etc.)
// so a map with many of them doesn't turn into a wall of animated halos.
function poiIcon(kind, active) {
  const L = window.L;
  return L.divIcon({
    className: 'fm-marker-wrap',
    html: `<span class="fm-poi fm-poi--${kind} ${active ? 'fm-poi--active' : ''}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

/**
 * Interactive Leaflet map rendering OpenFreeMap's vector "Liberty" style via
 * the official maplibre-gl-leaflet bridge. Fully free / open-source, no API
 * key, no billing, no rate limits.
 *
 * - Always shows a pulsing "current location" pin at `start`.
 * - Optionally shows a draggable "destination" pin + an animated route line.
 * - Clicking anywhere on the map drops/moves the destination pin (reports
 *   back via onSelectPoint) so the whole map is a real destination picker,
 *   not just the dropdown above it.
 */
export default function FreeMap({
  id = 'map',
  className = '',
  style = {},
  start = { position: DEFAULT_CENTER, label: 'Current Location' },
  destination = null,
  // Optional: real alternative routes to draw instead of the plain
  // straight dashed line. Shape: [{ id, coordinates: [[lat,lng], …], color, active }]
  // When omitted, behaviour is unchanged (straight line between start/destination).
  routes = null,
  onSelectRoute,
  zoom = 13,
  onSelectPoint,
  onDestinationDrag,
  // Optional extra POI pins (e.g. charging stations): [{ id, position, label, kind, active }]
  markers = null,
  onMarkerClick,
  // Optional: enables Leaflet-Routing-Machine-style "drag the line to reroute"
  // on the active route. Called with the dropped [lat, lng] via-point.
  onRouteDrag,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ start: null, dest: null, line: null, glow: null, gl: null, routeLayers: [], poiLayers: [], dragMarker: null });
  const readyRef = useRef(false);

  const onSelectPointRef = useRef(onSelectPoint);
  const onDestinationDragRef = useRef(onDestinationDrag);
  const onSelectRouteRef = useRef(onSelectRoute);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onRouteDragRef = useRef(onRouteDrag);
  onSelectPointRef.current = onSelectPoint;
  onDestinationDragRef.current = onDestinationDrag;
  onSelectRouteRef.current = onSelectRoute;
  onMarkerClickRef.current = onMarkerClick;
  onRouteDragRef.current = onRouteDrag;

  const startPos = start?.position ?? DEFAULT_CENTER;
  const startLabel = start?.label ?? 'Current Location';
  const destPos = destination?.position ?? null;
  const destLabel = destination?.label ?? 'Destination';
  const routesKey = routes ? routes.map((r) => `${r.id}:${r.active ? 1 : 0}:${r.coordinates.length}`).join('|') : '';

  // Init the map + Liberty vector layer once.
  useEffect(() => {
    let cancelled = false;
    let stopWaiting;
    let resizeObserver;

    const init = () => {
      if (cancelled || mapRef.current || !elRef.current) return;
      const L = window.L;

      const map = L.map(elRef.current, {
        center: startPos,
        zoom,
        minZoom: 3,
        maxZoom: 19,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      layersRef.current.gl = L.maplibreGL({ style: LIBERTY_STYLE }).addTo(map);

      layersRef.current.start = L.marker(startPos, { icon: pinIcon('start'), zIndexOffset: 500, keyboard: false })
        .addTo(map)
        .bindPopup(`<strong>${startLabel}</strong>`);

      map.on('click', (e) => {
        onSelectPointRef.current?.([e.latlng.lat, e.latlng.lng]);
      });

      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(elRef.current);
      requestAnimationFrame(() => map.invalidateSize());

      readyRef.current = true;
    };

    stopWaiting = waitForGlobals(init);

    return () => {
      cancelled = true;
      readyRef.current = false;
      stopWaiting?.();
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = { start: null, dest: null, line: null, glow: null, gl: null, routeLayers: [], poiLayers: [], dragMarker: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "current location" marker in sync.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !readyRef.current) return;

    if (layersRef.current.start) {
      layersRef.current.start.setLatLng(startPos);
      layersRef.current.start.setPopupContent(`<strong>${startLabel}</strong>`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPos[0], startPos[1], startLabel]);

  // Keep the destination marker + (fallback) straight route line in sync.
  // When real `routes` are supplied, the dashed straight line is skipped —
  // the routes effect below draws the actual road-following paths instead.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !readyRef.current) return;

    layersRef.current.dest?.remove();
    layersRef.current.line?.remove();
    layersRef.current.glow?.remove();
    layersRef.current.dest = null;
    layersRef.current.line = null;
    layersRef.current.glow = null;

    if (destPos) {
      const marker = L.marker(destPos, { icon: pinIcon('dest'), draggable: true, zIndexOffset: 600 })
        .addTo(map)
        .bindPopup(`<strong>${destLabel}</strong>`);

      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onDestinationDragRef.current?.([ll.lat, ll.lng]);
      });

      layersRef.current.dest = marker;

      if (!routes || routes.length === 0) {
        layersRef.current.glow = L.polyline([startPos, destPos], {
          className: 'fm-route-glow',
          color: '#33e6ff',
          weight: 8,
          opacity: 0.16,
          lineCap: 'round',
        }).addTo(map);

        layersRef.current.line = L.polyline([startPos, destPos], {
          className: 'fm-route-line',
          color: '#33e6ff',
          weight: 3,
          opacity: 0.95,
          dashArray: '1 12',
          lineCap: 'round',
        }).addTo(map);

        map.flyToBounds(L.latLngBounds([startPos, destPos]), {
          paddingTopLeft: [28, 76],
          paddingBottomRight: [28, 28],
          maxZoom: 14,
          duration: 0.85,
        });
      }
    } else if (!routes || routes.length === 0) {
      map.flyTo(startPos, zoom, { duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destPos ? destPos[0] : null, destPos ? destPos[1] : null, destLabel, !!routes]);

  // Draw real alternative routes (road-following geometry from the router).
  // Inactive routes render dim + clickable; the active one is highlighted
  // and drawn last so it always sits on top.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !readyRef.current) return;

    (layersRef.current.routeLayers || []).forEach((layer) => layer.remove());
    layersRef.current.routeLayers = [];

    if (!routes || routes.length === 0) return;

    const ordered = [...routes].sort((a, b) => (a.active === b.active ? 0 : a.active ? 1 : -1));
    const allPoints = [];

    ordered.forEach((route) => {
      const color = route.color || '#33e6ff';
      allPoints.push(...route.coordinates);

      if (route.active) {
        const glow = L.polyline(route.coordinates, {
          color,
          weight: 9,
          opacity: 0.18,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        layersRef.current.routeLayers.push(glow);
      }

      const line = L.polyline(route.coordinates, {
        className: route.active ? 'fm-route-line' : 'fm-route-line--alt',
        color,
        weight: route.active ? 5 : 3,
        opacity: route.active ? 0.95 : 0.55,
        dashArray: route.active ? '1 12' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: true,
      }).addTo(map);

      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRouteRef.current?.(route.id);
      });
      line.on('mouseover', () => { if (!route.active) line.setStyle({ opacity: 0.85 }); });
      line.on('mouseout', () => { if (!route.active) line.setStyle({ opacity: 0.55 }); });

      // Leaflet-Routing-Machine-style interactive dragging: press-and-drag
      // anywhere on the ACTIVE route line to reroute through that point.
      if (route.active && onRouteDragRef.current) {
        line.on('mousedown touchstart', (e) => {
          L.DomEvent.stopPropagation(e);
          map.dragging.disable();

          const dragMarker = L.circleMarker(e.latlng, {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: route.color,
            fillOpacity: 1,
            className: 'fm-route-drag-handle',
          }).addTo(map);
          layersRef.current.dragMarker = dragMarker;

          const onMove = (ev) => dragMarker.setLatLng(ev.latlng);
          const onUp = (ev) => {
            map.off('mousemove touchmove', onMove);
            map.off('mouseup touchend', onUp);
            map.dragging.enable();
            dragMarker.remove();
            layersRef.current.dragMarker = null;
            onRouteDragRef.current?.([ev.latlng.lat, ev.latlng.lng]);
          };
          map.on('mousemove touchmove', onMove);
          map.on('mouseup touchend', onUp);
        });
      }

      layersRef.current.routeLayers.push(line);
    });

    if (allPoints.length > 1) {
      map.flyToBounds(L.latLngBounds(allPoints), {
        paddingTopLeft: [28, 96],
        paddingBottomRight: [28, 28],
        maxZoom: 15,
        duration: 0.85,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesKey]);

  // Draw extra POI pins (e.g. charging stations) — independent of the
  // start/destination/route layers above, so a charging map can show many
  // stations at once without touching the routing logic.
  const markersKey = markers ? markers.map((m) => `${m.id}:${m.active ? 1 : 0}`).join('|') : '';
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !readyRef.current) return;

    (layersRef.current.poiLayers || []).forEach((layer) => layer.remove());
    layersRef.current.poiLayers = [];

    if (!markers || markers.length === 0) return;

    markers.forEach((m) => {
      const marker = L.marker(m.position, {
        icon: poiIcon(m.kind || 'charge', !!m.active),
        zIndexOffset: m.active ? 450 : 300,
        keyboard: false,
      }).addTo(map);
      if (m.label) marker.bindPopup(`<strong>${m.label}</strong>`);
      marker.on('click', () => onMarkerClickRef.current?.(m));
      layersRef.current.poiLayers.push(marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  return <div id={id} ref={elRef} className={`fm-root ${className}`} style={style} />;
}
