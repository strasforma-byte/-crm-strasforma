import React from "react";
import { format, startOfWeek, addDays, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Handshake, Bell, Bookmark, Clock, User as UserIcon, Briefcase } from "lucide-react";
import { useApp } from "@/context/AppContext";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8h to 20h

export default function AgendaWeekView({ tasks, proposals, targetUser, onTaskClick, onProposalClick }) {
  const { state } = useApp();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const getTaskColor = (type) => {
    switch (type) {
      case "call": return "bg-blue-500 border-blue-600";
      case "email": return "bg-purple-500 border-purple-600";
      case "meeting": return "bg-green-500 border-green-600";
      case "relance": return "bg-orange-500 border-orange-600";
      default: return "bg-slate-500 border-slate-600";
    }
  };

  const calculatePosition = (time, duration) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startOffset = (hours - 8) * 60 + minutes;
    const height = (duration / 60) * 80; // 80px per hour
    const top = (startOffset / 60) * 80;
    return { top: `${top}px`, height: `${height}px` };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex border-b bg-slate-50">
        <div className="w-16 shrink-0 border-r" />
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day, i) => (
            <div key={i} className={`py-3 text-center border-r last:border-0 ${isToday(day) ? 'bg-green-50/50' : ''}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(day, "EEE", { locale: fr })}</p>
              <p className={`text-lg font-black ${isToday(day) ? 'text-green-600' : 'text-slate-700'}`}>{format(day, "d")}</p>
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex relative">
          {/* Time axis */}
          <div className="w-16 shrink-0 border-r bg-slate-50/50">
            {HOURS.map(hour => (
              <div key={hour} className="h-20 border-b flex items-start justify-center pt-2">
                <span className="text-[10px] font-bold text-slate-400">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Grid columns */}
          <div className="flex-1 grid grid-cols-7 relative">
            {weekDays.map((day, i) => (
              <div key={i} className={`h-full border-r last:border-0 relative ${isToday(day) ? 'bg-green-50/20' : ''}`}>
                {/* Horizontal lines */}
                {HOURS.map(hour => (
                  <div key={hour} className="h-20 border-b border-slate-100" />
                ))}

                {/* Tasks */}
                {tasks.filter(t => isSameDay(new Date(t.date), day)).map(task => {
                  const pos = calculatePosition(task.time, task.duration || 30);
                  return (
                    <div 
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`absolute left-1 right-1 rounded-md border-l-4 p-1.5 shadow-sm cursor-pointer z-10 text-white transition-all hover:scale-[1.02] hover:shadow-md ${getTaskColor(task.type)}`}
                      style={pos}
                    >
                      <p className="text-[9px] font-bold leading-tight truncate flex items-center gap-1">
                        {task.linkedCardId && <Briefcase className="w-2 h-2 shrink-0" />}
                        {task.title}
                      </p>
                      <p className="text-[8px] opacity-80">{task.time} • {task.duration}m</p>
                    </div>
                  );
                })}

                {/* Proposals */}
                {proposals.filter(p => isSameDay(new Date(p.proposedDate), day)).map(prop => {
                  const propDate = new Date(prop.proposedDate);
                  const time = format(propDate, "HH:mm");
                  const pos = calculatePosition(time, prop.duration || 60);
                  return (
                    <div 
                      key={prop.id}
                      onClick={() => onProposalClick(prop)}
                      className="absolute left-1 right-1 rounded-md border-2 border-dashed border-amber-500 bg-amber-50 p-1.5 shadow-sm cursor-pointer z-10 text-amber-900 transition-all hover:scale-[1.02] hover:shadow-md"
                      style={pos}
                    >
                      <p className="text-[9px] font-bold leading-tight truncate">📋 {prop.title}</p>
                      <p className="text-[8px] text-amber-600">Proposé par {state.users.find(u => u.id === prop.prospectorId)?.name}</p>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current time indicator */}
            {isToday(today) && (
              <div className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none" style={{ top: `${((today.getHours() - 8) * 60 + today.getMinutes()) * (80/60)}px` }}>
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 -mt-1" />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
