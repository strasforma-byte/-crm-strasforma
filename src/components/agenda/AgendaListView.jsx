import React from "react";
import { format, isSameDay, isToday, isTomorrow, isYesterday, addDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Phone, Mail, Handshake, Bell, Bookmark, Clock, CheckCircle2, Briefcase } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function AgendaListView({ tasks, proposals, onTaskClick, onProposalClick }) {
  const { state } = useApp();
  const today = new Date();
  
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
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${task.status === 'done' ? 'opacity-60 border-l-slate-300' : 'border-l-green-600'}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {task.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : getTaskIcon(task.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">{task.type}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> {task.time} ({task.duration} min)
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
                              {state.pipelines.flatMap(p => p.columns.flatMap(col => col.cards)).find(c => c.id === task.linkedCardId)?.title}
                            </span>
                          )}
                        </div>
                      </div>
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

function UserIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  )
}
