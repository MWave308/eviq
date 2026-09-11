import { lazy, Suspense } from 'react';

// three.js + GLTF/DRACO loaders are the single heaviest dependency in the
// app. Loading Car3DViewer lazily keeps it in its own chunk (see
// vite.config.js manualChunks) so the rest of the UI paints and becomes
// interactive immediately, while the 3D viewer streams in right behind it.
const Car3DViewer = lazy(() => import('./Car3DViewer'));

function Car3DFallback({ size = 'lg', className = '' }) {
  return (
    <div
      className={`car3d-stage car3d-stage--${size} car3d-fallback ${className}`}
      role="img"
      aria-label="Loading 3D vehicle view"
    />
  );
}

export default function Car3DViewerLazy(props) {
  return (
    <Suspense fallback={<Car3DFallback size={props.size} className={props.className} />}>
      <Car3DViewer {...props} />
    </Suspense>
  );
}
