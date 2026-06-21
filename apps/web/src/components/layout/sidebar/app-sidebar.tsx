import * as React from 'react';
import { Factory } from 'lucide-react';

import { NavMain } from './nav-main';
import { NavProjects } from './nav-projects';
import { NavUser } from './nav-user';
import { TeamSwitcher } from './team-switcher';
import { erpNavGroups, quickLinks } from '../nav-data';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: {
    email: string;
    roles: string[];
  };
  onLogout: () => void;
};

export function AppSidebar({ user, onLogout, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: 'Arc N Code ERP',
              logo: Factory,
              plan: 'Manufacturing Suite',
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={erpNavGroups} />
        <NavProjects projects={quickLinks} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
