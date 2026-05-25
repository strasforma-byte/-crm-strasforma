import React from "react";
import { format, isSameDay, isToday, isTomorrow, isYesterday, addDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Phone, Mail, Handshake, Bell, Bookmark, Clock, CheckCircle2, Briefcase, User as UserIcon, X, Redo2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function AgendaListView({ tasks, proposals, onTaskClick, onProposalClick }) {
  const { state, dispatch } = useApp();
  const today = new Date();

  const handleComplete = async (e, task) => {
    e.stopPropagation();
    try {
      const updatedTasks = state.tasks.map(t => t.id === task.id ? { ...t, status: "done" } : t);
      await db.updateTask(task.id, { ...task, status: "done" });
      dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

      // Audit automatique pour les affaires liées
      if (task.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Action terminée depuis l'agenda : ${task.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            
            const updatedPipelines = state.pipelines.map(p => p.id === pipeline.id ? {
              ...p,
              columns: p.columns.map(col => ({
                ...col,
                cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
              }))
            } : p);
            dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
          }
        }
      }

      toast.success("Action terminée !");
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (e, task) => {
    e.stopPropagation();
    try {
      // 1. Delete from DB
      await db.deleteTask(task.id);

      // 2. Update local state
      const updated = state.tasks.filter(t => t.id !== task.id);
      dispatch({ type: "UPDATE_TASKS", payload: updated });

      // 3. If linked to a card, update its history
      if (task.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Action supprimée depuis l'agenda : ${task.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            
            const updatedPipelines = state.pipelines.map(p => p.id === pipeline.id ? {
              ...p,
              columns: p.columns.map(col => ({
                ...col,
                cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
              }))
            } : p);
            dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
          }
        }
      }

      toast.success("Tâche supprimée");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handlePostpone = async (e, task) => {
    e.stopPropagation();
    try {
      const tomorrow = addDays(new Date(), 1);
      const newDateStr = format(tomorrow, "yyyy-MM-dd");
      const newDueDate = new Date(tomorrow);
      const [h, m] = (task.time || "09:00").split(":").map(Number);
      newDueDate.setHours(h, m);

      const updatedTaskData = { 
        ...task, 
        date: newDateStr, 
        dueDate: newDueDate.toISOString() 
      };

      await db.updateTask(task.id, updatedTaskData);
      
      const updatedTasks = state.tasks.map(t => t.id === task.id ? { ...t, date: newDateStr, dueDate: updatedTaskData.dueDate } : t);
      dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

      // Audit automatique pour les affaires liées
      if (task.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Action reportée à demain : ${task.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            await refreshAllData();
          }
        }
      }

      toast.success("Action reportée à demain");
    } catch (error) {
      console.error("Error postponing task:", error);
      toast.error("Erreur lors du report");
    }
  };

  // List from yesterday to 7 days in the future
  const days = eachDayOfInterval({
    start: addDays(today, -1),
    end: addDays(today, 14),
  });

  const getDayLabel = (day) => {
    if (isToday(day)) return "Aujourd'hui";
    if (isTomorrow(day)) return "Demain";
    if (isYesterday(day)) return "Hier";
    return format(day, "EEEE d MMMM", { locale: fr });
  };

  const getTaskIcon = (type) => {
    switch (type) {
      case "call": return <Phone className="w-4 h-4 text-blue-500" />;
      case "email": return <Mail className="w-4 h-4 text-purple-500" />;
      case "meeting": return <Handshake className="w-4 h-4 text-green-500" />;
      case "relance": return <Bell className="w-4 h-4 text-orange-500" />;
      default: return <Bookmark className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-8">
        {days.map((day, idx) => {
          const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), day));
          const dayProposals = proposals.filter(p => isSameDay(new Date(p.proposedDate), day));

          if (dayTasks.length === 0 && dayProposals.length === 0) return null;

          return (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-4">
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isToday(day) ? 'text-green-600' : 'text-slate-500'}`}>
                  {getDayLabel(day)}
                </h3>
                <Separator className="flex-1" />
              </div>

              <div className="grid gap-3">
                {dayTasks.map(task => (
                  <Card 
                    key={task.id} 
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-all group border-l-4 ${task.status === 'done' ? 'opacity-60 border-l-slate-300' : 'border-l-green-600'}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {task.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : getTaskIcon(task.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm truncate ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
                          <Badge variant="outline" className="text-[10px] uppercase shrink-0">{task.type}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="text-xs text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> {task.time}
                          </span>
                          {task.linkedContactId && (
                            <span className="text-xs text-blue-600 flex items-center">
                              <UserIcon className="w-3 h-3 mr-1" />
                              {state.contacts.find(c => c.id === task.linkedContactId)?.firstName} {state.contacts.find(c => c.id === task.linkedContactId)?.lastName}
                            </span>
                          )}
                          {task.linkedCardId && (
                            <span className="text-xs text-green-600 flex items-center">
                              <Briefcase className="w-3 h-3 mr-1" />
                              {(Array.isArray(state.pipelines) ? state.pipelines : []).flatMap(p => (p.columns || []).flatMap(col => (col.cards || []))).find(c => c.id === task.linkedCardId)?.title || "Affaire"}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.status !== 'done' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs text-blue-600 border-blue-100 hover:bg-blue-50 font-bold"
                            onClick={(e) => handlePostpone(e, task)}
                          >
                            <Redo2 className="w-3.5 h-3.5 mr-1.5" /> Reporter
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs text-green-600 border-green-100 hover:bg-green-50 font-bold"
                            onClick={(e) => handleComplete(e, task)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Fait
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={(e) => handleDelete(e, task)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}

                {dayProposals.map(prop => (
                  <Card 
                    key={prop.id} 
                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 border-l-amber-400 bg-amber-50/30"
                    onClick={() => onProposalClick(prop)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0 text-xl">📋</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">PROPOSITION : {prop.title}</p>
                          <Badge className="bg-amber-400 text-amber-900 text-[10px] uppercase">En attente</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Proposé par {state.users.find(u => u.id === prop.prospectorId)?.name} pour {format(new Date(prop.proposedDate), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
