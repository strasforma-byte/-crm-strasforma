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
  X,
  Phone,
  Mail,
  Handshake,
  User as UserIcon,
  Building2,
  Briefcase
} from "lucide-react";
import { format, isSameDay, isToday, isTomorrow, isYesterday, startOfToday, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "sonner";

export default function UrgencesView() {
  const { state, dispatch, isAdmin } = useApp();
  const { currentUser } = usePermissions();
  
  const [userFilter, setUserFilter] = useState("all");
  const [openSections, setOpenSections] = useState({
    late: true,
    today: true,
    tomorrow: true,
    proposals: true
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const today = startOfToday();

  const filteredTasks = useMemo(() => {
    let tasks = state.tasks; // All tasks, including "done" for progress calculation
    if (!isAdmin) {
      tasks = tasks.filter(t => t.userId === currentUser.id);
    } else if (userFilter !== "all") {
      tasks = tasks.filter(t => t.userId === userFilter);
    }
    return tasks;
  }, [state.tasks, userFilter, isAdmin, currentUser]);

  const activeTasks = useMemo(() => filteredTasks.filter(t => t.status !== "done"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter(t => t.status === "done"), [filteredTasks]);

  const lateTasks = activeTasks.filter(t => new Date(t.date) < today);
  const todayTasks = activeTasks.filter(t => isSameDay(new Date(t.date), today));
  const tomorrowTasks = activeTasks.filter(t => isSameDay(new Date(t.date), addDays(today, 1)));

  // Progress calculation: Based on tasks due up to today
  const tasksDueUpToToday = filteredTasks.filter(t => new Date(t.date) <= today);
  const completedTasksDueUpToToday = tasksDueUpToToday.filter(t => t.status === "done");
  const progressRate = tasksDueUpToToday.length > 0 
    ? Math.round((completedTasksDueUpToToday.length / tasksDueUpToToday.length) * 100) 
    : 100;

  const pendingProposals = useMemo(() => {
    let props = state.rdvProposals.filter(p => p.status === "pending");
    if (!isAdmin) {
      props = props.filter(p => p.commercialId === currentUser.id);
    } else if (userFilter !== "all") {
      props = props.filter(p => p.commercialId === userFilter);
    }
    return props;
  }, [state.rdvProposals, userFilter, isAdmin, currentUser]);

  const handleComplete = (taskId) => {
    const updated = state.tasks.map(t => t.id === taskId ? { ...t, status: "done" } : t);
    dispatch({ type: "UPDATE_TASKS", payload: updated });
    toast.success("Tâche terminée !");
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
    const contact = state.contacts.find(c => c.id === task.linkedContactId);
    const card = state.pipelines.flatMap(p => p.columns.flatMap(col => col.cards)).find(c => c.id === task.linkedCardId);
    const assignedUser = state.users.find(u => u.id === task.userId);

    return (
      <Card className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow group">
        <div className="shrink-0 p-2 bg-slate-50 rounded-lg">
          {getTaskIcon(task.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm truncate">{task.title}</p>
            <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 h-4">{task.time}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
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
          <Button variant="outline" size="sm" className="h-8 text-xs text-green-600" onClick={() => handleComplete(task.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Fait
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  };

  const lateCount = lateTasks.length;
  const totalCount = lateCount + todayTasks.length + tomorrowTasks.length + pendingProposals.length;

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
        {pendingProposals.length > 0 && (
          <Collapsible open={openSections.proposals} onOpenChange={() => toggleSection('proposals')} className="space-y-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 p-1 rounded-full text-white">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-amber-900">Propositions en attente</h3>
                  <Badge className="bg-amber-200 text-amber-700 border-none">{pendingProposals.length}</Badge>
                </div>
                {openSections.proposals ? <ChevronDown className="w-5 h-5 text-amber-400" /> : <ChevronRight className="w-5 h-5 text-amber-400" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2 pl-4">
              {pendingProposals.map(prop => (
                <Card key={prop.id} className="p-4 flex items-center gap-4 bg-amber-50/30 border-amber-100">
                  <div className="text-xl">📋</div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{prop.title}</p>
                    <p className="text-xs text-slate-500">Proposé par {state.users.find(u => u.id === prop.prospectorId)?.name}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-100">
                    Traiter
                  </Button>
                </Card>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
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
