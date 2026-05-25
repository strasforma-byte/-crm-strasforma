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
  MoreVertical,
  Plus,
  Phone,
  Mail,
  Handshake,
  Bell,
  Tag as TagIcon,
  FileText,
  Trash2,
  Calendar
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { db } from "@/lib/db";
import { toast } from "sonner";

const PRESET_TAGS = [
  { label: "Urgent ⚡", value: "urgent", color: "bg-red-100 text-red-700 border-red-200" },
  { label: "Partenaire 🤝", value: "partenaire", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { label: "Premium ⭐", value: "premium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { label: "Suivi requis 🔔", value: "follow-up", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { label: "En attente ⏳", value: "on-hold", color: "bg-slate-100 text-slate-700 border-slate-200" }
];

export default function KanbanCard({ card, onClick, isOverlay }) {
  const { state, dispatch, refreshAllData } = useApp();
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

  const getTaskIcon = (type) => {
    switch (type) {
      case "call": return <Phone className="w-3 h-3" />;
      case "email": return <Mail className="w-3 h-3" />;
      case "meeting": return <Handshake className="w-3 h-3" />;
      case "relance": return <Bell className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const handleDelete = async (e) => {
    try {
      await db.deleteCard(card.id);
      dispatch({ type: "UPDATE_PIPELINES", payload: state.pipelines.map(p => ({
        ...p,
        columns: p.columns.map(col => ({
          ...col,
          cards: col.cards.filter(c => c.id !== card.id)
        }))
      }))});
      toast.success("Affaire supprimée");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const activeTags = (card.tags || []).map(val => PRESET_TAGS.find(t => t.value === val)).filter(Boolean);

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`relative group bg-white border-slate-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing overflow-hidden ${isOverlay ? 'shadow-xl rotate-2 scale-105 z-50 ring-2 ring-green-500' : ''}`}
      onClick={(e) => {
        // Prevent click if it was a drag
        if (transform && (Math.abs(transform.x) > 0 || Math.abs(transform.y) > 0)) return;
        onClick && onClick(card);
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
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            <span className="truncate">{client?.company || "Entreprise inconnue"}</span>
          </div>
          
          {activeTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {activeTags.slice(0, 2).map(tag => (
                <Badge key={tag.value} variant="outline" className={`px-1.5 py-0 h-4 text-[8px] uppercase font-black tracking-tighter ${tag.color}`}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          )}

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
              <div className={cn("flex items-center gap-1.5", 
                new Date(nextTask.date) < new Date() && !isToday(new Date(nextTask.date)) ? "text-red-500 font-bold" : 
                isToday(new Date(nextTask.date)) ? "text-orange-500 font-bold" : ""
              )}>
                {getTaskIcon(nextTask.type)}
                <span>{new Date(nextTask.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </div>
            ) : (
              <div className="flex items-center text-amber-500">
                <AlertTriangle className="w-3 h-3 mr-1" />
                <span>Pas d'activité</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button 
              className="p-1 text-slate-300 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onClick && onClick(card, true); // True means "open task dialog"
              }}
              title="Ajouter une action"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 text-slate-300 hover:text-slate-600 transition-colors" onClick={e => e.stopPropagation()}>
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 shadow-xl">
                <DropdownMenuItem onClick={() => onClick && onClick(card)} className="cursor-pointer font-bold">
                  <FileText className="w-4 h-4 mr-2" /> Voir les détails
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClick && onClick(card, true)} className="cursor-pointer text-blue-600 font-bold">
                  <Calendar className="w-4 h-4 mr-2" /> Planifier action
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-red-600 cursor-pointer font-bold" onSelect={e => e.preventDefault()}>
                      <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette affaire ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Toutes les données liées à <strong>{card.title}</strong> seront perdues.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
