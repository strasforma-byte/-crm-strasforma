import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  KanbanSquare, 
  Users, 
  Calendar, 
  AlertTriangle, 
  Bell, 
  Settings, 
  LogOut, 
  User as UserIcon,
  Shield,
  Search,
  Plus,
  BarChart3
} from "lucide-react";
import SettingsDialog from "./SettingsDialog";
import UsersManagementDialog from "./UsersManagementDialog";
import { Toaster } from "@/components/ui/sonner";
import PipelineView from "./pipeline/PipelineView";
import ContactsView from "./contacts/ContactsView";
import AgendaView from "./agenda/AgendaView";
import UrgencesView from "./urgences/UrgencesView";
import StatsView from "./StatsView";

export default function Layout() {
  const { state, dispatch, isAdmin } = useApp();
  const [activeTab, setActiveTab] = useState("pipeline");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);

  const user = state.currentUser;
  
  if (!user) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;
  const pendingProposals = (state.rdvProposals || []).filter(p => p.status === "pending" && p.commercialId === user.id).length;
  
  // Calculate emergencies for badge
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const emergenciesCount = (state.tasks || []).filter(t => {
    if (t.status === "done") return false;
    if (t.userId !== user.id && !isAdmin) return false;
    const taskDate = new Date(t.date);
    return taskDate <= today;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-green-600 text-white p-2 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 hidden sm:block">CRM Strasforma</h1>
        </div>

        <div className="flex-1 max-w-md mx-8 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher une affaire, un contact..." 
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadNotifications > 0 && (
                  <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white border-white border-2 text-[10px]">
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex justify-between items-center">
                Notifications
                {unreadNotifications > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-green-600" onClick={() => {
                    const updated = state.notifications.map(n => ({ ...n, read: true }));
                    dispatch({ type: "UPDATE_NOTIFICATIONS", payload: updated });
                  }}>
                    Tout marquer lu
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {(state.notifications || []).length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm italic">Aucune notification</div>
                ) : (
                  state.notifications.slice(0, 10).map((n) => (
                    <div key={n.id} className={`p-3 border-b last:border-0 text-sm ${!n.read ? 'bg-blue-50/50' : ''}`}>
                      <p className={!n.read ? 'font-medium' : ''}>{n.message}</p>
                      <span className="text-[10px] text-slate-400">il y a 2h</span>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="pl-2 pr-1 h-10 rounded-full hover:bg-slate-100 gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
                </div>
                <Avatar className="w-8 h-8" style={{ backgroundColor: user.color }}>
                  <AvatarFallback className="text-white text-xs font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => setIsUsersOpen(true)}>
                  <Shield className="w-4 h-4 mr-2 text-green-600" />
                  Gestion Utilisateurs
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleLogout()}>
                <UserIcon className="w-4 h-4 mr-2" />
                Changer d'utilisateur
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="bg-white border-b border-slate-200 px-6">
            <TabsList className="h-12 bg-transparent p-0 gap-8">
              <TabsTrigger value="pipeline" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium">
                <KanbanSquare className="w-4 h-4 mr-2" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="contacts" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium">
                <Users className="w-4 h-4 mr-2" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="agenda" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium relative">
                <Calendar className="w-4 h-4 mr-2" />
                Agenda
                {pendingProposals > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                    {pendingProposals}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="urgences" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium relative">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Urgences
                {emergenciesCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                    {emergenciesCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="stats" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium">
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50">
            <TabsContent value="pipeline" className="m-0 h-full">
              <PipelineView />
            </TabsContent>
            <TabsContent value="contacts" className="m-0 h-full p-6">
              <ContactsView />
            </TabsContent>
            <TabsContent value="agenda" className="m-0 h-full p-6">
              <AgendaView />
            </TabsContent>
            <TabsContent value="urgences" className="m-0 h-full p-6">
              <UrgencesView />
            </TabsContent>
            <TabsContent value="stats" className="m-0 h-full p-6">
              <StatsView />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <UsersManagementDialog open={isUsersOpen} onOpenChange={setIsUsersOpen} />
      <Toaster position="bottom-right" />
    </div>
  );
}
