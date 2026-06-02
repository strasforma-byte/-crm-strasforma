import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { addDays, subDays, addMonths, subMonths, format, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, List, Columns, Plus, User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AgendaMonthView from "./AgendaMonthView";
import AgendaWeekView from "./AgendaWeekView";
import AgendaListView from "./AgendaListView";
import TaskDialog from "./TaskDialog";
import ProposalSheet from "./ProposalSheet";

export default function AgendaView() {
  const { state, dispatch, isAdmin, isProspecteur, isCommercial } = useApp();
  const { canViewUserAgenda } = usePermissions();

  const [view, setView] = useState("week");
  const [baseDate, setBaseDate] = useState(new Date());
  const [targetUserId, setTargetUserId] = useState(state.currentUser?.id);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isProposalSheetOpen, setIsProposalSheetOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);

  const handlePrev = () => {
    if (view === "month") setBaseDate(subMonths(baseDate, 1));
    else setBaseDate(subDays(baseDate, 7));
  };

  const handleNext = () => {
    if (view === "month") setBaseDate(addMonths(baseDate, 1));
    else setBaseDate(addDays(baseDate, 7));
  };

  const handleToday = () => setBaseDate(new Date());

  const getPeriodLabel = () => {
    if (view === "month") return format(baseDate, "MMMM yyyy", { locale: fr });
    if (view === "week") {
      const start = startOfWeek(baseDate, { weekStartsOn: 1 });
      const end = endOfWeek(baseDate, { weekStartsOn: 1 });
      if (start.getMonth() === end.getMonth()) {
        return `Semaine du ${format(start, "d")} au ${format(end, "d MMMM yyyy", { locale: fr })}`;
      }
      return `Semaine du ${format(start, "d MMMM")} au ${format(end, "d MMMM yyyy", { locale: fr })}`;
    }
    return "Prochaines actions";
  };

  const targetUser = state.users.find(u => u.id === targetUserId);
  
  const userTasks = useMemo(() => {
    const internalTasks = state.tasks.filter(t => t.userId === targetUserId);
    
    // If viewing own agenda, add external events
    if (targetUserId === state.currentUser?.id && state.externalEvents) {
      return [...internalTasks, ...state.externalEvents];
    }
    
    return internalTasks;
  }, [state.tasks, state.externalEvents, targetUserId, state.currentUser?.id]);

  const userProposals = useMemo(() => {
    return state.rdvProposals.filter(p => p.commercialId === targetUserId || p.prospectorId === targetUserId);
  }, [state.rdvProposals, targetUserId]);

  const commercialsWithSharedAgenda = useMemo(() => {
    return state.users.filter(u => u.role === "commercial" && (u.settings?.shareAgendaWithProspectors || isAdmin));
  }, [state.users, isAdmin]);

  const handleOpenTask = (task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleOpenProposal = (proposal) => {
    setSelectedProposal(proposal);
    setIsProposalSheetOpen(true);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Agenda
            <Badge variant="outline" className="text-[10px] font-black text-slate-400 border-slate-200 uppercase tracking-widest px-2 py-0.5">
              {userTasks.length} ACTIONS
            </Badge>
          </h2>
          
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-50" onClick={handlePrev}>
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            <Button variant="ghost" className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50" onClick={handleToday}>
              Aujourd'hui
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-50" onClick={handleNext}>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Button>
          </div>

          <span className="text-lg font-bold text-slate-600 capitalize">
            {getPeriodLabel()}
          </span>
          
          {(isAdmin || isProspecteur) && (
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger className="w-[200px] h-10 bg-white border-slate-200 font-bold text-xs">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={state.currentUser.id} className="font-bold">Mon agenda</SelectItem>
                {state.users.filter(u => u.id !== state.currentUser.id && canViewUserAgenda(u)).map(u => (
                  <SelectItem key={u.id} value={u.id} className="font-medium">Agenda de {u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={(val) => val && setView(val)} className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <ToggleGroupItem value="month" className="px-4 h-8 text-[10px] font-black uppercase tracking-tight data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 text-slate-500">
              <Calendar className="w-3.5 h-3.5 mr-2" /> Mois
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-4 h-8 text-[10px] font-black uppercase tracking-tight data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 text-slate-500">
              <Columns className="w-3.5 h-3.5 mr-2" /> Semaine
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className="px-4 h-8 text-[10px] font-black uppercase tracking-tight data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900 text-slate-500">
              <List className="w-3.5 h-3.5 mr-2" /> Liste
            </ToggleGroupItem>
          </ToggleGroup>

          <Button onClick={() => { setSelectedTask(null); setIsTaskDialogOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-100 h-10 px-6">
            <Plus className="w-4 h-4 mr-2" />
            Tâche
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {view === "month" && <AgendaMonthView baseDate={baseDate} tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
        {view === "week" && <AgendaWeekView baseDate={baseDate} tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
        {view === "list" && <AgendaListView baseDate={baseDate} tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
      </div>

      <TaskDialog 
        task={selectedTask} 
        open={isTaskDialogOpen} 
        onOpenChange={setIsTaskDialogOpen} 
      />

      <ProposalSheet 
        proposal={selectedProposal}
        open={isProposalSheetOpen}
        onOpenChange={setIsProposalSheetOpen}
      />
    </div>
  );
}
