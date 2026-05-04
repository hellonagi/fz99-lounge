import './overlay.css';

export const metadata = {
  title: 'FZ99 Lounge Overlay',
  robots: { index: false, follow: false },
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="overlay-root">{children}</div>;
}
