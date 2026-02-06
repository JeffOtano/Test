import { Sidebar } from '@/components/layout/sidebar';
import { SyncBootstrap } from '@/components/sync/bootstrap';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <SyncBootstrap />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}
