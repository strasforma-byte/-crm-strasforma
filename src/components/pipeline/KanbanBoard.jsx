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
import { toast } from "sonner";

import { db } from "@/lib/db";

export default function KanbanBoard({ pipeline }) {
  const { state, dispatch, refreshAllData } = useApp();
  const { isAdmin, currentUser } = usePermissions();
  const [activeCard, setActiveCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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

  const findColumnOfCard = (cardId) => {
    return pipeline.columns.find(col => 
      col.cards.find(card => card.id === cardId)
    );
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const card = pipeline.columns
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
    const overColumn = pipeline.columns.find(col => col.id === overId) || findColumnOfCard(overId);

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return;

    // Move card logic for visual feedback
    const activeCards = activeColumn.cards;
    const overCards = overColumn.cards;
    const activeIndex = activeCards.findIndex(c => c.id === activeId);
    const overIndex = overCards.findIndex(c => c.id === overId);

    let newIndex;
    if (pipeline.columns.find(col => col.id === overId)) {
      newIndex = overCards.length + 1;
    } else {
      const isBelowLastItem = over && overIndex === overCards.length - 1;
      const modifier = isBelowLastItem ? 1 : 0;
      newIndex = overIndex >= 0 ? overIndex + modifier : overCards.length + 1;
    }

    const cardToMove = activeCards[activeIndex];
    
    const updatedPipelines = state.pipelines.map(p => {
      if (p.id === pipeline.id) {
        return {
          ...p,
          columns: p.columns.map(col => {
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
        };
      }
      return p;
    });

    dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveCard(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    const activeColumn = findColumnOfCard(activeId);
    const overColumn = pipeline.columns.find(col => col.id === overId) || findColumnOfCard(overId);

    if (!activeColumn || !overColumn) {
      setActiveCard(null);
      return;
    }

    try {
      if (activeColumn.id === overColumn.id) {
        const oldIndex = activeColumn.cards.findIndex(c => c.id === activeId);
        const newIndex = overColumn.cards.findIndex(c => c.id === overId);

        if (oldIndex !== newIndex) {
          const newCards = arrayMove(activeColumn.cards, oldIndex, newIndex);
          
          // In a real scenario, we'd update 'order' for all affected cards.
          // For now, let's just update the moved card to ensure persistence.
          const movedCard = activeColumn.cards[oldIndex];
          await db.updateCard(activeId, { ...movedCard, order: newIndex });

          const updatedPipelines = state.pipelines.map(p => {
            if (p.id === pipeline.id) {
              return {
                ...p,
                columns: p.columns.map(col => 
                  col.id === activeColumn.id ? { ...col, cards: newCards } : col
                )
              };
            }
            return p;
          });
          dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
        }
      } else {
        // Moved to a different column
        const movedCard = activeColumn.cards.find(c => c.id === activeId);
        const targetCards = overColumn.cards;
        const overIndex = targetCards.findIndex(c => c.id === overId);
        
        let newOrder = overIndex >= 0 ? overIndex : targetCards.length;

        // Persist to DB
        const updatedDbCard = await db.updateCard(activeId, { 
          ...movedCard, 
          columnId: overColumn.id,
          order: newOrder 
        });

        // Update local state with DB response to ensure UI sync
        const updatedPipelines = state.pipelines.map(p => {
          if (p.id === pipeline.id) {
            return {
              ...p,
              columns: p.columns.map(col => {
                if (col.id === activeColumn.id) {
                  return { ...col, cards: col.cards.filter(c => c.id !== activeId) };
                }
                if (col.id === overColumn.id) {
                  const newColCards = [...col.cards];
                  // Map DB field names to camelCase for state
                  const mappedCard = {
                    ...updatedDbCard,
                    columnId: updatedDbCard.columnId,
                    contactId: updatedDbCard.contactId
                  };
                  newColCards.splice(newOrder, 0, mappedCard);
                  return { ...col, cards: newColCards };
                }
                return col;
              })
            };
          }
          return p;
        });

        dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
        toast.success(`Affaire déplacée vers ${overColumn.name}`);
      }
    } catch (error) {
      console.error("Error moving card:", error);
      toast.error("Erreur lors du déplacement");
      // Optionally reload data to revert UI
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
          {pipeline.columns.map((column) => (
            <KanbanColumn 
              key={column.id} 
              column={column} 
              onCardClick={(card) => {
                setSelectedCard(card);
                setIsSheetOpen(true);
              }}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeCard ? (
            <KanbanCard card={activeCard} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDetailSheet 
        card={selectedCard} 
        pipeline={pipeline}
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
      />
    </div>
  );
}
