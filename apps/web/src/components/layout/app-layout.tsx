import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppSidebar } from './sidebar/app-sidebar';
import { findActiveNavLabel } from './nav-data';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { clearSession, getSession } from '../../lib/auth';

export function AppLayout() {
  const session = getSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pageLabel = findActiveNavLabel(pathname);

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  if (!session) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session} onLogout={handleLogout} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/products">Arc N Code ERP</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0" data-tour="main-content">
          <div className="min-h-[calc(100vh-5rem)] p-4 pt-6">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
