import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, List, Columns, Plus, User as UserIcon } from "lucide-react";
import AgendaMonthView from "./AgendaMonthView";
import AgendaWeekView from "./AgendaWeekView";
import AgendaListView from "./AgendaListView";
import TaskDialog from "./TaskDialog";
import ProposalSheet from "./ProposalSheet";

export default function AgendaView() {
  const { state, dispatch, isAdmin, isProspecteur, isCommercial } = useApp();
  const { canViewUserAgenda } = usePermissions();

  const [view, setView] = useState("week");
  const [targetUserId, setTargetUserId] = useState(state.currentUser?.id);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isProposalSheetOpen, setIsProposalSheetOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);

  const targetUser = state.users.find(u => u.id === targetUserId);
  
  const userTasks = useMemo(() => {
    return state.tasks.filter(t => t.userId === targetUserId);
  }, [state.tasks, targetUserId]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Agenda</h2>
          
          {(isAdmin || isProspecteur) && (
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger className="w-[200px] bg-white">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={state.currentUser.id}>Mon agenda</SelectItem>
                {state.users.filter(u => u.id !== state.currentUser.id && canViewUserAgenda(u)).map(u => (
                  <SelectItem key={u.id} value={u.id}>Agenda de {u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={(val) => val && setView(val)} className="bg-white border p-1 rounded-lg">
            <ToggleGroupItem value="month" className="px-3 h-8 text-xs data-[state=on]:bg-slate-100">
              <Calendar className="w-3.5 h-3.5 mr-2" /> Mois
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-3 h-8 text-xs data-[state=on]:bg-slate-100">
              <Columns className="w-3.5 h-3.5 mr-2" /> Semaine
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className="px-3 h-8 text-xs data-[state=on]:bg-slate-100">
              <List className="w-3.5 h-3.5 mr-2" /> Liste
            </ToggleGroupItem>
          </ToggleGroup>

          <Button onClick={() => { setSelectedTask(null); setIsTaskDialogOpen(true); }} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Tâche
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {view === "month" && <AgendaMonthView tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
        {view === "week" && <AgendaWeekView tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
        {view === "list" && <AgendaListView tasks={userTasks} proposals={userProposals} targetUser={targetUser} onTaskClick={handleOpenTask} onProposalClick={handleOpenProposal} />}
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
