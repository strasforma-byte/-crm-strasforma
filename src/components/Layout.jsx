import React, { useState, useMemo } from "react";
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
  LayoutDashboard, 
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
  BarChart3,
  Briefcase,
  X
} from "lucide-react";
import SettingsDialog from "./SettingsDialog";
import UsersManagementDialog from "./UsersManagementDialog";
import { Toaster } from "@/components/ui/sonner";
import PipelineView from "./pipeline/PipelineView";
import ContactsView from "./contacts/ContactsView";
import AgendaView from "./agenda/AgendaView";
import UrgencesView from "./urgences/UrgencesView";
import StatsView from "./StatsView";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";

export default function Layout() {
  const { state, dispatch, isAdmin } = useApp();
  const [activeTab, setActiveTab] = useLocalStorage("paff_active_tab", "pipeline");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchJumpId, setSearchJumpId] = useState(null);

  const user = state.currentUser;
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read) {
        await db.updateNotification(notif.id, { read: true });
        const updated = state.notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
        dispatch({ type: "UPDATE_NOTIFICATIONS", payload: updated });
      }

      if (notif.relatedId) {
        toast.info("Action liée : " + notif.message);
      }
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  const filteredResults = useMemo(() => {
    if (!globalSearch.trim() || globalSearch.length < 2) return { contacts: [], deals: [] };
    const term = globalSearch.toLowerCase();
    
    const contacts = (state.contacts || []).filter(c => 
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) || 
      (c.company || "").toLowerCase().includes(term)
    ).slice(0, 5);

    const deals = (Array.isArray(state.pipelines) ? state.pipelines : []).flatMap(p => 
      (p.columns || []).flatMap(col => (col.cards || []))
    ).filter(d => 
      (d.title || "").toLowerCase().includes(term)
    ).slice(0, 5);

    return { contacts, deals };
  }, [globalSearch, state.contacts, state.pipelines]);

  const handleResultClick = (type, id) => {
    setGlobalSearch("");
    setIsSearchOpen(false);
    setSearchJumpId(id);
    if (type === "contact") {
      setActiveTab("contacts");
    } else if (type === "deal") {
      setActiveTab("pipeline");
    }
  };

  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;
  const pendingProposals = (state.rdvProposals || []).filter(p => p.status === "pending" && p.commercialId === user?.id).length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const emergenciesCount = (state.tasks || []).filter(t => {
    if (t.status === "done") return false;
    if (t.userId !== user?.id && !isAdmin) return false;
    const taskDate = new Date(t.date);
    return taskDate <= today;
  }).length;

  if (!user) return null;

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
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    if (e.target.value.length >= 2) setIsSearchOpen(true);
                    else setIsSearchOpen(false);
                  }}
                  placeholder="Rechercher une affaire, un contact..." 
                  className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-green-500 transition-all outline-none"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px] shadow-2xl" align="start">
              <Command>
                <CommandList className="max-h-[400px]">
                  {filteredResults.contacts.length === 0 && filteredResults.deals.length === 0 ? (
                    <CommandEmpty className="p-4 text-center text-xs text-slate-500">Aucun résultat trouvé.</CommandEmpty>
                  ) : (
                    <>
                      {filteredResults.deals.length > 0 && (
                        <CommandGroup heading="Affaires">
                          {filteredResults.deals.map(deal => (
                            <CommandItem key={deal.id} onSelect={() => handleResultClick("deal", deal.id)} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-3.5 h-3.5 text-green-600" />
                                <span className="font-medium text-sm">{deal.title}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {filteredResults.contacts.length > 0 && (
                        <CommandGroup heading="Contacts">
                          {filteredResults.contacts.map(contact => (
                            <CommandItem key={contact.id} onSelect={() => handleResultClick("contact", contact.id)} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                                <span className="font-medium text-sm">{contact.firstName} {contact.lastName}</span>
                                <span className="text-[10px] text-slate-400 uppercase ml-2">{contact.company}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
            <DropdownMenuContent align="end" className="w-80 shadow-xl border-slate-100">
              <DropdownMenuLabel className="flex justify-between items-center">
                Notifications
                {unreadNotifications > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-green-600 hover:bg-green-50" onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await db.markAllNotificationsAsRead(user.id);
                      const updated = state.notifications.map(n => ({ ...n, read: true }));
                      dispatch({ type: "UPDATE_NOTIFICATIONS", payload: updated });
                      toast.success("Toutes les notifications sont lues");
                    } catch (error) {
                      toast.error("Erreur lors de la mise à jour");
                    }
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
                    <div 
                      key={n.id} 
                      className={`p-3 border-b last:border-0 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <p className={!n.read ? 'font-bold text-slate-900' : 'text-slate-600'}>{n.message}</p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {(() => {
                          const d = new Date(n.created_at || n.createdAt);
                          return !isNaN(d.getTime()) 
                            ? formatDistanceToNow(d, { addSuffix: true, locale: fr })
                            : "Récemment";
                        })()}
                      </span>
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
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-xl border-slate-100">
              <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => setIsUsersOpen(true)} className="cursor-pointer">
                  <Shield className="w-4 h-4 mr-2 text-green-600" />
                  Gestion Utilisateurs
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="bg-white border-b border-slate-200 px-6 flex items-center justify-between overflow-x-auto scrollbar-hide">
            <TabsList className="h-12 bg-transparent gap-8 p-0">
              <TabsTrigger value="pipeline" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 gap-2 font-bold text-slate-500 data-[state=active]:text-green-700">
                <LayoutDashboard className="w-4 h-4" /> Pipeline
              </TabsTrigger>
              <TabsTrigger value="agenda" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 gap-2 font-bold text-slate-500 data-[state=active]:text-green-700 relative">
                <Calendar className="w-4 h-4" /> Agenda
                {pendingProposals > 0 && <span className="absolute -top-1 -right-2 w-4 h-4 bg-amber-500 text-white text-[8px] flex items-center justify-center rounded-full border border-white font-bold">{pendingProposals}</span>}
              </TabsTrigger>
              <TabsTrigger value="urgences" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 gap-2 font-bold text-slate-500 data-[state=active]:text-green-700 relative">
                <AlertTriangle className="w-4 h-4" /> Urgences
                {emergenciesCount > 0 && <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-600 text-white text-[8px] flex items-center justify-center rounded-full border border-white font-bold">{emergenciesCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="contacts" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 gap-2 font-bold text-slate-500 data-[state=active]:text-green-700">
                <Users className="w-4 h-4" /> Contacts
              </TabsTrigger>
              <TabsTrigger value="stats" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 gap-2 font-bold text-slate-500 data-[state=active]:text-green-700">
                <BarChart3 className="w-4 h-4" /> Stats
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pipeline" className="flex-1 mt-0 overflow-hidden">
            <PipelineView jumpToId={searchJumpId} onJumpHandled={() => setSearchJumpId(null)} />
          </TabsContent>
          <TabsContent value="contacts" className="flex-1 mt-0 overflow-auto">
            <ContactsView jumpToId={searchJumpId} onJumpHandled={() => setSearchJumpId(null)} />
          </TabsContent>
          <TabsContent value="agenda" className="flex-1 mt-0 overflow-hidden">
            <AgendaView />
          </TabsContent>
          <TabsContent value="urgences" className="flex-1 mt-0 overflow-auto p-6">
            <UrgencesView />
          </TabsContent>
          <TabsContent value="stats" className="flex-1 mt-0 overflow-auto p-6">
            <StatsView />
          </TabsContent>
        </Tabs>
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <UsersManagementDialog open={isUsersOpen} onOpenChange={setIsUsersOpen} />
      <Toaster position="bottom-right" />
    </div>
  );
}
