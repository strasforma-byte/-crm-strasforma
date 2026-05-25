import React, { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Building2, 
  Clock, 
  AlertTriangle, 
  GripVertical, 
  MoreVertical 
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";

export default function KanbanCard({ card, onClick, isOverlay }) {
  const { state } = useApp();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card?.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const client = useMemo(() => 
    state.contacts.find(c => 
      c.id === card?.contactId || 
      c.id === card?.clientId || 
      c.id === card?.contact_id
    ),
    [state.contacts, card]
  );

  const responsible = useMemo(() => 
    state.users.find(u => u.id === card?.responsibleId),
    [state.users, card?.responsibleId]
  );

  // Unified Task Logic: Get the earliest pending task linked to this card
  const nextTask = useMemo(() => {
    if (!card?.id || !Array.isArray(state.tasks)) return null;
    const cardTasks = state.tasks.filter(t => t.linkedCardId === card.id && t.status !== "done");
    if (cardTasks.length === 0) return null;
    return [...cardTasks].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  }, [state.tasks, card?.id]);

  // Status bar logic based on nextTask
  const getStatusColor = () => {
    if (!nextTask) return "bg-yellow-500";
    const now = new Date();
    const actionDate = new Date(nextTask.date);
    if (isNaN(actionDate.getTime())) return "bg-yellow-500";
    
    if (actionDate < now && !isToday(actionDate)) return "bg-red-500";
    if (isToday(actionDate)) return "bg-orange-500";
    return "bg-green-500";
  };

  if (!card) return null;

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`relative group bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing overflow-hidden ${isOverlay ? 'shadow-xl rotate-2 scale-105 z-50 ring-2 ring-green-500' : ''}`}
      onClick={(e) => {
        // Prevent click if it was a drag
        if (transform && (Math.abs(transform.x) > 0 || Math.abs(transform.y) > 0)) return;
        onClick && onClick();
      }}
      {...attributes}
      {...listeners}
    >
      <div className={`h-1 w-full absolute top-0 left-0 ${getStatusColor()}`} />
      
      <CardContent className="p-3 pt-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-slate-300 group-hover:text-slate-500 p-0.5 transition-colors">
              <GripVertical className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
              {card.title}
            </h4>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center text-[11px] text-slate-500">
            <Building2 className="w-3 h-3 mr-1.5" />
            <span className="truncate">{client?.company || "Entreprise inconnue"}</span>
          </div>
          
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <Avatar className="w-5 h-5 border-2 border-white shadow-sm">
                <AvatarFallback className="text-[8px] text-white font-bold" style={{ backgroundColor: responsible?.color }}>
                  {responsible?.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-medium text-slate-600 truncate max-w-[80px]">
                {responsible?.name}
              </span>
            </div>
            <div className="font-bold text-green-600 text-xs">
              {card.value?.toLocaleString()} €
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            {nextTask ? (
              <div className={cn("flex items-center gap-1", 
                new Date(nextTask.date) < new Date() && !isToday(new Date(nextTask.date)) ? "text-red-500 font-bold" : 
                isToday(new Date(nextTask.date)) ? "text-orange-500 font-bold" : ""
              )}>
                <Clock className="w-3 h-3" />
                <span>{new Date(nextTask.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </div>
            ) : (
              <div className="flex items-center text-amber-500">
                <AlertTriangle className="w-3 h-3 mr-1" />
                <span>Pas d'activité</span>
              </div>
            )}
          </div>
          <button className="text-slate-300 hover:text-slate-600">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
