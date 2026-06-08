import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import CardDetailSheet from "./CardDetailSheet";
import TaskDialog from "../agenda/TaskDialog";
import { toast } from "sonner";
import { Target, Calendar } from "lucide-react";

import { db } from "@/lib/db";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function KanbanBoard({ pipeline, onQuickCreate, onCardClick }) {
  const { state, dispatch, refreshAllData } = useApp();
  const { isAdmin, currentUser } = usePermissions();
  
  // Local state for immediate visual feedback during drag
  const [displayPipeline, setDisplayPipeline] = useState(pipeline);
  
  const [activeCard, setActiveCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Won/Lost Reason Logic
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [pendingMove, setPendingMove] = useState(null);
  const [isSavingReason, setIsSavingReason] = useState(false);

  // Keep local display in sync with prop when prop changes (from external updates)
  React.useEffect(() => {
    setDisplayPipeline(pipeline);
  }, [pipeline]);

  const handleCardClick = (card, quickAddTask = false) => {
    if (quickAddTask) {
      setSelectedCard(card);
      setIsTaskDialogOpen(true);
    } else if (onCardClick) {
      onCardClick(card);
    } else {
      setSelectedCard(card);
      setIsSheetOpen(true);
    }
  };

  const handleConfirmReason = async () => {
    if (!pendingMove || !reasonText.trim()) return;
    setIsSavingReason(true);
    try {
      const { activeId, movedCard, overColumn, newOrder, activeColumn } = pendingMove;

      const finalUpdates = { 
        ...movedCard, 
        columnId: overColumn.id,
        order: newOrder,
        history: [
          { date: new Date().toISOString(), userId: state.currentUser.id, action: `Marquée comme ${overColumn.name} : ${reasonText.trim()}` },
          ...(movedCard.history || [])
        ]
      };

      const updatedDbCard = await db.updateCard(activeId, finalUpdates);

      // Update global state using functional update to avoid race conditions
      dispatch({ 
        type: "UPDATE_PIPELINES", 
        payload: (prevPipelines) => prevPipelines.map(p => {
          if (p.id === pipeline.id) {
            return {
              ...p,
              columns: p.columns.map(col => {
                if (col.id === activeColumn.id) return { ...col, cards: col.cards.filter(c => c.id !== activeId) };
                if (col.id === overColumn.id) {
                  const newColCards = [...col.cards];
                  newColCards.splice(newOrder, 0, { ...updatedDbCard, columnId: updatedDbCard.columnId, contactId: updatedDbCard.contactId });
                  return { ...col, cards: newColCards };
                }
                return col;
              })
            };
          }
          return p;
        })
      });

      toast.success(`Affaire marquée comme ${overColumn.name}`);
      setIsReasonDialogOpen(false);
      setReasonText("");
      setPendingMove(null);
    } catch (error) {
      toast.error("Erreur lors de la validation");
    } finally {
      setIsSavingReason(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumnOfCard = (cardId, currentPipeline = displayPipeline) => {
    return currentPipeline.columns.find(col => 
      col.cards.find(card => card.id === cardId)
    );
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const card = displayPipeline.columns
      .flatMap(col => col.cards)
      .find(c => c.id === active.id);
    
    if (!card) return;

    // Permissions check
    if (!isAdmin && pipeline.ownerId !== currentUser.id && card.responsibleId !== currentUser.id) {
      toast.error("Vous n'avez pas le droit de déplacer cette affaire");
      return;
    }
    
    setActiveCard(card);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeColumn = findColumnOfCard(activeId);
    const overColumn = displayPipeline.columns.find(col => col.id === overId) || findColumnOfCard(overId);

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    // Move card logic for visual feedback (local only)
    const activeCards = activeColumn.cards;
    const overCards = overColumn.cards;
    const activeIndex = activeCards.findIndex(c => c.id === activeId);
    const overIndex = overCards.findIndex(c => c.id === overId);

    let newIndex;
    if (displayPipeline.columns.find(col => col.id === overId)) {
      newIndex = overCards.length;
    } else {
      const isBelowLastItem = over && overIndex === overCards.length - 1;
      const modifier = isBelowLastItem ? 1 : 0;
      newIndex = overIndex >= 0 ? overIndex + modifier : overCards.length;
    }

    const cardToMove = activeCards[activeIndex];
    
    // Update LOCAL display pipeline for immediate feedback
    setDisplayPipeline(prev => ({
      ...prev,
      columns: prev.columns.map(col => {
        if (col.id === activeColumn.id) {
          return { ...col, cards: col.cards.filter(c => c.id !== activeId) };
        }
        if (col.id === overColumn.id) {
          const newColCards = [...col.cards];
          newColCards.splice(newIndex, 0, { ...cardToMove, columnId: overColumn.id });
          return { ...col, cards: newColCards };
        }
        return col;
      })
    }));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveCard(null);
      setDisplayPipeline(pipeline); // Reset to true state
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // We use displayPipeline to find where the card was dropped,
    // but we use original pipeline to find the actual original source.
    const originalColumn = findColumnOfCard(activeId, pipeline);
    const targetColumn = displayPipeline.columns.find(col => col.id === overId) || findColumnOfCard(overId, displayPipeline);

    if (!originalColumn || !targetColumn) {
      setActiveCard(null);
      setDisplayPipeline(pipeline);
      return;
    }

    try {
      const movedCard = originalColumn.cards.find(c => c.id === activeId);
      const targetCards = targetColumn.cards;
      const newOrder = targetCards.findIndex(c => c.id === activeId);

      if (originalColumn.id === targetColumn.id) {
        // Reordering in same column
        const oldIndex = originalColumn.cards.findIndex(c => c.id === activeId);
        
        if (oldIndex !== newOrder) {
          await db.updateCard(activeId, { ...movedCard, order: newOrder });

          dispatch({ 
            type: "UPDATE_PIPELINES", 
            payload: (prevPipelines) => prevPipelines.map(p => {
              if (p.id === pipeline.id) {
                return {
                  ...p,
                  columns: p.columns.map(col => {
                    if (col.id === originalColumn.id) {
                      const newCards = arrayMove(col.cards, oldIndex, newOrder);
                      return { ...col, cards: newCards };
                    }
                    return col;
                  })
                };
              }
              return p;
            })
          });
        }
      } else {
        // Moved to a different column
        // Sales Intelligence: Prompt for reason if won/lost
        const colName = targetColumn.name.toLowerCase();
        const isFinalState = colName.includes("gagné") || colName.includes("perdu") || colName.includes("won") || colName.includes("lost");

        if (isFinalState) {
          setPendingMove({ activeId, movedCard, overColumn: targetColumn, newOrder, activeColumn: originalColumn });
          setIsReasonDialogOpen(true);
        } else {
          // Standard Move
          const updatedDbCard = await db.updateCard(activeId, { ...movedCard, columnId: targetColumn.id, order: newOrder });

          dispatch({ 
            type: "UPDATE_PIPELINES", 
            payload: (prevPipelines) => prevPipelines.map(p => {
              if (p.id === pipeline.id) {
                return {
                  ...p,
                  columns: p.columns.map(col => {
                    if (col.id === originalColumn.id) return { ...col, cards: col.cards.filter(c => c.id !== activeId) };
                    if (col.id === targetColumn.id) {
                      const newColCards = [...col.cards];
                      newColCards.splice(newOrder, 0, { ...updatedDbCard, columnId: updatedDbCard.columnId, contactId: updatedDbCard.contactId });
                      return { ...col, cards: newColCards };
                    }
                    return col;
                  })
                };
              }
              return p;
            })
          });
          toast.success(`Affaire déplacée vers ${targetColumn.name}`);
        }
      }
    } catch (error) {
      console.error("Error moving card:", error);
      toast.error("Erreur lors du déplacement");
      setDisplayPipeline(pipeline);
      refreshAllData();
    }

    setActiveCard(null);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return (
    <div className="h-full w-full overflow-x-auto overflow-y-hidden bg-slate-50 p-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full min-w-max pb-4">
          {(displayPipeline.columns || []).map((column) => (
            <KanbanColumn 
              key={column.id} 
              column={column} 
              onCardClick={handleCardClick}
              onQuickCreate={onQuickCreate}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeCard ? (
            <KanbanCard card={activeCard} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={isReasonDialogOpen} onOpenChange={(val) => {
        setIsReasonDialogOpen(val);
        if (!val) { setReasonText(""); setPendingMove(null); }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Bilan de l'affaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">
                Pourquoi marquer cette affaire comme "{pendingMove?.overColumn.name}" ?
              </Label>
              <Textarea 
                placeholder="Ex: Signature du contrat signée, budget refusé, pas de réponse..."
                className="min-h-[100px] bg-slate-50 border-slate-100"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-slate-400 italic">Ce motif sera conservé dans l'historique permanent de l'affaire.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReasonDialogOpen(false)}>Annuler</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white font-bold" 
              onClick={handleConfirmReason}
              disabled={isSavingReason || !reasonText.trim()}
            >
              {isSavingReason ? "Validation..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
