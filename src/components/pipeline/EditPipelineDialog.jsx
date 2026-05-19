import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function EditPipelineDialog({ open, onOpenChange, pipeline }) {
  const { state, dispatch } = useApp();
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && pipeline) {
      setName(pipeline.name || "");
      setColumns(pipeline.columns ? [...pipeline.columns] : []);
    }
  }, [open, pipeline?.id]);

  const handleAddColumn = async () => {
    if (!pipeline) return;
    
    try {
      const newColData = {
        pipelineId: pipeline.id,
        name: "Nouvelle étape",
        order: columns.length
      };
      const savedCol = await db.insertColumn(newColData);
      setColumns([...columns, { ...savedCol, cards: [] }]);
      
      // Update global state too
      const updatedPipelines = state.pipelines.map(p => {
        if (p.id === pipeline.id) {
          return { ...p, columns: [...p.columns, { ...savedCol, cards: [] }] };
        }
        return p;
      });
      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    } catch (error) {
      toast.error("Erreur lors de l'ajout de l'étape");
    }
  };

  const handleRemoveColumn = async (id) => {
    const column = columns.find(c => c.id === id);
    if (column && column.cards && column.cards.length > 0) {
      toast.error("Impossible de supprimer une colonne contenant des affaires");
      return;
    }
    
    try {
      await db.deleteColumn(id);
      setColumns(columns.filter(c => c.id !== id));
      
      // Update global state
      const updatedPipelines = state.pipelines.map(p => {
        if (p.id === pipeline.id) {
          return { ...p, columns: p.columns.filter(c => c.id !== id) };
        }
        return p;
      });
      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    } catch (error) {
      toast.error("Erreur lors de la suppression de l'étape");
    }
  };

  const handleUpdateColumnName = async (id, newName) => {
    // Local update for immediate feedback
    setColumns(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    
    try {
      await db.updateColumn(id, { name: newName });
      
      // Update global state
      const updatedPipelines = state.pipelines.map(p => {
        if (p.id === pipeline.id) {
          return {
            ...p,
            columns: p.columns.map(c => c.id === id ? { ...c, name: newName } : c)
          };
        }
        return p;
      });
      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
    } catch (error) {
      toast.error("Erreur lors de la mise à jour de l'étape");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom du pipeline est requis");
      return;
    }

    setIsSaving(true);
    try {
      const updatedPipeline = await db.updatePipeline(pipeline.id, {
        name,
        visibility: pipeline.visibility // Keep existing visibility or add a toggle
      });

      const updatedPipelines = state.pipelines.map(p => 
        p.id === pipeline.id ? { ...p, ...updatedPipeline } : p
      );

      dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelines });
      toast.success("Pipeline mis à jour avec succès");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du pipeline");
    } finally {
      setIsSaving(false);
    }
  };

  if (!pipeline) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-green-600" />
            Modifier le Pipeline
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="pipe-name">Nom du pipeline</Label>
            <Input 
              id="pipe-name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ex: Ventes 2025"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Étapes du pipeline</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600" onClick={handleAddColumn}>
                <Plus className="w-3 h-3 mr-1" /> Ajouter une étape
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
              {columns.map((col, index) => (
                <div key={col.id} className="flex items-center gap-3 p-2 bg-slate-50 border rounded-lg group">
                  <GripVertical className="w-4 h-4 text-slate-300" />
                  <Input 
                    className="h-8 text-sm bg-white"
                    value={col.name}
                    onChange={e => handleUpdateColumnName(col.id, e.target.value)}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                    onClick={() => handleRemoveColumn(col.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
