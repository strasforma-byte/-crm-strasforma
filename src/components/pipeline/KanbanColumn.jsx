import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard from "./KanbanCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { toast } from "sonner";
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

export default function KanbanColumn({ column, onCardClick, onQuickCreate }) {
  const { state, dispatch } = useApp();
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [colName, setColName] = useState(column.name);

  const totalValue = (column.cards || []).reduce((sum, card) => sum + (card.value || 0), 0);

  const handleRename = async () => {
    if (!colName.trim() || colName === column.name) {
      setIsEditingName(false);
      setColName(column.name);
      return;
    }

    try {
      await db.updateColumn(column.id, { name: colName });
      const updatedPipelines = (state.pipelines || []).map(p => ({
        ...p,
        columns: (p.columns || []).map(c => c.id === column.id ? { ...c, name: colName } : c)
      }));
      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
      setIsEditingName(false);
      toast.success("Étape renommée");
    } catch (error) {
      toast.error("Erreur lors du renommage");
      setColName(column.name);
    }
  };

  const handleDelete = async () => {
    if ((column.cards || []).length > 0) {
      toast.error("Impossible de supprimer une étape contenant des affaires");
      return;
    }

    try {
      await db.deleteColumn(column.id);
      const updatedPipelines = (state.pipelines || []).map(p => ({
        ...p,
        columns: (p.columns || []).filter(c => c.id !== column.id)
      }));
      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
      toast.success("Étape supprimée");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="flex flex-col w-[300px] h-full bg-slate-100/50 rounded-xl border border-slate-200 shadow-sm">
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {isEditingName ? (
              <Input 
                autoFocus 
                value={colName} 
                onChange={e => setColName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                className="h-7 text-sm font-bold bg-white"
              />
            ) : (
              <h3 className="font-bold text-slate-700 text-sm truncate cursor-pointer hover:text-green-600" onClick={() => setIsEditingName(true)}>
                {column.name}
              </h3>
            )}
            <Badge variant="secondary" className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0 h-5">
              {column.cards.length}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setIsEditingName(true)}>Renommer</DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                    Supprimer
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est définitive. Vous ne pouvez supprimer que les étapes vides.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600">Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-green-600 font-black">{totalValue.toLocaleString()} €</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 text-slate-400 hover:text-green-600"
            onClick={() => onQuickCreate && onQuickCreate(column.id)}
            title="Ajouter une affaire ici"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-2 space-y-3 overflow-y-auto scrollbar-hide">
        <SortableContext 
          items={column.cards.map(c => c.id)} 
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard 
              key={card.id} 
              card={card} 
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
        
        {column.cards.length === 0 && (
          <div className="h-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300 text-xs italic">
            Déposez ici
          </div>
        )}
      </div>
    </div>
  );
}
