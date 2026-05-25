import React from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, Mail, Handshake, Bell, Bookmark, Briefcase } from "lucide-react";

export default function AgendaMonthView({ tasks, proposals, onTaskClick, onProposalClick }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getTaskIcon = (type) => {
    switch (type) {
      case "call": return <Phone className="w-2.5 h-2.5" />;
      case "email": return <Mail className="w-2.5 h-2.5" />;
      case "meeting": return <Handshake className="w-2.5 h-2.5" />;
      case "relance": return <Bell className="w-2.5 h-2.5" />;
      default: return <Bookmark className="w-2.5 h-2.5" />;
    }
  };

  const getTaskColor = (type) => {
    switch (type) {
      case "call": return "bg-blue-500";
      case "email": return "bg-purple-500";
      case "meeting": return "bg-green-500";
      case "relance": return "bg-orange-500";
      default: return "bg-slate-500";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b bg-slate-50">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-auto">
        {calendarDays.map((day, i) => {
          const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), day));
          const dayProposals = proposals.filter(p => isSameDay(new Date(p.proposedDate), day));
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={i} 
              className={`min-h-[100px] border-r border-b p-2 flex flex-col gap-1 transition-colors hover:bg-slate-50/50 ${!isCurrentMonth ? 'bg-slate-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${isToday(day) ? 'bg-green-600 text-white' : isCurrentMonth ? 'text-slate-900' : 'text-slate-300'}`}>
                  {format(day, "d")}
                </span>
                {(dayTasks.length + dayProposals.length) > 0 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 bg-white">
                    {dayTasks.length + dayProposals.length}
                  </Badge>
                )}
              </div>

              <div className="flex-1 space-y-1 overflow-hidden">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] text-white flex items-center gap-1 truncate ${getTaskColor(task.type)} ${task.status === 'done' ? 'opacity-50' : ''}`}
                  >
                    {task.linkedCardId ? <Briefcase className="w-2 h-2 shrink-0" /> : getTaskIcon(task.type)}
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                
                {dayProposals.slice(0, 2).map(prop => (
                  <button
                    key={prop.id}
                    onClick={() => onProposalClick(prop)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[9px] bg-amber-400 text-amber-900 border border-amber-500/20 font-bold truncate flex items-center gap-1"
                  >
                    📋 {prop.title}
                  </button>
                ))}

                {(dayTasks.length + dayProposals.length) > 5 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] text-slate-400 hover:text-slate-600 font-medium w-full text-center">
                        + {dayTasks.length + dayProposals.length - 5} autres
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2">
                      <div className="space-y-1">
                        <p className="text-xs font-bold mb-2 pb-1 border-b">{format(day, "dd MMMM", { locale: fr })}</p>
                        {dayTasks.map(task => (
                          <div key={task.id} className={`flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer`} onClick={() => onTaskClick(task)}>
                            <div className={`w-2 h-2 rounded-full ${getTaskColor(task.type)}`} />
                            <span className="text-xs truncate">{task.title}</span>
                            <span className="text-[10px] text-slate-400 ml-auto">{task.time}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
