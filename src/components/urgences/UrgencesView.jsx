import React, { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Check,
  X,
  Phone,
  Mail,
  Handshake,
  User as UserIcon,
  Building2,
  Briefcase,
  Redo2,
  Plus,
  AlertTriangle,
  MessageSquare
} from "lucide-react";
import { format, isSameDay, isToday, isTomorrow, isYesterday, startOfToday, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "sonner";
import { db } from "@/lib/db";
import ProposalSheet from "../agenda/ProposalSheet";
import TaskDialog from "../agenda/TaskDialog";
import ContactSheet from "../contacts/ContactSheet";

export default function UrgencesView() {
  const { state, dispatch, isAdmin, refreshAllData } = useApp();
  const { currentUser } = usePermissions();
  
  const [userFilter, setUserFilter] = useState("all");
  const [openSections, setOpenSections] = useState({
    late: true,
    today: true,
    tomorrow: true,
    proposals: true,
    neglected: true
  });

  const [selectedProposal, setSelectedProposal] = useState(null);
  const [isProposalSheetOpen, setIsProposalSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);

  const handleLogInteractionForDeal = (e, deal) => {
    if (e) e.stopPropagation();
    const contact = state.contacts.find(c => c.id === deal.contactId || c.id === deal.clientId);
    if (contact) {
      setSelectedContact(contact);
      setIsContactSheetOpen(true);
    } else {
      toast.error("Contact non trouvé");
    }
  };

  const handlePlanTaskForDeal = (e, deal) => {
    if (e) e.stopPropagation();
    setSelectedTask({ 
      linkedCardId: deal.id, 
      linkedContactId: deal.contactId || deal.clientId 
    });
    setIsTaskDialogOpen(true);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleProposalClick = (prop) => {
    setSelectedProposal(prop);
    setIsProposalSheetOpen(true);
  };

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const today = startOfToday();

  const filteredTasks = useMemo(() => {
    let tasks = Array.isArray(state.tasks) ? state.tasks : [];
    if (!isAdmin) {
      tasks = tasks.filter(t => t.userId === currentUser.id);
    } else if (userFilter !== "all") {
      tasks = tasks.filter(t => t.userId === userFilter);
    }
    return tasks;
  }, [state.tasks, userFilter, isAdmin, currentUser]);

  const activeTasks = useMemo(() => filteredTasks.filter(t => t.status !== "done"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter(t => t.status === "done"), [filteredTasks]);

  const lateTasks = useMemo(() => activeTasks
    .filter(t => new Date(t.date) < today)
    .sort((a, b) => new Date(a.dueDate || a.date) - new Date(b.dueDate || b.date)), 
  [activeTasks, today]);

  const todayTasks = useMemo(() => activeTasks
    .filter(t => isSameDay(new Date(t.date), today))
    .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00")),
  [activeTasks, today]);

  const tomorrowTasks = useMemo(() => activeTasks
    .filter(t => isSameDay(new Date(t.date), addDays(today, 1)))
    .sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00")),
  [activeTasks, today]);

  const pendingProposals = useMemo(() => {
    const allProposals = Array.isArray(state.rdvProposals) ? state.rdvProposals : [];
    let props = allProposals.filter(p => p.status === "pending");
    if (!isAdmin) {
      props = props.filter(p => p.commercialId === currentUser.id);
    } else if (userFilter !== "all") {
      props = props.filter(p => p.commercialId === userFilter);
    }
    return props;
  }, [state.rdvProposals, userFilter, isAdmin, currentUser]);

  // Sort pending proposals chronologically
  const sortedPendingProposals = useMemo(() => [...pendingProposals]
    .sort((a, b) => new Date(a.proposedDate) - new Date(b.proposedDate)),
  [pendingProposals]);

  // Progress calculation: Based on tasks due up to today
  const progressRate = useMemo(() => {
    const tasksDueUpToToday = filteredTasks.filter(t => new Date(t.date) <= today);
    const completedTasksDueUpToToday = tasksDueUpToToday.filter(t => t.status === "done");
    return tasksDueUpToToday.length > 0 
      ? Math.round((completedTasksDueUpToToday.length / tasksDueUpToToday.length) * 100) 
      : 100;
  }, [filteredTasks, today]);

  const ProposalItem = ({ proposal }) => {
    const users = Array.isArray(state.users) ? state.users : [];
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const pipelines = Array.isArray(state.pipelines) ? state.pipelines : [];
    
    const prospector = users.find(u => u.id === proposal.prospectorId);
    const contact = contacts.find(c => c.id === proposal.linkedContactId);
    const card = pipelines.flatMap(p => (p.columns || []).flatMap(col => (col.cards || []))).find(c => c.id === proposal.linkedCardId);

    const propDate = new Date(proposal.proposedDate);

    return (
      <Card 
        className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow group cursor-pointer border-l-4 border-l-amber-500 bg-amber-50/20"
        onClick={() => { setSelectedProposal(proposal); setIsProposalSheetOpen(true); }}
      >
        <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-white rounded-lg border border-amber-200 shadow-sm shrink-0">
          <span className="text-[10px] font-black uppercase text-amber-600 leading-none mb-1">{format(propDate, "MMM", { locale: fr })}</span>
          <span className="text-xl font-black text-slate-900 leading-none">{format(propDate, "dd")}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">{format(propDate, "HH:mm")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-slate-900 truncate">{proposal.title}</p>
            <Badge className="bg-amber-400 text-amber-900 text-[10px] uppercase font-bold border-none">À valider</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-600">
            <span className="font-medium text-amber-700">Par {prospector?.name}</span>
            {contact && (
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> {contact.firstName} {contact.lastName}
              </span>
            )}
            {card && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Briefcase className="w-3 h-3" /> {card.title}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 border-red-100 hover:bg-red-50 font-bold" onClick={(e) => handleRefuseProposal(e, proposal)}>
            Refuser
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs text-green-600 border-green-100 hover:bg-green-50 font-bold" onClick={(e) => handleAcceptProposal(e, proposal)}>
            Accepter
          </Button>
        </div>
      </Card>
    );
  };

  const neglectedDeals = useMemo(() => {
    const pipelines = Array.isArray(state.pipelines) ? state.pipelines : [];
    const allCards = pipelines.flatMap(p => (p.columns || []).flatMap(col => (col.cards || [])));
    const myCards = isAdmin && userFilter === "all" ? allCards : 
                    allCards.filter(c => c.responsibleId === (userFilter === "all" ? currentUser.id : userFilter));
    
    return myCards.filter(card => {
      const contactId = card.contactId || card.clientId || card.contact_id;
      const hasPendingTask = (state.tasks || []).some(t => 
        (t.linkedCardId === card.id || (contactId && t.linkedContactId === contactId && !t.linkedCardId)) 
        && t.status !== "done"
      );
      return !hasPendingTask;
    });
  }, [state.pipelines, state.tasks, userFilter, isAdmin, currentUser]);

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
              userId: currentUser.id,
              action: `Action supprimée depuis les urgences : ${task.title}`
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
              userId: currentUser.id,
              action: `Action reportée à demain depuis les urgences : ${task.title}`
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

  const handleComplete = async (e, taskId) => {
    e.stopPropagation();
    try {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: "done" } : t);
      await db.updateTask(taskId, { ...task, status: "done" });
      dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

      // If linked to a card, update its history
      if (task.linkedCardId) {
        const pipeline = state.pipelines.find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: currentUser.id,
              action: `Action terminée : ${task.title}`
            };
            const updatedCard = {
              ...card,
              history: [historyEntry, ...(card.history || [])]
            };
            await db.updateCard(card.id, updatedCard);
            
            const updatedPipelines = state.pipelines.map(p => {
              if (p.id === pipeline.id) {
                return {
                  ...p,
                  columns: p.columns.map(col => ({
                    ...col,
                    cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
                  }))
                };
              }
              return p;
            });
            dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
          }
        }
      }

      toast.success("Tâche terminée !");
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erreur lors de la mise à jour de la tâche");
    }
  };

  const handleAcceptProposal = async (e, proposal) => {
    e.stopPropagation();
    try {
      // 1. Update proposal status
      await db.updateProposal(proposal.id, { ...proposal, status: "accepted" });
      const updatedProposals = state.rdvProposals.map(p => p.id === proposal.id ? { ...p, status: "accepted" } : p);

      // 2. Create task
      const taskData = {
        title: `RDV : ${proposal.title}`,
        userId: proposal.commercialId,
        assignedTo: proposal.commercialId,
        type: "meeting",
        dueDate: new Date(proposal.proposedDate).toISOString(),
        linkedContactId: proposal.linkedContactId,
        linkedCardId: proposal.linkedCardId,
        status: "pending",
        description: proposal.notes || ""
      };
      const savedTask = await db.insertTask(taskData);
      
      // 3. Audit for linked deal
      if (proposal.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === proposal.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === proposal.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: currentUser.id,
              action: `Proposition de RDV acceptée depuis les urgences : ${proposal.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
          }
        }
      }

      // 4. Notification
      const newNotifData = {
        userId: proposal.prospectorId,
        type: "rdv_proposal_accepted",
        message: `${currentUser.name} a accepté votre proposition : ${proposal.title}`,
        relatedId: proposal.id,
        read: false
      };
      const savedNotif = await db.insertNotification(newNotifData);

      dispatch({ type: "UPDATE_PROPOSALS", payload: updatedProposals });
      dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, savedTask] });
      dispatch({ type: "UPDATE_NOTIFICATIONS", payload: [...state.notifications, savedNotif] });
      
      await refreshAllData();
      toast.success("Proposition acceptée");
    } catch (error) {
      toast.error("Erreur lors de l'acceptation");
    }
  };

  const handleRefuseProposal = async (e, proposal) => {
    e.stopPropagation();
    const reason = prompt("Motif du refus :");
    if (!reason) return;

    try {
      await db.updateProposal(proposal.id, { ...proposal, status: "refused", refusalReason: reason });
      const updatedProposals = state.rdvProposals.map(p => p.id === proposal.id ? { ...p, status: "refused", refusalReason: reason } : p);

      if (proposal.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === proposal.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === proposal.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: currentUser.id,
              action: `Proposition de RDV refusée depuis les urgences : ${proposal.title} (Motif : ${reason})`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
          }
        }
      }

      const newNotifData = {
        userId: proposal.prospectorId,
        type: "rdv_proposal_refused",
        message: `${currentUser.name} a refusé votre proposition : ${proposal.title} (Motif : ${reason})`,
        relatedId: proposal.id,
        read: false
      };
      await db.insertNotification(newNotifData);

      dispatch({ type: "UPDATE_PROPOSALS", payload: updatedProposals });
      await refreshAllData();
      toast.success("Proposition refusée");
    } catch (error) {
      toast.error("Erreur lors du refus");
    }
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

  const TaskItem = ({ task }) => {
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const users = Array.isArray(state.users) ? state.users : [];
    const pipelines = Array.isArray(state.pipelines) ? state.pipelines : [];
    
    const contact = contacts.find(c => c.id === task.linkedContactId);
    
    // Improved card detection
    const allCards = pipelines.flatMap(p => (p.columns || []).flatMap(col => (col.cards || [])));
    const card = allCards.find(c => 
      c.id === task.linkedCardId || (contact && !task.linkedCardId && (c.contactId === contact.id || c.clientId === contact.id))
    );
    
    const assignedUser = users.find(u => u.id === task.userId);
    const taskDate = new Date(task.date);

    return (
      <Card 
        className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow group cursor-pointer"
        onClick={() => handleTaskClick(task)}
      >
        <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-slate-50 rounded-lg border border-slate-200 shadow-sm shrink-0">
          <span className="text-[10px] font-black uppercase text-slate-500 leading-none mb-1">{format(taskDate, "MMM", { locale: fr })}</span>
          <span className="text-xl font-black text-slate-900 leading-none">{format(taskDate, "dd")}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">{task.time}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="shrink-0">
              {getTaskIcon(task.type)}
            </div>
            <p className="font-bold text-sm truncate">{task.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
            {contact && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors">
                    <UserIcon className="w-3 h-3" /> {contact.firstName} {contact.lastName}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-64">
                  <div className="space-y-2">
                    <p className="font-bold">{contact.firstName} {contact.lastName}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Building2 className="w-3 h-3" /> {contact.company}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                      <Phone className="w-3 h-3" /> {contact.phone}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
            {card && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Briefcase className="w-3 h-3" /> {card.title}
              </span>
            )}
            {isAdmin && assignedUser && (
              <Badge variant="ghost" className="text-[10px] p-0 h-auto font-normal">Assigné à {assignedUser.name}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 border-blue-100 hover:bg-blue-50 font-bold" onClick={(e) => handlePostpone(e, task)}>
            <Redo2 className="w-3.5 h-3.5 mr-1.5" /> Reporter
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs text-green-600 border-green-100 hover:bg-green-50 font-bold" onClick={(e) => handleComplete(e, task.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Fait
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={(e) => handleDelete(e, task)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  };

  const lateCount = lateTasks.length;
  const totalCount = lateCount + todayTasks.length + tomorrowTasks.length + sortedPendingProposals.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Urgences</h2>
          <p className="text-slate-500">Actions prioritaires pour les prochaines 48h</p>
        </div>
        
        {isAdmin && (
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Filtrer par membre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'équipe</SelectItem>
              {state.users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isAdmin && (
        <Card className="p-6 bg-white border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500">Aperçu de l'équipe</h3>
            <span className="text-sm font-bold text-red-600">{lateCount} tâches en retard</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Taux de traitement (Dues jusqu'à aujourd'hui)</span>
              <span className="font-bold">{progressRate}%</span>
            </div>
            <Progress value={progressRate} className="h-2 bg-slate-100" />
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {/* EN RETARD */}
        <Collapsible open={openSections.late} onOpenChange={() => toggleSection('late')} className="space-y-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors border border-red-100">
              <div className="flex items-center gap-3">
                <div className="bg-red-500 p-1 rounded-full text-white">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-red-900">En retard</h3>
                <Badge className="bg-red-200 text-red-700 border-none">{lateCount}</Badge>
              </div>
              {openSections.late ? <ChevronDown className="w-5 h-5 text-red-400" /> : <ChevronRight className="w-5 h-5 text-red-400" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2 pl-4">
            {lateTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Aucune tâche en retard 🎉</p>
            ) : (
              lateTasks.map(task => <TaskItem key={task.id} task={task} />)
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* AUJOURD'HUI */}
        <Collapsible open={openSections.today} onOpenChange={() => toggleSection('today')} className="space-y-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors border border-green-100">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-1 rounded-full text-white">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-green-900">Aujourd'hui</h3>
                <Badge className="bg-green-200 text-green-700 border-none">{todayTasks.length}</Badge>
              </div>
              {openSections.today ? <ChevronDown className="w-5 h-5 text-green-400" /> : <ChevronRight className="w-5 h-5 text-green-400" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2 pl-4">
            {todayTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Rien pour aujourd'hui</p>
            ) : (
              todayTasks.map(task => <TaskItem key={task.id} task={task} />)
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* DEMAIN */}
        <Collapsible open={openSections.tomorrow} onOpenChange={() => toggleSection('tomorrow')} className="space-y-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="bg-slate-500 p-1 rounded-full text-white">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-700">Demain</h3>
                <Badge className="bg-slate-300 text-slate-700 border-none">{tomorrowTasks.length}</Badge>
              </div>
              {openSections.tomorrow ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2 pl-4">
            {tomorrowTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Rien pour demain</p>
            ) : (
              tomorrowTasks.map(task => <TaskItem key={task.id} task={task} />)
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* PROPOSITIONS EN ATTENTE */}
        {sortedPendingProposals.length > 0 && (
          <Collapsible open={openSections.proposals} onOpenChange={() => toggleSection('proposals')} className="space-y-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 p-1 rounded-full text-white">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-amber-900">Propositions en attente</h3>
                  <Badge className="bg-amber-200 text-amber-700 border-none">{sortedPendingProposals.length}</Badge>
                </div>
                {openSections.proposals ? <ChevronDown className="w-5 h-5 text-amber-400" /> : <ChevronRight className="w-5 h-5 text-amber-400" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2 pl-4">
              {sortedPendingProposals.map(prop => <ProposalItem key={prop.id} proposal={prop} />)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* AFFAIRES SANS ACTIVITÉ */}
        {neglectedDeals.length > 0 && (
          <Collapsible open={openSections.neglected} onOpenChange={() => toggleSection('neglected')} className="space-y-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 p-1 rounded-full text-white">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-amber-900">Affaires sans activité</h3>
                  <Badge className="bg-amber-200 text-amber-700 border-none">{neglectedDeals.length}</Badge>
                </div>
                {openSections.neglected ? <ChevronDown className="w-5 h-5 text-amber-400" /> : <ChevronRight className="w-5 h-5 text-amber-400" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2 pl-4">
              <p className="text-[11px] text-amber-600 mb-2 font-medium italic">⚠️ Ces affaires n'ont aucune action future planifiée.</p>
              {neglectedDeals.map(deal => {
                const client = state.contacts.find(c => c.id === deal.contactId || c.id === deal.clientId);
                return (
                  <Card 
                    key={deal.id} 
                    className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400 group"
                    onClick={() => handlePlanTaskForDeal(null, deal)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="shrink-0 p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                        <Briefcase className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-900 truncate">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {client?.company || "Client inconnu"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-[11px] text-blue-600 border-blue-100 hover:bg-blue-50 font-bold"
                        onClick={(e) => handleLogInteractionForDeal(e, deal)}
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Consigner
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm"
                        onClick={(e) => handlePlanTaskForDeal(e, deal)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Planifier
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <ProposalSheet 
        proposal={selectedProposal}
        open={isProposalSheetOpen}
        onOpenChange={setIsProposalSheetOpen}
      />

      <TaskDialog 
        task={selectedTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        defaultContactId={selectedTask?.linkedContactId}
        defaultCardId={selectedTask?.linkedCardId}
      />

      <ContactSheet 
        contact={selectedContact}
        open={isContactSheetOpen}
        onOpenChange={setIsContactSheetOpen}
      />
    </div>
  );
}

function Bookmark({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
  )
}

function Bell({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
  )
}
